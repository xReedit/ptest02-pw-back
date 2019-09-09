const { to, ReE, ReS }  = require('../service/uitl.service');
let Sequelize = require('sequelize');
let config = require('../config');
let managerFilter = require('../utilitarios/filters');
let BuildSql = require('../service/buildsql.service');
let utilitarios = require('../utilitarios/fecha.js');

let sequelize = new Sequelize(config.database, config.username, config.password, config.sequelizeOption);

let mysql_clean = function (string) {
        return sequelize.getQueryInterface().escape(string);
};

const init = async function (req, res) {
        return ReS(res, {
                message: 'hello desde NATIVE API ESTADISTICA INIT V3 version 1'
        });
}
module.exports.init = init;

// const idorg = 1;
// const idsede = 1;

const getFechaNow = async function (req, res) {
	return ReS(res, {
				data: {f_actual: utilitarios.getFechaActualFormatLocal(), h_actual: utilitarios.getHoraActual()}
			});

}
module.exports.getFechaNow = getFechaNow;


const getObjCarta = async function (req, res) {
	console.log( 'req', req )
	const idorg = managerFilter.getInfoToken(req,'idorg');
    const idsede = managerFilter.getInfoToken(req, 'idsede');
    const metas = req.body;
        
        
    let read_query = `call porcedure_pwa_pedido_carta(${idorg},${idsede})`;

    emitirRespuestaSP(read_query, res);        

}
module.exports.getObjCarta = getObjCarta;



function emitirRespuesta(xquery, res) {
	console.log(xquery);
	sequelize.query(xquery, {type: sequelize.QueryTypes.SELECT})
	.then(function (rows) {

		// let _rows = typeof (rows) === 'object' ? Object.values(rows[0]) : rows;
		return ReS(res, {
			data: rows
		});
	})
	.catch((err) => {
		return ReE(res, err);
	});
}

function emitirRespuestaSP(xquery, res) {
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