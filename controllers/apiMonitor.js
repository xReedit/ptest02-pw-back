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

const getAllDescuentosSede = function (req, res) {		
	const idsede = req.body.idsede;
    const read_query = `SELECT idsede_descuento, descripcion, f_desde, f_fin, numero_pedidos, if ( STR_TO_DATE(f_fin, '%d/%m/%Y %H:%i:%s') > now(), 1 , 0 ) activo  from sede_descuento where idsede = ${idsede} and estado = 0;`;
    emitirRespuesta_RES(read_query, res);  
}
module.exports.getAllDescuentosSede = getAllDescuentosSede;

const getItemDescuentosSede = function (req, res) {		
	const idsede_descuento = req.body.idsede_descuento;
    const read_query = `SELECT * from sede_descuento_detalle where idsede_descuento = ${idsede_descuento}`;
    emitirRespuesta_RES(read_query, res);  
}
module.exports.getItemDescuentosSede = getItemDescuentosSede;

const deleteItemDescuentosSede = function (req, res) {		
	const idsede_descuento = req.body.idsede_descuento;    
    const read_query = `update sede_descuento set estado = 1 where idsede_descuento = ${idsede_descuento}`;
    execSqlQueryNoReturn(read_query, res);  
}
module.exports.deleteItemDescuentosSede = deleteItemDescuentosSede;

const getAllSedesServiceExpress = function (req, res) {		
	// const idsede_descuento = req.body.idsede_descuento;
    const read_query = `SELECT * from sede_config_service_delivery where estado = 0`;
    emitirRespuesta_RES(read_query, res);  
}
module.exports.getAllSedesServiceExpress = getAllSedesServiceExpress;

const getTablaPrecipitacion = function (req, res) {		
	// const idsede_descuento = req.body.idsede_descuento;
    const read_query = `SELECT * from comision_intensidad_lluvia where estado = 0`;
    emitirRespuesta_RES(read_query, res);  
}
module.exports.getTablaPrecipitacion = getTablaPrecipitacion;

const setImporteComisionLluvia = function (req, res) {	
	const idsede_config_service_delivery = req.body.idsede_config_service_delivery;    
	const costo_show = req.body.clima_comision.costo_show;    
	const costo_x_km_adicional_show = req.body.clima_comision.costo_x_km_adicional_show;    
	const isRain = req.body.clima_comision.isRain;    
    const read_query = `update sede_config_service_delivery set c_minimo = ${costo_show}, c_km=${costo_x_km_adicional_show}, is_rain=${isRain} where idsede_config_service_delivery = ${idsede_config_service_delivery}`;
    execSqlQueryNoReturn(read_query, res);  
}
module.exports.setImporteComisionLluvia = setImporteComisionLluvia;


const getAplicaA = async function (req, res) {
	const aplica = req.body.op;
	const idsede = req.body.idsede;
	let read_query = '';

	switch (aplica) {
      case 0:
      	read_query = `SELECT concat(s.descripcion, ' | ',  i.descripcion) descripcion, i.iditem as id 
					from item i 
						inner join carta_lista cl on cl.iditem = i.iditem
						inner join seccion s on s.idseccion = cl.idseccion
					where i.idsede=${idsede} and i.estado=0 order by i.descripcion`;
        break;
      case 1:
      	read_query = `SELECT descripcion, idseccion as id from seccion where idsede=${idsede} and estado=0 order by descripcion`;
        break;
      case 2:
      	read_query = `SELECT concat(pf.descripcion,' | ', p.descripcion) descripcion, p.idproducto as id from producto p inner join producto_familia pf on pf.idproducto_familia = p.idproducto_familia where p.idsede=${idsede} and p.estado=0 order by pf.descripcion, p.descripcion`;
        break;
      case 3:
      	read_query = `SELECT descripcion, idproducto_familia as id from producto_familia where idsede = ${idsede} and estado=0 order by descripcion`;
        break;
    }	
    emitirRespuesta_RES(read_query, res);        
}
module.exports.getAplicaA = getAplicaA;

const setRegistrarDescuento = function (req, res) {	
	const obj = req.body.obj;	
    const read_query = `call procedure_app_descuentos('${JSON.stringify(obj)}')`;
    emitirRespuestaSP_RES(read_query, res);        
}
module.exports.setRegistrarDescuento = setRegistrarDescuento;

const setOptionPlaza = function (req, res) {	
	const obj = req.body.obj;	
    const read_query = `call procedure_monitor_set_option_plaza('${JSON.stringify(obj)}')`;
    emitirRespuestaSP_RES(read_query, res);        
}
module.exports.setOptionPlaza = setOptionPlaza;



const getPedidosMandados = function (req, res) {		
	const fini = req.body.fromDate;
	const ffin = req.body.toDate;
    const read_query = `SELECT pm.*, c.nombres nom_cliente, c.f_registro, c.ruc, c.telefono,c.calificacion, TIMESTAMPDIFF(MINUTE, pm.fecha_hora, now()) min_transcurridos
    		, r.nombre as nom_repartidor, r.telefono as telefono_repartidor
			from pedido_mandado pm
				inner join cliente c on c.idcliente = pm.pedido_json->>'$.idcliente'
				LEFT join repartidor r on r.idrepartidor = pm.idrepartidor
			where cast(pm.fecha_hora as date) BETWEEN cast('${fini}' as date) and cast('${ffin}' as date)`;
    emitirRespuesta_RES(read_query, res);  
}
module.exports.getPedidosMandados = getPedidosMandados;

// calificacion de parte del cliente
const getCalificacionComercio = function (req, res) {	
    const read_query = `SELECT * , sc.calificacion calificacion_cliente, s.nombre nom_sede, s.ciudad ciudad_sede, s.direccion dir_sede
		from sede_calificacion sc
			inner join sede s on s.idsede = sc.idsede
			inner join cliente c on c.idcliente = sc.idcliente
			inner join pedido p on p.idpedido = sc.idpedido
			left join repartidor r on r.idrepartidor = p.idrepartidor
		order by sc.idsede_calificacion desc`;
    emitirRespuesta_RES(read_query, res); 
}
module.exports.getCalificacionComercio = getCalificacionComercio;

const setOnComercio = function (req, res) {		
	const idsede = req.body.idsede;    
	const estado = req.body.estado;    
    const read_query = `update sede set pwa_delivery_comercio_online = ${estado} where idsede = ${idsede}`;
    execSqlQueryNoReturn(read_query, res);  
}
module.exports.setOnComercio = setOnComercio;





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