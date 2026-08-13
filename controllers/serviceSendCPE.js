// puente CPE: restobar (tabla ce) <-> apifacturalo
//
// 2026-08 REESCRITO: el ciclo de vida SUNAT (reintento de facturas, resumen
// diario de boletas, consulta de tickets) vive AHORA en el CronSunat de
// apifacturalo_a (comandos sunat:retry-send / sunat:build-summary /
// sunat:consult-tickets). Este archivo quedo reducido a los DOS puentes que
// solo backend-pedidos puede hacer, por ser el unico con acceso a la BD restobar:
//
//   A) syncOffline: sube al API los comprobantes emitidos sin conexion
//      (ce.estado_api=1) de los ultimos N dias (antes: una sola pasada a las
//      02:00 y solo "ayer" — si fallaba, la boleta quedaba invisible para
//      SUNAT para siempre).
//   B) syncEstados: refleja en ce el estado REAL del API (GET /api/records),
//      documento por documento. Reemplaza a marcarBoletasAceptas, que marcaba
//      'Aceptado' POR FECHA aunque la boleta no estuviera en ningun resumen.
//
// Eliminados: sendResumen / saveResumen / consultaTicketResumen /
// marcarBoletasAceptas / sendRetryOneCpe / listBoletasResumen.
// Los nombres exportados viejos se conservan como alias para no tocar
// routes/v3.js ni el cron externo que pega a /v3/cpe/cocinar.

const { to, ReE, ReS }  = require('../service/uitl.service');
let Sequelize = require('sequelize');
let config = require('../_config');

const fetch = require("node-fetch");
const logger = require('../utilitarios/logger');
let sequelize = new Sequelize(config.database, config.username, config.password, config.sequelizeOption);

const URL_COMPROBANTE = 'https://apifac.papaya.com.pe/api';
const DIAS_VENTANA = 7; // mismo plazo legal del resumen diario

var runCountPedidos = false;
var syncEnProceso = false;

// ---------------------------------------------------------------------------
// scheduler propio (solo si se activa desde app.js; hoy el cron externo pega
// a las rutas /v3/cpe/*). Conserva las tareas de mantenimiento que vivian aca.
// ---------------------------------------------------------------------------
const activarEnvioCpe = async function () {
	const minInterval = 600000; // cada 10min

	setInterval(() => {
		const date_now = new Date();
		const hoursNow = date_now.getHours();
		const dayWeek = date_now.getDay();

		if ( hoursNow === 2 && !syncEnProceso ) { // 02:00 sync completo
			runSyncCpe();
		}

		if ( hoursNow === 4  ) { // 04:00 am borra print detalle y cuadres anteriores
			xLimpiarPrintDetalle();
		}

		if ( dayWeek === 1 && hoursNow === 4 && !runCountPedidos ) { // lunes 04:00
			runCountPedidos = true;
			emitirRespuesta('call procedure_count_pedidos_delivery_sede()');
		}

		if ( dayWeek != 2) {
			runCountPedidos = false;
		}

	}, minInterval);
}
module.exports.activarEnvioCpe = activarEnvioCpe;

// ---------------------------------------------------------------------------
// sync principal: para cada sede con facturacion, sube offline y refresca estados
// ---------------------------------------------------------------------------
const runSyncCpe = async function (dias = DIAS_VENTANA) {
	if (syncEnProceso) { return { skipped: true }; }
	syncEnProceso = true;
	const stats = { sedes: 0, offline_ok: 0, offline_error: 0, estados_actualizados: 0, errores: 0 };

	try {
		const lista_sedes = await getSedesCPE();
		for (const sede of lista_sedes) {
			stats.sedes++;
			try {
				const s1 = await syncOfflineSede(sede, dias);
				stats.offline_ok += s1.ok;
				stats.offline_error += s1.error;

				const s2 = await syncEstadosSede(sede, dias);
				stats.estados_actualizados += s2.actualizados;
			} catch (e) {
				stats.errores++;
				logger.error(`syncCpe sede ${sede.idsede}: ${e.message}`);
			}
		}
	} finally {
		syncEnProceso = false;
	}

	logger.debug('syncCpe fin ' + JSON.stringify(stats));
	return stats;
}
module.exports.runSyncCpe = runSyncCpe;

// A) comprobantes emitidos offline: registrarlos en el API
async function syncOfflineSede(sede, dias) {
	const rpt = { ok: 0, error: 0 };
	const sql = `select idce, numero, json_xml from ce
		where idsede = ${sede.idsede} and estado_api = 1 and estado = 0 and anulado = 0
		and STR_TO_DATE(fecha, '%d/%m/%Y') >= (CURDATE() - INTERVAL ${dias} DAY)`;
	const lista = await emitirRespuesta(sql);
	if (!lista || lista.length === 0) { return rpt; }

	for (const el_cpe of lista) {
		try {
			const rpt_cpe = await sendOneCpe(el_cpe.json_xml, sede.authorization_api_comprobante);
			const descripcion = rpt_cpe.response?.description || rpt_cpe.message || '';
			const yaRegistrado = descripcion.indexOf('ya se encuentra registrado') > -1;

			if (rpt_cpe.success || yaRegistrado) {
				// estado_sunat NO se toca aca: la verdad la pone syncEstados
				// leyendo el estado real del API (aceptado solo con CDR/resumen).
				const external_id = rpt_cpe.data?.external_id || '';
				const setExternal = external_id ? `, external_id='${sqlEscape(external_id)}'` : '';
				await emitirRespuesta(`update ce set estado_api=0, msj='Registrado', pdf=1, xml=1 ${setExternal} where idce=${el_cpe.idce}`);
				rpt.ok++;
			} else {
				await emitirRespuesta(`update ce set msj='${sqlMsj(descripcion || 'Error al registrar')}' where idce=${el_cpe.idce}`);
				rpt.error++;
			}
		} catch (e) {
			rpt.error++;
			logger.error(`syncOffline idce ${el_cpe.idce}: ${e.message}`);
		}
	}
	return rpt;
}

// B) reflejar en ce el estado real del API, documento por documento
async function syncEstadosSede(sede, dias) {
	const rpt = { actualizados: 0 };
	const hoy = new Date();
	const desde = new Date(hoy.getTime() - dias * 86400000);
	const date_from = desde.toJSON().slice(0, 10);
	const date_to = hoy.toJSON().slice(0, 10);

	let page = 1;
	const per_page = 100;
	while (true) {
		const url = `${URL_COMPROBANTE}/records?date_from=${date_from}&date_to=${date_to}&per_page=${per_page}&page=${page}&include=light`;
		const res = await fetch(url, {
			headers: { 'Authorization': 'Bearer ' + sede.authorization_api_comprobante }
		}).then(r => r.json());

		const registros = res?.data || [];
		for (const rec of registros) {
			const n = await updateEstadoCe(sede.idsede, rec);
			rpt.actualizados += n;
		}

		if (registros.length < per_page) { break; }
		page++;
		if (page > 200) { break; } // ponytail: tope duro anti-loop
	}
	return rpt;
}

// match por external_id; fallback serie+numero (ce pad 7 ceros vs API sin pad) + fecha
async function updateEstadoCe(idsede, rec) {
	const arrNum = String(rec.numero || '').split('-');
	if (arrNum.length !== 2) { return 0; }
	const serie = sqlEscape(arrNum[0]);
	const numInt = parseInt(arrNum[1], 10) || 0;

	const matchExternal = rec.external_id ? `external_id = '${sqlEscape(rec.external_id)}' or ` : '';
	const sql = `update ce set
			estado_api = ${parseInt(rec.estado_api, 10) || 0},
			estado_sunat = ${parseInt(rec.estado_sunat, 10) || 0},
			cdr = ${rec.cdr === '1' ? 1 : 0},
			msj = '${sqlMsj(rec.msj || '')}'
		where idsede = ${idsede} and (
			${matchExternal}(SUBSTRING_INDEX(numero,'-',1) = '${serie}'
				and CAST(SUBSTRING_INDEX(numero,'-',-1) AS UNSIGNED) = ${numInt}
				and fecha = '${sqlEscape(rec.fecha)}')
		)`;

	const r = await sequelize.query(sql, { type: sequelize.QueryTypes.BULKUPDATE }).catch((e) => {
		logger.error(`syncEstados update ${rec.numero}: ${e.message}`);
		return 0;
	});
	return r ? 1 : 0;
}

// ---------------------------------------------------------------------------
// endpoints HTTP (alias con los nombres viejos para no tocar routes/v3.js
// ni el cron externo)
// ---------------------------------------------------------------------------

// GET /v3/cpe/cocinar — antes: envio + resumen; ahora: sync completo
const cocinarEnvioCPE = async function (req, res) {
	const stats = await runSyncCpe();
	if (res) { return ReS(res, { data: stats }); }
}
module.exports.cocinarEnvioCPE = cocinarEnvioCPE;

// POST /v3/cpe/cocinar-by-fecha {fecha: 'YYYY-MM-DD'} — sync ampliando la
// ventana hasta cubrir esa fecha
const cocinarEnvioByFecha = async function (req, res) {
	const fecha = req.body.fecha;
	let dias = DIAS_VENTANA;
	if (fecha) {
		const diff = Math.ceil((Date.now() - new Date(fecha).getTime()) / 86400000);
		dias = Math.max(diff + 1, 1);
	}
	const stats = await runSyncCpe(dias);
	if (res) { return ReS(res, { data: stats }); }
}
module.exports.cocinarEnvioByFecha = cocinarEnvioByFecha;

// GET /v3/cpe/verificar_resumen — antes: consulta ticket resumen; ahora: solo
// refresco de estados (el ciclo del resumen vive en el API)
const cocinarRespuestaResumenCPE = async function (req, res) {
	const stats = { estados_actualizados: 0 };
	const lista_sedes = await getSedesCPE();
	for (const sede of lista_sedes) {
		try {
			const s = await syncEstadosSede(sede, DIAS_VENTANA);
			stats.estados_actualizados += s.actualizados;
		} catch (e) {
			logger.error(`verificar_resumen sede ${sede.idsede}: ${e.message}`);
		}
	}
	logger.debug('finalizando sync estados cpe');
	if (res) { return ReS(res, { data: stats }); }
}
module.exports.cocinarRespuestaResumenCPE = cocinarRespuestaResumenCPE;

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

async function getSedesCPE() {
	const sql_sedes = "select idorg,idsede,nombre,ciudad, authorization_api_comprobante, id_api_comprobante from sede where facturacion_e_activo = 1 and estado=0 order by idsede asc";
	return await emitirRespuesta(sql_sedes);
}

async function sendOneCpe(json_xml, token) {
	return await fetch(URL_COMPROBANTE + '/documents', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
			body: json_xml
		}).then(res => res.json());
}

function sqlEscape(str) {
	return String(str).replace(/\\/g, '\\\\').replace(/'/g, "''");
}

// ce.msj es varchar(200) en todas las sedes. Desde 2026-08 el API devuelve el
// motivo REAL de SUNAT en ese campo, y esos mensajes se pasan de largo:
//   "2255 - El XML no contiene el tag PaidAmount - Detalle: value='ticket: ...'"
// son ~250 caracteres. Sin recortar, el UPDATE muere con 1406 (Data too long)
// en modo estricto y el cajero se queda sin ver justo el rechazo mas informativo.
// Se recorta ANTES de escapar: cortar despues partiria un '' a la mitad.
const MSJ_MAX = 200;
module.exports.sqlMsj = sqlMsj; // export solo para test/cpe-sqlmsj.test.js
function sqlMsj(str) {
	let s = String(str == null ? '' : str);
	if (s.length > MSJ_MAX) {
		s = s.slice(0, MSJ_MAX - 3) + '...';
	}
	return sqlEscape(s);
}

// 04:00 limpia la tabla para mantenerla ligera
function xLimpiarPrintDetalle () {
	emitirRespuesta('call procedure_remove_print_detalle()');
}

function emitirRespuesta(xquery) {
	return sequelize.query(xquery, {type: sequelize.QueryTypes.SELECT})
	.then(function (rows) {
		return rows;
	})
	.catch((err) => {
		logger.error('emitirRespuesta: ' + err.message);
		return false;
	});
}
