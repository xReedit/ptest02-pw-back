// controllers/item.controller.js
const ResponseService = require('./query.service');
let ItemService = require('./item.service');
let errorManager = require('./error.manager');

const setItemCarta = async (op, item, idsede) => {
    if (item.isalmacen === 1) {
        const _item = {
            cantidadSumar: item.cantidadSumar,
            idcarta_lista: item.idcarta_lista,
            cantidad_reset: item.cantidad_reset
        };
        const query = `CALL porcedure_pwa_update_cantidad_only_producto(${op}, '${JSON.stringify(_item)}')`;
        return await ResponseService.emitirRespuestaSP(query);
    } else {
        const _existSubItemsWithCantidad = !item.subitems ? false :
            typeof item.subitems === 'object' ?
                item.subitems.some(subitem => subitem.opciones.some(opcion => opcion.cantidad !== 'ND')) : false; 

        // let cantidadUpdate = item.cantidad_reset ? item.cantidad_reset : item.cantidadSumar;

        try {
            if (_existSubItemsWithCantidad && item.subitems_selected) {
                let _idporcion = [];
                let _idproducto = [];
                let _iditem_subitem = [];

                item.subitems_selected.forEach(subitem => {          
                    if (subitem.idporcion !== 0) { _idporcion.push(subitem.idporcion) }
                    if (subitem.idproducto !== 0) { _idproducto.push(subitem.idproducto); }                
                    _iditem_subitem.push(subitem.iditem_subitem);
                });

                _idporcion = _idporcion.length === 0 ? '' : _idporcion.join(',');
                _idproducto = _idproducto.length === 0 ? '' :_idproducto.join(',');
                _iditem_subitem = _iditem_subitem.length === 0 ? '' :_iditem_subitem.join(',');

                if (_idporcion.length + _idproducto.length + _iditem_subitem.length > 0) {
                    const allItems = {
                        idporcion: _idporcion,
                        idproducto: _idproducto,
                        iditem_subitem: _iditem_subitem,
                        iditem: item.iditem,
                        idcarta_lista: item.idcarta_lista,
                        cantidad_reset: item.cantidad_reset,
                        cantidadSumar: item.cantidadSumar,
                        isporcion: item.isporcion,
                        iditem2: item.iditem2,
                        cantidad: item.cantidad,  
                    };
                    return await ItemService.processAllItemSubitemSeleted(allItems);
                }
            }
        } catch (error) {
            const dataError = {
                incidencia: {
                    message: error,
                    existSubItemsWithCantidad: _existSubItemsWithCantidad,
                    subitems_selected: item.subitems_selected,
                    data: { item }
                },
                origen: 'setItemCarta'
            }
            errorManager.logError(dataError);
            throw error;
        }

        if (item.isporcion === 'SP') {
            console.log('ingresa processItemPorcion');
            return await ItemService.processItemPorcion(item);
        } else {
            console.log('ingresa processItem');
            return await ItemService.processItem(item, idsede);
        }
    }
}

module.exports.setItemCarta = setItemCarta;
