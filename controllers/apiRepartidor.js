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

const setUpdateEstadoPedido = function (idpedido, estado) {  
    const read_query = `update pedido set pwa_delivery_status = '${estado}' where idpedido = ${idpedido};`;
    emitirRespuesta(read_query);        
}
module.exports.setUpdateEstadoPedido = setUpdateEstadoPedido;

const setUpdateRepartidorOcupado = function (idrepartidor, estado) {  
    const read_query = `update repartidor set ocupado = ${estado} where idrepartidor = ${idrepartidor};`;
    emitirRespuesta(read_query);        
}
module.exports.setUpdateRepartidorOcupado = setUpdateRepartidorOcupado;



const getSocketIdRepartidor = async function (listIdRepartidor) {
	// const idcliente = dataCLiente.idcliente;
    const read_query = `SELECT socketid from repartidor where idrepartidor in (${listIdRepartidor})`;
    return emitirRespuesta(read_query);        
}
module.exports.getSocketIdRepartidor = getSocketIdRepartidor;



const getEstadoPedido = async function (req, res) {	
    const idpedido = req.body.idpedido;
        
    const read_query = `select pwa_delivery_status from pedido where idpedido=${idpedido}`;
    // return emitirRespuestaSP(read_query);      
    emitirRespuesta_RES(read_query, res);  
}
module.exports.getEstadoPedido = getEstadoPedido;


const setFinPedidoEntregado = function (req, res) {
	const obj = req.body;
	console.log(JSON.stringify(obj));

    const read_query = `call procedure_pwa_delivery_pedido_entregado('${JSON.stringify(obj)}')`;
    return emitirRespuestaSP(read_query);        
}
module.exports.setFinPedidoEntregado = setFinPedidoEntregado;

const getPedidosEntregadoDia = function (req, res) {
	const idrepartidor = managerFilter.getInfoToken(req,'idrepartidor');
	
    const read_query = `call procedure_pwa_repartidor_pedido_entregado_dia(${idrepartidor})`;
    return emitirRespuesta_RES(read_query, res);        
}
module.exports.getPedidosEntregadoDia = getPedidosEntregadoDia;

const getPedidosResumenEntregadoDia = function (req, res) {
	const idrepartidor = managerFilter.getInfoToken(req,'idrepartidor');
	
    const read_query = `call procedure_pwa_repartidor_resumen_entregado_dia(${idrepartidor})`;
    return emitirRespuesta_RES(read_query, res);        
}
module.exports.getPedidosResumenEntregadoDia = getPedidosResumenEntregadoDia;




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
