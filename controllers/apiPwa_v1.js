const { to, ReE, ReS }  = require('../service/uitl.service');
let Sequelize = require('sequelize');
let config = require('../config');
let managerFilter = require('../utilitarios/filters');
// let utilitarios = require('../utilitarios/fecha.js');

let sequelize = new Sequelize(config.database, config.username, config.password, config.sequelizeOption);

let mysql_clean = function (string) {
        return sequelize.getQueryInterface().escape(string);
};

const getObjCarta = async function (dataCLiente) {
	console.log( 'data cliente', dataCLiente )
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
	console.log( 'data cliente', dataCLiente )
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
	console.log( 'data cliente', dataCLiente )
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

    console.log('cuenta de mesa: ', mesa);
	const read_query = `call procedure_bus_pedido_bd_3051(${mesa}, '', ${idorg}, ${idsede});`;
	console.log('sql ', read_query)
    emitirRespuestaSP_RES(read_query, res);

    // const read_query = `call procedure_pwa_print_comanda(${idorg}, ${idsede}, ${idusuario},'${JSON.stringify(dataPrint)}')`;
    // return emitirRespuestaSP(read_query);        
}
module.exports.getLaCuenta = getLaCuenta;

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
	// console.log(xquery);
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