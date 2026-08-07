/**
 * stock.conciliacion.job.js
 *
 * Cron de la conciliación automática de stock (Capa 2).
 * Cada 10 minutos revisa las sedes activas; solo concilia las que estén quietas
 * (sin movimientos recientes). Mismo patrón que stock.cleanup.job.js.
 *
 * Kill-switch: CONCILIACION_STOCK=0 en .env
 */

let cron;
try {
    cron = require('node-cron');
} catch (e) {
    // node-cron no instalado, el job no se iniciará
}
const conciliacion = require('./stock.conciliacion.service');
const logger = require('../utilitarios/logger');

const CONFIG = {
    // El disparo principal es la llamada SINCRONA del cierre de caja (PHP -> endpoint);
    // este cron es solo respaldo (cierres cuya llamada fallo + sedes sin cierre).
    // Cada 15 min: su query de deteccion escanea el rango de 24h de pedido.fecha_hora
    // (~70k filas con 350 locales) y a esta frecuencia el costo es despreciable.
    CRON_SCHEDULE: '*/15 * * * *',
    ENABLED: process.env.CONCILIACION_STOCK !== '0'
};

let jobInstance = null;
let corriendo = false;

const ejecutar = async () => {
    if (corriendo) return; // nunca dos corridas superpuestas
    corriendo = true;
    try {
        const resultados = await conciliacion.conciliarSedesPendientes();
        const conAjustes = Object.entries(resultados)
            .filter(([, r]) => r && (r.ajustes > 0 || r.reportadas > 0));
        if (conAjustes.length > 0) {
            logger.warn({ resultados: Object.fromEntries(conAjustes) },
                '📐 [conciliacion.job] Corrida con diferencias');
        }
    } catch (error) {
        logger.error({ error: error.message }, '❌ [conciliacion.job] Error en corrida');
    } finally {
        corriendo = false;
    }
};

const iniciarJob = () => {
    if (!CONFIG.ENABLED) {
        logger.info('📐 [conciliacion.job] Desactivado por CONCILIACION_STOCK=0');
        return null;
    }
    if (!cron) {
        logger.error('❌ [conciliacion.job] node-cron no disponible');
        return null;
    }
    jobInstance = cron.schedule(CONFIG.CRON_SCHEDULE, ejecutar);
    logger.info({ schedule: CONFIG.CRON_SCHEDULE }, '📐 [conciliacion.job] Iniciado');
    return jobInstance;
};

const detenerJob = () => {
    if (jobInstance) {
        jobInstance.stop();
        jobInstance = null;
    }
};

module.exports = { iniciarJob, detenerJob, ejecutar };
