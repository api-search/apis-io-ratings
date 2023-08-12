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
    
    var sql = "SELECT url FROM openapi WHERE scored <> " + weekNumber + " LIMIT 1";
    connection.query(sql, function (error, results, fields) { 
      
      if(results && results.length > 0){

        // Authoratative

        // Sum of Properties

        // Sum of APIs.json Rules

        // Sum of Properties Rules
        
        callback( null, results );                

      }
      else{
        
        // Pull one that is old
        var response = {};
        response['pulling'] = "old ones";            
        callback( null, response );          
        
      }
      
    });  
  
});