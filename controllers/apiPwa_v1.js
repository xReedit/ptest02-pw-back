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
    if ( idcliente ) {
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
	// console.log( 'getObjCarta data cliente', dataCLiente )
	const idorg = dataCLiente.idorg;
    const idsede = dataCLiente.idsede;           
        
    const read_query = `call porcedure_pwa_pedido_carta(${idorg},${idsede})`;
    return emitirRespuestaSP(read_query);        
}
module.exports.getObjCarta = getObjCarta;

// datos de la sede, impresoras
const getDataSede = async function (dataCLiente) {
	// console.log('getDataSede', req.boyd);
	// const idorg = req.body.idorg;
 //    const idsede = req.body.idsede;
	// console.log( 'data cliente', dataCLiente )
	const idorg = dataCLiente.idorg;
    const idsede = dataCLiente.idsede;           
        
    const read_query = `call procedure_pwa_pedido_dataorg(${idorg},${idsede})`;    
    return emitirRespuestaSP(read_query);
    // emitirRespuestaSP_RES(read_query, res);        
}
module.exports.getDataSede = getDataSede;

const getTipoConsumo = async function (dataCLiente) {
	const idorg = dataCLiente.idorg;
    const idsede = dataCLiente.idsede;
    const read_query = `SELECT idtipo_consumo, descripcion, titulo from tipo_consumo where (idorg=${idorg} and idsede=${idsede}) and estado=0`;
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
	const idorg = dataCLiente.idorg;
    const idsede = dataCLiente.idsede;		              
    const idusuario = dataCLiente.idusuario;		              
    const read_query = `call procedure_pwa_pedido_guardar(${idorg}, ${idsede}, ${idusuario},'${JSON.stringify(dataPedido)}')`;
    return emitirRespuestaSP(read_query);        
}
module.exports.setNuevoPedido = setNuevoPedido;

const setPrintComanda = async function (dataCLiente, dataPrint) {
	const idorg = dataCLiente.idorg;
    const idsede = dataCLiente.idsede;		              
    const idusuario = dataCLiente.idusuario;		              
    const read_query = `call procedure_pwa_print_comanda(${idorg}, ${idsede}, ${idusuario},'${JSON.stringify(dataPrint)}')`;
    return emitirRespuestaSP(read_query);        
}
module.exports.setPrintComanda = setPrintComanda;

const getLaCuenta = async function (req, res) {
	const idorg = managerFilter.getInfoToken(req,'idorg');
	const idsede = managerFilter.getInfoToken(req, 'idsede');
    const mesa = req.body.mesa;

    // console.log('cuenta de mesa: ', mesa);
	const read_query = `call procedure_bus_pedido_bd_3051(${mesa}, '', ${idorg}, ${idsede});`;
	// console.log('sql ', read_query)
    emitirRespuestaSP_RES(read_query, res);

    // const read_query = `call procedure_pwa_print_comanda(${idorg}, ${idsede}, ${idusuario},'${JSON.stringify(dataPrint)}')`;
    // return emitirRespuestaSP(read_query);        
}
module.exports.getLaCuenta = getLaCuenta;

// la cuenta desde el cliente
const getLaCuentaFromCliente = async function (req, res) {	
	const idsede = req.body.idsede;
    const idcliente = req.body.idcliente;

	const read_query = `call procedure_pwa_cuenta_cliente(${idcliente}, ${idsede});`;	
    emitirRespuestaSP_RES(read_query, res); 
}
module.exports.getLaCuentaFromCliente = getLaCuentaFromCliente;

// la cuenta desde el cliente - solo totales
const getLaCuentaFromClienteTotales = async function (req, res) {	
	const idsede = req.body.idsede;
    const idcliente = req.body.idcliente;

	const read_query = `call procedure_pwa_cuenta_cliente_totales(${idcliente}, ${idsede});`;	
    emitirRespuestaSP_RES(read_query, res); 
}
module.exports.getLaCuentaFromClienteTotales = getLaCuentaFromClienteTotales;


const getConsultaDatosCliente = async function (req, res) {
	const idorg = managerFilter.getInfoToken(req,'idorg');
	const idsede = managerFilter.getInfoToken(req, 'idsede');
    const doc = req.body.documento;

    // console.log('cuenta de mesa: ', mesa);
	const read_query = `SELECT * FROM cliente where (idorg=${idorg}) AND estado=0 and ruc='${doc}' order by nombres`;	
    emitirRespuesta_RES(read_query, res);
}
module.exports.getConsultaDatosCliente = getConsultaDatosCliente;



// datos al inicio despues de escanear codigo
const getDataSedeIni = async function (req, res) {	
	const idsede = req.body.idsede;
    // console.log('cuenta de mesa: ', mesa);
	const read_query = `SELECT idsede, idorg, nombre, eslogan, pwa_msj_ini, pwa_time_limit from sede where (idsede=${idsede}) AND estado=0`;	
    emitirRespuesta_RES(read_query, res);
}
module.exports.getDataSedeIni = getDataSedeIni;


const getReglasApp = async function (req, res) {	
	const read_query = `SELECT * from pwa_reglas_app where estado=0`;	
    emitirRespuesta_RES(read_query, res);
}
module.exports.getReglasApp = getReglasApp;


const setRegisterClienteLogin = async function (req, res) {	
	const idorg = req.body.idorg;
	const dataLogin = req.body;
	const read_query = `call procedure_pwa_register_cliente_login(${idorg},'${JSON.stringify(dataLogin)}')`;

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