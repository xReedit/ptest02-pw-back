// Pedido por confirmar (carta QR de mesa, sede unica — NO holding).
// El pedido del cliente queda en pedido_por_confirmar; un mozo o caja lo confirma y recien ahi
// se guarda e imprime con las funciones existentes. Plan: restobar/plan/PEDIDO-POR-CONFIRMAR-PLAN.md
// Migracion: restobar/migraciones/pendientes-prod/2026-10-08_069_pedido_por_confirmar.sql
const { sequelize, QueryTypes } = require('../config/database');
const logger = require('../utilitarios/logger');
const socketManager = require('./socket.manager');
const apiPwa = require('../controllers/apiPwa_v1');
const apiHolding = require('../controllers/apiHolding');
const { xMandarImprimirComanda } = require('./imprimir.comanda');
const { enviarATokens } = require('./push.mozo.service');

const MINUTOS_CADUCA = 30;
const MAX_PENDIENTES_MESA = 5;
const MAX_PENDIENTES_SEDE = 40;
const HORAS_REVISAR_VISIBLE = 12;
const HORAS_MOZO_ACTIVO = 24; // igual que push.mozo.service
const EVT_NUEVO = 'pedido-por-confirmar-nuevo';
const EVT_CAMBIO = 'pedido-por-confirmar-cambio';
const EVT_RECORDAR = 'pedido-por-confirmar-recordar';
const SEG_ENTRE_RECORDATORIOS = 60;

// 4 = el guardado no respondio: pudo haberse registrado, NO se reintenta solo (evita comanda/cobro doble)
const ESTADO = { PENDIENTE: '0', CONFIRMADO: '1', ANULADO: '2', CADUCADO: '3', REVISAR: '4' };
const MSJ_REVISAR = 'El servidor no confirmó si el pedido se registró. Revise la cuenta de la mesa: si el pedido no está, anúlelo y pida al cliente enviarlo de nuevo.';
const MSJ_YA_ATENDIDO = 'Este pedido ya fue confirmado, anulado o caducó';

const room = (idorg, idsede) => `room${idorg}${idsede}`;
const select = (sql, replacements) => sequelize.query(sql, { replacements, type: QueryTypes.SELECT });
// devuelve filas afectadas (mysql: [undefined, affectedRows])
const update = async (sql, replacements) => {
	const r = await sequelize.query(sql, { replacements, type: QueryTypes.UPDATE });
	return Array.isArray(r) ? r[1] : 0;
};

// Datos y flags de la sede. Holding nunca usa este flujo. Si la migracion no esta aplicada, todo apagado.
async function getSede(idsede) {
	try {
		const rows = await select(
			`SELECT s.idorg, s.mesas, s.is_holding, so.pwa_requiere_confirmacion, so.pwa_confirmacion_exige_pago
			 FROM sede s LEFT JOIN sede_opciones so ON so.idsede = s.idsede
			 WHERE s.idsede = ? AND s.estado = 0`, [parseInt(idsede) || 0]);
		const r = rows[0];
		const activo = !!r && String(r.is_holding) !== '1' && String(r.pwa_requiere_confirmacion) === '1';
		return {
			idorg: r ? parseInt(r.idorg) : 0,
			mesas: r ? parseInt(r.mesas) || 0 : 0,
			requiere_confirmacion: activo,
			exige_pago: activo && String(r.pwa_confirmacion_exige_pago) === '1',
		};
	} catch (err) {
		logger.warn({ err: err.message, idsede }, 'pedido-por-confirmar: no se pudo leer config, se asume apagado');
		return { idorg: 0, mesas: 0, requiere_confirmacion: false, exige_pago: false };
	}
}

async function getConfigSede(idsede) {
	const { requiere_confirmacion, exige_pago } = await getSede(idsede);
	return { requiere_confirmacion, exige_pago };
}

const totalDe = (dataSend) => {
	const sub = dataSend?.dataPedido?.p_subtotales;
	const fila = Array.isArray(sub) ? sub.find(x => x && x.descripcion === 'TOTAL') : null;
	return parseFloat(fila?.importe) || 0;
};

const contarPendientes = async (where, params) =>
	(await select(`SELECT COUNT(*) n FROM pedido_por_confirmar WHERE estado = '0' AND ${where}`, params))[0].n;

// Devuelve { ok, id } o { ok:false, status, error }
async function guardar(dataSend, idclienteToken) {
	const header = dataSend?.dataPedido?.p_header;
	const usuario = dataSend?.dataUsuario;
	const idsede = parseInt(usuario?.idsede);
	const mesa = String(header?.m ?? '').trim();

	if (!header || !idsede || !dataSend.dataPedido.p_body) {
		return { ok: false, status: 400, error: 'pedido incompleto' };
	}
	if (!/^[0-9A-Za-z-]{1,10}$/.test(mesa) || mesa === '0'
		|| header.delivery == 1 || header.solo_llevar == 1 || header.reservar == 1 || header.is_holding == 1) {
		return { ok: false, status: 400, error: 'solo pedidos de mesa' };
	}
	const sede = await getSede(idsede);
	if (!sede.requiere_confirmacion) {
		return { ok: false, status: 409, error: 'la sede no requiere confirmacion' };
	}
	// la org sale de la BD, no del cliente (define la sala del socket y el pedido final)
	const idorg = sede.idorg;
	usuario.idorg = idorg;
	if (/^[0-9]+$/.test(mesa) && sede.mesas > 0 && parseInt(mesa) > sede.mesas) {
		return { ok: false, status: 400, error: 'mesa no valida' };
	}

	if (await contarPendientes('idsede = ? AND mesa = ?', [idsede, mesa]) >= MAX_PENDIENTES_MESA) {
		return { ok: false, status: 429, error: 'Ya hay pedidos esperando confirmación en esta mesa. Llame al personal.' };
	}
	if (await contarPendientes('idsede = ?', [idsede]) >= MAX_PENDIENTES_SEDE) {
		return { ok: false, status: 429, error: 'Hay muchos pedidos esperando confirmación. Llame al personal.' };
	}

	const idcliente = parseInt(idclienteToken || usuario.idcliente || header.idcliente) || null;
	const nombre = String(header.nom_us || usuario.nombres || '').slice(0, 100) || null;
	const total = totalDe(dataSend);
	const idem = typeof header.idem === 'string' && header.idem ? header.idem.slice(0, 64) : null;

	// un reintento con el mismo idem devuelve el id ya guardado (LAST_INSERT_ID) en vez de duplicar
	const [id, insertados] = await sequelize.query(
		`INSERT INTO pedido_por_confirmar (idorg, idsede, mesa, idcliente, nombre_cliente, json_pedido, total, idem)
		 VALUES (?, ?, ?, ?, ?, ?, ?, ?)
		 ON DUPLICATE KEY UPDATE idpedido_por_confirmar = LAST_INSERT_ID(idpedido_por_confirmar)`,
		{ replacements: [idorg, idsede, mesa, idcliente, nombre, JSON.stringify(dataSend), total, idem], type: QueryTypes.INSERT });

	if (insertados === 1) {
		socketManager.emitToRoom(room(idorg, idsede), EVT_NUEVO, { id, mesa, total, nombre_cliente: nombre });
		notificarMozos(idsede, mesa, total).catch(err => logger.error({ err, idsede }, 'push pedido por confirmar'));
	}
	return { ok: true, id };
}

async function notificarMozos(idsede, mesa, total, esRecordatorio = false) {
	const rows = await select(
		`SELECT fcm_token FROM usuario_push_token WHERE idsede = ? AND last_seen_at >= NOW() - INTERVAL ? HOUR`,
		[idsede, HORAS_MOZO_ACTIVO]);
	await enviarATokens(rows.map(r => r.fcm_token), {
		title: esRecordatorio ? `Mesa ${mesa} vuelve a llamar` : `Mesa ${mesa}: pedido por confirmar`,
		body: `Acérquese a la mesa ${mesa} a confirmar el pedido (S/ ${total.toFixed(2)})`,
		data: { tipo: 'pedido_por_confirmar', num_mesa: String(mesa) },
		tag: `ppc_mesa_${mesa}`,
	}, { idsede, mesa });
}

// Estado para el cliente (polling). Mientras se guarda (1 sin idpedido) o esta en revision, el cliente ve "pendiente".
async function getEstado(id) {
	const rows = await select(
		`SELECT estado, motivo, idpedido FROM pedido_por_confirmar WHERE idpedido_por_confirmar = ?`,
		[parseInt(id) || 0]);
	const r = rows[0];
	if (!r) { return null; }
	const enCurso = r.estado === ESTADO.REVISAR || (r.estado === ESTADO.CONFIRMADO && !r.idpedido);
	return enCurso ? { estado: ESTADO.PENDIENTE, motivo: null, idpedido: null } : r;
}

// El cliente vuelve a llamar al personal (boton tras 1 min de espera): re-avisa a caja (sonido) y a los mozos (push).
// ponytail: espera entre avisos en memoria por proceso; se reinicia al reiniciar el backend (como mucho un aviso extra).
const ultimoRecordatorio = new Map();
async function recordar(id) {
	const fila = (await select(
		`SELECT idpedido_por_confirmar id, idorg, idsede, mesa, nombre_cliente, total,
		        TIMESTAMPDIFF(SECOND, fecha_registro, NOW()) seg
		 FROM pedido_por_confirmar
		 WHERE idpedido_por_confirmar = ? AND estado = '0' AND fecha_registro > NOW() - INTERVAL ? MINUTE`,
		[parseInt(id) || 0, MINUTOS_CADUCA]))[0];
	if (!fila) { return { ok: false, status: 409, error: MSJ_YA_ATENDIDO }; }
	const desde = Math.min(fila.seg, (Date.now() - (ultimoRecordatorio.get(fila.id) || 0)) / 1000);
	if (desde < SEG_ENTRE_RECORDATORIOS) {
		return { ok: false, status: 429, error: 'Ya avisamos al personal. Podrá volver a llamar en un momento.' };
	}
	ultimoRecordatorio.set(fila.id, Date.now());
	const total = parseFloat(fila.total) || 0;
	socketManager.emitToRoom(room(fila.idorg, fila.idsede), EVT_RECORDAR,
		{ id: fila.id, mesa: fila.mesa, total, nombre_cliente: fila.nombre_cliente });
	notificarMozos(fila.idsede, fila.mesa, total, true).catch(err => logger.error({ err, id }, 'push recordar pedido por confirmar'));
	return { ok: true };
}

// Pendientes de la sede (y los "revisar" del dia), con el detalle para mostrar al mozo / caja
async function getPendientes(idsede) {
	const rows = await select(
		`SELECT idpedido_por_confirmar id, estado, mesa, nombre_cliente, total, ultimo_error, fecha_registro,
		        TIMESTAMPDIFF(MINUTE, fecha_registro, NOW()) minutos,
		        JSON_EXTRACT(json_pedido, '$.dataPedido.p_body') p_body
		 FROM pedido_por_confirmar
		 WHERE idsede = ? AND (
		   (estado = '0' AND fecha_registro > NOW() - INTERVAL ? MINUTE)
		   OR (estado = '4' AND fecha_registro > NOW() - INTERVAL ? HOUR))
		 ORDER BY fecha_registro`, [parseInt(idsede) || 0, MINUTOS_CADUCA, HORAS_REVISAR_VISIBLE]);
	return rows.map(r => ({ ...r, p_body: typeof r.p_body === 'string' ? JSON.parse(r.p_body) : r.p_body }));
}

// Quien confirmo cada pedido (detalle de la mesa en caja). ids = idpedido de la tabla pedido.
async function getConfirmados(idsede, ids) {
	const lista = (Array.isArray(ids) ? ids : []).map(n => parseInt(n)).filter(n => n > 0).slice(0, 100);
	if (!lista.length) { return []; }
	return select(
		`SELECT p.idpedido, p.origen_accion origen, u.nombres usuario
		 FROM pedido_por_confirmar p LEFT JOIN usuario u ON u.idusuario = p.idusuario_accion
		 WHERE p.idsede = ? AND p.estado = '1' AND p.idpedido IN (?)`, [parseInt(idsede) || 0, lista]);
}

// Formas de pago para cobrar al confirmar: las habilitadas en la sede (metodo_pago_aceptados; sin lista = las visibles),
// sin App (4), C.Habitacion (17, solo caja) ni las que piden cliente (credito). Orden del catalogo:
// la app del mozo las reordena por lo que mas usa ese celular (localStorage).
async function getFormasPago(idsede) {
	const sede = (await select(`SELECT metodo_pago_aceptados FROM sede WHERE idsede = ?`, [parseInt(idsede) || 0]))[0];
	// mismo criterio que la caja (x-comp-find-tipo-pago-option): busca el id como texto dentro de la lista,
	// asi el mozo ve las mismas formas de pago que caja (p.ej. Plin "7" aparece por estar "17" en la lista).
	const aceptados = String(sede?.metodo_pago_aceptados || '');
	const tipos = await select(
		`SELECT idtipo_pago id, descripcion nombre, img, visible FROM tipo_pago
		 WHERE estado = 0 AND requiere_cliente = '0' AND idtipo_pago NOT IN (4, 17) ORDER BY orden`);
	return tipos
		.filter(t => (aceptados ? aceptados.indexOf(String(t.id)) > -1 : String(t.visible) !== '1'))
		.map(({ visible, ...t }) => t);
}

const getFila = async (id) => (await select(
	`SELECT * FROM pedido_por_confirmar WHERE idpedido_por_confirmar = ?`, [parseInt(id) || 0]))[0];

// Registra el pago con el mismo procedimiento del camino "pago mozo" (holding.sevice.savePedidosAgrupados).
async function registrarPago(dataSend, idpedido) {
	const { idorg, idsede } = dataSend.dataUsuario;
	const p_subtotales = dataSend.dataPedido.p_subtotales;
	const detalle = await apiHolding.getListItemsPedidoDetalle(parseInt(idpedido));
	const rpt = await apiHolding.saveRegistroPagoPedido({
		...dataSend.dataPedido, idsede, idorg, p_subtotales,
		pedidos_marcas: [{ idpedido, idsede, idorg, subtotal: p_subtotales }],
	}, detalle || []);
	return !!rpt;
}

// Guarda e imprime con las funciones existentes (mismo camino que nuevoPedido normal:
// setNuevoPedido ya confirma stock + emits + comanda de TODAS las areas). Devuelve idpedido o null.
async function guardarEImprimir(dataSend, pagos, idusuarioAccion) {
	const io = socketManager.getIO();
	const { idorg, idsede } = dataSend.dataUsuario;
	if (pagos) {
		dataSend.dataPedido.p_header.paymentMozo = { ...pagos, isPaymentSuccess: true, idusuario: idusuarioAccion };
	}
	const rpt = await apiPwa.setNuevoPedido(dataSend.dataUsuario, dataSend);
	const idpedido = rpt?.[0]?.idpedido;
	if (!idpedido) { return null; }
	dataSend.dataPedido.idpedido = idpedido;
	const sala = room(idorg, idsede);
	io.to(sala).emit('nuevoPedido', dataSend.dataPedido);
	io.to(sala).emit('nuevoPedido-for-list-mesas', dataSend.dataPedido);
	xMandarImprimirComanda(rpt[0].data, io, sala);
	return idpedido;
}

// accion: { idsede, idusuario, origen: 'MOZO'|'CAJA' }. Devuelve { ok, idpedido, aviso? } o { ok:false, status, error }
async function confirmar(id, pagos, accion) {
	const fila = await getFila(id);
	if (!fila || String(fila.idsede) !== String(accion.idsede)) {
		return { ok: false, status: 404, error: 'pedido no encontrado' };
	}
	if (fila.estado === ESTADO.REVISAR) { return { ok: false, status: 409, error: MSJ_REVISAR }; }
	const config = await getConfigSede(fila.idsede);
	const conPago = !!(pagos && Array.isArray(pagos.methods) && pagos.methods.some(m => Number(m.amount) > 0));
	if (config.exige_pago && !conPago) {
		return { ok: false, status: 400, error: 'Esta sede exige registrar el pago para confirmar' };
	}
	const pagado = conPago ? pagos.methods.reduce((s, m) => s + (Number(m.amount) || 0), 0) : 0;
	if (conPago && pagado + 0.01 < Number(fila.total)) {
		return { ok: false, status: 400, error: `El pago (S/ ${pagado.toFixed(2)}) no cubre el total (S/ ${Number(fila.total).toFixed(2)})` };
	}
	// solo el efectivo (id 1) puede pasar del total: da vuelto. Tarjeta / Yape / otros no.
	const digital = conPago ? pagos.methods.filter(m => Number(m.id) !== 1).reduce((s, m) => s + (Number(m.amount) || 0), 0) : 0;
	if (digital > Number(fila.total) + 0.01) {
		return { ok: false, status: 400, error: `Tarjeta, Yape y otros no pueden pasar del total (S/ ${Number(fila.total).toFixed(2)}). Solo el efectivo da vuelto.` };
	}

	// gana uno solo: si otro ya confirmo/anulo o caduco, no hay filas afectadas
	const tomadas = await update(
		`UPDATE pedido_por_confirmar
		 SET estado = '1', idusuario_accion = ?, origen_accion = ?, fecha_accion = NOW(), ultimo_error = NULL
		 WHERE idpedido_por_confirmar = ? AND estado = '0' AND fecha_registro > NOW() - INTERVAL ? MINUTE`,
		[accion.idusuario || null, accion.origen, fila.idpedido_por_confirmar, MINUTOS_CADUCA]);
	if (!tomadas) { return { ok: false, status: 409, error: MSJ_YA_ATENDIDO }; }

	const sala = room(fila.idorg, fila.idsede);
	const dataSend = typeof fila.json_pedido === 'string' ? JSON.parse(fila.json_pedido) : fila.json_pedido;
	let idpedido = null, errorGuardar = '';
	try {
		idpedido = await guardarEImprimir(dataSend, conPago ? pagos : null, accion.idusuario);
	} catch (err) {
		errorGuardar = String(err?.message || err);
	}
	if (!idpedido) {
		// el procedimiento pudo guardar aunque Node no recibio respuesta (timeout): no se vuelve a '0'
		logger.error({ err: errorGuardar, id }, 'pedido-por-confirmar: guardado sin confirmar, queda en revisar');
		await update(`UPDATE pedido_por_confirmar SET estado = '4', ultimo_error = ? WHERE idpedido_por_confirmar = ?`,
			[MSJ_REVISAR, fila.idpedido_por_confirmar]);
		socketManager.emitToRoom(sala, EVT_CAMBIO, { id: fila.idpedido_por_confirmar, mesa: fila.mesa, estado: ESTADO.REVISAR });
		return { ok: false, status: 500, error: MSJ_REVISAR };
	}

	let pagoOk = false;
	if (conPago) {
		try { pagoOk = await registrarPago(dataSend, idpedido); } catch (err) {
			logger.error({ err: err.message, idpedido }, 'pedido-por-confirmar: no se registro el pago');
		}
	}
	await update(`UPDATE pedido_por_confirmar SET idpedido = ?, pagado = ? WHERE idpedido_por_confirmar = ?`,
		[idpedido, pagoOk ? '1' : '0', fila.idpedido_por_confirmar]);
	socketManager.emitToRoom(sala, EVT_CAMBIO, { id: fila.idpedido_por_confirmar, mesa: fila.mesa, estado: ESTADO.CONFIRMADO });
	const aviso = conPago && !pagoOk ? 'Pedido enviado a producción, pero el pago NO se registró: cóbrelo en caja.' : undefined;
	return { ok: true, idpedido, aviso };
}

async function anular(id, motivo, accion) {
	const texto = String(motivo || '').trim().slice(0, 250);
	if (texto.length < 3) { return { ok: false, status: 400, error: 'Indique el motivo de la anulación' }; }
	const fila = await getFila(id);
	if (!fila || String(fila.idsede) !== String(accion.idsede)) {
		return { ok: false, status: 404, error: 'pedido no encontrado' };
	}
	const n = await update(
		`UPDATE pedido_por_confirmar
		 SET estado = '2', motivo = ?, idusuario_accion = ?, origen_accion = ?, fecha_accion = NOW()
		 WHERE idpedido_por_confirmar = ? AND estado IN ('0', '4')`,
		[texto, accion.idusuario || null, accion.origen, fila.idpedido_por_confirmar]);
	if (!n) { return { ok: false, status: 409, error: MSJ_YA_ATENDIDO }; }
	// ponytail: las reservas de stock del carrito las libera stock.cleanup.job (30 min sin actividad)
	socketManager.emitToRoom(room(fila.idorg, fila.idsede), EVT_CAMBIO,
		{ id: fila.idpedido_por_confirmar, mesa: fila.mesa, estado: ESTADO.ANULADO });
	return { ok: true };
}

// Job: pasa a caducado lo pendiente con mas de MINUTOS_CADUCA. Devuelve cantidad caducada.
async function caducarVencidos() {
	const vencidos = await select(
		`SELECT idpedido_por_confirmar id, idorg, idsede, mesa FROM pedido_por_confirmar
		 WHERE estado = '0' AND fecha_registro <= NOW() - INTERVAL ? MINUTE LIMIT 500`, [MINUTOS_CADUCA]);
	if (!vencidos.length) { return 0; }
	await update(
		`UPDATE pedido_por_confirmar
		 SET estado = '3', origen_accion = 'SISTEMA', motivo = ?, fecha_accion = NOW()
		 WHERE idpedido_por_confirmar IN (?) AND estado = '0'`,
		[`Caducado: ${MINUTOS_CADUCA} min sin confirmar`, vencidos.map(v => v.id)]);
	vencidos.forEach(v => socketManager.emitToRoom(room(v.idorg, v.idsede), EVT_CAMBIO,
		{ id: v.id, mesa: v.mesa, estado: ESTADO.CADUCADO }));
	return vencidos.length;
}

module.exports = { getConfigSede, guardar, getEstado, recordar, getPendientes, getConfirmados, getFormasPago, confirmar, anular, caducarVencidos, MINUTOS_CADUCA };
