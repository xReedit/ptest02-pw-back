/**
 * stock.hybrid.js
 * Implementación híbrida del servicio de stock utilizando Sequelize para manejar conexiones
 * y transacciones mientras sigue utilizando los procedimientos almacenados existentes.
 * Optimizado para alta demanda (50+ pedidos/segundo).
 */

console.log('🔵 stock.hybrid.js cargado - Implementación con Sequelize activa');

const { sequelize, Sequelize } = require('../../../config/database');
const { QueryTypes } = require('sequelize');

// Importar servicios existentes para compatibilidad
const handleStockV1 = require('../../handle.stock.v1');
const ResponseService = require('../../query.service');

// Importar o crear gestor de errores
let errorManager;
try {
    errorManager = require('../../error.manager');
} catch (e) {
    // Si no existe, creamos un objeto básico para loggear errores
    errorManager = {
        logError: (data) => {
            console.error('Error registrado:', JSON.stringify(data));
        }
    };
}

// Opciones de reintentos para deadlocks
const deadlockRetryOptions = {
    max: 5,                         // Número máximo de reintentos
    match: [
        /Deadlock found/i,          // Error de deadlock
        /Lock wait timeout/i,       // Timeout esperando bloqueo
        /ETIMEDOUT/i                // Timeout de conexión
    ],
    backoffBase: 100,               // Tiempo base entre reintentos (ms)
    backoffExponent: 1.5            // Factor de incremento exponencial
};

/**
 * Clase para el manejo de stock con enfoque híbrido
 * Utiliza Sequelize para manejar conexiones y transacciones
 * mientras sigue utilizando los procedimientos almacenados existentes
 */
class HybridStockService {
    constructor() {
        this.sequelize = sequelize;
        // Buffer para actualizaciones (opcional, para optimización)
        this.updateBuffer = {};
        this.bufferTimeout = null;
        this.bufferInterval = 500; // ms
        
        // Inicializar conexión
        this.initialize();
    }
    
    /**
     * Inicializa la conexión y verifica conectividad
     */
    async initialize() {
        try {
            await this.sequelize.authenticate();
            console.log('Conexión a la base de datos establecida correctamente');
        } catch (error) {
            console.error('Error al conectar con la base de datos:', error);
        }
    }
    
    /**
     * Sanitiza un objeto para uso seguro en SQL
     * @param {Object} obj - Objeto a sanitizar
     * @returns {Object} - Objeto sanitizado
     */
    sanitizeObject(obj) {
        if (!obj || typeof obj !== 'object') return {};
        
        // Crear una copia del objeto
        const sanitized = {...obj};
        
        // Sanitizar cada propiedad
        Object.keys(sanitized).forEach(key => {
            const value = sanitized[key];
            
            if (value === null || value === undefined) {
                sanitized[key] = null;
            } else if (typeof value === 'string') {
                // Escapar caracteres especiales
                sanitized[key] = value.replace(/['";\\]/g, '\\$&');
            } else if (typeof value === 'object') {
                sanitized[key] = this.sanitizeObject(value);
            }
        });
        
        return sanitized;
    }
    
    /**
     * Actualiza el stock llamando al procedimiento almacenado existente
     * con manejo mejorado de conexiones, transacciones y deadlocks
     * @param {String} op - Operación a realizar
     * @param {Object} item - Item a actualizar
     * @param {String} idsede - ID de la sede
     * @returns {Promise<Object>} - Resultado de la operación
     */
    async updateStock(op, item, idsede) {
        console.log('🟠 [stock.hybrid] updateStock - INICIO', { 
            op, 
            idsede, 
            iditem: item?.iditem, 
            idcarta_lista: item?.idcarta_lista,
            hora: new Date().toISOString()
        });
        
        // Validación exhaustiva para prevenir errores de referencia nula
        if (!item || typeof item !== 'object') {
            const error = new Error('Item inválido o no especificado');
            console.error('❌ [stock.hybrid] Error de validación:', error.message);
            errorManager.logError({
                incidencia: { message: error.message, data: { item } },
                origen: 'HybridStockService.updateStock.validation'
            });
            throw error;
        }
        
        console.log('🟢 [stock.hybrid] Item válido, verificando campos críticos');
        
        // Verificar campos críticos
        const criticalFields = ['idcarta_lista', 'cantidadSumar'];
        const missingFields = criticalFields.filter(field => {
            const value = item[field];
            return value === undefined || value === null || (typeof value === 'string' && value.trim() === '');
        });
        
        if (missingFields.length > 0) {
            const error = new Error(`Campos requeridos faltantes: ${missingFields.join(', ')}`);
            errorManager.logError({
                incidencia: {
                    message: error.message,
                    data: { item, missingFields }
                },
                origen: 'HybridStockService.updateStock.validation'
            });
            throw error;
        }
        
        // Validar valores numéricos
        if (item.cantidadSumar !== undefined && isNaN(parseFloat(item.cantidadSumar))) {
            const error = new Error('El campo cantidadSumar debe ser un número válido');
            errorManager.logError({
                incidencia: {
                    message: error.message,
                    data: { cantidadSumar: item.cantidadSumar }
                },
                origen: 'HybridStockService.updateStock.validation'
            });
            throw error;
        }
        
        // Sanitizar objeto para prevenir errores SQL
        const sanitizedItem = this.sanitizeObject(item);
        
        try {
            // Usar transacción con reintentos automáticos para deadlocks
            return await sequelize.transaction({
                isolationLevel: Sequelize.Transaction.ISOLATION_LEVELS.READ_COMMITTED,
                retry: deadlockRetryOptions
            }, async (transaction) => {
                // Llamada al procedimiento almacenado dentro de la transacción
                let result;
                
                // Diferentes procedimientos según el tipo de item
                if (sanitizedItem.isalmacen === 1) {
                    // Item de almacén
                    const itemData = {
                        cantidadSumar: sanitizedItem.cantidadSumar,
                        idcarta_lista: sanitizedItem.idcarta_lista,
                        cantidad_reset: sanitizedItem.cantidad_reset || 0
                    };
                    
                    result = await sequelize.query(
                        'CALL porcedure_pwa_update_cantidad_only_producto(:op, :itemData)',
                        {
                            replacements: {
                                op: op,
                                itemData: JSON.stringify(itemData)
                            },
                            type: QueryTypes.RAW,
                            transaction
                        }
                    );
                } else if (sanitizedItem.isporcion === 'SP' && Array.isArray(sanitizedItem.subitems_selected) && sanitizedItem.subitems_selected.length > 0) {
                    console.log('🔹 [stock.hybrid] Procesando item con porciones (SP):', {
                        iditem: sanitizedItem.iditem,
                        subitems: sanitizedItem.subitems_selected.length,
                        procedimiento: 'procedure_stock_item_porcion'
                    });
                    
                    try {
                        console.log('📦 [stock.hybrid] Llamando a procedure_stock_item_porcion');
                        const result = await sequelize.query('CALL procedure_stock_item_porcion(:itemData, :idsede)', {
                            replacements: { itemData: JSON.stringify(sanitizedItem), idsede },
                            type: QueryTypes.RAW,
                            transaction
                        });
                        console.log('✅ [stock.hybrid] procedure_stock_item_porcion exitoso');
                        return result;
                    } catch (spError) {
                        // Error específico con procedure_stock_item_porcion
                        // Este procedimiento a veces falla con syntax error
                        console.error('⛔ [stock.hybrid] Error en procedure_stock_item_porcion:', spError.message);
                        
                        errorManager.logError({
                            incidencia: { message: `Error en procedure_stock_item_porcion: ${spError.message}`, data: { item: sanitizedItem, idsede, error: spError.toString() } },
                            origen: 'HybridStockService.updateStock.procedure_stock_item_porcion'
                        });
                        
                        // Si es un error de sintaxis SQL, intentar con una versión más segura
                        if (spError.message.includes('syntax') || 
                            spError.original?.code === 'ER_PARSE_ERROR') {
                            console.log('Intentando con actualización alternativa para porción');
                            
                            // Actualización directa como alternativa al procedimiento
                            await sequelize.query(
                                'UPDATE carta_lista SET cantidad = cantidad + :cantidadSumar WHERE idcarta_lista = :idcarta_lista',
                                {
                                    replacements: {
                                        cantidadSumar: sanitizedItem.cantidadSumar,
                                        idcarta_lista: sanitizedItem.idcarta_lista
                                    },
                                    type: QueryTypes.UPDATE,
                                    transaction
                                }
                            );
                            
                            return { success: true, alternativeMethod: true };
                        } else {
                            throw spError; // Re-lanzar otros tipos de errores
                        }
                    }
                } else {
                    // Item regular
                    console.log('📦 [stock.hybrid] Llamando a procedure_stock_item');
                    result = await sequelize.query(
                        'CALL procedure_stock_item(:itemData, :idsede)',
                        {
                            replacements: {
                                itemData: JSON.stringify(sanitizedItem),
                                idsede: idsede
                            },
                            type: QueryTypes.RAW,
                            transaction
                        }
                    );
                    console.log('✅ [stock.hybrid] procedure_stock_item exitoso');
                }
                
                return result;
            });
        } catch (error) {
            console.error('Error en actualización de stock:', error);
            
            // Registrar el error detallado
            errorManager.logError({
                incidencia: {
                    message: error.message,
                    data: {
                        item_process: item,
                        error_code: error.original?.code || error.code,
                        sql_state: error.original?.sqlState
                    }
                },
                origen: 'HybridStockService.updateStock'
            });
            
            throw error;
        }
    }
    
    /**
     * Maneja la actualización de items complejos (con subitems y porciones)
     * @param {String} op - Operación a realizar
     * @param {Object} item - Item a actualizar
     * @param {String} idsede - ID de la sede
     * @param {Transaction} transaction - Transacción activa de Sequelize
     * @returns {Promise<Object>} - Resultado de la operación
     * @private
     */
    async handleComplexItemUpdate(op, item, idsede, transaction) {
        // Procesar subitems si existen
        if (item.subitems_selected && Array.isArray(item.subitems_selected)) {
            const results = [];
            
            // Procesar cada subitem en la misma transacción
            for (const subitem of item.subitems_selected) {
                if (subitem.opciones && Array.isArray(subitem.opciones)) {
                    for (const opcion of subitem.opciones) {
                        if (opcion.cantidad && opcion.cantidad !== 'ND') {
                            // Construir data para el procedimiento
                            const porcionData = {
                                idporcion: subitem.idporcion || '',
                                idproducto: subitem.idproducto || '',
                                iditem_subitem: opcion.iditem_subitem || '',
                                iditem: item.iditem,
                                idcarta_lista: item.idcarta_lista,
                                cantidad_reset: item.cantidad_reset || 0,
                                cantidadSumar: item.cantidadSumar,
                                isporcion: item.isporcion,
                                iditem2: item.iditem,
                                cantidad: opcion.cantidad
                            };
                            
                            // Llamar al procedimiento para porciones con manejo específico de errores
                            try {
                                const result = await sequelize.query(
                                    'CALL procedure_stock_item_porcion(:porcionData, :idsede)',
                                    {
                                        replacements: {
                                            porcionData: JSON.stringify(porcionData),
                                            idsede: idsede
                                        },
                                        type: QueryTypes.RAW,
                                        transaction
                                    }
                                );
                                
                                results.push(result);
                            } catch (porcionError) {
                                console.error('Error en actualización de porción:', porcionError);
                                errorManager.logError({
                                    incidencia: {
                                        message: porcionError.message,
                                        data: {
                                            porcionData: porcionData,
                                            error_code: porcionError.original?.code,
                                            sql_state: porcionError.original?.sqlState
                                        }
                                    },
                                    origen: 'HybridStockService.handleComplexItemUpdate.porcion'
                                });
                                
                                // Si es un error de sintaxis SQL, intentar con una versión más segura
                                if (porcionError.message.includes('syntax') || 
                                    porcionError.original?.code === 'ER_PARSE_ERROR') {
                                    console.log('Intentando con actualización alternativa para porción');
                                    
                                    // Actualización directa como alternativa al procedimiento
                                    await sequelize.query(
                                        'UPDATE carta_lista SET cantidad = cantidad + :cantidadSumar WHERE idcarta_lista = :idcarta_lista',
                                        {
                                            replacements: {
                                                cantidadSumar: porcionData.cantidadSumar,
                                                idcarta_lista: porcionData.idcarta_lista
                                            },
                                            type: QueryTypes.UPDATE,
                                            transaction
                                        }
                                    );
                                    
                                    results.push({ success: true, alternativeMethod: true });
                                } else {
                                    throw porcionError; // Re-lanzar otros tipos de errores
                                }
                            }
                        }
                    }
                }
            }
            
            return results;
        }
        
        // Si no hay subitems, usar el procedimiento estándar
        return await sequelize.query(
            'CALL procedure_stock_item(:itemData, :idsede)',
            {
                replacements: {
                    itemData: JSON.stringify(item),
                    idsede: idsede
                },
                type: QueryTypes.RAW,
                transaction
            }
        );
    }
    
    /**
     * Buffer de actualizaciones para optimizar operaciones repetitivas
     * (Opcional, para optimización avanzada)
     * @param {String} op - Operación a realizar
     * @param {Object} item - Item a actualizar
     * @param {String} idsede - ID de la sede
     * @returns {Promise<Object>} - Estado del buffer
     */
    bufferStockUpdate(op, item, idsede) {
        const itemId = item.idcarta_lista || item.iditem;
        const key = `${itemId}_${idsede}_${op}`;
        
        // Inicializar o actualizar buffer
        if (!this.updateBuffer[key]) {
            this.updateBuffer[key] = {
                op,
                item: {...item},
                idsede,
                count: 1,
                cantidadTotal: item.cantidadSumar || 0
            };
        } else {
            this.updateBuffer[key].count++;
            this.updateBuffer[key].cantidadTotal += (item.cantidadSumar || 0);
        }
        
        // Programar flush si no está programado
        if (!this.bufferTimeout) {
            this.bufferTimeout = setTimeout(() => this.flushBuffer(), this.bufferInterval);
        }
        
        return {
            status: 'buffered',
            key,
            currentBuffer: this.updateBuffer[key],
            bufferSize: Object.keys(this.updateBuffer).length
        };
    }
    
    /**
     * Procesa todas las actualizaciones buffered
     * @returns {Promise<Array>} - Resultados de las actualizaciones
     */
    async flushBuffer() {
        this.bufferTimeout = null;
        
        if (Object.keys(this.updateBuffer).length === 0) {
            return [];
        }
        
        const bufferCopy = {...this.updateBuffer};
        this.updateBuffer = {};
        
        const results = [];
        
        try {
            // Usar una única transacción para todas las actualizaciones
            await sequelize.transaction({
                isolationLevel: Sequelize.Transaction.ISOLATION_LEVELS.READ_COMMITTED,
                retry: deadlockRetryOptions
            }, async (transaction) => {
                for (const key of Object.keys(bufferCopy)) {
                    const { op, item, idsede, cantidadTotal } = bufferCopy[key];
                    
                    // Actualizar la cantidad sumada con el total acumulado
                    const updatedItem = {...item, cantidadSumar: cantidadTotal};
                    
                    // Procesar el item con la cantidad acumulada
                    const result = await this.handleComplexItemUpdate(op, updatedItem, idsede, transaction);
                    results.push({key, result});
                }
            });
            
            return results;
        } catch (error) {
            console.error('Error al procesar buffer:', error);
            
            // Registrar el error
            errorManager.logError({
                incidencia: {
                    message: error.message,
                    data: {
                        buffer_size: Object.keys(bufferCopy).length,
                        error_code: error.original?.code || error.code,
                        sql_state: error.original?.sqlState
                    }
                },
                origen: 'HybridStockService.flushBuffer'
            });
            
            // Reintentar individualmente para aislar errores
            for (const key of Object.keys(bufferCopy)) {
                const { op, item, idsede } = bufferCopy[key];
                try {
                    const result = await this.updateStock(op, item, idsede);
                    results.push({key, result, retried: true});
                } catch (itemError) {
                    results.push({key, error: itemError.message, retried: true});
                }
            }
            
            return results;
        }
    }
    
    /**
     * Consulta el stock de un item
     * @param {String} itemId - ID del item
     * @param {String} sedeId - ID de la sede
     * @returns {Promise<Object>} - Información del stock
     */
    async getStock(itemId, sedeId) {
        try {
            // Sanitizar parámetros
            const safeItemId = itemId ? itemId.toString() : '';
            const safeSedeId = sedeId ? parseInt(sedeId, 10) : 0;
            
            if (!safeItemId || isNaN(safeSedeId)) {
                throw new Error('Parámetros inválidos');
            }
            
            // Consulta directa con Sequelize
            const result = await sequelize.query(
                'SELECT cantidad FROM carta_lista WHERE idcarta_lista = :itemId',
                {
                    replacements: { itemId: safeItemId },
                    type: QueryTypes.SELECT
                }
            );
            
            return result && result.length > 0 
                ? { success: true, stock: result[0].cantidad, itemId: safeItemId }
                : { success: false, message: 'Item no encontrado', itemId: safeItemId };
                
        } catch (error) {
            console.error('Error al consultar stock:', error);
            
            // Registrar el error
            errorManager.logError({
                incidencia: {
                    message: error.message,
                    data: { itemId, sedeId }
                },
                origen: 'HybridStockService.getStock'
            });
            
            throw error;
        }
    }
    
    /**
     * Implementa compatibilidad con la interfaz original
     * @returns {Object} - Métodos compatibles con la interfaz original
     */
    getCompatibilityLayer() {
        return {
            updateStock: this.updateStock.bind(this),
            getStock: this.getStock.bind(this)
        };
    }
}

// Crear y exportar una instancia única del servicio
const stockService = new HybridStockService();
module.exports = stockService;
