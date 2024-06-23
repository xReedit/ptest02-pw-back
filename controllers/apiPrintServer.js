const { to, ReE, ReS }  = require('../service/uitl.service');
let {Sequelize, QueryTypes} = require('sequelize');
// let config = require('../config');
let config = require('../_config');
let managerFilter = require('../utilitarios/filters');

let sequelize = new Sequelize(config.database, config.username, config.password, config.sequelizeOption);

let mysql_clean = function (string) {
        return sequelize.getQueryInterface().escape(string);
};

const socketPrintServerClient = async function (data, socket) {

	// para loguearse version para android
	socket.on('get-user-print-server-session', async (payload, callback) => {
		console.log('get-user-print-server-session', payload);
		const rptUser = await loginUserPrintServer(payload)
		console.log('rptUser', rptUser);
		callback({ data: rptUser });
	});
	
	const idsedeSocket = data.idsede;
	if ( idsedeSocket == '0' ) {
		console.log('API print server USER APP', data);
		return;
	}
	
	console.log('LLego al API print server ====================================== ', data);

	// url local
	const urlLocal = await getIpUrlLocal(idsedeSocket);

	// logo local
	const logoLocal = await getLogoLocal(idsedeSocket);	

	// registros no impresos 
	// 101023 quitamos porque va con el mix
	// const lastRowsNoPrint = await getRegisterNoPrint(data);
	const lastRowsNoPrint = [];

	// primero pasar las estructuras
	// let _payload;
	try {
		const _estructuras = await getEsctructuras();		
		const _payload = {
			estructura: _estructuras,
			logo: logoLocal,
			url: 'http://'+urlLocal[0].ip_server_local,
			rows_print: lastRowsNoPrint
		}

		socket.emit('get-ps-estructuras', _payload);

		// console.log('urlLocal ============ ', urlLocal);
		// console.log('_payload ============ ', _payload);		
	} catch(e) {
		console.log('error print-server', urlLocal);
		return;
	}

	// console.log('_payload ============ ', _payload);	

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
		// quitar duplicados
		// const list = Array.from(new Set(data.map(item => item.id))).map(id => {
		//     return data.find(item => item.id === id);
		// });

		console.log('set-ps-status-list-item', list);		
		setStatusListItem(list);
	});

}
module.exports.socketPrintServerClient = socketPrintServerClient;

async function loginUserPrintServer(payload) {
	const {username, password} = payload
	const query = `
		SELECT idorg o, idsede s
		FROM usuario 
		WHERE usuario = :username AND pass = :password
	`;

	const replacements = { username, password };

	const result = await sequelize.query(query, {
		replacements: replacements,
		type: QueryTypes.SELECT
	});

	if (!result || result.length === 0) {
		return false;
	}

	const base64Response = Buffer.from(JSON.stringify(result[0])).toString('base64');

	return base64Response;
}


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
let debounceTimes = {};
let debounceKeys = [];
function getRegisterNoPrint(data) {
	const now = Date.now();
    const key = `${data.idsede}_${data.ultimoid || 'none'}`;
    const lastTime = debounceTimes[key];

	if (lastTime && now - lastTime < 3000) {
		console.log('getRegisterNoPrint menos de 3seg');
        // Si la última solicitud fue hace menos de 5 segundos, no procesar la solicitud
        // return Promise.reject(new Error('Too Many Requests'));
		return Promise.resolve({ success: false, error: 'Too Many Requests' });
    }

	debounceTimes[key] = now;
    debounceKeys.push(key);

	// Si debounceTimes tiene más de 30 elementos, eliminar los primeros 20
    if (debounceKeys.length > 60) {
        for (let i = 0; i < 40; i++) {
            const keyToRemove = debounceKeys.shift();
            delete debounceTimes[keyToRemove];
        }
    }


	const ultimoId = data.ultimoid ? 'and idprint_server_detalle >' + data.ultimoid : '';		
	const sql = `SELECT psd.*, pse.nom_documento
						FROM print_server_detalle as psd
							INNER JOIN print_server_estructura as pse on pse.idprint_server_estructura = psd.idprint_server_estructura							
					WHERE (psd.idsede=${data.idsede} and psd.impreso=0) 
						and psd.estado=0 ${ultimoId}
						and  TIMESTAMPDIFF(MINUTE, STR_TO_DATE(concat(psd.fecha, ' ', psd.hora), '%d/%m/%Y %H:%i:%s'),DATE_FORMAT(now(), '%Y-%m-%d %H:%i:%s')) < 20						
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



const emitirRespuesta = async (xquery) => {
    console.log(xquery);		
    try {
		// evaluea si es update o inser
        // return await sequelize.query(xquery, { type: sequelize.QueryTypes.SELECT });
		const queryType = xquery.trim().toLowerCase().startsWith('update') ? sequelize.QueryTypes.UPDATE : sequelize.QueryTypes.SELECT;
        return await sequelize.query(xquery, { type: queryType });
    } catch (err) {
        console.error(err);
        return false;
    }
};


// async function emitirRespuesta(xquery) {
// 	// console.log(xquery);
// 	return await sequelize.query(xquery, {type: sequelize.QueryTypes.SELECT})
// 	.then(function (rows) {
// 		return rows;
// 	})
// 	.catch((err) => {
// 		return false;
// 	});
// }



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