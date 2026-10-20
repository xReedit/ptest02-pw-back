// vision.js — puente /vision/v1 para Cámaras IA (repo papaya-vision).
// Contrato: {success, data} / {success:false, error:<codigo>}; la puerta está en
// middleware/vision.auth.js. Lee cuentas (sin escribir en la BD, salvo lo que escribe
// lastIdPedidoSede, igual que Control de pedidos) y reenvía alertas y eventos del
// servidor Go a la sede: push a los mozos y socket al room de la sede.

const logger = require('../utilitarios/logger');
const { ReE, ReS } = require('../service/uitl.service');
const vision = require('../service/vision.service');
const socketManager = require('../service/socket.manager');
const pushMozo = require('../service/push.mozo.service');

const VENTANA_PEDIDOS_MS = 24 * 3600 * 1000;
const ISO_CON_ZONA = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,9})?(Z|[+-]\d{2}:\d{2})$/;

const TIPOS_ALERTA = ['sin_atencion', 'cuenta_abierta', 'por_limpiar'];
const DESTINOS = ['mozos', 'caja'];
const EVENTOS = ['vision-mesas-estado', 'vision-alerta-resuelta'];
const MESA = /^[A-Za-z0-9-]{1,10}$/;
const MAX_TEXTO = 120;
const MAX_DATOS_BYTES = 64 * 1024;

// Entero > 0 escrito solo con dígitos ("13"; no "13abc", "1.5" ni un arreglo).
function idsedeDe(v) {
    if (typeof v !== 'string' || !/^\d{1,10}$/.test(v)) return null;
    const n = Number(v);
    return n > 0 && n <= 2147483647 ? n : null;
}

// ISO 8601 con zona y no más viejo que 24 h. Date.parse no entiende nanosegundos: se recortan a ms.
function desdeDe(v, ahora = Date.now()) {
    if (typeof v !== 'string' || !ISO_CON_ZONA.test(v)) return null;
    const ms = Date.parse(v.replace(/(\.\d{3})\d+/, '$1'));
    if (!Number.isFinite(ms) || ms < ahora - VENTANA_PEDIDOS_MS) return null;
    return new Date(ms);
}

function mesaDe(v) {
    if (typeof v !== 'string' || v.length > 50) return null;
    const k = vision.claveMesa(v);
    return k === '' || k === '0' ? null : v;
}

exports.cuentas = async function (req, res) {
    const idsede = idsedeDe(req.query.idsede);
    if (!idsede) return ReE(res, 'pedido_invalido', 400);
    try {
        const data = await vision.leerCuentas(idsede);
        return ReS(res, { data }, 200);
    } catch (err) {
        logger.error({ err: err.message, idsede }, '[vision] no se pudo leer las cuentas');
        return ReE(res, 'error_interno', 500);
    }
};

exports.pedidos = async function (req, res) {
    const idsede = idsedeDe(req.query.idsede);
    const mesa = mesaDe(req.query.mesa);
    const desde = desdeDe(req.query.desde);
    if (!idsede || !mesa || !desde) return ReE(res, 'pedido_invalido', 400);
    try {
        const data = await vision.leerPedidosMesa(idsede, mesa, desde);
        return ReS(res, { data }, 200);
    } catch (err) {
        logger.error({ err: err.message, idsede, mesa }, '[vision] no se pudo leer los pedidos de la mesa');
        return ReE(res, 'error_interno', 500);
    }
};

// --- salida: alertas y eventos del servidor Go -------------------------------------

// Mismo formato que controllers/sockets.js:399 (sin separador): si no, el emit cae en otro room.
const salaDe = (idorg, idsede) => 'room' + idorg + idsede;

const esObjeto = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
// Entero JSON > 0, como lo manda el Go (int64): ni "13" ni 13.5.
const enteroPositivo = (v) => Number.isSafeInteger(v) && v > 0;
const mesaValida = (v) => typeof v === 'string' && MESA.test(v);

function alertaValida(b) {
    return esObjeto(b)
        && enteroPositivo(b.idorg) && enteroPositivo(b.idsede) && enteroPositivo(b.alerta_id)
        && TIPOS_ALERTA.includes(b.tipo)
        && mesaValida(b.mesa) && mesaValida(b.mesa_clave)
        && typeof b.texto === 'string' && b.texto.length > 0 && b.texto.length <= MAX_TEXTO
        && Array.isArray(b.para) && b.para.length <= DESTINOS.length && b.para.every((p) => DESTINOS.includes(p))
        && (b.recordatorio === undefined || typeof b.recordatorio === 'boolean');
}

function eventoValido(b) {
    return esObjeto(b)
        && enteroPositivo(b.idorg) && enteroPositivo(b.idsede)
        && EVENTOS.includes(b.evento)
        && esObjeto(b.datos)
        && Buffer.byteLength(JSON.stringify(b.datos), 'utf8') <= MAX_DATOS_BYTES;
}

// POST /vision/v1/alerta → socket `vision-alerta` con el cuerpo completo (F2-R7) a toda
// la sede (cada pantalla filtra por `para`) y push a los mozos si `para` los incluye.
exports.alerta = function (req, res) {
    const b = req.body;
    if (!alertaValida(b)) return ReE(res, 'pedido_invalido', 400);

    socketManager.emitToRoom(salaDe(b.idorg, b.idsede), 'vision-alerta', b);
    if (b.para.includes('mozos')) {
        // Sin await: el Go corta a los 5 s y el SELECT de tokens + FCM pueden tardar más;
        // su reintento duplicaría el socket. sendAlertaVision no lanza (deja el error en el log).
        pushMozo.sendAlertaVision(b.idsede, b)
            .catch((err) => logger.error({ err: err.message, idsede: b.idsede, alerta_id: b.alerta_id }, '[vision] push'));
    }
    logger.info({ idsede: b.idsede, alerta_id: b.alerta_id, tipo: b.tipo, mesa_clave: b.mesa_clave,
        para: b.para, recordatorio: b.recordatorio === true }, '[vision] alerta');
    return ReS(res, {}, 200);
};

// POST /vision/v1/evento → socket con el nombre de `evento` y `datos` TAL CUAL como
// payload (F2-R7: así lo consumen la app mozo y Control de pedidos).
exports.evento = function (req, res) {
    const b = req.body;
    if (!eventoValido(b)) return ReE(res, 'pedido_invalido', 400);

    socketManager.emitToRoom(salaDe(b.idorg, b.idsede), b.evento, b.datos);
    logger.debug({ idsede: b.idsede, evento: b.evento }, '[vision] evento');
    return ReS(res, {}, 200);
};
