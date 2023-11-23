const { to, ReE, ReS }  = require('../service/uitl.service');
let Sequelize = require('sequelize');
// let config = require('../config');
let config = require('../_config');
let managerFilter = require('../utilitarios/filters');

let sequelize = new Sequelize(config.database, config.username, config.password, config.sequelizeOption);

let mysql_clean = function (string) {
        return sequelize.getQueryInterface().escape(string);
};


const getSinToken = async function (req, res) {	
    // const idcliente = req.body.idcliente;
        
    // const read_query = `update repartidor set efectivo_mano = 1500, online = 1 where idrepartidor = 1`;
    // return emitirRespuestaSP(read_query);      

    const idrepartidor = 1; //managerFilter.getInfoToken(req,'idrepartidor');
	// const efectivo = req.body.efectivo;      
	// const online = req.body.online;     

	console.log('llego a funcion setEfectivoMano idrepartidor', idrepartidor);
	
    const read_query = `update repartidor set efectivo_mano = 1, online = 1 where idrepartidor = 1`;

    emitirRespuestaSP_RES(read_query, res);  
}
module.exports.getSinToken = getSinToken;

// registro de comercio
const getProcedure = function (req, res) {
    const read_query = `call procedure_pwa_get_all_categorias()`;
    emitirRespuestaSP_RES(read_query, res);        
}
module.exports.getProcedure = getProcedure;



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