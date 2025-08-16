/**
 * error.manager.v1.js
 * Versión mejorada del gestor de errores con soporte para categorización y reintentos
 */

let config = require('../_config');
let Sequelize = require('sequelize');
let sequelize = new Sequelize(config.database, config.username, config.password, config.sequelizeOption);

// Importar el gestor de errores original
const originalErrorManager = require('./error.manager');

/**
 * Categoriza un error según su tipo
 * @param {Error} error - Error a categorizar
 * @returns {String} - Categoría del error
 */
const categorizeError = (error) => {
    if (!error) return 'UNKNOWN';
    
    // Errores de deadlock
    if (error.name === 'SequelizeDatabaseError' && 
        error.parent && 
        error.parent.code === 'ER_LOCK_DEADLOCK') {
        return 'DEADLOCK';
    }
    
    // Errores de sintaxis SQL
    if (error.name === 'SequelizeDatabaseError' && 
        error.parent && 
        error.parent.code === 'ER_PARSE_ERROR') {
        return 'SQL_SYNTAX';
    }
    
    // Errores de referencia nula
    if (error instanceof TypeError && 
        error.message.includes('Cannot read properties of undefined')) {
        return 'NULL_REFERENCE';
    }
    
    // Otros errores de base de datos
    if (error.name === 'SequelizeDatabaseError') {
        return 'DATABASE';
    }
    
    // Errores de red
    if (error.name === 'SequelizeConnectionError') {
        return 'NETWORK';
    }
    
    // Errores de validación
    if (error.name === 'SequelizeValidationError') {
        return 'VALIDATION';
    }
    
    return 'OTHER';
};

/**
 * Registra un error en la base de datos con información adicional
 * @param {Object} payload - Datos del error
 * @returns {Promise} - Resultado de la operación
 */
const logError = async function (payload) {
    // Primero usar el logger original para mantener compatibilidad
    originalErrorManager.logError(payload);
    
    try {
        const data = payload;
        let error = data.incidencia && data.incidencia.message ? data.incidencia.message : 'Unknown error';
        
        // Si el error es un objeto, intentar extraer información útil
        if (typeof error === 'object') {
            if (error instanceof Error) {
                error = {
                    name: error.name,
                    message: error.message,
                    stack: error.stack
                };
            }
        }
        
        // Categorizar el error
        const errorCategory = categorizeError(error);
        
        // Añadir timestamp preciso
        const timestamp = new Date().toISOString();
        
        // Crear objeto enriquecido con metadatos
        const enrichedData = {
            ...data,
            error_category: errorCategory,
            timestamp,
            environment: process.env.NODE_ENV || 'development',
            process_id: process.pid
        };
        
        // Serializar de forma segura
        let errorString = JSON.stringify(enrichedData);
        errorString = errorString.replace(/'/g, "\\'");
        
        // Insertar en una tabla separada para análisis
        const query = `INSERT INTO historial_error_detallado (error, origen, categoria, fecha) 
                      VALUES ('${errorString}', '${data.origen || 'unknown'}', '${errorCategory}', NOW())`;
        
        await sequelize.query(query, { type: sequelize.QueryTypes.INSERT });
        
        // console.log(`[${timestamp}] Error logged (${errorCategory}): ${data.origen || 'unknown'}`);
        return true;
    } catch (loggingError) {
        // console.error('Error al registrar error:', loggingError);
        return false;
    }
};

/**
 * Obtiene estadísticas de errores por categoría
 * @param {Date} startDate - Fecha de inicio
 * @param {Date} endDate - Fecha de fin
 * @returns {Promise} - Estadísticas de errores
 */
const getErrorStats = async function (startDate = null, endDate = null) {
    try {
        const whereClause = startDate && endDate 
            ? `WHERE fecha BETWEEN '${startDate.toISOString()}' AND '${endDate.toISOString()}'` 
            : '';
        
        const query = `
            SELECT 
                categoria, 
                COUNT(*) as count, 
                MIN(fecha) as first_occurrence,
                MAX(fecha) as last_occurrence
            FROM historial_error_detallado
            ${whereClause}
            GROUP BY categoria
            ORDER BY count DESC
        `;
        
        const [results] = await sequelize.query(query, { type: sequelize.QueryTypes.SELECT });
        return results;
    } catch (error) {
        // console.error('Error al obtener estadísticas de errores:', error);
        return [];
    }
};

module.exports = {
    logError,
    categorizeError,
    getErrorStats,
    // Mantener compatibilidad con el gestor original
    ...originalErrorManager
};
