const http = require('http');
const express = require("express"); 
const socketIo = require('socket.io');

var app = express();
var bodyParser = require('body-parser');
var cors=require('cors');

var config = require('./config');
var socketsController = require('./controllers/sockets');


// const _config = {
//     application: {
//         cors: {
//             server: [
//                 {
//                     origin: "*", //servidor que deseas que consuma o (*) en caso que sea acceso libre
//                     credentials: true
//                 }
//             ]
//         }
//     }
// }
// _config.application.cors.server
app.use(cors());
// app.options('*', cors());



app.use(bodyParser.json()); // soporte para bodies codificados en jsonsupport
app.use(bodyParser.urlencoded({ extended: true })); // soporte para bodies codificados



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

var server = http.createServer(app);

// // desarrollo
var io = socketIo(server, {
    pingInterval: 10000,
    pingTimeout: 5000,
    cookie: false
}).listen(config.portSocket);

server.listen(config.port, function () {
    console.log('Server is running.. port '+ config.port); 
});

// produccion
// var io = socketIo(server, {
//   path: '/api.pwa/socket.io'
// });

// const server = require('http').createServer(app);
// const io = require('socket.io')(server, {
//   path: '/api-pwa/socket.io'
// });

// server.listen(config.port, function () {
//     console.log('Server is running.. port '+ config.port); 
// });

socketsController.socketsOn(io);


module.exports = app;