const { to, ReE, ReS }  = require('../service/uitl.service');
let Sequelize = require('sequelize');
// let config = require('../config');
let config = require('../_config');
let managerFilter = require('../utilitarios/filters');

let sequelize = new Sequelize(config.database, config.username, config.password, config.sequelizeOption);

let mysql_clean = function (string) {
        return sequelize.getQueryInterface().escape(string);
};

const emitirRespuesta = async (xquery) => {
    // console.log(xquery);
    try {
        return await sequelize.query(xquery, { type: sequelize.QueryTypes.SELECT });
    } catch (err) {
        console.error(err);
        return false;
    }
};

const emitirRespuesta_RES = async (xquery, res) => {
    // console.log(xquery);

    try {
        const rows = await sequelize.query(xquery, { type: sequelize.QueryTypes.SELECT });
        return ReS(res, {
            data: rows
        });
    } catch (error) {
        console.error(error);
        return false;
    }
};
module.exports.emitirRespuesta_RES = emitirRespuesta_RES;

const emitirRespuestaSP = async (xquery) => {
    // console.log(xquery);
    try {
        const rows = await sequelize.query(xquery, { type: sequelize.QueryTypes.RAW });
        const arr = Object.values(rows[0]);
        return arr;
    } catch (err) {
        console.error(err);
        return false;
    }
};

const emitirRespuestaSP_RES = async (xquery, res) => {
    // console.log(xquery);
    try {
        const rows = await sequelize.query(xquery, { type: sequelize.QueryTypes.SELECT });

        // Convertimos en array ya que viene en object
        const arr = Object.values(rows[0]);

        return ReS(res, {
            data: arr
        });
    } catch (err) {
        return ReE(res, err);
    }
};


const ejecutarQuery = async (query) => {
    const resultado = await emitirRespuesta(query);
    return resultado || [];
};

const getEstablecimientos = async function (req, res) {  
	const idsede_categoria = req.body.idsede_categoria || 0;           
	const codigo_postal = req.body.codigo_postal || ''; // lo cambiamos por ciudad
	const idsede = req.body.idsede || 0;	
	const point_client = req.body.point_client || '';	
    const read_query = `call procedure_pwa_delivery_establecimientos(${idsede_categoria}, '${codigo_postal}', ${idsede}, '${point_client}')`;
    return await emitirRespuestaSP_RES(read_query, res);        
}
module.exports.getEstablecimientos = getEstablecimientos;

const getParametrosTiendaLinea = async function(req, res) {
    const idsede = req.body.idsede
    if (!idsede) {
        return ReE(res, 'idsede es requerido');
    }
    const read_query = `select parametros from sede_costo_delivery where idsede=${idsede}`;
    return await emitirRespuesta_RES(read_query, res);
}
module.exports.getParametrosTiendaLinea = getParametrosTiendaLinea;

const getEstablecimientosPromociones = async function (req, res) {  
	const ciudad = req.body.ciudad || ''; // lo cambiamos por ciudad
    const read_query = `call procedure_pwa_delivery_establecimiento_promo('${ciudad}')`;
    return await emitirRespuestaSP_RES(read_query, res);        
}
module.exports.getEstablecimientosPromociones = getEstablecimientosPromociones;


const getDireccionCliente = async function (req, res) {
	// console.log ('idcliente', req.body);
	const idcliente = req.body.idcliente;
    // const read_query = `SELECT * from cliente_pwa_direccion where idcliente = ${idcliente} and estado = 0`;
    const read_query = `SELECT cpd.*, sc.options from cliente_pwa_direccion cpd	left join sede_config_service_delivery sc on UPPER(sc.ciudad) = UPPER(cpd.ciudad) where cpd.idcliente = ${idcliente} and cpd.estado = 0`
    return await emitirRespuesta_RES(read_query, res);        
}
module.exports.getDireccionCliente = getDireccionCliente;


const getMisPedido = async function (req, res) {  
	const idcliente = req.body.idcliente;	
    const read_query = `call procedure_pwa_delivery_mis_pedidos(${idcliente})`;
    return await emitirRespuestaSP_RES(read_query, res);        
}
module.exports.getMisPedido = getMisPedido;


const verificarCodigoSMS = async function (req, res) {
	// console.log ('idcliente', req.body);
	const codigo = req.body.codigo;
	const idcliente = req.body.idcliente;
	const numberPhone = req.body.numberphone;
    // const read_query = `SELECT idcliente from cliente where idcliente=${idcliente} and pwa_code_verification = '${codigo}' and estado = 0`;
    const read_query = `call porcedure_pwa_update_phono_sms_cliente(${idcliente}, '${numberPhone}', '${codigo}')`;
    return await emitirRespuestaSP_RES(read_query, res);        
}
module.exports.verificarCodigoSMS = verificarCodigoSMS;


const setCalificarServicio = async function (req, res) {  
	const dataCalificacion = req.body.dataCalificacion;	
    const read_query = `call procedure_pwa_delivery_calificacion('${JSON.stringify(dataCalificacion)}')`;
    return await emitirRespuestaSP_RES(read_query, res);        
}
module.exports.setCalificarServicio = setCalificarServicio;



const getCategorias = async function (req, res) {
	// const idcliente = dataCLiente.idcliente;
    const read_query = `call procedure_delivery_get_categorias()`;
    return await emitirRespuestaSP_RES(read_query, res);   
    // return emitirRespuestaSP(read_query);      
}
module.exports.getCategorias = getCategorias;


const getComercioXCalificar = async function (req, res) {
	// console.log ('idcliente', req.body);
	const idcliente = req.body.idcliente;
    // const read_query = `SELECT * from cliente_pwa_direccion where idcliente = ${idcliente} and estado = 0`;
    const read_query = `SELECT p.idpedido, p.idsede, s.nombre nomestablecimiento
						from pedido p
							inner join sede s on s.idsede = p.idsede
						where p.idcliente = ${idcliente} and p.flag_calificado = 0
						GROUP by p.idsede					
						ORDER by p.idpedido desc limit 2`;
    return await emitirRespuesta_RES(read_query, res);        
}
module.exports.getComercioXCalificar = getComercioXCalificar;

const getTipoVehiculo = async function (req, res) {	
    const read_query = `Select * from tipo_vehiculo where estado=0`;
    return await emitirRespuesta_RES(read_query, res);        
}
module.exports.getTipoVehiculo = getTipoVehiculo;


const getAllSedesServiceExpress = async function (req, res) {		
	const ciudad = req.body.ciudad;
    const read_query = `SELECT * from sede_config_service_delivery where estado = 0 and upper(ciudad) = upper('${ciudad}')`;
    return await emitirRespuesta_RES(read_query, res);  
}
module.exports.getAllSedesServiceExpress = getAllSedesServiceExpress;

const getComnisionAtm = async function (req, res) {		
	const importe = req.body.importe;
    const read_query = `call procedure_calc_comsion_visa_atm(${importe})`;
    return await emitirRespuestaSP_RES(read_query, res);  
}
module.exports.getComnisionAtm = getComnisionAtm;

const setCashAtm = async function (req, res) {		
	const obj = req.body;
    const read_query = `call procedure_set_cash_atm('${JSON.stringify(obj)}')`;
    return await emitirRespuestaSP_RES(read_query, res);  
}
module.exports.setCashAtm = setCashAtm;

const setPedidoMandado = async function (req, res) {
	console.log('pedido_mandado === ', req.body.dataInfo);

	const obj = req.body.dataInfo;
	var _json = JSON.stringify(obj).replace(/\\n/g, ' ')
                                      .replace(/\\'/g, '')
                                      .replace(/\\"/g, '')
                                      .replace(/\\&/g, '')
                                      .replace(/\\r/g, '')
                                      .replace(/\\t/g, '')
                                      .replace(/\\b/g, '')
                                      .replace(/'/g, '')
                                      .replace(/\\f/g, '');
    const read_query = `call procedure_guardar_pedido_mandado('${_json}')`;
    return await emitirRespuestaSP_RES(read_query, res);       
}
module.exports.setPedidoMandado = setPedidoMandado;

const testHora = async function (req, res) {		
	const ciudad = req.body.ciudad;
    const read_query = `SELECT now(), DATE_FORMAT(NOW( ), "%d/%m/%Y" ), DATE_FORMAT(NOW( ), "%H:%i:%S" )`;
    return await emitirRespuesta_RES(read_query, res);  
}
module.exports.testHora = testHora;

const getCiudadesDelivery = async function (req, res) {			
    const read_query = `select ciudad , codigo_postal, isreserva from sede_config_service_delivery where estado = 0;`;
    return await emitirRespuesta_RES(read_query, res);  
}
module.exports.getCiudadesDelivery = getCiudadesDelivery;

const getCalificacionSede = async function (req, res) {		
	const idsede = req.body.idsede;
    const read_query = `select SUBSTRING_INDEX(c.nombres, ' ',1) nomcliente, count(sc.idcliente) numpedidos, sc.calificacion, sc.comentario from sede_calificacion sc
			inner join cliente c on c.idcliente  = sc.idcliente 
		where sc.idsede = ${idsede} and sc.calificacion >= 2
		GROUP by sc.idcliente
		order by sc.idsede_calificacion desc`;
    return await emitirRespuesta_RES(read_query, res);  
}
module.exports.getCalificacionSede = getCalificacionSede;


const getSharedUrlCarta = async function (req, res) {
	const idsede = req.body.idsede;
    const read_query = `call procedure_generator_qr_mesa(${idsede})`;
    return await emitirRespuestaSP_RES(read_query, res);       
}
module.exports.getSharedUrlCarta = getSharedUrlCarta;

const SearchClienteByPhone = async function (req, res) {			
	const numTelefono = req.body.telefono;
    // const read_query = `select * from cliente where telefono = '${numTelefono}'  order by idcliente limit 1;`;
    const read_query = `select * from cliente where pwa_id = 'phone|${numTelefono}'  order by idcliente limit 1;`;
    return await emitirRespuesta_RES(read_query, res);  
}
module.exports.SearchClienteByPhone = SearchClienteByPhone;

const SearchClienteByPhonePwaId = async function (req, res) {			
	const numTelefono = req.body.telefono;
    const read_query = `select * from cliente where pwa_id = 'phone|${numTelefono}'  order by idcliente limit 1;`;
    return await emitirRespuesta_RES(read_query, res);  
}
module.exports.SearchClienteByPhonePwaId = SearchClienteByPhonePwaId;

const getTelefonoClienteChatBot = async function (req, res) {			
	const id = req.body.id;
    const read_query = `call procedure_delivery_get_cliente_from_bot('${id}')`;
    return await emitirRespuestaSP_RES(read_query, res); 
}
module.exports.getTelefonoClienteChatBot = getTelefonoClienteChatBot;



// function emitirRespuesta(xquery, res) {
// 	console.log(xquery);
// 	return sequelize.query(xquery, {type: sequelize.QueryTypes.SELECT})
// 	.then(function (rows) {
		
// 		// return ReS(res, {
// 		// 	data: rows
// 		// });
// 		return rows;
// 	})
// 	.catch((err) => {
// 		return false;
// 	});
// }


// function emitirRespuestaSP(xquery) {
// 	console.log(xquery);
// 	return sequelize.query(xquery, {		
// 		type: sequelize.QueryTypes.SELECT
// 	})
// 	.then(function (rows) {

// 		// convertimos en array ya que viene en object
// 		var arr = [];
// 		arr = Object.values(rows[0]);		
		
// 		return arr;
// 	})
// 	.catch((err) => {
// 		return false;
// 	});
// }


// function emitirRespuesta_RES(xquery, res) {
// 	console.log(xquery);
// 	return sequelize.query(xquery, {type: sequelize.QueryTypes.SELECT})
// 	.then(function (rows) {
		
// 		return ReS(res, {
// 			data: rows
// 		});
// 		// return rows;
// 	})
// 	.catch((err) => {
// 		return false;
// 	});
// }


// function emitirRespuestaSP_RES(xquery, res) {
// 	console.log(xquery);
// 	sequelize.query(xquery, {		
// 		type: sequelize.QueryTypes.SELECT
// 	})
// 	.then(function (rows) {

// 		// convertimos en array ya que viene en object
// 		var arr = [];
// 		arr = Object.values(rows[0]) ;
		
// 		return ReS(res, {
// 			data: arr
// 		});
// 	})
// 	.catch((err) => {
// 		return ReE(res, err);
// 	});
// }