const { to, ReE, ReS }  = require('../service/uitl.service');
let Sequelize = require('sequelize');
let config = require('../config');
let managerFilter = require('../utilitarios/filters');

let sequelize = new Sequelize(config.database, config.username, config.password, config.sequelizeOption);

let mysql_clean = function (string) {
        return sequelize.getQueryInterface().escape(string);
};

const getEstablecimientos = function (req, res) {  
	const idsede_categoria = req.body.idsede_categoria;           
	const codigo_postal = req.body.codigo_postal;           
    const read_query = `call procedure_pwa_delivery_establecimientos(${idsede_categoria}, ${codigo_postal})`;
    emitirRespuestaSP_RES(read_query, res);        
}
module.exports.getEstablecimientos = getEstablecimientos;


const getDireccionCliente = async function (req, res) {
	// console.log ('idcliente', req.body);
	const idcliente = req.body.idcliente;
    const read_query = `SELECT * from cliente_pwa_direccion where idcliente = ${idcliente} and estado = 0`;
    emitirRespuesta_RES(read_query, res);        
}
module.exports.getDireccionCliente = getDireccionCliente;


const getMisPedido = function (req, res) {  
	const idcliente = req.body.idcliente;	
    const read_query = `call procedure_pwa_delivery_mis_pedidos(${idcliente})`;
    emitirRespuestaSP_RES(read_query, res);        
}
module.exports.getMisPedido = getMisPedido;


const verificarCodigoSMS = async function (req, res) {
	// console.log ('idcliente', req.body);
	const codigo = req.body.codigo;
    const read_query = `SELECT idcliente from cliente where pwa_code_verification = ${codigo} and estado = 0`;
    emitirRespuesta_RES(read_query, res);        
}
module.exports.verificarCodigoSMS = verificarCodigoSMS;











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