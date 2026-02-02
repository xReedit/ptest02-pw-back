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
     * Analiza un item y retorna su información de stock
     */
    static analizar(item) {
        return {
            iditem: item.iditem,
            idcarta_lista: item.idcarta_lista,
            cantidad: Math.abs(item.cantidadSumar || 1),
            isND: item.cantidad === 'ND' || item.isporcion === 'ND',
            isSP: item.isporcion === 'SP',
            tieneSubitems: this.tieneSubitemsConStock(item),
            esAlmacen: item.isalmacen === 1
        };
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
     * @returns {Array} Lista de subitems con {idporcion, idproducto, idsubreceta, cantidad_selected}
     */
    static extraerSubitems(item) {
        const subitems = [];

        // Fuente 1: subitems_selected (objeto o array)
        if (item.subitems_selected) {
            const arr = Array.isArray(item.subitems_selected) 
                ? item.subitems_selected 
                : Object.values(item.subitems_selected);
            
            for (const s of arr) {
                if (s && this._tieneStock(s)) {
                    subitems.push(this._normalizarSubitem(s));
                }
            }
        }

        // Fuente 2: subitems_view (estructura con grupos y opciones)
        if (item.subitems_view && Array.isArray(item.subitems_view)) {
            for (const grupo of item.subitems_view) {
                const opciones = grupo.subitems || grupo.opciones || [];
                for (const o of opciones) {
                    if (o && o.selected && this._tieneStock(o)) {
                        subitems.push(this._normalizarSubitem(o, grupo.cantidad_seleccionada));
                    }
                }
            }
        }

        // Fuente 3: subitems_selected_array
        if (item.subitems_selected_array && Array.isArray(item.subitems_selected_array)) {
            for (const s of item.subitems_selected_array) {
                if (s && this._tieneStock(s)) {
                    subitems.push(this._normalizarSubitem(s));
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
     */
    static _normalizarSubitem(subitem, cantidadGrupo = null) {
        return {
            idporcion: subitem.idporcion || 0,
            idproducto: subitem.idproducto || 0,
            idsubreceta: subitem.idsubreceta || 0,
            cantidad_selected: parseFloat(
                subitem.cantidad_selected || 
                subitem.cantidad_seleccionada || 
                cantidadGrupo || 
                1
            ),
            des: subitem.des || subitem.descripcion || ''
        };
    }

    /**
     * Determina la acción a realizar según el item
     * @returns {'reservar'|'liberar'|'confirmar'|'skip'}
     */
    static determinarAccion(item) {
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
