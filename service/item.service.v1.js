/**
 * item.service.v1.js
 * Versión refactorizada del servicio de items que utiliza la configuración optimizada
 * de Sequelize para alta concurrencia con pool de conexiones y reintentos automáticos.
 */

// Importar servicios refactorizados
const QueryServiceV1 = require('./query.service.v1');
const errorManager = require('./error.manager');
const { sequelize, Sequelize } = require('../config/database');

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
        const _item = {
            iditem: item.iditem || null,
            idcarta_lista: item.idcarta_lista || null,
            cantidad_reset: item.cantidad_reset || 0,
            cantidadSumar: item.cantidadSumar || 0,
            isporcion: item.isporcion || 'N',
            iditem2: item.iditem2 || item.iditem || null
        };

        console.log('🟡 [item.v1] Item procesado:', _item);
        
        let updatedItem;
        
        try {  
            // Validar campos obligatorios
            if (!_item.iditem || !_item.idcarta_lista) {
                console.error('❌ [item.v1] Campos obligatorios faltantes');
                errorManager.logError({
                    incidencia: { 
                        message: 'Campos obligatorios faltantes en processItem', 
                        data: { item: _item }
                    },
                    origen: 'ItemService.v1.processItem.validation'
                });
                return result;
            }
            
            // console.log('📦 [item.v1] Llamando a procedure_stock_item');
            
            // Usar la versión refactorizada de QueryService para llamar al procedimiento almacenado
            // con manejo de transacciones y reintentos automáticos para deadlocks
            updatedItem = await QueryServiceV1.emitirRespuestaSP('call procedure_stock_item(?, ?)', [
                JSON.stringify(_item),
                idsede
            ]);
            
            // console.log('✅ [item.v1] procedure_stock_item completado exitosamente');
            
            // Procesar el resultado
            if (updatedItem && updatedItem[0] && updatedItem[0].cantidad !== undefined && !isNaN(updatedItem[0].cantidad)) {
                result[0].cantidad = parseFloat(updatedItem[0].cantidad);
                // console.log('🟢 [item.v1] Cantidad actualizada:', result[0].cantidad);
            } else {
                // updatedItem[0].cantidad = 0;
                // console.log('⚠️ [item.v1] No se pudo obtener la cantidad actualizada');
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
                        type: Sequelize.QueryTypes.SELECT,
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
                                type: Sequelize.QueryTypes.SELECT,
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
            console.error('❌ [item.v1] Error en processItem:', error.message);
            
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
                console.error('❌ [item.v1] ID de item no proporcionado');
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
            console.error('❌ [item.v1] Error en getItemInfo:', error.message);
            
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
                iditem2: item.iditem2
            };
            
            // Validar que el objeto no sea null
            if (!_itemProcessPorcion) {
                throw new Error('_itemProcessPorcion es null o undefined');
            }
            
            // console.log('📦 [item.v1] Llamando a procedure_stock_item_porcion');
            
            // Usar la nueva implementación para manejar deadlocks y reintentos
            const jsonParam = JSON.stringify(_itemProcessPorcion);
            updatedItem = await QueryServiceV1.emitirRespuestaSP('call procedure_stock_item_porcion(?)', [jsonParam]);
            
            // console.log('✅ [item.v1] procedure_stock_item_porcion exitoso');

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
                result[0].cantidad = item.cantidad - item.cantidadSumar;
                // console.log('🟡 [item.v1] Usando cantidad fallback:', result[0].cantidad);
            }
            
            return result;
            
        } catch (error) {
            console.error('❌ [item.v1] Error en processItemPorcion:', error.message);
            
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
            
            throw error;
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
            
            // console.log('📦 [item.v1] Llamando a procedure_stock_all_subitems');
            
            // Usar la nueva implementación para manejar deadlocks y reintentos
            updatedItem = await QueryServiceV1.emitirRespuestaSP('call procedure_stock_all_subitems(?)', [
                JSON.stringify(allItems)
            ]);
            
            // console.log('✅ [item.v1] procedure_stock_all_subitems exitoso', updatedItem);
            return updatedItem;
            
        } catch (error) {
            console.error('❌ [item.v1] Error en processAllItemSubitemSeleted:', error.message);
            
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
