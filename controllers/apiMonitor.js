const { to, ReE, ReS }  = require('../service/uitl.service');
let Sequelize = require('sequelize');
let config = require('../config');
let managerFilter = require('../utilitarios/filters');

let sequelize = new Sequelize(config.database, config.username, config.password, config.sequelizeOption);

let mysql_clean = function (string) {
        return sequelize.getQueryInterface().escape(string);
};


// registro de comercio
const getPedidos = function (req, res) {
	const fini = req.body.fromDate;
	const ffin = req.body.toDate;
    const read_query = `call procedure_pwa_delivery_monitor_pedidos('${fini}', '${ffin}', 0)`;
    emitirRespuestaSP_RES(read_query, res);        
}
module.exports.getPedidos = getPedidos;

const getPedidosAbono = function (req, res) {
	const fini = req.body.fromDate;
	const ffin = req.body.toDate;
    const read_query = `call procedure_pwa_delivery_monitor_pedidos('${fini}', '${ffin}', 1)`;
    emitirRespuestaSP_RES(read_query, res);        
}
module.exports.getPedidosAbono = getPedidosAbono;

const getRepartidores = function (req, res) {	
    const read_query = `call procedure_pwa_delivery_monitor_repartidores()`;
    emitirRespuestaSP_RES(read_query, res);        
}
module.exports.getRepartidores = getRepartidores;

const getCientes = async function (req, res) {	
    const read_query = `SELECT * from cliente where pwa_id != '' order by idcliente desc`;    
    emitirRespuesta_RES(read_query, res);  
}
module.exports.getCientes = getCientes;

const getRepartidoreCiudad = function (req, res) {	
	const codigo_postal = req.body.codigo_postal;
    const read_query = `SELECT * from repartidor where codigo_postal = '${codigo_postal}' and estado = 0 and online = 1 and COALESCE(idsede_suscrito, 0) = 0`;
    emitirRespuesta_RES(read_query, res);  
}
module.exports.getRepartidoreCiudad = getRepartidoreCiudad;


const getPedidosPendientesRepartidor = async function (req, res) {		
    const read_query = `call procedure_delivery_pedidos_pendientes()`;
    emitirRespuestaSP_RES(read_query, res);  
}
module.exports.getPedidosPendientesRepartidor = getPedidosPendientesRepartidor;

const setResetRepartidor = async function (req, res) {
	const idrepartidor = req.body.idrepartidor;
	const read_query = `update repartidor set pedidos_reasignados = 0 where idrepartidor = ${idrepartidor};`;
    execSqlQueryNoReturn(read_query, res);       
}
module.exports.setResetRepartidor = setResetRepartidor;


const setLiberarRepartidor = function (req, res) {  
	const idrepartidor = req.body.idrepartidor;
    const read_query = `update repartidor set ocupado = 0, flag_paso_pedido = 0, pedido_por_aceptar = null, solicita_liberar_pedido=0 where idrepartidor = ${idrepartidor};`;
    execSqlQueryNoReturn(read_query, res);     
}
module.exports.setLiberarRepartidor = setLiberarRepartidor;

const setCheckLiquidado = function (req, res) {  
	const idpedido = req.body.idpedido;
    const read_query = `update pedido set check_liquidado = '1' where idpedido  = ${idpedido};`;
    execSqlQueryNoReturn(read_query, res);     
}
module.exports.setCheckLiquidado = setCheckLiquidado;

const setCheckAbonado = function (req, res) {  
	const idpedido = req.body.idpedido;
    const read_query = `update pedido set check_pagado = '1', check_pago_fecha = now() where idpedido = ${idpedido};`;
    execSqlQueryNoReturn(read_query, res);     
}
module.exports.setCheckAbonado = setCheckAbonado;

const setCheckAbonadoRepartidor = function (req, res) {
	const idpedido = req.body.idpedido;
    const read_query = `update pedido set check_pago_repartidor = '1' where idpedido = ${idpedido};`;
    execSqlQueryNoReturn(read_query, res);     
}
module.exports.setCheckAbonadoRepartidor = setCheckAbonadoRepartidor;

const setAsignarPedidoManual = function (req, res) {
	const dataPedido = req.body.pedido;
    
    const read_query = `call procedure_delivery_set_pedido_repartidor_manual('${JSON.stringify(dataPedido)}')`;
    emitirRespuestaSP_RES(read_query, res);  
}
module.exports.setAsignarPedidoManual = setAsignarPedidoManual;

const setRegistraPagoComercio = function (req, res) {
	const dataRegistro = req.body.registro;
    
    const read_query = `call procedure_monitor_registro_pago_comercio('${JSON.stringify(dataRegistro)}')`;
    emitirRespuestaSP_RES(read_query, res);  
}
module.exports.setRegistraPagoComercio = setRegistraPagoComercio;


const getComerciosResumen = function (req, res) {		
    const read_query = `call procedure_monitor_comercios()`;
    emitirRespuestaSP_RES(read_query, res);        
}
module.exports.getComerciosResumen = getComerciosResumen;

const getComercioCalcularPago = function (req, res) {	
	const desde = req.body.desde;
	const hasta = req.body.hasta;
	const idsede = req.body.idsede;		
    const read_query = `call procedure_monitor_comercios_caluclar('${desde}', '${hasta}', ${idsede})`;
    emitirRespuestaSP_RES(read_query, res);        
}
module.exports.getComercioCalcularPago = getComercioCalcularPago;

const setHistorialPagoComercio = function (req, res) {	
	const idsede = req.body.idsede;
    const read_query = `SELECT * from sede_detalle_pago where idsede = '${idsede}'`;
    emitirRespuesta_RES(read_query, res);  
}
module.exports.setHistorialPagoComercio = setHistorialPagoComercio;

const getComerciosAfiliados = function (req, res) {		
    const read_query = `SELECT * from sede where pwa_comercio_afiliado = 1 and estado = 0`;
    emitirRespuesta_RES(read_query, res);  
}
module.exports.getComerciosAfiliados = getComerciosAfiliados;

const getRepartidoresConectados = function (req, res) {		
    const read_query = `select * from repartidor where COALESCE(idsede_suscrito, 0) = 0 and online=1 and estado=0`;
    emitirRespuesta_RES(read_query, res);  
}
module.exports.getRepartidoresConectados = getRepartidoresConectados;

const getRepartidoresPedidosAceptados = function (req, res) {		
    const read_query = `SELECT p.* from pedido p
			inner join repartidor r on r.idrepartidor = p.idrepartidor
			where  REPLACE(REPLACE(cast(pedido_por_aceptar->>'$.pedidos' as CHAR(200)), '[', ''), ']', '') LIKE concat('%',cast(idpedido as char(5)),'%')
			and COALESCE(r.idsede_suscrito, 0) = 0 and r.online=1 and r.estado=0`;
    emitirRespuesta_RES(read_query, res);  
}
module.exports.getRepartidoresPedidosAceptados = getRepartidoresPedidosAceptados;

const setSedeInfo = function (req, res) {
	const registro = req.body.registro;
    const read_query = `update sede set comsion_entrega = ${registro.comision}, costo_restobar_fijo_mensual='${registro.restobar}' where idsede=${registro.idsede}`;
    execSqlQueryNoReturn(read_query, res);     
}
module.exports.setSedeInfo = setSedeInfo;

const getAllPedidosComercio = function (req, res) {		
	const idsede = req.body.idsede;
	const fdesde = req.body.desde;
	const fhasta = req.body.hasta;
    const read_query = `SELECT * from pedido where idsede = ${idsede} and  STR_TO_DATE(fecha, '%d/%m/%Y') BETWEEN STR_TO_DATE('${fdesde}', '%d/%m/%Y') and STR_TO_DATE('${fhasta}', '%d/%m/%Y') and pwa_is_delivery = 1`;
    emitirRespuesta_RES(read_query, res);  
}
module.exports.getAllPedidosComercio = getAllPedidosComercio;


const getAllSedes = function (req, res) {		
    const read_query = `SELECT * from sede where estado = 0 order by ciudad, nombre`;
    emitirRespuesta_RES(read_query, res);  
}
module.exports.getAllSedes = getAllSedes;



function execSqlQueryNoReturn(xquery, res) {
	console.log(xquery);
	sequelize.query(xquery, {type: sequelize.QueryTypes.UPDATE}).spread(function(results, metadata) {
  // Results will be an empty array and metadata will contain the number of affected rows.

	  	return ReS(res, {
			data: results
		});
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