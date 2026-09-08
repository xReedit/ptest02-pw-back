// Push FCM a la app mozo: "mesa X solicita atencion".
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

// envia el push a todos los dispositivos activos de la sede
const sendLlamadoMesa = async (idsede, numMesa) => {
	try {
		const rows = await QueryServiceV1.ejecutarConsulta(
			`SELECT fcm_token FROM usuario_push_token
			 WHERE idsede = ? AND last_seen_at >= NOW() - INTERVAL ? HOUR`,
			[parseInt(idsede), HORAS_MOZO_ACTIVO], 'SELECT', 'sendLlamadoMesa.tokens');
		const tokens = (rows || []).map(r => r.fcm_token);
		if (!tokens.length) return;

		const resp = await adminFirebase.messaging().sendEachForMulticast({
			tokens,
			notification: {
				title: `Mesa ${numMesa} solicita atención`,
				body: `Un cliente solicita atención en la mesa ${numMesa}`,
			},
			data: { tipo: 'llamado_mesa', num_mesa: String(numMesa) },
			android: {
				priority: 'high',
				notification: { channelId: CANAL_ANDROID, sound: 'default', priority: 'high', tag: `mesa_${numMesa}` }
			},
			apns: { payload: { aps: { sound: 'default' } } }
		});
		logger.debug({ idsede, numMesa, ok: resp.successCount, fail: resp.failureCount }, 'push llamado mesa');
		resp.responses.forEach((r, i) => {
			if (r.error) logger.error({ token: tokens[i].slice(0, 12), code: r.error.code, msg: r.error.message }, 'push llamado mesa: token fallido');
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
				'DELETE FROM usuario_push_token WHERE fcm_token IN (?)', [muertos], 'DELETE', 'sendLlamadoMesa.limpiar');
		}
	} catch (err) {
		logger.error({ err, idsede, numMesa }, 'sendLlamadoMesa');
	}
};

module.exports = { setPushToken, setMozoActivo, sendLlamadoMesa };
