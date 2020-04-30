const { to, ReE, ReS }  = require('../service/uitl.service');
let Sequelize = require('sequelize');
let config = require('../config');
let managerFilter = require('../utilitarios/filters');

let sequelize = new Sequelize(config.database, config.username, config.password, config.sequelizeOption);

let mysql_clean = function (string) {
        return sequelize.getQueryInterface().escape(string);
};


const setOnline = function (req, res) {  
	const idsede = managerFilter.getInfoToken(req,'idsede');
	const estado = req.body.estado;	
    const read_query = `update sede set pwa_delivery_comercio_online = ${estado} where idsede = ${idsede}`;
    emitirRespuestaSP_RES(read_query, res);        
}
module.exports.setOnline = setOnline;


const getOrdenesPedientes = function (req, res) {  
	const idsede = managerFilter.getInfoToken(req,'idsede');
	const filtro = req.body.filtro;	
    // const read_query = `call procedure_comercio_pedidos_pendientes(${idsede})`;
    const read_query = `SELECT p.*, p.pwa_delivery_tiempo_atendido as tiempo, r.nombre as nom_repartidor, r.apellido as ap_repartidor , r.telefono as telefono_repartidor
    						,r.position_now as position_now_repartidor
    						, ( 
    							SELECT
								CAST(CONCAT('[',
											GROUP_CONCAT(
												JSON_OBJECT(
													'idtipo_pago', tp.idtipo_pago,
													'descripcion', tp.descripcion
												)), ']') as json) as arritems
								FROM registro_pago_detalle AS rp
												INNER JOIN tipo_pago tp on tp.idtipo_pago= rp.idtipo_pago
											WHERE rp.idregistro_pago = p.idregistro_pago
    							) as metodoPagoRegistro
						from pedido p
						LEFT join repartidor r on p.idrepartidor=r.idrepartidor
						where p.idsede = ${idsede} and p.is_from_client_pwa=1 and p.cierre=0 and p.pwa_estado in (${filtro});`;    
    emitirRespuesta_RES(read_query, res);        
}
module.exports.getOrdenesPedientes = getOrdenesPedientes;

const getOrdenesByid = function (req, res) {  
	const idpedido = req.body.idpedido;	
    const read_query = `SELECT * from pedido where idpedido=${idpedido};`;
    emitirRespuesta_RES(read_query, res);        
}
module.exports.getOrdenesByid = getOrdenesByid;


const setEstadoPedido = function (req, res) {  	
	const estado = req.body.estado;	
	const idpedido = req.body.idpedido;
    const read_query = `update pedido set pwa_estado = '${estado}' where idpedido = ${idpedido}`;
    emitirRespuestaSP_RES(read_query, res);        
}
module.exports.setEstadoPedido = setEstadoPedido;

const setComercioConectado = function (dataCLiente) {	
    const idsede = dataCLiente.idsede;
    const socketid = dataCLiente.socketid;
    if ( idsede ) {
    	const read_query = `insert into sede_socketid (idsede, socketid, conectado) values (${idsede}, '${socketid}', '1')  ON DUPLICATE KEY UPDATE socketid = '${socketid}', conectado='1';`;
    	return emitirRespuesta(read_query);
    }    
}
module.exports.setComercioConectado = setComercioConectado;

const getSocketIdComercio = async function (idsede) {
    const read_query = `SELECT socketid from sede_socketid where idsede = ${idsede}`;
    return emitirRespuesta(read_query);        
}
module.exports.getSocketIdComercio = getSocketIdComercio;

const pushSuscripcion = async function (req) {	
	const idsede = managerFilter.getInfoToken(req,'idsede');
	const suscripcion = req.body.suscripcion;	

	const read_query = `update sede_socketid set key_suscripcion_push = '${JSON.stringify(suscripcion)}' where idsede = ${idsede}`;
	return emitirRespuesta(read_query);
}
module.exports.pushSuscripcion = pushSuscripcion;

const getComercioRepartidorSuscrito = function (req, res) {  
	const idsede = managerFilter.getInfoToken(req,'idsede');
    const read_query = `SELECT * from repartidor where idsede_suscrito = ${idsede} and estado = 0`;
    emitirRespuesta_RES(read_query, res);        
}
module.exports.getComercioRepartidorSuscrito = getComercioRepartidorSuscrito;



const getTipoComprobante = function (req, res) {  
	const idsede = managerFilter.getInfoToken(req,'idsede');
    const read_query = `SELECT tp.idtipo_comprobante, tp.descripcion, tp.codsunat, tp.inicial, tp.tipo_documento, tp.requiere_cliente
							, tps.idtipo_comprobante_serie, tps.serie, tps.correlativo
						from tipo_comprobante tp
						inner join tipo_comprobante_serie tps on tp.idtipo_comprobante = tps.idtipo_comprobante
						where tps.idsede = ${idsede} and tps.estado=0`;

	console.log(read_query);
    emitirRespuesta_RES(read_query, res);        
}
module.exports.getTipoComprobante = getTipoComprobante;


const getDatosImpresion = async function (req, res) {  
	const idsede = managerFilter.getInfoToken(req,'idsede');
    const read_query = `SELECT cp.var_size_font_tall_comanda, i.ip as ip_print, cp.num_copias, cp.pie_pagina, cp.pie_pagina_comprobante, cp.logo, '' as logo64, s.nombre AS des_sede, s.eslogan, s.mesas, s.ciudad
		, i.var_margen_iz, i.var_size_font, i.idimpresora, i.papel_size, i.img64, i.copia_local, i.local
			FROM conf_print AS cp
            	INNER JOIN sede AS s ON cp.idsede = s.idsede
            	LEFT join conf_print_otros cpo on cpo.idsede = s.idsede and cpo.idtipo_otro = -3
            	LEFT join impresora i on i.idimpresora = cpo.idimpresora
			WHERE (cp.idsede=${idsede});`;

	console.log(read_query);
    emitirRespuesta_RES(read_query, res);        
}
module.exports.getDatosImpresion = getDatosImpresion;			


const setPwaFacturado = async function (req) {	
	const idpedido = req.body.idpedido;	

	const read_query = `update pedido set pwa_facturado = 1 where idpedido = ${idpedido}`;
	return emitirRespuesta(read_query);
}
module.exports.setPwaFacturado = setPwaFacturado;


const getTiposPago = function (req, res) {
    const read_query = `SELECT * from tipo_pago WHERE idtipo_pago in (1,2,5) and estado=0`;
    emitirRespuesta_RES(read_query, res);        
}
module.exports.getTiposPago = getTiposPago;


const setRegistrarPago = function (req, res) {  
	const idsede = managerFilter.getInfoToken(req,'idsede');
	const idorg = managerFilter.getInfoToken(req,'idorg');
	const idpedido = req.body.idpedido;
	const idcliente = req.body.idcliente;
	const idtipo_pago = req.body.idtipo_pago;
	const importe_total = req.body.importe_total;
	const obj_sutotales = req.body.obj_sutotales;
    const read_query = `call procedure_pwa_registra_pago_pedido_comercio(${idorg},${idsede},${idpedido},${idcliente},${idtipo_pago},'${importe_total}', '${JSON.stringify(obj_sutotales)}')`;
    emitirRespuestaSP_RES(read_query, res);        
}
module.exports.setRegistrarPago = setRegistrarPago;

const setRepartidorToPedido = async function (req) {	
	const idrepartidor = req.body.idrepartidor;	
	const idpedido = req.body.idpedido;	

	const read_query = `update pedido set idrepartidor = ${idrepartidor} where idpedido = ${idpedido}`;
	return emitirRespuesta(read_query);
}
module.exports.setRepartidorToPedido = setRepartidorToPedido;



// registro de comercio
const getCategoriasComercio = function (req, res) {
    const read_query = `call procedure_pwa_get_all_categorias()`;
    emitirRespuestaSP_RES(read_query, res);        
}
module.exports.getCategoriasComercio = getCategoriasComercio;


const setRegistroSolicitud = function (req, res) {	
	const dateNow = new Date().toLocaleString();
	const _comercio = req.body.comercio     
    const read_query = `insert into comercio_pre_registro (fecha, nom_comercio, info) 
    										values ('${dateNow}', '${_comercio.nombre}', '${JSON.stringify(_comercio)}')`;
    emitirRespuesta_RES(read_query, res); 
}
module.exports.setRegistroSolicitud = setRegistroSolicitud;


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