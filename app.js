// Cargar variables de entorno desde .env
require('dotenv').config();

const http = require('http');
const express = require("express"); 
const socketIo = require('socket.io');

// const {createAdapter} = require('@socket.io/redis-adapter');
// const Redis = require('ioredis');

var app = express();
var bodyParser = require('body-parser');
var cors=require('cors');
const helmet = require('helmet');
const logger = require('./utilitarios/logger');

app.use(cors());
app.use(helmet());

// var config = require('./config');
var config = require('./_config'); 

var socketsController = require('./controllers/sockets');
const socketManager = require('./service/socket.manager');
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

// Canal de salida del chatbot (chatbot-go no puede iniciar conversación por su
// cuenta; nos pide que emitamos por el socket del gateway de WhatsApp).
var routesChatbot = require('./routes/routesChatbot');
app.use('/chatbot', routesChatbot);

app.use(function(req, res, next) {    
    var err = new Error('Not Found');
    err.status = 404;
    next(err);
});



    
// error handler
app.use(function(err, req, res, next) {
    // render the error page
    logger.error(err);
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
    // transports: ['polling', 'websocket'], // Polling primero para compatibilidad // para adaptter redis
    cors: corsOptions,
    connectTimeout: 45000,
    maxHttpBufferSize: 1e8,
    allowUpgrades: true, // Permite actualizar de polling a websocket
    // perMessageDeflate: false, // Deshabilita la compresión para mejor compatibilidad
    logger: {
        debug: (msg) => logger.debug('Socket.IO debug:', msg),
        info: (msg) => logger.info('Socket.IO info:', msg),
        error: (msg) => logger.error('Socket.IO error:', msg)
    }
}).listen(config.portSocket);

// 07102025 ===== redis adapter para trabajar con cluster ===== no funciono
// const pubClient = new Redis();
// const subClient = pubClient.duplicate();

// io.adapter(createAdapter(pubClient, subClient));
// logger.info('✅ Socket.IO con Redis adapter configurado');

// io.listen(config.portSocket);

// ===== fin redis adapter =====


server.listen(config.port, function () {
    logger.debug('Server is running.. port '+ config.port, 'socket port', config.portSocket); 
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
// });

socketManager.setIO(io);
socketsController.socketsOn(io);

// Iniciar job de limpieza de reservas de stock huérfanas (3:00 AM)
const stockCleanupJob = require('./service/stock.cleanup.job');
stockCleanupJob.iniciarJob();

// Los recordatorios de confirmación se movieron al chatbot (repo chatbot-go,
// internal/nudge) y se encienden desde el switch de su dashboard. Vivían aquí
// como controllers/recordatorioPedido.js, pero solo perseguían filas de
// pedido_preview, o sea pedidos que YA habían llegado al resumen: los abandonos
// reales ocurren antes (falta el método de pago o la hora de recojo), y para
// esos nunca nacía la fila. El chatbot sí tiene la conversación, así que decide
// allá y nos pide emitir por /chatbot/emitir.

// ejecutar servicio de envio de comprobantes electronicos
// apiServiceSendCPE.activarEnvioCpe(); // servicio propio
// apiServiceTimerChangeCosto.runTimerCosto()

module.exports = app;