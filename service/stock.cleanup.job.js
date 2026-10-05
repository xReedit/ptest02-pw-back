/**
 * stock.cleanup.job.js
 * 
 * Job de limpieza nocturna para reservas de stock huérfanas.
 * Ejecutar a las 3:00 AM o cuando el negocio esté cerrado.
 * 
 * Las reservas sin actividad por más de 30 minutos se resetean a 0.
 */

let cron;
try {
    cron = require('node-cron');
} catch (e) {
    // node-cron no instalado, el job no se iniciará
}
const StockReservaService = require('./stock-reserva/stock.reserva.service');
const logger = require('../utilitarios/logger');

const CONFIG = {
    // Frecuencia de ejecución (formato cron)
    // PRODUCCIÓN: '*/30 * * * *' (cada 30 minutos)
    CRON_SCHEDULE: '*/30 * * * *',  // cada 5 minutos (pruebas)
    
    // Minutos sin actividad para considerar reserva huérfana
    MINUTOS_INACTIVIDAD: 30,p
    
    // Habilitar/deshabilitar el job
    ENABLED: true
};

let jobInstance = null;

/**
 * Ejecutar limpieza de reservas inactivas
 */
const ejecutarCleanup = async () => {
    logger.debug('🧹 [StockCleanup] Iniciando limpieza de reservas inactivas...');
    
    try {
        const resultado = await StockReservaService.resetReservasInactivas(CONFIG.MINUTOS_INACTIVIDAD);
        
        if (resultado.success) {
            logger.debug({
                registrosReseteados: resultado.registrosReseteados,
                minutosInactividad: CONFIG.MINUTOS_INACTIVIDAD
            }, '✅ [StockCleanup] Limpieza completada exitosamente');
        } else {
            logger.error({ error: resultado.error }, '❌ [StockCleanup] Error en limpieza');
        }
        
        return resultado;
        
    } catch (error) {
        logger.error({ error: error.message }, '❌ [StockCleanup] Error ejecutando cleanup');
        return { success: false, error: error.message };
    }
};

/**
 * Iniciar el job de limpieza programado
 */
const iniciarJob = () => {
    if (!cron) {
        logger.debug('⏸️ [StockCleanup] node-cron no instalado, job no iniciado. Instalar con: npm install node-cron');
        return null;
    }

    if (!CONFIG.ENABLED) {
        logger.debug('⏸️ [StockCleanup] Job deshabilitado por configuración');
        return null;
    }

    if (jobInstance) {
        logger.warn('⚠️ [StockCleanup] Job ya está corriendo');
        return jobInstance;
    }

    try {
        jobInstance = cron.schedule(CONFIG.CRON_SCHEDULE, async () => {
            await ejecutarCleanup();
        }, {
            scheduled: true,
            timezone: 'America/Lima'  // Ajustar según zona horaria
        });

        logger.debug({
            schedule: CONFIG.CRON_SCHEDULE,
            timezone: 'America/Lima'
        }, '✅ [StockCleanup] Job de limpieza iniciado');

        // Ejecutar cleanup inmediatamente al iniciar
        ejecutarCleanup().catch(err => logger.error({ error: err.message }, '❌ [StockCleanup] Error en cleanup inicial'));

        return jobInstance;

    } catch (error) {
        logger.error({ error: error.message }, '❌ [StockCleanup] Error iniciando job');
        return null;
    }
};

/**
 * Detener el job de limpieza
 */
const detenerJob = () => {
    if (jobInstance) {
        jobInstance.stop();
        jobInstance = null;
        logger.debug('🛑 [StockCleanup] Job de limpieza detenido');
    }
};

/**
 * Verificar si el job está corriendo
 */
const isRunning = () => {
    return jobInstance !== null;
};

module.exports = {
    ejecutarCleanup,
    iniciarJob,
    detenerJob,
    isRunning,
    CONFIG
};
