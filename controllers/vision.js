// vision.js — puente /vision/v1 para Cámaras IA (repo papaya-vision).
// Contrato: {success, data} / {success:false, error:<codigo>}; la puerta está en
// middleware/vision.auth.js. Solo lectura (salvo lo que escribe lastIdPedidoSede,
// igual que Control de pedidos).

const logger = require('../utilitarios/logger');
const { ReE, ReS } = require('../service/uitl.service');
const vision = require('../service/vision.service');

const VENTANA_PEDIDOS_MS = 24 * 3600 * 1000;
const ISO_CON_ZONA = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,9})?(Z|[+-]\d{2}:\d{2})$/;

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
