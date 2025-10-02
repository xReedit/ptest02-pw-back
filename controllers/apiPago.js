const { to, ReE, ReS }  = require('../service/uitl.service');
let Sequelize = require('sequelize');
// let config = require('../config');
let config = require('../_config');
let managerFilter = require('../utilitarios/filters');
let logger = require('../utilitarios/logger');

let sequelize = new Sequelize(config.database, config.username, config.password, config.sequelizeOption);

let mysql_clean = function (string) {
        return sequelize.getQueryInterface().escape(string);
};


const getPurchasenumber = function (req, res) {             
    const read_query = `call procedure_pwa_purchasenumber()`;
    emitirRespuestaSP_RES(read_query, res);        
}
module.exports.getPurchasenumber = getPurchasenumber;

const getEmailClient = function (req, res) {
	const idcliente = req.body.id;             
    const read_query = `call procedure_pwa_pago_get_email_client(${idcliente})`;
    emitirRespuestaSP_RES(read_query, res);        
}
module.exports.getEmailClient = getEmailClient;

const setRegistrarPago = function (req, res) {	
	const idcliente = req.body.idcliente;
	const idorg = req.body.idorg;
	const idsede = req.body.idsede;
	const importe = req.body.importe;
	const isdelivery = req.body.isdelivery;
	const isdeliveryInt = req.body.isdelivery ? 1 : 0;	

	req.body.objOperacion.isdelivery = isdeliveryInt;
	const objSubTotal = JSON.stringify(req.body.objSubTotal);
	const objTransaction = JSON.stringify(req.body.objTransaction);
	const objCliente = JSON.stringify(req.body.objCliente);
	const objOperacion = JSON.stringify(req.body.objOperacion);

	const constoEntrega = req.body.objSubTotal
									.filter(x => x.descripcion.toLowerCase() === 'entrega' || x.descripcion.toLowerCase() === 'propina')
									.map(x => parseFloat(x.importe))
									.reduce((a,b) => a + b, 0);

	const importeNeto = parseFloat(importe) - constoEntrega;

    const read_query = `call procedure_pwa_registrar_pago(${idcliente},${idorg},${idsede},'${importe}','${objTransaction}','${objSubTotal}', '${objCliente}', '${objOperacion}', ${isdelivery}, ${isdeliveryInt}, '${importeNeto}')`;
    emitirRespuestaSP_RES(read_query, res);        
}
module.exports.setRegistrarPago = setRegistrarPago;




function emitirRespuesta(xquery, res) {	
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