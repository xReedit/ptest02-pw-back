const http = require('http');
const express = require("express"); 
const socketIo = require('socket.io');

var app = express();
var bodyParser = require('body-parser');
var cors=require('cors');


app.use(cors());

// "socket.io": "^2.4.1",
// "socket.io-client": "^2.4.0",

// var config = require('./config');
var config = require('./_config');
var socketsController = require('./controllers/sockets');
// const apiServiceSendCPE = require('./controllers/serviceSendCPE');
const apiServiceTimerChangeCosto = require('./controllers/timerChangeCosto.js');



app.use(bodyParser.json({ limit: '50mb' })); // soporte para bodies codificados en jsonsupport
app.use(bodyParser.urlencoded({ extended: true, limit: '50mb', extended: true, parameterLimit: 50000 })); // soporte para bodies codificados


// para pwa-app-pedidos
var appV3 = require('./routes/v3');
app.use('/v3',appV3);

var routesPinPad = require('./routes/routesPinPad'); 
app.use('/pinpad', routesPinPad);

var routesHolding = require('./routes/routesHolding'); 
app.use('/v3/holding', routesHolding);

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
// 271220 cambiamos pingTimeout: 5000, a 30000
// var io = socketIo(server, {
//     pingInterval: 10000,
//     pingTimeout: 30000,    
//     cookie: false,    
// }).listen(config.portSocket);

const corsOptions = {
    origin: function(origin, callback) {
        callback(null, origin); // Permite cualquier origen pero mantiene las credenciales
    },
    credentials: true,
    // methods: ["GET", "POST", "OPTIONS"],
    // allowedHeaders: ["my-custom-header", "content-type"],
};

const io = socketIo(server, {    
    // path: '/socket.io', // Asegúrate que coincida con la configuración del cliente
    pingInterval: 25000,
    pingTimeout: 60000,
    allowEIO3: true,
    // transports: ['polling', 'websocket'], // Polling primero para compatibilidad
    cors: corsOptions,
    connectTimeout: 45000,
    maxHttpBufferSize: 1e8,
    allowUpgrades: true, // Permite actualizar de polling a websocket
    // perMessageDeflate: false, // Deshabilita la compresión para mejor compatibilidad
    logger: {
        debug: (msg) => console.log('Socket.IO debug:', msg),
        info: (msg) => console.log('Socket.IO info:', msg),
        error: (msg) => console.error('Socket.IO error:', msg)
    }
}).listen(config.portSocket);

server.listen(config.port, function () {
    console.log('Server is running.. port '+ config.port, 'socket port', config.portSocket); 
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





// ejecutar servicio de envio de comprobantes electronicos
// apiServiceSendCPE.activarEnvioCpe(); // servicio propio
// apiServiceTimerChangeCosto.runTimerCosto()

module.exports = app;