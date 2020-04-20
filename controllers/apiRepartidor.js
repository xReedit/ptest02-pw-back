const { to, ReE, ReS }  = require('../service/uitl.service');
const sendMsjsService = require('./sendMsj.js')
let Sequelize = require('sequelize');
let config = require('../config');
let managerFilter = require('../utilitarios/filters');

let intervalBucaRepartidor = null;

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
	const pos = req.body.pos;    setEfectivoMano       
	
    const read_query = `update repartidor set position_now = '${JSON.stringify(pos)}' where idrepartidor = ${idrepartidor}`;
    emitirRespuesta_RES(read_query, res);        
}
module.exports.setPositionNow = setPositionNow;


const getRepartidoreForPedido = async function (dataPedido) {
	const datosEstablecimiento = dataPedido.dataDelivery ? dataPedido.dataDelivery.establecimiento : dataPedido.datosDelivery.establecimiento;
	const es_latitude = datosEstablecimiento.latitude;
    const es_longitude = datosEstablecimiento.longitude;		                  
    const read_query = `call procedure_delivery_get_repartidor(${es_latitude}, ${es_longitude})`;
    return emitirRespuestaSP(read_query);        
}
module.exports.getRepartidoreForPedido = getRepartidoreForPedido;

// dataPedido es el registro de la tabla pedido
const getRepartidoreForPedidoFromInterval = async function (es_latitude, es_longitude) {		                  
    const read_query = `call procedure_delivery_get_repartidor(${es_latitude}, ${es_longitude})`;
    return emitirRespuestaSP(read_query);        
}
module.exports.getRepartidoreForPedidoFromInterval = getRepartidoreForPedidoFromInterval;

const getPedidosEsperaRepartidor = async function () {	
    const read_query = `SELECT p.*, s.longitude, s.latitude
	from pedido p 
		inner join  sede s on p.idsede = s.idsede
	where p.is_from_client_pwa =1 and pwa_is_delivery = 1 and COALESCE(idrepartidor, 0) = 0  and s.pwa_delivery_servicio_propio = 0;`;
	
	return emitirRespuesta(read_query);  
	// const read_query = `call procedure_delivery_pedidos_pendientes()`;
 	// return emitirRespuestaData(read_query);        


}
module.exports.getPedidosEsperaRepartidor = getPedidosEsperaRepartidor;

// asigna el pedido temporalmente a espera que acepte
const setAsignaTemporalPedidoARepartidor = function (idpedido, idrepartidor_va, pedido) {	
    const read_query = `call procedure_delivery_set_pedido_repartidor(${idpedido}, ${idrepartidor_va},'${JSON.stringify(pedido)}')`;
    emitirRespuestaSP(read_query);        
}
module.exports.setAsignaTemporalPedidoARepartidor = setAsignaTemporalPedidoARepartidor;


const sendPedidoRepartidor = async function (listRepartidores, dataPedido, io) {

	// agarramos el primer repartidor de la lista
	const numIndex = 0; //dataPedido.num_reasignaciones;
	let firtsRepartidor = listRepartidores[numIndex];

	// quitamos el pedido al repartidor anterior
	if ( dataPedido.last_id_repartidor_reasigno ) {
		const getSocketIdRepartidorReasigno = await getSocketIdRepartidor(dataPedido.last_id_repartidor_reasigno);
		io.to(getSocketIdRepartidorReasigno[0].socketid).emit('repartidor-notifica-server-quita-pedido', dataPedido.idpedido);	
	}


	// si no encuentra repartidor envia nuevamente al primero
	if ( !firtsRepartidor ) {		
		firtsRepartidor = listRepartidores[0];
		dataPedido.num_reasignado = 0;

		// resetea los contadores
		const read_query = `update pedido set num_reasignaciones = 0 where idpedido = ${dataPedido.idpedido}; 
							update repartidor set flag_paso_pedido=0, pedido_por_aceptar=null where flag_paso_pedido=${dataPedido.idpedido};`;
    	return emitirRespuestaSP(read_query); 
	} else {

		const read_query = `call procedure_delivery_set_pedido_repartidor(${dataPedido.idpedido}, ${firtsRepartidor.idrepartidor}, '${JSON.stringify(dataPedido)}')`;
		emitirRespuestaSP(read_query);
	}

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
	console.log('socket enviado a repartidor', firtsRepartidor);
	io.to(firtsRepartidor.socketid).emit('repartidor-nuevo-pedido', [firtsRepartidor, dataPedido]);

}
module.exports.sendPedidoRepartidor = sendPedidoRepartidor;

// enviar pedido al primer repartidor de lista
// const sendPedidoRepartidor = async function (listRepartidores, dataPedido, io) {

// 	// agarramos el primer repartidor de la lista
// 	const numIndex = dataPedido.num_reasignado ? dataPedido.num_reasignado : 0;
// 	let firtsRepartidor = listRepartidores[numIndex];

// 	// si no encuentra repartidor envia nuevamente al primero
// 	if ( !firtsRepartidor ) {		
// 		firtsRepartidor = listRepartidores[0];
// 		dataPedido.num_reasignado = 0;
// 	}

// 	// enviamos push notificaction
// 	const notification = {
// 		"notification": {
// 		        "notification": {
// 		            "title": "Nuevo Pedido",
// 		            "body": `${firtsRepartidor.nombre} te llego un pedido.`,
// 		            "icon": "./favicon.ico",
// 		            "lang": "es",
// 		            "vibrate": [100, 50, 100]
// 		        }
// 		    }
// 		}	
// 	sendMsjsService.sendPushNotificactionOneRepartidor(firtsRepartidor.key_suscripcion_push, notification);

// 	// enviamos el socket
// 	console.log('socket enviado a repartidor', firtsRepartidor);
// 	io.to(firtsRepartidor.socketid).emit('repartidor-nuevo-pedido', [firtsRepartidor, dataPedido]);

// }
// module.exports.sendPedidoRepartidor = sendPedidoRepartidor;


const setAsignarPedido = function (req, res) {  
	const idrepartidor = managerFilter.getInfoToken(req,'idrepartidor');
	const idpedido = req.body.idpedido;           
	
    const read_query = `update pedido set idrepartidor = '${idrepartidor}' where idpedido = ${idpedido}; update repartidor set ocupado=1 where idrepartidor = ${idrepartidor};
    					update repartidor set flag_paso_pedido=0, pedido_por_aceptar=null where flag_paso_pedido=${idpedido}`;
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


const getPedidoPendienteAceptar = async function (idrepartidor) {
	// const idcliente = dataCLiente.idcliente;
    const read_query = `SELECT pedido_por_aceptar from repartidor where idrepartidor = ${idrepartidor}`;
    return emitirRespuesta(read_query);        
}
module.exports.getPedidoPendienteAceptar = getPedidoPendienteAceptar;







// PROCESO LOAR PEDIDOS PENDIENTES
// PROCESO COLOCA LOS PEDIDOS EN LOS REPARTIDORES
// BUSCA CADA 2 MINUTOS COLOCAR PEDIDOS
// ejecuta hasta que la lista de pedidos pendientes este vacia
// activa la funcion cuando hay un nuevo pedido
// esto por que el socket no es seguro


async function colocarPedidoEnRepartidor(io) {

	// traer lista de pedidos que estan sin repartidor
	let listPedidos =  await getPedidosEsperaRepartidor();
	listPedidos = JSON.parse(JSON.stringify(listPedidos));
	// listPedidos = listPedidos.data;
	// console.log ( 'listPedidos', listPedidos.data );

	// listPedidos = JSON.parse(JSON.stringify(listPedidos));

	console.log ( 'listPedidos listPedidos.lenght', listPedidos.length );

	if (listPedidos.length > 0) {
		listPedidos.map(async p => {
			console.log('pedido procesar', p);
			p.json_datos_delivery = JSON.parse(p.json_datos_delivery);

			// const _pJson = JSON.parse(JSON.stringify(p));		
			console.log('pedido procesar json', p);
			// lista de repartidores			
			const listRepartidores = await getRepartidoreForPedidoFromInterval(p.latitude, p.longitude);

			// enviamos
			sendPedidoRepartidor(listRepartidores, p, io);
		});
	} else {

		console.log('fin del proceso')
		clearInterval(intervalBucaRepartidor);
		intervalBucaRepartidor=null;
	}	

	// colocamos en la tabla repartidor el pedido

	
}

const runLoopSearchRepartidor = async function (io) {
	if ( intervalBucaRepartidor === null ) {
		colocarPedidoEnRepartidor(io);
		intervalBucaRepartidor = setInterval(() => colocarPedidoEnRepartidor(io), 15000);
	}
}
module.exports.runLoopSearchRepartidor = runLoopSearchRepartidor;


const runLoopPrueba = async function (req, res) {
	let listPedidos =  await getPedidosEsperaRepartidor();		
	// listPedidos = listPedidos.data;	

	listPedidos = JSON.parse(JSON.stringify(listPedidos));

	console.log ( 'listPedidos', listPedidos );

	console.log ( 'listPedidos listPedidos.lenght', listPedidos.length );
	listPedidos.map(async p => {

		console.log('pedido procesar', p);
		console.log('p.latitude', p.latitude);
	})
}
module.exports.runLoopPrueba = runLoopPrueba;

// function intervalo que se repite cada 2min


// PROCESO LOAR PEDIDOS PENDIENTES
// PROCESO COLOCA LOS PEDIDOS EN LOS REPARTIDORES
// PROCESO LOAR PEDIDOS PENDIENTES
// PROCESO COLOCA LOS PEDIDOS EN LOS REPARTIDORES









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



function emitirRespuesta(xquery) {
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

function emitirRespuestaData(xquery) {
	console.log(xquery);
	return sequelize.query(xquery, {type: sequelize.QueryTypes.SELECT})
	.then(function (rows) {
		
		// return ReS(res, {
		// 	data: rows
		// });
		return {
			data: rows
		};
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
