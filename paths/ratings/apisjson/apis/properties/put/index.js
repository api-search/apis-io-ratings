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

    var sql = "SELECT * FROM properties WHERE pulled <> 0 AND rated <> " + weekNumber + " AND 'status' = 200 AND ('type' LIKE '%swagger%' OR 'type' LIKE '%OPENAPI%' LIMIT 1";
    connection.query(sql, function (error, results, fields) { 
      
      if(results && results.length > 0){
        
        // Pull any new ones.
        var apisjson_name = results[0].name;
        var apisjson_url = results[0].url;
        var apisjson_slug = results[0].slug;

        var local_openapi = "https://kinlane-productions2.s3.amazonaws.com/" + results[0].path;
        console.log(local_openapi);

        https.get(local_openapi, res => {
          
          let data = [];
          //const headerDate = res.headers && res.headers.date ? res.headers.date : 'no response date';
          
          //console.log('Status Code:', res.statusCode);
          //console.log('Date in Response header:', headerDate);
        
          res.on('data', chunk => {
            data.push(chunk);
          });
        
          res.on('end', () => {

            var openapi_file = Buffer.concat(data).toString();

            // We need know if it is OpenAPI or Swagger - Probably JSON Schema validation at some point
            var type = '';
            var openapi_object = JSON.parse(openapi_file);
            if(openapi_object.openapi){
              type = 'openapi';
            }
            if(openapi_object.swagger){
              type = 'swagger';
            }
            // At this point I don't care -- but will need to care in the future.

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

                    var sql = "UPDATE properties SET rated = " + weekNumber + ", rules = '" + rules + "' WHERE url = '" + apisjson_url + "'";
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
                  response['pulling'] = "Problem linting the OpenAPI / Swagger.";            
                  callback( null, response );  
                  connection.end();   
                });

            });

            req.write(openapi_file);
            req.end(); 

          });
        }).on('error', err => {
          var response = {};
          response['pulling'] = "Problem pulling from S3.";            
          callback( null, response );  
          connection.end();   
        });
        

      }
      else{
        
        // Pull one that is old
        var response = {};
        response['pulling'] = "No more new ones, looking for old ones.";            
        callback( null, response );  
        connection.end();        
        
      }
      
    });  
  
});