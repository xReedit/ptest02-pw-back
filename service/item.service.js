// services/item.service.js

const QueryService = require('../service/query.service');
const errorManager = require('../service/error.manager');
let Sequelize = require('sequelize');
const config = require('../_config');
const sequelize = new Sequelize(config.database, config.username, config.password, config.sequelizeOption);


class ItemService {
    static async processItem(item, idsede) {
        let result = [{
            cantidad: null,
            listItemsPorcion: null,
            listSubItems: null
        }];

        const _item = {
            iditem: item.iditem,
            idcarta_lista: item.idcarta_lista,
            cantidad_reset: item.cantidad_reset,
            cantidadSumar: item.cantidadSumar,
            isporcion: item.isporcion,
            iditem2: item.iditem2        
        }
        
        console.log('_item', _item);

        let updatedItem;    
        let transaction;
        
        try {  
            // Iniciar una transacción
            transaction = await sequelize.transaction({
                isolationLevel: Sequelize.Transaction.ISOLATION_LEVELS.SERIALIZABLE
            });   
            // transaction = await sequelize.transaction();

            // updatedItem = await ResponseService.emitirRespuestaSP(`call procedure_stock_item('${JSON.stringify(_item)}', ${idsede})`);
            // console.log(`call procedure_stock_item('${JSON.stringify(_item)}', ${idsede})`);
            updatedItem = await QueryService.emitirRespuestaSP_RAW('call procedure_stock_item(?, ?)', [
                JSON.stringify(_item),
                idsede
            ], transaction);

            // Confirmar la transacción
            await transaction.commit();

            result[0].cantidad = parseFloat(updatedItem[0].cantidad);
            
            return result;

        } catch (error) {
            // Revertir la transacción en caso de error
            if (transaction) await transaction.rollback();

            const sqlQuery = `call procedure_stock_item('${JSON.stringify(_item)}', ${idsede})`;
            const dataError = {
                incidencia: {
                    message: error,
                    data: {
                        item_process: _item,                    
                        query: sqlQuery,
                        res_query: updatedItem
                    }
                },
                origen: 'processItem'            
            }
            errorManager.logError(dataError);
            console.error('processItem====', error);
            throw error;
        }
    }

    static async processItemPorcion(item) {
        let result = [{
            cantidad: null,
            listItemsPorcion: null,
            listSubItems: null
        }];

        // sino existe idcarta_lista entonces toma el valor de iditem para luego tomar el valor de iditem2
        item.idcarta_lista = item.idcarta_lista ? item.idcarta_lista : item.iditem;
        item.iditem2 = item.iditem2 ? item.iditem2 : item.iditem;
        let _idItemUpdate = item.iditem === item.idcarta_lista ? item.iditem2 : item.iditem;        

        let updatedItem; 
        let _itemProcessPorcion = {};
        try { 
            _itemProcessPorcion = {
                iditem: item.iditem,
                idcarta_lista: item.idcarta_lista,
                cantidad_reset: item.cantidad_reset,
                cantidadSumar: item.cantidadSumar,
                isporcion: item.isporcion,
                iditem2: item.iditem2        
            }      
                        
            // console.log(`call procedure_stock_item_porcion('${JSON.stringify(_itemProcessPorcion)}')`);
            // updatedItem = await QueryService.emitirRespuestaSP(`call procedure_stock_item_porcion('${JSON.stringify(_itemProcessPorcion)}')`);
        
            // Verificar que _itemProcessPorcion no sea null antes de convertirlo a JSON
            if (!_itemProcessPorcion) {
                throw new Error('_itemProcessPorcion es null o undefined');
            }
            
            const jsonParam = JSON.stringify(_itemProcessPorcion);
            updatedItem = await QueryService.emitirRespuestaSP_RAW('call procedure_stock_item_porcion(?)', [
                jsonParam
            ]);

            // console.log('updatedItem', updatedItem);
            result[0].listItemsPorcion = updatedItem[0].listItemsPorcion;
            const listItemsJson = typeof updatedItem[0].listItemsPorcion === 'string' ? JSON.parse(updatedItem[0].listItemsPorcion) : updatedItem[0].listItemsPorcion;
            if ( listItemsJson.length > 0 ) {            
                const itemCantidad = listItemsJson.filter(i => i.iditem == _idItemUpdate);                
                result[0].cantidad = itemCantidad[0].cantidad;
            } else {
                // no deberia llegar a este punto ya que siempre deberia retornar un item con cantidad ya que es porcion
                result[0].cantidad = item.cantidad - item.cantidadSumar;
            }
            return result;
        } catch (error) {
            const sqlQuery = `call procedure_stock_item_porcion('${JSON.stringify(_itemProcessPorcion)}')`;

            const dataError = {
                incidencia: {
                    message: error,
                    data: {
                        item_process: _itemProcessPorcion,
                        query: sqlQuery,
                        res_query: updatedItem
                    }
                },
                origen: 'processItemPorcion'
            }
            errorManager.logError(dataError);
            console.error('processItemPorcion====', error);
            throw error;
        }
    }

    static async processAllItemSubitemSeleted(allItems) {
        let updatedItem;
        try {        
            console.log(`call procedure_stock_all_subitems('${JSON.stringify(allItems)}')`);
            updatedItem = await QueryService.emitirRespuestaSP_RAW('call procedure_stock_all_subitems(?)', [
                JSON.stringify(allItems)
            ]);

            // console.log('updatedItem', updatedItem);
            return updatedItem;
        } catch (error) {
            const sqlQuery = `call procedure_stock_all_subitems('${JSON.stringify(allItems)}')`;

            const dataError = {
                incidencia: {
                    message: error,
                    data: {
                        item_process: allItems,                    
                        query: sqlQuery,
                        res_query: updatedItem
                    }
                },
                origen: 'processAllItemSubitemSeleted'            
            }
            errorManager.logError(dataError);
            console.error('processAllItemSubitemSeleted====', error);        
            throw error;

        }
    }
}

module.exports = ItemService;
