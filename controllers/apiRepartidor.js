const { to, ReE, ReS }  = require('../service/uitl.service');
const sendMsjsService = require('./sendMsj.js');
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
	// console.log('llego a funcion setEfectivoMano');
	// console.log('llego a funcion setEfectivoMano req', req);
	// console.log('llego a funcion setEfectivoMano req usuariotoken', req.usuariotoken);

	const idrepartidor = managerFilter.getInfoToken(req,'idrepartidor');
	const efectivo = req.body.efectivo;      
	const online = req.body.online;     

	console.log('llego a funcion setEfectivoMano idrepartidor', idrepartidor);
	
    const read_query = `update repartidor set efectivo_mano = ${efectivo}, online = ${online} where idrepartidor = ${idrepartidor}`;
    execSqlQueryNoReturn(read_query, res);
}
module.exports.setEfectivoMano = setEfectivoMano;

const pushSuscripcion = function (req, res) {
	const idrepartidor = managerFilter.getInfoToken(req,'idrepartidor');
	const suscripcion = req.body.suscripcion;	

	const read_query = `update repartidor set pwa_code_verification = '${JSON.stringify(suscripcion)}' where idrepartidor = ${idrepartidor}`;
	emitirRespuestaSP_RES(read_query, res);
}
module.exports.pushSuscripcion = pushSuscripcion;

const setPositionNow = async function (req, res) {
	const idrepartidor = managerFilter.getInfoToken(req,'idrepartidor');
	const pos = req.body.pos;
	
	
    const read_query = `update repartidor set position_now = '${JSON.stringify(pos)}' where idrepartidor = ${idrepartidor}`;
    emitirRespuesta_RES(read_query, res);
}
module.exports.setPositionNow = setPositionNow;


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
    const read_query = `call procedure_delivery_get_repartidor(${es_latitude}, ${es_longitude})`;
    return emitirRespuestaSP(read_query);        
}
module.exports.getRepartidoreForPedido = getRepartidoreForPedido;

// dataPedido es el registro de la tabla pedido
const getRepartidoreForPedidoFromInterval = async function (es_latitude, es_longitude, efectivoPagar) {		                  
    const read_query = `call procedure_delivery_get_repartidor(${es_latitude}, ${es_longitude}, ${efectivoPagar})`;
    return await emitirRespuestaSP(read_query);        
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
	const read_query = `call procedure_delivery_pedidos_pendientes()`;
 	const response = await emitirRespuestaSP(read_query);        
 	// console.log('pedidos response', response);
 	// console.log('pedidos pendiente', response.data);
 	return response;
 	 	


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
		console.log('repartidor-notifica-server-quita-pedido --b');
		const getSocketIdRepartidorReasigno = await getSocketIdRepartidor(dataPedido.last_id_repartidor_reasigno);
		io.to(getSocketIdRepartidorReasigno[0].socketid).emit('repartidor-notifica-server-quita-pedido', dataPedido.idpedido);	
	}


	// si no encuentra repartidor envia nuevamente al primero
	if ( !firtsRepartidor ) {		
		firtsRepartidor = listRepartidores[0];
		dataPedido.num_reasignado = 0;

		// resetea los contadores para empezar nuevamente
		// update pedido set num_reasignaciones = 0 where idpedido = ${dataPedido.idpedido}; 
		const read_query = `update repartidor set flag_paso_pedido='0', pedido_por_aceptar=null where flag_paso_pedido=${dataPedido.idpedido};`;
    	return emitirRespuestaSP(read_query); 
	} else {

		const read_query = `call procedure_delivery_set_pedido_repartidor(${dataPedido.idpedido}, ${firtsRepartidor.idrepartidor}, '${JSON.stringify(dataPedido)}')`;
		const res_call = await emitirRespuestaSP(read_query);
	}


	// envio mensaje
	console.log("============== last_notification = ", firtsRepartidor.last_notification);
	if ( firtsRepartidor.last_notification === 0 ||  firtsRepartidor.last_notification > 7) {	
		//sendMsjsService.sendMsjSMSNewPedido(firtsRepartidor.telefono);
		const read_query = `update repartidor set last_notification = time(now()) where idrepartidor=${firtsRepartidor.idrepartidor};`;
    	emitirRespuestaSP(read_query);
	}

	sendMsjsService.sendPushNotificactionOneRepartidor(firtsRepartidor.key_suscripcion_push, 0);

	// enviamos el socket
	console.log('socket enviado a repartidor', firtsRepartidor);
	io.to(firtsRepartidor.socketid).emit('repartidor-nuevo-pedido', [firtsRepartidor, dataPedido]);

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

	console.log('repartidor ============ firtsRepartidor', firtsRepartidor);

	// quitamos el pedido al repartidor anterior
	console.log('asignar repartidor ============ ', dataPedido);
	if ( dataPedido.last_id_repartidor_reasigno ) {
		console.log('repartidor-notifica-server-quita-pedido --a');
		const getSocketIdRepartidorReasigno = await getSocketIdRepartidor(dataPedido.last_id_repartidor_reasigno);

		// si no esta ocupado quita
		if ( getSocketIdRepartidorReasigno[0].ocupado === 0 ) {
			io.to(getSocketIdRepartidorReasigno[0].socketid).emit('repartidor-notifica-server-quita-pedido', null);
		}		
	}


	// si no encuentra repartidor envia nuevamente al primero
	if ( !firtsRepartidor ) {		
		firtsRepartidor = listRepartidores[0];
		dataPedido.num_reasignado = 0;

		// resetea los contadores para empezar nuevamente
		// update pedido set num_reasignaciones = 0 where idpedido = ${dataPedido.idpedido}; 
		const read_query = `update repartidor set flag_paso_pedido=0, pedido_por_aceptar=null where flag_paso_pedido=${dataPedido.pedidos[0]};`;
    	return emitirRespuestaSP(read_query); 
	} else {

		const read_query = `call procedure_delivery_set_pedido_repartidor(${dataPedido.pedidos[0]}, ${firtsRepartidor.idrepartidor}, '${JSON.stringify(dataPedido)}')`;
		const res_call = await emitirRespuestaSP(read_query);
	}


	// envio mensaje
	console.log("============== last_notification = ", firtsRepartidor.last_notification);
	// if ( firtsRepartidor.last_notification === 0 ||  firtsRepartidor.last_notification > 7) {	
		// sendMsjsService.sendMsjSMSNewPedido(firtsRepartidor.telefono);
		// const read_query = `update repartidor set last_notification = time(now()) where idrepartidor=${firtsRepartidor.idrepartidor};`;
    	// return emitirRespuestaSP(read_query); 
	// }

	sendMsjsService.sendPushNotificactionOneRepartidor(firtsRepartidor.key_suscripcion_push, 0);

	// enviamos el socket
	console.log('socket enviado a repartidor', firtsRepartidor);
	io.to(firtsRepartidor.socketid).emit('repartidor-nuevo-pedido', [firtsRepartidor, dataPedido]);

	// para finalizar async
	return true;
}
module.exports.sendPedidoRepartidorOp2 = sendPedidoRepartidorOp2;


const sendOnlyNotificaPush = function (key_suscripcion_push, tipo_msjs) {
	sendMsjsService.sendPushNotificactionOneRepartidor(key_suscripcion_push, tipo_msjs);
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
// 	console.log('socket enviado a repartidor', firtsRepartidor);
// 	io.to(firtsRepartidor.socketid).emit('repartidor-nuevo-pedido', [firtsRepartidor, dataPedido]);

// }
// module.exports.sendPedidoRepartidor = sendPedidoRepartidor;

// cuando el repartidor acepta el pedido -- se asigna el pedido al repartitor
const setAsignarPedido = function (req, res) {  
	const idrepartidor = managerFilter.getInfoToken(req,'idrepartidor');
	const idpedido = req.body.idpedido;           
	const firstPedido = idpedido.split(',')[0];
	
	// si acepta no borra
	// , pedido_por_aceptar=null
    const read_query = `update pedido set idrepartidor = ${idrepartidor} where idpedido in (${idpedido});
    					update repartidor set ocupado = 1, pedido_paso_va = 1 where idrepartidor = ${idrepartidor};
    					update repartidor set flag_paso_pedido=0 where flag_paso_pedido=${firstPedido}`;

	// const read_query = `call procedure_delivery_asignar_pedido(${idrepartidor}, ${idpedido})`;    					
    execSqlQueryNoReturn(read_query, res);     
    // return emitirRespuesta_RES(read_query, res);   
}
module.exports.setAsignarPedido = setAsignarPedido;

const setPasoVaPedido = function (req, res) {
	const idrepartidor = managerFilter.getInfoToken(req,'idrepartidor');
	const paso = req.body.paso_va;
    const read_query = `update repartidor set pedido_paso_va = ${paso} where idrepartidor = ${idrepartidor};`;
    execSqlQueryNoReturn(read_query, res); 
}
module.exports.setPasoVaPedido = setPasoVaPedido;


/// desde el comercio
const setUpdateEstadoPedido = function (idpedido, estado, tiempo = null) {	
	const savePwaEstado = estado === 4 ? ", pwa_estado = 'E', estado=2 " : '';	 // estado = 2 => pagado
    const read_query = `update pedido set pwa_delivery_status = '${estado}' ${savePwaEstado} where idpedido = ${idpedido};`;
    emitirRespuesta(read_query);        
}
module.exports.setUpdateEstadoPedido = setUpdateEstadoPedido;

const setUpdateRepartidorOcupado = function (idrepartidor, estado) {  
	// si no esta ocupado libera pedido_por_aceptar;
	// console.log('==== CAMBIAMOS DE ESTADO OCUPADO ===', estado);
	const clearPedidoPorAceptar = estado === 0 ?  `, pedido_por_aceptar = null, pedido_paso_va = 0` : '';
    const read_query = `update repartidor set ocupado = ${estado} ${clearPedidoPorAceptar} where idrepartidor = ${idrepartidor};`;
    emitirRespuesta(read_query);        
}
module.exports.setUpdateRepartidorOcupado = setUpdateRepartidorOcupado;

const setLiberarPedido = function (idrepartidor) {  
    const read_query = `update repartidor set ocupado = 0, pedido_por_aceptar = null, solicita_liberar_pedido=0, pedido_paso_va = 0 where idrepartidor = ${idrepartidor};`;
    emitirRespuesta(read_query);        
}
module.exports.setLiberarPedido = setLiberarPedido;



const getSocketIdRepartidor = async function (listIdRepartidor) {
	// const idcliente = dataCLiente.idcliente;
    const read_query = `SELECT socketid, pwa_code_verification as key_suscripcion_push, ocupado from repartidor where idrepartidor in (${listIdRepartidor})`;
    return await emitirRespuesta(read_query);        
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
	// console.log(JSON.stringify(obj));

    const read_query = `call procedure_pwa_delivery_pedido_entregado('${JSON.stringify(obj)}')`;
    return emitirRespuesta_RES(read_query, res);        
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
    const read_query = `SELECT pedido_por_aceptar, solicita_liberar_pedido, pedido_paso_va, socketid, pwa_code_verification as key_suscripcion_push from repartidor where idrepartidor = ${idrepartidor}`;
    return emitirRespuesta(read_query);        
}
module.exports.getPedidoPendienteAceptar = getPedidoPendienteAceptar;



const getPropioPedidos = function (req, res) {
	const idrepartidor = req.body.idrepartidor || managerFilter.getInfoToken(req,'idrepartidor');
    const read_query = `SELECT * from  pedido where idrepartidor=${idrepartidor} and (fecha = DATE_FORMAT(now(), '%d/%m/%Y')  or cierre=0)`;
    emitirRespuesta_RES(read_query, res);        
}
module.exports.getPropioPedidos = getPropioPedidos;

const getInfo = function (req, res) {
	const idrepartidor = managerFilter.getInfoToken(req,'idrepartidor');
    const read_query = `SELECT * from  repartidor where idrepartidor=${idrepartidor}`;
    emitirRespuesta_RES(read_query, res);        
}
module.exports.getInfo = getInfo;

const getPedidosRecibidosGroup = function (req, res) {
	_ids = req.body.ids;
    const read_query = `SELECT * from  pedido where idpedido in (${_ids})`;
    return emitirRespuesta_RES(read_query, res);        
}
module.exports.getPedidosRecibidosGroup = getPedidosRecibidosGroup;






// PROCESO LOAR PEDIDOS PENDIENTES
// PROCESO COLOCA LOS PEDIDOS EN LOS REPARTIDORES
// BUSCA CADA 2 MINUTOS COLOCAR PEDIDOS
// ejecuta hasta que la lista de pedidos pendientes este vacia
// activa la funcion cuando hay un nuevo pedido
// esto por que el socket no es seguro


async function colocarPedidoEnRepartidor(io, idsede) {

	// traer lista de pedidos que estan sin repartidor
	let listGroupPedidos = []; // lista agrupada
	let listPedidos =  await getPedidosEsperaRepartidor(idsede);	

	// lista de idrepartidor a quitar pedido
	// para solo quitar una vez
	let listLastRepartidor = ''; 
	listPedidos = JSON.parse(JSON.stringify(listPedidos));
	
	console.log ( 'listPedidos listPedidos.lenght', listPedidos.length );

	if ( listPedidos.length > 0 ) {

		// op 2
		
		let importeAcumula = 0;
		let importePagar = 0;
		let listGroupPedidos = [];
		let listGruposPedidos = [];
		let _num_reasignaciones = null;
		let _last_id_repartidor_reasigno = null;
		listPedidos.map(p => {
			console.log( 'p.paso', p.paso );
			console.log( 'p.idpedido', p.idpedido );
			if ( !p.paso && p.isshow == 1 ){
				const _idsede = p.idsede;

				console.log( '_idsede', _idsede );

				// p.paso = true;
				importeAcumula = 0;
				importePagar = 0;
				_num_reasignaciones = null;
				_last_id_repartidor_reasigno = null;
				listGroup = [];
				listPedidos
					.filter(pp => pp.idsede === _idsede && pp.isshow_back === 1 && !pp.paso)
					.map(pp => {						
						importeAcumula += parseFloat(pp.total);
						if ( importeAcumula <= pp.monto_acumula ) {
							pp.paso=true;
							pp.json_datos_delivery = typeof pp.json_datos_delivery === 'string' ? JSON.parse(pp.json_datos_delivery) : pp.json_datos_delivery;

							// si es tarjeta no suma
							if ( pp.json_datos_delivery.p_header.arrDatosDelivery.metodoPago.idtipo_pago !==2 ) {
								importePagar += parseFloat(pp.total);
							}
							
							console.log('push ', pp.idpedido);
							_last_id_repartidor_reasigno = _last_id_repartidor_reasigno ? _last_id_repartidor_reasigno : pp.last_id_repartidor_reasigno;
							_num_reasignaciones = _num_reasignaciones ? _num_reasignaciones : pp.num_reasignaciones;

							listGroup.push(pp.idpedido);
						} else {
							importeAcumula -= parseFloat(pp.total);
						}
						
					});				


				// add las_repartidor buscar para que no duplique
				const _idRepartidorString = `-${_last_id_repartidor_reasigno}-,`;
				if ( listLastRepartidor.indexOf(_idRepartidorString) >= 0 ) {
					_last_id_repartidor_reasigno = null;
				} else {
					listLastRepartidor +=_idRepartidorString;
				}
				

				console.log('listLastRepartidor', listLastRepartidor);			

				const _rowPedidoAdd = {
					pedidos: listGroup,					
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

				console.log('idpedidos', _rowPedidoAdd.pedidos.join(','));

				listGruposPedidos.push(_rowPedidoAdd);
				console.log( 'ListGruposPedidos', listGruposPedidos );

			}
		});



		// notificar al repartidor
		// listPedidos.map(async p => {
		for (let index = 0; index < listGruposPedidos.length; index++) {
			const _group = listGruposPedidos[index];
			console.log('_group procesar', _group);
			// p.json_datos_delivery = typeof p.json_datos_delivery === 'string' ? JSON.parse(p.json_datos_delivery) : p.json_datos_delivery;			

			// cantidad en efectivo a  pagar (efectivo o yape)
			// const _dataJson = p.json_datos_delivery.p_header.arrDatosDelivery;	
			// const _cantidadEfectivoPagar = _dataJson.metodoPago.idtipo_pago !== 2 ? parseFloat(_dataJson.importeTotal) : 0;

			console.log('_cantidadEfectivoPagar', _group.importe_pagar);
			


			// const _pJson = JSON.parse(JSON.stringify(p));		
			// console.log('pedido procesar json', p);
			// lista de repartidores			
			const listRepartidores = await getRepartidoreForPedidoFromInterval(_group.sede_coordenadas.latitude, _group.sede_coordenadas.longitude, _group.importe_pagar);

			// enviamos
			const response_ok = await sendPedidoRepartidorOp2(listRepartidores, _group, io);
			console.log('response_ok', response_ok);
		}

	}

	// proceso no termina se queda activo esperando pedidos
	// else {

	// 	console.log('fin del proceso')
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
// 	// console.log ( 'listPedidos', listPedidos.data );

// 	// listPedidos = JSON.parse(JSON.stringify(listPedidos));

// 	console.log ( 'listPedidos listPedidos.lenght', listPedidos.length );

// 	if (listPedidos.length > 0) {


// 		// listPedidos.map(async p => {
// 		for (let index = 0; index < listPedidos.length; index++) {
// 			const p = listPedidos[index];
// 			console.log('pedido procesar', p);
// 			p.json_datos_delivery = typeof p.json_datos_delivery === 'string' ? JSON.parse(p.json_datos_delivery) : p.json_datos_delivery;			

// 			// cantidad en efectivo a  pagar (efectivo o yape)
// 			const _dataJson = p.json_datos_delivery.p_header.arrDatosDelivery;	
// 			const _cantidadEfectivoPagar = _dataJson.metodoPago.idtipo_pago !== 2 ? parseFloat(_dataJson.importeTotal) : 0;

// 			console.log('_cantidadEfectivoPagar', _cantidadEfectivoPagar);
			


// 			// const _pJson = JSON.parse(JSON.stringify(p));		
// 			// console.log('pedido procesar json', p);
// 			// lista de repartidores			
// 			const listRepartidores = await getRepartidoreForPedidoFromInterval(p.latitude, p.longitude, _cantidadEfectivoPagar);

// 			// enviamos
// 			const response_ok = await sendPedidoRepartidor(listRepartidores, p, io);
// 			console.log('response_ok', response_ok);
// 		}
// 		// });
// 	} 

// 	// proceso no termina se queda activo esperando pedidos
// 	// else {

// 	// 	console.log('fin del proceso')
// 	// 	clearInterval(intervalBucaRepartidor);
// 	// 	intervalBucaRepartidor=null;
// 	// }	

// 	// colocamos en la tabla repartidor el pedido

	
// }


// el proceso se activa al primer pedido que recibe y se mantiene activo eseprando
// pedidos
const runLoopSearchRepartidor = async function (io, idsede) {

	if ( intervalBucaRepartidor === null ) {
		colocarPedidoEnRepartidor(io, idsede);
		intervalBucaRepartidor = setInterval(() => colocarPedidoEnRepartidor(io, idsede), 60000);
	}
}
module.exports.runLoopSearchRepartidor = runLoopSearchRepartidor;


const runLoopPrueba = async function (req, res) {
	// let listPedidos =  await getPedidosEsperaRepartidor();		
	// // listPedidos = listPedidos.data;	

	// listPedidos = JSON.parse(JSON.stringify(listPedidos));

	// // console.log ( 'listPedidos', listPedidos );

	// // console.log ( 'listPedidos listPedidos.lenght', listPedidos.length );


	// if ( listPedidos.length > 0 ) {

	// 	// op 2
	// 	let importeAcumula = 0;
	// 	let importePagar = 0;
	// 	let listGroupPedidos = [];
	// 	let listGruposPedidos = [];
	// 	listPedidos.map(p => {
	// 		console.log( 'p.paso', p.paso );
	// 		console.log( 'p.idpedido', p.idpedido );
	// 		if ( !p.paso && p.isshow == 1 ){
	// 			const _idsede = p.idsede;

	// 			console.log( '_idsede', _idsede );

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

	// 						console.log('push ', pp.idpedido);
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

	// 			console.log('idpedidos', _rowPedidoAdd.pedidos.join(','));

	// 			listGruposPedidos.push(_rowPedidoAdd);
	// 			console.log( 'ListGruposPedidos', listGruposPedidos );

	// 		}
	// 	});



	// 	// notificar al repartidor
	// 	// listPedidos.map(async p => {
	// 	for (let index = 0; index < listGruposPedidos.length; index++) {
	// 		const _group = listGruposPedidos[index];
	// 		console.log('_group procesar', _group);
	// 		// p.json_datos_delivery = typeof p.json_datos_delivery === 'string' ? JSON.parse(p.json_datos_delivery) : p.json_datos_delivery;			

	// 		// cantidad en efectivo a  pagar (efectivo o yape)
	// 		// const _dataJson = p.json_datos_delivery.p_header.arrDatosDelivery;	
	// 		// const _cantidadEfectivoPagar = _dataJson.metodoPago.idtipo_pago !== 2 ? parseFloat(_dataJson.importeTotal) : 0;

	// 		console.log('_cantidadEfectivoPagar', _group.importe_pagar);
			


	// 		// const _pJson = JSON.parse(JSON.stringify(p));		
	// 		// console.log('pedido procesar json', p);
	// 		// lista de repartidores			
	// 		const listRepartidores = await getRepartidoreForPedidoFromInterval(_group.sede_coordenadas.latitude, _group.sede_coordenadas.longitude, _group.importe_pagar);

	// 		// enviamos
	// 		const response_ok = await sendPedidoRepartidorOp2(listRepartidores, _group, io);
	// 		console.log('response_ok', response_ok);
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

		// console.log('listGroupSede ==== ', listGroupSede);

		// res.json(listGruposPedidos);
	// }


	// listPedidos.map(async p => {

	// 	p.json_datos_delivery = JSON.parse(p.json_datos_delivery);
	// 	// console.log('pedido procesar', p);
	// 	console.log('p.latitude', p.latitude);

	// 	const _dataJson = p.json_datos_delivery.p_header.arrDatosDelivery;			

	// 	console.log('_dataJson.arrDatosDelivery.metodoPago.idtipo_pago', _dataJson.metodoPago.idtipo_pago)		

	// 	const _cantidadEfectivoPagar = _dataJson.metodoPago.idtipo_pago !== 2 ? parseFloat(_dataJson.importeTotal) : 0;

	// 		console.log('_cantidadEfectivoPagar', _cantidadEfectivoPagar);
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
// 	// console.log('======= init event-stream =====');

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
//     // console.log('======= init event-stream =====', idrepartidor);

//     const intervalId = setInterval(async() => {
//     	const read_query = `call procedure_delivery_reparitdor_nuevo_pedido(${idrepartidor});`;
//     	const responsePedido =  await emitirRespuestaSP(read_query);

//     	console.log('======= init event-stream =====', responsePedido);
	
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


function onlyUpdateQuery(xquery, res) {
	console.log(xquery);
	return sequelize.query(xquery, {type: sequelize.QueryTypes.SELECT})
	.then(function (result) {
		
		return ReS(res, {
		 susccess: true
		});		
	})
	.catch((err) => {
		return false;
	});

	// return ReS(res, {
	// 	 susccess: true
	// 	});	
	// res.json(result)
	// res.json({
 //        susccess: true        
 //    });
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

function execSqlQueryNoReturn(xquery, res) {
	console.log(xquery);
	sequelize.query(xquery, {type: sequelize.QueryTypes.UPDATE}).spread(function(results, metadata) {
  // Results will be an empty array and metadata will contain the number of affected rows.

	  	return ReS(res, {
			data: results
		});
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


function emitirRespuestaSP_RES(xquery, res) {
	console.log(xquery);
	sequelize.query(xquery, {		
		type: sequelize.QueryTypes.SELECT
	})
	.then(function (rows) {

		// convertimos en array ya que viene en object
		var arr = [];
		arr = Object.values(rows[0]) ;
		
		return ReS(res, {
			data: arr
		});
	})
	.catch((err) => {
		return ReE(res, err);
	});
}