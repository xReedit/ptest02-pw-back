const { to, ReE, ReS }  = require('../service/uitl.service');
const sendMsjsService = require('./sendMsj.js')
let Sequelize = require('sequelize');
let config = require('../config');
let managerFilter = require('../utilitarios/filters');

let sequelize = new Sequelize(config.database, config.username, config.password, config.sequelizeOption);

let mysql_clean = function (string) {
        return sequelize.getQueryInterface().escape(string);
};

const setRepartidorConectado = function (dataCLiente) {	
    const idrepartidor = dataCLiente.idrepartidor;
    const socketid = dataCLiente.socketid;
    if ( idrepartidor ) {    	
    	const read_query = `update repartidor set socketid = '${socketid}' where idrepartidor =${idrepartidor}`;
    	return emitirRespuesta(read_query);
    }    
}
module.exports.setRepartidorConectado = setRepartidorConectado;

const setEfectivoMano = function (req, res) {  
	const idrepartidor = managerFilter.getInfoToken(req,'idrepartidor');
	const efectivo = req.body.efectivo;      
	const online = req.body.online;     
	
    const read_query = `update repartidor set efectivo_mano = ${efectivo}, online = ${online} where idrepartidor = ${idrepartidor}`;
    emitirRespuesta_RES(read_query, res);        
}
module.exports.setEfectivoMano = setEfectivoMano;

const pushSuscripcion = async function (req) {	
	const idrepartidor = managerFilter.getInfoToken(req,'idrepartidor');
	const suscripcion = req.body.suscripcion;	

	const read_query = `update repartidor set key_suscripcion_push = '${JSON.stringify(suscripcion)}' where idrepartidor = ${idrepartidor}`;
	return emitirRespuesta(read_query);
}
module.exports.pushSuscripcion = pushSuscripcion;

const setPositionNow = function (req, res) {  
	const idrepartidor = managerFilter.getInfoToken(req,'idrepartidor');
	const pos = req.body.pos;           
	
    const read_query = `update repartidor set position_now = '${JSON.stringify(pos)}' where idrepartidor = ${idrepartidor}`;
    emitirRespuesta_RES(read_query, res);        
}
module.exports.setPositionNow = setPositionNow;


const getRepartidoreForPedido = async function (dataPedido) {
	const es_latitude = dataPedido.dataDelivery.establecimiento.latitude;
    const es_longitude = dataPedido.dataDelivery.establecimiento.longitude;		                  
    const read_query = `call procedure_delivery_get_repartidor(${es_latitude}, ${es_longitude})`;
    return emitirRespuestaSP(read_query);        
}
module.exports.getRepartidoreForPedido = getRepartidoreForPedido;


// enviar pedido al primer repartidor de lista
const sendPedidoRepartidor = async function (listRepartidores, dataPedido, io) {

	// agarramos el primer repartidor de la lista
	const firtsRepartidor = listRepartidores[0];

	// enviamos push notificaction
	const notification = {
		"notification": {
		        "notification": {
		            "title": "Nuevo Pedido",
		            "body": `${firtsRepartidor.nombre} te llego un pedido.`,
		            "icon": "./favicon.ico",
		            "lang": "es",
		            "vibrate": [100, 50, 100]
		        }
		    }
		}	
	sendMsjsService.sendPushNotificactionOneRepartidor(firtsRepartidor.key_suscripcion_push, notification);

	// enviamos el socket
	console.log('socket enviado a repartidor', firtsRepartidor.socketid);
	io.to(firtsRepartidor.socketid).emit('repartidor-nuevo-pedido', [firtsRepartidor, dataPedido]);

}
module.exports.sendPedidoRepartidor = sendPedidoRepartidor;


const setAsignarPedido = function (req, res) {  
	const idrepartidor = managerFilter.getInfoToken(req,'idrepartidor');
	const idpedido = req.body.idpedido;           
	
    const read_query = `update pedido set idrepartidor = '${idrepartidor}' where idpedido = ${idpedido}; update repartidor set ocupado=1 where idrepartidor = ${idrepartidor};`;
    emitirRespuesta_RES(read_query, res);        
}
module.exports.setAsignarPedido = setAsignarPedido;







function emitirRespuestaSP(xquery) {
	console.log(xquery);
	return sequelize.query(xquery, {		
		type: sequelize.QueryTypes.SELECT
	})
	.then(function (rows) {

		// convertimos en array ya que viene en object
		var arr = [];
		arr = Object.values(rows[0]);		
		
		return arr;
	})
	.catch((err) => {
		return false;
	});
}



function emitirRespuesta(xquery, res) {
	console.log(xquery);
	return sequelize.query(xquery, {type: sequelize.QueryTypes.SELECT})
	.then(function (rows) {
		
		// return ReS(res, {
		// 	data: rows
		// });
		return rows;
	})
	.catch((err) => {
		return false;
	});
}



function emitirRespuesta_RES(xquery, res) {
	console.log(xquery);
	return sequelize.query(xquery, {type: sequelize.QueryTypes.SELECT})
	.then(function (rows) {
		
		return ReS(res, {
			data: rows
		});
		// return rows;
	})
	.catch((err) => {
		return false;
	});
}
