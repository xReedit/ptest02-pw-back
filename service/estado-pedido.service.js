// Un solo evento para el cliente cada vez que cambia pwa_estado o pwa_delivery_status.
const QueryServiceV1 = require('./query.service.v1');
const logger = require('../utilitarios/logger');

let io = null;
function setIo(_io) { io = _io; }

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
		// ponytail: aquí engancha el push por cambio de estado (sprint 3)
	} catch (error) {
		logger.error({ error: error.message, idpedido }, 'estadoPedido.notificar');
	}
}

module.exports = { setIo, notificar, leerEstado };
