/**
 * apiRepartidorV2.js — endpoints y loop de asignación para la app de repartidores 2.0 (pwa-app-repartidor-new).
 *
 * Convive con apiRepartidor.js SIN modificarlo: la app anterior sigue usando /v3/repartidor/*.
 * Regla: toda mutación llega por HTTP y se valida aquí; socket y push solo avisan "refresca"
 * (evento 'repartidor-estado-cambio'). La app reconstruye su lista con GET /v3/repartidor2/mi-estado.
 *
 * Spec: pwa-app-repartidor-new/docs/superpowers/specs/2026-09-08-propuesta-asignacion-pedidos.md
 * Rutas: routes/routesRepartidorV2.js (montadas en routes/v3.js como /repartidor2).
 * Loop:  colocarPedidoEnRepartidor se activa con REPARTIDOR_LOOP_V2=1 (ver runLoopSearchRepartidor en apiRepartidor.js).
 */
const { ReE, ReS } = require('../service/uitl.service');
const managerFilter = require('../utilitarios/filters');
const logger = require('../utilitarios/logger');
const QueryServiceV1 = require('../service/query.service.v1');
const socketManager = require('../service/socket.manager');
const apiRepartidor = require('./apiRepartidor.js');
const apiComercio = require('./apiComercio.js');
const sendMsjsService = require('./sendMsj.js');

/** Cuánto vive una oferta antes de pasar al siguiente repartidor. El push tarda 5-40 s en llegar y la app 10 s en abrir. */
const OFERTA_VENTANA_MS = 120000;
/** Pedidos con más días que esto no cuentan como activos (basura de versiones anteriores). */
const DIAS_PEDIDO_ACTIVO = 2;

const getIO = () => { try { return socketManager.getIO(); } catch (e) { return null; } };

const parseJson = (v) => {
	if (typeof v !== 'string') return v;
	try { return JSON.parse(v); } catch (e) { return null; }
};

const idsDesde = (valor) => String(valor || '').split(',').map(id => parseInt(id, 10)).filter(Number.isInteger);

// ---------------------------------------------------------------------------------------------
// Utilidades
// ---------------------------------------------------------------------------------------------

/** Registro en repartidor_evento_log. Nunca lanza: si falla, solo se pierde el log. */
const logEvento = function (idrepartidor, idpedido, evento, canal = null, detalle = null) {
	if (!idrepartidor) return;
	const sql = `INSERT INTO repartidor_evento_log (idrepartidor, idpedido, evento, canal, detalle) VALUES (?, ?, ?, ?, ?)`;
	QueryServiceV1.ejecutarConsulta(sql, [idrepartidor, idpedido || null, evento, canal, detalle ? JSON.stringify(detalle) : null], 'INSERT', 'logEvento');
};
module.exports.logEvento = logEvento;

/** Aviso genérico a la app: "tu estado cambió, vuelve a pedir GET /repartidor2/mi-estado". */
const emitEstadoCambio = function (socketid) {
	const io = getIO();
	if (io && socketid) io.to(socketid).emit('repartidor-estado-cambio');
};
module.exports.emitEstadoCambio = emitEstadoCambio;

const socketidDeRepartidor = async function (idrepartidor) {
	const rows = await QueryServiceV1.ejecutarConsulta(`SELECT socketid FROM repartidor WHERE idrepartidor = ?`, [idrepartidor], 'SELECT', 'socketidDeRepartidor');
	return rows?.[0]?.socketid || null;
};

// ---------------------------------------------------------------------------------------------
// GET /repartidor2/mi-estado
// ---------------------------------------------------------------------------------------------

/**
 * Estado completo del repartidor calculado desde las tablas (no desde el JSON pedido_por_aceptar).
 * { oferta: null | { pedidos, detalle, importe_pagar, expira_en, ... }, asignados: [...], ocupado, online, servidor_hora }
 */
const getMiEstado = async function (req, res) {
	const idrepartidor = managerFilter.getInfoToken(req, 'idrepartidor');
	if (!idrepartidor) return ReE(res, 'token sin idrepartidor', 401);

	const rep = await QueryServiceV1.ejecutarConsulta(
		`SELECT ocupado, online, flag_paso_pedido, pedido_por_aceptar FROM repartidor WHERE idrepartidor = ?`,
		[idrepartidor], 'SELECT', 'getMiEstado');
	const r = rep[0] || {};

	const asignados = await QueryServiceV1.ejecutarConsulta(
		`SELECT p.*, ptle.time_line
		   FROM pedido p LEFT JOIN pedido_time_line_entrega ptle USING (idpedido)
		  WHERE p.idrepartidor = ? AND p.estado != 3
		    AND COALESCE(p.pwa_delivery_status, '0') NOT IN ('4', '5')
		    AND p.fecha_hora >= NOW() - INTERVAL ${DIAS_PEDIDO_ACTIVO} DAY
		  ORDER BY p.fecha_hora`,
		[idrepartidor], 'SELECT', 'getMiEstado');

	let oferta = null;
	const ppa = parseJson(r.pedido_por_aceptar);
	const vigente = ppa && Array.isArray(ppa.pedidos) && ppa.pedidos.length > 0 && r.flag_paso_pedido
		&& (!ppa.expira_en || Number(ppa.expira_en) > Date.now());
	if (vigente) {
		const detalle = await QueryServiceV1.ejecutarConsulta(
			`SELECT p.* FROM pedido p WHERE p.idpedido IN (?) AND COALESCE(p.idrepartidor, 0) = 0 AND p.estado != 3`,
			[ppa.pedidos], 'SELECT', 'getMiEstado');
		if (detalle.length > 0) {
			oferta = { ...ppa, pedidos: detalle.map(p => p.idpedido), detalle, expira_en: ppa.expira_en || null };
		}
	}

	return ReS(res, { data: { oferta, asignados, ocupado: r.ocupado || 0, online: r.online || 0, servidor_hora: Date.now() } });
};
module.exports.getMiEstado = getMiEstado;

// ---------------------------------------------------------------------------------------------
// POST /repartidor2/set-asignar-pedido  { idpedido: "12,13" }
// ---------------------------------------------------------------------------------------------

/** El repartidor acepta la oferta. Solo toma pedidos que sigan sin repartidor (o que ya sean suyos, para reintentos). */
const setAsignarPedido = async function (req, res) {
	const idrepartidor = managerFilter.getInfoToken(req, 'idrepartidor');
	const listIdPedido = idsDesde(req.body.idpedido);
	if (!idrepartidor || listIdPedido.length === 0) return ReE(res, 'idpedido requerido', 400);

	try {
		// si el repartidor tiene una oferta registrada, solo puede aceptar los pedidos de esa oferta
		const rep = await QueryServiceV1.ejecutarConsulta(`SELECT pedido_por_aceptar FROM repartidor WHERE idrepartidor = ?`, [idrepartidor], 'SELECT', 'setAsignarPedidoV2');
		const ofertaActual = parseJson(rep?.[0]?.pedido_por_aceptar);
		if (ofertaActual && Array.isArray(ofertaActual.pedidos) && ofertaActual.pedidos.length > 0) {
			const ofrecidos = ofertaActual.pedidos.map(Number);
			if (!listIdPedido.every(id => ofrecidos.includes(id))) {
				logEvento(idrepartidor, listIdPedido[0], 'aceptar_rechazado', 'http', { pedidos: listIdPedido, motivo: 'fuera_de_oferta' });
				return ReE(res, 'El pedido no está en tu oferta actual', 409);
			}
		}

		await QueryServiceV1.ejecutarConsulta(
			`UPDATE pedido SET idrepartidor = ? WHERE idpedido IN (?) AND estado != 3 AND (COALESCE(idrepartidor, 0) = 0 OR idrepartidor = ?)`,
			[idrepartidor, listIdPedido, idrepartidor], 'UPDATE', 'setAsignarPedidoV2');

		const mios = await QueryServiceV1.ejecutarConsulta(
			`SELECT COUNT(*) AS n FROM pedido WHERE idpedido IN (?) AND idrepartidor = ?`,
			[listIdPedido, idrepartidor], 'SELECT', 'setAsignarPedidoV2');

		if (Number(mios?.[0]?.n) !== listIdPedido.length) {
			// alguien más lo tomó (o la oferta expiró y se reasignó): limpiar mi oferta y avisar
			await QueryServiceV1.ejecutarConsulta(
				`UPDATE repartidor SET flag_paso_pedido = 0, pedido_por_aceptar = NULL WHERE idrepartidor = ? AND ocupado = 0`,
				[idrepartidor], 'UPDATE', 'setAsignarPedidoV2');
			logEvento(idrepartidor, listIdPedido[0], 'aceptar_rechazado', 'http', { pedidos: listIdPedido });
			return ReE(res, 'El pedido ya fue tomado por otro repartidor', 409);
		}

		await QueryServiceV1.ejecutarConsulta(
			`UPDATE repartidor SET ocupado = 1, pedido_paso_va = 1, flag_paso_pedido = 0 WHERE idrepartidor = ?`,
			[idrepartidor], 'UPDATE', 'setAsignarPedidoV2');

		// si otro repartidor tenía la misma oferta, se la quitamos y le avisamos
		const otros = await QueryServiceV1.ejecutarConsulta(
			`SELECT idrepartidor, socketid FROM repartidor WHERE flag_paso_pedido = ? AND idrepartidor != ?`,
			[listIdPedido[0], idrepartidor], 'SELECT', 'setAsignarPedidoV2');
		if (otros.length > 0) {
			await QueryServiceV1.ejecutarConsulta(
				`UPDATE repartidor SET flag_paso_pedido = 0, pedido_por_aceptar = NULL WHERE flag_paso_pedido = ? AND idrepartidor != ?`,
				[listIdPedido[0], idrepartidor], 'UPDATE', 'setAsignarPedidoV2');
			otros.forEach(o => { emitEstadoCambio(o.socketid); logEvento(o.idrepartidor, listIdPedido[0], 'oferta_quitada', 'http'); });
		}

		logEvento(idrepartidor, listIdPedido[0], 'aceptado', 'http', { pedidos: listIdPedido });
		return ReS(res, { data: true });
	} catch (err) {
		logger.error({ err }, 'error setAsignarPedidoV2');
		return ReE(res, err);
	}
};
module.exports.setAsignarPedido = setAsignarPedido;

// ---------------------------------------------------------------------------------------------
// POST /repartidor2/set-fin-pedido-entregado  (mismo body que v1 + time_line)
// ---------------------------------------------------------------------------------------------

/**
 * Entrega: el SP _v2 marca el pedido entregado y libera al repartidor si no le quedan activos.
 * Los avisos a comercio/restobar/monitor salen de aquí (antes salían de un socket que se perdía).
 */
const setFinPedidoEntregado = async function (req, res) {
	const obj = req.body || {};
	const idrepartidor = managerFilter.getInfoToken(req, 'idrepartidor');
	if (!idrepartidor) return ReE(res, 'token sin idrepartidor', 401);
	if (!obj.idpedido) return ReE(res, 'idpedido requerido', 400);
	obj.idrepartidor = idrepartidor; // nunca el del body
	if (obj.time_line === undefined) obj.time_line = 0;

	// solo se puede entregar un pedido propio
	const dueno = await QueryServiceV1.ejecutarConsulta(`SELECT idrepartidor FROM pedido WHERE idpedido = ?`, [obj.idpedido], 'SELECT', 'setFinPedidoEntregadoV2');
	if (!dueno[0]) return ReE(res, 'El pedido no existe', 404);
	if (Number(dueno[0].idrepartidor) !== Number(idrepartidor)) {
		logEvento(idrepartidor, obj.idpedido, 'entregar_rechazado', 'http', { dueno: dueno[0].idrepartidor });
		return ReE(res, 'El pedido no está asignado a este repartidor', 403);
	}

	const rows = await QueryServiceV1.ejecutarProcedimiento(
		`CALL procedure_pwa_delivery_pedido_entregado_v2(?)`, [JSON.stringify(obj)], 'setFinPedidoEntregadoV2');
	if (!Array.isArray(rows)) return ReE(res, 'No se pudo registrar la entrega, intenta de nuevo', 500);
	const pedidosActivos = Number(rows?.[0]?.pedidos_activos ?? 1);

	logEvento(idrepartidor, obj.idpedido, 'entregado', 'http', { pedidos_activos: pedidosActivos });

	try {
		const io = getIO();
		if (io) {
			const idComercio = obj.datosComercio ? obj.datosComercio.idsede : obj.idsede;
			const socketidComercio = idComercio ? await apiComercio.getSocketIdComercio(idComercio) : null;
			if (socketidComercio && socketidComercio[0] && socketidComercio[0].socketid) {
				io.to(socketidComercio[0].socketid).emit('repartidor-notifica-fin-pedido', obj);
			}
			if (obj.idorg && obj.idsede) io.to(`room${obj.idorg}${obj.idsede}`).emit('repartidor-notifica-fin-pedido', obj.idpedido);
			io.to('MONITOR').emit('repartidor-notifica-fin-pedido', { idrepartidor, idpedido: obj.idpedido });
			if (pedidosActivos === 0) {
				io.to('MONITOR').emit('repartidor-grupo-pedido-finalizado', idrepartidor);
				logEvento(idrepartidor, null, 'liberado', 'http');
			}
		}
	} catch (err) {
		logger.error({ err }, 'setFinPedidoEntregadoV2 notificaciones');
	}

	return ReS(res, { data: rows, pedidos_activos: pedidosActivos });
};
module.exports.setFinPedidoEntregado = setFinPedidoEntregado;

// ---------------------------------------------------------------------------------------------
// POST /repartidor2/set-pedido-delivery-cancelado  { idpedido, idsede, motivo }
// ---------------------------------------------------------------------------------------------

/** Libera (cancela) un pedido aceptado. Rechaza si ya fue entregado; libera al repartidor si no le quedan pedidos. */
const setPedidoCanceladoRepartidor = async function (req, res) {
	const idrepartidor = managerFilter.getInfoToken(req, 'idrepartidor');
	const { idpedido, idsede, motivo } = req.body || {};
	if (!idrepartidor) return ReE(res, 'token sin idrepartidor', 401);
	if (!idpedido) return ReE(res, 'idpedido requerido', 400);

	const estadoRows = await QueryServiceV1.ejecutarConsulta(
		`SELECT pwa_delivery_status FROM pedido WHERE idpedido = ?`, [idpedido], 'SELECT', 'setPedidoCanceladoV2');
	if (String(estadoRows?.[0]?.pwa_delivery_status) === '4') {
		return ReE(res, 'El pedido ya fue entregado, no se puede liberar', 409);
	}

	await QueryServiceV1.ejecutarConsulta(
		`INSERT INTO pedido_delivery_cancelado_repartidor (idpedido, idsede, idrepartidor, fecha, motivo) VALUES (?, ?, ?, NOW(), ?)`,
		[idpedido, idsede || null, idrepartidor, motivo || ''], 'INSERT', 'setPedidoCanceladoV2');

	await QueryServiceV1.ejecutarConsulta(
		`UPDATE pedido SET pwa_delivery_status = '5', pwa_estado = 'C' WHERE idpedido = ? AND idrepartidor = ?`,
		[idpedido, idrepartidor], 'UPDATE', 'setPedidoCanceladoV2');

	// quitar el pedido del JSON; si no queda ninguno, liberar al repartidor
	const rows = await QueryServiceV1.ejecutarConsulta(`SELECT pedido_por_aceptar FROM repartidor WHERE idrepartidor = ?`, [idrepartidor], 'SELECT', 'setPedidoCanceladoV2');
	const ppa = parseJson(rows?.[0]?.pedido_por_aceptar);
	const restantes = (ppa && Array.isArray(ppa.pedidos) ? ppa.pedidos : []).map(Number).filter(p => p !== Number(idpedido));
	if (restantes.length === 0) {
		await QueryServiceV1.ejecutarConsulta(
			`UPDATE repartidor SET pedido_por_aceptar = NULL, ocupado = 0, pedido_paso_va = 0, flag_paso_pedido = 0 WHERE idrepartidor = ?`,
			[idrepartidor], 'UPDATE', 'setPedidoCanceladoV2');
	} else {
		ppa.pedidos = restantes;
		ppa.cantidad_pedidos_aceptados = restantes.length;
		await QueryServiceV1.ejecutarConsulta(
			`UPDATE repartidor SET pedido_por_aceptar = ? WHERE idrepartidor = ?`,
			[JSON.stringify(ppa), idrepartidor], 'UPDATE', 'setPedidoCanceladoV2');
	}

	logEvento(idrepartidor, idpedido, 'liberado_pedido', 'http', { motivo, restantes });
	const io = getIO();
	if (io) io.to('MONITOR').emit('repartidor-notifica-libero-pedido', { idrepartidor, idpedido, motivo });
	return ReS(res, { data: true });
};
module.exports.setPedidoCanceladoRepartidor = setPedidoCanceladoRepartidor;

// ---------------------------------------------------------------------------------------------
// POST /repartidor2/asignarme-pedido  { idpedido, pedidos:[...], importe, idsede }
// ---------------------------------------------------------------------------------------------

/**
 * Repartidor propio (lista de su sede) o global (por código) se asigna un pedido concreto.
 * Usa el mismo SP que el monitor; además quita la oferta a quien la tuviera y le avisa.
 */
const asignarmePedido = async function (req, res) {
	const idrepartidor = managerFilter.getInfoToken(req, 'idrepartidor');
	const idpedido = parseInt(req.body?.idpedido, 10);
	if (!idrepartidor || !Number.isInteger(idpedido)) return ReE(res, 'idpedido requerido', 400);

	const pedidos = Array.from(new Set([...(Array.isArray(req.body.pedidos) ? req.body.pedidos.map(Number).filter(Number.isInteger) : []), idpedido]));
	const importe = Number(req.body.importe) || 0;

	const actual = await QueryServiceV1.ejecutarConsulta(`SELECT idrepartidor, estado FROM pedido WHERE idpedido = ?`, [idpedido], 'SELECT', 'asignarmePedido');
	if (!actual[0]) return ReE(res, 'El pedido no existe', 404);
	if (Number(actual[0].estado) === 3) return ReE(res, 'El pedido está anulado', 409);
	if (actual[0].idrepartidor && Number(actual[0].idrepartidor) !== Number(idrepartidor)) return ReE(res, 'El pedido ya tiene repartidor asignado', 409);

	// quién tenía este pedido ofrecido (para avisarle después)
	const conOferta = await QueryServiceV1.ejecutarConsulta(
		`SELECT idrepartidor, socketid FROM repartidor WHERE flag_paso_pedido = ? AND idrepartidor != ?`,
		[idpedido, idrepartidor], 'SELECT', 'asignarmePedido');

	const objPedido = {
		pedidos,
		cantidad_pedidos_aceptados: pedidos.length,
		cantidad_entregados: 0,
		importe_acumula: importe,
		importe_pagar: importe,
		idsede: req.body.idsede || null,
		idrepartidor,
		pedido_asignado_manual: idpedido,
		inSede: true,
		isexpress: 0
	};
	const spRows = await QueryServiceV1.ejecutarProcedimiento(`CALL procedure_delivery_set_pedido_repartidor_manual(?)`, [JSON.stringify(objPedido)], 'asignarmePedido');
	if (!Array.isArray(spRows)) return ReE(res, 'No se pudo asignar el pedido, intenta de nuevo', 500);

	logEvento(idrepartidor, idpedido, 'asignado_manual', 'http', { pedidos });
	conOferta.forEach(o => { emitEstadoCambio(o.socketid); logEvento(o.idrepartidor, idpedido, 'oferta_quitada', 'http'); });
	return ReS(res, { data: true });
};
module.exports.asignarmePedido = asignarmePedido;

// ---------------------------------------------------------------------------------------------
// POST /repartidor2/set-efectivo-mano  (mismo handler v1, pero con token y sin poder tocar a otro repartidor)
// ---------------------------------------------------------------------------------------------

const setEfectivoMano = async function (req, res) {
	const idrepartidor = managerFilter.getInfoToken(req, 'idrepartidor');
	if (!idrepartidor) return ReE(res, 'token sin idrepartidor', 401);
	req.body.idrepartidor = idrepartidor;
	logEvento(idrepartidor, null, Number(req.body.online) === 1 ? 'online' : 'offline', 'http', { efectivo: req.body.efectivo });
	if (req.body.efectivo === undefined || req.body.efectivo === null) {
		// solo cambio de estado (sync al abrir la app): no tocar el efectivo declarado
		const ok = await QueryServiceV1.ejecutarConsulta(`UPDATE repartidor SET online = ? WHERE idrepartidor = ?`,
			[Number(req.body.online) === 1 ? 1 : 0, idrepartidor], 'UPDATE', 'setOnlineV2');
		return ReS(res, { data: ok });
	}
	return apiRepartidor.setEfectivoMano(req, res);
};
module.exports.setEfectivoMano = setEfectivoMano;

// ---------------------------------------------------------------------------------------------
// Loop de asignación V2 (se activa con REPARTIDOR_LOOP_V2=1)
// ---------------------------------------------------------------------------------------------

/** Datos de push/socket del repartidor (el SP de candidatos no expone pwa_code_verification con ese nombre). */
const datosNotificacion = async function (idrepartidor) {
	const rows = await QueryServiceV1.ejecutarConsulta(
		`SELECT idrepartidor, socketid, pwa_code_verification, fcm_token, telefono, nombre FROM repartidor WHERE idrepartidor = ?`,
		[idrepartidor], 'SELECT', 'datosNotificacion');
	return rows[0] || { idrepartidor };
};

/**
 * Ofrece un grupo de pedidos al mejor candidato. Si no hay ninguno, renueva la oferta al que la tenía
 * (si sigue en línea) en vez de dejar el pedido sin nadie.
 */
const enviarOferta = async function (listRepartidores, dataPedido, io) {
	const idPedidoPrincipal = dataPedido.pedidos[0];
	let candidato = listRepartidores[0];
	let renovar = false;

	if (!candidato) {
		const holder = await QueryServiceV1.ejecutarConsulta(
			`SELECT idrepartidor FROM repartidor WHERE flag_paso_pedido = ? AND online = 1 AND ocupado = 0 AND estado = 0`,
			[idPedidoPrincipal], 'SELECT', 'holderOferta');
		if (holder.length === 0) {
			// nadie disponible y el que la tenía ya no está: liberar la oferta para que el loop vuelva a buscar
			await QueryServiceV1.ejecutarConsulta(
				`UPDATE repartidor SET flag_paso_pedido = 0, pedido_por_aceptar = NULL WHERE flag_paso_pedido = ?`,
				[idPedidoPrincipal], 'UPDATE', 'resetRepartidorV2');
			logger.debug('loopV2: sin repartidor disponible para', idPedidoPrincipal);
			return;
		}
		candidato = holder[0];
		renovar = true;
	}

	// quitamos la oferta al repartidor anterior (si es otro y no está ocupado)
	const anteriorId = dataPedido.last_id_repartidor_reasigno;
	if (anteriorId && !renovar && Number(anteriorId) !== Number(candidato.idrepartidor)) {
		const anterior = await apiRepartidor.getSocketIdRepartidor(anteriorId);
		if (anterior[0] && anterior[0].ocupado === 0) {
			io.to(anterior[0].socketid).emit('repartidor-notifica-server-quita-pedido', null);
			emitEstadoCambio(anterior[0].socketid);
			io.to('MONITOR').emit('notifica-server-quita-pedido-repartidor', anteriorId);
			logEvento(anteriorId, idPedidoPrincipal, 'oferta_quitada', 'loop');
		}
	}

	dataPedido.expira_en = Date.now() + OFERTA_VENTANA_MS;

	// await: el push y el socket salen después de que la BD tenga la oferta (antes salían antes y la app leía vacío)
	if (renovar) {
		// misma oferta, mismo repartidor: solo se corre el vencimiento. El SP sumaría pedidos_reasignados
		// en cada renovación y a la séptima el SP de candidatos lo excluiría para siempre.
		await QueryServiceV1.ejecutarConsulta(
			`UPDATE repartidor SET pedido_por_aceptar = ?, flag_paso_pedido = ? WHERE idrepartidor = ?`,
			[JSON.stringify(dataPedido), idPedidoPrincipal, candidato.idrepartidor], 'UPDATE', 'renovarOfertaV2');
	} else {
		await QueryServiceV1.ejecutarProcedimiento(
			`CALL procedure_delivery_set_pedido_repartidor(?, ?, ?)`,
			[idPedidoPrincipal, candidato.idrepartidor, JSON.stringify(dataPedido)],
			'setAsignaTemporalPedidoARepartidorV2');
	}

	// el SP limpia pedido_por_aceptar del anterior pero no su flag_paso_pedido; sin esto el anterior queda
	// excluido de procedure_delivery_get_repartidor (exige flag_paso_pedido = 0) hasta que algo lo resetee
	if (!renovar) {
		await QueryServiceV1.ejecutarConsulta(
			`UPDATE repartidor SET flag_paso_pedido = 0, pedido_por_aceptar = NULL
			  WHERE flag_paso_pedido = ? AND idrepartidor != ? AND ocupado = 0`,
			[idPedidoPrincipal, candidato.idrepartidor], 'UPDATE', 'resetAnteriorV2');
	}

	const destino = await datosNotificacion(candidato.idrepartidor);
	io.to('MONITOR').emit('notifica-server-pedido-por-aceptar', [destino, dataPedido, listRepartidores]);

	sendMsjsService.sendPushNotificactionOneRepartidor(destino.pwa_code_verification, 0, destino);
	if (destino.socketid) {
		io.to(destino.socketid).emit('repartidor-nuevo-pedido', [destino, dataPedido]);
		emitEstadoCambio(destino.socketid);
	}

	logEvento(candidato.idrepartidor, idPedidoPrincipal, renovar ? 'oferta_renovada' : 'oferta_enviada', 'loop', {
		pedidos: dataPedido.pedidos,
		expira_en: dataPedido.expira_en,
		socketid: destino.socketid,
		push: !!(destino.fcm_token || destino.pwa_code_verification)
	});
};

/** Misma agrupación por sede que el loop v1 (apiRepartidor.colocarPedidoEnRepartidor), sin cambios de negocio. */
const agruparPedidosPorSede = function (listPedidos) {
	const listGruposPedidos = [];
	let listLastRepartidor = '';

	listPedidos.forEach(p => {
		if (p.paso || p.isshow != 1) return;
		const _idsede = p.idsede;
		let importeAcumula = 0;
		let importePagar = 0;
		let isImporteAcumuladoCompleto = false;
		let _num_reasignaciones = null;
		let _last_id_repartidor_reasigno = null;
		const listGroup = [];

		listPedidos
			.filter(pp => pp.isshow === 1 || pp.flag_solicita_repartidor_papaya === 1)
			.filter(pp => pp.idsede === _idsede && pp.isshow_back === 1 && !pp.paso)
			.forEach(pp => {
				pp.json_datos_delivery = typeof pp.json_datos_delivery === 'string' ? JSON.parse(pp.json_datos_delivery) : pp.json_datos_delivery;
				const isPagoTarjeta = pp.json_datos_delivery?.p_header?.arrDatosDelivery?.metodoPago?.idtipo_pago === 2;
				const isRecogeCliente = pp.cliente_pasa_recoger === 'false' ? false : true;
				if (isRecogeCliente) return;

				if (isPagoTarjeta) {
					pp.paso = true;
					listGroup.push(pp.idpedido);
					return;
				}
				const _ppTotal = parseFloat(pp.total);
				importeAcumula += _ppTotal;
				if (isImporteAcumuladoCompleto === false) {
					pp.paso = true;
					importePagar += _ppTotal;
					_last_id_repartidor_reasigno = _last_id_repartidor_reasigno ? _last_id_repartidor_reasigno : pp.last_id_repartidor_reasigno;
					_num_reasignaciones = _num_reasignaciones ? _num_reasignaciones : pp.num_reasignaciones;
					listGroup.push(pp.idpedido);
					isImporteAcumuladoCompleto = importeAcumula >= pp.monto_acumula;
				}
			});

		if (listGroup.length === 0) return;

		const _idRepartidorString = `-${_last_id_repartidor_reasigno}-,`;
		if (listLastRepartidor.indexOf(_idRepartidorString) >= 0) {
			_last_id_repartidor_reasigno = null;
		} else {
			listLastRepartidor += _idRepartidorString;
		}

		listGruposPedidos.push({
			pedidos: listGroup,
			cantidad_pedidos_aceptados: listGroup.length,
			cantidad_entregados: 0,
			importe_acumula: importeAcumula,
			importe_pagar: importePagar,
			last_id_repartidor_reasigno: _last_id_repartidor_reasigno,
			idsede: p.idsede,
			num_reasignaciones: _num_reasignaciones,
			sede_coordenadas: { latitude: p.latitude, longitude: p.longitude }
		});
	});

	return listGruposPedidos;
};

/**
 * Corre cada 60 s (ver runLoopSearchRepartidor en apiRepartidor.js con REPARTIDOR_LOOP_V2=1).
 * Diferencias con v1: no reasigna mientras la oferta esté viva (expira_en), no borra la oferta del único
 * candidato (la renueva), espera al SP antes de notificar y registra cada paso en repartidor_evento_log.
 */
let loopEnCurso = false;

const colocarPedidoEnRepartidor = async function (io, idsede) {
	if (loopEnCurso) {
		logger.warn('loopV2: el ciclo anterior sigue corriendo, se omite este tick');
		return;
	}
	loopEnCurso = true;
	try {
		let listPedidos = await apiRepartidor.getPedidosEsperaRepartidor(idsede);
		listPedidos = Array.isArray(listPedidos) ? JSON.parse(JSON.stringify(listPedidos)) : [];
		if (listPedidos.length === 0) return;

		const listGruposPedidos = agruparPedidosPorSede(listPedidos);

		for (const _group of listGruposPedidos) {
			// si algún repartidor tiene esta oferta viva, esperamos a que acepte o expire
			const ofertaViva = await QueryServiceV1.ejecutarConsulta(
				`SELECT idrepartidor FROM repartidor
				  WHERE flag_paso_pedido = ? AND ocupado = 0
				    AND CAST(COALESCE(pedido_por_aceptar->>'$.expira_en', '0') AS UNSIGNED) > ?`,
				// +1 s: la oferta vence en el mismo segundo en que corre el tick; sin margen se la considera viva
				// por unos ms y la reasignación se atrasa un minuto entero
				[_group.pedidos[0], Date.now() + 1000], 'SELECT', 'ofertaViva');
			if (ofertaViva.length > 0) {
				logger.debug('loopV2: oferta viva, no se reasigna', { idpedido: _group.pedidos[0], idrepartidor: ofertaViva[0].idrepartidor });
				continue;
			}

			const listRepartidores = await apiRepartidor.getRepartidoreForPedidoFromInterval(
				_group.sede_coordenadas.latitude, _group.sede_coordenadas.longitude, _group.importe_pagar);
			await enviarOferta(Array.isArray(listRepartidores) ? listRepartidores : [], _group, io);
		}

		if (listGruposPedidos.length > 0) {
			io.to('MONITOR').emit('notifica-pedidos-pendientes', listGruposPedidos);
		}
	} catch (err) {
		logger.error({ err }, 'loopV2 colocarPedidoEnRepartidor');
	} finally {
		loopEnCurso = false;
	}
};
module.exports.colocarPedidoEnRepartidor = colocarPedidoEnRepartidor;
module.exports.OFERTA_VENTANA_MS = OFERTA_VENTANA_MS;
