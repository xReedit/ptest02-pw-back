// Pasarela Niubiz (VisaNet). Las credenciales viven SOLO aqui (variables de entorno),
// nunca en el frontend. El navegador solo recibe sessionKey, merchantId y urls publicas.
const fetch = require('node-fetch');
const { ReE, ReS } = require('../service/uitl.service');
const logger = require('../utilitarios/logger');

const URLS = {
	prod: {
		seguridad: 'https://apiprod.vnforapps.com/api.security/v1/security',
		sesion: 'https://apiprod.vnforapps.com/api.ecommerce/v2/ecommerce/token/session/',
		autorizacion: 'https://apiprod.vnforapps.com/api.authorization/v3/authorization/ecommerce/',
		js: 'https://static-content.vnforapps.com/v2/js/checkout.js'
	},
	sandbox: {
		seguridad: 'https://apitestenv.vnforapps.com/api.security/v1/security',
		sesion: 'https://apitestenv.vnforapps.com/api.ecommerce/v2/ecommerce/token/session/',
		autorizacion: 'https://apitestenv.vnforapps.com/api.authorization/v3/authorization/ecommerce/',
		js: 'https://static-content-qas.vnforapps.com/v2/js/checkout.js?qa=true'
	}
};
const LOGO = 'https://papaya.com.pe/images/l-pay-2.png';
const MONEDA = 'PEN';

// ponytail: una credencial global por entorno; cuando exista sede_pasarela_pago, consultar aqui por idsede
async function getNiubizCredentials(idsede) {
	const env = process.env.NIUBIZ_ENV === 'prod' ? 'prod' : 'sandbox';
	// Permite tener ambos juegos en el .env (NIUBIZ_PROD_* / NIUBIZ_SANDBOX_*) y elegir con NIUBIZ_ENV.
	const pick = (clave) => process.env[`NIUBIZ_${env.toUpperCase()}_${clave}`] || process.env[`NIUBIZ_${clave}`];
	const merchantId = pick('MERCHANT_ID');
	const user = pick('USER');
	const pass = pick('PASS');
	if (!merchantId || !user || !pass) { throw new Error('Niubiz sin configurar'); }
	return { env, merchantId, user, pass, urls: URLS[env] };
}

async function getSecurityToken(cred) {
	const auth = Buffer.from(`${cred.user}:${cred.pass}`).toString('base64');
	const r = await fetch(cred.urls.seguridad, {
		method: 'POST',
		headers: { Authorization: `Basic ${auth}`, Accept: '*/*' }
	});
	if (!r.ok) { throw new Error(`Niubiz seguridad ${r.status}`); }
	return r.text();
}

// Mismos campos MDD que enviaba el frontend (niubiz.service.ts / pago-tarjeta-visanet.service.ts).
// Sin clientData devuelve null: el flujo de mesa enviaba "antifraud": null en la sesion.
function buildAntifraud(req) {
	const cliente = req.body.clientData;
	if (!cliente) { return null; }
	return {
		clientIp: cliente.ip || req.ip || '0.0.0.0',
		merchantDefineData: {
			MDD4: cliente.email || '',
			MDD32: String(cliente.idcliente || '0'),
			MDD75: 'Invitado',
			MDD77: cliente.diasRegistrado || 0,
			MDD89: '1'
		}
	};
}

function montoValido(amount) {
	const monto = Number(amount);
	return (Number.isFinite(monto) && monto > 0) ? Number(monto.toFixed(2)) : null;
}

const crearSesion = async function (req, res) {
	try {
		const { idsede, amount, purchaseNumber, channel } = req.body;
		const monto = montoValido(amount);
		if (monto === null) { return ReE(res, 'amount invalido', 400); }
		const cred = await getNiubizCredentials(Number(idsede));
		const token = await getSecurityToken(cred);
		const pn = purchaseNumber || String(Date.now()).slice(-12);
		const r = await fetch(`${cred.urls.sesion}${cred.merchantId}`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json', Authorization: token },
			body: JSON.stringify({
				amount: monto,
				antifraud: buildAntifraud(req),
				channel: channel || 'web',
				recurrenceMaxAmount: null
			})
		});
		const data = await r.json();
		if (!r.ok || !data.sessionKey) {
			logger.error({ status: r.status, errorCode: data && data.errorCode }, 'Niubiz sesion');
			return ReE(res, 'No se pudo crear la sesion de pago', 502);
		}
		return ReS(res, {
			data: {
				sessionKey: data.sessionKey,
				expirationTime: data.expirationTime,
				merchantId: cred.merchantId,
				purchaseNumber: pn,
				amount: monto,
				currency: MONEDA,
				urlJs: cred.urls.js,
				logo: LOGO
			}
		});
	} catch (error) {
		logger.error({ error: error.message }, 'crearSesion niubiz');
		return ReE(res, 'Error al iniciar el pago', 500);
	}
};

const autorizar = async function (req, res) {
	try {
		const { idsede, purchaseNumber, amount, transactionToken, channel } = req.body;
		const monto = montoValido(amount);
		if (!purchaseNumber || !transactionToken || monto === null) { return ReE(res, 'datos incompletos', 400); }
		// ponytail: el monto viene del cliente; cuando el pedido se registre antes del cobro, derivarlo del idpedido
		const cred = await getNiubizCredentials(Number(idsede));
		const token = await getSecurityToken(cred);
		const r = await fetch(`${cred.urls.autorizacion}${cred.merchantId}`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json', Authorization: token },
			body: JSON.stringify({
				antifraud: buildAntifraud(req),
				captureType: 'manual',
				channel: channel || 'web',
				countable: false,
				order: {
					amount: monto,
					currency: MONEDA,
					purchaseNumber: String(purchaseNumber),
					tokenId: transactionToken
				}
			})
		});
		const data = await r.json();
		const ok = r.ok && !data.errorCode && !!(data.dataMap && data.dataMap.ACTION_CODE === '000');
		if (!ok) {
			logger.warn({
				actionCode: data && data.dataMap && data.dataMap.ACTION_CODE,
				errorCode: data && data.errorCode
			}, 'Niubiz autorizacion rechazada');
		}
		// ReS mezcla {success:true} sobre el objeto, asi que una autorizacion rechazada
		// se responde directo para conservar success:false.
		return res.json({ success: ok, data });
	} catch (error) {
		logger.error({ error: error.message }, 'autorizar niubiz');
		return ReE(res, 'Error al autorizar el pago', 500);
	}
};

module.exports = { crearSesion, autorizar, getNiubizCredentials };
