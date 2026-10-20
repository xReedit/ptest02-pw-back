// vision.auth.js — puerta del puente /vision/v1 (Cámaras IA, repo papaya-vision).
//
// Solo el servidor Go de Cámaras IA llama aquí. Quien pase lee las cuentas
// abiertas de cualquier sede (y desde la Task 17 manda push a los mozos), así que:
//   - falla cerrado: sin VISION_PUENTE_KEY (≥32) o sin VISION_PUENTE_IPS → 503
//   - solo desde las IPs del Go → 403 ip_no_permitida
//   - con la clave en x-api-key → 401 clave_invalida
// Patrón de controllers/chatbotEmitir.js (sha256 + timingSafeEqual).

const crypto = require('crypto');
const net = require('net');
const logger = require('../utilitarios/logger');
const { ReE } = require('../service/uitl.service');

const MIN_CLAVE = 32;

// timingSafeEqual explota si los largos difieren: el hash previo iguala el tamaño.
function compararSeguro(a, b) {
    const ha = crypto.createHash('sha256').update(String(a)).digest();
    const hb = crypto.createHash('sha256').update(String(b)).digest();
    return crypto.timingSafeEqual(ha, hb);
}

// "::ffff:10.0.0.5" (IPv4 en un socket IPv6) → "10.0.0.5".
function normalizarIp(ip) {
    const s = String(ip || '').trim();
    return s.toLowerCase().startsWith('::ffff:') && net.isIPv4(s.slice(7)) ? s.slice(7) : s;
}

// Loopback o red privada: es nuestro nginx (o una máquina de la misma red), cuyo
// x-forwarded-for sí vale. Cualquier otro peer habla directo y su XFF lo escribe él.
function esLoopbackOPrivada(ip) {
    if (net.isIPv4(ip)) {
        const [a, b] = ip.split('.').map(Number);
        return a === 127 || a === 10 || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168);
    }
    if (net.isIPv6(ip)) {
        const s = ip.toLowerCase();
        return s === '::1' || s.startsWith('fc') || s.startsWith('fd');
    }
    return false;
}

// IP de quien llama. Último salto de x-forwarded-for (el que agregó nginx) solo si
// el peer es loopback/privado; si no, remoteAddress.
function ipDe(req) {
    const peer = normalizarIp(req.socket && req.socket.remoteAddress);
    if (!esLoopbackOPrivada(peer)) return peer;
    const xff = req.headers && req.headers['x-forwarded-for'];
    const saltos = String(xff || '').split(',').map((s) => s.trim()).filter(Boolean);
    return saltos.length ? normalizarIp(saltos[saltos.length - 1]) : peer;
}

// Se lee en cada pedido (barato) para no exigir reinicio al cambiar el .env en tests.
function configuracion() {
    const clave = process.env.VISION_PUENTE_KEY || '';
    const ips = String(process.env.VISION_PUENTE_IPS || '').split(',').map(normalizarIp).filter(Boolean);
    if (clave.length < MIN_CLAVE || ips.length === 0) return null;
    return { clave, ips };
}

function verificarVision(req, res, next) {
    const cfg = configuracion();
    if (!cfg) {
        logger.error('[vision] VISION_PUENTE_KEY (>=32) o VISION_PUENTE_IPS sin configurar, rechazando');
        return ReE(res, 'vision_no_configurado', 503);
    }
    const ip = ipDe(req);
    if (!cfg.ips.includes(ip)) {
        logger.warn({ ip, ruta: req.originalUrl }, '[vision] IP no permitida');
        return ReE(res, 'ip_no_permitida', 403);
    }
    const recibida = req.headers && req.headers['x-api-key'];
    if (!recibida || !compararSeguro(recibida, cfg.clave)) {
        logger.warn({ ip, ruta: req.originalUrl }, '[vision] clave inválida');
        return ReE(res, 'clave_invalida', 401);
    }
    return next();
}

module.exports = { verificarVision, ipDe };
