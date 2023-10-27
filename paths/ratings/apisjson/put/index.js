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

    var sql = "SELECT * FROM apisjson WHERE rated <> " + weekNumber + " AND valid = 1 LIMIT 1";
    connection.query(sql, function (error, results, fields) { 
      
      if(results && results.length > 0){
        
        // Pull any new ones.
        var apisjson_name = results[0].name;
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
                hostname: 'iuwhp1w2ha.execute-api.us-east-1.amazonaws.com',
                method: 'POST',
                path: '/staging/linter/apisjson',
                headers: {
                    'Content-Type': 'application/json',
                    'x-api-key': process.env.api_key
                }
            };

            console.log(options);

            //var apisjson = JSON.stringify(Buffer.concat(data).toString());
            console.log(Buffer.concat(data).toString());                     
        
            var req = https.request(options, (res) => {

                let body = '';
                res.on('data', (chunk) => {
                    body += chunk;
                });
    
                res.on('end', () => {

                    var spectral_results = JSON.parse(body);
                    console.log(spectral_results);

                    var rules = '';
                    for (let i = 0; i < spectral_results.length; i++) {
                      if(!rules.includes(spectral_results[i].code)){
                        rules += spectral_results[i].code + ",";
                      }
                    }
                    rules = rules.substring(0, rules.length - 1);

                    var sql = "UPDATE apisjson SET rated = " + weekNumber + ", rules = '" + rules + "' WHERE url = '" + apisjson_url + "'";
                    connection.query(sql, function (error, results, fields) { 
                      var response = {};
                      response.message = "Rated " + apisjson_name + " APIs.json";
                      response.rules = rules;
                      callback( null, response);
                      connection.end();
                    }); 

                });

                res.on('error', () => {
                  var response = {};
                  response['pulling'] = "Problem linting the APIs.json.";            
                  callback( null, response );  
                  connection.end();
                });

            });

            req.write(Buffer.concat(data).toString());
            req.end(); 

          });
        }).on('error', err => {
          var response = {};
          response['pulling'] = "Problem pulling the APIs.json.";            
          callback( null, response );  
        });
        

      }
      else{
        
        // Pull one that is old
        var response = {};
        response['pulling'] = "No more to rate.";            
        response.sql = sql;
        response.sql = results;
        callback( null, response );  
        connection.end();        
        
      }
      
    });  
  
});