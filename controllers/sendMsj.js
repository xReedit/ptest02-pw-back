const { to, ReE, ReS }  = require('../service/uitl.service');
var config = require('../config');
var clientSMS = require('twilio')(config.accountSidSms, config.authTokenSms);

let Sequelize = require('sequelize');
let sequelize = new Sequelize(config.database, config.username, config.password, config.sequelizeOption);

const sendMsjConfirmacion = async function (req, res) {
	// console.log ('idcliente', req.body);
	const numberPhone = req.body.numberphone;
	const idcliente = req.body.idcliente;

	const codigoVerificacion = Math.round(Math.random()* (9000 - 1)+parseInt(1000));
	console.log('codigo de verificacion', codigoVerificacion);
    // const read_query = `SELECT * from cliente_pwa_direccion where idcliente = ${idcliente} and estado = 0`;
    // emitirRespuesta_RES(read_query, res);        
    clientSMS.messages.create({
    	body: 'Papaya.com.pe, codigo de verificacion: ' + codigoVerificacion,
    	to: '+51'+numberPhone,  // Text this number
    	from: '+17852279308' // From a valid Twilio number
	})
	.then((message) => {
		// genera codigo y guarda
		const read_query = `call porcedure_pwa_update_phono_sms_cliente(${idcliente},'${numberPhone}', '${codigoVerificacion}')`;
    	emitirRespuestaSP(read_query);
		return ReS(res, {
			msj: true
		});
	})
	.catch(err => {
		return ReS(res, {
			msj: false
		});
	});
}
module.exports.sendMsjConfirmacion = sendMsjConfirmacion;






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
