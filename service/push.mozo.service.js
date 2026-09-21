// Push FCM a la app mozo: "mesa X solicita atencion" y "pedido / plato listo" desde la zona de despacho.
// Tabla usuario_push_token (migracion 2026-09-07_027).
const QueryServiceV1 = require('./query.service.v1');
const { admin: adminFirebase } = require('../firebase_config');
const logger = require('../utilitarios/logger');
const { ReE, ReS } = require('./uitl.service');

// ponytail: constante; pasar a sede_opciones si alguna sede pide otro plazo
const HORAS_MOZO_ACTIVO = 24;
const CANAL_ANDROID = 'llamado_mesa'; // lo crea la app en NotificacionPushService

// POST mozo/push-token  body: { fcm_token, idusuario, plataforma, op: 'set' | 'del' }
const setPushToken = async (req, res) => {
	const { fcm_token, op } = req.body || {};
	const idsede = req.usuariotoken?.idsede;
	// idusuario viene del body: en punto toma pedidos cambian de mozo sin renovar el JWT
	const idusuario = parseInt(req.body?.idusuario) || req.usuariotoken?.idusuario;
	const plataforma = String(req.body?.plataforma || 'android').slice(0, 10);

	if (typeof fcm_token !== 'string' || fcm_token.length < 20 || fcm_token.length > 255) {
		return ReE(res, 'fcm_token invalido', 400);
	}
	if (!idsede || !idusuario) return ReE(res, 'token sin sede/usuario', 400);

	if (op === 'del') {
		await QueryServiceV1.ejecutarConsulta(
			'DELETE FROM usuario_push_token WHERE fcm_token = ?', [fcm_token], 'DELETE', 'setPushToken.del');
		return ReS(res, { ok: true });
	}

	await QueryServiceV1.ejecutarConsulta(
		`INSERT INTO usuario_push_token (fcm_token, idusuario, idsede, plataforma, last_seen_at)
		 VALUES (?, ?, ?, ?, NOW())
		 ON DUPLICATE KEY UPDATE idusuario = VALUES(idusuario), idsede = VALUES(idsede),
		   plataforma = VALUES(plataforma), last_seen_at = NOW()`,
		[fcm_token, idusuario, idsede, plataforma], 'INSERT', 'setPushToken.set');
	return ReS(res, { ok: true });
};

// se llama al conectar el socket del mozo: marca que sigue usando la app
const setMozoActivo = (idusuario) => {
	const id = parseInt(idusuario);
	if (!id) return;
	QueryServiceV1.ejecutarConsulta(
		'UPDATE usuario_push_token SET last_seen_at = NOW() WHERE idusuario = ?', [id], 'UPDATE', 'setMozoActivo')
		.catch(err => logger.error({ err, idusuario: id }, 'setMozoActivo'));
};

// envia a los tokens dados y borra los que FCM reporta como muertos. Devuelve { ok, fail }.
const enviarATokens = async (tokens, { title, body, data, tag }, ctxLog) => {
	if (!tokens.length) return { ok: 0, fail: 0 };

	const resp = await adminFirebase.messaging().sendEachForMulticast({
		tokens,
		notification: { title, body },
		data,
		android: {
			priority: 'high',
			notification: { channelId: CANAL_ANDROID, sound: 'default', priority: 'high', tag }
		},
		apns: { payload: { aps: { sound: 'default' } } }
	});
	logger.debug({ ...ctxLog, ok: resp.successCount, fail: resp.failureCount }, 'push mozo');
	resp.responses.forEach((r, i) => {
		if (r.error) logger.error({ token: tokens[i].slice(0, 12), code: r.error.code, msg: r.error.message }, 'push mozo: token fallido');
	});

	// tokens que ya no sirven se borran: app desinstalada, token corrupto,
	// o emitido por otro proyecto Firebase (mismatched-credential) que este backend nunca podra usar
	const CODIGOS_TOKEN_MUERTO = [
		'messaging/registration-token-not-registered',
		'messaging/invalid-argument',
		'messaging/mismatched-credential',
	];
	const muertos = tokens.filter((t, i) => CODIGOS_TOKEN_MUERTO.includes(resp.responses[i]?.error?.code));
	if (muertos.length) {
		await QueryServiceV1.ejecutarConsulta(
			'DELETE FROM usuario_push_token WHERE fcm_token IN (?)', [muertos], 'DELETE', 'enviarATokens.limpiar');
	}
	return { ok: resp.successCount, fail: resp.failureCount };
};

// envia el push a todos los dispositivos activos de la sede
const sendLlamadoMesa = async (idsede, numMesa) => {
	try {
		const rows = await QueryServiceV1.ejecutarConsulta(
			`SELECT fcm_token FROM usuario_push_token
			 WHERE idsede = ? AND last_seen_at >= NOW() - INTERVAL ? HOUR`,
			[parseInt(idsede), HORAS_MOZO_ACTIVO], 'SELECT', 'sendLlamadoMesa.tokens');
		await enviarATokens((rows || []).map(r => r.fcm_token), {
			title: `Mesa ${numMesa} solicita atención`,
			body: `Un cliente solicita atención en la mesa ${numMesa}`,
			data: { tipo: 'llamado_mesa', num_mesa: String(numMesa) },
			tag: `mesa_${numMesa}`,
		}, { idsede, numMesa });
	} catch (err) {
		logger.error({ err, idsede, numMesa }, 'sendLlamadoMesa');
	}
};

// "Pedido de la mesa 10 listo" / "De la mesa 10 - 2 Lomo saltado listo"; sin mesa usa el correlativo del dia
const textoPedidoListo = (p, idpedidoDetalle) => {
	const tieneMesa = p.nummesa && String(p.nummesa) !== '0';
	if (!idpedidoDetalle) {
		return tieneMesa ? `Pedido de la mesa ${p.nummesa} listo` : `Pedido #${p.correlativo_dia} listo`;
	}
	const cant = parseInt(p.cantidad) > 1 ? `${parseInt(p.cantidad)} ` : '';
	const origen = tieneMesa ? `De la mesa ${p.nummesa}` : `Del pedido #${p.correlativo_dia}`;
	return `${origen} - ${cant}${p.descripcion} listo`;
};

// sede_opciones.mozo_aviso_plato_listo (migracion restobar 2026-09-20_022): '0' = la sede no quiere el aviso.
// Sin fila, o si la columna aun no existe en esa BD, se avisa (es el valor por defecto).
const sedeAvisaPlatoListo = async (idsede) => {
	try {
		const op = await QueryServiceV1.ejecutarConsulta(
			'SELECT mozo_aviso_plato_listo FROM sede_opciones WHERE idsede = ?', [idsede], 'SELECT', 'sedeAvisaPlatoListo');
		return !(op && op[0] && String(op[0].mozo_aviso_plato_listo) === '0');
	} catch (err) {
		logger.warn({ err: err.message, idsede }, 'sedeAvisaPlatoListo: no se pudo leer la opcion, se avisa igual');
		return true;
	}
};

// POST mozo/push-pedido-listo  body: { idsede, idpedido, idpedido_detalle? }
// Lo llama el POS (bdphp/push_mozo.php) cuando la zona de despacho marca el pedido o un plato como listo.
// Avisa solo al mozo que hizo el pedido (pedido.idusuario), a sus dispositivos de esa sede.
const setPedidoListo = async (req, res) => {
	const idsede = parseInt(req.body?.idsede);
	const idpedido = parseInt(req.body?.idpedido);
	const idpedidoDetalle = parseInt(req.body?.idpedido_detalle) || 0;
	if (!idsede || !idpedido) return ReE(res, 'idsede e idpedido requeridos', 400);

	try {
		if (!(await sedeAvisaPlatoListo(idsede))) {
			return ReS(res, { ok: 0, motivo: 'aviso desactivado en la sede' });
		}

		const rows = await QueryServiceV1.ejecutarConsulta(
			`SELECT p.idusuario, p.nummesa, p.correlativo_dia, pd.descripcion, pd.cantidad
			 FROM pedido p
			 LEFT JOIN pedido_detalle pd ON pd.idpedido = p.idpedido AND pd.idpedido_detalle = ?
			 WHERE p.idpedido = ? AND p.idsede = ?`,
			[idpedidoDetalle, idpedido, idsede], 'SELECT', 'setPedidoListo.pedido');
		const p = rows?.[0];
		if (!p) return ReE(res, 'pedido no encontrado', 404);
		if (idpedidoDetalle && !p.descripcion) return ReE(res, 'detalle no encontrado', 404);
		if (!p.idusuario) return ReS(res, { ok: 0, motivo: 'pedido sin usuario' });

		const tokens = await QueryServiceV1.ejecutarConsulta(
			`SELECT fcm_token FROM usuario_push_token
			 WHERE idusuario = ? AND idsede = ? AND last_seen_at >= NOW() - INTERVAL ? HOUR`,
			[p.idusuario, idsede, HORAS_MOZO_ACTIVO], 'SELECT', 'setPedidoListo.tokens');

		const title = textoPedidoListo(p, idpedidoDetalle);
		const tieneMesa = p.nummesa && String(p.nummesa) !== '0';
		const cant = parseInt(p.cantidad) > 1 ? `${parseInt(p.cantidad)} ` : '';
		const r = await enviarATokens((tokens || []).map(t => t.fcm_token), {
			title,
			body: idpedidoDetalle ? 'Cocina ya tiene el plato listo' : 'Cocina ya tiene el pedido completo',
			// ref y plato los usa la app para la tarjeta "Pedido Listo" cuando esta abierta
			data: {
				tipo: 'pedido_listo', idpedido: String(idpedido), idpedido_detalle: String(idpedidoDetalle),
				ref: tieneMesa ? `Mesa ${p.nummesa}` : `Pedido #${p.correlativo_dia}`,
				plato: idpedidoDetalle ? `${cant}${p.descripcion}` : '',
			},
			tag: idpedidoDetalle ? `pd_${idpedidoDetalle}` : `pedido_${idpedido}`,
		}, { idsede, idpedido, idpedidoDetalle, idusuario: p.idusuario });
		// info siempre: si el mozo del pedido no tiene token, que quede rastro de por que no llego
		logger.info({ idsede, idpedido, idpedidoDetalle, idusuario: p.idusuario, tokens: (tokens || []).length, ...r, title }, 'push pedido listo');
		return ReS(res, { ...r, title });
	} catch (err) {
		logger.error({ err, idsede, idpedido, idpedidoDetalle }, 'setPedidoListo');
		return ReE(res, 'error enviando push', 500);
	}
};

module.exports = { setPushToken, setMozoActivo, sendLlamadoMesa, setPedidoListo, textoPedidoListo };
