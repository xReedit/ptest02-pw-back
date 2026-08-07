/**
 * apiStockConciliacion.js
 *
 * Endpoint sincrono de conciliacion de stock, llamado por el PHP del cierre de caja
 * (bdphp/log.php op 7000) ANTES de ejecutar procedure_cierre_caja: asi el reporte
 * de cierre ya sale con el stock cuadrado, que es donde el encargado compara
 * sistema vs fisico.
 *
 * Es seguro llamarlo varias veces (watermarks => idempotente) y nunca bloquea el
 * cierre: PHP usa timeout corto y continua aunque esto falle.
 */

const conciliacion = require('../service/stock.conciliacion.service');
const logger = require('../utilitarios/logger');

// Guard minimo: al momento del cierre la venta ya paro; 1 minuto cubre un guardado
// que este aterrizando justo en ese instante.
const QUIET_MINUTOS_SINCRONO = 1;
const RETRY_DELAY_MS = 3000;

const conciliarCierre = async function (req, res) {
    const idsede = parseInt(req.body?.idsede);
    if (!idsede || idsede <= 0) {
        return res.json({ success: false, error: 'idsede requerido' });
    }

    try {
        let r = await conciliacion.conciliarSede(idsede, { quietMinutos: QUIET_MINUTOS_SINCRONO });

        // Si justo habia actividad (multi-caja o un guardado en vuelo), un reintento corto
        if (r.skipped) {
            await new Promise(resolve => setTimeout(resolve, RETRY_DELAY_MS));
            r = await conciliacion.conciliarSede(idsede, { quietMinutos: QUIET_MINUTOS_SINCRONO });
        }

        logger.info({ idsede, ajustes: r.ajustes || 0, skipped: r.skipped || false },
            '📐 [conciliacion] Corrida sincrona por cierre de caja');
        return res.json(r);

    } catch (error) {
        logger.error({ idsede, error: error.message }, '❌ [conciliacion] Error en corrida sincrona');
        return res.json({ success: false, error: error.message });
    }
};

module.exports = { conciliarCierre };
