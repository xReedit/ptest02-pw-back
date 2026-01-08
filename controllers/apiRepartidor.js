const { to, ReE, ReS }  = require('../service/uitl.service');
const sendMsjsService = require('./sendMsj.js');
let config = require('../_config');
let managerFilter = require('../utilitarios/filters');
const logger = require('../utilitarios/logger');
// let apiFireBase = require('../controllers/apiFireBase');

let intervalBucaRepartidor = null;

// ✅ IMPORTANTE: Usar instancia centralizada de Sequelize
const { sequelize, QueryTypes} = require('../config/database');
// const { Sequelize } = require('sequelize');

const QueryServiceV1 = require('../service/query.service.v1');

let mysql_clean = function (string) {
        return sequelize.getQueryInterface().escape(string);
};

const emitirRespuesta = async (xquery) => {    	
    try {
		// evaluea si es update o inser
		const queryType = xquery.trim().toLowerCase().startsWith('update') ? QueryTypes.UPDATE : QueryTypes.SELECT;
        return await sequelize.query(xquery, { type: queryType });
    } catch (err) {
        logger.error({ err }, 'error emitirRespuesta');
        return false;
    }
};

const emitirRespuesta_RES = async (xquery, res) => {
    // logger.debug(xquery);

    try {
        const rows = await sequelize.query(xquery, { type: QueryTypes.SELECT });
        return ReS(res, {
            data: rows
        });
    } catch (error) {
        logger.error({ error }, 'error emitirRespuesta_RES');
        return false;
    }
};
module.exports.emitirRespuesta_RES = emitirRespuesta_RES;

const emitirRespuestaSP = async (xquery) => {
    // logger.debug(xquery);
    try {
		const queryType = xquery.trim().toLowerCase().startsWith('update') ? QueryTypes.UPDATE : QueryTypes.SELECT;
        const rows = await sequelize.query(xquery, { type: queryType });		
        const arr = Object.values(rows[0]);
        return arr;
    } catch (err) {
        logger.error({ err }, 'error emitirRespuestaSP');
        return false;
    } 
};



// function emitirRespuestaSP(xquery) {
// 	logger.debug(xquery);
// 	return sequelize.query(xquery, {		
// 		type: QueryTypes.SELECT
// 	})
// 	.then(function (rows) {

// 		// convertimos en array ya que viene en object
// 		var arr = [];
// 		arr = Object.values(rows[0]);		
		
// 		return arr;
// 	})
// 	.catch((err) => {
// 		return false;
// 	});
// }


const emitirRespuestaSP_RES = async (xquery, res) => {
    // logger.debug(xquery);
    try {
        const rows = await sequelize.query(xquery, { type: QueryTypes.SELECT });

        // Convertimos en array ya que viene en object
        const arr = Object.values(rows[0]);

        return ReS(res, {
            data: arr
        });
    } catch (err) {
        return ReE(res, err);
    }
};

const execSqlQueryNoReturn = async (xquery, res) => {
	// logger.debug(xquery);
	try {
		const queryType = xquery.trim().toLowerCase().startsWith('update') ? QueryTypes.UPDATE : QueryTypes.SELECT;
		const results = await sequelize.query(xquery, { type: queryType });
		return ReS(res, {
			data: results
		});		
	} catch (err) {
        return ReE(res, err);
    }

}


const onlyUpdateQuery = async (xquery, res) => {
	// logger.debug(xquery);a
	return sequelize.query(xquery, {type: QueryTypes.SELECT})
	.then(function (result) {
		
		return ReS(res, {
		 susccess: true
		});		
	})
	.catch((err) => {
		return false;
	});
}


const setRepartidorConectado = async function (dataCLiente) {	
    const idrepartidor = dataCLiente.idrepartidor;
    const socketid = dataCLiente.socketid;
    if ( idrepartidor ) {
        // ✅ SEGURO: Mismo query, solo con prepared statement
    	const read_query = `UPDATE repartidor SET socketid = ? WHERE idrepartidor = ?`;
    	await sequelize.query(read_query, {
            replacements: [socketid, idrepartidor],
            type: QueryTypes.UPDATE
        });

		QueryServiceV1.ejecutarConsulta(read_query, [socketid, idrepartidor], 'UPDATE', 'setRepartidorConectado');
    }    
}
module.exports.setRepartidorConectado = setRepartidorConectado;

const setEfectivoMano = async function (req, res) {
	// logger.debug('llego a funcion setEfectivoMano');
	// logger.debug('llego a funcion setEfectivoMano req', req);
	// logger.debug('llego a funcion setEfectivoMano req usuariotoken', req.usuariotoken);

	const idrepartidor = req.body.idrepartidor;      
	const efectivo = req.body.efectivo || 0;      
	const online = req.body.online;     

	// logger.debug('llego a funcion setEfectivoMano idrepartidor', idrepartidor);
	
    // ✅ SEGURO: Mismo query, solo con prepared statement
    // const read_query = `UPDATE repartidor SET efectivo_mano = ?, online = ? WHERE idrepartidor = ?`;
    // await sequelize.query(read_query, {
    //     replacements: [efectivo, online, idrepartidor],
    //     type: QueryTypes.UPDATE
    // });
    // return ReS(res, { data: true });

	const read_query = `UPDATE repartidor SET efectivo_mano = ?, online = ? WHERE idrepartidor = ?`;
	const result = await QueryServiceV1.ejecutarConsulta(read_query, [efectivo, online, idrepartidor], 'UPDATE', 'setEfectivoMano');
	return ReS(res, { data: result });
}
module.exports.setEfectivoMano = setEfectivoMano;

const pushSuscripcion = async function (req, res) {
	const idrepartidor = managerFilter.getInfoToken(req,'idrepartidor');
	let suscripcion = req.body.suscripcion;	

	if (typeof suscripcion === "object") { 
		suscripcion = JSON.stringify(suscripcion)
	}

	logger.debug('suscripcion ====>>', suscripcion)

    // ✅ SEGURO: Mismo query, solo con prepared statement
	// const read_query = `UPDATE repartidor SET pwa_code_verification = ? WHERE idrepartidor = ?`;
	// const rows = await sequelize.query(read_query, {
    //     replacements: [suscripcion, idrepartidor],
    //     type: QueryTypes.UPDATE
    // });
    // const arr = Object.values(rows[0] || []);
    // return ReS(res, { data: arr });

	const read_query = `UPDATE repartidor SET pwa_code_verification = ? WHERE idrepartidor = ?`;
	const result = await QueryServiceV1.ejecutarConsulta(read_query, [suscripcion, idrepartidor], 'UPDATE', 'pushSuscripcion');
	return ReS(res, { data: result });
}
module.exports.pushSuscripcion = pushSuscripcion;

const setPositionNow = async function (req, res) {
	const idrepartidor = managerFilter.getInfoToken(req,'idrepartidor');
	const pos = req.body.pos;
	
    // ✅ SEGURO: Mismo query, solo con prepared statement
    // const read_query = `UPDATE repartidor SET position_now = ? WHERE idrepartidor = ?`;
    // const rows = await sequelize.query(read_query, {
    //     replacements: [JSON.stringify(pos), idrepartidor],
    //     type: QueryTypes.UPDATE
    // });
    // return ReS(res, { data: rows });

	const read_query = `UPDATE repartidor SET position_now = ? WHERE idrepartidor = ?`;
	const result = await QueryServiceV1.ejecutarConsulta(read_query, [JSON.stringify(pos), idrepartidor], 'UPDATE', 'setPositionNow');
	return ReS(res, { data: result });
}
module.exports.setPositionNow = setPositionNow;

const setCambioPassRepartidor = async function (req, res) {
	const idrepartidor = req.body.idrepartidor;	
	const p2 = req.body.p2;	

    // ✅ SEGURO: Mismo query, solo con prepared statement
    // ⚠️ IMPORTANTE: La contraseña debería estar hasheada con bcrypt
	// const read_query = `UPDATE repartidor SET pass = ? WHERE idrepartidor = ?`;
    // await sequelize.query(read_query, {
    //     replacements: [p2, idrepartidor],
    //     type: QueryTypes.UPDATE
    // });
    // return ReS(res, { data: true });

	const read_query = `UPDATE repartidor SET pass = ? WHERE idrepartidor = ?`;
	const result = await QueryServiceV1.ejecutarConsulta(read_query, [p2, idrepartidor], 'UPDATE', 'setCambioPassRepartidor');
	return ReS(res, { data: result });
}
module.exports.setCambioPassRepartidor = setCambioPassRepartidor;


// guarda position desde el socket
// const setPositionFromSocket = function (idrepartidor, position) {	
	
//     const read_query = `update repartidor set position_now = '${JSON.stringify(pos)}' where idrepartidor = ${idrepartidor}`;
//     emitirRespuesta_RES(read_query, res);
// }
// module.exports.setPositionFromSocket = setPositionFromSocket;


const getRepartidoreForPedido = async function (dataPedido) {
	const datosEstablecimiento = dataPedido.dataDelivery ? dataPedido.dataDelivery.establecimiento : dataPedido.datosDelivery.establecimiento;
	const es_latitude = datosEstablecimiento.latitude;
    const es_longitude = datosEstablecimiento.longitude;
    
    // ✅ SEGURO: Mismo stored procedure, solo con prepared statement
    // const read_query = `CALL procedure_delivery_get_repartidor(?, ?)`;
    // const rows = await sequelize.query(read_query, {
    //     replacements: [es_latitude, es_longitude],
    //     type: QueryTypes.SELECT
    // });
    // const arr = Object.values(rows[0]);
    // return arr;

	const read_query = `CALL procedure_delivery_get_repartidor(?, ?)`;
	const result = await QueryServiceV1.ejecutarProcedimiento(read_query, [es_latitude, es_longitude], 'getRepartidoreForPedido');
	return result;
}
module.exports.getRepartidoreForPedido = getRepartidoreForPedido;

// dataPedido es el registro de la tabla pedido
const getRepartidoreForPedidoFromInterval = async function (es_latitude, es_longitude, efectivoPagar) {
    // ✅ SEGURO: Mismo stored procedure, solo con prepared statement
    // const read_query = `CALL procedure_delivery_get_repartidor(?, ?, ?)`;
    // const rows = await sequelize.query(read_query, {
    //     replacements: [es_latitude, es_longitude, efectivoPagar],
    //     type: QueryTypes.SELECT
    // });
    // const arr = Object.values(rows[0]);
    // return arr;

	logger.debug(`CALL procedure_delivery_get_repartidor(${es_latitude}, ${es_longitude}, ${efectivoPagar})`);

	const read_query = `CALL procedure_delivery_get_repartidor(?, ?, ?)`;
	const result = await QueryServiceV1.ejecutarProcedimiento(read_query, [es_latitude, es_longitude, efectivoPagar], 'getRepartidoreForPedidoFromInterval');
	return result;
}
module.exports.getRepartidoreForPedidoFromInterval = getRepartidoreForPedidoFromInterval;



const getPedidosEsperaRepartidor = async function (idsede) {	
    
	// LIMIT 1 busca repartidor para el primer pedido primero
    /*const read_query = `SELECT p.*, s.longitude, s.latitude
	from pedido p 
		inner join  sede s on p.idsede = s.idsede
	where p.idsede=${idsede} and p.is_from_client_pwa = 1 and pwa_is_delivery = 1 and COALESCE(idrepartidor, 0) = 0  and s.pwa_delivery_servicio_propio = 0 LIMIT 1;`;
	*/
	
	// return emitirRespuesta(read_query);  
	// const read_query = `call procedure_delivery_pedidos_pendientes()`;
 	// const response = await emitirRespuestaSP(read_query);         	
 	// return response;

	const read_query = `call procedure_delivery_pedidos_pendientes()`;
	let response = await QueryServiceV1.ejecutarProcedimiento(read_query, [], 'getPedidosEsperaRepartidor');
	// logger.debug({ response }, 'getPedidosEsperaRepartidor');
	return (response === null || response === undefined) ? [] : response;


}
module.exports.getPedidosEsperaRepartidor = getPedidosEsperaRepartidor; 

// asigna el pedido temporalmente a espera que acepte
const setAsignaTemporalPedidoARepartidor = async function (idpedido, idrepartidor_va, pedido) {	
    // const read_query = `call procedure_delivery_set_pedido_repartidor(${idpedido}, ${idrepartidor_va},'${JSON.stringify(pedido)}')`;
    // return await emitirRespuestaSP(read_query);        

	// const read_query = `CALL procedure_delivery_set_pedido_repartidor(?, ?, ?)`;
	// const result = await sequelize.query(read_query, {
	// 	replacements: [idpedido, idrepartidor_va, JSON.stringify(pedido)],
	// 	type: QueryTypes.SELECT
	// });
	// return Object.values(result[0]);

	logger.debug(`CALL procedure_delivery_set_pedido_repartidor(${idpedido}, ${idrepartidor_va}, ${JSON.stringify(pedido)})`);

	const read_query = `CALL procedure_delivery_set_pedido_repartidor(?, ?, ?)`;
	const result = await QueryServiceV1.ejecutarProcedimiento(read_query, [idpedido, idrepartidor_va, JSON.stringify(pedido)], 'setAsignaTemporalPedidoARepartidor');
	return result;
	
}
module.exports.setAsignaTemporalPedidoARepartidor = setAsignaTemporalPedidoARepartidor;


const sendPedidoRepartidor = async function (listRepartidores, dataPedido, io) {

	// agarramos el primer repartidor de la lista
	const numIndex = 0; //dataPedido.num_reasignaciones;
	let firtsRepartidor = listRepartidores[numIndex];

	logger.debug({ firtsRepartidor }, 'firtsRepartidor');

	// quitamos el pedido al repartidor anterior
	if ( dataPedido.last_id_repartidor_reasigno ) {
		logger.debug('repartidor-notifica-server-quita-pedido --b');
		const getSocketIdRepartidorReasigno = await getSocketIdRepartidor(dataPedido.last_id_repartidor_reasigno);
		io.to(getSocketIdRepartidorReasigno[0].socketid).emit('repartidor-notifica-server-quita-pedido', dataPedido.idpedido);	
	}


	// si no encuentra repartidor envia nuevamente al primero
	if ( !firtsRepartidor ) {		
		firtsRepartidor = listRepartidores[0];
		dataPedido.num_reasignado = 0;

		// resetea los contadores para empezar nuevamente
		// update pedido set num_reasignaciones = 0 where idpedido = ${dataPedido.idpedido}; 
		// const read_query = `update repartidor set flag_paso_pedido='0', pedido_por_aceptar=null where flag_paso_pedido=${dataPedido.idpedido};`;
		// const read_query = `UPDATE repartidor SET flag_paso_pedido='0', pedido_por_aceptar=null WHERE flag_paso_pedido=?`;
		// try {
		// 	await sequelize.query(read_query, {
		// 		replacements: [dataPedido.idpedido],
		// 		type: QueryTypes.UPDATE
		// 	});
		// 	return true;
		// } catch (err) {
		// 	logger.error({ err }, 'error reset repartidor');
		// 	return false;
		// }

		const read_query = `UPDATE repartidor SET flag_paso_pedido='0', pedido_por_aceptar=null WHERE flag_paso_pedido=?`;
		QueryServiceV1.ejecutarConsulta(read_query, [dataPedido.idpedido], 'UPDATE', 'resetRepartidor');
    	// return await emitirRespuestaSP(read_query); 
	} else {

		const read_query = `CALL procedure_delivery_set_pedido_repartidor(?, ?, ?)`;
		// const result = await sequelize.query(read_query, {
		// 	replacements: [dataPedido.idpedido, firtsRepartidor.idrepartidor, JSON.stringify(dataPedido)],
		// 	type: QueryTypes.SELECT
		// });

		QueryServiceV1.ejecutarProcedimiento(read_query, [dataPedido.idpedido, firtsRepartidor.idrepartidor, JSON.stringify(dataPedido)], 'setAsignaTemporalPedidoARepartidor');
		
		

		
		// const res_call = await emitirRespuestaSP(read_query);
	}


	// envio mensaje
	logger.debug("============== last_notification = ", firtsRepartidor.last_notification);
	if ( firtsRepartidor.last_notification === 0 ||  firtsRepartidor.last_notification > 7) {	
		//sendMsjsService.sendMsjSMSNewPedido(firtsRepartidor.telefono);
		// const read_query = `update repartidor set last_notification = time(now()) where idrepartidor=${firtsRepartidor.idrepartidor};`;
    	// await emitirRespuestaSP(read_query);
		// ✅ SEGURO: Prepared statement
		const read_query = `UPDATE repartidor SET last_notification = time(now()) WHERE idrepartidor=?`;
		// try {
		// 	await sequelize.query(read_query, {
		// 		replacements: [firtsRepartidor.idrepartidor],
		// 		type: QueryTypes.UPDATE
		// 	});
		// } catch (err) {
		// 	logger.error({ err }, 'error update last_notification');
		// }

		QueryServiceV1.ejecutarConsulta(read_query, [firtsRepartidor.idrepartidor], 'UPDATE', 'updateLastNotification');
	}

	sendMsjsService.sendPushNotificactionOneRepartidor(firtsRepartidor.key_suscripcion_push, 0, firtsRepartidor);

	// enviamos el socket
	logger.debug('socket enviado a repartidor', firtsRepartidor);

	// busca el sockeid para asignar
	const getSocketIdRepartidorAsignar = await getSocketIdRepartidor(firtsRepartidor.idrepartidor);
	io.to(getSocketIdRepartidorAsignar[0].socketid).emit('repartidor-nuevo-pedido', [firtsRepartidor, dataPedido]);

	// para finalizar async
	return true;
}
module.exports.sendPedidoRepartidor = sendPedidoRepartidor;

// op2 group pedidos
const sendPedidoRepartidorOp2 = async function (listRepartidores, dataPedido, io) {

	// agarramos el primer repartidor de la lista
	const numIndex = 0; //dataPedido.num_reasignaciones;
	const idsPedidos = dataPedido.pedidos.join(',');
	let firtsRepartidor = listRepartidores[numIndex];


	logger.debug('lista de repartidor ============ listRepartidores', listRepartidores);
	logger.debug('repartidor ============ firtsRepartidor', firtsRepartidor);


	// quitamos el pedido al repartidor anterior
	logger.debug('asignar repartidor ============ ', dataPedido);
	if ( dataPedido.last_id_repartidor_reasigno ) {
		// logger.debug('repartidor-notifica-server-quita-pedido --a');
		const getSocketIdRepartidorReasigno = await getSocketIdRepartidor(dataPedido.last_id_repartidor_reasigno);

		


		// si no esta ocupado quita
		logger.debug('si no esta ocupado quita');
		if ( getSocketIdRepartidorReasigno[0].ocupado === 0 ) {

			logger.debug('si no esta ocupado quita el pedido al repartidor');

			io.to(getSocketIdRepartidorReasigno[0].socketid).emit('repartidor-notifica-server-quita-pedido', null);

			// NOTIFICA MONITOR quita  pedido a repartidor
			logger.debug('xxxxxxxxxxxxx === NOTIFICA MONITOR quita  pedido a repartidor')
			io.to('MONITOR').emit('notifica-server-quita-pedido-repartidor', dataPedido.last_id_repartidor_reasigno);

			// quitamos el pedido de firebase
			// apiFireBase.updateShowPedido(dataPedido.last_id_repartidor_reasigno, false);
		}		
	}


	// si no encuentra repartidor envia nuevamente al primero
	if ( !firtsRepartidor ) {		
		firtsRepartidor = listRepartidores[0];
		dataPedido.num_reasignado = 0;

		// resetea los contadores para empezar nuevamente
		// update pedido set num_reasignaciones = 0 where idpedido = ${dataPedido.idpedido}; 
		// const read_query = `update repartidor set flag_paso_pedido=0, pedido_por_aceptar=null where flag_paso_pedido=${dataPedido.pedidos[0]};`;
    	// return await emitirRespuestaSP(read_query); 

		// ✅ SEGURO: Prepared statement
		const sql = `UPDATE repartidor SET flag_paso_pedido=0, pedido_por_aceptar=null WHERE flag_paso_pedido=?`;
		// try {
		// 	await sequelize.query(sql, {
		// 		replacements: [dataPedido.pedidos[0]],
		// 		type: QueryTypes.UPDATE
		// 	});
		// } catch (err) {
		// 	logger.error({ err }, 'error sendPedidoRepartidorOp2');
		// }

		QueryServiceV1.ejecutarConsulta(sql, [dataPedido.pedidos[0]], 'UPDATE', 'resetRepartidor');
	} else {

		// const read_query = `call procedure_delivery_set_pedido_repartidor(${dataPedido.pedidos[0]}, ${firtsRepartidor.idrepartidor}, '${JSON.stringify(dataPedido)}')`;
		// const res_call = await emitirRespuestaSP(read_query);

		logger.debug(`CALL procedure_delivery_set_pedido_repartidor(${dataPedido.pedidos[0]}, ${firtsRepartidor.idrepartidor}, '${JSON.stringify(dataPedido)}')`);

		const read_query = `CALL procedure_delivery_set_pedido_repartidor(?, ?, ?)`;
		// try {
		// 	const result = await sequelize.query(read_query, {
		// 		replacements: [dataPedido.pedidos[0], firtsRepartidor.idrepartidor, JSON.stringify(dataPedido)],
		// 		type: QueryTypes.SELECT
		// 	});
		// 	const res_call = Object.values(result[0]);
		// } catch (err) {
		// 	logger.error({ err }, 'error procedure_delivery_set_pedido_repartidor op2');
		// }

		QueryServiceV1.ejecutarProcedimiento(read_query, [dataPedido.pedidos[0], firtsRepartidor.idrepartidor, JSON.stringify(dataPedido)], 'setAsignaTemporalPedidoARepartidor');

		// NOTIFICA MONITOR repartidor nuevo pedido
		// logger.debug('===== notifica-server-pedido-por-aceptar');	
		logger.debug('xxxxxxxxxxxxx === NOTIFICA MONITOR notifica-server-pedido-por-acepta')
		io.to('MONITOR').emit('notifica-server-pedido-por-aceptar', [firtsRepartidor, dataPedido, listRepartidores]);

		
		logger.debug("============== last_notification = ", firtsRepartidor.last_notification);
		sendMsjsService.sendPushNotificactionOneRepartidor(firtsRepartidor.key_suscripcion_push, 0, firtsRepartidor);
		// enviamos el socket
		logger.debug('socket enviado a repartidor', firtsRepartidor);
		
		// busca el sockeid para asignar
		const getSocketIdRepartidorAsignar = await getSocketIdRepartidor(firtsRepartidor.idrepartidor);
		io.to(getSocketIdRepartidorAsignar[0].socketid).emit('repartidor-nuevo-pedido', [firtsRepartidor, dataPedido]);

		// asignamos el pedido de firebase
		// const idpedidos = dataPedido.pedidos.join(',');
		// apiFireBase.updateShowPedido(firtsRepartidor.idrepartidor, true, idpedidos);
	}


	// envio mensaje
	// logger.debug("============== last_notification = ", firtsRepartidor.last_notification);
	// if ( firtsRepartidor.last_notification === 0 ||  firtsRepartidor.last_notification > 7) {	
		// sendMsjsService.sendMsjSMSNewPedido(firtsRepartidor.telefono);
		// const read_query = `update repartidor set last_notification = time(now()) where idrepartidor=${firtsRepartidor.idrepartidor};`;
    	// return emitirRespuestaSP(read_query); 
	// }

	

	

	// para finalizar async
	return true;
}
module.exports.sendPedidoRepartidorOp2 = sendPedidoRepartidorOp2;


const sendOnlyNotificaPush = function (key_suscripcion_push, tipo_msjs, user_repartidor) {
	sendMsjsService.sendPushNotificactionOneRepartidor(key_suscripcion_push, tipo_msjs, user_repartidor);
}
module.exports.sendOnlyNotificaPush = sendOnlyNotificaPush;

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
// 	logger.debug('socket enviado a repartidor', firtsRepartidor);
// 	io.to(firtsRepartidor.socketid).emit('repartidor-nuevo-pedido', [firtsRepartidor, dataPedido]);

// }
// module.exports.sendPedidoRepartidor = sendPedidoRepartidor;

// cuando el repartidor acepta el pedido -- se asigna el pedido al repartitor
const setAsignarPedido2 = async function (req, res) {  
	const idrepartidor = managerFilter.getInfoToken(req,'idrepartidor');
	const idpedido = req.body.idpedido;
	const firstPedido = idpedido.split(',')[0];
	
    // let read_query = `update pedido set idrepartidor = ${idrepartidor} where idpedido in (${idpedido});
    // 					update repartidor set ocupado = 1, pedido_paso_va = 1, pedido_por_aceptar=null where idrepartidor = ${idrepartidor};
    // 					update repartidor set flag_paso_pedido=0 where flag_paso_pedido=${firstPedido}`;

	// // const read_query = `call procedure_delivery_asignar_pedido(${idrepartidor}, ${idpedido})`;    					
    // execSqlQueryNoReturn(read_query, res);     

	try {
		// ✅ SEGURO: 3 queries separados con prepared statements
		// await sequelize.query(
		// 	`UPDATE pedido SET idrepartidor = ? WHERE idpedido IN (?)`,
		// 	{ replacements: [idrepartidor, idpedido], type: QueryTypes.UPDATE }
		// );

		const read_query = `UPDATE pedido SET idrepartidor = ? WHERE idpedido IN (?)`;
		QueryServiceV1.ejecutarConsulta(read_query, [idpedido], 'UPDATE', 'setAsignarPedido2');

		// await sequelize.query(
		// 	`UPDATE repartidor SET ocupado = 1, pedido_paso_va = 1, pedido_por_aceptar=null WHERE idrepartidor = ?`,
		// 	{ replacements: [idrepartidor], type: QueryTypes.UPDATE }
		// );

		const read_query1 = `UPDATE repartidor SET ocupado = 1, pedido_paso_va = 1, pedido_por_aceptar=null WHERE idrepartidor = ?`;
		QueryServiceV1.ejecutarConsulta(read_query1, [idpedido], 'UPDATE', 'setAsignarPedido2');

		// await sequelize.query(
		// 	`UPDATE repartidor SET flag_paso_pedido=0 WHERE flag_paso_pedido=?`,
		// 	{ replacements: [firstPedido], type: QueryTypes.UPDATE }
		// );

		const read_query2 = `UPDATE repartidor SET flag_paso_pedido=0 WHERE flag_paso_pedido=?`;
		await QueryServiceV1.ejecutarConsulta(read_query2, [firstPedido], 'UPDATE', 'setAsignarPedido2');

		return ReS(res, { data: true });
	} catch (err) {
		logger.error({ err }, 'error setAsignarPedido2');
		return ReE(res, err);
	}

	// actualizamos el pedido al repartidor firebase	    
	// apiFireBase.updateIdPedidosRepartidor({userid: idrepartidor, idpedidos: idpedido});

}
module.exports.setAsignarPedido2 = setAsignarPedido2;

// esto desde app repartidor 0923
const setNullPedidosPorAceptar = async function (req, res) {
	const idrepartidor = managerFilter.getInfoToken(req,'idrepartidor');
	// const read_query = `update repartidor set ocupado = 1, pedido_paso_va = 1, pedido_por_aceptar=null where idrepartidor = ${idrepartidor};`;
	// execSqlQueryNoReturn(read_query, res); 

	// const read_query = `UPDATE repartidor SET ocupado = 1, pedido_paso_va = 1, pedido_por_aceptar=null WHERE idrepartidor = ?`;
	// try {
	// 	await sequelize.query(read_query, {
	// 		replacements: [idrepartidor],
	// 		type: QueryTypes.UPDATE
	// 	});
	// 	return ReS(res, { data: true });
	// } catch (err) {
	// 	logger.error({ err }, 'error setNullPedidosPorAceptar');
	// 	return ReE(res, err);
	// }

	const read_query = `UPDATE repartidor SET ocupado = 1, pedido_paso_va = 1, pedido_por_aceptar=null WHERE idrepartidor = ?`;
	await QueryServiceV1.ejecutarConsulta(read_query, [idrepartidor], 'UPDATE', 'setNullPedidosPorAceptar');
}
module.exports.setNullPedidosPorAceptar = setNullPedidosPorAceptar;

// cuando el repartidor acepta el pedido -- se asigna el pedido al repartitor
const setAsignarPedido = async function (req, res) {  
	const idrepartidor = managerFilter.getInfoToken(req, 'idrepartidor');
	const idpedido = req.body.idpedido;
	const elRepartidor = req.body.repartidor;
	const firstPedido = idpedido.split(',')[0];

	try {
		// ✅ SEGURO: 3 queries separados con prepared statements
		// await sequelize.query(
		// 	`UPDATE pedido SET idrepartidor = ? WHERE idpedido IN (?)`,
		// 	{ replacements: [idrepartidor, idpedido], type: QueryTypes.UPDATE }
		// );

		let read_query = `UPDATE pedido SET idrepartidor = ? WHERE idpedido IN (?)`;
		await QueryServiceV1.ejecutarConsulta(read_query, [idrepartidor, idpedido], 'UPDATE', 'setAsignarPedido');

		// await sequelize.query(
		// 	`UPDATE repartidor SET ocupado = 1, pedido_paso_va = 1 WHERE idrepartidor = ?`,
		// 	{ replacements: [idrepartidor], type: QueryTypes.UPDATE }
		// );


		read_query = `UPDATE repartidor SET ocupado = 1, pedido_paso_va = 1 WHERE idrepartidor = ?`;
		await QueryServiceV1.ejecutarConsulta(read_query, [idrepartidor], 'UPDATE', 'setAsignarPedido');

		// await sequelize.query(
		// 	`UPDATE repartidor SET flag_paso_pedido=0 WHERE flag_paso_pedido=?`,
		// 	{ replacements: [firstPedido], type: QueryTypes.UPDATE }
		// );

		read_query = `UPDATE repartidor SET flag_paso_pedido=0 WHERE flag_paso_pedido=?`;
		await QueryServiceV1.ejecutarConsulta(read_query, [firstPedido], 'UPDATE', 'setAsignarPedido');

		// ✅ SEGURO: Query para obtener clientes con prepared statement
		const clientesQuery = `SELECT DISTINCT c.idcliente, c.nombres, c.telefono, cs.key_suscripcion_push 
							   FROM pedido p
							   INNER JOIN cliente_socketid cs ON cs.idcliente = p.idcliente 
							   INNER JOIN cliente c ON c.idcliente = p.idcliente 
							   WHERE p.idpedido IN (?)`;

		// const rows = await sequelize.query(clientesQuery, {
		// 	replacements: [idpedido],
		// 	type: QueryTypes.SELECT
		// });

		const rows = await QueryServiceV1.ejecutarConsulta(clientesQuery, [idpedido], 'SELECT', 'setAsignarPedido');

		const lisClientesPedido = rows || [];

		// Resto de la lógica comentada se mantiene igual...
		if (!lisClientesPedido) return ReS(res, { data: true });

		return ReS(res, { data: true });
	} catch (err) {
		logger.error({ err }, 'error setAsignarPedido');
		return ReE(res, err);
	}

	// const idrepartidor = managerFilter.getInfoToken(req,'idrepartidor');
	// const idpedido = req.body.idpedido;           
	// const elRepartidor = req.body.repartidor;
	// const firstPedido = idpedido.split(',')[0];
	
	// // si acepta no borra
	// // , pedido_por_aceptar=null
    // let read_query = `update pedido set idrepartidor = ${idrepartidor} where idpedido in (${idpedido});
    // 					update repartidor set ocupado = 1, pedido_paso_va = 1 where idrepartidor = ${idrepartidor};
    // 					update repartidor set flag_paso_pedido=0 where flag_paso_pedido=${firstPedido}`;

	// // const read_query = `call procedure_delivery_asignar_pedido(${idrepartidor}, ${idpedido})`;    					
    // execSqlQueryNoReturn(read_query, res);     
    // // return emitirRespuesta_RES(read_query, res);   


    // // enviar mensajes PUSH a los clientes de los pedidos aceptados
    // read_query = `select DISTINCT c.idcliente, c.nombres, c.telefono, cs.key_suscripcion_push from pedido p
	// 					inner join cliente_socketid cs on cs.idcliente = p.idcliente 
	// 					inner join cliente c on c.idcliente = p.idcliente 
	// 					where p.idpedido in (${idpedido})`;

	// const lisClientesPedido = await emitirRespuestaSP(read_query);
	// var _dataMsjs, actions, data, _key_suscripcion_push;

	// if (!lisClientesPedido) return;

	// lisClientesPedido.map(c => {

	// 	if (c.key_suscripcion_push) {


	// 		_key_suscripcion_push = c.key_suscripcion_push;

	// 		actions = [{"action": "foo", "title": "Enviar Mensaje"},{"action": "foo2", "title": "Llamar"}];
	// 		data = {"onActionClick": {
	//                                 "foo": {"operation": "openWindow", "url": `https://api.whatsapp.com/send?phone=51${elRepartidor.telefono}`},
	//                                 "foo2": {"operation": "openWindow", "url": `tel:${elRepartidor.telefono}`}      
	//                             }};

	//         _dataMsjs = {
	//         	tipo_msj: 0,
	//         	titulo: 'Repartidor Asignado',
	//         	msj: `Hola soy ${elRepartidor.nombre} repartidor de Papaya Express, estaré encargado de su pedido, le llamare a su celular cuando este cerca.`,
	//         	key_suscripcion_push: _key_suscripcion_push,
	//         	_actions: actions,
	//         	_data: data
	//         }

	//         // enviar mensaje
	//         sendMsjsService.sendPushNotificactionRepartidorAceptaPedido(_dataMsjs);
	//     }
        
	// });

}
module.exports.setAsignarPedido = setAsignarPedido;

const setPasoVaPedido = async function (req, res) {
	const idrepartidor = managerFilter.getInfoToken(req, 'idrepartidor');
	const paso = req.body.paso_va;
	// ✅ SEGURO: Prepared statement
	// const read_query = `UPDATE repartidor SET pedido_paso_va = ? WHERE idrepartidor = ?`;
	// try {
	// 	await sequelize.query(read_query, {
	// 		replacements: [paso, idrepartidor],
	// 		type: QueryTypes.UPDATE
	// 	});
	// 	return ReS(res, { data: true });
	// } catch (err) {
	// 	logger.error({ err }, 'error setPasoVaPedido');
	// 	return ReE(res, err);
	// }

	const read_query = `UPDATE repartidor SET pedido_paso_va = ? WHERE idrepartidor = ?`;
	await QueryServiceV1.ejecutarConsulta(read_query, [paso, idrepartidor], 'UPDATE', 'setPasoVaPedido');

	// const idrepartidor = managerFilter.getInfoToken(req,'idrepartidor');
	// const paso = req.body.paso_va;
    // const read_query = `update repartidor set pedido_paso_va = ${paso} where idrepartidor = ${idrepartidor};`;
    // await execSqlQueryNoReturn(read_query, res); 
}
module.exports.setPasoVaPedido = setPasoVaPedido;


/// desde el comercio
const setUpdateEstadoPedido = async function (idpedido, estado, tiempo = null) {	
	let savePwaEstado = estado === 4 ? ", pwa_estado = 'E' " : '';
	// ✅ SEGURO: Prepared statement
	// const read_query = `UPDATE pedido SET pwa_delivery_status = ? ${savePwaEstado} WHERE idpedido = ?`;
	// try {
	// 	await sequelize.query(read_query, {
	// 		replacements: [estado, idpedido],
	// 		type: QueryTypes.UPDATE
	// 	});
	// } catch (err) {
	// 	logger.error({ err }, 'error setUpdateEstadoPedido');
	// }

	const read_query = `UPDATE pedido SET pwa_delivery_status = ? ${savePwaEstado} WHERE idpedido = ?`;
	await QueryServiceV1.ejecutarConsulta(read_query, [estado, idpedido], 'UPDATE', 'setUpdateEstadoPedido');

	// // const savePwaEstado = estado === 4 ? ", pwa_estado = 'E', estado=2 " : '';	 // estado = 2 => pagado
	// const savePwaEstado = estado === 4 ? ", pwa_estado = 'E' " : '';	 // estado = 2 => pagado // quitamos estado 2 para que no se desaparesca del control de pedidos
    // const read_query = `update pedido set pwa_delivery_status = '${estado}' ${savePwaEstado} where idpedido = ${idpedido};`;
    // await emitirRespuesta(read_query);        
}
module.exports.setUpdateEstadoPedido = setUpdateEstadoPedido;

const setUpdateRepartidorOcupado = async function (idrepartidor, estado) {  
	const clearPedidoPorAceptar = estado === 0 ? `, pedido_por_aceptar = null, pedido_paso_va = 0` : '';
	// ✅ SEGURO: Prepared statement
	// const read_query = `UPDATE repartidor SET ocupado = ? ${clearPedidoPorAceptar} WHERE idrepartidor = ?`;
	// try {
	// 	await sequelize.query(read_query, {
	// 		replacements: [estado, idrepartidor],
	// 		type: QueryTypes.UPDATE
	// 	});
	// } catch (err) {
	// 	logger.error({ err }, 'error setUpdateRepartidorOcupado');
	// }

	const read_query = `UPDATE repartidor SET ocupado = ? ${clearPedidoPorAceptar} WHERE idrepartidor = ?`;
	QueryServiceV1.ejecutarConsulta(read_query, [estado, idrepartidor], 'UPDATE', 'setUpdateRepartidorOcupado');
	// // si no esta ocupado libera pedido_por_aceptar;
	// // logger.debug('==== CAMBIAMOS DE ESTADO OCUPADO ===', estado);
	// const clearPedidoPorAceptar = estado === 0 ?  `, pedido_por_aceptar = null, pedido_paso_va = 0` : '';
    // const read_query = `update repartidor set ocupado = ${estado} ${clearPedidoPorAceptar} where idrepartidor = ${idrepartidor};`;
    // await emitirRespuesta(read_query);        
}
module.exports.setUpdateRepartidorOcupado = setUpdateRepartidorOcupado;

const setLiberarPedido = async function (idrepartidor) {  
	// ✅ SEGURO: Prepared statement
    // const read_query = `UPDATE repartidor SET ocupado = 0, pedido_por_aceptar = null, solicita_liberar_pedido=0, pedido_paso_va = 0 WHERE idrepartidor = ?`;
    // try {
	// 	await sequelize.query(read_query, {
	// 		replacements: [idrepartidor],
	// 		type: QueryTypes.UPDATE
	// 	});
	// } catch (err) {
	// 	logger.error({ err }, 'error setLiberarPedido');
	// }

	const read_query = `UPDATE repartidor SET ocupado = 0, pedido_por_aceptar = null, solicita_liberar_pedido=0, pedido_paso_va = 0 WHERE idrepartidor = ?`;
	QueryServiceV1.ejecutarConsulta(read_query, [idrepartidor], 'UPDATE', 'setLiberarPedido');
}
module.exports.setLiberarPedido = setLiberarPedido;



const getSocketIdRepartidor = async function (listIdRepartidor) {
	// const idcliente = dataCLiente.idcliente;
    // const read_query = `SELECT socketid, pwa_code_verification as key_suscripcion_push, ocupado from repartidor where idrepartidor in (${listIdRepartidor})`;
    // return await emitirRespuesta(read_query);   
	// ✅ SEGURO: Prepared statement
    // const read_query = `SELECT socketid, pwa_code_verification as key_suscripcion_push, ocupado FROM repartidor WHERE idrepartidor IN (?)`;
    // try {
	// 	return await sequelize.query(read_query, {
	// 		replacements: [listIdRepartidor],
	// 		type: QueryTypes.SELECT
	// 	});
	// } catch (err) {
	// 	logger.error({ err }, 'error getSocketIdRepartidor');
	// 	return [];
	// }

	const read_query = `SELECT socketid, pwa_code_verification as key_suscripcion_push, fcm_token, ocupado FROM repartidor WHERE idrepartidor IN (?)`;
	const rows = await QueryServiceV1.ejecutarConsulta(read_query, [listIdRepartidor], 'SELECT', 'getSocketIdRepartidor');
	return rows || [];
}
module.exports.getSocketIdRepartidor = getSocketIdRepartidor;

const getListPedidosPendientesComercio = async function(req, res) {
// 	const idsede = managerFilter.getInfoToken(req,'idsede_suscrito');
// 	const read_query = `select * from pedido p
// 	inner join tipo_consumo tc on p.idtipo_consumo = tc.idtipo_consumo 
// where cast(p.fecha_hora as date) >= date_add(curdate(), INTERVAL -1 day) and p.idsede = ${idsede} and IFNULL(p.idrepartidor, 0) = 0  
// 	and tc.descripcion = 'DELIVERY'
// order by p.idpedido desc`;
// 	return await emitirRespuesta_RES(read_query, res);

	const idsede = managerFilter.getInfoToken(req,'idsede_suscrito');	
	// ✅ SEGURO: Prepared statement
	// const read_query = `SELECT * FROM pedido p
	// INNER JOIN tipo_consumo tc ON p.idtipo_consumo = tc.idtipo_consumo 
	// WHERE CAST(p.fecha_hora as date) >= date_add(curdate(), INTERVAL -1 day) 
	// AND p.idsede = ? AND IFNULL(p.idrepartidor, 0) = 0  
	// AND tc.descripcion = 'DELIVERY'
	// ORDER BY p.idpedido desc`;
	
	// try {
	// 	const rows = await sequelize.query(read_query, {
	// 		replacements: [idsede],
	// 		type: QueryTypes.SELECT
	// 	});
	// 	return ReS(res, { data: rows });
	// } catch (error) {
	// 	logger.error({ error }, 'error getListPedidosPendientesComercio');
	// 	return ReE(res, error);
	// }

	const read_query = `SELECT * FROM pedido p
	INNER JOIN tipo_consumo tc ON p.idtipo_consumo = tc.idtipo_consumo 
	WHERE CAST(p.fecha_hora as date) >= date_add(curdate(), INTERVAL -1 day) 
	AND p.idsede = ? AND IFNULL(p.idrepartidor, 0) = 0  
	AND tc.descripcion = 'DELIVERY'
	ORDER BY p.idpedido desc`;
	const rows = await QueryServiceV1.ejecutarConsulta(read_query, [idsede], 'SELECT', 'getListPedidosPendientesComercio');

	// console.log('rows', rows)

	// return rows || [];
	return ReS(res, { data: rows });
}
module.exports.getListPedidosPendientesComercio = getListPedidosPendientesComercio


const getEstadoPedido = async function (req, res) {	
    const idpedido = req.body.idpedido;
        
    // const read_query = `SELECT pwa_delivery_status FROM pedido WHERE idpedido=?`;
    // try {
	// 	const rows = await sequelize.query(read_query, {
	// 		replacements: [idpedido],
	// 		type: QueryTypes.SELECT
	// 	});
	// 	return ReS(res, { data: rows });
	// } catch (error) {
	// 	logger.error({ error }, 'error getEstadoPedido');
	// 	return ReE(res, error);
	// }

	const read_query = `SELECT pwa_delivery_status FROM pedido WHERE idpedido=?`;
	const rows = await QueryServiceV1.ejecutarConsulta(read_query, [idpedido], 'SELECT', 'getEstadoPedido');
	// return rows || [];
	return ReS(res, { data: rows });
}
module.exports.getEstadoPedido = getEstadoPedido;


const setFinPedidoEntregado = async function (req, res) {
	const obj = req.body;
	// logger.debug(JSON.stringify(obj));

    // const read_query = `call procedure_pwa_delivery_pedido_entregado('${JSON.stringify(obj)}')`;
    // return await emitirRespuesta_RES(read_query, res);        

	// ✅ SEGURO: Prepared statement
	// const read_query = `CALL procedure_pwa_delivery_pedido_entregado(?)`;
	// try {
	// 	const rows = await sequelize.query(read_query, {
	// 		replacements: [JSON.stringify(obj)],
	// 		type: QueryTypes.SELECT
	// 	});
	// 	return ReS(res, { data: rows });
	// } catch (error) {
	// 	logger.error({ error }, 'error setFinPedidoEntregado');
	// 	return ReE(res, error);
	// }

	const read_query = `CALL procedure_pwa_delivery_pedido_entregado(?)`;
	const rows = await QueryServiceV1.ejecutarProcedimiento(read_query, [JSON.stringify(obj)], 'setFinPedidoEntregado');
	
	return ReS(res, { data: rows });
}
module.exports.setFinPedidoEntregado = setFinPedidoEntregado;

const setFinPedidoExpressEntregado = async function (req, res) {
	const idpedido = req.body.idpedido_mandado;
	const pedidos_quedan = req.body.pedidos_quedan;
	const num_quedan = req.body.num_quedan;
	const idrepartidor = managerFilter.getInfoToken(req,'idrepartidor');
	const tipo_pedido = req.body.tipo_pedido;


	// var read_query = '';

	// if ( tipo_pedido === 'express' ) {
	// 	if ( num_quedan > 0 ) {
	// 		read_query = `update pedido_mandado set pwa_delivery_tiempo_atendido = TIMESTAMPDIFF(MINUTE, fecha_hora, now()), pwa_estado='E' where idpedido_mandado = ${idpedido}; update repartidor set pedido_por_aceptar='${JSON.stringify(pedidos_quedan)}' where idrepartidor = ${idrepartidor}`;
	// 	}
	// 	else {
	// 		read_query = `update pedido_mandado set pwa_delivery_tiempo_atendido = TIMESTAMPDIFF(MINUTE, fecha_hora, now()), pwa_estado='E' where idpedido_mandado = ${idpedido}; update repartidor set ocupado = 0, pedido_por_aceptar=null where idrepartidor = ${idrepartidor}`;
	// 	}
	// }	

	// if ( tipo_pedido === 'retiro_atm' ) {
	// 	read_query = `update atm_retiros set pwa_delivery_tiempo_atendido = TIMESTAMPDIFF(MINUTE, fecha_hora_registro, now()), pwa_estado='E' where idatm_retiros = ${idpedido}; update repartidor set ocupado = 0, pedido_por_aceptar=null where idrepartidor = ${idrepartidor}`;
	// }
    // await execSqlQueryNoReturn(read_query, res);
	try {
		if (tipo_pedido === 'express') {
			// ✅ SEGURO: 2 queries separados con prepared statements
			// await sequelize.query(
			// 	`UPDATE pedido_mandado SET pwa_delivery_tiempo_atendido = TIMESTAMPDIFF(MINUTE, fecha_hora, now()), pwa_estado='E' WHERE idpedido_mandado = ?`,
			// 	{ replacements: [idpedido], type: QueryTypes.UPDATE }
			// );

			let read_query = `UPDATE pedido_mandado SET pwa_delivery_tiempo_atendido = TIMESTAMPDIFF(MINUTE, fecha_hora, now()), pwa_estado='E' WHERE idpedido_mandado = ?`;
			await QueryServiceV1.ejecutarConsulta(read_query, [idpedido], 'UPDATE', 'setFinPedidoExpressEntregado');

			let read_query2 = '';
			if (num_quedan > 0) {
				read_query2 = `UPDATE repartidor SET pedido_por_aceptar=? WHERE idrepartidor = ?`;
				await QueryServiceV1.ejecutarConsulta(read_query2, [JSON.stringify(pedidos_quedan), idrepartidor], 'UPDATE', 'setFinPedidoExpressEntregado');
			} else {
				read_query2 = `UPDATE repartidor SET ocupado = 0, pedido_por_aceptar=null WHERE idrepartidor = ?`;
				await QueryServiceV1.ejecutarConsulta(read_query2, [idrepartidor], 'UPDATE', 'setFinPedidoExpressEntregado');
			}

			// if (num_quedan > 0) {
			// 	await sequelize.query(
			// 		`UPDATE repartidor SET pedido_por_aceptar=? WHERE idrepartidor = ?`,
			// 		{ replacements: [JSON.stringify(pedidos_quedan), idrepartidor], type: QueryTypes.UPDATE }
			// 	);
			// } else {
			// 	await sequelize.query(
			// 		`UPDATE repartidor SET ocupado = 0, pedido_por_aceptar=null WHERE idrepartidor = ?`,
			// 		{ replacements: [idrepartidor], type: QueryTypes.UPDATE }
			// 	);
			// }
		}

		if (tipo_pedido === 'retiro_atm') {
			// ✅ SEGURO: 2 queries separados con prepared statements
			// await sequelize.query(
			// 	`UPDATE atm_retiros SET pwa_delivery_tiempo_atendido = TIMESTAMPDIFF(MINUTE, fecha_hora_registro, now()), pwa_estado='E' WHERE idatm_retiros = ?`,
			// 	{ replacements: [idpedido], type: QueryTypes.UPDATE }
			// );

			let read_query = `UPDATE atm_retiros SET pwa_delivery_tiempo_atendido = TIMESTAMPDIFF(MINUTE, fecha_hora_registro, now()), pwa_estado='E' WHERE idatm_retiros = ?`;
			await QueryServiceV1.ejecutarConsulta(read_query, [idpedido], 'UPDATE', 'setFinPedidoExpressEntregado');

			// await sequelize.query(
			// 	`UPDATE repartidor SET ocupado = 0, pedido_por_aceptar=null WHERE idrepartidor = ?`,
			// 	{ replacements: [idrepartidor], type: QueryTypes.UPDATE }
			// );

			let read_query2 = `UPDATE repartidor SET ocupado = 0, pedido_por_aceptar=null WHERE idrepartidor = ?`;
			await QueryServiceV1.ejecutarConsulta(read_query2, [idrepartidor], 'UPDATE', 'setFinPedidoExpressEntregado');
		}

		return ReS(res, { data: true });
	} catch (err) {
		logger.error({ err }, 'error setFinPedidoExpressEntregado');
		return ReE(res, err);
	}
}
module.exports.setFinPedidoExpressEntregado = setFinPedidoExpressEntregado;

const getPedidosEntregadoDia = async function (req, res) {
	const idrepartidor = managerFilter.getInfoToken(req,'idrepartidor');
	
    // const read_query = `call procedure_pwa_repartidor_pedido_entregado_dia(${idrepartidor})`;
    // return await emitirRespuesta_RES(read_query, res);        
	
	// ✅ SEGURO: Prepared statement
    const read_query = `CALL procedure_pwa_repartidor_pedido_entregado_dia(?)`;
    // try {
	// 	const rows = await sequelize.query(read_query, {
	// 		replacements: [idrepartidor],
	// 		type: QueryTypes.SELECT
	// 	});
	// 	return ReS(res, { data: rows });
	// } catch (err) {
	// 	logger.error({ err }, 'error getPedidosEntregadoDia');
	// 	return ReE(res, err);
	// }
	
	const rows = await QueryServiceV1.ejecutarProcedimiento(read_query, [idrepartidor], 'getPedidosEntregadoDia');
	return ReS(res, { data: rows });
}
module.exports.getPedidosEntregadoDia = getPedidosEntregadoDia;

const getPedidosResumenEntregadoDia = async function (req, res) {
	const idrepartidor = managerFilter.getInfoToken(req,'idrepartidor');
	
    // const read_query = `call procedure_pwa_repartidor_resumen_entregado_dia(${idrepartidor})`;
    // return await emitirRespuesta_RES(read_query, res);        
	
	// ✅ SEGURO: Prepared statement
    const read_query = `CALL procedure_pwa_repartidor_resumen_entregado_dia(?)`;
    // try {
	// 	const rows = await sequelize.query(read_query, {
	// 		replacements: [idrepartidor],
	// 		type: QueryTypes.SELECT
	// 	});
	// 	return ReS(res, { data: rows });
	// } catch (err) {
	// 	logger.error({ err }, 'error getPedidosResumenEntregadoDia');
	// 	return ReE(res, err);
	// }

	const rows = await QueryServiceV1.ejecutarProcedimiento(read_query, [idrepartidor], 'getPedidosResumenEntregadoDia');
	return ReS(res, { data: rows });
}
module.exports.getPedidosResumenEntregadoDia = getPedidosResumenEntregadoDia;


const getPedidoPendienteAceptar = async function (idrepartidor) {
	// const idcliente = dataCLiente.idcliente;
    // const read_query = `SELECT pedido_por_aceptar, solicita_liberar_pedido, pedido_paso_va, socketid, pwa_code_verification as key_suscripcion_push from repartidor where idrepartidor = ${idrepartidor}`;
    // return await emitirRespuesta(read_query);        
	
	// ✅ SEGURO: Prepared statement
    const read_query = `SELECT pedido_por_aceptar, solicita_liberar_pedido, pedido_paso_va, socketid, pwa_code_verification as key_suscripcion_push, fcm_token from repartidor where idrepartidor = ?`;
    // try {
	// 	return await sequelize.query(read_query, {
	// 		replacements: [idrepartidor],
	// 		type: QueryTypes.SELECT
	// 	});
	// } catch (err) {
	// 	logger.error({ err }, 'error getPedidoPendienteAceptar');
	// 	return [];
	// }

	const rows = await QueryServiceV1.ejecutarConsulta(read_query, [idrepartidor], 'SELECT', 'getPedidoPendienteAceptar');
	return rows || [];
}
module.exports.getPedidoPendienteAceptar = getPedidoPendienteAceptar;




const getPropioPedidos = async function (req, res) {
	const idrepartidor = req.body.idrepartidor || managerFilter.getInfoToken(req,'idrepartidor');
    // const read_query = `SELECT * from  pedido where idrepartidor=${idrepartidor} and (fecha = DATE_FORMAT(now(), '%d/%m/%Y')  or cierre=0)`;
    // return await emitirRespuesta_RES(read_query, res);        
	
	// ✅ SEGURO: Prepared statement
    const read_query = `SELECT * from  pedido where idrepartidor=? and (fecha = DATE_FORMAT(now(), '%d/%m/%Y')  or cierre=0)`;
    // try {
	// 	return await sequelize.query(read_query, {
	// 		replacements: [idrepartidor],
	// 		type: QueryTypes.SELECT
	// 	});
	// } catch (err) {
	// 	logger.error({ err }, 'error getPropioPedidos');
	// 	return [];
	// }

	const rows = await QueryServiceV1.ejecutarConsulta(read_query, [idrepartidor], 'SELECT', 'getPropioPedidos');
	return rows || [];
}
module.exports.getPropioPedidos = getPropioPedidos;

const getInfo = async function (req, res) {

	logger.debug('getInfo repartidor');
	const idrepartidor = managerFilter.getInfoToken(req,'idrepartidor') || req.body.idrepartidor;
    // const read_query = `SELECT * from  repartidor where idrepartidor=${idrepartidor}`;
    // return await emitirRespuesta_RES(read_query, res);        
	
	// ✅ SEGURO: Prepared statement
    const read_query = `SELECT * from  repartidor where idrepartidor=?`;
    // try {
	// 	return await sequelize.query(read_query, {
	// 		replacements: [idrepartidor],
	// 		type: QueryTypes.SELECT
	// 	});
	// } catch (err) {
	// 	logger.error({ err }, 'error getInfo');
	// 	return [];
	// }

	logger.debug({ idrepartidor }, 'Login repartidor');

	const rows = await QueryServiceV1.ejecutarConsulta(read_query, [idrepartidor], 'SELECT', 'getInfo');
	return ReS(res, { data: rows });
}
module.exports.getInfo = getInfo;

const getPedidosRecibidosGroup = async function (req, res) {
	_ids = req.body.ids;

	let idsArray = Array.isArray(_ids) ? _ids : _ids.split(',').map(id => id.trim());
	
    // const read_query = `SELECT p.*, ptle.time_line from  pedido p
	// 						left join pedido_time_line_entrega ptle using(idpedido) 
	// 					where p.idpedido in (${_ids}) GROUP by p.idpedido`;
    // return await emitirRespuesta_RES(read_query, res);        
	
	// ✅ SEGURO: Prepared statement
    const read_query = `SELECT p.*, ptle.time_line from  pedido p
						left join pedido_time_line_entrega ptle using(idpedido) 
					where p.idpedido in (?) GROUP by p.idpedido`;
    // try {
	// 	return await sequelize.query(read_query, {
	// 		replacements: [_ids],
	// 		type: QueryTypes.SELECT
	// 	});
	// } catch (err) {
	// 	logger.error({ err }, 'error getPedidosRecibidosGroup');
	// 	return [];
	// }

	const rows = await QueryServiceV1.ejecutarConsulta(read_query, [idsArray], 'SELECT', 'getPedidosRecibidosGroup');
	
	return ReS(res, { data: rows });
}
module.exports.getPedidosRecibidosGroup = getPedidosRecibidosGroup;





// PROCESO LOAR PEDIDOS PENDIENTES
// PROCESO COLOCA LOS PEDIDOS EN LOS REPARTIDORES
// BUSCA CADA 2 MINUTOS COLOCAR PEDIDOS
// ejecuta hasta que la lista de pedidos pendientes este vacia
// activa la funcion cuando hay un nuevo pedido
// esto por que el socket no es seguro


async function colocarPedidoEnRepartidor(io, idsede) {

	// logger.debug ( 'xxxxxxxxxxxxxxxxx------colocarPedidoEnRepartidor' );

	// traer lista de pedidos que estan sin repartidor
	let listGroupPedidos = []; // lista agrupada
	let listPedidos =  await getPedidosEsperaRepartidor(idsede);	

	logger.debug('listPedidos listPedidos.length === ', listPedidos);
	

	// lista de idrepartidor a quitar pedido
	// para solo quitar una vez
	let listLastRepartidor = ''; 

	listPedidos = Array.isArray(listPedidos) ? JSON.parse(JSON.stringify(listPedidos)) : [];
	
	// logger.debug ( 'listPedidos listPedidos.lenght', listPedidos.length );
	// logger.debug (' == listPedidos ==', listPedidos)


	//isshow indica los pedidos que ya llegaron a la hora de notificacion
	//isshow_back inidica que llegaron a la hora notificacion - 6 minutos para agrupar y dar aun solo repartidor

	

	if ( listPedidos.length > 0 ) {

		// op 2
		
		let importeAcumula = 0;
		let importePagar = 0;
		let listGroupPedidos = [];
		let listGruposPedidos = [];
		let _num_reasignaciones = null;
		let _last_id_repartidor_reasigno = null;
		listPedidos.map(p => {
			logger.debug( 'p.paso', p.paso );
			logger.debug( 'p.idpedido', p.idpedido );
			if ( !p.paso && p.isshow == 1 ){
				const _idsede = p.idsede;
				let isImporteAcumuladoCompleto = false; // para continuar la agrupacion o no

				logger.debug( '_idsede', _idsede );

				// p.paso = true;
				importeAcumula = 0;
				importePagar = 0;				

				_num_reasignaciones = null;
				_last_id_repartidor_reasigno = null;
				listGroup = [];
				listPedidos
					.filter(pp => pp.isshow === 1 || pp.flag_solicita_repartidor_papaya === 1)
					.filter(pp => pp.idsede === _idsede && pp.isshow_back === 1 && !pp.paso)
					.map(pp => {						
						pp.json_datos_delivery = typeof pp.json_datos_delivery === 'string' ? JSON.parse(pp.json_datos_delivery) : pp.json_datos_delivery;
						const isPagoTarjeta = pp.json_datos_delivery.p_header.arrDatosDelivery.metodoPago.idtipo_pago === 2;
						const isRecogeCliente = pp.cliente_pasa_recoger === 'false' ? false : true;

						if ( !isRecogeCliente ) { // si no recoge el cliente notifica al repartidor
						
							logger.debug('== el pedido', pp)
							logger.debug('== isPagoTarjeta', isPagoTarjeta)
							if (isPagoTarjeta) {
								pp.paso=true;
								listGroup.push(pp.idpedido);
							} else {
								const _ppTotal = parseFloat(pp.total);
								logger.debug('== _ppTotal', _ppTotal)
								importeAcumula += _ppTotal;
								logger.debug('== importeAcumula', importeAcumula)
								logger.debug('== isImporteAcumuladoCompleto antes', isImporteAcumuladoCompleto)
								// if ( importeAcumula <= pp.monto_acumula) {
								if ( isImporteAcumuladoCompleto === false ) {
									pp.paso=true;
									// pp.json_datos_delivery = typeof pp.json_datos_delivery === 'string' ? JSON.parse(pp.json_datos_delivery) : pp.json_datos_delivery;									

									importePagar += _ppTotal;	
									
									// logger.debug('push ', pp.idpedido);
									_last_id_repartidor_reasigno = _last_id_repartidor_reasigno ? _last_id_repartidor_reasigno : pp.last_id_repartidor_reasigno;
									_num_reasignaciones = _num_reasignaciones ? _num_reasignaciones : pp.num_reasignaciones;

									listGroup.push(pp.idpedido);
									logger.debug('== listGroup', listGroup)

									isImporteAcumuladoCompleto = importeAcumula >= pp.monto_acumula ? true : false;
									logger.debug('== isImporteAcumuladoCompleto fin', isImporteAcumuladoCompleto)
								} 
								// else {
									// if (isPagoTarjeta) {
									// 	listGroup.push(pp.idpedido);
									// }

									// importeAcumula -= _ppTotal;
								//}

								
							}							
						}

						// si el monto es mayor al acumulado tambien agrega
						// listGroup.push(pp.idpedido);
						
					});				


				// add las_repartidor buscar para que no duplique
				const _idRepartidorString = `-${_last_id_repartidor_reasigno}-,`;
				if ( listLastRepartidor.indexOf(_idRepartidorString) >= 0 ) {
					_last_id_repartidor_reasigno = null;
				} else {
					listLastRepartidor +=_idRepartidorString;
				}
				

				logger.debug('listLastRepartidor', listLastRepartidor);			
				logger.debug('listLastRepartidor pedido', _last_id_repartidor_reasigno);

				const _rowPedidoAdd = {
					pedidos: listGroup,	
					cantidad_pedidos_aceptados: listGroup.length,				
					cantidad_entregados: 0,
					importe_acumula: importeAcumula,
					importe_pagar: importePagar,
					last_id_repartidor_reasigno: _last_id_repartidor_reasigno,
					idsede: p.idsede,
					num_reasignaciones: _num_reasignaciones,
					sede_coordenadas: {
						latitude: p.latitude,
						longitude: p.longitude
					}
				}

				logger.debug('idpedidos', _rowPedidoAdd.pedidos.join(','));

				listGruposPedidos.push(_rowPedidoAdd);
				// logger.debug( 'ListGruposPedidos', listGruposPedidos );

			}
		});



		// notificar al repartidor
		// listPedidos.map(async p => {
		for (let index = 0; index < listGruposPedidos.length; index++) {
			const _group = listGruposPedidos[index];
			logger.debug('_group procesar', _group);
			// p.json_datos_delivery = typeof p.json_datos_delivery === 'string' ? JSON.parse(p.json_datos_delivery) : p.json_datos_delivery;			

			// cantidad en efectivo a  pagar (efectivo o yape)
			// const _dataJson = p.json_datos_delivery.p_header.arrDatosDelivery;	
			// const _cantidadEfectivoPagar = _dataJson.metodoPago.idtipo_pago !== 2 ? parseFloat(_dataJson.importeTotal) : 0;

			logger.debug('_cantidadEfectivoPagar 1', _group.importe_pagar);				

			// const _pJson = JSON.parse(JSON.stringify(p));		
			// logger.debug('pedido procesar json', p);
			// lista de repartidores			
			const listRepartidores = await getRepartidoreForPedidoFromInterval(_group.sede_coordenadas.latitude, _group.sede_coordenadas.longitude, _group.importe_pagar);
			logger.debug('listRepartidores', listRepartidores)

			// enviamos
			const response_ok = await sendPedidoRepartidorOp2(listRepartidores, _group, io);
			logger.debug('response_ok', response_ok);
		}

		if ( listGruposPedidos.length > 0 ) {
			// NOTIFICA a la central
			io.to('MONITOR').emit('notifica-pedidos-pendientes', listGruposPedidos);
		}

	}

	// proceso no termina se queda activo esperando pedidos
	// else {

	// 	logger.debug('fin del proceso')
	// 	clearInterval(intervalBucaRepartidor);
	// 	intervalBucaRepartidor=null;
	// }	

	// colocamos en la tabla repartidor el pedido

	
}


// async function colocarPedidoEnRepartidor(io, idsede) {

// 	// traer lista de pedidos que estan sin repartidor
// 	let listGroupPedidos = []; // lista agrupada
// 	let listPedidos =  await getPedidosEsperaRepartidor(idsede);	
// 	listPedidos = JSON.parse(JSON.stringify(listPedidos));
// 	// listPedidos = listPedidos.data;
// 	// logger.debug ( 'listPedidos', listPedidos.data );

// 	// listPedidos = JSON.parse(JSON.stringify(listPedidos));

// 	logger.debug ( 'listPedidos listPedidos.lenght', listPedidos.length );

// 	if (listPedidos.length > 0) {


// 		// listPedidos.map(async p => {
// 		for (let index = 0; index < listPedidos.length; index++) {
// 			const p = listPedidos[index];
// 			logger.debug('pedido procesar', p);
// 			p.json_datos_delivery = typeof p.json_datos_delivery === 'string' ? JSON.parse(p.json_datos_delivery) : p.json_datos_delivery;			

// 			// cantidad en efectivo a  pagar (efectivo o yape)
// 			const _dataJson = p.json_datos_delivery.p_header.arrDatosDelivery;	
// 			const _cantidadEfectivoPagar = _dataJson.metodoPago.idtipo_pago !== 2 ? parseFloat(_dataJson.importeTotal) : 0;

// 			logger.debug('_cantidadEfectivoPagar', _cantidadEfectivoPagar);
			


// 			// const _pJson = JSON.parse(JSON.stringify(p));		
// 			// logger.debug('pedido procesar json', p);
// 			// lista de repartidores			
// 			const listRepartidores = await getRepartidoreForPedidoFromInterval(p.latitude, p.longitude, _cantidadEfectivoPagar);

// 			// enviamos
// 			const response_ok = await sendPedidoRepartidor(listRepartidores, p, io);
// 			logger.debug('response_ok', response_ok);
// 		}
// 		// });
// 	} 

// 	// proceso no termina se queda activo esperando pedidos
// 	// else {

// 	// 	logger.debug('fin del proceso')
// 	// 	clearInterval(intervalBucaRepartidor);
// 	// 	intervalBucaRepartidor=null;
// 	// }	

// 	// colocamos en la tabla repartidor el pedido

	
// }


// el proceso se activa al primer pedido que recibe y se mantiene activo eseprando
// pedidos
const runLoopSearchRepartidor = async function (io, idsede) {
	logger.debug('xxxxxxxxxxx-----------runLoopSearchRepartidor', intervalBucaRepartidor)
	if ( intervalBucaRepartidor === null ) {		
		colocarPedidoEnRepartidor(io, idsede);
		intervalBucaRepartidor = setInterval(() => colocarPedidoEnRepartidor(io, idsede), 60000);
		// intervalBucaRepartidor = setInterval(() => colocarPedidoEnRepartidor(io, idsede), 10000); //desarrollo
	}
}
module.exports.runLoopSearchRepartidor = runLoopSearchRepartidor;


const runLoopPrueba = async function (req, res) {
	// let listPedidos =  await getPedidosEsperaRepartidor();		
	// // listPedidos = listPedidos.data;	

	// listPedidos = JSON.parse(JSON.stringify(listPedidos));

	// // logger.debug ( 'listPedidos', listPedidos );

	// // logger.debug ( 'listPedidos listPedidos.lenght', listPedidos.length );


	// if ( listPedidos.length > 0 ) {

	// 	// op 2
	// 	let importeAcumula = 0;
	// 	let importePagar = 0;
	// 	let listGroupPedidos = [];
	// 	let listGruposPedidos = [];
	// 	listPedidos.map(p => {
	// 		logger.debug( 'p.paso', p.paso );
	// 		logger.debug( 'p.idpedido', p.idpedido );
	// 		if ( !p.paso && p.isshow == 1 ){
	// 			const _idsede = p.idsede;

	// 			logger.debug( '_idsede', _idsede );

	// 			// p.paso = true;
	// 			importeAcumula = 0;
	// 			importePagar = 0;
	// 			listGroup = [];
	// 			listPedidos
	// 				.filter(pp => pp.idsede === _idsede && pp.isshow_back === 1 && !pp.paso)
	// 				.map(pp => {						
	// 					importeAcumula += parseFloat(pp.total);
	// 					if ( importeAcumula <= pp.monto_acumula ) {
	// 						pp.paso=true;
	// 						pp.json_datos_delivery = typeof pp.json_datos_delivery === 'string' ? JSON.parse(pp.json_datos_delivery) : pp.json_datos_delivery;

	// 						// si es tarjeta no suma
	// 						if ( pp.json_datos_delivery.p_header.arrDatosDelivery.metodoPago.idtipo_pago !==2 ) {
	// 							importePagar += parseFloat(pp.total);
	// 						}

	// 						logger.debug('push ', pp.idpedido);
	// 						listGroup.push(pp.idpedido);
	// 					} else {
	// 						importeAcumula -= parseFloat(pp.total);
	// 					}
	// 				});

	// 			const _rowPedidoAdd = {
	// 				pedidos: listGroup,					
	// 				importe_acumula: importeAcumula,
	// 				importe_pagar: importePagar,
	// 				sede_coordenadas: {
	// 					latitude: p.latitude,
	// 					longitude: p.longitude
	// 				}
	// 			}

	// 			logger.debug('idpedidos', _rowPedidoAdd.pedidos.join(','));

	// 			listGruposPedidos.push(_rowPedidoAdd);
	// 			logger.debug( 'ListGruposPedidos', listGruposPedidos );

	// 		}
	// 	});



	// 	// notificar al repartidor
	// 	// listPedidos.map(async p => {
	// 	for (let index = 0; index < listGruposPedidos.length; index++) {
	// 		const _group = listGruposPedidos[index];
	// 		logger.debug('_group procesar', _group);
	// 		// p.json_datos_delivery = typeof p.json_datos_delivery === 'string' ? JSON.parse(p.json_datos_delivery) : p.json_datos_delivery;			

	// 		// cantidad en efectivo a  pagar (efectivo o yape)
	// 		// const _dataJson = p.json_datos_delivery.p_header.arrDatosDelivery;	
	// 		// const _cantidadEfectivoPagar = _dataJson.metodoPago.idtipo_pago !== 2 ? parseFloat(_dataJson.importeTotal) : 0;

	// 		logger.debug('_cantidadEfectivoPagar', _group.importe_pagar);
			


	// 		// const _pJson = JSON.parse(JSON.stringify(p));		
	// 		// logger.debug('pedido procesar json', p);
	// 		// lista de repartidores			
	// 		const listRepartidores = await getRepartidoreForPedidoFromInterval(_group.sede_coordenadas.latitude, _group.sede_coordenadas.longitude, _group.importe_pagar);

	// 		// enviamos
	// 		const response_ok = await sendPedidoRepartidorOp2(listRepartidores, _group, io);
	// 		logger.debug('response_ok', response_ok);
	// 	}



		// const property = 'idsede';
		// const listGroupSede = listPedidos.reduce(function (acc, obj) {
		//     var key = obj[property];
		//     if (!acc[key]) {
		//       acc[key] = [];
		//     }
		//     acc[key].push(obj.idpedido);
		//     return acc;
		//   }, {});

		// logger.debug('listGroupSede ==== ', listGroupSede);

		// res.json(listGruposPedidos);
	// }


	// listPedidos.map(async p => {

	// 	p.json_datos_delivery = JSON.parse(p.json_datos_delivery);
	// 	// logger.debug('pedido procesar', p);
	// 	logger.debug('p.latitude', p.latitude);

	// 	const _dataJson = p.json_datos_delivery.p_header.arrDatosDelivery;			

	// 	logger.debug('_dataJson.arrDatosDelivery.metodoPago.idtipo_pago', _dataJson.metodoPago.idtipo_pago)		

	// 	const _cantidadEfectivoPagar = _dataJson.metodoPago.idtipo_pago !== 2 ? parseFloat(_dataJson.importeTotal) : 0;

	// 		logger.debug('_cantidadEfectivoPagar', _cantidadEfectivoPagar);
	// })
}
module.exports.runLoopPrueba = runLoopPrueba;

// function intervalo que se repite cada 2min


// PROCESO LOAR PEDIDOS PENDIENTES
// PROCESO COLOCA LOS PEDIDOS EN LOS REPARTIDORES
// PROCESO LOAR PEDIDOS PENDIENTES
// PROCESO COLOCA LOS PEDIDOS EN LOS REPARTIDORES

















// Eventos enviados por el servidor
// si los repartidores tienen pedidos nuevos



// const getIfPedidoNuevo = function (req, res) {
// 	// logger.debug('======= init event-stream =====');

// 	res.writeHead(200, {
//         'Content-Type': 'text/event-stream',
//         'Cache-Control': 'no-cache',
//         'Connection': 'keep-alive',
//     });


//     sseDemo(req, res);
// }
// module.exports.getIfPedidoNuevo = getIfPedidoNuevo;


// function sseDemo(req, res) {
//     const idrepartidor = req.query.id; //managerFilter.getInfoToken(req,'idrepartidor');;
//     // logger.debug('======= init event-stream =====', idrepartidor);

//     const intervalId = setInterval(async() => {
//     	const read_query = `call procedure_delivery_reparitdor_nuevo_pedido(${idrepartidor});`;
//     	const responsePedido =  await emitirRespuestaSP(read_query);

//     	logger.debug('======= init event-stream =====', responsePedido);
	
//         res.write("data: " + JSON.stringify(responsePedido) +
//                     "\n\n", "utf8", () => {
//                         if (res.flushHeaders) {
//                             res.flushHeaders();
//                         }
//                     });

//     }, 1000);

//     req.on('close', () => {
//         clearInterval(intervalId);
//     });
// }




// a los pedidos que recoge el cliente lo asigna el repartidor 1 = Atencion al cliente
const setAsignarRepartoAtencionCliente = async function (idpedido) {  	
	// const sql = `update pedido set idrepartidor = 1 where idpedido = ${idpedido};`;
	// await onlyUpdateQuery(sql);
	
	// ✅ SEGURO: Prepared statement
	const sql = `UPDATE pedido SET idrepartidor = 1 WHERE idpedido = ?`;
	// try {
	// 	await sequelize.query(sql, {
	// 		replacements: [idpedido],
	// 		type: QueryTypes.UPDATE
	// 	});
	// } catch (err) {
	// 	logger.error({ err }, 'error setAsignarRepartoAtencionCliente');
	// }

	await QueryServiceV1.ejecutarConsulta(sql, [idpedido], 'UPDATE', 'setAsignarRepartoAtencionCliente');	
}
module.exports.setAsignarRepartoAtencionCliente = setAsignarRepartoAtencionCliente;




const getListPedidosAsignados = async function (req, res) {
	const idrepartidor = req.query.id;
	const sql = `select idpedidos from repartidor_pedido_asignado where idrepartidor = ?`;
	return await QueryServiceV1.ejecutarConsulta(sql, [idrepartidor], 'SELECT', 'getListPedidosAsignados');
}
module.exports.getListPedidosAsignados = getListPedidosAsignados;

const setPedidoCanceladoRepartidor = async function (dataPedido) {
	const { idpedido, idsede, idrepartidor, motivo } = dataPedido;
	const fechaHora = new Date();
	const sql = `insert into pedido_delivery_cancelado_repartidor (idpedido, idsede, idrepartidor, fecha, motivo) values (?, ?, ?, ?, ?)`;	
	QueryServiceV1.ejecutarConsulta(sql, [idpedido, idsede, idrepartidor, fechaHora, motivo], 'INSERT', 'setPedidoCanceladoRepartidor');	
	
	// marca como que el repartidor marco cancelado
	const read_query = `UPDATE pedido SET pwa_delivery_status = 5 pwa_estado='C'  WHERE idpedido = ?`;
	await QueryServiceV1.ejecutarConsulta(read_query, [idpedido], 'UPDATE', 'setUpdateEstadoPedido');
}
module.exports.setPedidoCanceladoRepartidor = setPedidoCanceladoRepartidor;

const setSuscriptionNotificationPush = async function (req, res){
	const { idrepartidor, pwa_code_verification, fcm_token } = req.body;
	const sql = `update repartidor set pwa_code_verification=?, fcm_token=? where idrepartidor=?`;	
	QueryServiceV1.ejecutarConsulta(sql, [pwa_code_verification, fcm_token, idrepartidor], 'UPDATE', 'setSuscriptionNotificationPush');
	return ReS(res, {
		data: true
	});
}
module.exports.setSuscriptionNotificationPush = setSuscriptionNotificationPush;


// function emitirRespuestaSP(xquery) {
// 	logger.debug(xquery);
// 	return sequelize.query(xquery, {		
// 		type: QueryTypes.SELECT
// 	})
// 	.then(function (rows) {

// 		// convertimos en array ya que viene en object
// 		var arr = [];
// 		arr = Object.values(rows[0]);		
		
// 		return arr;
// 	})
// 	.catch((err) => {
// 		return false;
// 	});
// }







// function emitirRespuesta(xquery) {
// 	logger.debug(xquery);
// 	return sequelize.query(xquery, {type: QueryTypes.SELECT})
// 	.then(function (rows) {
		
// 		// return ReS(res, {
// 		// 	data: rows
// 		// });
// 		return rows;
// 	})
// 	.catch((err) => {
// 		return false;
// 	});
// }

function emitirRespuestaData(xquery) {
	// logger.debug(xquery);
	return sequelize.query(xquery, {type: QueryTypes.SELECT})
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

// function execSqlQueryNoReturn(xquery, res) {
// 	logger.debug(xquery);
// 	sequelize.query(xquery, {type: QueryTypes.UPDATE}).spread(function(results, metadata) {
//   // Results will be an empty array and metadata will contain the number of affected rows.

// 	  	return ReS(res, {
// 			data: results
// 		});
// 	});

// }





// function emitirRespuesta_RES(xquery, res) {
// 	logger.debug(xquery);
// 	return sequelize.query(xquery, {type: QueryTypes.SELECT})
// 	.then(function (rows) {
		
// 		return ReS(res, {
// 			data: rows
// 		});
// 		// return rows;
// 	})
// 	.catch((err) => {
// 		return false;
// 	});
// }


// function emitirRespuestaSP_RES(xquery, res) {
// 	logger.debug(xquery);
// 	sequelize.query(xquery, {		
// 		type: QueryTypes.SELECT
// 	})
// 	.then(function (rows) {

// 		// convertimos en array ya que viene en object
// 		var arr = [];
// 		arr = Object.values(rows[0]) ;
		
// 		return ReS(res, {
// 			data: arr
// 		});
// 	})
// 	.catch((err) => {
// 		return ReE(res, err);
// 	});
// }