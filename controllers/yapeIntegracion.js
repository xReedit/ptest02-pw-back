// yapeIntegracion.js
//
// Integración con el verificador de pagos Yape/Plin (repo yape-read-notification).
// Dos direcciones:
//
//   1) ENTRANTE: yapehub nos avisa cuando un cajero CONFIRMA un pago.
//      POST /yape/confirmacion  (firma HMAC en x-webhook-signature)
//      → emitimos al room de la sede: `room${idorg}${idsede}` por Socket.IO,
//        mismo formato que usa el resto del POS (ver controllers/sockets.js:291).
//
//   2) SALIENTE: el admin de una sede vincula su verificador ingresando el
//      código que muestra el emisor (app Android).
//      POST /yape/vincular  (auth normal del POS; idorg/idsede salen del token)
//      → reenviamos {code, idorg, idsede} a yapehub con la x-api-key compartida.
//
// Todo el código de esta integración vive en este archivo (+ routes/routesYape.js
// y dos líneas de montaje en app.js). No modifica lógica existente.

const crypto = require('crypto');
const logger = require('../utilitarios/logger');
const socketManager = require('../service/socket.manager');
const { ReE, ReS } = require('../service/uitl.service');

// compararSeguro: timing-safe, iguala tamaños con un hash previo.
function compararSeguro(a, b) {
    const ha = crypto.createHash('sha256').update(String(a)).digest();
    const hb = crypto.createHash('sha256').update(String(b)).digest();
    return crypto.timingSafeEqual(ha, hb);
}

// Firma esperada = 'sha256=' + HMAC-SHA256(JSON.stringify(body), secret).
// yapehub firma exactamente los mismos bytes (sin escapar HTML, claves
// alfabéticas), así que re-serializar el body parseado reproduce la firma.
function firmaValida(body, signature, secret) {
    if (!secret) return false;
    const esperada = 'sha256=' + crypto.createHmac('sha256', secret)
        .update(JSON.stringify(body)).digest('hex');
    if (!signature || signature.length !== esperada.length) return false;
    return compararSeguro(signature, esperada);
}

// 1) ENTRANTE — confirmación de pago desde yapehub → emitir al room de la sede.
exports.confirmacion = async function (req, res) {
    const secret = process.env.YAPE_WEBHOOK_SECRET;
    if (!secret) {
        logger.error('[yape/confirmacion] YAPE_WEBHOOK_SECRET no configurada, rechazando');
        return ReE(res, 'servicio no configurado', 503);
    }
    if (!firmaValida(req.body, req.headers['x-webhook-signature'], secret)) {
        logger.warn('[yape/confirmacion] firma inválida', { ip: req.ip });
        return ReE(res, 'firma inválida', 401);
    }

    const { idorg, idsede } = req.body || {};
    if (!/^\d{1,10}$/.test(String(idorg)) || !/^\d{1,10}$/.test(String(idsede))) {
        return ReE(res, 'idorg/idsede inválidos (solo dígitos)', 400);
    }

    // MISMO formato que controllers/sockets.js:291 — sin separador. Ambiguo por
    // diseño (12,5)==(1,25), pero hay que construirlo idéntico o el emit cae en
    // otro room.
    const room = 'room' + idorg + idsede;
    socketManager.emitToRoom(room, 'yape-pago-confirmado', req.body);
    logger.debug('[yape/confirmacion] emitido', { room });

    // 200 aunque el room esté vacío: la confirmación ya es autoritativa en
    // yapehub; el socket es solo el aviso en vivo al POS.
    return ReS(res, { ok: true, room });
};

// 2) SALIENTE — el POS (admin autenticado) vincula el verificador con esta sede.
// Body: { code }. idorg/idsede se toman del token (req.usuariotoken).
exports.vincular = async function (req, res) {
    const base = process.env.YAPEHUB_URL;
    const apiKey = process.env.YAPEHUB_API_KEY;
    if (!base || !apiKey) {
        logger.error('[yape/vincular] YAPEHUB_URL/API_KEY no configuradas');
        return ReE(res, 'servicio no configurado', 503);
    }
    const code = (req.body && req.body.code || '').toString().trim();
    if (!code) return ReE(res, 'falta code', 400);

    const idorg = req.usuariotoken && req.usuariotoken.idorg;
    const idsede = req.usuariotoken && req.usuariotoken.idsede;
    if (!idorg || !idsede) {
        return ReE(res, 'el token no tiene idorg/idsede', 400);
    }

    try {
        const r = await fetch(base.replace(/\/$/, '') + '/api/sedes/vincular', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'X-API-Key': apiKey },
            body: JSON.stringify({ code, idorg: Number(idorg), idsede: Number(idsede) }),
        });
        const data = await r.json().catch(() => ({}));
        if (!r.ok) return ReE(res, data.error || 'no se pudo vincular', r.status);
        return ReS(res, data);
    } catch (e) {
        logger.error('[yape/vincular] error llamando a yapehub', { err: String(e) });
        return ReE(res, 'no se pudo conectar con el verificador', 502);
    }
};
