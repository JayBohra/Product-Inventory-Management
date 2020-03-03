'use strict';

var SwaggerExpress = require('swagger-express-mw');
var app = require('express')();
var bodyparser = require("body-parser");
const mongoose = require('mongoose');
const mongoDB = 'mongodb://localhost:27017/db'// mongoUrl

app.use(bodyparser.json());
mongoose.connect(mongoDB);

var db = mongoose.connection;

mongoose.connect(mongoDB, (err) => {
  if(!err) {
    console.log("Connected to db");
  } else {
    console.log("Error connecting to db", err);    
  }
  
})

module.exports = app; // for testing

var config = {
  appRoot: __dirname // required config
};

SwaggerExpress.create(config, function(err, swaggerExpress) {
  if (err) { throw err; }

  // install middleware
  swaggerExpress.register(app);

  var port = process.env.PORT || 10010;
  app.listen(port);

  if (swaggerExpress.runner.swagger.paths['/hello']) {
    console.log('try this:\ncurl http://127.0.0.1:' + port + '/hello?name=Scott');
  }
});
