const { to, ReE, ReS }  = require('../service/uitl.service');
let Sequelize = require('sequelize');
let config = require('../config');
let managerFilter = require('../utilitarios/filters');

let sequelize = new Sequelize(config.database, config.username, config.password, config.sequelizeOption);

let mysql_clean = function (string) {
        return sequelize.getQueryInterface().escape(string);
};

const socketPrintServerClient = async function (data, socket) {

	const idsedeSocket = data.idsede;
	console.log('LLego al API print server ====================================== ', data);

	// url local
	const urlLocal = await getIpUrlLocal(idsedeSocket);

	// logo local
	const logoLocal = await getLogoLocal(idsedeSocket);	

	// registros no impresos
	const lastRowsNoPrint = await getRegisterNoPrint(data);

	// primero pasar las estructuras
	const _estructuras = await getEsctructuras();
	const _payload = {
		estructura: _estructuras,
		logo: logoLocal,
		url: 'http://'+urlLocal[0].ip_server_local,
		rows_print: lastRowsNoPrint
	}
	socket.emit('get-ps-estructuras', _payload);


	// solicita cada 10segundos
	socket.on('get-ps-max-print', async (payload) => {
		const rowsNoPrint = await getRegisterNoPrint(payload);
		socket.emit('get-ps-max-print-res', rowsNoPrint);		
	});

	// cambiar status impreso o error
	socket.on('set-ps-status-item', async (item) => {		
		console.log('set-ps-status-item', item);		
		setStatusItem(item);
	});

	// cambiar status impreso toda la lista
	socket.on('set-ps-status-list-item', async (list) => {		
		console.log('set-ps-status-list-item', list);		
		setStatusListItem(list);
	});

}
module.exports.socketPrintServerClient = socketPrintServerClient;


function setStatusItem(item) {
	const _error = item.success == true ? '0' : '1';
	const _impreso = item.success == true ? '1' : '0';	
	let sql = '';

	// guadar como
	if ( item.success ) {
		sql = `update print_server_detalle set impreso = 1, error = 0 where idprint_server_detalle in(${item.id}); `;
		// emitirRespuesta(sql);

		// notifica pedido visto
		if ( item.idp !== '' ) {
			sql += `update pedido set pwa_estado='A', is_printer = 1 where idpedido in(${item.idp}) and pwa_estado='P';`;
			// emitirRespuesta(sql);
		}				
	} else {
		sql = `update print_server_detalle set impreso = 0, error = 1 where idprint_server_detalle = ${item.id};`;			
	}

	emitirRespuesta(sql);
}

// todo una lista
function setStatusListItem(list) {
	const idsPrint = list.map(x => x.id).join() || '';
	const idsPedidos = list.map(x => x.idp).join() || '';
	let sqlPrint = '';
	let sqlVisto = '';

	if (idsPrint !== '') {
		sqlPrint = `update print_server_detalle set impreso = 1, error = 0 where idprint_server_detalle in(${idsPrint});`;		
	}
	if (idsPedidos !== '') {
		sqlVisto = `update pedido set pwa_estado='A', is_printer = 1 where idpedido in(${idsPedidos}) and pwa_estado='P';`;			
	}

	const _sql = sqlPrint+' '+ sqlVisto;
	console.log('_sql === > ', _sql);
	emitirRespuesta(_sql);

	console.log('idsPrint ==== ', idsPrint);
	console.log('idsPedidos ==== ', idsPedidos);
}

function getMaxIdPrint(data) {
	const ultimoId = data.ultimoid ? 'and idprint_server_detalle >' + data.ultimoid : '';		
	const sql = `SELECT MAX(idprint_server_detalle) FROM print_server_detalle where (idsede=${data.idsede} and impreso=0) ${ultimoId} limit 2`;
	return emitirRespuesta(sql);
}

// obtiene los registros que no se imprimieron
function getRegisterNoPrint(data) {
	const ultimoId = data.ultimoid ? 'and idprint_server_detalle >' + data.ultimoid : '';		
	const sql = `SELECT psd.*, pse.nom_documento
						FROM print_server_detalle as psd
							INNER JOIN print_server_estructura as pse on pse.idprint_server_estructura = psd.idprint_server_estructura							
					WHERE (psd.idsede=${data.idsede} and psd.impreso=0) 
						and  TIMESTAMPDIFF(MINUTE, STR_TO_DATE(concat(psd.fecha, ' ', psd.hora), '%d/%m/%Y %H:%i:%s'),DATE_FORMAT(now(), '%Y-%m-%d %H:%i:%s')) < 20
						and psd.estado=0 ${ultimoId}
						or (psd.isreserva = 1 and psd.impreso = 0)
					ORDER BY psd.idprint_server_detalle DESC limit 30`;
	return emitirRespuesta(sql);
}

function getEsctructuras() {
	const sql = "SELECT nom_documento, v, estructura_json FROM print_server_estructura where estado=0";
	return emitirRespuesta(sql);
}


function getIpUrlLocal(idsedeSocket) {
	const sql=`select ip_server_local, isprinter_socket from sede where idsede=${idsedeSocket}`;
	return emitirRespuesta(sql);
}

function getLogoLocal(idsedeSocket) {
	const sql = `SELECT logo64 FROM sede where idsede=${idsedeSocket}`;
	return emitirRespuesta(sql)
;}





async function emitirRespuesta(xquery) {
	// console.log(xquery);
	return await sequelize.query(xquery, {type: sequelize.QueryTypes.SELECT})
	.then(function (rows) {
		return rows;
	})
	.catch((err) => {
		return false;
	});
}






function emitirRespuesta_RES(xquery, res) {
	// console.log(xquery);
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