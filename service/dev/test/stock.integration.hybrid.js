/**
 * stock.integration.hybrid.js
 * Adaptador de integración para la solución híbrida de stock.
 * Implementa la versión refactorizada (v1) con soporte de Sequelize
 */

const stockHybridService = require('./stock.hybrid');
const v1Handler = require('../../handle.stock.v1'); // Versión refactorizada

// Obtener todas las rutas que importan handle.stock
// const apiPwa = require('../controllers/apiPwa_v1');
// const apiPwaRepartidor = require('../controllers/apiPwaRepartidor');

/**
 * Reemplaza todas las referencias a updateStock con nuestra implementación híbrida
 * que usa directamente handle.stock.v1.js
 */
function patchOriginalImplementation() {
    // Crear nueva implementación híbrida que prioriza Sequelize y usa v1Handler como fallback
    const hybridStockImplementation = async (op, item, idsede) => {
        try {
            // Intentar primero con la implementación híbrida (Sequelize)
            console.log('🌟 Usando implementación híbrida con Sequelize');
            return await stockHybridService.updateStock(op, item, idsede);
        } catch (error) {
            console.error('Error en implementación híbrida, usando versión refactorizada (v1):', error);
            
            // Como fallback, usar exclusivamente la implementación refactorizada (v1)
            console.log('🔄 Fallback: Usando implementación refactorizada (v1)');
            return await v1Handler.updateStock(op, item, idsede);
        }
    };
    
    // Reemplazar directamente la implementación en los módulos que la usan
    // Esto evita modificar handle.stock.js y usa handle.stock.v1.js directamente
    
    // 1. Reemplazar en v1Handler directamente para que use la versión híbrida primero
    const originalV1UpdateStock = v1Handler.updateStock;
    v1Handler.updateStock = hybridStockImplementation;
    
    console.log('✅ Implementación híbrida con Sequelize activada que utiliza exclusivamente handle.stock.v1.js');
    return true;
}

/**
 * Restaura la implementación refactorizada v1 original
 */
function restoreOriginalImplementation() {
    // Guarda una referencia a la implementación refactorizada v1 original
    let originalV1UpdateStock;
    
    try {
        // Intentamos obtener una copia limpia de la implementación v1
        delete require.cache[require.resolve('./handle.stock.v1')];
        const freshV1Handler = require('../../handle.stock.v1');
        originalV1UpdateStock = freshV1Handler.updateStock;
    } catch (error) {
        console.error('Error al cargar implementación v1 original:', error);
        return false;
    }
    
    // Restauramos la implementación refactorizada v1 original
    v1Handler.updateStock = originalV1UpdateStock;
    
    console.log('⚠️ Implementación refactorizada v1 original restaurada');
    return true;
}

/**
 * Actualiza el stock usando la implementación híbrida con Sequelize
 * @param {String} op - Operación a realizar
 * @param {Object} item - Item a actualizar
 * @param {String} idsede - ID de la sede
 * @returns {Promise<Object>} - Resultado de la operación
 */
async function updateStock(op, item, idsede) {
    return await stockHybridService.updateStock(op, item, idsede);
}

/**
 * Actualiza el stock de forma asincrónica (utilizando buffer de actualizaciones)
 * para operaciones que no necesitan respuesta inmediata
 * @param {String} op - Operación a realizar
 * @param {Object} item - Item a actualizar
 * @param {String} idsede - ID de la sede
 * @returns {Promise<Object>} - Estado de la operación en buffer
 */
function updateStockAsync(op, item, idsede) {
    return stockHybridService.bufferStockUpdate(op, item, idsede);
}

/**
 * Fuerza el procesamiento inmediato del buffer de actualizaciones
 * @returns {Promise<Array>} - Resultados de las actualizaciones
 */
async function flushUpdates() {
    return await stockHybridService.flushBuffer();
}

/**
 * Obtiene el stock actual de un item
 * @param {String} itemId - ID del item
 * @param {String} sedeId - ID de la sede
 * @returns {Promise<Object>} - Información del stock
 */
async function getStock(itemId, sedeId) {
    return await stockHybridService.getStock(itemId, sedeId);
}

module.exports = {
    patchOriginalImplementation,
    restoreOriginalImplementation,
    updateStock,
    updateStockAsync,
    flushUpdates,
    getStock,
    // Exponer el servicio directamente para acceso avanzado
    service: stockHybridService
};
