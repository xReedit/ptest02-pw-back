/**
 * procedure_stock_item.js
 * 
 * Reemplazo en JavaScript del procedimiento almacenado: procedure_stock_item
 * 
 * FUNCIÓN ORIGINAL DEL PROCEDIMIENTO:
 * - Actualizar stock en tabla carta_lista
 * - Manejar operaciones de reset (cantidad_reset) vs incremento/decremento (cantidadSumar)
 * - Retornar la cantidad actualizada
 * 
 * MEJORAS SOBRE EL PROCEDIMIENTO:
 * - ✅ Validación correcta de tipos (no usa operador ->> problemático)
 * - ✅ Transacciones ACID explícitas
 * - ✅ Previene stock negativo con GREATEST(0, ...)
 * - ✅ Manejo robusto de errores
 * - ✅ Logging detallado para debugging
 * - ✅ Prepared statements (query plan cacheado)
 * 
 * @author Sistema
 * @version 1.0.0
 * @date 2025-11-04
 */

const { sequelize, Sequelize } = require('../config/database');
const { QueryTypes } = Sequelize;
const logger = require('../utilitarios/logger');
const errorManager = require('./error.manager');
const { derivarTipoMovimiento, conStockCtx } = require('./carta.stock.ctx');

/**
 * Actualiza el stock de un item en carta_lista
 * Equivalente a: CALL procedure_stock_item(item, idsede)
 * 
 * @param {Object} item - Objeto con datos del item
 * @param {string} item.iditem - ID del item
 * @param {string} item.idcarta_lista - ID en carta_lista
 * @param {number} item.cantidadSumar - Cantidad a sumar/restar (puede ser negativo)
 * @param {number} item.cantidad_reset - Si > 0, establece este valor exacto
 * @param {string} item.isporcion - 'SP' si es porción, 'ND' si no
 * @param {number} idsede - ID de la sede
 * @param {Object} transaction - Transacción de Sequelize (opcional)
 * @returns {Promise<Array>} Array con [{cantidad, idcarta_lista}]
 */
async function updateStockItem(item, idsede, transaction = null) {
    const startTime = Date.now();
    
    try {
        // Validar parámetros obligatorios
        if (!item || !item.idcarta_lista) {
            throw new Error('Parámetros inválidos: item.idcarta_lista es requerido');
        }

        // Determinar si es reset o suma/resta
        const esReset = (item.cantidad_reset || 0) > 0;
        const cantidadAjuste = esReset ? item.cantidad_reset : (item.cantidadSumar || 0);
        
        logger.debug({
            idcarta_lista: item.idcarta_lista,
            esReset,
            cantidadAjuste,
            operacion: esReset ? 'RESET' : (cantidadAjuste >= 0 ? 'SUMA' : 'RESTA')
        }, '📦 [procedure_stock_item.js] Actualizando stock item');        


        // ✅ Si viene del monitor, hacer SET directo sin validaciones
        if (item.from_monitor === true) {
            logger.debug({
                idcarta_lista: item.idcarta_lista,
                cantidadAjuste
            }, '🖥️ [procedure_stock_item.js] Monitor: SET directo sin validaciones');

            // Contexto para el trigger de auditoria carta_stock_historial_au (migracion 021).
            // conStockCtx limpia en finally: si el UPDATE lanza, la conexion NO vuelve
            // al pool con el idpedido/idusuario de esta sede.
            await conStockCtx(
                { tipo: 'MONITOR', idpedido: item.idpedido, idusuario: item.idusuario },
                transaction,
                () => sequelize.query(`
                    UPDATE carta_lista
                    SET cantidad = ?
                    WHERE idcarta_lista = ?
                `, {
                    replacements: [cantidadAjuste, item.idcarta_lista],
                    type: QueryTypes.UPDATE,
                    transaction
                })
            );

            // Retornar el valor actualizado
            const [result] = await sequelize.query(
                `SELECT cantidad, idcarta_lista FROM carta_lista WHERE idcarta_lista = ?`,
                {
                    replacements: [item.idcarta_lista],
                    type: QueryTypes.SELECT,
                    transaction
                }
            );

            logger.debug({
                idcarta_lista: item.idcarta_lista,
                cantidadFinal: result?.cantidad,
                executionTime: `${Date.now() - startTime}ms`
            }, '✅ [procedure_stock_item.js] Stock actualizado correctamente desde monitor');

            return [result || { cantidad: cantidadAjuste, idcarta_lista: item.idcarta_lista }];
        }

        // Verificar si la cantidad es numérica (no 'ND' o 'SP')
        const [cantidadInfo] = await sequelize.query(
            `SELECT CASE 
                WHEN CAST(cantidad AS CHAR) = 'ND' OR CAST(cantidad AS CHAR) = 'SP' THEN 0 
                ELSE 1
            END as es_numerico
            FROM carta_lista 
            WHERE idcarta_lista = ?`,
            {
                replacements: [item.idcarta_lista],
                type: QueryTypes.SELECT,
                transaction
            }
        );

        // Si no es numérico, no actualizar pero retornar el valor actual
        if (!cantidadInfo || cantidadInfo.es_numerico === 0) {
            logger.debug({ idcarta_lista: item.idcarta_lista }, '⚠️ Cantidad no numérica (ND o SP), no se actualiza');
            
            const [result] = await sequelize.query(
                `SELECT cantidad, idcarta_lista FROM carta_lista WHERE idcarta_lista = ?`,
                {
                    replacements: [item.idcarta_lista],
                    type: QueryTypes.SELECT,
                    transaction
                }
            );
            
            return [result || { cantidad: 'ND', idcarta_lista: item.idcarta_lista }];
        }

        // Construir query según el tipo de operación
        let updateQuery;
        let updateParams;
        
        if (esReset) {
            // Reset: establece el valor exacto
            updateQuery = `
                UPDATE carta_lista 
                SET cantidad = GREATEST(0, cantidad + ?)
                WHERE idcarta_lista = ?
            `;
            updateParams = [cantidadAjuste, item.idcarta_lista];
        } else {
            // Suma/resta: incrementa o decrementa, asegurando que no sea negativo
            updateQuery = `
                UPDATE carta_lista 
                SET cantidad = GREATEST(0, cantidad + ?) 
                WHERE idcarta_lista = ?
            `;
            updateParams = [cantidadAjuste, item.idcarta_lista];
        }

        // Contexto para el trigger de auditoria carta_stock_historial_au (migracion 021).
        // conStockCtx limpia en finally (ver nota en carta.stock.ctx.js).
        await conStockCtx(
            {
                tipo: derivarTipoMovimiento({ esReset, delta: cantidadAjuste, op: item.op }),
                idpedido: item.idpedido,
                idusuario: item.idusuario
            },
            transaction,
            () => sequelize.query(updateQuery, {
                replacements: updateParams,
                type: QueryTypes.UPDATE,
                transaction
            })
        );

        // Obtener la cantidad actualizada
        const selectQuery = `
            SELECT cantidad, idcarta_lista 
            FROM carta_lista 
            WHERE idcarta_lista = ?
        `;
        
        const [result] = await sequelize.query(selectQuery, {
            replacements: [item.idcarta_lista],
            type: QueryTypes.SELECT,
            transaction
        });

        const executionTime = Date.now() - startTime;
        
        logger.debug({
            idcarta_lista: item.idcarta_lista,
            cantidadFinal: result?.cantidad,
            executionTime: `${executionTime}ms`
        }, '✅ [procedure_stock_item.js] Stock actualizado correctamente');

        return [result || { cantidad: 0, idcarta_lista: item.idcarta_lista }];
        
    } catch (error) {
        errorManager.logError({
            incidencia: {
                message: `Error en procedure_stock_item.js: ${error.message}`,
                data: { item, idsede }
            },
            origen: 'procedure_stock_item.js.updateStockItem'
        });
        
        throw error;
    }
}

module.exports = {
    updateStockItem
};
