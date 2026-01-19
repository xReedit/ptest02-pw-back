/**
 * item.service.v1.js
 * Versión refactorizada del servicio de items que utiliza la configuración optimizada
 * de Sequelize para alta concurrencia con pool de conexiones y reintentos automáticos.
 */

// Importar servicios refactorizados
const QueryServiceV1 = require('./query.service.v1');
const errorManager = require('./error.manager');
const porcionMovementsService = require('./porcion.movements.service');
const StockPorcionService = require('./stock.porcion.service');
const { sequelize, QueryTypes } = require('../config/database');
const logger = require('../utilitarios/logger');

// 🆕 Importar reemplazos de procedimientos almacenados
const { updateStockItem } = require('./procedure_stock_item');
const { updateStockItemPorcion } = require('./procedure_stock_item_porcion');
const { updateStockAllSubitems } = require('./procedure_stock_all_subitems');

// console.log('🟣 item.service.v1.js cargado - Versión refactorizada activa');

class ItemService {
    /**
     * Procesa un item para obtener su información actualizada
     * @param {Object} item - Item a procesar
     * @param {String} idsede - ID de la sede
     * @returns {Promise<Array>} - Resultado del procesamiento
     */
    static async processItem(item, idsede) {
        // console.log('🔸 [item.v1] processItem - INICIO', { 
        //     iditem: item?.iditem, 
        //     idcarta_lista: item?.idcarta_lista,
        //     isporcion: item?.isporcion
        // });
        
        let result = [{
            cantidad: null,
            listItemsPorcion: null,
            listSubItems: null
        }];

        // Sanitizar el objeto item para evitar errores de referencia
        logger.debug({ item }, '🟣 [item.v1] Item recibido');
        const _item = {
            iditem: item.iditem || null,
            idcarta_lista: item.idcarta_lista || null,
            cantidad_reset: item.cantidad_reset || 0,
            cantidadSumar: item.cantidadSumar || 0,
            isporcion: item.isporcion || null,
            iditem2: item.iditem2 || item.iditem || null
        };

        logger.debug({ item: _item }, '🟡 [item.v1] Item procesado');
        
        let updatedItem;

        // cambio para evitar que idcarta_lista sea null y no se registre la venta
        _item.idcarta_lista = _item.idcarta_lista ? _item.idcarta_lista : _item.iditem;
        
        try {  
            // Validar campos obligatorios
            if (!_item.iditem || !_item.idcarta_lista) {
                logger.error({ item: _item }, '❌ [item.v1] Campos obligatorios faltantes');
                errorManager.logError({
                    incidencia: { 
                        message: 'Campos obligatorios faltantes en processItem', 
                        data: { item: _item }
                    },
                    origen: 'ItemService.v1.processItem.validation'
                });
                return result;
            }
            
            // console.log('📦 [item.v1] Llamando a procedure_stock_item.js');
            
            // 🆕 NUEVO: Usar función JavaScript que reemplaza el procedimiento almacenado
            // Ejecutar dentro de una transacción para garantizar atomicidad
            updatedItem = await QueryServiceV1.ejecutarTransaccion(async (transaction) => {
                return await updateStockItem(_item, idsede, transaction);
            });


            logger.debug({ updatedItem }, '🟢 [item.v1] Item actualizado ?=?====');

            // // registrar movimiento
            // logger.info({
            //     tipo_movimiento: 'resta',
            //     cantidad: item.cantidadSumar,
            //     idusuario: item.idusuario,
            //     idporcion: item.idporcion,
            //     idsede: item.idsede,
            //     estado: item.estado,
            //     stock_total: item.stock_total,
            //     idtipo_movimiento_stock: item.idtipo_movimiento_stock,
            //     idpedido: item.idpedido,
            //     iditem: item.iditem
            // }, 'Registrando movimiento de stock');
            // porcionMovementsService.guardarMovimientoPorcion({
            //     tipo_movimiento: 'resta',
            //     cantidad: item.cantidadSumar,
            //     idusuario: item.idusuario,
            //     idporcion: item.idporcion,
            //     idsede: item.idsede,
            //     estado: item.estado,
            //     stock_total: item.stock_total,
            //     idtipo_movimiento_stock: item.idtipo_movimiento_stock,
            //     idpedido: item.idpedido,
            //     iditem: item.iditem
            // });
            
            // console.log('✅ [item.v1] procedure_stock_item completado exitosamente');
            
            // Procesar el resultado
            if (updatedItem && updatedItem[0] && updatedItem[0].cantidad !== undefined && !isNaN(updatedItem[0].cantidad)) {
                result[0].cantidad = parseFloat(updatedItem[0].cantidad);
                
            } else {
                // updatedItem[0].cantidad = 0; 
                result[0].cantidad = 'ND';
                return result;
            }
            
            // Si es un item con porciones, obtener información adicional
            if (_item.isporcion === 'SP') {
                // console.log('🔍 [item.v1] Item con porciones, obteniendo subitems');
                
                // Obtener porciones del item usando transacción para manejar deadlocks
                await QueryServiceV1.ejecutarTransaccion(async (transaction) => {
                    const listItemsPorcionQuery = `
                        SELECT 
                            ip.idporcion,
                            p.descripcion,
                            ip.iditem_porcion,
                            ip.idproducto,
                            ip.is_active
                        FROM item_porcion ip
                        INNER JOIN porcion p ON ip.idporcion = p.idporcion
                        WHERE ip.iditem = :iditem AND ip.is_active = 1
                    `;
                    
                    const listItemsPorcion = await sequelize.query(listItemsPorcionQuery, {
                        replacements: { iditem: _item.iditem },
                        type: QueryTypes.SELECT,
                        transaction
                    });
                    
                    result[0].listItemsPorcion = listItemsPorcion;
                    
                    // Obtener subitems para cada porción
                    if (listItemsPorcion && listItemsPorcion.length > 0) {
                        const listSubItems = [];
                        
                        for (const porcion of listItemsPorcion) {
                            const subItemsQuery = `
                                SELECT 
                                    ips.iditem_subitem,
                                    ips.idporcion,
                                    ips.idproducto,
                                    ips.idcarta_lista,
                                    ips.precio,
                                    ips.is_active,
                                    cl.cantidad,
                                    p.descripcion as producto_descripcion
                                FROM item_porcion_subitem ips
                                INNER JOIN carta_lista cl ON ips.idcarta_lista = cl.idcarta_lista
                                INNER JOIN producto p ON cl.idproducto = p.idproducto
                                WHERE ips.idporcion = :idporcion
                                AND ips.idproducto = :idproducto
                                AND ips.is_active = 1
                            `;
                            
                            const subItems = await sequelize.query(subItemsQuery, {
                                replacements: { 
                                    idporcion: porcion.idporcion,
                                    idproducto: porcion.idproducto
                                },
                                type: QueryTypes.SELECT,
                                transaction
                            });
                            
                            if (subItems && subItems.length > 0) {
                                listSubItems.push(...subItems);
                            }
                        }
                        
                        result[0].listSubItems = listSubItems;
                    }
                });
            }
            
            // console.log('✅ [item.v1] processItem completado exitosamente');
            return result;
            
        } catch (error) {
            logger.error({ error, item }, '❌ [item.v1] Error en processItem');
            
            errorManager.logError({
                incidencia: { 
                    message: `Error en processItem: ${error.message}`, 
                    data: { item, error: error.toString() }
                },
                origen: 'ItemService.v1.processItem'
            });
            
            return result;
        }
    }

    /**
     * Obtiene información completa de un item
     * @param {Object} params - Parámetros de búsqueda
     * @returns {Promise<Array>} - Información del item
     */
    static async getItemInfo(params) {
        // console.log('🔸 [item.v1] getItemInfo - INICIO', params);
        
        try {
            // Validar parámetros obligatorios
            if (!params.iditem) {
                logger.error({ params }, '❌ [item.v1] ID de item no proporcionado');
                return [];
            }
            
            // Consultar información del item usando la versión refactorizada de QueryService
            const query = `
                SELECT 
                    i.iditem,
                    i.descripcion,
                    i.isporcion,
                    i.islicor,
                    i.idcategoria,
                    i.precio,
                    i.is_active,
                    i.is_combo
                FROM item i
                WHERE i.iditem = :iditem
            `;
            
            const result = await QueryServiceV1.emitirRespuesta(query, {
                iditem: params.iditem
            });
            
            // console.log('✅ [item.v1] getItemInfo completado');
            return result;
            
        } catch (error) {
            logger.error({ error, params }, '❌ [item.v1] Error en getItemInfo');
            
            errorManager.logError({
                incidencia: { 
                    message: `Error en getItemInfo: ${error.message}`, 
                    data: { params, error: error.toString() }
                },
                origen: 'ItemService.v1.getItemInfo'
            });
            
            return [];
        }
    }
    
    /**
     * Procesa un item con porciones
     * @param {Object} item - Item a procesar
     * @returns {Promise<Array>} - Resultado del procesamiento
     */
    static async processItemPorcion(item) {
        // console.log('🔸 [item.v1] processItemPorcion - INICIO', { 
        //     iditem: item?.iditem,
        //     idcarta_lista: item?.idcarta_lista
        // });

        // console.log('item processItemPorcion ===', item);
        
        let result = [{
            cantidad: null,
            listItemsPorcion: null,
            listSubItems: null
        }];

        // Sanitizar los ID y manejar valores por defecto
        item.idcarta_lista = item.idcarta_lista || item.iditem;
        item.iditem2 = item.iditem2 || item.iditem;
        let _idItemUpdate = item.iditem === item.idcarta_lista ? item.iditem2 : item.iditem;
        
        // console.log('🟡 [item.v1] IDs procesados:', { 
        //     iditem: item.iditem, 
        //     idcarta_lista: item.idcarta_lista, 
        //     iditem2: item.iditem2,
        //     _idItemUpdate
        // });
        
        let updatedItem; 
        let _itemProcessPorcion = {};
        
        try { 
            // Preparar objeto para procedimiento almacenado
            _itemProcessPorcion = {
                iditem: item.iditem,
                idcarta_lista: item.idcarta_lista,
                cantidad_reset: item.cantidad_reset || 0,
                cantidadSumar: item.cantidadSumar || 0,
                isporcion: item.isporcion,
                iditem2: item.iditem2,
                idsede: item.idsede,
                idusuario: item.idusuario
            };
            
            // Validar que el objeto no sea null
            if (!_itemProcessPorcion) {
                logger.error({ item }, '❌ [item.v1] _itemProcessPorcion es null o undefined');
                errorManager.logError({
                    incidencia: {
                        message: '_itemProcessPorcion es null o undefined',
                        data: { item }
                    },
                    origen: 'ItemService.v1.processItemPorcion.validation'
                });
                
                // Retornar fallback
                const cantidadFallback = Math.max(0, (item.cantidad || 0) - (item.cantidadSumar || 0));
                result[0] = {
                    cantidad: cantidadFallback,
                    listItemsPorcion: [],
                    listSubItems: []
                };
                return result;
            }
            
            // console.log('📦 [item.v1] Llamando a procedure_stock_item_porcion.js');
            
            // 🆕 NUEVO: Usar función JavaScript que reemplaza el procedimiento almacenado
            logger.info({ item: _itemProcessPorcion }, '📦 [item.v1] Llamando a procedure_stock_item_porcion.js');
            updatedItem = await QueryServiceV1.ejecutarTransaccion(async (transaction) => {
                return await updateStockItemPorcion(_itemProcessPorcion, transaction);
            });
            
            // console.log('✅ [item.v1] procedure_stock_item_porcion.js exitoso');
            
            // 🆕 SOLID: Registrar SOLO historial (el stock ya lo actualizó procedure_stock_item_porcion.js)
            // Responsabilidad única: stock.porcion.service.js solo registra historial, no actualiza stock
            try {
                // Solo registrar si hay una operación real
                if (!item.cantidadSumar && !item.cantidad_reset) {
                    // No hay operación, no registrar nada
                    return;
                }

                // Determinar tipo de movimiento:
                // - Si cantidadSumar < 0: VENTA (disminuye stock desde venta)
                // - Si cantidad_reset > 0 o cantidadSumar > 0: VENTA_DEVOLUCION (devuelve/cancela venta, aumenta stock)
                const esSalida = (item.cantidadSumar || 0) < 0;
                const esReset = (item.cantidad_reset || 0) > 0;
                
                let tipoMovimiento;
                // if (esSalida) {
                //     tipoMovimiento = 'VENTA'; // Venta normal (disminuye)
                // } else {
                //     tipoMovimiento = 'VENTA_DEVOLUCION'; // Cancelación/devolución (aumenta)
                // }

                if (esSalida) {
                    tipoMovimiento = 'VENTA';
                } else if (esReset || (item.cantidadSumar > 0)) {
                    // Solo si es reset EXPLÍCITO o cantidadSumar POSITIVA
                    tipoMovimiento = 'VENTA_DEVOLUCION';
                } else {
                    // No hay operación válida, no registrar
                    return;
                }
                
                logger.debug({ 
                    iditem: item.iditem === item.idcarta_lista ? item.iditem2 : item.iditem,
                    cantidadProducto: Math.abs(item.cantidadSumar || item.cantidad_reset || 1),
                    tipoMovimiento: tipoMovimiento
                }, '📦 [item.v1] Llamando a registrarSoloHistorial (SOLID)');
                
                // SOLID: Solo registrar historial, NO actualizar stock (ya lo hizo procedure_stock_item_porcion.js)
                const resultadoPorciones = await StockPorcionService.registrarSoloHistorial({
                    iditem: item.iditem === item.idcarta_lista ? item.iditem2 : item.iditem,
                    cantidadProducto: Math.abs(item.cantidadSumar || item.cantidad_reset || 1),
                    idsede: item.idsede || 1,
                    idusuario: item.idusuario || 1,
                    idpedido: item.idpedido || null,
                    tipoMovimiento: tipoMovimiento,
                    esReset: esReset
                });
                
                if (!resultadoPorciones.success) {
                    logger.warn({ error: resultadoPorciones.error }, '⚠️ [item.v1] No se pudo registrar historial de porciones');
                    // No lanzamos error para no romper el flujo, pero logueamos
                }
            } catch (porcionError) {
                logger.error({ error: porcionError, item }, '❌ [item.v1] Error al registrar historial de porciones');
                // No lanzamos error para mantener compatibilidad
            }

            // Validación defensiva: verificar que updatedItem tenga la estructura esperada
            if (!updatedItem || !Array.isArray(updatedItem) || !updatedItem[0]) {
                logger.error({ updatedItem, item: _itemProcessPorcion }, '❌ [item.v1] procedure_stock_item_porcion retornó resultado inválido');
                
                errorManager.logError({
                    incidencia: {
                        message: 'Procedimiento retornó resultado inválido',
                        data: { item_process: _itemProcessPorcion, res_query: updatedItem }
                    },
                    origen: 'ItemService.v1.processItemPorcion.validation'
                });
                
                // Retornar fallback en lugar de throw
                const cantidadFallback = Math.max(0, (item.cantidad || 0) - (item.cantidadSumar || 0));
                result[0] = {
                    cantidad: cantidadFallback,
                    listItemsPorcion: [],
                    listSubItems: []
                };
                return result;
            }

            // Verificar que listItemsPorcion exista en el resultado
            if (updatedItem[0].listItemsPorcion === undefined) {
                logger.error({ updatedItem, item: _itemProcessPorcion }, '❌ [item.v1] listItemsPorcion no encontrado en resultado del procedimiento');
                
                errorManager.logError({
                    incidencia: {
                        message: 'El procedimiento no retornó listItemsPorcion',
                        data: { item_process: _itemProcessPorcion, res_query: updatedItem }
                    },
                    origen: 'ItemService.v1.processItemPorcion.validation'
                });
                
                // Retornar fallback en lugar de throw
                const cantidadFallback = Math.max(0, (item.cantidad || 0) - (item.cantidadSumar || 0));
                result[0] = {
                    cantidad: cantidadFallback,
                    listItemsPorcion: [],
                    listSubItems: []
                };
                return result;
            }

            // Procesar resultado
            result[0].listItemsPorcion = updatedItem[0].listItemsPorcion;
            
            // Parsear JSON si es necesario
            const listItemsJson = typeof updatedItem[0].listItemsPorcion === 'string' 
                ? JSON.parse(updatedItem[0].listItemsPorcion) 
                : updatedItem[0].listItemsPorcion;
            
            if (listItemsJson && listItemsJson.length > 0) {            
                const itemCantidad = listItemsJson.filter(i => i.iditem == _idItemUpdate);                
                if (itemCantidad && itemCantidad.length > 0) {
                    result[0].cantidad = itemCantidad[0].cantidad;
                    // console.log('🟢 [item.v1] Cantidad actualizada:', result[0].cantidad);
                }
            } else {
                // Fallback en caso de no encontrar el item
                result[0].cantidad = Math.max(0, (item.cantidad || 0) - (item.cantidadSumar || 0));
                // console.log('🟡 [item.v1] Usando cantidad fallback:', result[0].cantidad);
            }
            
            return result;
            
        } catch (error) {
            logger.error({ error, item: _itemProcessPorcion }, '❌ [item.v1] Error en processItemPorcion');
            
            errorManager.logError({
                incidencia: {
                    message: error.message || String(error),
                    data: {
                        item_process: _itemProcessPorcion,
                        query: `call procedure_stock_item_porcion('${JSON.stringify(_itemProcessPorcion)}')`,
                        res_query: updatedItem
                    }
                },
                origen: 'ItemService.v1.processItemPorcion'
            });
            
            // En lugar de throw error, retornar fallback seguro
            logger.warn({ item: _itemProcessPorcion }, '🟡 [item.v1] Usando fallback por error en procedimiento');
            
            // Calcular cantidad usando lógica de fallback
            const cantidadFallback = Math.max(0, (item.cantidad || 0) - (item.cantidadSumar || 0));
            
            result[0] = {
                cantidad: cantidadFallback,
                listItemsPorcion: [],
                listSubItems: []
            };
            
            return result;
        }
    }
    
    /**
     * Procesa todas las actualizaciones de stock para un item con subitems seleccionados
     * Esta función es crucial para items con porciones (SP) y sus subitems
     * @param {Object} allItems - Objeto con todos los items y subitems a procesar
     * @returns {Promise<Array>} - Resultado del procesamiento
     */
    static async processAllItemSubitemSeleted(allItems) {
        // console.log('🔸 [item.v1] processAllItemSubitemSeleted - INICIO', { 
        //     iditem: allItems?.iditem,
        //     idporcion: allItems?.idporcion
        // });
        
        let updatedItem;
        
        try {        
            // Validar objeto de entrada
            if (!allItems || typeof allItems !== 'object') {
                throw new Error('allItems es inválido o no es un objeto');
            }
            
            // console.log('📦 [item.v1] Llamando a procedure_stock_all_subitems.js');
            
            // 🆕 NUEVO: Usar función JavaScript que reemplaza el procedimiento almacenado
            updatedItem = await QueryServiceV1.ejecutarTransaccion(async (transaction) => {
                return await updateStockAllSubitems(allItems, transaction);
            });

            // 🆕 NUEVO: Registrar movimiento SOLO si el subitem tiene idporcion directo
            // Esto cubre el caso de subitems con porciones que NO están en la receta del item principal
            if (allItems.idporcion && allItems.idporcion > 0) {
                try {
                    // Solo registrar si hay una operación real
                    if (!allItems.cantidadSumar && !allItems.cantidad_reset) {
                        // No hay operación, no registrar nada
                        logger.debug({ allItems }, '⚠️ [item.v1] No hay cantidadSumar ni cantidad_reset, omitiendo registro de historial');
                        return updatedItem;
                    }

                    // Determinar tipo de movimiento:
                    // - Si cantidadSumar < 0: VENTA (disminuye stock desde venta)
                    // - Si cantidad_reset > 0 o cantidadSumar > 0: VENTA_DEVOLUCION (devuelve/cancela venta, aumenta stock)
                    const esSalida = (allItems.cantidadSumar || 0) < 0;
                    const esReset = (allItems.cantidad_reset || 0) > 0;
                    
                    let tipoMovimiento;
                    if (esSalida) {
                        tipoMovimiento = 'VENTA';
                    } else if (esReset || (allItems.cantidadSumar > 0)) {
                        // Solo si es reset EXPLÍCITO o cantidadSumar POSITIVA
                        tipoMovimiento = 'VENTA_DEVOLUCION';
                    } else {
                        // No hay operación válida, no registrar
                        logger.debug({ allItems }, '⚠️ [item.v1] No hay operación válida para registrar historial');
                        return updatedItem;
                    }
                    
                    // Registrar directamente esta porción específica
                    await StockPorcionService.registrarMovimientoPorcionDirecta({
                        idporcion: allItems.idporcion,
                        iditem: allItems.iditem || 0,
                        cantidad: Math.abs(allItems.cantidadSumar || allItems.cantidad_reset || 1),
                        idsede: allItems.idsede || 1,
                        idusuario: allItems.idusuario || 1,
                        idpedido: allItems.idpedido || null,
                        tipoMovimiento: tipoMovimiento
                    });
                } catch (porcionError) {
                    logger.error({ error: porcionError, allItems }, '❌ [item.v1] Error al registrar movimiento de porción directa');
                }
            }
            
            // console.log('✅ [item.v1] procedure_stock_all_subitems exitoso', updatedItem);
            return updatedItem;
            
        } catch (error) {
            logger.error({ error, allItems }, '❌ [item.v1] Error en processAllItemSubitemSeleted');
            
            errorManager.logError({
                incidencia: {
                    message: error.message || String(error),
                    data: {
                        item_process: allItems,                    
                        query: `call procedure_stock_all_subitems('${JSON.stringify(allItems)}')`,
                        res_query: updatedItem
                    }
                },
                origen: 'ItemService.v1.processAllItemSubitemSeleted'            
            });
            
            throw error;
        }
    }
}

module.exports = ItemService;
