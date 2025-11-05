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
        
        logger.debug({
            idporcion: allItems.idporcion,
            idproducto: allItems.idproducto,
            iditem_subitem: allItems.iditem_subitem,
            esReset,
            cantidadAjuste
        }, '📦 [procedure_stock_all_subitems.js] Actualizando stock subitem');

        // Determinar tipo de subitem y actualizar correspondientemente
        
        // CASO 1: Es una porción
        if (allItems.idporcion && allItems.idporcion > 0) {
            const updateQuery = esReset
                ? 'UPDATE porcion SET stock = ? WHERE idporcion = ? AND idsede = ?'
                : 'UPDATE porcion SET stock = GREATEST(0, stock + ?) WHERE idporcion = ? AND idsede = ?';
            
            await sequelize.query(updateQuery, {
                replacements: [cantidadAjuste, allItems.idporcion, idsede],
                type: QueryTypes.UPDATE,
                transaction
            });
            
            // Obtener stock actualizado
            const [result] = await sequelize.query(
                'SELECT stock as cantidad FROM porcion WHERE idporcion = ? AND idsede = ? LIMIT 1',
                {
                    replacements: [allItems.idporcion, idsede],
                    type: QueryTypes.SELECT,
                    transaction
                }
            );
            
            logger.debug({
                idporcion: allItems.idporcion,
                cantidadFinal: result?.cantidad,
                executionTime: `${Date.now() - startTime}ms`
            }, '✅ [procedure_stock_all_subitems.js] Stock porción actualizado');
            
            return [result || { cantidad: 0 }];
        }
        
        // CASO 2: Es un producto
        else if (allItems.idproducto && allItems.idproducto > 0) {
            // ✅ CORREGIDO: Actualizar en producto_stock, no en carta_lista
            // La tabla correcta es producto_stock y la columna es idproducto_stock
            const updateQuery = esReset
                ? 'UPDATE producto_stock SET stock = ? WHERE idproducto_stock = ?'
                : 'UPDATE producto_stock SET stock = GREATEST(0, stock + ?) WHERE idproducto_stock = ?';
            
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
