const { to, ReE, ReS }  = require('../service/uitl.service');
const config = require('../config');
let Sequelize = require('sequelize');

let sequelize = new Sequelize(config.database, config.username, config.password, config.sequelizeOption);

const getComandosVoz = async function (req, res) {
	// console.log ('idcliente', req.body);
	const idcliente = req.body.idcliente;
    // const read_query = `SELECT * from cliente_pwa_direccion where idcliente = ${idcliente} and estado = 0`;
    const read_query = `SELECT * from comando_voz where estado = 0`;
    emitirRespuesta_RES(read_query, res);        
}
module.exports.getComandosVoz = getComandosVoz;

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
