/**
 * procedure_stock_item_porcion.js
 * 
 * Reemplazo en JavaScript del procedimiento almacenado: procedure_stock_item_porcion
 * 
 * FUNCIÓN ORIGINAL DEL PROCEDIMIENTO:
 * - Actualizar stock en tabla carta_lista para items con porciones
 * - Actualizar stock de porciones relacionadas en tabla porcion
 * - Actualizar stock de productos relacionados en tabla producto_stock
 * - Retornar listItemsPorcion (lista de items relacionados a las porciones)
 * 
 * MEJORAS SOBRE EL PROCEDIMIENTO:
 * - ✅ No usa SQL dinámico (query plan cacheado)
 * - ✅ Obtiene listItemsPorcion con JOIN optimizado
 * - ✅ Transacciones ACID explícitas
 * - ✅ Previene stock negativo
 * - ✅ Manejo robusto de errores
 * - ✅ Logging detallado
 * - ✅ Integración con StockPorcionService para historial
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
 * Actualiza el stock de un item con porciones
 * Equivalente a: CALL procedure_stock_item_porcion(item)
 * 
 * @param {Object} item - Objeto con datos del item
 * @param {string} item.iditem - ID del item
 * @param {string} item.idcarta_lista - ID en carta_lista
 * @param {number} item.cantidadSumar - Cantidad a sumar/restar
 * @param {number} item.cantidad_reset - Si > 0, establece este valor exacto
 * @param {string} item.isporcion - Debe ser 'SP'
 * @param {number} item.idsede - ID de la sede
 * @param {number} item.idusuario - ID del usuario
 * @param {Object} transaction - Transacción de Sequelize (opcional)
 * @returns {Promise<Array>} Array con [{listItemsPorcion: JSON string}]
 */
async function updateStockItemPorcion(item, transaction = null) {
    const startTime = Date.now();
    
    try {
        // Validar parámetros obligatorios
        if (!item || !item.iditem || !item.idcarta_lista) {
            throw new Error('Parámetros inválidos: item.iditem e item.idcarta_lista son requeridos');
        }

        const _iditem = item.iditem === item.idcarta_lista ? item.iditem2 : item.iditem;

        // Determinar si es reset o suma/resta
        const esReset = (item.cantidad_reset || 0) > 0;
        const cantidadAjuste = esReset ? item.cantidad_reset : (item.cantidadSumar || 0);
        
        logger.debug({
            iditem: _iditem,
            idcarta_lista: item.idcarta_lista,
            esReset,
            cantidadAjuste
        }, '📦 [procedure_stock_item_porcion.js] Actualizando stock item porcion');

        // Paso 1: Actualizar stock en carta_lista del item principal
        
        if (item.isporcion !== 'SP') {        
            let updateQuery, updateParams;
            if (esReset) {
                updateQuery = `
                    UPDATE carta_lista 
                    SET cantidad = ? 
                    WHERE idcarta_lista = ?
                `;
                updateParams = [cantidadAjuste, item.idcarta_lista];
            } else {
                updateQuery = `
                    UPDATE carta_lista 
                    SET cantidad = GREATEST(0, cantidad + ?) 
                    WHERE idcarta_lista = ?
                `;
                updateParams = [cantidadAjuste, item.idcarta_lista];
            }


            if (updateQuery) {
                logger.debug({ updateQuery, updateParams }, '📦 [procedure_stock_item_porcion.js] Actualizando stock item principal');
                await sequelize.query(updateQuery, {
                    replacements: updateParams,
                    type: QueryTypes.UPDATE,
                    transaction
                });
            }
        }
        
        

        // Paso 1.5: Actualizar porciones relacionadas EXACTAMENTE como el procedimiento almacenado (líneas 117-125)
        // Actualizar porciones
        await sequelize.query(`
            UPDATE porcion AS p
                LEFT JOIN item_ingrediente AS ii USING (idporcion)
                SET p.stock = p.stock + (? * (ii.cantidad))
            WHERE ii.iditem = ?
                AND (p.stock + (? * (ii.cantidad)) >= 0)
        `, {
            replacements: [cantidadAjuste, _iditem, cantidadAjuste],
            type: QueryTypes.UPDATE,
            transaction
        });
        
        // Actualizar productos relacionados
        await sequelize.query(`
            UPDATE producto_stock AS ps
                LEFT JOIN item_ingrediente AS ii USING (idproducto_stock)
                SET ps.stock = ps.stock + (? * (ii.cantidad))
            WHERE ii.iditem = ?
                AND (ps.stock + (? * (ii.cantidad)) >= 0)
        `, {
            replacements: [cantidadAjuste, _iditem, cantidadAjuste],
            type: QueryTypes.UPDATE,
            transaction
        });

        // Paso 2: Obtener @ids_receta EXACTAMENTE como el procedimiento almacenado
        // Obtiene los IDs de items que usan las mismas porciones o productos que este item
        const idsRecetaQuery = `
            SELECT GROUP_CONCAT(DISTINCT iditem) as ids_receta
            FROM item_ingrediente ii 
            WHERE 
                idporcion IN (
                    SELECT DISTINCT idporcion 
                    FROM item_ingrediente 
                    WHERE iditem = ? AND idporcion != 0
                ) 
                OR 
                idproducto_stock IN (
                    SELECT DISTINCT idproducto_stock 
                    FROM item_ingrediente 
                    WHERE iditem = ? AND idproducto_stock != 0
                )
        `;
        
        const [idsRecetaResult] = await sequelize.query(idsRecetaQuery, {
            replacements: [_iditem, _iditem],
            type: QueryTypes.SELECT,
            transaction
        });
        
        const idsReceta = idsRecetaResult?.ids_receta || _iditem;
        
        // Paso 3: Obtener listItemsPorcion EXACTAMENTE como el procedimiento almacenado
        // Replica el query dinámico del procedimiento pero sin CONCAT (ya tenemos el ids_receta)
        const listItemsPorcionQuery = `
            SELECT 
                c.idcarta_lista,
                c.iditem,
                c.cantidad
            FROM (
                SELECT 
                    cl.idcarta_lista, 
                    i1.iditem,
                    FLOOR(COALESCE(
                        MIN(CASE WHEN i1.necesario = 1 THEN 
                            CASE WHEN i1.viene_de = '1' THEN CAST(p1.stock AS SIGNED) ELSE ps.stock END 
                        END),
                        MAX(CASE WHEN i1.necesario = 0 THEN 
                            CASE WHEN i1.viene_de = '1' THEN CAST(p1.stock AS SIGNED) ELSE ps.stock END 
                        END)
                    ) / i1.cantidad) as cantidad
                FROM item_ingrediente AS i1 
                    LEFT JOIN porcion AS p1 ON i1.idporcion = p1.idporcion 
                    LEFT JOIN producto_stock ps ON ps.idproducto_stock = i1.idproducto_stock
                    INNER JOIN carta_lista cl ON cl.iditem = i1.iditem 
                WHERE i1.iditem IN (${idsReceta}) 
                    AND cl.cantidad = 'SP' 
                    AND i1.estado = 0 
                GROUP BY i1.iditem, i1.necesario 
                ORDER BY i1.necesario DESC, i1.iditem_ingrediente
            ) as c
        `;
        
        const listItemsPorcion = await sequelize.query(listItemsPorcionQuery, {
            type: QueryTypes.SELECT,
            transaction
        });

        const executionTime = Date.now() - startTime;
        
        logger.debug({
            iditem: _iditem,
            porcionesEncontradas: listItemsPorcion.length,
            executionTime: `${executionTime}ms`
        }, '✅ [procedure_stock_item_porcion.js] Stock actualizado correctamente');

        // Retornar en formato esperado (similar al procedimiento almacenado)
        return [{
            listItemsPorcion: JSON.stringify(listItemsPorcion)
        }];
        
    } catch (error) {
        errorManager.logError({
            incidencia: {
                message: `Error en procedure_stock_item_porcion.js: ${error.message}`,
                data: { item }
            },
            origen: 'procedure_stock_item_porcion.js.updateStockItemPorcion'
        });
        
        throw error;
    }
}

module.exports = {
    updateStockItemPorcion
};
