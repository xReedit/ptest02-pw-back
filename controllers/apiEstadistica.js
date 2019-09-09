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
                message: 'hello desde NATIVE API ESTADISTICA INIT version 1'
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

const getMetaSede = async function (req, res) {
        const idorg = managerFilter.getInfoToken(req,'idorg');
        const idsede = managerFilter.getInfoToken(req, 'idsede');
        
        let read_query = `SELECT * from sede_meta where(idorg = ${idorg} and idsede = ${idsede}) and estado = 0`;        

        emitirRespuesta(read_query, res);

}
module.exports.getMetaSede = getMetaSede;

const setMetaSede = async function (req, res) {
        const idorg = managerFilter.getInfoToken(req,'idorg');
        const idsede = managerFilter.getInfoToken(req, 'idsede');
        const metas = req.body;        
        
        
        let read_query = `call procedure_insert_update_metas(${idorg},${idsede},'${JSON.stringify(metas)}')`;

        emitirRespuesta(read_query, res);        

}
module.exports.setMetaSede = setMetaSede;

const getVentas = async function (req, res) {
	const idorg = managerFilter.getInfoToken(req,'idorg');
	const idsede = managerFilter.getInfoToken(req, 'idsede');

	// let read_query = `
	// SELECT *, rp.total as importe , DATE_FORMAT(CURDATE(), '%d/%m/%Y') as f_actual
	// from registro_pago as rp		
	// 	left join cliente as c using(idcliente)
	// where(rp.idorg = ${idorg} and rp.idsede = ${idsede}) and(rp.estado = 0)
	// order by rp.idregistro_pago desc
	// `;

	let read_query = `CALL procedure_dash_ventas(${idorg}, ${idsede})`;


	emitirRespuestaSP(read_query, res);
}
module.exports.getVentas = getVentas;

const getConsumo = async function (req, res) {
	const idorg = managerFilter.getInfoToken(req,'idorg');
	const idsede = managerFilter.getInfoToken(req, 'idsede');

	let read_query = `
	SELECT *, CONCAT(p.fecha,' ',p.hora) fecha_hora_a, pd.ptotal_r as total_a, tpc.descripcion as tpc_descripcion
	from pedido as p	
		inner join pedido_detalle as pd on p.idpedido=pd.idpedido
		inner join tipo_consumo as tpc on pd.idtipo_consumo = tpc.idtipo_consumo
		inner join seccion as s on pd.idseccion=s.idseccion
		inner join categoria as c on pd.idcategoria=c.idcategoria
		left join item as i on pd.iditem=i.iditem
	where p.idorg=${idorg} and p.idsede=${idsede} and (p.estado=2 and pd.estado=0)	
	`;

	emitirRespuesta(read_query, res);
}
module.exports.getConsumo = getConsumo;


const getIngresosGastos = async function (req, res) {
	const idorg = managerFilter.getInfoToken(req,'idorg');
	const idsede = managerFilter.getInfoToken(req, 'idsede');
	const arr = req.body;
	
	let read_query = `CALL procedure_dash_ingresos_egresos(${idorg}, ${idsede}, '${JSON.stringify(arr)}')`;
	
	emitirRespuesta(read_query, res);

}
module.exports.getIngresosGastos = getIngresosGastos;

const getSedes = async function (req, res) {
	const idorg = managerFilter.getInfoToken(req,'idorg');		
	
	let read_query = `SELECT s.idsede, concat (s.nombre,' ', s.ciudad) nombre
					from sede s 
					inner join usuario u using(idsede)
					where u.idorg=${idorg} and u.rol=1 and u.estado=0 
					order by s.nombre`;
	
	emitirRespuesta(read_query, res);

}
module.exports.getSedes = getSedes;


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