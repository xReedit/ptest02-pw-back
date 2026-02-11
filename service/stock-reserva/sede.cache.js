/**
 * sede.cache.js
 * 
 * Caché de configuración de sedes para el sistema de reservas
 * Evita consultas repetidas a la BD para verificar use_reservas_stock
 */

const { sequelize } = require('../../config/database');
const { QueryTypes } = require('sequelize');
const logger = require('../../utilitarios/logger');
const CONFIG = require('./reserva.config');

// Caché en memoria: { idsede: { useReservas: boolean, timestamp: number } }
const sedeCache = new Map();

/**
 * Verifica si una sede tiene activado el sistema de reservas
 * @param {number|string} idsede - ID de la sede
 * @returns {Promise<boolean>} true si la sede usa reservas
 */
async function sedeUsaReservas(idsede) {
    // Si USE_RESERVAS_TODAS_SEDES = true, todas las sedes usan reservas
    // (modo producción general, sin verificar BD)
    if (CONFIG.USE_RESERVAS_TODAS_SEDES) {
        return true;
    }

    const idsedeNum = parseInt(idsede);
    if (isNaN(idsedeNum)) {
        logger.warn({ idsede }, '⚠️ [SedeCache] idsede inválido');
        return false;
    }

    // Verificar caché
    const cached = sedeCache.get(idsedeNum);
    const now = Date.now();
    const ttlMs = (CONFIG.CACHE_TTL_SEGUNDOS || 60) * 1000;

    if (cached && (now - cached.timestamp) < ttlMs) {
        return cached.useReservas;
    }

    // Consultar BD
    try {
        const [result] = await sequelize.query(`
            SELECT use_reservas_stock 
            FROM sede 
            WHERE idsede = ?
        `, {
            replacements: [idsedeNum],
            type: QueryTypes.SELECT
        });

        const useReservas = result?.use_reservas_stock === 1;
        
        // Guardar en caché
        sedeCache.set(idsedeNum, {
            useReservas,
            timestamp: now
        });

        logger.debug({
            idsede: idsedeNum,
            useReservas,
            fromCache: false
        }, '📦 [SedeCache] Configuración de sede obtenida');

        return useReservas;
    } catch (error) {
        logger.error({
            idsede: idsedeNum,
            error: error.message
        }, '❌ [SedeCache] Error consultando configuración de sede');
        
        // En caso de error, usar el valor cacheado si existe, sino false
        return cached?.useReservas || false;
    }
}

/**
 * Invalida el caché de una sede específica
 * @param {number|string} idsede - ID de la sede
 */
function invalidarCacheSede(idsede) {
    const idsedeNum = parseInt(idsede);
    if (!isNaN(idsedeNum)) {
        sedeCache.delete(idsedeNum);
        logger.debug({ idsede: idsedeNum }, '🗑️ [SedeCache] Caché invalidado');
    }
}

/**
 * Invalida todo el caché (útil al cambiar configuraciones)
 */
function invalidarTodoElCache() {
    sedeCache.clear();
    logger.debug('🗑️ [SedeCache] Todo el caché invalidado');
}

/**
 * Obtiene estadísticas del caché
 * @returns {Object} Estadísticas
 */
function getEstadisticasCache() {
    return {
        totalSedes: sedeCache.size,
        sedes: Array.from(sedeCache.entries()).map(([idsede, data]) => ({
            idsede,
            useReservas: data.useReservas,
            edadSegundos: Math.round((Date.now() - data.timestamp) / 1000)
        }))
    };
}

module.exports = {
    sedeUsaReservas,
    invalidarCacheSede,
    invalidarTodoElCache,
    getEstadisticasCache
};
