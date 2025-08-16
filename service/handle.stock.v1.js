/**
 * handle.stock.v1.js
 * Versión refactorizada del manejador de stock con validación robusta y manejo de reintentos
 */

const ResponseService = require('./query.service.v1');
let ItemService = require('./item.service.v1');

// Importar el gestor de errores o crearlo si no existe
let errorManager;
try {
    errorManager = require('./error.manager');
} catch (e) {
    // Si no existe, creamos un objeto básico para loggear errores
    errorManager = {
        logError: (data) => {
            console.error('Error registrado:', JSON.stringify(data));
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
    sanitized.idcarta_lista = sanitized.idcarta_lista || '';
    sanitized.isporcion = sanitized.isporcion || 'ND';
    sanitized.iditem = sanitized.iditem || '';
    sanitized.cantidad = sanitized.cantidad || 0;
    sanitized.iditem2 = sanitized.iditem2 || sanitized.iditem; // Asegurar que iditem2 tenga un valor
    
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
    
    // Cuando cantidad_reset > 0, usar cantSelected directamente (sin multiplicar)
    const cantSumar = cantSelected;
    const cantReset = cantSelected;
    
    return {
        idporcion: _idporcion,
        idproducto: _idproducto,
        iditem_subitem: _iditem_subitem,
        iditem: sanitizedItem.iditem,
        idcarta_lista: sanitizedItem.idcarta_lista,
        cantidad_reset: cantReset,
        cantidadSumar: cantSumar,
        isporcion: sanitizedItem.isporcion,
        iditem2: sanitizedItem.iditem2,
        cantidad: sanitizedItem.cantidad,  
    };
};

/**
 * Construye allItems desde subitems_selected_array
 */
const buildAllItemsFromSelectedArray = (subitemGroup, sanitizedItem) => {
    const _idporcion = subitemGroup.idporcion && subitemGroup.idporcion !== 0 ? subitemGroup.idporcion : '';
    const _idproducto = subitemGroup.idproducto && subitemGroup.idproducto !== 0 ? subitemGroup.idproducto : '';
    const _iditem_subitem = subitemGroup.iditem_subitem && subitemGroup.iditem_subitem !== 0 ? subitemGroup.iditem_subitem : '';
    
    const cantSelected = subitemGroup.cantidad_selected || 1;  
    const cantSumar = sanitizedItem.cantidadSumar * cantSelected;
    const cantReset = sanitizedItem.cantidad_reset * cantSelected;
    
    return {
        idporcion: _idporcion,
        idproducto: _idproducto,
        iditem_subitem: _iditem_subitem,
        iditem: sanitizedItem.iditem,
        idcarta_lista: sanitizedItem.idcarta_lista,
        cantidad_reset: cantReset,
        cantidadSumar: cantSumar,
        isporcion: sanitizedItem.isporcion,
        iditem2: sanitizedItem.iditem2,
        cantidad: sanitizedItem.cantidad,  
    };
};

/**
 * Procesa subitems según su fuente (view o selected_array)
 */
const processSubitems = async (sanitizedItem, item) => {
    const _existSubItemsWithCantidad = sanitizedItem.isExistSubItemsWithCantidad || checkExistSubItemsWithCantidad(sanitizedItem);
    // console.log('_existSubItemsWithCantidad ==', _existSubItemsWithCantidad);

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
                
                if (subitemGroup.subitems && Array.isArray(subitemGroup.subitems)) {
                    for (const subitem of subitemGroup.subitems) {
                        if (!subitem) continue;
                        
                        const allItems = buildAllItemsFromSubitemsView(subitem, sanitizedItem, cantSelected);
                        // console.log('allItems construido desde subitems_view:', allItems);
                        
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
const processItemPorcion = async (sanitizedItem) => {
    // console.log('ingresa processItemPorcion');
    
    try {
        const itemPorcion = {
            iditem: sanitizedItem.iditem,
            idcarta_lista: sanitizedItem.idcarta_lista,
            cantidadSumar: sanitizedItem.cantidadSumar,
            cantidad_reset: sanitizedItem.cantidad_reset,
            isporcion: sanitizedItem.isporcion,
            iditem2: sanitizedItem.iditem2
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
            throw new Error("Error de sintaxis SQL en processItemPorcion: " + error.message);
        }
        throw error;
    }
};

/**
 * Procesa items regulares
 */
const processRegularItem = async (sanitizedItem, idsede) => {
    // console.log('ingresa processItem');
    
    if (sanitizedItem.isporcion === 'ND') {
        return [{
            cantidad: sanitizedItem.cantidad,
            listItemsPorcion: null,
            listSubItems: null
        }];
    }
    
    const itemProcess = {
        iditem: sanitizedItem.iditem,
        idcarta_lista: sanitizedItem.idcarta_lista,
        cantidadSumar: sanitizedItem.cantidadSumar,
        cantidad_reset: sanitizedItem.cantidad_reset || 0,
        isporcion: sanitizedItem.isporcion
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
    // console.log('🟡 [handle.stock.v1] updateStock - INICIO', { op, idsede, itemId: item?.iditem, elItem: JSON.stringify(item) });
    
    // Sanitizar el objeto item para evitar errores de referencia nula
    const sanitizedItem = sanitizeObject(item);
    // console.log('🔵 [handle.stock.v1] Item sanitizado:', { 
    //     iditem: sanitizedItem.iditem, 
    //     cantidadSumar: sanitizedItem.cantidadSumar,
    //     cantidad_reset: sanitizedItem.cantidad_reset,
    //     isalmacen: sanitizedItem.isalmacen,
    //     isporcion: sanitizedItem.isporcion
    // });
    
    try {
        // Procesar items de almacén
        if (sanitizedItem.isalmacen === 1) {
            return await processAlmacenItem(op, sanitizedItem);
        }
        
        // Procesar subitems si existen
        await processSubitems(sanitizedItem, item);
        
        // Procesar item principal según su tipo
        if (sanitizedItem.isporcion === 'SP') {
            return await processItemPorcion(sanitizedItem);
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
        
        // Relanzar el error para que sea manejado por el código que llama a esta función
        throw error;
    }
};

module.exports = {
    updateStock,
    checkExistSubItemsWithCantidad,
    retryOperation,
    sanitizeObject,
    sanitizeJsonForProcedure
};
