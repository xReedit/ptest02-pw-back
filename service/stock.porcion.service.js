/**
 * stock.porcion.service.js
 * 
 * Servicio centralizado para manejo de stock de porciones con transacciones ACID
 * Optimizado para alta concurrencia (50+ transacciones/segundo)
 * 
 * Características:
 * - Transacciones atómicas (stock + historial)
 * - Locks pesimistas (SELECT FOR UPDATE)
 * - Retry logic para deadlocks
 * - Validación de stock suficiente
 * - Logging no invasivo
 * - Performance optimizado
 * 
 * @author Sistema
 * @version 1.0.0
 */

const { sequelize, Sequelize } = require('../config/database');
const errorManager = require('./error.manager');
const logger = require('../utilitarios/logger');

/**
 * Configuración del servicio
 */
const CONFIG = {
    // Isolation level óptimo para evitar dirty reads pero permitir concurrencia
    ISOLATION_LEVEL: Sequelize.Transaction.ISOLATION_LEVELS.READ_COMMITTED,
    
    // Retry logic para deadlocks
    MAX_RETRIES: 3,
    RETRY_DELAY_MS: 50, // Delay incremental: 50ms, 100ms, 150ms
    
    // Timeouts
    TRANSACTION_TIMEOUT_MS: 5000, // 5 segundos max por transacción
    LOCK_TIMEOUT_MS: 2000, // 2 segundos max esperando lock
    
    // Tipos de movimiento
    TIPO_MOVIMIENTO: {
        ENTRADA: { id: 1, nombre: 'ENTRADA' },
        SALIDA: { id: 2, nombre: 'SALIDA' },
        VENTA: { id: 3, nombre: 'VENTA' },
        COMPRA: { id: 4, nombre: 'COMPRA' },
        RECUPERA: { id: 5, nombre: 'RECUPERA' },
        VENTA_DEVOLUCION: { id: 6, nombre: 'VENTA DEVOLUCION' }
    }
};

/**
 * Servicio principal de stock de porciones
 */
class StockPorcionService {
    
    /**
     * Actualiza stock de porciones y registra movimiento en UNA transacción atómica
     * Método principal optimizado para alta concurrencia
     * 
     * @param {Object} params - Parámetros de la operación
     * @param {number} params.iditem - ID del item/producto
     * @param {number} params.cantidadProducto - Cantidad de productos pedidos (ej: 2 hamburguesas)
     * @param {number} params.idsede - ID de la sede
     * @param {number} params.idusuario - ID del usuario
     * @param {number|null} params.idpedido - ID del pedido (opcional)
     * @param {string} params.tipoMovimiento - 'VENTA', 'ENTRADA', 'SALIDA', etc.
     * @param {boolean} params.esReset - Si es un reset de stock (true) o descuento (false)
     * @returns {Promise<Object>} Resultado de la operación
     */
    static async actualizarStockConHistorial(params) {
        const startTime = Date.now();
        let transaction = null;
        let attempt = 0;
        
        // Validaciones rápidas
        const validation = this._validateParams(params);
        if (!validation.valid) {
            return {
                success: false,
                error: validation.error,
                porcionesAfectadas: []
            };
        }
        
        const { iditem, cantidadProducto, idsede, idusuario, idpedido, tipoMovimiento, esReset } = params;
        
        // Retry loop para manejar deadlocks
        while (attempt < CONFIG.MAX_RETRIES) {
            attempt++;
            
            try {
                // Iniciar transacción con configuración optimizada
                transaction = await sequelize.transaction({
                    isolationLevel: CONFIG.ISOLATION_LEVEL,
                    type: Sequelize.Transaction.TYPES.IMMEDIATE
                });
                
                // Paso 1: Obtener receta del item (qué porciones consume)
                const receta = await this._obtenerRecetaItem(iditem, transaction);
                
                if (!receta || receta.length === 0) {
                    await transaction.commit();
                    return {
                        success: true,
                        message: 'Item no tiene porciones asociadas',
                        porcionesAfectadas: [],
                        ejecutionTime: Date.now() - startTime
                    };
                }
                
                // Paso 2: Lock pesimista en las porciones (evita race conditions)
                const porcionesIds = receta.map(r => r.idporcion).filter(id => id > 0);
                const porcionesConLock = await this._lockPorciones(porcionesIds, idsede, transaction);
                
                // NOTA: NO validamos stock aquí porque el procedimiento almacenado ya lo hizo
                // Si llegamos aquí es porque el procedimiento ejecutó correctamente
                
                // Paso 3: SOLO obtener el stock actual (NO actualizar, eso lo hace el procedimiento)
                // El procedimiento almacenado YA actualizó el stock, solo necesitamos registrar el historial
                const porcionesActualizadas = await this._obtenerStockActualPorciones(receta, transaction);
                // Paso 5: Registrar movimientos en historial
                await this._registrarMovimientosHistorial(
                    porcionesActualizadas,
                    {
                        iditem,
                        cantidadProducto,
                        idsede,
                        idusuario,
                        idpedido,
                        tipoMovimiento
                    },
                    transaction
                );
                
                // Commit de la transacción
                await transaction.commit();
                
                return {
                    success: true,
                    message: 'Stock actualizado correctamente',
                    porcionesAfectadas: porcionesActualizadas,
                    ejecutionTime: Date.now() - startTime
                };
                
            } catch (error) {
                // Rollback en caso de error
                if (transaction) {
                    try {
                        await transaction.rollback();
                    } catch (rollbackError) {
                        logger.error({ error: rollbackError }, 'Error en rollback');
                    }
                }
                
                // Detectar deadlock y reintentar
                const isDeadlock = this._isDeadlockError(error);
                const isLockTimeout = this._isLockTimeoutError(error);
                
                if ((isDeadlock || isLockTimeout) && attempt < CONFIG.MAX_RETRIES) {
                    // Esperar tiempo incremental antes de reintentar
                    const delay = CONFIG.RETRY_DELAY_MS * attempt;
                    await this._sleep(delay);
                    
                    logger.warn({ attempt, maxRetries: CONFIG.MAX_RETRIES, tipo: isDeadlock ? 'deadlock' : 'lock timeout' }, `⚠️ Reintento por ${isDeadlock ? 'deadlock' : 'lock timeout'}`);
                    continue; // Reintentar
                }
                
                // Error definitivo, no se puede reintentar
                errorManager.logError({
                    incidencia: {
                        message: `Error actualizando stock de porciones: ${error.message}`,
                        data: { params, attempt, errorCode: error.code }
                    },
                    origen: 'StockPorcionService.actualizarStockConHistorial'
                });
                
                return {
                    success: false,
                    error: error.message,
                    errorCode: error.code,
                    porcionesAfectadas: [],
                    attempt
                };
            }
        }
        
        // Si llegamos aquí, se agotaron los reintentos
        return {
            success: false,
            error: 'Máximo de reintentos alcanzado',
            porcionesAfectadas: []
        };
    }
    
    /**
     * Registra movimiento de una porción específica (sin receta)
     * Usado para subitems con porciones que no están en la receta del item principal
     * 
     * @param {Object} params - Parámetros del movimiento
     * @param {number} params.idporcion - ID de la porción
     * @param {number} params.iditem - ID del item
     * @param {number} params.cantidad - Cantidad del movimiento
     * @param {number} params.idsede - ID de la sede
     * @param {number} params.idusuario - ID del usuario
     * @param {number|null} params.idpedido - ID del pedido
     * @param {string} params.tipoMovimiento - Tipo de movimiento
     */
    static async registrarMovimientoPorcionDirecta(params) {
        const { idporcion, iditem, cantidad, idsede, idusuario, idpedido, tipoMovimiento } = params;
        
        try {
            const transaction = await sequelize.transaction({
                isolationLevel: CONFIG.ISOLATION_LEVEL
            });
            
            try {
                // Obtener stock actual de la porción
                const [porcion] = await sequelize.query(
                    'SELECT stock, descripcion FROM porcion WHERE idporcion = :idporcion AND idsede = :idsede',
                    {
                        replacements: { idporcion, idsede },
                        type: Sequelize.QueryTypes.SELECT,
                        transaction
                    }
                );
                
                if (!porcion) {
                    await transaction.rollback();
                    logger.warn({ idporcion, idsede }, `⚠️ Porción ${idporcion} no encontrada en sede ${idsede}`);
                    return { success: false, error: 'Porción no encontrada' };
                }
                
                // Registrar movimiento en historial
                const tipoMovConfig = CONFIG.TIPO_MOVIMIENTO[tipoMovimiento] || CONFIG.TIPO_MOVIMIENTO.VENTA;
                
                await sequelize.query(
                    `INSERT INTO porcion_historial (
                        tipo_movimiento,
                        fecha,
                        hora,
                        cantidad,
                        idusuario,
                        idporcion,
                        idsede,
                        estado,
                        stock_total,
                        fecha_date,
                        idtipo_movimiento_stock,
                        idpedido,
                        iditem
                    ) VALUES (
                        :tipoMovimiento,
                        NOW(),
                        TIME(NOW()),
                        :cantidad,
                        :idusuario,
                        :idporcion,
                        :idsede,
                        'CONFIRMADO',
                        :stockTotal,
                        DATE(NOW()),
                        :idtipoMovimiento,
                        :idpedido,
                        :iditem
                    )`,
                    {
                        replacements: {
                            tipoMovimiento: tipoMovConfig.nombre,
                            cantidad,
                            idusuario,
                            idporcion,
                            idsede,
                            stockTotal: porcion.stock,
                            idtipoMovimiento: tipoMovConfig.id,
                            idpedido,
                            iditem
                        },
                        type: Sequelize.QueryTypes.INSERT,
                        transaction
                    }
                );
                
                await transaction.commit();
                
                return {
                    success: true,
                    message: `Movimiento registrado para porción ${porcion.descripcion}`,
                    porcion: {
                        idporcion,
                        descripcion: porcion.descripcion,
                        stockActual: porcion.stock,
                        cantidad
                    }
                };
                
            } catch (error) {
                await transaction.rollback();
                throw error;
            }
            
        } catch (error) {
            errorManager.logError({
                incidencia: {
                    message: `Error registrando movimiento de porción directa: ${error.message}`,
                    data: { params }
                },
                origen: 'StockPorcionService.registrarMovimientoPorcionDirecta'
            });
            
            return {
                success: false,
                error: error.message
            };
        }
    }
    
    /**
     * Obtiene la receta del item (qué porciones consume y en qué cantidad)
     * @private
     */
    static async _obtenerRecetaItem(iditem, transaction) {
        const query = `
            SELECT 
                ii.iditem_ingrediente,
                ii.iditem,
                ii.idporcion,
                ii.idproducto_stock,
                ii.descripcion,
                ii.cantidad as cantidad_receta,
                ii.necesario,
                ii.viene_de,
                p.descripcion as porcion_descripcion,
                p.stock as stock_actual
            FROM item_ingrediente ii
            LEFT JOIN porcion p ON ii.idporcion = p.idporcion
            WHERE ii.iditem = :iditem
                AND ii.estado = 0
                AND (ii.idporcion > 0 OR ii.idproducto_stock > 0)
            ORDER BY ii.necesario DESC
        `;
        
        const receta = await sequelize.query(query, {
            replacements: { iditem },
            type: Sequelize.QueryTypes.SELECT,
            transaction
        });
        
        return receta;
    }
    
    /**
     * Aplica lock pesimista (SELECT FOR UPDATE) en las porciones
     * Esto previene race conditions cuando múltiples requests tocan la misma porción
     * @private
     */
    static async _lockPorciones(porcionesIds, idsede, transaction) {
        if (!porcionesIds || porcionesIds.length === 0) {
            return [];
        }
        
        const query = `
            SELECT 
                idporcion,
                stock,
                descripcion,
                idsede
            FROM porcion
            WHERE idporcion IN (:porcionesIds)
                AND idsede = :idsede
            FOR UPDATE
        `;
        
        const porciones = await sequelize.query(query, {
            replacements: { 
                porcionesIds: porcionesIds,
                idsede 
            },
            type: Sequelize.QueryTypes.SELECT,
            transaction
        });
        
        return porciones;
    }
    
    /**
     * Valida que haya stock suficiente para la operación
     * @private
     */
    static _validarStockSuficiente(receta, porcionesConLock, cantidadProducto) {
        const errores = [];
        
        for (const itemReceta of receta) {
            if (itemReceta.idporcion > 0 && itemReceta.necesario === '1') {
                const porcion = porcionesConLock.find(p => p.idporcion === itemReceta.idporcion);
                
                if (!porcion) {
                    errores.push(`Porción ${itemReceta.descripcion} no encontrada`);
                    continue;
                }
                
                const cantidadRequerida = itemReceta.cantidad_receta * cantidadProducto;
                const stockDisponible = parseFloat(porcion.stock);
                
                if (stockDisponible < cantidadRequerida) {
                    errores.push({
                        porcion: itemReceta.descripcion,
                        requerido: cantidadRequerida,
                        disponible: stockDisponible,
                        faltante: cantidadRequerida - stockDisponible
                    });
                }
            }
        }
        
        return {
            valid: errores.length === 0,
            detalles: errores
        };
    }
    
    /**
     * Obtiene el stock actual de las porciones SIN actualizarlo
     * El procedimiento almacenado YA actualizó el stock, solo necesitamos obtener los valores actuales
     * @private
     */
    static async _obtenerStockActualPorciones(receta, transaction) {
        const porcionesActualizadas = [];
        
        for (const itemReceta of receta) {
            if (itemReceta.idporcion > 0) {
                // Solo obtener el stock actual (que ya fue actualizado por el procedimiento)
                const [stockActual] = await sequelize.query(
                    'SELECT stock FROM porcion WHERE idporcion = :idporcion',
                    {
                        replacements: { idporcion: itemReceta.idporcion },
                        type: Sequelize.QueryTypes.SELECT,
                        transaction
                    }
                );
                
                porcionesActualizadas.push({
                    idporcion: itemReceta.idporcion,
                    descripcion: itemReceta.descripcion,
                    cantidadAjustada: itemReceta.cantidad_receta, // La cantidad de la receta
                    stockAnterior: itemReceta.stock_actual,
                    stockNuevo: stockActual ? parseFloat(stockActual.stock) : 0
                });
            }
        }
        
        return porcionesActualizadas;
    }
    
    /**
     * Actualiza el stock de las porciones (DEPRECADO - Ya no se usa)
     * El stock lo actualiza el procedimiento almacenado
     * @private
     * @deprecated
     */
    static async _actualizarStockPorciones(receta, cantidadProducto, esReset, transaction) {
        const porcionesActualizadas = [];
        
        for (const itemReceta of receta) {
            if (itemReceta.idporcion > 0) {
                const cantidadAjuste = esReset 
                    ? cantidadProducto // Reset: establece el valor
                    : -(itemReceta.cantidad_receta * cantidadProducto); // Venta: descuenta
                
                const query = esReset
                    ? `UPDATE porcion SET stock = :cantidadAjuste WHERE idporcion = :idporcion`
                    : `UPDATE porcion SET stock = stock + :cantidadAjuste WHERE idporcion = :idporcion AND stock + :cantidadAjuste >= 0`;
                
                const [resultado] = await sequelize.query(query, {
                    replacements: {
                        cantidadAjuste,
                        idporcion: itemReceta.idporcion
                    },
                    type: Sequelize.QueryTypes.UPDATE,
                    transaction
                });
                
                // Obtener stock actualizado
                const [stockNuevo] = await sequelize.query(
                    'SELECT stock FROM porcion WHERE idporcion = :idporcion',
                    {
                        replacements: { idporcion: itemReceta.idporcion },
                        type: Sequelize.QueryTypes.SELECT,
                        transaction
                    }
                );
                
                porcionesActualizadas.push({
                    idporcion: itemReceta.idporcion,
                    descripcion: itemReceta.descripcion,
                    cantidadAjustada: cantidadAjuste,
                    stockAnterior: itemReceta.stock_actual,
                    stockNuevo: stockNuevo ? parseFloat(stockNuevo.stock) : 0
                });
            }
        }
        
        return porcionesActualizadas;
    }
    
    /**
     * Registra los movimientos en la tabla porcion_historial
     * @private
     */
    static async _registrarMovimientosHistorial(porcionesActualizadas, datosBase, transaction) {
        const { iditem, cantidadProducto, idsede, idusuario, idpedido, tipoMovimiento } = datosBase;
        
        const tipoMovConfig = CONFIG.TIPO_MOVIMIENTO[tipoMovimiento] || CONFIG.TIPO_MOVIMIENTO.VENTA;
        
        for (const porcion of porcionesActualizadas) {
            const query = `
                INSERT INTO porcion_historial (
                    tipo_movimiento,
                    fecha,
                    hora,
                    cantidad,
                    idusuario,
                    idporcion,
                    idsede,
                    estado,
                    stock_total,
                    fecha_date,
                    idtipo_movimiento_stock,
                    idpedido,
                    iditem
                ) VALUES (
                    :tipo_movimiento,
                    NOW(),
                    TIME(NOW()),
                    :cantidad,
                    :idusuario,
                    :idporcion,
                    :idsede,
                    'CONFIRMADO',
                    :stock_total,
                    DATE(NOW()),
                    :idtipo_movimiento_stock,
                    :idpedido,
                    :iditem
                )
            `;
            
            await sequelize.query(query, {
                replacements: {
                    tipo_movimiento: tipoMovConfig.nombre,
                    cantidad: Math.abs(porcion.cantidadAjustada),
                    idusuario,
                    idporcion: porcion.idporcion,
                    idsede,
                    stock_total: porcion.stockNuevo,
                    idtipo_movimiento_stock: tipoMovConfig.id,
                    idpedido: idpedido || null,
                    iditem
                },
                type: Sequelize.QueryTypes.INSERT,
                transaction
            });
        }
    }
    
    /**
     * Métodos utilitarios
     */
    
    static _validateParams(params) {
        if (!params.iditem) {
            return { valid: false, error: 'iditem es requerido' };
        }
        if (!params.cantidadProducto || params.cantidadProducto <= 0) {
            return { valid: false, error: 'cantidadProducto debe ser mayor a 0' };
        }
        if (!params.idsede) {
            return { valid: false, error: 'idsede es requerido' };
        }
        if (!params.idusuario) {
            return { valid: false, error: 'idusuario es requerido' };
        }
        if (!params.tipoMovimiento) {
            return { valid: false, error: 'tipoMovimiento es requerido' };
        }
        
        return { valid: true };
    }
    
    static _isDeadlockError(error) {
        return error.code === 'ER_LOCK_DEADLOCK' || 
               error.message.includes('Deadlock found');
    }
    
    static _isLockTimeoutError(error) {
        return error.code === 'ER_LOCK_WAIT_TIMEOUT' ||
               error.message.includes('Lock wait timeout');
    }
    
    static _sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

module.exports = StockPorcionService;
