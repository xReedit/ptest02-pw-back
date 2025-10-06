/**
 * query.service.v1.js
 * Versión refactorizada del servicio de consultas que utiliza la configuración optimizada
 * de Sequelize para alta concurrencia con pool de conexiones y reintentos automáticos.
 */

// Importar la instancia de Sequelize optimizada para alta concurrencia
const { sequelize, Sequelize } = require('../config/database');
const { QueryTypes } = require('sequelize');

// Constantes para alta concurrencia (600+ negocios, 30 usuarios por negocio)
const RETRY_CONFIG = {
    MAX_RETRIES: 3,
    BASE_DELAY: 100,          // ms - delay inicial
    TIMEOUT_PROCEDURE: 15000, // ms - timeout para procedimientos
    TIMEOUT_SELECT: 20000,    // ms - timeout para SELECT
    TIMEOUT_MODIFY: 15000,    // ms - timeout para INSERT/UPDATE/DELETE
    SLOW_THRESHOLD_SELECT: 8000,  // ms - umbral para log de SELECT lentos
    SLOW_THRESHOLD_OTHER: 5000    // ms - umbral para log de otros lentos
};

const ERROR_PATTERNS = {
    DEADLOCK: /deadlock|lock wait timeout|connection lost/i,
    TIMEOUT: /timeout|etimedout/i,
    CONNECTION: /connection|connect|econnreset/i
};

const deadlockRetryOptions = {
    max: 5,
    match: [
        /Deadlock found/i,
        /Lock wait timeout/i,
        /ETIMEDOUT/i
    ],
    backoffBase: 100,
    backoffExponent: 1.5
};

class QueryServiceV1 {

    // Ejecuta query con timeout usando Promise.race
    static async executeWithTimeout(query, options, timeoutMs) {
        return Promise.race([
            sequelize.query(query, options),
            new Promise((_, reject) => 
                setTimeout(() => reject(new Error('Query timeout')), timeoutMs)
            )
        ]);
    }

    // Calcula delay con backoff exponencial
    static calculateDelay(attempt) {
        return RETRY_CONFIG.BASE_DELAY * Math.pow(2, attempt - 1);
    }

    // Determina si debe reintentar según el error
    static shouldRetryError(err, attempt) {
        if (attempt >= RETRY_CONFIG.MAX_RETRIES) return false;
        
        const isDeadlock = ERROR_PATTERNS.DEADLOCK.test(err.message);
        const isTimeout = ERROR_PATTERNS.TIMEOUT.test(err.message);
        const isConnectionError = ERROR_PATTERNS.CONNECTION.test(err.message);
        
        return isDeadlock || isTimeout || isConnectionError;
    }
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

    /**
     * Ejecuta un procedimiento almacenado y retorna Object.values(result[0])
     * Optimizado para alta concurrencia: 600+ negocios, 30 usuarios por negocio
     */
    static async ejecutarProcedimiento(query, replacements = [], errorContext = 'procedimiento') {
        for (let attempt = 1; attempt <= RETRY_CONFIG.MAX_RETRIES; attempt++) {
            const startTime = Date.now();
            
            try {
                const result = await this.executeWithTimeout(
                    query,
                    { replacements, type: QueryTypes.SELECT, timeout: RETRY_CONFIG.TIMEOUT_PROCEDURE },
                    RETRY_CONFIG.TIMEOUT_PROCEDURE
                );

                const executionTime = Date.now() - startTime;
                
                // Log de performance para queries lentas
                if (executionTime > RETRY_CONFIG.SLOW_THRESHOLD_OTHER) {
                    // console.warn(`⏱️ [${errorContext}] Procedimiento lento - tiempo:${executionTime}ms intento:${attempt}`);
                    logger.warn(`⏱️ [${errorContext}] Procedimiento lento - tiempo:${executionTime}ms intento:${attempt}
                        📝 Query: ${query}
                        📊 Params: ${JSON.stringify(replacements)}`);
                }

                // Validar resultado
                if (!result || !result[0] || typeof result[0] !== 'object') {
                    logger.debug(`⚠️ [${errorContext}] Sin datos válidos - intento:${attempt}`);
                    return [];
                }

                if (attempt > 1) {
                    logger.info(`✅ [${errorContext}] Éxito tras ${attempt} intentos`);
                }

                return Object.values(result[0]);

            } catch (err) {
                const executionTime = Date.now() - startTime;
                
                if (this.shouldRetryError(err, attempt)) {
                    const delay = this.calculateDelay(attempt);
                    logger.warn(`🔄 [${errorContext}] Reintento ${attempt}/${RETRY_CONFIG.MAX_RETRIES} - error:${err.message.substring(0, 80)} delay:${delay}ms`);
                    await new Promise(resolve => setTimeout(resolve, delay));
                    continue;
                }
                
                logger.error(`❌ [${errorContext}] Error final ${attempt}/${RETRY_CONFIG.MAX_RETRIES} - tiempo:${executionTime}ms
                    📝 Query: ${query}
                    📊 Params: ${JSON.stringify(replacements)}
                    ❗ Error: ${err.message}`);


                return null;
            }
        }
        
        logger.error(`💥 [${errorContext}] Agotados ${RETRY_CONFIG.MAX_RETRIES} reintentos`);
        return null;
    }

    /**
     * Ejecuta una consulta UPDATE/INSERT/DELETE/SELECT con manejo de errores
     * Optimizado para alta concurrencia: 600+ negocios, 30 usuarios por negocio
     */
    static async ejecutarConsulta(query, replacements = [], queryType = 'UPDATE', errorContext = 'consulta') {
        // Auto-detectar tipo de consulta si no se especifica
        if (!queryType) {
            const queryUpper = query.trim().toUpperCase();
            if (queryUpper.startsWith('UPDATE')) queryType = 'UPDATE';
            else if (queryUpper.startsWith('INSERT')) queryType = 'INSERT';
            else if (queryUpper.startsWith('DELETE')) queryType = 'DELETE';
            else if (queryUpper.startsWith('SELECT')) queryType = 'SELECT';
        }

        const TYPE_MAP = {
            'UPDATE': QueryTypes.UPDATE,
            'INSERT': QueryTypes.INSERT,
            'DELETE': QueryTypes.DELETE,
            'SELECT': QueryTypes.SELECT
        };
        
        for (let attempt = 1; attempt <= RETRY_CONFIG.MAX_RETRIES; attempt++) {
            const startTime = Date.now();
            
            try {
                const timeoutMs = queryType === 'SELECT' ? RETRY_CONFIG.TIMEOUT_SELECT : RETRY_CONFIG.TIMEOUT_MODIFY;
                
                const result = await this.executeWithTimeout(
                    query,
                    { replacements, type: TYPE_MAP[queryType], timeout: timeoutMs },
                    timeoutMs
                );

                const executionTime = Date.now() - startTime;
                const slowThreshold = queryType === 'SELECT' ? RETRY_CONFIG.SLOW_THRESHOLD_SELECT : RETRY_CONFIG.SLOW_THRESHOLD_OTHER;
                
                if (executionTime > slowThreshold) {
                    logger.warn(`⏱️ [${errorContext}] Query lenta tipo:${queryType} tiempo:${executionTime}ms intento:${attempt}`);
                }

                if (attempt > 1) {
                    const msg = queryType === 'SELECT' ? `registros:${result?.length || 0}` : 'ok';
                    logger.info(`✅ [${errorContext}] ${queryType} éxito tras ${attempt} intentos ${msg}`);
                }

                return queryType === 'SELECT' ? (result || []) : true;

            } catch (err) {
                const executionTime = Date.now() - startTime;
                
                if (this.shouldRetryError(err, attempt)) {
                    const delay = this.calculateDelay(attempt);
                    logger.warn(`🔄 [${errorContext}] Reintento ${attempt}/${RETRY_CONFIG.MAX_RETRIES} tipo:${queryType} error:${err.message.substring(0, 80)} delay:${delay}ms`);
                    await new Promise(resolve => setTimeout(resolve, delay));
                    continue;
                }
                
                logger.error(`❌ [${errorContext}] Error final ${attempt}/${RETRY_CONFIG.MAX_RETRIES} tipo:${queryType} tiempo:${executionTime}ms
                    📝 Query: ${query}
                    📊 Params: ${JSON.stringify(replacements)}
                    ❗ Error: ${err.message}`);
                return queryType === 'SELECT' ? [] : false;
            }
        }
        
        logger.error(`💥 [${errorContext}] Agotados ${RETRY_CONFIG.MAX_RETRIES} reintentos tipo:${queryType}`);
        return queryType === 'SELECT' ? [] : false;
    }
}

module.exports = QueryServiceV1;
