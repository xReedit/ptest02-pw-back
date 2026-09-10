// Un solo evento para el cliente cada vez que cambia pwa_estado o pwa_delivery_status.
const QueryServiceV1 = require('./query.service.v1');
const logger = require('../utilitarios/logger');
const pushCliente = require('./push.cliente.service');

let io = null;
function setIo(_io) { io = _io; }

// Varios origenes (apiPwa_v1, apiComercio, el print server por lotes) llaman notificar()
// dos veces para el mismo estado; el socket repetido no molesta, el push repetido si.
// ponytail: dedupe en memoria por proceso; si hay varios workers, mover a Redis
const MAX_DEDUPE = 2000;
const ultimoEstadoPush = new Map();

function claveEstado(est) { return `${est.pwa_estado}|${est.pwa_delivery_status}`; }

function esEstadoFinal(est) {
	const delivery = Number(est.pwa_delivery_status);
	return est.pwa_estado === 'E' || est.pwa_estado === 'C' || delivery === 4 || delivery === 5;
}

function recordarEstado(id, clave) {
	ultimoEstadoPush.set(id, clave);
	while (ultimoEstadoPush.size > MAX_DEDUPE) {
		ultimoEstadoPush.delete(ultimoEstadoPush.keys().next().value);
	}
}

function _resetDedupe() { ultimoEstadoPush.clear(); }

function parseJson(v) { if (!v) { return null; } if (typeof v === 'object') { return v; } try { return JSON.parse(v); } catch (e) { return null; } }

async function leerEstado(idpedido) {
	const sql = `SELECT p.idpedido, p.idcliente, p.pwa_estado, p.pwa_delivery_status, p.idrepartidor, p.fecha_hora,
			r.nombre AS nom_repartidor, r.apellido AS ap_repartidor, r.telefono AS telefono_repartidor, r.position_now,
			s.pwa_delivery_servicio_propio
		FROM pedido p LEFT JOIN repartidor r ON r.idrepartidor = p.idrepartidor LEFT JOIN sede s ON s.idsede = p.idsede
		WHERE p.idpedido = ?`;
	const rows = await QueryServiceV1.ejecutarConsulta(sql, [idpedido], 'SELECT', 'estadoPedido.leer');
	const row = rows?.[0];
	if (!row) { return null; }
	return { ...row, position_now: parseJson(row.position_now) };
}

async function notificar(idpedido) {
	try {
		const est = await leerEstado(Number(idpedido));
		if (!est || !io || !(Number(est.idcliente) > 0)) { return; }
		const { idcliente, ...payload } = est;
		io.to(`cliente_${Number(idcliente)}`).emit('pedido-cambio-estado', payload);

		const id = Number(idpedido);
		const clave = claveEstado(est);
		if (ultimoEstadoPush.get(id) === clave) { return; }
		recordarEstado(id, clave);

		// el socket solo llega si la app esta abierta; el push cubre el resto
		await pushCliente.notificarEstado({
			idpedido: id,
			idcliente: Number(idcliente),
			pwa_estado: est.pwa_estado,
			pwa_delivery_status: est.pwa_delivery_status
		});

		// el pedido termino: no hay mas cambios que deduplicar, se libera la entrada
		if (esEstadoFinal(est)) { ultimoEstadoPush.delete(id); }
	} catch (error) {
		logger.error({ error: error.message, idpedido }, 'estadoPedido.notificar');
	}
}

module.exports = { setIo, notificar, leerEstado, _resetDedupe };
