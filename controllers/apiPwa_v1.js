const { to, ReE, ReS }  = require('../service/uitl.service');
let Sequelize = require('sequelize');
let config = require('../config');
let managerFilter = require('../utilitarios/filters');
// let utilitarios = require('../utilitarios/fecha.js');

let sequelize = new Sequelize(config.database, config.username, config.password, config.sequelizeOption);

let mysql_clean = function (string) {
        return sequelize.getQueryInterface().escape(string);
};

const setClienteConectado = function (dataCLiente) {	
    const idcliente = dataCLiente.idcliente;
    const socketid = dataCLiente.socketid;
    if ( idcliente ) {
    	const read_query = `insert into cliente_socketid (idcliente, socketid, conectado) values (${idcliente}, '${socketid}', '1')  ON DUPLICATE KEY UPDATE socketid = '${socketid}', conectado='1';`;
    	return emitirRespuesta(read_query);
    }    
}
module.exports.setClienteConectado = setClienteConectado;

const setClienteDesconectado = function (dataCLiente) {
    const idcliente = dataCLiente.idcliente;
    const socketid = dataCLiente.socketid;
    if ( idcliente && idcliente != 'undefined') {
    	const read_query = `update cliente_socketid set conectado='0' where idcliente = '${idcliente}';`;
    	return emitirRespuesta(read_query);
    }    
}
module.exports.setClienteDesconectado = setClienteDesconectado;

const getSocketIdCliente = async function (listIdCliente) {
	// const idcliente = dataCLiente.idcliente;
    const read_query = `SELECT socketid from cliente_socketid where idcliente in (${listIdCliente})`;
    return emitirRespuesta(read_query);        
}
module.exports.getSocketIdCliente = getSocketIdCliente;




const getObjCarta = async function (dataCLiente) {
	console.log( 'getObjCarta data cliente', dataCLiente )
	const idorg = dataCLiente.idorg;
    const idsede = dataCLiente.idsede;           
    const iscliente = dataCLiente.iscliente == 'true' ? 1 : 0;
    console.log( 'getObjCarta data cliente iscliente', iscliente );
        
    const read_query = `call porcedure_pwa_pedido_carta(${idorg},${idsede},${iscliente})`;
    return emitirRespuestaSP(read_query);        
}
module.exports.getObjCarta = getObjCarta;

// datos de la sede, impresoras
const getDataSede = async function (dataCLiente) {	
	const idorg = dataCLiente.idorg;
    const idsede = dataCLiente.idsede;           
        
    const read_query = `call procedure_pwa_pedido_dataorg(${idorg},${idsede})`;    
    return emitirRespuestaSP(read_query);    
}
module.exports.getDataSede = getDataSede;

const getDataSedeDescuentos = async function (dataCLiente) {  
    const idorg = dataCLiente.idorg;
    const idsede = dataCLiente.idsede;           
        
    const read_query = `call procedure_pwa_sede_descuentos(${idsede})`;    
    return emitirRespuestaSP(read_query);    
}
module.exports.getDataSedeDescuentos = getDataSedeDescuentos;

const getTipoConsumo = async function (dataCLiente) {
	const idorg = dataCLiente.idorg;
    const idsede = dataCLiente.idsede;
    const read_query = `SELECT idtipo_consumo, descripcion, titulo, idimpresora from tipo_consumo where (idorg=${idorg} and idsede=${idsede}) and estado=0`;
    return emitirRespuesta(read_query);        
}
module.exports.getTipoConsumo = getTipoConsumo;

const getReglasCarta = async function (dataCLiente) {
	// console.log( 'data cliente', dataCLiente )
	const idorg = dataCLiente.idorg;
    const idsede = dataCLiente.idsede;           
        
    const read_query = `call procedure_pwa_reglas_carta_subtotales(${idorg},${idsede})`;
    return emitirRespuestaSP(read_query);           
}
module.exports.getReglasCarta = getReglasCarta;


const setItemCarta = async function (op, item) {		              
    const read_query = `call porcedure_pwa_update_cantidad_item(${op},'${JSON.stringify(item)}')`;
    return emitirRespuestaSP(read_query);        
}
module.exports.setItemCarta = setItemCarta;


const setNuevoPedido = async function (dataCLiente, dataPedido) {
    
	// const idorg = dataCLiente.idorg;
 //    const idsede = dataCLiente.idsede;		              
 //    const idusuario = dataCLiente.idusuario;		              

    // tomamos los datos del cliente del pedido y no del socket, puede estar haciendo conflicto
    // y enviando a otros comercios
    const _dataCliente = dataPedido.dataUsuario
    const idorg = _dataCliente.idorg;
    const idsede = _dataCliente.idsede;                    
    const idusuario = _dataCliente.idusuario;                      
    var _json = JSON.stringify(dataPedido).replace(/\\n/g, '')
                                      .replace(/\\'/g, '')
                                      .replace(/\\"/g, '')
                                      .replace(/\\&/g, '')
                                      .replace(/\\r/g, '')
                                      .replace(/\\t/g, '')
                                      .replace(/\\b/g, '')
                                      .replace(/\\f/g, '');

    const read_query = `call procedure_pwa_pedido_guardar(${idorg}, ${idsede}, ${idusuario},'${_json}')`;
    return emitirRespuestaSP(read_query);        
}
module.exports.setNuevoPedido = setNuevoPedido;


// para evitar pedidos perdidos cuando el socket pierde conexion
const setNuevoPedido2 = async function (req, res) {
    
    // const idorg = dataCLiente.idorg;
 //    const idsede = dataCLiente.idsede;                     
 //    const idusuario = dataCLiente.idusuario;                   

    // tomamos los datos del cliente del pedido y no del socket, puede estar haciendo conflicto
    // y enviando a otros comercios
    const dataPedido = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;    
    const _dataCliente = dataPedido.dataUsuario
    const idorg = _dataCliente.idorg;
    const idsede = _dataCliente.idsede;                    
    const idusuario = _dataCliente.idusuario;                      
    var _json = JSON.stringify(dataPedido).replace(/\\n/g, '')
                                      .replace(/\\'/g, '')
                                      .replace(/\\"/g, '')
                                      .replace(/\\&/g, '')
                                      .replace(/\\r/g, '')
                                      .replace(/\\t/g, '')
                                      .replace(/\\b/g, '')
                                      .replace(/\\f/g, '');

    const read_query = `call procedure_pwa_pedido_guardar(${idorg}, ${idsede}, ${idusuario},'${_json}')`;
    // console.log(read_query);
    emitirRespuestaSP_RES(read_query, res);        
}
module.exports.setNuevoPedido2 = setNuevoPedido2;

const setPrintComanda = async function (dataCLiente, dataPrint) {
	const idorg = dataCLiente.idorg;
    const idsede = dataCLiente.idsede;		              
    const idusuario = dataCLiente.idusuario;		              
    const read_query = `call procedure_pwa_print_comanda(${idorg}, ${idsede}, ${idusuario},'${JSON.stringify(dataPrint)}')`;
    return emitirRespuestaSP(read_query);        
}
module.exports.setPrintComanda = setPrintComanda;

const setPrinterOtherDocs = async function (req, res) {
    const idorg = managerFilter.getInfoToken(req,'idorg');
    const idsede = managerFilter.getInfoToken(req, 'idsede');
    const idusuario = managerFilter.getInfoToken(req, 'idusuario');
    const dataPrint = req.body.dataPrint;
    const isprecuenta = req.body.isprecuenta || 0;
    const read_query = `call procedure_pwa_print_comanda(${idorg}, ${idsede}, ${idusuario},'${JSON.stringify(dataPrint)}', ${isprecuenta})`;
    // return emitirRespuestaSP(read_query);        
    emitirRespuestaSP_RES(read_query, res);

}
module.exports.setPrinterOtherDocs = setPrinterOtherDocs;

const getLaCuenta = async function (req, res) {
	const idorg = req.body.idorg || managerFilter.getInfoToken(req,'idorg');
	const idsede = req.body.idsede || managerFilter.getInfoToken(req, 'idsede');
    const mesa = req.body.mesa ? req.body.mesa : '0';
    const idpedido = req.body.idpedido ? req.body.idpedido : '';

    console.log('req.body', req.body)
    
	const read_query = `call procedure_bus_pedido_bd_3051(${mesa}, '', '${idpedido}', ${idorg}, ${idsede}, 0, -1);`;	
    emitirRespuestaSP_RES(read_query, res);

    // const read_query = `call procedure_pwa_print_comanda(${idorg}, ${idsede}, ${idusuario},'${JSON.stringify(dataPrint)}')`;
    // return emitirRespuestaSP(read_query);        
}
module.exports.getLaCuenta = getLaCuenta;

// la cuenta desde el cliente
const getLaCuentaFromCliente = async function (req, res) {	
	const idsede = req.body.idsede;
    const idcliente = req.body.idcliente;
    const num_mesa = req.body.num_mesa;

	const read_query = `call procedure_pwa_cuenta_cliente(${idcliente}, ${idsede}, ${num_mesa});`;	
    emitirRespuestaSP_RES(read_query, res); 
}
module.exports.getLaCuentaFromCliente = getLaCuentaFromCliente;

// la cuenta desde el cliente - solo totales
const getLaCuentaFromClienteTotales = async function (req, res) {	
	const idsede = req.body.idsede;
    const idcliente = req.body.idcliente;
    const num_mesa = req.body.num_mesa;
    const idpedido = req.body.idpedido ? req.body.idpedido : null;

	const read_query = `call procedure_pwa_cuenta_cliente_totales(${idcliente}, ${idsede}, ${idpedido}, ${num_mesa});`;	
    emitirRespuestaSP_RES(read_query, res); 
}
module.exports.getLaCuentaFromClienteTotales = getLaCuentaFromClienteTotales;

const getLaCuentaFromPedidoTotales = async function (req, res) {
    const idpedido = req.body.idpedido;

	const read_query = `call procedure_pwa_cuenta_cliente_totales('', '', ${idpedido});`;	
    emitirRespuestaSP_RES(read_query, res); 
}
module.exports.getLaCuentaFromPedidoTotales = getLaCuentaFromPedidoTotales;


const getConsultaDatosCliente = async function (req, res) {
	// const idorg = managerFilter.getInfoToken(req,'idorg');
	const idsede = managerFilter.getInfoToken(req, 'idsede');
    const onlySede = req.body.only_sede || false;
    const doc = req.body.documento;    
    // const _str_only_sede = onlySede ? ' and idsede = ' + idsede : ''; 
    var read_query = '';

    if ( onlySede ) {
        read_query = `SELECT * FROM cliente c 
                        inner join cliente_sede cs on c.idcliente = cs.idcliente 
                    where c.estado=0 and c.ruc='${doc}' and cs.idsede = ${idsede} order by nombres limit 1`;
    } else {
        read_query = `SELECT * FROM cliente where estado=0 and ruc='${doc}' order by nombres limit 1`;  
    }

    console.log('doc cliente: ', doc);
    // idorg=${idorg}) AND 
	// const read_query = `SELECT * FROM cliente where estado=0 and ruc='${doc}' ${_str_only_sede} order by nombres limit 1`;	
    emitirRespuesta_RES(read_query, res);
}
module.exports.getConsultaDatosCliente = getConsultaDatosCliente;

const getConsultaDatosClienteNoTk = async function (req, res) {
    // const idorg = managerFilter.getInfoToken(req,'idorg');
    // const idsede = managerFilter.getInfoToken(req, 'idsede');
    const doc = req.body.documento;

    console.log('doc cliente: ', doc);
    // idorg=${idorg}) AND 
    // const read_query = `SELECT * FROM cliente where estado=0 and ruc='${doc}' order by pwa_id desc, telefono desc limit 1`;    
    const read_query = `SELECT * FROM cliente where estado=0 and pwa_id='dni|${doc}' and ruc='${doc}' order by pwa_id desc, telefono desc, pwa_code_verification desc limit 1`;    
    emitirRespuesta_RES(read_query, res);
}
module.exports.getConsultaDatosClienteNoTk = getConsultaDatosClienteNoTk;


// guarda los datos de facturacion que especifica el usuario desde pwa
const setDatosFacturacionClientePwa = async function (req, res) {
    const data = req.body;
    const read_query = `call procedure_set_datos_facturacion_pwa('${JSON.stringify(data)}');`;   
    emitirRespuestaSP_RES(read_query, res); 
}
module.exports.setDatosFacturacionClientePwa = setDatosFacturacionClientePwa;

// datos al inicio despues de escanear codigo
const getDataSedeIni = async function (req, res) {	
	const idsede = req.body.idsede;
    // console.log('cuenta de mesa: ', mesa);
	const read_query = `SELECT idsede, idorg, nombre, eslogan, pwa_msj_ini, pwa_time_limit, pwa_delivery_comercio_online from sede where (idsede=${idsede}) AND estado=0`;	
    emitirRespuesta_RES(read_query, res);
}
module.exports.getDataSedeIni = getDataSedeIni;

const getIdSedeFromNickName = async function (req, res) {  
    const nomsede = req.body.nomsede;
    // console.log('cuenta de mesa: ', mesa);
    const read_query = `SELECT idsede, idorg, nombre, eslogan, pwa_msj_ini, pwa_time_limit from sede where link_carta='${nomsede}' AND estado=0`;    
    emitirRespuesta_RES(read_query, res);
}
module.exports.getIdSedeFromNickName = getIdSedeFromNickName;


const getReglasApp = async function (req, res) {	
	const read_query = `SELECT * from pwa_reglas_app where estado=0`;	
    emitirRespuesta_RES(read_query, res);
}
module.exports.getReglasApp = getReglasApp;

const getConsAppDelivery = async function (req, res) {	
	const read_query = `SELECT value from sys_const where llave in ('DELIVERY_CANTIDAD_ITEMS_ESCALA', 'DELIVERY_COSTO_ITEMS_ESCALA')`;	
    emitirRespuesta_RES(read_query, res);
}
module.exports.getConsAppDelivery = getConsAppDelivery;


const setRegisterClienteLogin = async function (req, res) {
	// const idorg = req.body.idorg;
	const dataLogin = req.body;
	const read_query = `call procedure_pwa_register_cliente_login('${JSON.stringify(dataLogin)}')`;

    emitirRespuestaSP_RES(read_query, res); 
}
module.exports.setRegisterClienteLogin = setRegisterClienteLogin;

const getCalcTimeDespacho = async function (req, res) {	
	const idsede = req.body.idsede;
	const read_query = `call procedure_pwa_calc_time_despacho('${idsede}')`;

    emitirRespuestaSP_RES(read_query, res); 
}
module.exports.getCalcTimeDespacho = getCalcTimeDespacho;


// encuesta al terminar de pagar la cuenta // agarra la primer encuesta por los momentos
const getEncuesta = async function (req, res) {	
    const idsede = req.body.idsede;
        
    const read_query = `SELECT preguntas from encuesta_sede_conf where idsede=${idsede} and estado=0 limit 1`;
    // return emitirRespuestaSP(read_query);      
    emitirRespuesta_RES(read_query, res);  
}
module.exports.getEncuesta = getEncuesta;

// opciones de la encuesta, bueno, excelente ...
const getEncuestaOpRespuesta = async function (req, res) {	
    const idsede = req.body.idsede;
        
    const read_query = `select * from encuesta_respuesta where estado=0`;
    // return emitirRespuestaSP(read_query);      
    emitirRespuesta_RES(read_query, res);  
}
module.exports.getEncuestaOpRespuesta = getEncuestaOpRespuesta;


// guadar encuensta
const setEncuestaGuardar = async function (req, res) {	
	const id = req.body.i;
	const item = req.body.item;
	const read_query = `call procedure_save_encuesta(${id}, '${JSON.stringify(item)}')`;

    emitirRespuestaSP_RES(read_query, res); 
}
module.exports.setEncuestaGuardar = setEncuestaGuardar;

// sede obtener  pwa_requiere_gps  > si sede requiere geolocalizacion
const getSedeRequiereGPS = async function (req, res) {	
    const idsede = req.body.idsede;
        
    const read_query = `select pwa_requiere_gps from sede where idsede=${idsede} and estado=0`;
    // return emitirRespuestaSP(read_query);      
    emitirRespuesta_RES(read_query, res);  
}
module.exports.getSedeRequiereGPS = getSedeRequiereGPS;


// cliente log por dni, buscar
const getUsuarioClietenByDNI = async function (req, res) {	
    const numdocumento = req.body.documento;
        
    const read_query = `select * from cliente where ruc='${numdocumento}' and estado=0`;
    // return emitirRespuestaSP(read_query);      
    emitirRespuesta_RES(read_query, res);  
}
module.exports.getUsuarioClietenByDNI = getUsuarioClietenByDNI;


// cliente perfil
const getClientePerfil = async function (req, res) {	
    const idcliente = req.body.idcliente;
        
    const read_query = `select * from cliente where idcliente='${idcliente}' and estado=0`;
    // return emitirRespuestaSP(read_query);      
    emitirRespuesta_RES(read_query, res);  
}
module.exports.getClientePerfil = getClientePerfil;

const setClientePerfil = async function (req, res) {	
    const idcliente = req.body.idcliente;
        
    const read_query = `update cliente set ruc='${req.body.ruc}', email='${req.body.email}', f_nac='${req.body.f_nac}' where idcliente=${idcliente}`;
    // return emitirRespuestaSP(read_query);      
    emitirRespuesta_RES(read_query, res);
}
module.exports.setClientePerfil = setClientePerfil;

// guarda direccion de cliente pwa
const setClienteNewDireccion = async function (req, res) {	
	// const id = req.body.i;
	const _data = req.body;
	const read_query = `call procedure_pwa_guardar_direccion_cliente('${JSON.stringify(_data)}')`;

    emitirRespuestaSP_RES(read_query, res); 
}
module.exports.setClienteNewDireccion = setClienteNewDireccion;


const setHistoryError = function (req, res) {	
    const _elerror = req.body.elerror;
    const _elorigen = req.body.elorigen;
        
    const read_query = `insert into  historial_error(fecha, error, origen) values (now(), '${JSON.stringify(_elerror)}', '${_elorigen}')`;
    // return emitirRespuestaSP(read_query);      
    emitirRespuesta_RES(read_query, res);  
}
module.exports.setHistoryError = setHistoryError;

const getAllClienteBySearch = function (req, res) {
    const read_query = `call pwa_delivery_get_all_clientes()`;
    emitirRespuestaSP_RES(read_query, res); 
}
module.exports.getAllClienteBySearch = getAllClienteBySearch;

const getAllClienteBySearchName = function (req, res) {
    const buscar = req.body.buscar;
    const idsede = managerFilter.getInfoToken(req, 'idsede');
    const onlySede = req.body.only_sede || false;
    // const _str_only_sede = onlySede ? ' and idsede = ' + idsede : ''; 
    var read_query = '';

    if ( onlySede ) {
        read_query = `SELECT c.idcliente, c.nombres, c.ruc, c.telefono FROM cliente c 
                        inner join cliente_sede cs on c.idcliente = cs.idcliente 
                    where c.estado=0 and c.nombres!='' and cs.idsede = ${idsede} and LENGTH(c.nombres) > 10 and c.nombres like '%${buscar}%' group by c.nombres order by c.nombres`;
    } else {
        read_query = `select idcliente, nombres, ruc, telefono from cliente where estado=0 and nombres!='' and LENGTH(nombres) > 10 and nombres like '%${buscar}%' group by nombres order by nombres`;
    }
    
    emitirRespuesta_RES(read_query, res); 
}
module.exports.getAllClienteBySearchName = getAllClienteBySearchName;

const getLastComisionEntrega = async function (req, res) {    
    const code_postal = req.body.codigo_postal;
        
    const read_query = `select * from sede_config_service_delivery where codigo_postal like '%${code_postal}%' limit 1`;
    // return emitirRespuestaSP(read_query);      
    emitirRespuesta_RES(read_query, res);  
}
module.exports.getLastComisionEntrega = getLastComisionEntrega;


const getCanalesConsumo = async function (req, res) {    
    const idsede = req.body.idsede;
    const read_query = `SELECT idtipo_consumo, descripcion, titulo from tipo_consumo where idsede=${idsede} and estado=0`;
    emitirRespuesta_RES(read_query, res);        
}
module.exports.getCanalesConsumo = getCanalesConsumo;

const setRegisterScanQr = async function (req, res) {    
    const idsede = req.body.idsede;
    const canal = req.body.canal;
    const idscan = req.body.idscan || 0;
        
    const read_query = `call procedure_register_scan_qr(${idsede}, '${canal}', ${idscan})`;
    // return emitirRespuestaSP(read_query);      
    emitirRespuestaSP_RES(read_query, res);  
}
module.exports.setRegisterScanQr = setRegisterScanQr;

// enviado desde el servidor de impresion
const setFlagPrinter = function (id) {                
    const read_query = `update print_server_detalle set impreso=1 where idprint_server_detalle=${id}`;    
    emitirRespuestaSP(read_query);
}
module.exports.setFlagPrinter = setFlagPrinter;

const setFlagPrinterChangeEstadoPedido = function (id) {                
    const read_query = `update pedido set pwa_estado='A' where idpedido=${id}`;    
    emitirRespuestaSP(read_query);
}
module.exports.setFlagPrinterChangeEstadoPedido = setFlagPrinterChangeEstadoPedido;


// busca los subitems del item seleccionado, para hacer mas rapida la consulta
const getSearchSubitemsItem = async function (iditem) {    
    // const iditem = req.body.iditem;
        
    const read_query = `call porcedure_pwa_pedido_carta_get_subitens(${iditem})`;
    // return emitirRespuestaSP(read_query);      
    // emitirRespuestaSP_RES(read_query, res);
    return emitirRespuestaSP(read_query);  
}
module.exports.getSearchSubitemsItem = getSearchSubitemsItem;


const setCodigoVerificacionTelefonoCliente =  function (data) {    
    // const iditem = req.body.iditem;
    const numTelefono = parseInt(data.idcliente) < 0 ? data.numberphone : '';
    const read_query = `call porcedure_pwa_update_phono_sms_cliente(${data.idcliente},'${numTelefono}', '${data.cod}')`;    
    emitirRespuestaSP(read_query);  
}
module.exports.setCodigoVerificacionTelefonoCliente = setCodigoVerificacionTelefonoCliente;

const saveCallClientMesa =  function (data, op) {        
    const read_query = `call procedure_pwa_call_client_mesa('${JSON.stringify(data)}', ${op})`;
    emitirRespuestaSP(read_query);
}
module.exports.saveCallClientMesa = saveCallClientMesa;

const listCallClientMesa =  function (data) {        
    const read_query = `SELECT num_mesa from cliente_solicita_atencion_mesa where idsede=${data.idsede} and atendido=0`;
    return emitirRespuesta(read_query);    
}
module.exports.listCallClientMesa = listCallClientMesa;


// datos de facturacion
const getComprobantesSede = async function (req, res) {   
    const idsede = req.body.idsede;    
    const read_query = `SELECT tc.idtipo_comprobante, tc.descripcion from tipo_comprobante_serie tcs 
                        inner join tipo_comprobante tc on tcs.idtipo_comprobante = tc.idtipo_comprobante 
                        where tcs.idsede = ${idsede} and tcs.estado = 0 and tc.codsunat != '0'`;
    
    emitirRespuesta_RES(read_query, res);
}
module.exports.getComprobantesSede = getComprobantesSede;


const getLastPedidoClienteThisTable = async function (req, res) {   
    const idsede = req.body.idsede;    
    const nummesa = req.body.nummesa;   
    const read_query = `select p.referencia, TIMESTAMPDIFF(MINUTE, p.fecha_hora, now()) min 
                        from pedido p left join pedido_correlativos pc on pc.idsede = p.idsede 
                        where p.idpedido > pc.last_id_pedido_cierre and p.idsede=${idsede} and p.flag_is_cliente = 1 and p.nummesa = ${nummesa} and p.estado = 0 order by p.idpedido desc limit 1`;
    
    emitirRespuesta_RES(read_query, res);
}
module.exports.getLastPedidoClienteThisTable = getLastPedidoClienteThisTable;


const getListMesas = async function (req, res) {   
    const idsede = req.body.idsede;    
    const obj = req.body.obj;       
    let read_query = '';

    if ( obj ) {
        read_query = `call procedure_refresh_mesas_list_mozo(${idsede}, '${JSON.stringify(obj)}')`;    
    } else {
        read_query = `call procedure_refresh_mesas_list_mozo(${idsede}, null)`;    
    }
    
    emitirRespuestaSP_RES(read_query, res);
}
module.exports.getListMesas = getListMesas;



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