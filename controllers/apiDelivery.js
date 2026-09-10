const { to, ReE, ReS }  = require('../service/uitl.service');
// let Sequelize = require('sequelize');
// let config = require('../config');
let config = require('../_config');
let managerFilter = require('../utilitarios/filters');
let logger = require('../utilitarios/logger');

// ✅ SEGURO: Conexión centralizada
const { sequelize, QueryTypes } = require('../config/database');
const QueryServiceV1 = require('../service/query.service.v1');

let mysql_clean = function (string) {
        return sequelize.getQueryInterface().escape(string);
};

const emitirRespuesta = async (xquery) => {    
    try {
        return await sequelize.query(xquery, { type: QueryTypes.SELECT });
    } catch (err) {        
        logger.error(err);
        return false;
    }
};

const emitirRespuesta_RES = async (xquery, res) => {    

    try {
        const rows = await sequelize.query(xquery, { type: QueryTypes.SELECT });
        return ReS(res, {
            data: rows
        });
    } catch (error) {        
        logger.error(error);
        return false;
    }
};
module.exports.emitirRespuesta_RES = emitirRespuesta_RES;

const emitirRespuestaSP = async (xquery) => {    
    try {
        const rows = await sequelize.query(xquery, { type: QueryTypes.RAW });
        const arr = Object.values(rows[0]);
        return arr;
    } catch (err) {        
        logger.error(err);
        return false;
    }
};

const emitirRespuestaSP_RES = async (xquery, res) => {    
    try {
        const rows = await sequelize.query(xquery, { type: QueryTypes.SELECT });

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
    // ponytail: ejecutarProcedimiento (no ejecutarConsulta) porque es un CALL y hay que
    // conservar el desempaquetado Object.values(rows[0]) que espera la app
    const read_query = `call procedure_pwa_delivery_establecimientos(?,?,?,?)`;
    const rows = await QueryServiceV1.ejecutarProcedimiento(read_query, [idsede_categoria, codigo_postal, idsede, point_client], 'getEstablecimientos');
    return ReS(res, { data: rows || [] });
}
module.exports.getEstablecimientos = getEstablecimientos;

const getParametrosTiendaLinea = async function(req, res) {
    const idsede = req.body.idsede
    if (!idsede) {
        return ReE(res, 'idsede es requerido');
    }
    const read_query = `select parametros from sede_costo_delivery where idsede=?`;
    const rows = await QueryServiceV1.ejecutarConsulta(read_query, [idsede], 'SELECT', 'getParametrosTiendaLinea');
    return ReS(res, { data: rows || [] });
}
module.exports.getParametrosTiendaLinea = getParametrosTiendaLinea;

const getEstablecimientosPromociones = async function (req, res) {
	const ciudad = String(req.body.ciudad || ''); // lo cambiamos por ciudad
    // CALL -> ejecutarProcedimiento para conservar el desempaquetado Object.values(rows[0])
    const read_query = `call procedure_pwa_delivery_establecimiento_promo(?)`;
    const rows = await QueryServiceV1.ejecutarProcedimiento(read_query, [ciudad], 'getEstablecimientosPromociones');
    return ReS(res, { data: rows || [] });
}
module.exports.getEstablecimientosPromociones = getEstablecimientosPromociones;


const getDireccionCliente = async function (req, res) {	
	// const idcliente = req.body.idcliente;
    // // // const read_query = `SELECT * from cliente_pwa_direccion where idcliente = ${idcliente} and estado = 0`;
    // const read_query = `SELECT cpd.*, sc.options from cliente_pwa_direccion cpd	left join sede_config_service_delivery sc on UPPER(sc.ciudad) = UPPER(cpd.ciudad) where cpd.idcliente = ${idcliente} and cpd.estado = 0`
    // return await emitirRespuesta_RES(read_query, res);        

    const idcliente = req.body.idcliente;

    // Validar que existe
    if (!idcliente) {
        return ReE(res, 'idcliente es requerido');
    }

    const read_query = `
        SELECT cpd.*, sc.options 
        FROM cliente_pwa_direccion cpd
        LEFT JOIN sede_config_service_delivery sc ON UPPER(sc.ciudad) = UPPER(cpd.ciudad) 
        WHERE cpd.idcliente = ? AND cpd.estado = 0
    `;

    const rows = await QueryServiceV1.ejecutarConsulta(read_query, [idcliente], 'SELECT', 'getDireccionCliente');
    return ReS(res, { data: rows || [] });
}
module.exports.getDireccionCliente = getDireccionCliente;


const getMisPedido = async function (req, res) {
	// Number() y no parseInt(): parseInt('1 or 1=1') devuelve 1 y aceptaría basura como id
	const idcliente = Number(req.body.idcliente);
	if (!Number.isInteger(idcliente) || idcliente <= 0) {
		return ReE(res, 'idcliente inválido', 400);
	}
    const query = `call procedure_pwa_delivery_mis_pedidos(?);`;
    const rows = await QueryServiceV1.ejecutarProcedimiento(query, [idcliente], 'getMisPedido');
    return ReS(res, { data: rows || [] });
}
module.exports.getMisPedido = getMisPedido;


// Ruta sin autenticar: el telefono y el codigo llegan del navegador, asi que se validan
// con formato estricto y se mandan como parametros preparados (antes se interpolaban en el SQL).
const verificarCodigoSMS = async function (req, res) {
	const idcliente = Number(req.body.idcliente);
	const numberphone = String(req.body.numberphone || '');
	const codigo = String(req.body.codigo || '');

	const datosValidos = Number.isInteger(idcliente) && idcliente > 0
		&& /^[0-9]{6,15}$/.test(numberphone)
		&& /^[0-9]{4,8}$/.test(codigo);

	if (!datosValidos) {
		return ReE(res, 'datos inválidos', 400);
	}

	const query = `call porcedure_pwa_update_phono_sms_cliente(?,?,?);`;
	const rows = await QueryServiceV1.ejecutarProcedimiento(query, [idcliente, numberphone, codigo], 'verificarCodigoSMS');
	return ReS(res, { data: rows || [] });
}
module.exports.verificarCodigoSMS = verificarCodigoSMS;


const setCalificarServicio = async function (req, res) {
	const dataCalificacion = req.body.dataCalificacion;
	if (dataCalificacion === undefined || dataCalificacion === null) {
		return ReE(res, 'datos inválidos', 400);
	}
    // El JSON viaja como UN solo parámetro preparado: el comentario del cliente puede traer
    // comillas o backslashes y ya no hace falta mutilarlo antes de mandarlo al procedimiento.
    const read_query = `call procedure_pwa_delivery_calificacion(?)`;
    const rows = await QueryServiceV1.ejecutarProcedimiento(read_query, [JSON.stringify(dataCalificacion)], 'setCalificarServicio');
    return ReS(res, { data: rows || [] });
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
	const idcliente = req.body.idcliente;
    // const read_query = `SELECT * from cliente_pwa_direccion where idcliente = ${idcliente} and estado = 0`;
    const read_query = `SELECT p.idpedido, p.idsede, s.nombre nomestablecimiento
						from pedido p
							inner join sede s on s.idsede = p.idsede
						where p.idcliente = ? and p.flag_calificado = 0
						GROUP by p.idsede
						ORDER by p.idpedido desc limit 2`;
    const rows = await QueryServiceV1.ejecutarConsulta(read_query, [idcliente], 'SELECT', 'getComercioXCalificar');
    return ReS(res, { data: rows || [] });
}
module.exports.getComercioXCalificar = getComercioXCalificar;

const getTipoVehiculo = async function (req, res) {	
    const read_query = `Select * from tipo_vehiculo where estado=0`;
    return await emitirRespuesta_RES(read_query, res);        
}
module.exports.getTipoVehiculo = getTipoVehiculo;


const getAllSedesServiceExpress = async function (req, res) {
	const ciudad = String(req.body.ciudad || '');
    const read_query = `SELECT * from sede_config_service_delivery where estado = 0 and upper(ciudad) = upper(?)`;
    const rows = await QueryServiceV1.ejecutarConsulta(read_query, [ciudad], 'SELECT', 'getAllSedesServiceExpress');
    return ReS(res, { data: rows || [] });
}
module.exports.getAllSedesServiceExpress = getAllSedesServiceExpress;

const getComnisionAtm = async function (req, res) {
	// Number() y no parseInt(): parseInt('10 or 1=1') devuelve 10 y aceptaría basura como importe
	const importe = Number(req.body.importe);
	if (!Number.isFinite(importe)) {
		return ReE(res, 'datos inválidos', 400);
	}
    const read_query = `call procedure_calc_comsion_visa_atm(?)`;
    const rows = await QueryServiceV1.ejecutarProcedimiento(read_query, [importe], 'getComnisionAtm');
    return ReS(res, { data: rows || [] });
}
module.exports.getComnisionAtm = getComnisionAtm;

const setCashAtm = async function (req, res) {
	const obj = req.body;
    // El JSON completo viaja como un único parámetro preparado
    const read_query = `call procedure_set_cash_atm(?)`;
    const rows = await QueryServiceV1.ejecutarProcedimiento(read_query, [JSON.stringify(obj)], 'setCashAtm');
    return ReS(res, { data: rows || [] });
}
module.exports.setCashAtm = setCashAtm;

const setPedidoMandado = async function (req, res) {
	logger.debug('pedido_mandado === ', req.body.dataInfo);

	const obj = req.body.dataInfo;
	if (obj === undefined || obj === null) {
		return ReE(res, 'datos inválidos', 400);
	}
    // Ya no se recortan comillas ni escapes: el JSON va completo como parámetro preparado,
    // así la referencia/dirección del mandado llega tal cual la escribió el cliente.
    const read_query = `call procedure_guardar_pedido_mandado(?)`;
    const rows = await QueryServiceV1.ejecutarProcedimiento(read_query, [JSON.stringify(obj)], 'setPedidoMandado');
    return ReS(res, { data: rows || [] });
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
		where sc.idsede = ? and sc.calificacion >= 2
		GROUP by sc.idcliente
		order by sc.idsede_calificacion desc`;
    const rows = await QueryServiceV1.ejecutarConsulta(read_query, [idsede], 'SELECT', 'getCalificacionSede');
    return ReS(res, { data: rows || [] });
}
module.exports.getCalificacionSede = getCalificacionSede;


const getSharedUrlCarta = async function (req, res) {
	const idsede = req.body.idsede;
    // const read_query = `call procedure_generator_qr_mesa(${idsede})`;
    // return await emitirRespuestaSP_RES(read_query, res);    
    
    const query = `CALL procedure_generator_qr_mesa(?)`;
    const rows = await QueryServiceV1.ejecutarProcedimiento(query, [idsede], 'getSharedUrlCarta');
    return ReS(res, { data: rows });
}
module.exports.getSharedUrlCarta = getSharedUrlCarta;

const SearchClienteByPhone = async function (req, res) {
	const numTelefono = req.body.telefono;
    // const read_query = `select * from cliente where telefono = '${numTelefono}'  order by idcliente limit 1;`;
    const read_query = `select * from cliente where pwa_id = ?  order by idcliente limit 1;`;
    const rows = await QueryServiceV1.ejecutarConsulta(read_query, [`phone|${numTelefono}`], 'SELECT', 'SearchClienteByPhone');
    return ReS(res, { data: rows || [] });
}
module.exports.SearchClienteByPhone = SearchClienteByPhone;

const SearchClienteByPhonePwaId = async function (req, res) {
	const numTelefono = req.body.telefono;
    const read_query = `select * from cliente where pwa_id = ?  order by idcliente limit 1;`;
    const rows = await QueryServiceV1.ejecutarConsulta(read_query, [`phone|${numTelefono}`], 'SELECT', 'SearchClienteByPhonePwaId');
    return ReS(res, { data: rows || [] });
}
module.exports.SearchClienteByPhonePwaId = SearchClienteByPhonePwaId;

const getTelefonoClienteChatBot = async function (req, res) {
	// El procedimiento recibía el id entre comillas, así que se conserva como cadena
	// (los ids del bot no siempre son numéricos); sólo se exige que venga.
	const id = String(req.body.id || '').trim();
	if (!id) {
		return ReE(res, 'datos inválidos', 400);
	}
    const read_query = `call procedure_delivery_get_cliente_from_bot(?)`;
    const rows = await QueryServiceV1.ejecutarProcedimiento(read_query, [id], 'getTelefonoClienteChatBot');
    return ReS(res, { data: rows || [] });
}
module.exports.getTelefonoClienteChatBot = getTelefonoClienteChatBot;



// function emitirRespuesta(xquery, res) {
// 	return sequelize.query(xquery, {type: QueryTypes.SELECT})
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
// 	return sequelize.query(xquery, {		
// 		type: QueryTypes.SELECT
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
// 	return sequelize.query(xquery, {type: QueryTypes.SELECT})
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
// 	sequelize.query(xquery, {		
// 		type: QueryTypes.SELECT
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