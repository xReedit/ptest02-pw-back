const { to, ReE, ReS }  = require('../service/uitl.service');
let Sequelize = require('sequelize');
// let config = require('../config');
let config = require('../_config');
let managerFilter = require('../utilitarios/filters');
let apiFireBase = require('../controllers/apiFireBase');
let logger = require('../utilitarios/logger');

const serviceTimerChangeCosto = require('./timerChangeCosto.js');

// ✅ IMPORTANTE: Usar instancia centralizada de Sequelize
const { sequelize, QueryTypes } = require('../config/database');

let mysql_clean = function (string) {
        return sequelize.getQueryInterface().escape(string);
};

// primer idpedido de la fecha seleccionada
const getFirtsIdPedidoDate = async function (req, res) {
	const fini = req.body.fromDate;
	// ✅ SEGURO: Prepared statement
    const read_query = `CALL procedure_monitor_min_pedido_day(?)`;
    const rows = await sequelize.query(read_query, {
        replacements: [fini],
        type: QueryTypes.SELECT
    });
    const arr = Object.values(rows[0]);
    return ReS(res, { data: arr });
}
module.exports.getFirtsIdPedidoDate = getFirtsIdPedidoDate;


// registro de comercio
const getPedidos = async function (req, res) {
	const fini = req.body.fromDate;
	const ffin = req.body.toDate;
	const firtsIdPedidoDate = req.body.firtsIdPedidoDate;
	// ✅ SEGURO: Prepared statement
    const read_query = `CALL procedure_pwa_delivery_monitor_pedidos(?, ?, 0, ?)`;
    const rows = await sequelize.query(read_query, {
        replacements: [fini, ffin, firtsIdPedidoDate],
        type: QueryTypes.SELECT
    });
    const arr = Object.values(rows[0]);
    return ReS(res, { data: arr });
}
module.exports.getPedidos = getPedidos;

const getPedidosAbono = async function (req, res) {
	const fini = req.body.fromDate;
	const ffin = req.body.toDate;
	const firtsIdPedidoDate = req.body.firtsIdPedidoDate;
	// ✅ SEGURO: Prepared statement
    const read_query = `CALL procedure_pwa_delivery_monitor_pedidos(?, ?, 1, ?)`;
    const rows = await sequelize.query(read_query, {
        replacements: [fini, ffin, firtsIdPedidoDate],
        type: QueryTypes.SELECT
    });
    const arr = Object.values(rows[0]);
    return ReS(res, { data: arr });
}
module.exports.getPedidosAbono = getPedidosAbono;

const getRepartidores = function (req, res) {	
    const read_query = `call procedure_pwa_delivery_monitor_repartidores()`;
    emitirRespuestaSP_RES(read_query, res);        
}
module.exports.getRepartidores = getRepartidores;

const getCientesScanQr = async function (req, res) {
	const op = req.body.fromDate.toString === "0" ? 0 : 1;
    const fini = req.body.fromDate || '';
	const ffin = req.body.toDate || '';
	// ✅ SEGURO: Prepared statement
    const read_query = `CALL procedure_pwa_delivery_monitor_get_scan_qr(?, ?, ?)`;
    const rows = await sequelize.query(read_query, {
        replacements: [fini, ffin, op],
        type: QueryTypes.SELECT
    });
    const arr = Object.values(rows[0]);
    return ReS(res, { data: arr });
}
module.exports.getCientesScanQr = getCientesScanQr;

const getCientes = async function (req, res) {	
    const read_query = `SELECT * from cliente where pwa_id != '' order by idcliente desc limit 100`;    
    emitirRespuesta_RES(read_query, res);  
}
module.exports.getCientes = getCientes;

const getRepartidoreCiudad = async function (req, res) {
	const codigo_postal = req.body.codigo_postal;
	// ✅ SEGURO: Prepared statement
    const read_query = `SELECT * FROM repartidor WHERE idrepartidor=1 OR codigo_postal = ? AND estado = 0 AND online = 1 AND COALESCE(idsede_suscrito, 0) = 0`;
    const rows = await sequelize.query(read_query, {
        replacements: [codigo_postal],
        type: QueryTypes.SELECT
    });
    return ReS(res, { data: rows });
}
module.exports.getRepartidoreCiudad = getRepartidoreCiudad;


const getPedidosPendientesRepartidor = async function (req, res) {		
    const read_query = `call procedure_delivery_pedidos_pendientes()`;
    emitirRespuestaSP_RES(read_query, res);  
}
module.exports.getPedidosPendientesRepartidor = getPedidosPendientesRepartidor;

const setResetRepartidor = async function (req, res) {
	const idrepartidor = req.body.idrepartidor;
	// ✅ SEGURO: Prepared statement
	const read_query = `UPDATE repartidor SET pedidos_reasignados = 0 WHERE idrepartidor = ?`;
    await sequelize.query(read_query, {
        replacements: [idrepartidor],
        type: QueryTypes.UPDATE
    });
    return ReS(res, { data: true });
}
module.exports.setResetRepartidor = setResetRepartidor;


const setLiberarRepartidor = async function (req, res) {
	const idrepartidor = req.body.idrepartidor;
	// ✅ SEGURO: Prepared statement
    const read_query = `UPDATE repartidor SET ocupado = 0, flag_paso_pedido = 0, pedido_por_aceptar = null, solicita_liberar_pedido=0 WHERE idrepartidor = ?`;
    await sequelize.query(read_query, {
        replacements: [idrepartidor],
        type: QueryTypes.UPDATE
    });
    return ReS(res, { data: true });
}
module.exports.setLiberarRepartidor = setLiberarRepartidor;

const setCheckLiquidado = async function (req, res) {
	const idpedido = req.body.idpedido;
	// ✅ SEGURO: Prepared statement
    const read_query = `UPDATE pedido SET check_liquidado = '1' WHERE idpedido = ?`;
    await sequelize.query(read_query, {
        replacements: [idpedido],
        type: QueryTypes.UPDATE
    });
    return ReS(res, { data: true });
}
module.exports.setCheckLiquidado = setCheckLiquidado;

const setCheckAbonado = async function (req, res) {
	const idpedido = req.body.idpedido;
    const idtransaccion = req.body.idpwa_pago_transaction;
	// ✅ SEGURO: 2 queries separados con prepared statements
    await sequelize.query(
        `UPDATE pedido SET check_pagado = '1', check_pago_fecha = now() WHERE idpedido = ?`,
        { replacements: [idpedido], type: QueryTypes.UPDATE }
    );
    await sequelize.query(
        `UPDATE pwa_pago_transaction SET abonado = 1 WHERE idpwa_pago_transaction = ?`,
        { replacements: [idtransaccion], type: QueryTypes.UPDATE }
    );
    return ReS(res, { data: true });
}
module.exports.setCheckAbonado = setCheckAbonado;

const setCheckAbonadoRepartidor = async function (req, res) {
	const idpedido = req.body.idpedido;
	// ✅ SEGURO: Prepared statement
    const read_query = `UPDATE pedido SET check_pago_repartidor = '1' WHERE idpedido = ?`;
    await sequelize.query(read_query, {
        replacements: [idpedido],
        type: QueryTypes.UPDATE
    });
    return ReS(res, { data: true });
}
module.exports.setCheckAbonadoRepartidor = setCheckAbonadoRepartidor;

const setAsignarPedidoManual = async function (req, res) {
	const dataPedido = req.body.pedido;
    
	// ✅ SEGURO: Prepared statement
    const read_query = `CALL procedure_delivery_set_pedido_repartidor_manual(?)`;
    const rows = await sequelize.query(read_query, {
        replacements: [JSON.stringify(dataPedido)],
        type: QueryTypes.SELECT
    });
    
    // en firebase se actualiza el repartidor 0524
    // activar luego
    // apiFireBase.updateIdPedidosRepartidor(dataPedido.idrepartidor, dataPedido.pedido_asignado_manual);

    const arr = Object.values(rows[0]);
    return ReS(res, { data: arr });
}
module.exports.setAsignarPedidoManual = setAsignarPedidoManual;

const setRegistraPagoComercio = async function (req, res) {
	const dataRegistro = req.body.registro;
    
	// ✅ SEGURO: Prepared statement
    const read_query = `CALL procedure_monitor_registro_pago_comercio(?)`;
    const rows = await sequelize.query(read_query, {
        replacements: [JSON.stringify(dataRegistro)],
        type: QueryTypes.SELECT
    });
    const arr = Object.values(rows[0]);
    return ReS(res, { data: arr });
}
module.exports.setRegistraPagoComercio = setRegistraPagoComercio;


const getComerciosResumen = function (req, res) {		
    const read_query = `call procedure_monitor_comercios()`;
    emitirRespuestaSP_RES(read_query, res);        
}
module.exports.getComerciosResumen = getComerciosResumen;

const getComercioCalcularPago = async function (req, res) {
	const desde = req.body.desde;
	const hasta = req.body.hasta;
	const idsede = req.body.idsede;
	// ✅ SEGURO: Prepared statement
    const read_query = `CALL procedure_monitor_comercios_caluclar(?, ?, ?)`;
    const rows = await sequelize.query(read_query, {
        replacements: [desde, hasta, idsede],
        type: QueryTypes.SELECT
    });
    const arr = Object.values(rows[0]);
    return ReS(res, { data: arr });
}
module.exports.getComercioCalcularPago = getComercioCalcularPago;

const setHistorialPagoComercio = async function (req, res) {
	const idsede = req.body.idsede;
	// ✅ SEGURO: Prepared statement
    const read_query = `SELECT * FROM sede_detalle_pago WHERE idsede = ?`;
    const rows = await sequelize.query(read_query, {
        replacements: [idsede],
        type: QueryTypes.SELECT
    });
    return ReS(res, { data: rows });
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

const setSedeInfo = async function (req, res) {
	const registro = req.body.registro;
	// ✅ SEGURO: Prepared statement
    const read_query = `UPDATE sede SET comsion_entrega = ?, costo_restobar_fijo_mensual=? WHERE idsede=?`;
    await sequelize.query(read_query, {
        replacements: [registro.comision, registro.restobar, registro.idsede],
        type: QueryTypes.UPDATE
    });
    return ReS(res, { data: true });
}
module.exports.setSedeInfo = setSedeInfo;

const getAllPedidosComercio = async function (req, res) {
	const idsede = req.body.idsede;
	const fdesde = req.body.desde;
	const fhasta = req.body.hasta;
	// ✅ SEGURO: Prepared statement
    const read_query = `
    	SELECT p.*, r.nombre as nom_repartidor, r.telefono as telefono_repartidor 
		FROM pedido p
			LEFT JOIN repartidor r ON r.idrepartidor = p.idrepartidor 
		WHERE p.idsede = ? AND STR_TO_DATE(p.fecha, '%d/%m/%Y') BETWEEN STR_TO_DATE(?, '%d/%m/%Y') AND STR_TO_DATE(?, '%d/%m/%Y') AND p.pwa_is_delivery = 1`;
    const rows = await sequelize.query(read_query, {
        replacements: [idsede, fdesde, fhasta],
        type: QueryTypes.SELECT
    });
    return ReS(res, { data: rows });
}
module.exports.getAllPedidosComercio = getAllPedidosComercio;


const getAllSedes = function (req, res) {		
    const read_query = `SELECT * from sede where estado = 0 order by ciudad, nombre`;
    emitirRespuesta_RES(read_query, res);  
}
module.exports.getAllSedes = getAllSedes;

const getAllDescuentosSede = async function (req, res) {
	const idsede = req.body.idsede;
	// ✅ SEGURO: Prepared statement
    const read_query = `SELECT idsede_descuento, descripcion, f_desde, f_fin, numero_pedidos, IF(STR_TO_DATE(f_fin, '%d/%m/%Y %H:%i:%s') > now(), 1, 0) activo FROM sede_descuento WHERE idsede = ? AND estado = 0`;
    const rows = await sequelize.query(read_query, {
        replacements: [idsede],
        type: QueryTypes.SELECT
    });
    return ReS(res, { data: rows });
}
module.exports.getAllDescuentosSede = getAllDescuentosSede;

const getItemDescuentosSede = async function (req, res) {
	const idsede_descuento = req.body.idsede_descuento;
	// ✅ SEGURO: Prepared statement
    const read_query = `SELECT * FROM sede_descuento_detalle WHERE idsede_descuento = ?`;
    const rows = await sequelize.query(read_query, {
        replacements: [idsede_descuento],
        type: QueryTypes.SELECT
    });
    return ReS(res, { data: rows });
}
module.exports.getItemDescuentosSede = getItemDescuentosSede;

const deleteItemDescuentosSede = async function (req, res) {
	const idsede_descuento = req.body.idsede_descuento;
	// ✅ SEGURO: Prepared statement
    const read_query = `UPDATE sede_descuento SET estado = 1 WHERE idsede_descuento = ?`;
    await sequelize.query(read_query, {
        replacements: [idsede_descuento],
        type: QueryTypes.UPDATE
    });
    return ReS(res, { data: true });
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

const setImporteComisionLluvia = async function (req, res) {
	const idsede_config_service_delivery = req.body.idsede_config_service_delivery;
	const costo_show = req.body.clima_comision.costo_show;
	const costo_x_km_adicional_show = req.body.clima_comision.costo_x_km_adicional_show;
	const isRain = req.body.clima_comision.isRain;
	// ✅ SEGURO: Prepared statement
    const read_query = `UPDATE sede_config_service_delivery SET c_minimo = ?, c_km=?, is_rain=? WHERE idsede_config_service_delivery = ?`;
    await sequelize.query(read_query, {
        replacements: [costo_show, costo_x_km_adicional_show, isRain, idsede_config_service_delivery],
        type: QueryTypes.UPDATE
    });
    return ReS(res, { data: true });
}
module.exports.setImporteComisionLluvia = setImporteComisionLluvia;

// datos al inicio despues de escanear codigo
const getDataSedeInfoFacById = async function (req, res) {
    const idsede = req.body.idsede;
	// ✅ SEGURO: Prepared statement
    const read_query = `SELECT s.idsede, s.idorg, o.nombre, o.ruc, o.direccion, s.ciudad, o.tipo_contribuyente 
                FROM sede s
                    INNER JOIN org o ON o.idorg = s.idorg
                WHERE s.idsede=? AND s.estado=0`;
    const rows = await sequelize.query(read_query, {
        replacements: [idsede],
        type: QueryTypes.SELECT
    });
    return ReS(res, { data: rows });
}
module.exports.getDataSedeInfoFacById = getDataSedeInfoFacById;


const getAplicaA = async function (req, res) {
	const aplica = req.body.op;
	const idsede = req.body.idsede;
	let read_query = '';

	// ✅ SEGURO: Prepared statement para cada caso
	switch (aplica) {
      case 0:
      	read_query = `SELECT CONCAT(s.descripcion, ' | ', i.descripcion) descripcion, i.iditem as id 
					FROM item i 
						INNER JOIN carta_lista cl ON cl.iditem = i.iditem
						INNER JOIN seccion s ON s.idseccion = cl.idseccion
					WHERE i.idsede=? AND i.estado=0 ORDER BY i.descripcion`;
        break;
      case 1:
      	read_query = `SELECT descripcion, idseccion as id FROM seccion WHERE idsede=? AND estado=0 ORDER BY descripcion`;
        break;
      case 2:
      	read_query = `SELECT CONCAT(pf.descripcion,' | ', p.descripcion) descripcion, p.idproducto as id FROM producto p INNER JOIN producto_familia pf ON pf.idproducto_familia = p.idproducto_familia WHERE p.idsede=? AND p.estado=0 ORDER BY pf.descripcion, p.descripcion`;
        break;
      case 3:
      	read_query = `SELECT descripcion, idproducto_familia as id FROM producto_familia WHERE idsede = ? AND estado=0 ORDER BY descripcion`;
        break;
    }
    const rows = await sequelize.query(read_query, {
        replacements: [idsede],
        type: QueryTypes.SELECT
    });
    return ReS(res, { data: rows });
}
module.exports.getAplicaA = getAplicaA;

const setRegistrarDescuento = async function (req, res) {
	const obj = req.body.obj;
	// ✅ SEGURO: Prepared statement
    const read_query = `CALL procedure_app_descuentos(?)`;
    const rows = await sequelize.query(read_query, {
        replacements: [JSON.stringify(obj)],
        type: QueryTypes.SELECT
    });
    const arr = Object.values(rows[0]);
    return ReS(res, { data: arr });
}
module.exports.setRegistrarDescuento = setRegistrarDescuento;

const setOptionPlaza = async function (req, res) {
	const obj = req.body.obj;
	// ✅ SEGURO: Prepared statement
    const read_query = `CALL procedure_monitor_set_option_plaza(?)`;
    const rows = await sequelize.query(read_query, {
        replacements: [JSON.stringify(obj)],
        type: QueryTypes.SELECT
    });
    const arr = Object.values(rows[0]);
    return ReS(res, { data: arr });
}
module.exports.setOptionPlaza = setOptionPlaza;



const getPedidosMandados = async function (req, res) {
	const fini = req.body.fromDate;
	const ffin = req.body.toDate;
	// ✅ SEGURO: Prepared statement
    const read_query = `SELECT pm.*, c.nombres nom_cliente, c.f_registro, c.ruc, c.telefono,c.calificacion, TIMESTAMPDIFF(MINUTE, pm.fecha_hora, now()) min_transcurridos
    		, r.nombre as nom_repartidor, r.telefono as telefono_repartidor
			FROM pedido_mandado pm
				INNER JOIN cliente c ON c.idcliente = pm.pedido_json->>'$.idcliente'
				LEFT JOIN repartidor r ON r.idrepartidor = pm.idrepartidor
			WHERE CAST(pm.fecha_hora as date) BETWEEN CAST(? as date) AND CAST(? as date)`;
    const rows = await sequelize.query(read_query, {
        replacements: [fini, ffin],
        type: QueryTypes.SELECT
    });
    return ReS(res, { data: rows });
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

const setOnComercio = async function (req, res) {
	const idsede = req.body.idsede;
	const estado = req.body.estado;
	// ✅ SEGURO: Prepared statement
    const read_query = `UPDATE sede SET pwa_delivery_comercio_online = ? WHERE idsede = ?`;
    await sequelize.query(read_query, {
        replacements: [estado, idsede],
        type: QueryTypes.UPDATE
    });
    return ReS(res, { data: true });
}
module.exports.setOnComercio = setOnComercio;

const getRetirosCashAtm = async function (req, res) {
	const fini = req.body.fromDate;
	const ffin = req.body.toDate;
	// ✅ SEGURO: Prepared statement
    const read_query = `SELECT *, DATE_FORMAT(fecha_hora_registro, "%d/%m/%Y %H:%m:%i") fecha_hora, TIMESTAMPDIFF(MINUTE, fecha_hora_registro, now()) as min_transcurridos,r.nombre nom_repartidor FROM atm_retiros a LEFT JOIN repartidor r ON a.idrepartidor = r.idrepartidor WHERE CAST(fecha_hora_registro as date) BETWEEN CAST(? as date) AND CAST(? as date) ORDER BY idatm_retiros desc`;
    const rows = await sequelize.query(read_query, {
        replacements: [fini, ffin],
        type: QueryTypes.SELECT
    });
    return ReS(res, { data: rows });
}
module.exports.getRetirosCashAtm = getRetirosCashAtm;


const setPedidoNoAntendido = async function (req, res) {
	const idpedido = req.body.idpedido;
    const idpwa_pago_transaction = req.body.idpwa_pago_transaction;
	// ✅ SEGURO: 2 queries separados con prepared statements
    await sequelize.query(
        `UPDATE pedido SET pwa_delivery_atendido = 1 WHERE idpedido = ?`,
        { replacements: [idpedido], type: QueryTypes.UPDATE }
    );
    if (idpwa_pago_transaction) {
        await sequelize.query(
            `UPDATE pwa_pago_transaction SET anulado = 1 WHERE idpwa_pago_transaction = ?`,
            { replacements: [idpwa_pago_transaction], type: QueryTypes.UPDATE }
        );
    }
    return ReS(res, { data: true });
}
module.exports.setPedidoNoAntendido = setPedidoNoAntendido;


const getlistProgramations = function (req, res) {	
	const fini = req.body.fromDate;
	const ffin = req.body.toDate;
    const read_query = `SELECT * from sede_config_service_delivery`;
    emitirRespuesta_RES(read_query, res);        
}
module.exports.getlistProgramations = getlistProgramations;


const getComisionesVisaCalc = function (req, res) {  
    const read_query = `SELECT * from comisiones_visa`;
    emitirRespuesta_RES(read_query, res);        
}
module.exports.getComisionesVisaCalc = getComisionesVisaCalc;


const runTimerChangeCosto = function (req, res) {	
    
	_list = req.body.list;
	serviceTimerChangeCosto.setChangeCosto(_list);
}
module.exports.runTimerChangeCosto = runTimerChangeCosto;


const getPendientesConfirmacionPagoServicio = function (req, res) {      
    const read_query = `select spc.*, s.nombre, s.nombre nombres, s.ciudad, cp.banco, if(spc.ispago_tarjeta = 0, 'Deposito', 'Tarjeta') tipo_pago, spco.descripcion plan, spco.idsede_plan_contratado 
                    from sede_pago_confirmacion spc 
                        inner join sede s on s.idsede = spc.idsede 
                        inner join cuenta_papaya cp ON cp.idcuenta_papaya = spc.idcuenta_papaya 
                        inner join sede_plan_contratado spco on spco.idsede_plan_contratado = s.idsede_plan_contratado 
                    order by spc.idsede_pago_confirmacion desc limit 50`;
    emitirRespuesta_RES(read_query, res);        
}
module.exports.getPendientesConfirmacionPagoServicio = getPendientesConfirmacionPagoServicio;


const getInfoSedeFacturacionById = async function (req, res) {
    const ruc = req.body.ruc;
	// ✅ SEGURO: Prepared statement
    const read_query = `SELECT s.* FROM sede s INNER JOIN org o ON o.idorg = s.idorg WHERE o.ruc = ?`;
    const rows = await sequelize.query(read_query, {
        replacements: [ruc],
        type: QueryTypes.SELECT
    });
    return ReS(res, { data: rows });
}
module.exports.getInfoSedeFacturacionById = getInfoSedeFacturacionById;


const setFacturaConfirmarPagoServicio = async function (req, res) {
    const idconfirmacion = req.body.idconfirmacion;
    const external_id = req.body.external_id;
	// ✅ SEGURO: Prepared statement
    const read_query = `UPDATE sede_pago_confirmacion SET external_id = ?, confirmado=1 WHERE idsede_pago_confirmacion = ?`;
    await sequelize.query(read_query, {
        replacements: [external_id, idconfirmacion],
        type: QueryTypes.UPDATE
    });
    return ReS(res, { data: true });
}
module.exports.setFacturaConfirmarPagoServicio = setFacturaConfirmarPagoServicio;

const setAnularPagoServicio = async function (req, res) {
    const umf_pago = req.body.umf_pago;
    const idsede = req.body.idsede;
    const idsede_pago_confirmacion = req.body.idsede_pago_confirmacion;
	// ✅ SEGURO: 2 queries separados con prepared statements
    await sequelize.query(
        `UPDATE sede SET umf_pago = ? WHERE idsede = ?`,
        { replacements: [umf_pago, idsede], type: QueryTypes.UPDATE }
    );
    await sequelize.query(
        `UPDATE sede_pago_confirmacion SET no_confirmado = 1 WHERE idsede_pago_confirmacion = ?`,
        { replacements: [idsede_pago_confirmacion], type: QueryTypes.UPDATE }
    );
    return ReS(res, { data: true });
}
module.exports.setAnularPagoServicio = setAnularPagoServicio;


const getShowPedidosAsignadosRepartidor = async function (req, res) {
    const arrPedidos = req.body.arr;
	// ✅ SEGURO: Prepared statement
    const read_query = `SELECT p1.idpedido, ptle.time_line, p1.json_datos_delivery->'$.p_header.arrDatosDelivery.establecimiento.nombre' establecimiento
                            ,TIMESTAMPDIFF(MINUTE, p1.fecha_hora, now()) t_transcurrido
                            ,p1.pwa_estado, p1.pwa_delivery_tiempo_atendido,p1.flag_is_cliente
                        FROM pedido p1
                        LEFT JOIN pedido_time_line_entrega ptle ON ptle.idpedido = p1.idpedido 
                        WHERE p1.idpedido IN (?)`;
    const rows = await sequelize.query(read_query, {
        replacements: [arrPedidos],
        type: QueryTypes.SELECT
    });
    return ReS(res, { data: rows });
}
module.exports.getShowPedidosAsignadosRepartidor = getShowPedidosAsignadosRepartidor;

const getPedidoById = async function (req, res) {
    const idpedido = req.body.idpedido;
	// ✅ SEGURO: Prepared statement
    const read_query = `SELECT p.*, r.nombre as nom_repartidor, r.telefono telefono_repartidor FROM pedido p
LEFT JOIN repartidor r ON p.idrepartidor = r.idrepartidor 
WHERE p.idpedido=?`;
    const rows = await sequelize.query(read_query, {
        replacements: [idpedido],
        type: QueryTypes.SELECT
    });
    return ReS(res, { data: rows });
}
module.exports.getPedidoById = getPedidoById;



function execSqlQueryNoReturn(xquery, res) {
	sequelize.query(xquery, {type: QueryTypes.UPDATE}).spread(function(results, metadata) {
	  	return ReS(res, {
			data: results
		});
	});
}






async function emitirRespuesta(xquery, res) {
    try {		
		const queryType = xquery.trim().toLowerCase().startsWith('update') ? QueryTypes.UPDATE : QueryTypes.SELECT;
        const results = await sequelize.query(xquery, { type: queryType });
        //si es update retornar ok
        if (queryType === QueryTypes.UPDATE) {
            return ReS(res, {
                data: 'ok'
            });
        } else {
            return ReS(res, {
                data: results
            });
        }
    } catch (err) {
        logger.error(err);
        return ReE(res, err);
    }    
	// return sequelize.query(xquery, {type: QueryTypes.SELECT})
	// .then(function (rows) {		
	// 	return rows;
	// })
	// .catch((err) => {
	// 	return false;
	// });
}


function emitirRespuesta_RES(xquery, res) {
	return sequelize.query(xquery, {type: QueryTypes.SELECT})
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
	sequelize.query(xquery, {		
		type: QueryTypes.SELECT
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
