const vandium = require('vandium');
const mysql  = require('mysql');
const https  = require('https');

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
    
    var sql1 = "SELECT * FROM apisjson WHERE scored <> " + weekNumber + " AND valid = 1 LIMIT 1";
    connection.query(sql1, function (error, results1, fields) { 
      
      if(results1 && results1.length > 0){

          var apisjson_name = results1[0].name;
          var apisjson_url = results1[0].url;
          var apisjson_url2 = new URL(apisjson_url);
          var apisjson_host = apisjson_url2.hostname;
          var apisjson_rules = results1[0].rules;
          var rules_in = apisjson_rules.replace(/,/g, "','");

          var authoritative_total = 0;
          var properties_total = 0;
          var rules_total = 0;
    
          var sql2 = "SELECT * FROM apis WHERE apisjson_url = '" + apisjson_url + "'";
          connection.query(sql2, function (error, results2, fields) { 
            
            if(results2 && results2.length > 0){

              var all_base_url = '';
              for (let i = 0; i < results2.length; i++) {

                var api_human_url = results2[i].humanURL;
                var api_base_url = results2[i].baseURL;
                all_base_url += "'" + api_base_url + "',";
                var api_human_url2 = new URL(api_human_url);
                var api_human_host = api_human_url2.hostname;   
                
                console.log(apisjson_host + ' == ' + api_human_host);
                if(apisjson_host == api_human_host){
                  authoritative_total++;
                }
    
              }
              all_base_url = all_base_url.substring(0, all_base_url.length - 1);
      
              var sql3 = "SELECT count(*) as property_count FROM properties WHERE api_base_url IN (" + all_base_url + ") AND `status` = 200";
              connection.query(sql3, function (error, results3, fields) { 
                
                if(results3 && results3.length > 0){

                  // Sum of Properties
                  properties_total = results3[0].property_count;                  
          
                  var sql4 = "SELECT sum(score) as rules_total FROM rules WHERE name IN ('" + rules_in + "')";
                  connection.query(sql4, function (error, results4, fields) { 
                    
                    if(results4 && results4.length > 0){
    
                      // Sum of APIs.json Rules
                      rules_total = results4[0].rules_total;                  
              
                      // Sum of Properties Rules - NEXT

                      var results = {};
                      results.authoritative_total = authoritative_total;
                      results.properties_total = properties_total;
                      results.rules_total = rules_total;

                      var score = authoritative_total + properties_total + rules_total;

                      var sql5 = "SELECT max(score) as max_score FROM apisjson";
                      connection.query(sql5, function (error, results5, fields) { 
                        
                        if(results5 && results5.length > 0){
        
                          // Max Score
                          var max_score = results5[0].max_score;                  
    
                          var percentage = (100 * score) / max_score;
    
                          var sql6 = "UPDATE apisjson SET score = " + score + ",percentage = " + percentage + ", scored = " + weekNumber + " WHERE url = '" + apisjson_url + "'";
                          connection.query(sql6, function (error, results6, fields) {                       
                          
                            // Update score
                            var response = {};
                            response.sql5 = sql5;
                            response['pulling'] = "Updated score.";            
                            callback( null, response );     
    
                          });  
                          
                        }
                        else{
                          
                          // Pull one that is old
                          var response = {};
                          response.sql5 = sql5;
                          response['pulling'] = "No rules.";            
                          callback( null, response );          
                          
                        }

                      });   
                      
                    }
                    else{
                      
                      // Pull one that is old
                      var response = {};
                      response.sql4 = sql4;
                      response['pulling'] = "No rules.";            
                      callback( null, response );          
                      
                    }
                    
                  });   
                  
                }
                else{
                  
                  // Pull one that is old
                  var response = {};
                  response.sql3 = sql3;
                  response['pulling'] = "No properties.";            
                  callback( null, response );          
                  
                }
                
              }); 
                      
      
            }
            else{
              
              // Pull one that is old
              var response = {};
              response.sql2 = sql2;
              response['pulling'] = "No APIs.";            
              callback( null, response );          
              
            }
            
          }); 

      }
      else{
        
        // Pull one that is old
        var response = {};
        response.sql1 = sql1;
        response['pulling'] = "No APIs.json.";            
        callback( null, response );          
        
      }
      
    });  
  
});