const vandium = require('vandium');
const mysql  = require('mysql');
const https  = require('https');
const AWS = require("aws-sdk");

const s3 = new AWS.S3({
  accessKeyId: process.env.key,
  secretAccessKey: process.env.secret, 
  Bucket: "kinlane-productions2"
});

exports.handler = vandium.generic()
  .handler( (event, context, callback) => {

    var connection = mysql.createConnection({
    host     : process.env.host,
    user     : process.env.user,
    password : process.env.password,
    database : process.env.database
    });
     
    let currentDate = new Date();
    let startDate = new Date(currentDate.getFullYear(), 0, 1);
    let days = Math.floor((currentDate - startDate) / (24 * 60 * 60 * 1000));
     
    const weekNumber = Math.ceil(days / 7);

    var sql = "SELECT * FROM apisjson WHERE rated <> " + weekNumber + " LIMIT 1";
    connection.query(sql, function (error, results, fields) { 
      
      if(results && results.length > 0){
        
        // Pull any new ones.
        var apisjson_url = results[0].url;
        var apisjson_slug = apisjson_url.replace('http://','http-');
        apisjson_slug = apisjson_slug.replace('.json','');
        apisjson_slug = apisjson_slug.replace('.yaml','');
        apisjson_slug = apisjson_slug.replace('https://','https-');
        apisjson_slug = apisjson_slug.replace(/\//g, '-');
        apisjson_slug = apisjson_slug.replace('.','-');

        var local_apis_json = "https://kinlane-productions2.s3.amazonaws.com/" + results[0].path;
        console.log(local_apis_json);

        https.get(local_apis_json, res => {
          
          let data = [];
          //const headerDate = res.headers && res.headers.date ? res.headers.date : 'no response date';
          
          //console.log('Status Code:', res.statusCode);
          //console.log('Date in Response header:', headerDate);
        
          res.on('data', chunk => {
            data.push(chunk);
          });
        
          res.on('end', () => {
  
            const options = {
                protocol: 'https:',
                hostname: 'yzd9042kgi.execute-api.us-east-1.amazonaws.com',
                port: 443,
                method: 'PUT',
                path: '/staging/ratings/apisjson',
                headers: {
                    'Content-Type': 'application/json',
                    'x-api-key': process.env.api_key
                }
            };

            console.log(options);

            var apisjson = JSON.stringify(Buffer.concat(data).toString());
            console.log(apisjson);                     
        
            var req = https.request(options, (res) => {

                let body = '';
                res.on('data', (chunk) => {
                    body += chunk;
                });
    
                res.on('end', () => {
                    console.log(body);
                    callback( null, body );
                    connection.end();
                });
                res.on('error', () => {
                  callback( null, "Error pulling from S3." );
                  connection.end();
                });

            });

            req.write(apisjson);
            req.end();         
            
            
          });
        }).on('error', err => {
          callback( null, err );
          connection.end();
        });
        

      }
      else{
        
        // Pull one that is old
        var response = {};
        response['pulling'] = "No more new ones, looking for old ones.";            
        callback( null, error );  
        connection.end();        
        
      }
      
    });  
  
});