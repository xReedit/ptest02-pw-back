/**
 * item.analyzer.js
 * 
 * Analiza items y extrae subitems de diferentes estructuras
 * Principio SOLID:
 *   - Single Responsibility: Solo análisis de estructura de items
 *   - Open/Closed: Fácil agregar nuevas fuentes de subitems
 */

const logger = require('../../utilitarios/logger');

class ItemAnalyzer {

    /**
     * Analiza un item y retorna su información de stock (versión síncrona)
     * IMPORTANTE: iditem2 contiene el ID real del producto, iditem puede ser idcarta_lista
     */
    static analizar(item) {
        // Usar iditem2 si existe (es el ID real), sino usar iditem
        const iditemReal = item.iditem2 || item.iditem;
        const isND = this.esItemND(item);
        const tieneSubitemsSeleccionados = this.tieneSubitemsConStock(item);
        
        return {
            iditem: iditemReal,
            iditemOriginal: item.iditem, // Guardar el original por si se necesita
            idcarta_lista: item.idcarta_lista || item.iditem,
            idproducto_stock: item.idproducto_stock || null,
            cantidad: Math.abs(item.cantidadSumar || 1),
            isND: isND,
            isSP: item.isporcion === 'SP',
            tieneSubitems: isND || tieneSubitemsSeleccionados, // ND implica que tiene subitems
            tieneSubitemsSeleccionados: tieneSubitemsSeleccionados,
            esAlmacen: item.isalmacen === 1
        };
    }

    /**
     * Analiza un item consultando la BD para determinar si es ND (versión async)
     * Usa carta_lista para verificar la cantidad real cuando no es SP
     * @param {Object} item - Item a analizar
     * @param {Object} ReservaRepository - Repositorio para consultas BD
     */
    static async analizarConBD(item, ReservaRepository) {
        const iditemReal = item.iditem2 || item.iditem;
        const isSP = item.isporcion === 'SP';
        const tieneSubitemsSeleccionados = this.tieneSubitemsConStock(item);
        const idcarta_lista = item.idcarta_lista || item.iditem;

        // Si es SP, no consultar carta_lista (usa receta)
        // Si no es SP, consultar carta_lista para saber si es ND
        let isND;
        if (isSP) {
            isND = false; // SP nunca es ND, tiene receta
        } else {
            isND = await ReservaRepository.esItemNDEnCartaLista(idcarta_lista);
        }

        return {
            iditem: iditemReal,
            iditemOriginal: item.iditem,
            idcarta_lista: idcarta_lista,
            idproducto_stock: item.idproducto_stock || null,
            cantidad: Math.abs(item.cantidadSumar || 1),
            isND: isND,
            isSP: isSP,
            tieneSubitems: isND || tieneSubitemsSeleccionados,
            tieneSubitemsSeleccionados: tieneSubitemsSeleccionados,
            esAlmacen: item.isalmacen === 1
        };
    }

    /**
     * Detecta si un item es de tipo ND (control de stock por subitems)
     * Un item es ND si:
     *   - cantidad === 'ND' o isporcion === 'ND'
     *   - cantidad >= 9999 o stock_actual >= 9999
     *   - Tiene estructura de subitems con opciones pero NINGUNO seleccionado
     */
    static esItemND(item) {
        // Verificación directa por string 'ND'
        if (item.cantidad === 'ND' || item.isporcion === 'ND') {
            return true;
        }

        // Regla simple por cantidad del item:
        // - cantidad >= 1 && < 9999 → numérico (NO es ND)
        // - cantidad === 0 || >= 9999 → ND
        const cantidad = parseFloat(item.cantidad);
        
        // Si es un número válido entre 1 y 9998, NO es ND
        if (!isNaN(cantidad) && cantidad >= 1 && cantidad < 9999) {
            return false;
        }

        // También verificar stock_actual si viene (para confirmar pedido)
        const stockActual = parseFloat(item.stock_actual);
        if (!isNaN(stockActual) && stockActual >= 1 && stockActual < 9999) {
            return false;
        }

        // Cantidad === 0, >= 9999, NaN, o vacía → es ND
        return true;
    }

    /**
     * Verificar si el item tiene subitems con stock
     */
    static tieneSubitemsConStock(item) {
        // Fuente 1: subitems_selected
        if (item.subitems_selected) {
            const arr = Array.isArray(item.subitems_selected) 
                ? item.subitems_selected 
                : Object.values(item.subitems_selected);
            if (arr.some(s => s && (s.idporcion || s.idproducto || s.idsubreceta))) {
                return true;
            }
        }
        
        // Fuente 2: subitems_view
        if (item.subitems_view && Array.isArray(item.subitems_view)) {
            for (const grupo of item.subitems_view) {
                const opciones = grupo.subitems || grupo.opciones || [];
                if (opciones.some(o => o && o.selected && (o.idporcion || o.idproducto || o.idsubreceta))) {
                    return true;
                }
            }
        }

        // Fuente 3: subitems_selected_array
        if (item.subitems_selected_array && Array.isArray(item.subitems_selected_array)) {
            if (item.subitems_selected_array.some(s => s && (s.idporcion || s.idproducto || s.idsubreceta))) {
                return true;
            }
        }

        return false;
    }

    /**
     * Extraer todos los subitems seleccionados de las diferentes fuentes
     * 
     * PRIORIDAD:
     *   1. subitems_selected (principal)
     *   2. subitems_selected_array (fallback si subitems_selected está vacío)
     *   3. subitems_view (adicional, estructura con grupos)
     * 
     * @returns {Array} Lista de subitems con {idporcion, idproducto, idsubreceta, cantidad_selected}
     */
    static extraerSubitems(item) {
        const subitems = [];
        let foundInSelected = false;

        // Fuente 1 (PRIORITARIA): subitems_selected (objeto o array)
        if (item.subitems_selected) {
            const arr = Array.isArray(item.subitems_selected) 
                ? item.subitems_selected 
                : Object.values(item.subitems_selected);
            
            for (const s of arr) {
                if (s && this._tieneStock(s)) {
                    subitems.push(this._normalizarSubitem(s));
                    foundInSelected = true;
                }
            }
        }

        // Fuente 2 (FALLBACK): subitems_selected_array - SOLO si no se encontró en subitems_selected
        if (!foundInSelected && item.subitems_selected_array && Array.isArray(item.subitems_selected_array)) {
            for (const s of item.subitems_selected_array) {
                if (s && this._tieneStock(s)) {
                    subitems.push(this._normalizarSubitem(s));
                }
            }
        }

        // Fuente 3: subitems_view (estructura con grupos y opciones) - para casos especiales
        // Solo procesar si NO hay subitems de las fuentes anteriores
        if (subitems.length === 0 && item.subitems_view && Array.isArray(item.subitems_view)) {
            for (const grupo of item.subitems_view) {
                const opciones = grupo.subitems || grupo.opciones || [];
                for (const o of opciones) {
                    if (o && o.selected && this._tieneStock(o)) {
                        subitems.push(this._normalizarSubitem(o, grupo.cantidad_seleccionada));
                    }
                }
            }
        }

        return subitems;
    }

    /**
     * Verifica si un subitem tiene referencias de stock
     */
    static _tieneStock(subitem) {
        return subitem.idporcion || subitem.idproducto || subitem.idsubreceta;
    }

    /**
     * Normaliza un subitem a formato estándar
     * 
     * IMPORTANTE: El campo 'descuenta' indica cuántas unidades se descuentan
     * por cada unidad vendida. Ejemplo: descuenta=5 significa que por cada
     * unidad vendida se descuentan 5 del stock.
     * 
     * cantidad_final = cantidad_selected * descuenta
     */
    static _normalizarSubitem(subitem, cantidadGrupo = null) {
        // Cantidad base seleccionada
        const cantidadBase = parseFloat(
            subitem.cantidad_selected || 
            subitem.cantidad_seleccionada || 
            cantidadGrupo || 
            1
        );
        
        // Factor de descuento (por defecto 1)
        const descuenta = parseFloat(subitem.descuenta) || 1;
        
        // Cantidad final = cantidad base * factor de descuento
        const cantidadFinal = cantidadBase * descuenta;

        if (descuenta !== 1) {
            logger.debug({
                des: subitem.des,
                cantidadBase,
                descuenta,
                cantidadFinal
            }, '📊 [ItemAnalyzer] Subitem con factor descuenta');
        }

        return {
            idporcion: subitem.idporcion || 0,
            idproducto: subitem.idproducto || 0,
            idsubreceta: subitem.idsubreceta || 0,
            cantidad_selected: cantidadFinal,
            descuenta: descuenta,
            des: subitem.des || subitem.descripcion || ''
        };
    }

    /**
     * Extrae todos los items de la estructura del pedido.
     * 
     * Soporta 2 estructuras:
     *   1. PWA: p_body.tipoconsumo[].secciones[].items[]
     *   2. Restobar: p_body es un array de tipos de consumo, los items son propiedades
     *      con claves numéricas dentro de cada tipo (ej: { id: '32', '1613121961511': { iditem: '...', ... } })
     * 
     * @param {Object|Array} pBody - p_body del pedido
     * @returns {Array} - Lista plana de items
     */
    static extraerItemsDelPedido(pBody) {
        if (!pBody) return [];

        const items = [];
        try {
            // Estructura Restobar: array de tipos de consumo con items como propiedades numéricas
            if (Array.isArray(pBody)) {
                for (const tipo of pBody) {
                    if (!tipo || typeof tipo !== 'object') continue;
                    // Las propiedades del tipo de consumo son: id, des, titulo, cantidad
                    // Todo lo demás son items (claves numéricas con objetos que tienen iditem)
                    for (const key of Object.keys(tipo)) {
                        const val = tipo[key];
                        if (val && typeof val === 'object' && !Array.isArray(val) && val.iditem) {
                            items.push(val);
                        }
                    }
                }
                return items;
            }

            // Estructura PWA: p_body.tipoconsumo[].secciones[].items[]
            const tipoconsumo = pBody.tipoconsumo || [];
            for (const tipo of tipoconsumo) {
                const secciones = tipo.secciones || [];
                for (const seccion of secciones) {
                    const seccionItems = seccion.items || [];
                    for (const item of seccionItems) {
                        items.push(item);
                    }
                }
            }
        } catch (error) {
            logger.error({ error: error.message }, '❌ [ItemAnalyzer] Error extrayendo items del pedido');
        }

        return items;
    }

    /**
     * Determina la acción a realizar según el item
     * @returns {'reservar'|'liberar'|'resetear'|'confirmar'|'skip'}
     */
    static determinarAccion(item) {
        // Si viene cantidad_reset > 0 → resetear (cancelación de pedido)
        if (item.cantidad_reset && parseFloat(item.cantidad_reset) > 0) {
            return 'resetear';
        }

        // Si sumar es false o cantidadSumar es positivo → liberar
        if (item.sumar === false || (item.cantidadSumar && item.cantidadSumar > 0)) {
            return 'liberar';
        }
        
        // Si sumar es true o cantidadSumar es negativo → reservar
        if (item.sumar === true || (item.cantidadSumar && item.cantidadSumar < 0)) {
            return 'reservar';
        }

        // Si es reset (op contiene RECUPERA) → liberar
        if (item.op && item.op.toString().includes('RECUPERA')) {
            return 'liberar';
        }

        return 'reservar'; // Por defecto reservar
    }
}

module.exports = ItemAnalyzer;
