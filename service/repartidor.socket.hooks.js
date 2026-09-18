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

const MAX_INTENTOS_ATTACH = 20;

const POSICION_THROTTLE_MS = 30_000;
const ultimaPosicionGuardada = new Map();

/**
 * La app emite la ubicación cada 10 s; guardarla en la base cada vez es gasto puro.
 * Aislada de los sockets para poder probarla.
 */
const debeGuardarPosicion = (idrepartidor, ahora = Date.now()) => {
	if (!idrepartidor) return false;
	const previo = ultimaPosicionGuardada.get(idrepartidor);
	if (previo && ahora - previo < POSICION_THROTTLE_MS) return false;
	ultimaPosicionGuardada.set(idrepartidor, ahora);
	return true;
};

const olvidarRepartidor = (idrepartidor) => ultimaPosicionGuardada.delete(idrepartidor);

const attach = function (io, intento = 1) {
	if (attached) return;
	io = io || (() => { try { return socketManager.getIO(); } catch (e) { return null; } })();
	if (!io) {
		// app.js crea io en el mismo tick que carga las rutas; si algún día eso cambia, reintentamos un rato
		if (intento < MAX_INTENTOS_ATTACH) return void setTimeout(() => attach(null, intento + 1), 500);
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

		// sella la hora de la última posición conocida; sin esto el tracker del POS no puede
		// distinguir un repartidor detenido de uno que cerró la app hace horas
		socket.on('repartidor-notifica-ubicacion', (data) => {
			const lat = Number(data && data.coordenadas && data.coordenadas.latitude);
			const lng = Number(data && data.coordenadas && data.coordenadas.longitude);
			if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
			if (!debeGuardarPosicion(idrepartidor)) return;
			QueryServiceV1.ejecutarConsulta(
				`UPDATE repartidor
				    SET position_now = JSON_SET(COALESCE(position_now, JSON_OBJECT()), '$.latitude', ?, '$.longitude', ?),
				        position_now_fecha = NOW()
				  WHERE idrepartidor = ?`,
				[lat, lng, idrepartidor], 'UPDATE', 'repartidorPosicionSello');
		});

		socket.on('disconnect', async (reason) => {
			if (!idrepartidor) return;
			olvidarRepartidor(idrepartidor);
			await QueryServiceV1.ejecutarConsulta(
				`UPDATE repartidor SET socketid = NULL WHERE idrepartidor = ? AND socketid = ?`,
				[idrepartidor, socket.id], 'UPDATE', 'repartidorDisconnect');
			logEvento(idrepartidor, 'socket_desconectado', { socketid: socket.id, reason });

			// si ya reconectó con otro socket (red móvil), no es un offline real: no molestar al monitor
			const actual = await QueryServiceV1.ejecutarConsulta(`SELECT socketid FROM repartidor WHERE idrepartidor = ?`, [idrepartidor], 'SELECT', 'repartidorDisconnect');
			if (actual[0] && actual[0].socketid) return;
			// el monitor solo escucha 'notifica-repartidor-online'; recibe el mismo objeto con online = 0
			io.to('MONITOR').emit('notifica-repartidor-online', { ...q, idrepartidor, online: 0, socketid: null });
		});
	});

	logger.debug('repartidor.socket.hooks instalados');
};
module.exports.attach = attach;
module.exports.debeGuardarPosicion = debeGuardarPosicion;
module.exports._olvidarRepartidor = olvidarRepartidor;
module.exports._limpiarThrottle = () => ultimaPosicionGuardada.clear();
