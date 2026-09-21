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

// ── Aviso al cliente cuando su pedido sale del local ────────────────────────────
//
// Solo se le escribe a quien pidio por WhatsApp, y ese es el filtro del JOIN con
// pedido_preview: esa tabla la llena el chatbot al armar el pedido y su `id` tiene la forma
// "telefono_idorg_idsede". Un pedido tomado por telefono o desde el POS no tiene fila ahi y no
// recibe nada; escribirle por WhatsApp a alguien que nunca escribio al restaurante es abrir una
// conversacion no pedida, y el gateway es una sesion de WhatsApp real que se puede perder por eso.
//
// El aviso sale una sola vez por pedido. La marca vive en repartidor_evento_log, no en memoria:
// un reinicio del proceso no puede volver a escribirle al cliente.
const AVISO_SALIDA = 'aviso_salida_wsp';
const AVISO_PASO_EN_CAMINO = 2;   // la app marca este paso al alejarse del local

// La app reemite el paso cuando falla al guardarlo, asi que dos avisos pueden entrar casi
// juntos. La marca en la base no alcanza para eso: entre leerla y escribirla hay awaits.
// Este Set reserva el pedido en el acto; la base sigue siendo la que manda tras un reinicio.
//
// El Set es POR PROCESO, y alcanza porque hoy esto corre en uno solo (ecosystem.config.js:
// instances 1, exec_mode fork). El dia que se suban las instancias esta ventana se reabre y
// hay que mover la garantia a la base: una UNIQUE sobre (idpedido) acotada a este evento, con
// el INSERT antes del envio y la colision como señal de "ya se aviso".
const avisosEnCurso = new Set();

// Mismos criterios que el tracker del POS y que la respuesta del chatbot, y con la misma
// intencion: prometer de mas. Si decimos 8 minutos y llegan en 12, el cliente reclama; si
// decimos 15 y llegan en 12, siente que lo atendieron rapido.
const AVISO_FACTOR_CALLE = 1.3;   // se maneja por calles, no en linea recta
const AVISO_VEL_KMH = 18;
const AVISO_HOLGURA = 1.7;
const AVISO_MARGEN_MIN = 5;

const distanciaKm = (lat1, lng1, lat2, lng2) => {
	const R = 6371, rad = (x) => x * Math.PI / 180;
	const dLat = rad(lat2 - lat1), dLng = rad(lng2 - lng1);
	const a = Math.sin(dLat / 2) ** 2 +
		Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(dLng / 2) ** 2;
	return 2 * R * Math.asin(Math.min(1, Math.sqrt(a)));
};

/**
 * Numero o NaN. Number(null) es 0, asi que Number() a secas sobre una columna que puede
 * venir NULL convierte "sin coordenadas" en "coordenada 0", que es un punto en el golfo
 * de Guinea: la distancia da miles de kilometros y el cliente recibe un ETA absurdo.
 */
const num = (v) => (v === null || v === undefined || v === '' ? NaN : Number(v));

/** Minutos a prometer, o null si falta alguna coordenada. */
const minutosAviso = (lat, lng, destLat, destLng) => {
	if (![lat, lng, destLat, destLng].every(Number.isFinite)) return null;
	// (0,0) no es una direccion del Peru: es lo que queda cuando el dato no existe
	if ((lat === 0 && lng === 0) || (destLat === 0 && destLng === 0)) return null;
	const km = distanciaKm(lat, lng, destLat, destLng) * AVISO_FACTOR_CALLE;
	return Math.max(5, Math.round((km / AVISO_VEL_KMH) * 60 * AVISO_HOLGURA) + AVISO_MARGEN_MIN);
};

const leerJson = (v) => {
	if (!v) return null;
	if (typeof v === 'object') return v;
	try { return JSON.parse(v); } catch (e) { return null; }
};

/**
 * "934746830_16_13" -> { telefono, idorg, idsede }; null si no tiene esa forma.
 *
 * El telefono se devuelve como lo espera el gateway: con prefijo de pais. En esta tabla
 * conviven las dos formas, porque el chatbot arma el id con el `from` de WhatsApp (que
 * trae el 51) pero otros caminos guardan el celular pelado de 9 digitos. Se normaliza
 * con el mismo criterio que ya usa el POS para abrir un chat (xTrkWhatsapp).
 *
 * El largo se valida estricto a proposito: la tabla tiene ids basura de 6 digitos, y un
 * aviso a un numero inventado le escribe a un desconocido.
 */
const leerSesion = (id) => {
	const partes = String(id || '').split('_');
	if (partes.length !== 3) return null;
	const [crudo, idorg, idsede] = partes;
	if (!/^\d{1,10}$/.test(idorg) || !/^\d{1,10}$/.test(idsede)) return null;
	if (/^9\d{8}$/.test(crudo)) return { telefono: '51' + crudo, idorg, idsede };   // celular peruano pelado
	if (/^51\d{9}$/.test(crudo)) return { telefono: crudo, idorg, idsede };
	return null;
};

const armarMensaje = (nombre, telefono, minutos) => {
	const quien = String(nombre || '').trim().split(/\s+/)[0] || 'tu repartidor';
	const cuando = minutos ? ` y llega en unos ${minutos} minutos` : '';
	const contacto = telefono ? ` Su numero es ${telefono} por si necesitas coordinar algo.` : '';
	return `Tu pedido ya salio 🛵 Lo lleva ${quien}${cuando}.${contacto}`;
};

const avisarSalida = async (idrepartidor, data) => {
	const idpedido = Number(data && data.idpedido) || 0;
	const paso = Number(data && data.time_line && data.time_line.paso);
	if (!idpedido || !idrepartidor || paso !== AVISO_PASO_EN_CAMINO) return;

	if (avisosEnCurso.has(idpedido)) return;
	avisosEnCurso.add(idpedido);
	try {
		await avisarSalidaUnaVez(idrepartidor, idpedido);
	} finally {
		avisosEnCurso.delete(idpedido);
	}
};

const avisarSalidaUnaVez = async (idrepartidor, idpedido) => {
	const yaAvisado = await QueryServiceV1.ejecutarConsulta(
		`SELECT 1 FROM repartidor_evento_log WHERE idpedido = ? AND evento = ? LIMIT 1`,
		[idpedido, AVISO_SALIDA], 'SELECT', 'avisoSalidaDedupe');
	if (yaAvisado && yaAvisado.length) return;

	const filas = await QueryServiceV1.ejecutarConsulta(
		`SELECT pv.id AS sesion, r.nombre, r.telefono, r.position_now,
				CASE WHEN JSON_VALID(p.json_datos_delivery) THEN JSON_UNQUOTE(JSON_EXTRACT(
					p.json_datos_delivery, '$.p_header.arrDatosDelivery.direccionEnvioSelected.latitude')) END AS dest_lat,
				CASE WHEN JSON_VALID(p.json_datos_delivery) THEN JSON_UNQUOTE(JSON_EXTRACT(
					p.json_datos_delivery, '$.p_header.arrDatosDelivery.direccionEnvioSelected.longitude')) END AS dest_lng
		   FROM pedido p
		   JOIN pedido_preview pv ON pv.idpedido = p.idpedido
		   LEFT JOIN repartidor r ON r.idrepartidor = p.idrepartidor
		  WHERE p.idpedido = ? AND p.idrepartidor = ? AND p.estado <> 3
			AND COALESCE(p.pwa_delivery_status, '0') NOT IN ('4', '5')
		  LIMIT 1`,
		[idpedido, idrepartidor], 'SELECT', 'avisoSalidaDatos');

	const f = filas && filas[0];
	if (!f) return;   // no vino del chatbot, esta anulado, o no es de este repartidor

	const sesion = leerSesion(f.sesion);
	if (!sesion) return;

	const pos = leerJson(f.position_now) || {};
	const minutos = minutosAviso(num(pos.latitude), num(pos.longitude),
		num(f.dest_lat), num(f.dest_lng));
	const mensaje = armarMensaje(f.nombre, f.telefono, minutos);

	// mismo room y mismo formato que usa controllers/chatbotEmitir.js
	const room = `mensajeria_${sesion.idorg}${sesion.idsede}`;
	const gateway = await socketManager.getIO().in(room).fetchSockets();
	if (!gateway.length) {
		// sin marcar a proposito: si el gateway vuelve antes de la entrega, el siguiente paso 2 lo manda
		logger.warn('aviso de salida: no hay gateway de WhatsApp conectado', { room, idpedido });
		return;
	}
	// La marca se escribe ANTES de emitir. Si se escribiera despues y el INSERT fallara,
	// el mensaje ya habria salido sin dejar rastro y el siguiente paso 2 se lo mandaria de
	// nuevo. Escribiendo primero, el peor caso es que el cliente no reciba el aviso, que es
	// como estaba antes de esta funcion; al reves el peor caso es escribirle dos veces.
	// ejecutarConsulta no lanza: devuelve false. Hay que mirar lo que devuelve.
	const marcado = await QueryServiceV1.ejecutarConsulta(
		`INSERT INTO repartidor_evento_log (idrepartidor, idpedido, evento, canal, detalle)
		 VALUES (?, ?, ?, 'whatsapp', ?)`,
		[idrepartidor, idpedido, AVISO_SALIDA,
			JSON.stringify({ room, minutos, telefono: `***${sesion.telefono.slice(-4)}` })],
		'INSERT', 'avisoSalidaLog');
	if (marcado === false) {
		logger.error('aviso de salida: no se pudo marcar, no se envia', { idpedido, room });
		return;
	}

	socketManager.emitToRoom(room, 'send_message', [{ numero: sesion.telefono, mensaje, tipo: 'texto' }]);
	logger.info('aviso de salida enviado', { idpedido, room, minutos });
};

// ── Recorrido del pedido ────────────────────────────────────────────────────────
//
// Sirve para responder un "nunca llego" con el trazo real en el mapa, en vez de la
// palabra del repartidor contra la del cliente.
//
// Se graba con el mismo pulso de 30 s que la posicion, y SOLO de los pedidos que el
// repartidor tiene asignados y sin entregar. Fuera de una entrega su ubicacion no le
// sirve a nadie y guardarla seria seguir a una persona sin motivo.
const RECORRIDO_MAX_PUNTOS = 500;   // 500 x 30 s = mas de 4 h; techo por si olvida marcar la entrega

const guardarRecorrido = async (idrepartidor, lat, lng) => {
	if (!idrepartidor) return;
	// El NOT IN ('4','5') es el filtro canonico de "entrega activa", el mismo de
	// getMiEstado: liberar un pedido solo escribe pwa_delivery_status = '5' y no toca
	// idrepartidor ni estado, asi que sin esto el GPS se seguiria guardando despues de
	// que el repartidor soltara el pedido. El rango de fecha corta los pedidos que
	// quedaron colgados sin marcar; necesita el indice (idrepartidor, fecha_hora) de la
	// migracion 039, porque pedido_idrepartidor_IDX solo lleva idrepartidor
	const pedidos = await QueryServiceV1.ejecutarConsulta(
		`SELECT p.idpedido, p.idsede
		   FROM pedido p
		  WHERE p.idrepartidor = ? AND p.pwa_is_delivery = 1 AND p.estado <> 3
			AND COALESCE(p.pwa_delivery_status, '0') NOT IN ('4', '5')
			AND p.fecha_hora >= CURDATE() - INTERVAL 1 DAY
			AND NOT EXISTS (SELECT 1 FROM repartidor_pedido_entregado e WHERE e.idpedido = p.idpedido)`,
		[idrepartidor], 'SELECT', 'recorridoPedidosActivos');

	for (const pedido of pedidos || []) {
		// VALUES(puntos) es el array de un solo punto que trae este mismo INSERT; se le saca
		// el elemento y se agrega al array que ya esta guardado. Asi el punto viaja una sola
		// vez y no hace falta leer el JSON para reescribirlo.
		// (VALUES() dentro de ON DUPLICATE KEY esta deprecado desde MySQL 8.0.20 pero sigue
		//  funcionando; el dia que se elimine, la forma nueva es un alias: ... AS nuevo ...)
		await QueryServiceV1.ejecutarConsulta(
			`INSERT INTO repartidor_recorrido (idpedido, idrepartidor, idsede, inicio, fin, puntos)
			 VALUES (?, ?, ?, NOW(), NOW(), JSON_ARRAY(JSON_ARRAY(?, ?, UNIX_TIMESTAMP())))
			 ON DUPLICATE KEY UPDATE
			   fin = NOW(),
			   puntos = IF(JSON_LENGTH(puntos) < ?,
						   JSON_ARRAY_APPEND(puntos, '$', JSON_EXTRACT(VALUES(puntos), '$[0]')),
						   puntos)`,
			[pedido.idpedido, idrepartidor, pedido.idsede, lat, lng, RECORRIDO_MAX_PUNTOS],
			'INSERT', 'recorridoPunto');
	}
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

			guardarRecorrido(idrepartidor, lat, lng).catch((e) => logger.error(
				'recorrido: no se pudo guardar el punto', { error: e.message, idrepartidor }));
		});

		// la app avisa cada cambio de paso del pedido; en el paso 2 el cliente recibe su aviso.
		// sockets.js ya escucha este mismo evento: socket.io admite varios listeners y no se pisan.
		socket.on('repartidor-notifica-cliente-time-line-one', (data) => {
			avisarSalida(idrepartidor, data).catch((e) => logger.error('aviso de salida: fallo',
				{ error: e.message, idpedido: data && data.idpedido }));
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
module.exports._leerSesion = leerSesion;
module.exports._minutosAviso = minutosAviso;
module.exports._armarMensaje = armarMensaje;
module.exports._num = num;
