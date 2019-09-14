var express = require("express"); 
var bodyParser = require('body-parser');
var cors=require('cors');
var app = express();
var config = require('./config');
var socketsController = require('./controllers/sockets');

app.use(cors());
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
const server = require('http').Server(app);
server.listen(config.port, function () {
    console.log('Server is running.. port '+ config.port); 
});

const io = require('socket.io')(server, {
  path: '/api-pwa/socket.io'
});

socketsController.socketsOn(io);


module.exports = app;