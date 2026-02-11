/**
 * stock.unified.service.js
 *
 * Servicio UNIFICADO de stock que procesa TODO el flujo en UNA SOLA transaccion
 * Resuelve el problema de transacciones separadas que causan inconsistencias
 *
 * PROBLEMA ORIGINAL:
 * - processSubitems() usaba transaccion 1
 * - processItemPorcion() usaba transaccion 2
 * - Si 1 completaba pero 2 fallaba = inconsistencia
 *
 * SOLUCION:
 * - Una sola transaccion para todo el flujo
 * - Lock temprano de TODAS las porciones afectadas
 * - Rollback automatico si algo falla
 *
 * @author Sistema
 * @version 2.0.0
 */

const { sequelize, Sequelize } = require('../config/database');
const { QueryTypes } = Sequelize;
const logger = require('../utilitarios/logger');
const errorManager = require('./error.manager');

// Configuracion
const CONFIG = {
    MAX_RETRIES: 3,
    RETRY_DELAY_MS: 100,
    ISOLATION_LEVEL: Sequelize.Transaction.ISOLATION_LEVELS.READ_COMMITTED,
    LOCK_TIMEOUT_MS: 5000
};

/**
 * Servicio unificado de stock
 */
class StockUnifiedService {

    /**
     * Actualiza stock de un item completo (item principal + subitems) en UNA transaccion
     *
     * @param {Object} params
     * @param {Object} params.item - Item a procesar
     * @param {number} params.idsede - ID de la sede
     * @param {string} params.op - Operacion ('0' = venta, '5' = recupera)
     * @returns {Promise<Object>} Resultado de la operacion
     */
    static async updateStockUnificado(params) {
        const startTime = Date.now();
        let attempt = 0;

        const { item, idsede, op } = params;

        // ========================================
        // CALCULAR cantidadSumar SI NO EXISTE
        // ========================================
        if (item.cantidadSumar === undefined || item.cantidadSumar === null) {
            if (item.venta_x_peso === 1) {
                // Venta por peso: descontar la cantidad completa
                item.cantidadSumar = -item.cantidad;
            } else if (item.sumar === true || item.sumar === 'true') {
                // Venta normal: descontar 1
                item.cantidadSumar = -1;
            } else if (item.sumar === false || item.sumar === 0 || item.sumar === '0') {
                // No descontar (ej: cancelacion parcial ya procesada)
                item.cantidadSumar = 0;
            } else {
                // Valor numerico directo
                item.cantidadSumar = parseInt(item.sumar) || 0;
            }

            logger.debug({
                iditem: item.iditem,
                sumar: item.sumar,
                venta_x_peso: item.venta_x_peso,
                cantidadSumar: item.cantidadSumar
            }, '📊 [stock.unified] cantidadSumar calculado');
        }

        // ========================================
        // NORMALIZAR subitems_selected
        // ========================================
        if (!item.subitems_selected_array && item.subitems_selected) {
            item.subitems_selected_array = Array.isArray(item.subitems_selected)
                ? item.subitems_selected
                : Object.values(item.subitems_selected).filter(s => s);
        }

        while (attempt < CONFIG.MAX_RETRIES) {
            attempt++;
            let transaction = null;

            try {
                // Iniciar transaccion unica
                transaction = await sequelize.transaction({
                    isolationLevel: CONFIG.ISOLATION_LEVEL
                });

                logger.debug({
                    iditem: item.iditem,
                    attempt
                }, '🔒 [stock.unified] Iniciando transaccion unica');

                // 1. Obtener TODAS las porciones que seran afectadas
                const porcionesAfectadas = await this._obtenerTodasPorcionesAfectadas(
                    item,
                    idsede,
                    transaction
                );

                // 2. Lock pesimista en TODAS las porciones ANTES de cualquier update
                if (porcionesAfectadas.length > 0) {
                    await this._lockPorciones(porcionesAfectadas, idsede, transaction);
                    logger.debug({
                        count: porcionesAfectadas.length
                    }, '🔐 [stock.unified] Porciones bloqueadas');
                }

                // 3. Procesar subitems (si existen)
                let resultadoSubitems = null;
                if (this._tieneSubitemsValidos(item)) {
                    resultadoSubitems = await this._procesarSubitems(item, idsede, transaction);
                }

                // 4. Procesar item principal
                const resultadoItem = await this._procesarItemPrincipal(item, idsede, op, transaction);

                // 5. Commit de la transaccion
                await transaction.commit();

                const executionTime = Date.now() - startTime;
                logger.debug({
                    iditem: item.iditem,
                    executionTime: `${executionTime}ms`,
                    porcionesAfectadas: porcionesAfectadas.length
                }, '✅ [stock.unified] Transaccion completada');

                return {
                    success: true,
                    resultado: resultadoItem,
                    resultadoSubitems,
                    executionTime,
                    attempt
                };

            } catch (error) {
                // Rollback en caso de error
                if (transaction) {
                    try {
                        await transaction.rollback();
                    } catch (rollbackError) {
                        logger.error({ error: rollbackError }, '❌ Error en rollback');
                    }
                }

                // Detectar si es error recuperable (deadlock, timeout)
                const isDeadlock = this._isDeadlockError(error);
                const isLockTimeout = this._isLockTimeoutError(error);

                if ((isDeadlock || isLockTimeout) && attempt < CONFIG.MAX_RETRIES) {
                    const delay = CONFIG.RETRY_DELAY_MS * attempt;
                    logger.warn({
                        attempt,
                        delay,
                        error: error.message.substring(0, 100)
                    }, '⚠️ [stock.unified] Reintentando por deadlock/timeout');
                    await this._sleep(delay);
                    continue;
                }

                // Error no recuperable
                errorManager.logError({
                    incidencia: {
                        message: `Error en stock unificado: ${error.message}`,
                        data: { item, idsede, op, attempt }
                    },
                    origen: 'StockUnifiedService.updateStockUnificado'
                });

                return {
                    success: false,
                    error: error.message,
                    attempt
                };
            }
        }

        return {
            success: false,
            error: 'Maximo de reintentos alcanzado'
        };
    }

    /**
     * Obtiene TODAS las porciones que seran afectadas por la operacion
     * Incluye: receta del item + subitems + subrecetas
     * @private
     */
    static async _obtenerTodasPorcionesAfectadas(item, idsede, transaction) {
        const porcionesIds = new Set();

        // 1. Porciones de la receta del item principal (si es SP)
        if (item.isporcion === 'SP') {
            const iditem = item.iditem === item.idcarta_lista ? item.iditem2 : item.iditem;

            // Porciones directas de la receta
            const porcionesReceta = await sequelize.query(`
                SELECT DISTINCT ii.idporcion
                FROM item_ingrediente ii
                WHERE ii.iditem = :iditem
                    AND ii.estado = 0
                    AND ii.idporcion > 0
            `, {
                replacements: { iditem },
                type: QueryTypes.SELECT,
                transaction
            });

            porcionesReceta.forEach(p => porcionesIds.add(p.idporcion));

            // Porciones de subrecetas en la receta
            const porcionesSubrecetas = await sequelize.query(`
                SELECT DISTINCT si.idporcion
                FROM item_ingrediente ii
                INNER JOIN subreceta_ingrediente si ON si.idsubreceta = ii.idsubreceta
                WHERE ii.iditem = :iditem
                    AND ii.estado = 0
                    AND ii.viene_de = '3'
                    AND si.idporcion > 0
            `, {
                replacements: { iditem },
                type: QueryTypes.SELECT,
                transaction
            });

            porcionesSubrecetas.forEach(p => porcionesIds.add(p.idporcion));
        }

        // 2. Porciones de subitems_view o subitems_selected
        const subitems = this._extraerSubitemsPlanos(item);
        subitems.forEach(sub => {
            if (sub.idporcion && sub.idporcion > 0) {
                porcionesIds.add(sub.idporcion);
            }
            // Si el subitem tiene subreceta, obtener sus porciones
            if (sub.idsubreceta && sub.idsubreceta > 0) {
                // Las porciones de la subreceta se obtendran en el siguiente query
            }
        });

        // 3. Obtener porciones de subrecetas de subitems
        const subrecetasIds = subitems
            .filter(s => s.idsubreceta && s.idsubreceta > 0)
            .map(s => s.idsubreceta);

        if (subrecetasIds.length > 0) {
            const porcionesDeSubrecetas = await sequelize.query(`
                SELECT DISTINCT idporcion
                FROM subreceta_ingrediente
                WHERE idsubreceta IN (:subrecetasIds)
                    AND estado = 0
                    AND idporcion > 0
            `, {
                replacements: { subrecetasIds },
                type: QueryTypes.SELECT,
                transaction
            });

            porcionesDeSubrecetas.forEach(p => porcionesIds.add(p.idporcion));
        }

        return Array.from(porcionesIds);
    }

    /**
     * Aplica lock pesimista (SELECT FOR UPDATE) en todas las porciones
     * Ordena por ID para evitar deadlocks
     * @private
     */
    static async _lockPorciones(porcionesIds, idsede, transaction) {
        if (!porcionesIds || porcionesIds.length === 0) return;

        // Ordenar IDs para evitar deadlocks (siempre lockear en el mismo orden)
        const idsOrdenados = [...porcionesIds].sort((a, b) => a - b);

        await sequelize.query(`
            SELECT idporcion, stock
            FROM porcion
            WHERE idporcion IN (:ids)
                AND idsede = :idsede
            ORDER BY idporcion
            FOR UPDATE
        `, {
            replacements: { ids: idsOrdenados, idsede },
            type: QueryTypes.SELECT,
            transaction
        });
    }

    /**
     * Extrae subitems de forma plana desde las diferentes estructuras posibles
     * @private
     */
    static _extraerSubitemsPlanos(item) {
        const subitems = [];

        // Desde subitems_view
        if (item.subitems_view && Array.isArray(item.subitems_view)) {
            item.subitems_view.forEach(grupo => {
                const opciones = grupo.subitems || grupo.opciones || [];
                opciones.forEach(opcion => {
                    if (opcion && (opcion.idporcion || opcion.idproducto || opcion.idsubreceta)) {
                        subitems.push(opcion);
                    }
                });
            });
        }

        // Desde subitems_selected
        if (item.subitems_selected) {
            const selected = Array.isArray(item.subitems_selected)
                ? item.subitems_selected
                : Object.values(item.subitems_selected).filter(s => s && typeof s === 'object');

            selected.forEach(sub => {
                if (sub && (sub.idporcion || sub.idproducto || sub.idsubreceta)) {
                    subitems.push(sub);
                }
            });
        }

        return subitems;
    }

    /**
     * Verifica si el item tiene subitems validos para procesar
     * @private
     */
    static _tieneSubitemsValidos(item) {
        const subitems = this._extraerSubitemsPlanos(item);
        return subitems.length > 0;
    }

    /**
     * Procesa los subitems del item
     * @private
     */
    static async _procesarSubitems(item, idsede, transaction) {
        const resultados = [];
        const esReset = (item.cantidad_reset || 0) > 0;
        const esVenta = (item.cantidadSumar || 0) < 0;

        // Determinar fuente de subitems (prioridad: view > selected_array > selected)
        const tieneView = item.subitems_view && Array.isArray(item.subitems_view) && item.subitems_view.length > 0;
        let tieneSelected = item.subitems_selected_array && Array.isArray(item.subitems_selected_array) && item.subitems_selected_array.length > 0;

        // Fallback: usar subitems_selected directamente si no hay subitems_selected_array
        if (!tieneSelected && item.subitems_selected) {
            const selectedArray = Array.isArray(item.subitems_selected)
                ? item.subitems_selected
                : Object.values(item.subitems_selected).filter(s => s && typeof s === 'object');
            if (selectedArray.length > 0) {
                item.subitems_selected_array = selectedArray;
                tieneSelected = true;
            }
        }

        logger.debug({
            iditem: item.iditem,
            tieneView,
            tieneSelected,
            cantidadSumar: item.cantidadSumar,
            esVenta
        }, '🔍 [stock.unified] _procesarSubitems inicio');

        if (!tieneView && !tieneSelected) {
            logger.debug({ iditem: item.iditem }, '⚠️ [stock.unified] No hay subitems para procesar');
            return resultados;
        }

        if (tieneView) {
            for (const grupo of item.subitems_view) {
                if (!grupo) continue;
                const cantidadGrupo = grupo.cantidad_seleccionada || 1;
                const opciones = grupo.subitems || grupo.opciones || [];

                for (const opcion of opciones) {
                    if (!opcion) continue;
                    const tieneStock = opcion.idporcion || opcion.idproducto || opcion.idsubreceta;
                    if (!tieneStock) continue;

                    const descuenta = this._parseDescuenta(opcion.descuenta);
                    const cantidadAjuste = cantidadGrupo * descuenta;
                    const cantidadFinal = esVenta ? -cantidadAjuste : cantidadAjuste;

                    const resultado = await this._actualizarStockSubitem({
                        idporcion: opcion.idporcion,
                        idproducto: opcion.idproducto,
                        idsubreceta: opcion.idsubreceta,
                        cantidad: cantidadFinal,
                        idsede,
                        idusuario: item.idusuario,
                        idpedido: item.idpedido,
                        iditem: item.iditem
                    }, transaction);

                    resultados.push(resultado);
                }
            }
        } else if (tieneSelected) {
            logger.debug({
                iditem: item.iditem,
                totalSubitems: item.subitems_selected_array.length
            }, '📋 [stock.unified] Procesando subitems_selected_array');

            for (const subitem of item.subitems_selected_array) {
                if (!subitem) continue;
                const tieneStock = subitem.idporcion || subitem.idproducto || subitem.idsubreceta;
                if (!tieneStock) {
                    logger.debug({ subitem_des: subitem.des }, '⏭️ [stock.unified] Subitem sin stock, saltando');
                    continue;
                }

                const descuenta = this._parseDescuenta(subitem.descuenta);
                const cantidadSelected = subitem.cantidad_selected || 1;
                const cantidadAjuste = (item.cantidadSumar || 0) * cantidadSelected * descuenta;

                logger.debug({
                    subitem_des: subitem.des,
                    idporcion: subitem.idporcion,
                    idproducto: subitem.idproducto,
                    descuenta,
                    cantidadSelected,
                    cantidadSumar: item.cantidadSumar,
                    cantidadAjuste
                }, '📦 [stock.unified] Procesando subitem');

                const resultado = await this._actualizarStockSubitem({
                    idporcion: subitem.idporcion,
                    idproducto: subitem.idproducto,
                    idsubreceta: subitem.idsubreceta,
                    cantidad: cantidadAjuste,
                    idsede,
                    idusuario: item.idusuario,
                    idpedido: item.idpedido,
                    iditem: item.iditem
                }, transaction);

                resultados.push(resultado);
            }
        }

        return resultados;
    }

    /**
     * Actualiza stock de un subitem individual
     * @private
     */
    static async _actualizarStockSubitem(params, transaction) {
        const { idporcion, idproducto, idsubreceta, cantidad, idsede, idusuario, idpedido, iditem } = params;

        // Caso 1: Es una porcion
        if (idporcion && idporcion > 0) {
            await sequelize.query(`
                UPDATE porcion
                SET stock = GREATEST(0, stock + :cantidad)
                WHERE idporcion = :idporcion AND idsede = :idsede
            `, {
                replacements: { cantidad, idporcion, idsede },
                type: QueryTypes.UPDATE,
                transaction
            });

            // Registrar historial
            const tipoMov = cantidad < 0 ? 'VENTA' : 'VENTA_DEVOLUCION';
            await this._registrarHistorialPorcion({
                idporcion,
                cantidad: Math.abs(cantidad),
                tipoMovimiento: tipoMov,
                idsede,
                idusuario,
                idpedido,
                iditem
            }, transaction);

            return { tipo: 'porcion', idporcion, cantidad };
        }

        // Caso 2: Es un producto
        if (idproducto && idproducto > 0) {
            logger.debug({
                idproducto,
                cantidad
            }, '📦 [stock.unified] Actualizando producto_stock');

            await sequelize.query(`
                UPDATE producto_stock
                SET stock = GREATEST(0, stock + :cantidad)
                WHERE idproducto_stock = :idproducto
            `, {
                replacements: { cantidad, idproducto },
                type: QueryTypes.UPDATE,
                transaction
            });

            return { tipo: 'producto', idproducto, cantidad };
        }

        // Caso 3: Es una subreceta (expandir a sus ingredientes)
        if (idsubreceta && idsubreceta > 0) {
            const ingredientes = await sequelize.query(`
                SELECT idporcion, idproducto_stock, cantidad as cantidadReceta
                FROM subreceta_ingrediente
                WHERE idsubreceta = :idsubreceta
                    AND estado = 0
                    AND (idporcion > 0 OR idproducto_stock > 0)
            `, {
                replacements: { idsubreceta },
                type: QueryTypes.SELECT,
                transaction
            });

            for (const ing of ingredientes) {
                const cantidadIng = cantidad * ing.cantidadReceta;

                if (ing.idporcion > 0) {
                    await sequelize.query(`
                        UPDATE porcion
                        SET stock = GREATEST(0, stock + :cantidad)
                        WHERE idporcion = :idporcion AND idsede = :idsede
                    `, {
                        replacements: { cantidad: cantidadIng, idporcion: ing.idporcion, idsede },
                        type: QueryTypes.UPDATE,
                        transaction
                    });

                    const tipoMov = cantidadIng < 0 ? 'VENTA' : 'VENTA_DEVOLUCION';
                    await this._registrarHistorialPorcion({
                        idporcion: ing.idporcion,
                        cantidad: Math.abs(cantidadIng),
                        tipoMovimiento: tipoMov,
                        idsede,
                        idusuario,
                        idpedido,
                        iditem
                    }, transaction);
                }

                if (ing.idproducto_stock > 0) {
                    await sequelize.query(`
                        UPDATE producto_stock
                        SET stock = GREATEST(0, stock + :cantidad)
                        WHERE idproducto_stock = :idproducto
                    `, {
                        replacements: { cantidad: cantidadIng, idproducto: ing.idproducto_stock },
                        type: QueryTypes.UPDATE,
                        transaction
                    });
                }
            }

            return { tipo: 'subreceta', idsubreceta, ingredientes: ingredientes.length };
        }

        return { tipo: 'none' };
    }

    /**
     * Procesa el item principal (receta SP o item simple)
     * Maneja 3 casos:
     * 1. isporcion === 'SP' -> Actualizar porciones de la receta
     * 2. cantidad numerica -> Actualizar carta_lista directamente
     * 3. cantidad = 'ND' o 'SP' -> No actualizar, solo retornar
     * @private
     */
    static async _procesarItemPrincipal(item, idsede, op, transaction) {
        const esReset = (item.cantidad_reset || 0) > 0;
        const cantidadAjuste = esReset ? item.cantidad_reset : (item.cantidadSumar || 0);
        const _iditem = item.iditem === item.idcarta_lista ? (item.iditem2 || item.iditem) : item.iditem;

        logger.debug({
            iditem: _iditem,
            idcarta_lista: item.idcarta_lista,
            isporcion: item.isporcion,
            cantidadAjuste,
            esReset
        }, '📦 [stock.unified] _procesarItemPrincipal');

        // CASO 1: Si es SP (tiene receta), actualizar porciones de la receta
        if (item.isporcion === 'SP') {
            // Actualizar porciones de la receta
            await sequelize.query(`
                UPDATE porcion AS p
                LEFT JOIN item_ingrediente AS ii USING (idporcion)
                SET p.stock = ROUND(p.stock + (:cantidad * ii.cantidad), 2)
                WHERE ii.iditem = :iditem
                    AND ii.estado = 0
                    AND (p.stock + (:cantidad * ii.cantidad) >= 0)
            `, {
                replacements: { cantidad: cantidadAjuste, iditem: _iditem },
                type: QueryTypes.UPDATE,
                transaction
            });

            // Actualizar productos de la receta
            await sequelize.query(`
                UPDATE producto_stock AS ps
                LEFT JOIN item_ingrediente AS ii USING (idproducto_stock)
                SET ps.stock = ps.stock + (:cantidad * ii.cantidad)
                WHERE ii.iditem = :iditem
                    AND ii.estado = 0
                    AND (ps.stock + (:cantidad * ii.cantidad) >= 0)
            `, {
                replacements: { cantidad: cantidadAjuste, iditem: _iditem },
                type: QueryTypes.UPDATE,
                transaction
            });

            // Registrar historial de porciones afectadas
            const porcionesReceta = await sequelize.query(`
                SELECT ii.idporcion, ii.cantidad as cantidadReceta, p.stock
                FROM item_ingrediente ii
                INNER JOIN porcion p ON ii.idporcion = p.idporcion
                WHERE ii.iditem = :iditem
                    AND ii.estado = 0
                    AND ii.idporcion > 0
            `, {
                replacements: { iditem: _iditem },
                type: QueryTypes.SELECT,
                transaction
            });

            for (const porcion of porcionesReceta) {
                const tipoMov = cantidadAjuste < 0 ? 'VENTA' : 'VENTA_DEVOLUCION';
                await this._registrarHistorialPorcion({
                    idporcion: porcion.idporcion,
                    cantidad: Math.abs(cantidadAjuste * porcion.cantidadReceta),
                    tipoMovimiento: tipoMov,
                    idsede,
                    idusuario: item.idusuario,
                    idpedido: item.idpedido,
                    iditem: _iditem
                }, transaction);
            }
        } else {
            // CASO 2 y 3: Item simple (no SP) - actualizar carta_lista si es numerico

            // Verificar si la cantidad en carta_lista es numerica (no 'ND' o 'SP')
            const [cantidadInfo] = await sequelize.query(`
                SELECT
                    cantidad,
                    CASE
                        WHEN CAST(cantidad AS CHAR) = 'ND' OR CAST(cantidad AS CHAR) = 'SP' THEN 0
                        ELSE 1
                    END as es_numerico
                FROM carta_lista
                WHERE idcarta_lista = :idcarta_lista
            `, {
                replacements: { idcarta_lista: item.idcarta_lista },
                type: QueryTypes.SELECT,
                transaction
            });

            // Si no es numerico (ND o SP), no actualizar - solo retornar
            if (!cantidadInfo || cantidadInfo.es_numerico === 0) {
                logger.debug({
                    idcarta_lista: item.idcarta_lista,
                    cantidad: cantidadInfo?.cantidad
                }, '⚠️ [stock.unified] Cantidad no numerica (ND o SP), no se actualiza');

                return [{
                    cantidad: cantidadInfo?.cantidad || 'ND',
                    listItemsPorcion: '[]'
                }];
            }

            // Cantidad es numerica, actualizar carta_lista
            logger.debug({
                idcarta_lista: item.idcarta_lista,
                cantidadActual: cantidadInfo.cantidad,
                cantidadAjuste,
                esReset
            }, '📦 [stock.unified] Actualizando carta_lista (item con cantidad fija)');

            if (esReset) {
                await sequelize.query(`
                    UPDATE carta_lista
                    SET cantidad = :cantidad
                    WHERE idcarta_lista = :idcarta_lista
                `, {
                    replacements: { cantidad: cantidadAjuste, idcarta_lista: item.idcarta_lista },
                    type: QueryTypes.UPDATE,
                    transaction
                });
            } else {
                await sequelize.query(`
                    UPDATE carta_lista
                    SET cantidad = GREATEST(0, cantidad + :cantidad)
                    WHERE idcarta_lista = :idcarta_lista
                `, {
                    replacements: { cantidad: cantidadAjuste, idcarta_lista: item.idcarta_lista },
                    type: QueryTypes.UPDATE,
                    transaction
                });
            }

            // Obtener cantidad actualizada
            const [cantidadActualizada] = await sequelize.query(`
                SELECT cantidad FROM carta_lista WHERE idcarta_lista = :idcarta_lista
            `, {
                replacements: { idcarta_lista: item.idcarta_lista },
                type: QueryTypes.SELECT,
                transaction
            });

            logger.debug({
                idcarta_lista: item.idcarta_lista,
                cantidadFinal: cantidadActualizada?.cantidad
            }, '✅ [stock.unified] carta_lista actualizada');

            // Retornar directamente para items simples (no necesitan listItemsPorcion)
            return [{
                cantidad: cantidadActualizada?.cantidad || 0,
                listItemsPorcion: '[]'
            }];
        }

        // Obtener listItemsPorcion para retornar (compatibilidad)
        const idsRecetaResult = await sequelize.query(`
            SELECT GROUP_CONCAT(DISTINCT iditem) as ids_receta
            FROM item_ingrediente ii
            WHERE
                idporcion IN (
                    SELECT DISTINCT idporcion
                    FROM item_ingrediente
                    WHERE iditem = :iditem AND idporcion != 0
                )
                OR
                idproducto_stock IN (
                    SELECT DISTINCT idproducto_stock
                    FROM item_ingrediente
                    WHERE iditem = :iditem AND idproducto_stock != 0
                )
        `, {
            replacements: { iditem: _iditem },
            type: QueryTypes.SELECT,
            transaction
        });

        const idsReceta = idsRecetaResult[0]?.ids_receta || _iditem;

        const listItemsPorcion = await sequelize.query(`
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
                            CASE WHEN i1.viene_de = '1' THEN p1.stock ELSE ps.stock END
                        END),
                        MAX(CASE WHEN i1.necesario = 0 THEN
                            CASE WHEN i1.viene_de = '1' THEN p1.stock ELSE ps.stock END
                        END)
                    ) / i1.cantidad, 2) as cantidad
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
        `, {
            type: QueryTypes.SELECT,
            transaction
        });

        return [{
            listItemsPorcion: JSON.stringify(listItemsPorcion)
        }];
    }

    /**
     * Registra movimiento en porcion_historial
     * @private
     */
    static async _registrarHistorialPorcion(params, transaction) {
        const { idporcion, cantidad, tipoMovimiento, idsede, idusuario, idpedido, iditem } = params;

        const tipoMovConfig = {
            'VENTA': { id: 3, nombre: 'VENTA' },
            'VENTA_DEVOLUCION': { id: 6, nombre: 'VENTA DEVOLUCION' },
            'ENTRADA': { id: 1, nombre: 'ENTRADA' },
            'SALIDA': { id: 2, nombre: 'SALIDA' }
        };

        const config = tipoMovConfig[tipoMovimiento] || tipoMovConfig.VENTA;

        // Obtener stock actual
        const [stockActual] = await sequelize.query(
            'SELECT stock FROM porcion WHERE idporcion = :idporcion AND idsede = :idsede',
            {
                replacements: { idporcion, idsede },
                type: QueryTypes.SELECT,
                transaction
            }
        );

        await sequelize.query(`
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
            )
        `, {
            replacements: {
                tipoMovimiento: config.nombre,
                cantidad: Math.abs(cantidad),
                idusuario: idusuario || 1,
                idporcion,
                idsede: idsede || 1,
                stockTotal: stockActual?.stock || 0,
                idtipoMovimiento: config.id,
                idpedido: idpedido || null,
                iditem: iditem || 0
            },
            type: QueryTypes.INSERT,
            transaction
        });
    }

    /**
     * Parsea el valor de descuenta
     * @private
     */
    static _parseDescuenta(descuenta) {
        if (descuenta === undefined || descuenta === null || descuenta === '') {
            return 1;
        }
        const parsed = parseFloat(descuenta);
        if (isNaN(parsed) || !isFinite(parsed) || parsed <= 0) {
            return 1;
        }
        return parsed;
    }

    /**
     * Detecta error de deadlock
     * @private
     */
    static _isDeadlockError(error) {
        return error.code === 'ER_LOCK_DEADLOCK' ||
               (error.message && error.message.includes('Deadlock found'));
    }

    /**
     * Detecta error de timeout de lock
     * @private
     */
    static _isLockTimeoutError(error) {
        return error.code === 'ER_LOCK_WAIT_TIMEOUT' ||
               (error.message && error.message.includes('Lock wait timeout'));
    }

    /**
     * Sleep helper
     * @private
     */
    static _sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

module.exports = StockUnifiedService;
