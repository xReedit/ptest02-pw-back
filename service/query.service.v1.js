/**
 * query.service.v1.js
 * Versión refactorizada del servicio de consultas que utiliza la configuración optimizada
 * de Sequelize para alta concurrencia con pool de conexiones y reintentos automáticos.
 */

// Importar la instancia de Sequelize optimizada para alta concurrencia
const { sequelize, Sequelize } = require('../config/database');
const { QueryTypes } = require('sequelize');

// Opciones para reintentar transacciones en caso de deadlock
const deadlockRetryOptions = {
    max: 5,                   // Máximo número de reintentos
    // match: [/Deadlock/i],     // Solo reintentar en caso de deadlocks
    match: [
        /Deadlock found/i,          // Error de deadlock
        /Lock wait timeout/i,       // Timeout esperando bloqueo
        /ETIMEDOUT/i                // Timeout de conexión
    ],
    backoffBase: 100,         // Espera inicial en ms (100ms)
    backoffExponent: 1.5      // Factor de crecimiento exponencial
};

class QueryServiceV1 {
    /**
     * Ejecuta una consulta SELECT con manejo mejorado de errores
     * @param {String} query - Consulta SQL a ejecutar
     * @param {Object} replacements - Parámetros para la consulta
     * @returns {Promise<Array>} - Resultado de la consulta
     */
    static async emitirRespuesta(query, replacements = {}) {
        // console.log('🔷 [query.v1] Ejecutando SELECT:', { 
        //     query: query.substring(0, 100) + (query.length > 100 ? '...' : ''),
        //     tieneReemplazos: Object.keys(replacements).length > 0
        // });
        
        try {
            const result = await sequelize.query(query, { 
                replacements,
                type: QueryTypes.SELECT 
            });
            // console.log(`✅ [query.v1] SELECT exitoso, ${result.length} registros`);
            return result;
        } catch (err) {
            // console.error('❌ [query.v1] Error en SELECT:', err.message);
            // Si el error es un deadlock, podemos retornar un mensaje específico
            if (err.message.includes('Deadlock')) {
                // console.log('⚠️ [query.v1] Detectado deadlock, se debe reintentar');
            }
            return false;
        }
    }

    /**
     * Ejecuta una consulta UPDATE con manejo mejorado de errores
     * @param {String} query - Consulta SQL a ejecutar
     * @param {Object} replacements - Parámetros para la consulta
     * @returns {Promise<Array>} - Resultado de la consulta
     */
    static async emitirRespuesta_UPDATE(query, replacements = {}) {
        // console.log('🔷 [query.v1] Ejecutando UPDATE:', { 
        //     query: query.substring(0, 100) + (query.length > 100 ? '...' : ''),
        //     tieneReemplazos: Object.keys(replacements).length > 0
        // });
        
        try {
            const result = await sequelize.query(query, { 
                replacements,
                type: QueryTypes.UPDATE 
            });
            // console.log('✅ [query.v1] UPDATE exitoso');
            return result;
        } catch (err) {
            // console.error('❌ [query.v1] Error en UPDATE:', err.message);
            // Si el error es un deadlock, podemos retornar un mensaje específico
            if (err.message.includes('Deadlock')) {
                // console.log('⚠️ [query.v1] Detectado deadlock, se debe reintentar');
            }
            return false;
        }
    }

    /**
     * Ejecuta una consulta INSERT con manejo mejorado de errores
     * @param {String} query - Consulta SQL a ejecutar
     * @param {Object} replacements - Parámetros para la consulta
     * @returns {Promise<Array>} - Resultado de la consulta
     */
    static async emitirRespuesta_INSERT(query, replacements = {}) {
        // console.log('🔷 [query.v1] Ejecutando INSERT:', { 
        //     query: query.substring(0, 100) + (query.length > 100 ? '...' : ''),
        //     tieneReemplazos: Object.keys(replacements).length > 0
        // });
        
        try {
            const result = await sequelize.query(query, { 
                replacements,
                type: QueryTypes.INSERT 
            });
            // console.log('✅ [query.v1] INSERT exitoso');
            return result;
        } catch (err) {
            // console.error('❌ [query.v1] Error en INSERT:', err.message);
            return false;
        }
    }

    /**
     * Ejecuta un procedimiento almacenado con manejo mejorado de errores y reintentos
     * @param {String} query - Llamada al procedimiento almacenado
     * @param {Object} replacements - Parámetros para el procedimiento
     * @returns {Promise<Array>} - Resultado del procedimiento
     */
    static async emitirRespuestaSP(query, replacements = {}) {
        // console.log('🔷 [query.v1] Ejecutando procedimiento almacenado:', { 
        //     query: query.substring(0, 100) + (query.length > 100 ? '...' : ''),
        //     tieneReemplazos: Object.keys(replacements).length > 0
        // });
        
        try {
            // Usar transacción con reintentos automáticos para manejar deadlocks
            return await sequelize.transaction({
                isolationLevel: Sequelize.Transaction.ISOLATION_LEVELS.READ_COMMITTED,
                retry: deadlockRetryOptions
            }, async (transaction) => {
                const result = await sequelize.query(query, { 
                    replacements,
                    type: QueryTypes.RAW,
                    transaction
                });
                // console.log('✅ [query.v1] Procedimiento almacenado exitoso');
                return result;
            });
        } catch (err) {
            // console.error('❌ [query.v1] Error en procedimiento almacenado:', err.message);
            // Si después de los reintentos sigue fallando, devolver error
            return false;
        }
    }

    /**
     * Ejecuta un lote de consultas dentro de una transacción
     * con reintentos automáticos para deadlocks
     * @param {Function} queryBatch - Función que contiene las consultas a ejecutar
     * @returns {Promise<any>} - Resultado de la operación
     */
    static async ejecutarTransaccion(queryBatch) {
        // console.log('🔷 [query.v1] Iniciando transacción');
        try {
            // Usar transacción con reintentos automáticos para manejar deadlocks
            const result = await sequelize.transaction({
                isolationLevel: Sequelize.Transaction.ISOLATION_LEVELS.READ_COMMITTED,
                retry: deadlockRetryOptions
            }, queryBatch);
            
            // console.log('✅ [query.v1] Transacción completada exitosamente');
            return result;
        } catch (err) {
            // console.error('❌ [query.v1] Error en transacción:', err.message);
            // Si después de los reintentos sigue fallando, propagar error
            throw err;
        }
    }
}

module.exports = QueryServiceV1;
