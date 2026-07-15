// chatbotEmitir.js
//
// Canal de salida del chatbot (repo chatbot-go). Ese servicio es
// request/response puro: solo contesta el webhook que lo invoca, así que NO
// puede hablarle a un cliente que no acaba de escribir. Cuando necesita iniciar
// (recordar un pedido que quedó a medias), llama aquí y nosotros emitimos al
// gateway de WhatsApp por el mismo socket que usa el resto de la mensajería:
//
//   io.to(`mensajeria_${idorg}${idsede}`).emit('send_message', [{numero, mensaje, tipo:'texto'}])
//
// Este endpoint puede escribirle a cualquier número desde el WhatsApp del
// restaurante, así que exige x-api-key y falla cerrado si no está configurada.

const crypto = require('crypto');
const logger = require('../utilitarios/logger');
const socketManager = require('../service/socket.manager');
const { ReE, ReS } = require('../service/uitl.service');

const MAX_MENSAJE = 1000; // un recordatorio son 2 líneas; esto es solo un tope sano

// compararSeguro evita filtrar la clave por diferencias de tiempo. timingSafeEqual
// explota si los largos difieren, de ahí el hash previo: iguala el tamaño.
function compararSeguro(a, b) {
    const ha = crypto.createHash('sha256').update(String(a)).digest();
    const hb = crypto.createHash('sha256').update(String(b)).digest();
    return crypto.timingSafeEqual(ha, hb);
}

// enmascarar deja solo los últimos 4 dígitos para los logs: basta para rastrear
// un envío sin dejar la agenda del restaurante en texto plano.
function enmascarar(numero) {
    const s = String(numero);
    return s.length <= 4 ? '***' : `***${s.slice(-4)}`;
}

// verificarApiKey protege la ruta. Sin CHATBOT_EMITIR_KEY en el entorno, RECHAZA
// todo: un canal para escribirle a clientes no debe quedar abierto por olvido.
exports.verificarApiKey = function (req, res, next) {
    const esperada = process.env.CHATBOT_EMITIR_KEY;
    if (!esperada) {
        logger.error('[chatbot/emitir] CHATBOT_EMITIR_KEY no configurada, rechazando');
        return ReE(res, 'servicio no configurado', 503);
    }
    const recibida = req.headers['x-api-key'];
    if (!recibida || !compararSeguro(recibida, esperada)) {
        logger.warn('[chatbot/emitir] api key inválida', { ip: req.ip });
        return ReE(res, 'no autorizado', 401);
    }
    next();
};

// emitir manda un mensaje de texto al cliente por WhatsApp.
// Body: { idorg, idsede, numero, mensaje }
exports.emitir = async function (req, res) {
    const { idorg, idsede, numero, mensaje } = req.body || {};

    if (!idorg || !idsede || !numero || !mensaje) {
        return ReE(res, 'faltan campos: idorg, idsede, numero, mensaje', 400);
    }
    // idorg/idsede se concatenan en el nombre del room: sin validar, un objeto
    // o un string raro entra como "[object Object]" y emite a un room fantasma.
    if (!/^\d{1,10}$/.test(String(idorg)) || !/^\d{1,10}$/.test(String(idsede))) {
        return ReE(res, 'idorg/idsede inválidos (solo dígitos)', 400);
    }
    // El numero va tal cual al gateway de WhatsApp: solo dígitos.
    if (!/^\d{6,15}$/.test(String(numero))) {
        return ReE(res, 'numero inválido (solo dígitos, 6-15)', 400);
    }
    const texto = String(mensaje).trim();
    if (!texto || texto.length > MAX_MENSAJE) {
        return ReE(res, `mensaje vacío o mayor a ${MAX_MENSAJE} caracteres`, 400);
    }

    // OJO: este formato (sin separador) es el que ya usan socketMenssagesWsp.js
    // y socketBot.js, y es al que se une el gateway. Es ambiguo —(12,5) y (1,25)
    // dan el mismo room— pero cambiarlo aquí solo, sin cambiar a quien se une,
    // rompería la mensajería entera. Se arregla en todos lados o en ninguno.
    const room = `mensajeria_${idorg}${idsede}`;

    try {
        // Un emit a un room vacío no falla: se pierde en silencio. Como quien
        // llama marca el recordatorio como enviado, eso le haría creer que el
        // cliente lo recibió. Preguntamos primero para poder devolver el fallo.
        const conectados = await socketManager.getIO().in(room).fetchSockets();
        if (conectados.length === 0) {
            logger.warn('[chatbot/emitir] sin gateway conectado, no se envía', { room });
            return ReE(res, `sin gateway conectado en ${room}`, 503);
        }

        socketManager.emitToRoom(room, 'send_message', [{ numero, mensaje: texto, tipo: 'texto' }]);
        logger.info('[chatbot/emitir] emitido', { room, numero: enmascarar(numero) });
        return ReS(res, { emitido: true, room }, 200);
    } catch (err) {
        logger.error('[chatbot/emitir] error emitiendo', { error: err.message, room });
        return ReE(res, 'error emitiendo', 500);
    }
};
