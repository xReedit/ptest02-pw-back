// Push FCM al cliente delivery cuando cambia el estado de su pedido.
// El token vive en cliente_socketid.key_suscripcion_push con el formato
// { "tipo": "fcm", "token": "...", "plataforma": "android" }.
// Las suscripciones web push viejas (objeto PushSubscription con endpoint) se ignoran:
// ponytail: el push web queda fuera de alcance mientras la PWA no registre service worker.
const QueryServiceV1 = require('./query.service.v1');
const { admin: adminFirebase } = require('../firebase_config');
const logger = require('../utilitarios/logger');

const CANAL_ANDROID = 'pedidos'; // lo crea la app en NotificacionPushService
const LARGO_MINIMO_TOKEN = 20;
const LARGO_MAXIMO_TOKEN = 4096;

function esLargoDeToken(valor) {
	return typeof valor === 'string' && valor.length >= LARGO_MINIMO_TOKEN && valor.length <= LARGO_MAXIMO_TOKEN;
}

// Mismas etiquetas que ve el cliente en "Mis pedidos" (sprint 2).
const MENSAJES = {
	recibido:   { title: 'Recibido',             body: 'Recibimos tu pedido #%s. Te avisamos cuando el local lo confirme.' },
	aceptado:   { title: 'Aceptado',             body: 'El local acepto tu pedido #%s.' },
	preparando: { title: 'En preparacion',       body: 'Tu pedido #%s ya se esta preparando.' },
	asignado:   { title: 'Repartidor asignado',  body: 'Un repartidor tomo tu pedido #%s.' },
	camino:     { title: 'En camino',            body: 'Tu pedido #%s ya salio hacia tu direccion.' },
	entregado:  { title: 'Entregado',            body: 'Tu pedido #%s fue entregado. Buen provecho.' },
	cancelado:  { title: 'Cancelado',            body: 'Tu pedido #%s fue cancelado.' }
};

// Solo codigos que significan "este token concreto ya no existe". A proposito NO estan
// 'messaging/invalid-argument' ni 'messaging/mismatched-credential': los dispara un mensaje mal
// armado o un service account equivocado, asi que un mal deploy borraria el token de toda la base.
const CODIGOS_TOKEN_MUERTO = [
	'messaging/registration-token-not-registered',
	'messaging/invalid-registration-token',
];

// Misma tabla de decision que resumirEstadoPedido() en la app (src/app/shared/utils/estado-pedido.ts).
// ponytail: 'aceptado' no lo produce hoy ningun dato (el local marca 'A' tanto para aceptado
// como para en preparacion); queda definido para cuando "Mi tienda" confirme manualmente.
function codigoEstado(pwa_estado, pwa_delivery_status) {
	const local = String(pwa_estado || 'P').toUpperCase();
	const reparto = String(pwa_delivery_status === null || pwa_delivery_status === undefined ? '0' : pwa_delivery_status);
	if (local === 'C' || reparto === '5') { return 'cancelado'; }
	if (local === 'E' || reparto === '4') { return 'entregado'; }
	if (reparto === '3') { return 'camino'; }
	if (reparto === '1' || local === 'R') { return 'asignado'; }
	if (local === 'A' || local === 'D') { return 'preparando'; }
	return 'recibido';
}

function construirMensaje(idpedido, pwa_estado, pwa_delivery_status) {
	const codigo = codigoEstado(pwa_estado, pwa_delivery_status);
	const plantilla = MENSAJES[codigo];
	return { codigo, title: plantilla.title, body: plantilla.body.replace('%s', String(idpedido)) };
}

// Devuelve { token, plataforma } o null si la columna no guarda un token FCM.
function leerTokenFcm(valor) {
	if (!valor) { return null; }
	let dato = valor;
	if (typeof dato === 'string') {
		// filas viejas: el token pudo guardarse crudo, sin comillas JSON
		try { dato = JSON.parse(dato); } catch (error) { return esLargoDeToken(valor) ? { token: valor, plataforma: 'android' } : null; }
	}
	if (typeof dato === 'string') {
		return esLargoDeToken(dato) ? { token: dato, plataforma: 'android' } : null;
	}
	if (!dato || typeof dato !== 'object') { return null; }
	if (dato.tipo !== 'fcm') { return null; }
	if (!esLargoDeToken(dato.token)) { return null; }
	return { token: dato.token, plataforma: dato.plataforma === 'ios' ? 'ios' : 'android' };
}

async function limpiarToken(idcliente) {
	await QueryServiceV1.ejecutarConsulta(
		'UPDATE cliente_socketid SET key_suscripcion_push = NULL WHERE idcliente = ?',
		[idcliente], 'UPDATE', 'pushCliente.limpiarToken');
}

async function notificarEstado({ idpedido, idcliente, pwa_estado, pwa_delivery_status }) {
	const id = parseInt(idcliente, 10);
	const pedido = parseInt(idpedido, 10);
	if (!Number.isFinite(id) || id <= 0 || !Number.isFinite(pedido) || pedido <= 0) { return; }

	try {
		const rows = await QueryServiceV1.ejecutarConsulta(
			'SELECT key_suscripcion_push FROM cliente_socketid WHERE idcliente = ?',
			[id], 'SELECT', 'pushCliente.token');
		const suscripcion = leerTokenFcm(rows && rows[0] ? rows[0].key_suscripcion_push : null);
		if (!suscripcion) { return; }

		const mensaje = construirMensaje(pedido, pwa_estado, pwa_delivery_status);

		try {
			await adminFirebase.messaging().send({
				token: suscripcion.token,
				notification: { title: mensaje.title, body: mensaje.body },
				data: { tipo: 'estado_pedido', idpedido: String(pedido) },
				android: {
					priority: 'high',
					notification: { channelId: CANAL_ANDROID, sound: 'default', priority: 'high', tag: `pedido_${pedido}` }
				},
				apns: { payload: { aps: { sound: 'default' } } }
			});
			logger.debug({ idpedido: pedido, idcliente: id, estado: mensaje.codigo }, 'push cliente enviado');
		} catch (err) {
			// nunca se loguea el token completo
			logger.error({ idpedido: pedido, idcliente: id, code: err.code, token: suscripcion.token.slice(0, 12) }, 'push cliente fallido');
			if (CODIGOS_TOKEN_MUERTO.includes(err.code)) {
				await limpiarToken(id);
			}
		}
	} catch (error) {
		logger.error({ error: error.message, idpedido: pedido, idcliente: id }, 'pushCliente.notificarEstado');
	}
}

module.exports = { notificarEstado, construirMensaje, codigoEstado, leerTokenFcm, MENSAJES, CANAL_ANDROID };
