const { to, ReE, ReS }  = require('../service/uitl.service');
let Sequelize = require('sequelize');
let config = require('../config');
let managerFilter = require('../utilitarios/filters');

let sequelize = new Sequelize(config.database, config.username, config.password, config.sequelizeOption);

let mysql_clean = function (string) {
        return sequelize.getQueryInterface().escape(string);
};

const getEstablecimientos = function (req, res) {  
	const idsede_categoria = req.body.idsede_categoria || 0;           
	const codigo_postal = req.body.codigo_postal || ''; // lo cambiamos por ciudad
	const idsede = req.body.idsede || 0;
    const read_query = `call procedure_pwa_delivery_establecimientos(${idsede_categoria}, '${codigo_postal}', ${idsede})`;
    emitirRespuestaSP_RES(read_query, res);        
}
module.exports.getEstablecimientos = getEstablecimientos;


const getDireccionCliente = async function (req, res) {
	// console.log ('idcliente', req.body);
	const idcliente = req.body.idcliente;
    // const read_query = `SELECT * from cliente_pwa_direccion where idcliente = ${idcliente} and estado = 0`;
    const read_query = `SELECT cpd.*, sc.options from cliente_pwa_direccion cpd	inner join sede_config_service_delivery sc on UPPER(sc.ciudad) = UPPER(cpd.ciudad) where cpd.idcliente = ${idcliente} and cpd.estado = 0`
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
	const idcliente = req.body.idcliente;
	const numberPhone = req.body.numberphone;
    // const read_query = `SELECT idcliente from cliente where idcliente=${idcliente} and pwa_code_verification = '${codigo}' and estado = 0`;
    const read_query = `call porcedure_pwa_update_phono_sms_cliente(${idcliente}, '${numberPhone}', '${codigo}')`;
    emitirRespuestaSP_RES(read_query, res);        
}
module.exports.verificarCodigoSMS = verificarCodigoSMS;


const setCalificarServicio = function (req, res) {  
	const dataCalificacion = req.body.dataCalificacion;	
    const read_query = `call procedure_pwa_delivery_calificacion('${JSON.stringify(dataCalificacion)}')`;
    emitirRespuestaSP_RES(read_query, res);        
}
module.exports.setCalificarServicio = setCalificarServicio;



const getCategorias = async function (req, res) {
	// const idcliente = dataCLiente.idcliente;
    const read_query = `call procedure_delivery_get_categorias()`;
    emitirRespuestaSP_RES(read_query, res);   
    // return emitirRespuestaSP(read_query);      
}
module.exports.getCategorias = getCategorias;


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