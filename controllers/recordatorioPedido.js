// recordatorioPedido.js
//
// Cuando se genera un resumen de pedido (fila en `pedido_preview` con
// estado = 'pending') y el cliente NO confirma, le enviamos hasta 3
// recordatorios amables y luego una despedida, marcando el preview como
// 'expired'. El envío reutiliza el MISMO canal que las respuestas del bot:
//
//   io.to(`mensajeria_${idorg}${idsede}`).emit('send_message', [{ numero, mensaje, tipo:'texto' }])
//
// El gateway de WhatsApp (conectado por socket a este server) recibe el evento
// y lo escribe en WhatsApp.
//
// Apagado por defecto: requiere RECORDATORIOS_PEDIDO_ENABLED=true en el .env.

const logger = require('../utilitarios/logger');
const QueryServiceV1 = require('../service/query.service.v1');

// ── Config ───────────────────────────────────────────────────────────────────
const INTERVALO_MS = 60 * 1000;   // cada cuánto revisa la tabla (1 min)
const ESPERA_MIN = 3;             // minutos sin respuesta antes de cada recordatorio
const MAX_RECORDATORIOS = 3;      // máximo de recordatorios antes de la despedida

// Plantillas amables (índice = recordatorios ya enviados: 0 → 1.º, 1 → 2.º, 2 → 3.º).
const RECORDATORIOS = [
    '¡Hola! 👋 Tu pedido quedó listo, solo falta tu confirmación para empezar a prepararlo. ¿Lo confirmamos? 😊',
    'Seguimos por aquí 🙌 Tu pedido sigue esperando tu confirmación para mandarlo a cocina. Responde *sí* y lo dejamos en marcha 🍽️',
    'Última llamadita 🛎️ ¿Confirmamos tu pedido? Responde *sí* y lo preparamos de una vez 😉',
];
const DESPEDIDA = 'Por ahora cerramos tu pedido para no hacerte esperar 🙏 Cuando quieras, escríbeme y lo armamos al toque. ¡Te esperamos la próxima! 🧡';

// ── Helpers ──────────────────────────────────────────────────────────────────

// El id de pedido_preview ES el session_id: "<from>_<idorg>_<idsede>", donde
// <from> es el JID/número de WhatsApp (ej. "51999@s.whatsapp.net" o "51999").
function parseSessionId(id) {
    const parts = String(id).split('_');
    const idsede = parts.pop();
    const idorg = parts.pop();
    const jid = parts.join('_'); // por si el from tuviera '_' (no debería)
    const numero = jid.split('@')[0].replace(/\D/g, '');
    return { numero, idorg, idsede };
}

function enviarWhatsapp(io, idorg, idsede, numero, mensaje) {
    const room = `mensajeria_${idorg}${idsede}`;
    io.to(room).emit('send_message', [{ numero, mensaje, tipo: 'texto' }]);
    logger.debug({ room, numero }, '[recordatorios] enviado');
}

// ── Tick ─────────────────────────────────────────────────────────────────────
async function revisar(io) {
    // Previews pendientes cuyo último contacto (recordatorio o creación) ya venció.
    const query = `
        SELECT id, recordatorios
        FROM pedido_preview
        WHERE estado = 'pending'
          AND COALESCE(last_recordatorio_at, created_at) < (NOW() - INTERVAL ${ESPERA_MIN} MINUTE)
        LIMIT 200`;

    const rows = await QueryServiceV1.ejecutarConsulta(query, [], 'SELECT', 'recordatorios.revisar');
    if (!Array.isArray(rows) || rows.length === 0) return;

    for (const row of rows) {
        const { numero, idorg, idsede } = parseSessionId(row.id);
        if (!numero || !idorg || !idsede) {
            logger.warn({ id: row.id }, '[recordatorios] id no parseable, saltando');
            continue;
        }

        const enviados = Number(row.recordatorios) || 0;
        try {
            if (enviados < MAX_RECORDATORIOS) {
                enviarWhatsapp(io, idorg, idsede, numero, RECORDATORIOS[enviados]);
                await QueryServiceV1.ejecutarConsulta(
                    `UPDATE pedido_preview SET recordatorios = recordatorios + 1, last_recordatorio_at = NOW() WHERE id = ?`,
                    [row.id], 'UPDATE', 'recordatorios.suma'
                );
            } else {
                // Ya se enviaron los 3 y volvió a vencer → despedida + expirar.
                enviarWhatsapp(io, idorg, idsede, numero, DESPEDIDA);
                await QueryServiceV1.ejecutarConsulta(
                    `UPDATE pedido_preview SET estado = 'expired', last_recordatorio_at = NOW() WHERE id = ?`,
                    [row.id], 'UPDATE', 'recordatorios.expirar'
                );
            }
        } catch (err) {
            logger.error({ err: err.message, id: row.id }, '[recordatorios] error procesando fila');
        }
    }
}

// ── API pública ──────────────────────────────────────────────────────────────
let intervalRef = null;

function runRecordatorios(io) {
    if (process.env.RECORDATORIOS_PEDIDO_ENABLED !== 'true') {
        logger.debug('[recordatorios] deshabilitado (RECORDATORIOS_PEDIDO_ENABLED != true)');
        return;
    }
    if (!io) {
        logger.error('[recordatorios] no se recibió io, no se inicia');
        return;
    }
    if (intervalRef) clearInterval(intervalRef);
    logger.info('[recordatorios] iniciado');
    intervalRef = setInterval(() => {
        revisar(io).catch(e => logger.error({ e: e.message }, '[recordatorios] error en revisar'));
    }, INTERVALO_MS);
}

module.exports = { runRecordatorios };
