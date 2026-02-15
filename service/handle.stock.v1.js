/**
 * handle.stock.v1.js
 * Versión refactorizada del manejador de stock con validación robusta y manejo de reintentos
 * 
 * Sistema de reservas por sede:
 *   - Si sede.use_reservas_stock = 1: Usa reservas (stock real solo se descuenta al confirmar pedido)
 *   - Si sede.use_reservas_stock = 0: Descuenta stock real directamente (comportamiento original)
 */

const ResponseService = require('./query.service.v1');
let ItemService = require('./item.service.v1');
const logger = require('../utilitarios/logger');

// Sistema de reservas SOLID
const { StockReservaService, sedeUsaReservas } = require('./stock-reserva');

// Ya NO hay toggle global. La verificación es SOLO por sede (campo use_reservas_stock en tabla sede)
// sedeUsaReservas(idsede) consulta la BD (con caché) para determinar si la sede usa reservas

// Importar el gestor de errores o crearlo si no existe
let errorManager;
try {
    errorManager = require('./error.manager');
} catch (e) {
    // Si no existe, creamos un objeto básico para loggear errores
    errorManager = {
        logError: (data) => {
            logger.error({ data }, 'Error registrado');
        }
    };
}

// console.log('🔴 handle.stock.v1.js cargado - Versión refactorizada activa');

/**
 * Verifica si existen subitems con cantidad y si están relacionados con productos o porciones
 * @param {Object} item - El item a verificar
 * @returns {Boolean} - true si existen subitems válidos, false en caso contrario
 */
const checkExistSubItemsWithCantidad = (item) => {
    // console.log('checkExistSubItemsWithCantidad chequeando');
    if (!item) return false;

    // Verificar si hay subitems_selected
    if (!item.subitems_selected) {
        // console.log('⚠️ No hay subitems_selected');
        return false;
    }

    // Convertir subitems_selected a un array si es un objeto con claves numéricas
    const subitemsArray = Array.isArray(item.subitems_selected)
        ? item.subitems_selected
        : Object.keys(item.subitems_selected)
            .filter(key => !isNaN(parseInt(key))) // Filtrar solo claves numéricas
            .map(key => item.subitems_selected[key]);

    if (subitemsArray.length === 0) {
        // console.log('⚠️ No hay subitems_selected válidos después de la conversión');
        return false;
    }

    // Verificar que al menos un subitem tenga cantidad y esté relacionado con un producto o porción
    const isCheck = subitemsArray.some(subitem => {
        if (!subitem) return false;

        // Verificar si el subitem tiene cantidad y está relacionado con un producto o porción
        const hasQuantity = subitem.cantidad !== 'ND' && subitem.cantidad !== undefined && subitem.cantidad !== null;
        const hasProductRelation = subitem.idproducto || subitem.idporcion;

        // Debe tener cantidad o estar relacionado con un producto o porción
        const isValid = hasQuantity || hasProductRelation;

        if (isValid) {
            // console.log('✅ Subitem_selected válido encontrado:', {
            //     cantidad: subitem.cantidad,
            //     idproducto: subitem.idproducto,
            //     idporcion: subitem.idporcion
            // });
        }

        return isValid;
    });

    item.isExistSubItemsWithCantidad = isCheck;
    item.subitems_selected_array = subitemsArray;
    // console.log(`item.isExistSubItemsWithCantidad ${isCheck}`);    
    
    return isCheck;
};

/**
 * Función para reintentar operaciones que pueden fallar por deadlock
 * @param {Function} operation - Función a ejecutar
 * @param {Number} maxRetries - Número máximo de reintentos
 * @returns {Promise} - Resultado de la operación
 */
const retryOperation = async (operation, maxRetries = 3) => {
    let lastError;
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            return await operation();
        } catch (error) {
            lastError = error;
            // Solo reintentar en caso de deadlock
            if (error.name === 'SequelizeDatabaseError' && 
                error.parent && 
                error.parent.code === 'ER_LOCK_DEADLOCK') {
                // console.log(`Reintento ${attempt} debido a deadlock`);
                // Espera exponencial antes de reintentar
                await new Promise(resolve => setTimeout(resolve, 100 * Math.pow(2, attempt)));
                continue;
            }
            // Para otros errores, lanzar inmediatamente
            throw error;
        }
    }
    throw lastError;
};

/**
 * Sanitiza un objeto para evitar problemas con valores nulos o undefined
 * @param {Object} obj - Objeto a sanitizar
 * @returns {Object} - Objeto sanitizado
 */
const sanitizeObject = (obj) => {
    // if (!obj) return {};
    if (!obj || typeof obj !== 'object') return {};
    
    // Guardar si el objeto original era un array para restaurarlo al final
    const wasArray = Array.isArray(obj);
    
    let sanitized = {...obj};

    // Sanitizar cada propiedad
    Object.keys(sanitized).forEach(key => {
        const value = sanitized[key];

        if (value === null || value === undefined) {
            sanitized[key] = null;
        } else if (typeof value === 'string') {
            // Escapar caracteres especiales
            sanitized[key] = value.replace(/['";\\]/g, '\\$&');
        } else if (typeof value === 'object') {
            sanitized[key] = sanitizeObject(value);
        }
    });
    
    // Si el objeto original era un array, reconvertir el objeto sanitizado a array
    if (wasArray) {
        const arrayResult = Object.keys(sanitized)
            .filter(key => !isNaN(parseInt(key)))
            .sort((a, b) => parseInt(a) - parseInt(b))
            .map(key => sanitized[key]);
            
        sanitized = arrayResult;
    }
    
    // Asegurar que propiedades críticas existan
    sanitized.cantidadSumar = sanitized.cantidadSumar || 0;
    sanitized.cantidad_reset = sanitized.cantidad_reset || 0;
    // sanitized.idcarta_lista = sanitized.idcarta_lista || '';
    // cambio para evitar que idcarta_lista sea null y no se registre la venta
    sanitized.idcarta_lista = sanitized.idcarta_lista || sanitized.iditem || '';
    sanitized.isporcion = sanitized.isporcion || 'ND';
    sanitized.iditem = sanitized.iditem || '';
    sanitized.cantidad = sanitized.cantidad || 0;
    sanitized.iditem2 = sanitized.iditem2 || sanitized.iditem; // Asegurar que iditem2 tenga un valor
    sanitized.idsede = sanitized.idsede || '';
    sanitized.idusuario = sanitized.idusuario || '';
    sanitized.op = sanitized.op !== undefined ? sanitized.op : null; // Preservar op para detectar RECUPERA
    
    return sanitized;
};

/**
 * Verifica que el JSON sea válido antes de enviarlo a un procedimiento almacenado
 * @param {Object} obj - Objeto a verificar
 * @returns {String} - JSON sanitizado
 */
const sanitizeJsonForProcedure = (obj) => {
    if (!obj) return '{}';
    
    try {
        // Asegurar que el objeto es serializable
        const jsonString = JSON.stringify(obj);
        // Verificar que sea un JSON válido
        JSON.parse(jsonString);
        return jsonString;
    } catch (error) {
        errorManager.logError({
            incidencia: {
                message: `Error al serializar JSON: ${error.toString()}`,
                data: { original_object: obj }
            },
            origen: 'sanitizeJsonForProcedure'
        });
        // Devolver un objeto vacío en caso de error
        return '{}';
    }
};

// ===== SUBFUNCIONES PARA MAYOR LEGIBILIDAD =====

/**
 * Procesa items de almacén
 */
const processAlmacenItem = async (op, sanitizedItem) => {
    // console.log('es de almacen');
    const _item = {
        cantidadSumar: sanitizedItem.cantidadSumar,        
        cantidad_reset: sanitizedItem.cantidad_reset,
        idcarta_lista: sanitizedItem.idcarta_lista
    };
    
    const itemJson = sanitizeJsonForProcedure(_item);
    const query = `CALL porcedure_pwa_update_cantidad_only_producto(${op}, '${itemJson}')`;
    
    return await retryOperation(() => ResponseService.emitirRespuestaSP(query));
};

/**
 * Construye allItems desde subitems_view
 */
const buildAllItemsFromSubitemsView = (subitem, sanitizedItem, cantSelected) => {
    const _idporcion = subitem.idporcion && subitem.idporcion !== 0 ? subitem.idporcion : '';
    const _idproducto = subitem.idproducto && subitem.idproducto !== 0 ? subitem.idproducto : '';
    const _iditem_subitem = subitem.iditem_subitem && subitem.iditem_subitem !== 0 ? subitem.iditem_subitem : '';
    const _idsubreceta = subitem.idsubreceta && subitem.idsubreceta !== 0 ? subitem.idsubreceta : '';  // 🆕 Soporte subrecetas
    
    const _cantidad_decuenta = validateCantidadDecuenta(subitem?.descuenta);
    
    cantSelected *= _cantidad_decuenta;

    // Detectar si es VENTA (cantidadSumar < 0) o RESET/RECUPERA (cantidadSumar >= 0)
    const esVenta = sanitizedItem.cantidadSumar < 0;
    
    // Para VENTAS: aplicar signo negativo para restar del stock
    // Para RESET/RECUPERA: mantener positivo para sumar/establecer stock
    const cantidadFinal = esVenta ? -cantSelected : cantSelected;
    
        // Para VENTAS: usar cantidadFinal negativo, cantidad_reset = 0 (no resetear)
    // Para RESET: usar cantSelected positivo para ambos
    const cantSumar = esVenta ? cantidadFinal : cantSelected;
    const cantReset = esVenta ? 0 : cantSelected;
    
    return {
        idporcion: _idporcion,
        idproducto: _idproducto,
        iditem_subitem: _iditem_subitem,
        idsubreceta: _idsubreceta,  // 🆕 Soporte subrecetas
        iditem: sanitizedItem.iditem,
        idcarta_lista: sanitizedItem.idcarta_lista,
        cantidad_reset: cantReset,
        cantidadSumar: cantSumar,
        isporcion: sanitizedItem.isporcion,
        iditem2: sanitizedItem.iditem2,
        cantidad: sanitizedItem.cantidad,
        idsede: sanitizedItem.idsede,
        idusuario: sanitizedItem.idusuario,
        idpedido: sanitizedItem.idpedido || null,
        op: sanitizedItem.op // Pasar op para detectar RECUPERA
    };
};

const validateCantidadDecuenta = (descuenta) => {
    let _cantidad_decuenta = 1;
    if (descuenta !== undefined && descuenta !== null && descuenta !== '') {
        const parsed = parseFloat(descuenta);
        if (!isNaN(parsed) && isFinite(parsed) && parsed > 0) {
            _cantidad_decuenta = parsed;
        }
    }
    return _cantidad_decuenta;
};

/**
 * Construye allItems desde subitems_selected_array
 */
const buildAllItemsFromSelectedArray = (subitemGroup, sanitizedItem) => {
    const _idporcion = subitemGroup.idporcion && subitemGroup.idporcion !== 0 ? subitemGroup.idporcion : '';
    const _idproducto = subitemGroup.idproducto && subitemGroup.idproducto !== 0 ? subitemGroup.idproducto : '';
    const _iditem_subitem = subitemGroup.iditem_subitem && subitemGroup.iditem_subitem !== 0 ? subitemGroup.iditem_subitem : '';
    const _idsubreceta = subitemGroup.idsubreceta && subitemGroup.idsubreceta !== 0 ? subitemGroup.idsubreceta : '';  // 🆕 NUEVO
    
    const _cantidad_decuenta = validateCantidadDecuenta(subitemGroup?.descuenta);

    
    const cantSelected = subitemGroup.cantidad_selected || 1;  
    const cantSumar = sanitizedItem.cantidadSumar * cantSelected * _cantidad_decuenta;
    const cantReset = sanitizedItem.cantidad_reset * cantSelected * _cantidad_decuenta;

    return {
        idporcion: _idporcion,
        idproducto: _idproducto,
        iditem_subitem: _iditem_subitem,
        idsubreceta: _idsubreceta,  // 🆕 NUEVO
        iditem: sanitizedItem.iditem,
        idcarta_lista: sanitizedItem.idcarta_lista,
        cantidad_reset: cantReset,
        cantidadSumar: cantSumar,
        isporcion: sanitizedItem.isporcion,
        iditem2: sanitizedItem.iditem2,
        cantidad: sanitizedItem.cantidad,
        idsede: sanitizedItem.idsede,
        idusuario: sanitizedItem.idusuario,
        idpedido: sanitizedItem.idpedido || null,
        op: sanitizedItem.op // Pasar op para detectar RECUPERA
    };
};

/**
 * Procesa subitems según su fuente (view o selected_array)
 */
const processSubitems = async (sanitizedItem, item) => {
    const _existSubItemsWithCantidad = sanitizedItem.isExistSubItemsWithCantidad || checkExistSubItemsWithCantidad(sanitizedItem);
    
    if (!_existSubItemsWithCantidad) {
        return;
    }

    // Decidir de dónde obtener los subitems
    let subitemsSource;
    const isSubitemsView = sanitizedItem.cantidad_reset > 0 && sanitizedItem.subitems_view;
    
    if (isSubitemsView) {
        // console.log('🟢 Usando subitems_view porque cantidad_reset > 0:', sanitizedItem.cantidad_reset);
        subitemsSource = sanitizedItem.subitems_view;
    } else {
        // console.log('🟡 Usando subitems_selected_array (fallback)');
        subitemsSource = sanitizedItem.subitems_selected_array;
    }

    
    if (!subitemsSource || !Array.isArray(subitemsSource)) {
        return;
    }

    // console.log('Procesando subitems:', JSON.stringify(subitemsSource));
    // console.log('el item.subitems_selected:', JSON.stringify(item.subitems_selected));
    
    try {
        const results = [];
        
        for (const subitemGroup of subitemsSource) {
            if (!subitemGroup) continue;
            
            if (isSubitemsView) {
                // Procesar subitems_view (estructura diferente)
                const cantSelected = subitemGroup.cantidad_seleccionada || 1;
                
                // Soportar ambas estructuras: "subitems" o "opciones"
                const opcionesArray = subitemGroup.subitems || subitemGroup.opciones || [];
                
                // 🔍 DEBUG: Logging para diagnosticar bug stock=0
                logger.debug({
                    grupo_des: subitemGroup.des,
                    cantidad_seleccionada: subitemGroup.cantidad_seleccionada,
                    cantSelected,
                    tiene_subitems: !!subitemGroup.subitems,
                    tiene_opciones: !!subitemGroup.opciones,
                    total_opciones: opcionesArray.length,
                    opciones_selected_count: opcionesArray.filter(s => s?.selected)?.length || 0
                }, '🔍 [DEBUG-STOCK] processSubitems - Grupo subitems_view');
                
                if (opcionesArray && Array.isArray(opcionesArray)) {
                    for (const subitem of opcionesArray) {                        
                        if (!subitem) continue;
                        
                        // Solo procesar opciones que tienen producto, porcion o subreceta
                        const tieneStock = subitem.idproducto || subitem.idporcion || subitem.idsubreceta;
                        if (!tieneStock) {
                                                        continue;
                        }
                        
                        // 🔍 DEBUG: Log cada subitem procesado
                        logger.debug({
                            subitem_des: subitem.des,
                            selected: subitem.selected,
                            idproducto: subitem.idproducto,
                            idporcion: subitem.idporcion,
                            idsubreceta: subitem.idsubreceta,  // 🆕 Log subreceta
                            cantidad_selected: subitem.cantidad_selected,
                            descuenta: subitem.descuenta
                        }, '🔍 [DEBUG-STOCK] Procesando subitem');
                        
                        const allItems = buildAllItemsFromSubitemsView(subitem, sanitizedItem, cantSelected);
                        
                        // 🔍 DEBUG: Log allItems construido
                        logger.debug({
                            idproducto: allItems.idproducto,
                            idporcion: allItems.idporcion,
                            idsubreceta: allItems.idsubreceta,  // 🆕 Log subreceta
                            cantidadSumar: allItems.cantidadSumar,
                            cantidad_reset: allItems.cantidad_reset
                        }, '🔍 [DEBUG-STOCK] allItems construido');
                        
                        const result = await retryOperation(() => ItemService.processAllItemSubitemSeleted(allItems));
                        results.push(result);
                    }
                }
            } else {
                // Procesar subitems_selected_array (estructura original)
                const allItems = buildAllItemsFromSelectedArray(subitemGroup, sanitizedItem);
                // console.log('allItems construido desde subitems_selected_array:', allItems);
                
                const result = await retryOperation(() => ItemService.processAllItemSubitemSeleted(allItems));
                results.push(result);
            }
        }
        return results;
    } catch (error) {
        const dataError = {
            incidencia: {
                message: error.toString(),
                existSubItemsWithCantidad: _existSubItemsWithCantidad,
                subitems_selected: item.subitems_selected,
                subitems_view: sanitizedItem.subitems_view,
                cantidad_reset: sanitizedItem.cantidad_reset,
                data: { item }
            },
            origen: 'processSubitems'
        };
        errorManager.logError(dataError);
        throw error;
    }
};

/**
 * Procesa items de tipo porción
 */
const processItemPorcion = async (sanitizedItem, op) => {
        
    try {
        const itemPorcion = {
            iditem: sanitizedItem.iditem,
            idcarta_lista: sanitizedItem.idcarta_lista,
            cantidadSumar: sanitizedItem.cantidadSumar,
            cantidad_reset: sanitizedItem.cantidad_reset,
            isporcion: sanitizedItem.isporcion,
            iditem2: sanitizedItem.iditem2,
            idsede: sanitizedItem.idsede,
            idusuario: sanitizedItem.idusuario,
            op: op, // Pasar op para detectar si es RECUPERA
            from_monitor: sanitizedItem.from_monitor
        };
        
        return await retryOperation(() => ItemService.processItemPorcion(itemPorcion));
    } catch (error) {
        if (error.name === 'SequelizeDatabaseError' && error.parent && error.parent.code === 'ER_PARSE_ERROR') {
            const dataError = {
                incidencia: {
                    message: "Error de sintaxis SQL en processItemPorcion",
                    originalError: error.toString(),
                    data: { item_process: sanitizedItem }
                },
                origen: 'processItemPorcion'
            };
            errorManager.logError(dataError);
            
            // En lugar de throw, retornar fallback con cantidad calculada
            // console.log('🟡 [stock.v1] Usando fallback por error SQL en processItemPorcion');
            return [{
                cantidad: Math.max(0, (sanitizedItem.cantidad || 0) - (sanitizedItem.cantidadSumar || 0)),
                listItemsPorcion: [],
                listSubItems: []
            }];
        }
        
        // Para otros errores, también registrar y usar fallback
        const dataError = {
            incidencia: {
                message: "Error general en processItemPorcion",
                originalError: error.toString(),
                data: { item_process: sanitizedItem }
            },
            origen: 'processItemPorcion'
        };
        errorManager.logError(dataError);
        
        // console.log('🟡 [stock.v1] Usando fallback por error general en processItemPorcion');
        return [{
            cantidad: Math.max(0, (sanitizedItem.cantidad || 0) - (sanitizedItem.cantidadSumar || 0)),
            listItemsPorcion: [],
            listSubItems: []
        }];
    }
};

/**
 * Procesa items regulares
 */
const processRegularItem = async (sanitizedItem, idsede) => {
    // console.log('ingresa processItem');
    
        // if (sanitizedItem.isporcion === 'ND' || sanitizedItem.isporcion !== 'SP') {
    //     return [{
    //         cantidad: sanitizedItem.cantidad,
    //         listItemsPorcion: null,
    //         listSubItems: null
    //     }];
    // }
    
        const itemProcess = {
        iditem: sanitizedItem.iditem,
        idcarta_lista: sanitizedItem.idcarta_lista,
        cantidadSumar: sanitizedItem.cantidadSumar,
        cantidad_reset: sanitizedItem.cantidad_reset || 0,
        isporcion: sanitizedItem.isporcion,
        from_monitor: sanitizedItem.from_monitor 
    };
    
    return await retryOperation(() => ItemService.processItem(itemProcess, idsede));
};

/**
 * Función principal de actualización de stock - Refactorizada con subfunciones
 * @param {String} op - Operación a realizar
 * @param {Object} item - Item a actualizar
 * @param {String} idsede - ID de la sede
 * @returns {Promise} - Resultado de la actualización
 */
const updateStock = async (op, item, idsede) => {
    // Agregar op al item para detectar RECUPERA
    item.op = op;
    const sanitizedItem = sanitizeObject(item);
    
    try {

        // ========== MONITOR DE STOCK: SET DIRECTO, SIN RESERVAS ==========
        if (sanitizedItem.from_monitor === true) {
            logger.debug({
                iditem: sanitizedItem.iditem,
                cantidad: sanitizedItem.cantidad,
                cantidadSumar: sanitizedItem.cantidadSumar,
                idsede
            }, '🖥️ [STOCK] Modificación desde monitor - sin reservas');
            
            // Para monitor: establecer cantidad_reset con el valor de cantidad (SET directo)
            sanitizedItem.cantidad_reset = sanitizedItem.cantidad;
            sanitizedItem.cantidadSumar = 0; // No sumar/restar, solo SET

            // Flujo legacy directo (SET stock en carta_lista)
            if (sanitizedItem.isalmacen === 1) {
                return await processAlmacenItem(op, sanitizedItem);
            }

            await processSubitems(sanitizedItem, item);        

            if (sanitizedItem.isporcion === 'SP') {
                return await processItemPorcion(sanitizedItem, op);
            } else {
                return await processRegularItem(sanitizedItem, idsede);
            }
        }

        // ========== SISTEMA DE RESERVAS POR SEDE ==========
        // Verificar si esta sede tiene activado el sistema de reservas (solo por sede, sin toggle global)
        const useReservasParaSede = await sedeUsaReservas(idsede);
        
        if (useReservasParaSede) {
            logger.debug({ 
                sanitizedItem: sanitizedItem,
                iditem: sanitizedItem.iditem, 
                sumar: sanitizedItem.sumar,
                isalmacen: sanitizedItem.isalmacen,
                idsede,
                useReservasParaSede
            }, '📦 [STOCK] Usando sistema de reservas para sede');
            
            const resultado = await StockReservaService.procesarItem(sanitizedItem, idsede);
            logger.debug({ 
                resultado,
            }, '📦 [STOCK] Resultado del sistema de reservas');
            
            // Convertir respuesta al formato esperado
            // Usar resultado.cantidad (stock vendible calculado por el sistema de reservas)
            return [{
                cantidad: resultado.cantidad,
                listItemsPorcion: resultado.listItemsPorcion || '[]',
                listSubItems: resultado.listSubItems || []
            }];
        }
        // ========== FIN SISTEMA DE RESERVAS ==========

        // FLUJO LEGACY (sin reservas): Procesar items de almacén
        if (sanitizedItem.isalmacen === 1) {
            return await processAlmacenItem(op, sanitizedItem);
        }
        
        // Procesar subitems si existen (modo directo)
        await processSubitems(sanitizedItem, item);

        // Procesar item principal según su tipo
        const tipo = sanitizedItem.isporcion === 'SP' ? 'PORCION' : 'REGULAR';
        logger.debug({ iditem: sanitizedItem.iditem, tipo, sumar: sanitizedItem.sumar }, '⚙️ [STOCK-4] handleStock.updateStock');
        
        if (sanitizedItem.isporcion === 'SP') {
            return await processItemPorcion(sanitizedItem, op);
        } else {
            return await processRegularItem(sanitizedItem, idsede);
        }
        
    } catch (error) {
        // Registrar el error detallado
        const dataError = {
            incidencia: {
                message: error.toString(),
                data: { item_process: sanitizedItem }
            },
            origen: 'updateStock'
        };
        errorManager.logError(dataError);
        
        // Retornar resultado por defecto en caso de error
        return [{
            cantidad: Math.max(0, (sanitizedItem.cantidad || 0) - (sanitizedItem.cantidadSumar || 0)),
            listItemsPorcion: [],
            listSubItems: []
        }];
    }
};

/**
 * Confirma las reservas de stock de todos los items de un pedido.
 * Delega a StockReservaService.confirmarPedido (SOLID).
 * Solo actúa si la sede tiene use_reservas_stock = 1.
 * 
 * @param {Object|Array} pBody - p_body del pedido (tipoconsumo.secciones.items) o array plano
 * @param {String|Number} idsede - ID de la sede
 * @param {Object} metadata - Datos adicionales (idpedido, idusuario, etc.)
 * @returns {Promise<Object>} - Resultado de las confirmaciones
 */
const confirmarStockPedido = async (pBody, idsede, metadata = {}) => {
    try {
        // Verificar si la sede usa reservas
        const usaReservas = await sedeUsaReservas(idsede);
        if (!usaReservas) {
            return { success: true, skipped: true, reason: 'Sede no usa reservas' };
        }

        return await StockReservaService.confirmarPedido(pBody, idsede, metadata);
    } catch (error) {
        logger.error({
            error: error.message,
            idsede,
            idpedido: metadata.idpedido
        }, '❌ [STOCK] Error confirmando reservas del pedido');
        return { success: false, error: error.message };
    }
};

module.exports = {
    updateStock,
    confirmarStockPedido,
    checkExistSubItemsWithCantidad,
    retryOperation,
    sanitizeObject,
    sanitizeJsonForProcedure,
    // Exponer servicio de reservas para uso externo
    StockReservaService,
    // Verificar si una sede específica usa reservas
    sedeUsaReservas
};
