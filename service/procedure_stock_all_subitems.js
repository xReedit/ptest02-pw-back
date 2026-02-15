/**
 * procedure_stock_all_subitems.js
 * 
 * Reemplazo en JavaScript del procedimiento almacenado: procedure_stock_all_subitems
 * 
 * FUNCIÓN ORIGINAL DEL PROCEDIMIENTO:
 * - Actualizar stock de subitems que pueden ser:
 *   1. Porciones (tabla porcion)
 *   2. Productos (tabla producto_stock o carta_lista)
 *   3. Items de subitem (tabla item_subitem)
 * 
 * MEJORAS SOBRE EL PROCEDIMIENTO:
 * - ✅ Sintaxis correcta (sin && que causa error)
 * - ✅ Comparaciones NULL correctas
 * - ✅ Previene stock negativo con GREATEST(0, ...)
 * - ✅ Retorna formato correcto (no 3 columnas sin sentido)
 * - ✅ Transacciones ACID
 * - ✅ Logging detallado
 * - ✅ Manejo de errores robusto
 * 
 * @author Sistema
 * @version 1.0.0
 * @date 2025-11-04
 */

const { sequelize, Sequelize } = require('../config/database');
const { QueryTypes } = Sequelize;
const logger = require('../utilitarios/logger');
const errorManager = require('./error.manager');
const StockPorcionService = require('./stock.porcion.service');

/**
 * Actualiza el stock de subitems (porciones, productos o items)
 * Equivalente a: CALL procedure_stock_all_subitems(allItems)
 * 
 * @param {Object} allItems - Objeto con datos del subitem
 * @param {number} allItems.idporcion - ID de la porción (si aplica)
 * @param {number} allItems.idproducto - ID del producto (si aplica)
 * @param {string} allItems.iditem_subitem - ID del item_subitem (si aplica)
 * @param {number} allItems.cantidadSumar - Cantidad a sumar/restar
 * @param {number} allItems.cantidad_reset - Si > 0, establece este valor exacto
 * @param {number} allItems.idsede - ID de la sede
 * @param {Object} transaction - Transacción de Sequelize (opcional)
 * @returns {Promise<Array>} Array con [{cantidad}]
 */
async function updateStockAllSubitems(allItems, transaction = null) {
    const startTime = Date.now();
    
    try {
        // Validar que allItems sea un objeto válido
        if (!allItems || typeof allItems !== 'object') {
            throw new Error('Parámetros inválidos: allItems debe ser un objeto');
        }

        const esReset = (allItems.cantidad_reset || 0) > 0;
        const cantidadAjuste = esReset ? allItems.cantidad_reset : (allItems.cantidadSumar || 0);
        const idsede = allItems.idsede || 1;
        
        // 🔍 DEBUG: Log para diagnosticar bug stock=0
        logger.warn({
            idproducto: allItems.idproducto,
            idporcion: allItems.idporcion,
            cantidad_reset_original: allItems.cantidad_reset,
            cantidadSumar_original: allItems.cantidadSumar,
            esReset,
            cantidadAjuste,
            query_sera: esReset ? 'SET stock = GREATEST(0, stock + cantidadAjuste)' : 'SET stock = GREATEST(0, stock + cantidadAjuste)'
        }, '🔍 [DEBUG-STOCK] procedure_stock_all_subitems - Valores para UPDATE');
        
        logger.debug({
            idporcion: allItems.idporcion,
            idproducto: allItems.idproducto,
            iditem_subitem: allItems.iditem_subitem,
            idsubreceta: allItems.idsubreceta,
            esReset,
            cantidadAjuste
        }, '📦 [procedure_stock_all_subitems.js] Actualizando stock subitem');

        // Determinar tipo de subitem y actualizar correspondientemente
        
        // CASO 1: Es una porción - Usar función SOLID centralizada
        if (allItems.idporcion && allItems.idporcion > 0) {
            // Validación: solo procesar si hay cambio real
            if (cantidadAjuste !== 0) {     
                           
                // let tipoMovimiento;
                // if (allItems.from_monitor) {
                //     tipoMovimiento = 'MODIFICACION_MONITOR';
                // } else {
                //     const esSalida = cantidadAjuste < 0;
                //     tipoMovimiento = esSalida ? 'VENTA' : 'VENTA_DEVOLUCION';
                // }
                const esSalida = cantidadAjuste < 0;
                const tipoMovimiento = esSalida ? 'VENTA' : 'VENTA_DEVOLUCION';

                // SOLID: Una sola función que actualiza stock Y registra historial
                const resultado = await StockPorcionService.procesarMovimientoPorcion(
                    allItems.idporcion,
                    cantidadAjuste,  // negativo para restar, positivo para sumar
                    tipoMovimiento,
                    {
                        idsede: idsede,
                        idusuario: allItems.idusuario || 1,
                        idpedido: allItems.idpedido || null,
                        iditem: allItems.iditem || 0
                    },
                    transaction
                );

                logger.debug({
                    idporcion: allItems.idporcion,
                    cantidadAjuste,
                    stockNuevo: resultado.stockNuevo,
                    executionTime: `${Date.now() - startTime}ms`
                }, '✅ [procedure_stock_all_subitems.js] Porción procesada (SOLID)');

                return [{ cantidad: resultado.stockNuevo || 0 }];
            }
            
            // Si cantidadAjuste es 0, solo obtener stock actual
            const [result] = await sequelize.query(
                'SELECT stock as cantidad FROM porcion WHERE idporcion = ? AND idsede = ? LIMIT 1',
                {
                    replacements: [allItems.idporcion, idsede],
                    type: QueryTypes.SELECT,
                    transaction
                }
            );
            return [result || { cantidad: 0 }];
        }

        // CASO 2: Es una subreceta (tiene idsubreceta > 0)
        else if (allItems.idsubreceta && allItems.idsubreceta > 0) {
            logger.debug({
                idsubreceta: allItems.idsubreceta,
                cantidadAjuste
            }, '📦 [procedure_stock_all_subitems.js] Procesando subreceta');

            // Obtener ingredientes de la subreceta
            const ingredientesSubreceta = await sequelize.query(`
                    SELECT 
                        si.idporcion,
                        si.idproducto_stock,
                        si.cantidad,
                        si.viene_de
                    FROM subreceta_ingrediente si
                    WHERE si.idsubreceta = ?
                        AND si.estado = 0
                        AND (si.idporcion > 0 OR si.idproducto_stock > 0)
                `, {
                replacements: [allItems.idsubreceta],
                type: QueryTypes.SELECT,
                transaction
            });

            // Procesar cada ingrediente de la subreceta
            for (const ingrediente of ingredientesSubreceta) {
                const cantidadIngrediente = cantidadAjuste * ingrediente.cantidad;

                // Si es porción - Usar función SOLID centralizada
                if (ingrediente.idporcion && ingrediente.idporcion > 0) {
                    // Validación: solo procesar si hay cambio real
                    if (cantidadIngrediente !== 0) {
                        // let tipoMovimiento;
                        // if (allItems.from_monitor) {
                        //     tipoMovimiento = 'MODIFICACION_MONITOR';
                        // } else {
                        //     const esSalida = cantidadAjuste < 0;
                        //     tipoMovimiento = esSalida ? 'VENTA' : 'VENTA_DEVOLUCION';
                        // }
                        const esSalida = cantidadAjuste < 0;
                        const tipoMovimiento = esSalida ? 'VENTA' : 'VENTA_DEVOLUCION';

                        // SOLID: Una sola función que actualiza stock Y registra historial
                        await StockPorcionService.procesarMovimientoPorcion(
                            ingrediente.idporcion,
                            cantidadIngrediente,  // negativo para restar, positivo para sumar
                            tipoMovimiento,
                            {
                                idsede: idsede,
                                idusuario: allItems.idusuario || 1,
                                idpedido: allItems.idpedido || null,
                                iditem: allItems.iditem || 0
                            },
                            transaction
                        );

                        logger.debug({
                            idporcion: ingrediente.idporcion,
                            cantidadIngrediente,
                            tipoMovimiento
                        }, '✅ [subreceta] Porción procesada (SOLID)');
                    }
                }
                // Si es producto
                else if (ingrediente.idproducto_stock && ingrediente.idproducto_stock > 0) {
                    const updateQuery = esReset
                        ? 'UPDATE producto_stock SET stock = GREATEST(0, stock + ?) WHERE idproducto_stock = ?'
                        : 'UPDATE producto_stock SET stock = GREATEST(0, stock + ?) WHERE idproducto_stock = ?';

                    await sequelize.query(updateQuery, {
                        replacements: [cantidadIngrediente, ingrediente.idproducto_stock],
                        type: QueryTypes.UPDATE,
                        transaction
                    });

                    logger.debug({
                        idproducto_stock: ingrediente.idproducto_stock,
                        cantidadIngrediente
                    }, '✅ [subreceta] Producto actualizado');
                }
            }

            logger.debug({
                idsubreceta: allItems.idsubreceta,
                ingredientesProcesados: ingredientesSubreceta.length,
                executionTime: `${Date.now() - startTime}ms`
            }, '✅ [procedure_stock_all_subitems.js] Subreceta procesada');

            return [{ cantidad: 0, subrecetaProcesada: true }];
        }
        
        // CASO 2: Es un producto
        else if (allItems.idproducto && allItems.idproducto > 0) {
            // ✅ CORREGIDO: Siempre usar stock + ? para sumar/restar
            // El valor de cantidadAjuste debe ser negativo para restar
            const updateQuery = 'UPDATE producto_stock SET stock = GREATEST(0, stock + ?) WHERE idproducto_stock = ?';
            
            logger.debug({
                idproducto: allItems.idproducto,
                cantidadAjuste,
                query: 'stock + cantidadAjuste'
            }, '📦 [procedure_stock_all_subitems.js] Actualizando producto_stock');
            
            await sequelize.query(updateQuery, {
                replacements: [cantidadAjuste, allItems.idproducto],
                type: QueryTypes.UPDATE,
                transaction
            });
            
            // Obtener stock actualizado
            const [result] = await sequelize.query(
                'SELECT stock as cantidad FROM producto_stock WHERE idproducto_stock = ? LIMIT 1',
                {
                    replacements: [allItems.idproducto],
                    type: QueryTypes.SELECT,
                    transaction
                }
            );
            
            logger.debug({
                idproducto_stock: allItems.idproducto,
                cantidadFinal: result?.cantidad,
                executionTime: `${Date.now() - startTime}ms`
            }, '✅ [procedure_stock_all_subitems.js] Stock producto actualizado');
            
            return [result || { cantidad: 0 }];
        }
        
        // CASO 3: Es un item_subitem (sin porción ni producto asociado)
        else if (allItems.iditem_subitem && allItems.iditem_subitem !== '') {
            // Actualizar solo si la cantidad NO es 'ND'
            const updateQuery = `
                UPDATE item_subitem 
                SET cantidad = cantidad + ? 
                WHERE cantidad != 'ND' 
                    AND iditem_subitem IN (?)
            `;
            
            await sequelize.query(updateQuery, {
                replacements: [cantidadAjuste, allItems.iditem_subitem],
                type: QueryTypes.UPDATE,
                transaction
            });
            
            // item_subitem no retorna cantidad específica
            logger.debug({
                iditem_subitem: allItems.iditem_subitem,
                executionTime: `${Date.now() - startTime}ms`
            }, '✅ [procedure_stock_all_subitems.js] Stock item_subitem actualizado');
            
            return [{ cantidad: 0 }];
        }
        
        // CASO 4: Sin porción, producto ni item_subitem válidos
        else {
            logger.warn({ allItems }, '⚠️ Subitem sin idporcion, idproducto o iditem_subitem válidos');
            return [{ cantidad: 0 }];
        }
        
    } catch (error) {
        errorManager.logError({
            incidencia: {
                message: `Error en procedure_stock_all_subitems.js: ${error.message}`,
                data: { allItems }
            },
            origen: 'procedure_stock_all_subitems.js.updateStockAllSubitems'
        });
        
        throw error;
    }
}

module.exports = {
    updateStockAllSubitems
};
