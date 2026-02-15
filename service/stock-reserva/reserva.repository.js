/**
 * reserva.repository.js
 * 
 * Capa de acceso a datos para reservas de stock
 * Principio SOLID: 
 *   - Single Responsibility: Solo operaciones de BD
 *   - Dependency Inversion: Abstrae el acceso a datos
 */

const { sequelize, Sequelize } = require('../../config/database');
const { QueryTypes } = Sequelize;
const logger = require('../../utilitarios/logger');
const CONFIG = require('./reserva.config');

class ReservaRepository {

    /**
     * Obtener configuración de columnas para un tipo
     */
    static getConfig(tipo) {
        return CONFIG.COLUMNAS[tipo] || null;
    }

    /**
     * Agregar cantidad a reserva (INSERT ON DUPLICATE KEY UPDATE)
     */
    static async agregar(tipo, id, cantidad, idsede, transaction = null) {
        const config = this.getConfig(tipo);
        if (!config || !id || id <= 0 || !cantidad || cantidad <= 0) {
            return { success: true, skipped: true };
        }

        try {
            await sequelize.query(`
                INSERT INTO stock_reserva (idsede, ${config.id}, cantidad)
                VALUES (?, ?, ?)
                ON DUPLICATE KEY UPDATE 
                    cantidad = cantidad + VALUES(cantidad)
            `, {
                replacements: [idsede, id, cantidad],
                type: QueryTypes.INSERT,
                transaction
            });

            return { success: true, cantidadReservada: cantidad };
        } catch (error) {
            logger.error({ error: error.message, tipo, id }, '❌ [ReservaRepo] Error agregando');
            return { success: false, error: error.message };
        }
    }

    /**
     * Obtener solo la cantidad reservada de un elemento
     */
    static async getCantidadReservada(tipo, id, idsede) {
        const config = this.getConfig(tipo);
        if (!config || !id) return 0;

        try {
            const [result] = await sequelize.query(`
                SELECT COALESCE(cantidad, 0) as cantidad
                FROM stock_reserva
                WHERE idsede = ? AND ${config.id} = ?
            `, {
                replacements: [idsede, id],
                type: QueryTypes.SELECT
            });

            return parseFloat(result?.cantidad) || 0;
        } catch (error) {
            logger.error({ error: error.message, tipo, id }, '❌ [ReservaRepo] Error obteniendo reserva');
            return 0;
        }
    }

    /**
     * Quitar cantidad de reserva
     */
    static async quitar(tipo, id, cantidad, idsede, transaction = null) {
        const config = this.getConfig(tipo);
        
        logger.debug({
            tipo, id, cantidad, idsede,
            config: config ? config.id : 'NO_CONFIG',
            validId: id && id > 0,
            validCantidad: cantidad && cantidad > 0
        }, '🔄 [ReservaRepo] Intentando quitar reserva');

        if (!config || !id || id <= 0 || !cantidad || cantidad <= 0) {
            logger.warn({
                tipo, id, cantidad, idsede,
                reason: !config ? 'NO_CONFIG' : (!id || id <= 0) ? 'INVALID_ID' : 'INVALID_CANTIDAD'
            }, '⚠️ [ReservaRepo] Quitar saltado por validación');
            return { success: true, skipped: true };
        }

        try {
            const query = `
                UPDATE stock_reserva 
                SET cantidad = GREATEST(0, cantidad - ?)
                WHERE idsede = ? AND ${config.id} = ?
            `;
            
            logger.debug({
                query,
                replacements: [cantidad, idsede, id]
            }, '🔄 [ReservaRepo] Ejecutando UPDATE');

            const [, metadata] = await sequelize.query(query, {
                replacements: [cantidad, idsede, id],
                type: QueryTypes.UPDATE,
                transaction
            });

            logger.debug({
                affectedRows: metadata?.affectedRows || metadata || 0
            }, '✅ [ReservaRepo] Reserva quitada');

            return { success: true, affectedRows: metadata?.affectedRows || 0 };
        } catch (error) {
            logger.error({ error: error.message, tipo, id }, '❌ [ReservaRepo] Error quitando');
            return { success: false, error: error.message };
        }
    }

    /**
     * Confirmar reserva: descuenta stock real Y resta de reserva
     */
    static async confirmar(tipo, id, cantidad, idsede, transaction = null) {
        const config = this.getConfig(tipo);
        if (!config || !id || id <= 0 || !cantidad || cantidad <= 0) {
            return { success: true, skipped: true };
        }

        try {
            // 1. Descontar del stock real
            const whereClause = tipo === 'porcion' ? `${config.pk} = ? AND idsede = ?` : `${config.pk} = ?`;
            const replacements = tipo === 'porcion' ? [cantidad, id, idsede] : [cantidad, id];

            await sequelize.query(`
                UPDATE ${config.tabla} 
                SET ${config.stock} = GREATEST(0, ${config.stock} - ?)
                WHERE ${whereClause}
            `, {
                replacements,
                type: QueryTypes.UPDATE,
                transaction
            });

            // 2. Restar de la reserva
            await sequelize.query(`
                UPDATE stock_reserva 
                SET cantidad = GREATEST(0, cantidad - ?)
                WHERE idsede = ? AND ${config.id} = ?
            `, {
                replacements: [cantidad, idsede, id],
                type: QueryTypes.UPDATE,
                transaction
            });

            // 3. Obtener stock actualizado
            const selectWhere = tipo === 'porcion' ? `${config.pk} = ? AND idsede = ?` : `${config.pk} = ?`;
            const selectRepl = tipo === 'porcion' ? [id, idsede] : [id];

            const [stockResult] = await sequelize.query(`
                SELECT ${config.stock} as stock FROM ${config.tabla}
                WHERE ${selectWhere} LIMIT 1
            `, {
                replacements: selectRepl,
                type: QueryTypes.SELECT,
                transaction
            });

            return { success: true, stockNuevo: stockResult?.stock || 0 };
        } catch (error) {
            logger.error({ error: error.message, tipo, id }, '❌ [ReservaRepo] Error confirmando');
            return { success: false, error: error.message };
        }
    }

    /**
     * Obtener stock disponible (real - reservado) dividido por cantidadReceta
     * @param {string} tipo - Tipo: 'porcion', 'producto', 'carta_lista'
     * @param {number} id - ID del elemento
     * @param {number} idsede - ID de sede
     * @param {number} cantidadReceta - Cantidad que se consume por venta (default: 1)
     * @returns {Object} {stockTotal, stockReservado, stockDisponible, stockVendible}
     */
    static async getStockDisponible(tipo, id, idsede, cantidadReceta = 1) {
        const config = this.getConfig(tipo);
        if (!config) return { stockTotal: 0, stockReservado: 0, stockDisponible: 0, stockVendible: 0 };

        try {
            let query, replacements;
            
            if (tipo === 'porcion') {
                // Porcion tiene idsede en la tabla principal
                query = `SELECT 
                        t.${config.stock} AS stockTotal,
                        COALESCE(sr.cantidad, 0) AS stockReservado,
                        (t.${config.stock} - COALESCE(sr.cantidad, 0)) AS stockDisponible
                   FROM ${config.tabla} t
                   LEFT JOIN stock_reserva sr ON sr.${config.id} = t.${config.pk} AND sr.idsede = t.idsede
                   WHERE t.${config.pk} = ? AND t.idsede = ?`;
                replacements = [id, idsede];
            } else if (tipo === 'producto_almacen' || tipo === 'producto') {
                // producto_stock NO tiene idsede, solo buscar por idproducto_stock
                query = `SELECT 
                        t.${config.stock} AS stockTotal,
                        COALESCE(sr.cantidad, 0) AS stockReservado,
                        (t.${config.stock} - COALESCE(sr.cantidad, 0)) AS stockDisponible
                   FROM ${config.tabla} t
                   LEFT JOIN stock_reserva sr ON sr.${config.id} = t.${config.pk} AND sr.idsede = ?
                   WHERE t.${config.pk} = ?`;
                replacements = [idsede, id];
            } else {
                // Otros tipos (carta_lista, etc)
                query = `SELECT 
                        t.${config.stock} AS stockTotal,
                        COALESCE(sr.cantidad, 0) AS stockReservado,
                        (t.${config.stock} - COALESCE(sr.cantidad, 0)) AS stockDisponible
                   FROM ${config.tabla} t
                   LEFT JOIN stock_reserva sr ON sr.${config.id} = t.${config.pk} AND sr.idsede = ?
                   WHERE t.${config.pk} = ?`;
                replacements = [idsede, id];
            }

            logger.debug({
                tipo, id, idsede, cantidadReceta,
                replacements
            }, '📦 [ReservaRepo] Obteniendo stock disponible');

            const [result] = await sequelize.query(query, {
                replacements,
                type: QueryTypes.SELECT
            });

            if (!result) {
                return { stockTotal: 0, stockReservado: 0, stockDisponible: 0, stockVendible: 0 };
            }

            // Calcular stock vendible: stock disponible / cantidadReceta
            const stockDisponible = parseFloat(result.stockDisponible) || 0;
            const divisor = parseFloat(cantidadReceta) || 1;
            const stockVendible = Math.floor(stockDisponible / divisor);

            logger.debug({
                stockTotal: result.stockTotal,
                stockReservado: result.stockReservado,
                stockDisponible,
                cantidadReceta: divisor,
                stockVendible
            }, '📊 [ReservaRepo] Stock calculado (disponible/cantidadReceta)');

            return {
                stockTotal: parseFloat(result.stockTotal) || 0,
                stockReservado: parseFloat(result.stockReservado) || 0,
                stockDisponible,
                stockVendible
            };
        } catch (error) {
            logger.error({ error: error.message, tipo, id }, '❌ [ReservaRepo] Error getStockDisponible');
            return { stockTotal: 0, stockReservado: 0, stockDisponible: 0, stockVendible: 0 };
        }
    }

    /**
     * Obtener cantidad reservada
     */
    static async getCantidadReservada(tipo, id, idsede) {
        const config = this.getConfig(tipo);
        if (!config) return 0;

        try {
            const [result] = await sequelize.query(`
                SELECT cantidad FROM stock_reserva
                WHERE idsede = ? AND ${config.id} = ? LIMIT 1
            `, {
                replacements: [idsede, id],
                type: QueryTypes.SELECT
            });
            return result?.cantidad || 0;
        } catch (error) {
            return 0;
        }
    }

    /**
     * Obtener idproducto_stock desde idcarta_lista (para productos de almacén)
     */
    static async getIdProductoStock(idcarta_lista) {
        try {
            const [result] = await sequelize.query(`
                SELECT idproducto_stock 
                FROM carta_lista 
                WHERE idcarta_lista = ?
            `, {
                replacements: [idcarta_lista],
                type: QueryTypes.SELECT
            });

            return result?.idproducto_stock || null;
        } catch (error) {
            logger.error({ error: error.message, idcarta_lista }, '❌ [ReservaRepo] Error obteniendo idproducto_stock');
            return null;
        }
    }

    /**
     * Reset reservas inactivas (cleanup)
     */
    static async resetInactivas(minutos) {
        try {
            const [, metadata] = await sequelize.query(`
                UPDATE stock_reserva 
                SET cantidad = 0
                WHERE fecha_ultima_modificacion < DATE_SUB(NOW(), INTERVAL ? MINUTE)
                AND cantidad > 0
            `, {
                replacements: [minutos],
                type: QueryTypes.UPDATE
            });

            return { success: true, registrosReseteados: metadata?.affectedRows || 0 };
        } catch (error) {
            logger.error({ error: error.message }, '❌ [ReservaRepo] Error en cleanup');
            return { success: false, registrosReseteados: 0 };
        }
    }

    /**
     * Obtener listItemsPorcion con stock disponible
     */
    static async getListItemsPorcionDisponible(iditem, idsede) {
        try {
            // Paso 1: Obtener ids_receta
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
                replacements: [iditem, iditem],
                type: QueryTypes.SELECT
            });
            
            const idsReceta = idsRecetaResult?.ids_receta || iditem;
            
            // Paso 2: Obtener listItemsPorcion con stock disponible
            const listItemsPorcionQuery = `
                SELECT 
                    c.idcarta_lista,
                    c.iditem,
                    c.cantidad
                FROM (
                    SELECT 
                        cl.idcarta_lista, 
                        i1.iditem,
                        ROUND(COALESCE(
                            MIN(CASE WHEN i1.necesario = 1 THEN 
                                CASE WHEN i1.viene_de = '1' 
                                    THEN (p1.stock - COALESCE(sr_p.cantidad, 0))
                                    ELSE (ps.stock - COALESCE(sr_ps.cantidad, 0))
                                END 
                            END),
                            MAX(CASE WHEN i1.necesario = 0 THEN 
                                CASE WHEN i1.viene_de = '1' 
                                    THEN (p1.stock - COALESCE(sr_p.cantidad, 0))
                                    ELSE (ps.stock - COALESCE(sr_ps.cantidad, 0))
                                END 
                            END)
                        ) / i1.cantidad, 2) as cantidad
                    FROM item_ingrediente AS i1 
                        LEFT JOIN porcion AS p1 ON i1.idporcion = p1.idporcion 
                        LEFT JOIN producto_stock ps ON ps.idproducto_stock = i1.idproducto_stock
                        LEFT JOIN stock_reserva sr_p ON sr_p.idporcion = p1.idporcion AND sr_p.idsede = ?
                        LEFT JOIN stock_reserva sr_ps ON sr_ps.idproducto_stock = ps.idproducto_stock AND sr_ps.idsede = ?
                        INNER JOIN carta_lista cl ON cl.iditem = i1.iditem 
                    WHERE i1.iditem IN (${idsReceta}) 
                        AND cl.cantidad = 'SP' 
                        AND i1.estado = 0 
                    GROUP BY i1.iditem, i1.necesario 
                    ORDER BY i1.necesario DESC, i1.iditem_ingrediente
                ) as c
            `;
            
            return await sequelize.query(listItemsPorcionQuery, {
                replacements: [idsede, idsede],
                type: QueryTypes.SELECT
            });
        } catch (error) {
            logger.error({ error: error.message, iditem }, '❌ [ReservaRepo] Error listItemsPorcion');
            return [];
        }
    }

    /**
     * Obtener ingredientes de subreceta
     */
    static async getIngredientesSubreceta(idsubreceta) {
        try {
            return await sequelize.query(`
                SELECT idporcion, idproducto_stock, cantidad, descripcion
                FROM subreceta_ingrediente 
                WHERE idsubreceta = ? AND estado = 0
            `, {
                replacements: [idsubreceta],
                type: QueryTypes.SELECT
            });
        } catch (error) {
            return [];
        }
    }

    /**
     * Consultar si un item es ND verificando carta_lista
     * @param {string} idcarta_lista - ID del item en carta_lista
     * @returns {Promise<boolean>} - true si es ND, false si tiene cantidad numérica
     */
    static async esItemNDEnCartaLista(idcarta_lista) {
        if (!idcarta_lista) return true; // Sin ID, asumir ND

        try {
            const result = await sequelize.query(`
                SELECT cantidad FROM carta_lista WHERE idcarta_lista = ? LIMIT 1
            `, {
                replacements: [idcarta_lista],
                type: QueryTypes.SELECT
            });

            if (!result || result.length === 0) {
                return true; // No encontrado, asumir ND
            }

            const cantidad = result[0].cantidad;
            
            // Es ND si cantidad es 'ND' o >= 9999
            if (cantidad === 'ND') return true;
            
            const cantidadNum = parseFloat(cantidad);
            if (isNaN(cantidadNum) || cantidadNum >= 9999 || cantidadNum < 1) {
                return true;
            }

            return false; // Tiene cantidad numérica válida
        } catch (error) {
            logger.error({ error: error.message, idcarta_lista }, '❌ [ReservaRepo] Error verificando ND');
            return true; // En error, asumir ND por seguridad
        }
    }
}

module.exports = ReservaRepository;
