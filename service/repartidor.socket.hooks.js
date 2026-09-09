/**
 * Hooks de socket para la app de repartidores 2.0. No modifica controllers/sockets.js:
 * se registra como un listener adicional de 'connection' y solo actúa si el socket es de un repartidor.
 *
 * - Al conectar: emite 'repartidor-estado-cambio' (la app nueva responde pidiendo GET /repartidor2/mi-estado).
 * - Al desconectar: limpia repartidor.socketid (si sigue siendo este socket) y avisa al monitor.
 */
const logger = require('../utilitarios/logger');
const QueryServiceV1 = require('./query.service.v1');
const socketManager = require('./socket.manager');

let attached = false;

const esRepartidor = (q) => q && (q.isRepartidor === 'true' || q.isRepartidor === true);

const logEvento = (idrepartidor, evento, detalle) => {
	if (!idrepartidor) return;
	QueryServiceV1.ejecutarConsulta(
		`INSERT INTO repartidor_evento_log (idrepartidor, idpedido, evento, canal, detalle) VALUES (?, NULL, ?, 'socket', ?)`,
		[idrepartidor, evento, JSON.stringify(detalle)], 'INSERT', 'logEventoSocket');
};

const attach = function (io) {
	if (attached) return;
	io = io || (() => { try { return socketManager.getIO(); } catch (e) { return null; } })();
	if (!io) {
		logger.error('repartidor.socket.hooks: io no inicializado, hooks no instalados');
		return;
	}
	attached = true;

	io.on('connection', (socket) => {
		const q = socket.handshake.query || {};
		if (!esRepartidor(q)) return;
		const idrepartidor = Number(q.idrepartidor) || null;

		// sockets.js ya registró el socketid y mandó el JSON antiguo; la app nueva ignora ese JSON y pide mi-estado
		setTimeout(() => socket.emit('repartidor-estado-cambio'), 1500);
		logEvento(idrepartidor, 'socket_conectado', { socketid: socket.id, online: q.online });

		socket.on('disconnect', async (reason) => {
			if (!idrepartidor) return;
			await QueryServiceV1.ejecutarConsulta(
				`UPDATE repartidor SET socketid = NULL WHERE idrepartidor = ? AND socketid = ?`,
				[idrepartidor, socket.id], 'UPDATE', 'repartidorDisconnect');
			// el monitor solo escucha 'notifica-repartidor-online'; recibe el mismo objeto con online = 0
			io.to('MONITOR').emit('notifica-repartidor-online', { ...q, idrepartidor, online: 0, socketid: null });
			logEvento(idrepartidor, 'socket_desconectado', { socketid: socket.id, reason });
		});
	});

	logger.debug('repartidor.socket.hooks instalados');
};
module.exports.attach = attach;
