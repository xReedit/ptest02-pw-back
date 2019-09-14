var express = require("express")(); 
var bodyParser = require('body-parser');
var cors=require('cors');
var app = express();
var config = require('./config');
var socketsController = require('./controllers/sockets');

// var socket = require('socket.io');
// var http = require('http');
// var server = http.createServer(app);

app.use(cors());
app.use(bodyParser.json()); // soporte para bodies codificados en jsonsupport
app.use(bodyParser.urlencoded({ extended: true })); // soporte para bodies codificados

// CORS
// app.use(function(req, res, next) {
//     res.header("Access-Control-Allow-Origin", "*");
//     res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept, *");
//     res.header("Access-Control-Allow-Methods", "POST, GET, PUT, DELETE, OPTIONS");
//     next();
// });

// para pwa-app-pedidos
var appV3 = require('./routes/v3');
app.use('/v3',appV3);

app.use(function(req, res, next) {
    var err = new Error('Not Found');
    err.status = 404;
    next(err);
});


// error handler
app.use(function(err, req, res, next) {
    // render the error page
    console.log(err);
    res.status(err.status || 500);
    res.json({
        status: 0,
        data: err.message
    });
    // res.render('error');
});


// sockets

// const server = require('http').createServer(app);
var http = require('http');
var server = http.createServer(app);
const io = require('socket.io')(server);
// var io = socket.listen(server);

socketsController.socketsOn(io);

server.listen(config.port, function () {
    console.log('Server is running.. port '+ config.port); 
});

module.exports = app;