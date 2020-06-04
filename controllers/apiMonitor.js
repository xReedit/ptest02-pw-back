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
    const read_query = `call procedure_pwa_delivery_monitor_pedidos()`;
    emitirRespuestaSP_RES(read_query, res);        
}
module.exports.getPedidos = getPedidos;

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


const getPedidosPendientesRepartidor = async function (req, res) {	
    const read_query = `call procedure_delivery_pedidos_pendientes()`;
    emitirRespuestaSP_RES(read_query, res);  
}
module.exports.getPedidosPendientesRepartidor = getPedidosPendientesRepartidor;

const setResetRepartidor = async function (req, res) {
	const idrepartidor = req.body.idrepartidor;
	const read_query = `update repartidor set pedidos_reasignados = 0 where idrepartidor = ${idrepartidor};`;
    emitirRespuesta(read_query);        
}
module.exports.setResetRepartidor = setResetRepartidor;


const setLiberarRepartidor = function (req, res) {  
	const idrepartidor = req.body.idrepartidor;
    const read_query = `update repartidor set ocupado = 0, pedido_por_aceptar = null, solicita_liberar_pedido=0 where idrepartidor = ${idrepartidor};`;
    emitirRespuesta(read_query);        
}
module.exports.setLiberarRepartidor = setLiberarRepartidor;


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