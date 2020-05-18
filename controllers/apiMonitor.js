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