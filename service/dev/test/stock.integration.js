/**
 * stock.integration.js
 * 
 * Este archivo proporciona funciones de integración para usar el nuevo servicio de stock
 * sin tener que modificar el código existente. Actúa como un adaptador entre el código
 * antiguo y el nuevo servicio.
 */

const stockService = require('./stock.service');
const originalHandleStock = require('../../handle.stock.v1');
const errorManagerV1 = require('../../error.manager.v1');

/**
 * Versión mejorada de updateStock que utiliza el nuevo servicio
 * pero mantiene la misma firma que la función original
 * @param {String} op - Operación a realizar
 * @param {Object} item - Item a actualizar
 * @param {String} idsede - ID de la sede
 * @returns {Promise} - Resultado de la actualización
 */
const updateStock = async (op, item, idsede) => {
    try {
        // Usar el servicio de stock en modo síncrono para mantener compatibilidad
        return await stockService.updateStockSync(op, item, idsede);
    } catch (error) {
        // Registrar el error con el nuevo gestor
        errorManagerV1.logError({
            incidencia: {
                message: error.toString(),
                data: { item_process: item }
            },
            origen: 'updateStock.integration'
        });
        
        // Relanzar el error para mantener el comportamiento original
        throw error;
    }
};

/**
 * Versión asíncrona de updateStock que utiliza el sistema de colas
 * Útil para operaciones que no requieren respuesta inmediata
 * @param {String} op - Operación a realizar
 * @param {Object} item - Item a actualizar
 * @param {String} idsede - ID de la sede
 * @returns {Promise} - Información del trabajo en cola
 */
const updateStockAsync = async (op, item, idsede) => {
    try {
        // Usar el servicio de stock en modo asíncrono
        return await stockService.updateStock(op, item, idsede);
    } catch (error) {
        // Registrar el error con el nuevo gestor
        errorManagerV1.logError({
            incidencia: {
                message: error.toString(),
                data: { item_process: item }
            },
            origen: 'updateStockAsync.integration'
        });
        
        // Relanzar el error
        throw error;
    }
};

/**
 * Función para reemplazar la implementación original con la nueva
 * sin tener que modificar el código existente
 */
const patchOriginalImplementation = () => {
    console.log('Reemplazando implementación original de updateStock con la versión mejorada');
    
    // Guardar referencia a la implementación original
    const originalUpdateStock = originalHandleStock.updateStock;
    
    // Reemplazar con la nueva implementación
    originalHandleStock.updateStock = updateStock;
    
    // Devolver una función para restaurar la implementación original si es necesario
    return () => {
        console.log('Restaurando implementación original de updateStock');
        originalHandleStock.updateStock = originalUpdateStock;
    };
};

// Exportar funciones de integración
module.exports = {
    updateStock,
    updateStockAsync,
    patchOriginalImplementation,
    
    // Re-exportar funciones del servicio de stock para acceso directo
    getStock: stockService.getStock.bind(stockService),
    reserveStock: stockService.reserveStock.bind(stockService),
    confirmReservation: stockService.confirmReservation.bind(stockService),
    releaseReservation: stockService.releaseReservation.bind(stockService),
    getJobStatus: stockService.getJobStatus.bind(stockService)
};
