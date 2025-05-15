const { to, ReE, ReS }  = require('../service/uitl.service');
let Sequelize = require('sequelize');
let errorManager = require('../service/error.manager');
// let config = require('../config');
let config = require('../_config');
let managerFilter = require('../utilitarios/filters');
// let utilitarios = require('../utilitarios/fecha.js');

let handleStock = require('../service/handle.stock');

let sequelize = new Sequelize(config.database, config.username, config.password, config.sequelizeOption);

let mysql_clean = function (string) {
        return sequelize.getQueryInterface().escape(string);
};


const emitirRespuesta = async (xquery) => {
    console.log(xquery);
    try {
        // return await sequelize.query(xquery, { type: sequelize.QueryTypes.SELECT });
        const trimmedQuery = xquery.trim().toLowerCase();
        let queryType;
        if (trimmedQuery.startsWith('update')) {
            queryType = sequelize.QueryTypes.UPDATE;
        } else if (trimmedQuery.startsWith('insert')) {
            queryType = sequelize.QueryTypes.INSERT;
        } else {
            queryType = sequelize.QueryTypes.SELECT;
        }
        
        return await sequelize.query(xquery, { type: queryType });
    } catch (err) {
        console.error(err);
        return false;
    }
};

const emitirRespuesta_RES = async (xquery, res) => {
    console.log(xquery);

    try {
        const rows = await sequelize.query(xquery, { type: sequelize.QueryTypes.SELECT });
        return ReS(res, {
            data: rows
        });
    } catch (error) {
        console.error(error);
        return false;
    }
};
module.exports.emitirRespuesta_RES = emitirRespuesta_RES;

const emitirRespuestaSP = async (xquery) => {
    // console.log(xquery);
    try {
        const rows = await sequelize.query(xquery, { type: sequelize.QueryTypes.SELECT });
        const arr = Object.values(rows[0]);
        return arr;
    } catch (err) {
        console.error(err);
        return false;
    }
};

const emitirRespuestaSP_RES = async (xquery, res) => {
    console.log(xquery);
    try {
        const rows = await sequelize.query(xquery, { type: sequelize.QueryTypes.SELECT });

        // Convertimos en array ya que viene en object
        const arr = Object.values(rows[0]);

        return ReS(res, {
            data: arr
        });
    } catch (err) {
        return ReE(res, err);
    }
};


const ejecutarQuery = async (query) => {
    const resultado = await emitirRespuesta(query);
    return resultado || [];
};

// const setClienteConectado = function (dataCLiente) {	
//     const idcliente = dataCLiente.idcliente;
//     const socketid = dataCLiente.socketid;
//     if ( idcliente ) {
//     	const read_query = `insert into cliente_socketid (idcliente, socketid, conectado) values (${idcliente}, '${socketid}', '1')  ON DUPLICATE KEY UPDATE socketid = '${socketid}', conectado='1';`;
//     	return emitirRespuesta(read_query);
//     }    
// }
// module.exports.setClienteConectado = setClienteConectado;

const setClienteConectado = async ({ idcliente, socketid }) => {
    if (!idcliente) return false;

    const query = `
        INSERT INTO cliente_socketid (idcliente, socketid, conectado)
        VALUES (${idcliente}, '${socketid}', '1')
        ON DUPLICATE KEY UPDATE socketid = '${socketid}', conectado = '1';
    `;

    return await ejecutarQuery(query);
};
module.exports.setClienteConectado = setClienteConectado;


// const setClienteDesconectado = function (dataCLiente) {
//     const idcliente = dataCLiente.idcliente;
//     const socketid = dataCLiente.socketid;
//     if ( idcliente && idcliente != 'undefined') {
//     	const read_query = `update cliente_socketid set conectado='0' where idcliente = '${idcliente}';`;
//     	return emitirRespuesta(read_query);
//     }    
// }
// module.exports.setClienteDesconectado = setClienteDesconectado;

const setClienteDesconectado = async ({ idcliente, socketid }) => {
    if (!idcliente || idcliente === 'undefined') return false;

    const query = `
        UPDATE cliente_socketid
        SET conectado = '0'
        WHERE idcliente = '${idcliente}';
    `;

    return await ejecutarQuery(query);
};
module.exports.setClienteDesconectado = setClienteDesconectado;



// const getSocketIdCliente = async function (listIdCliente) {
// 	// const idcliente = dataCLiente.idcliente;
//     const read_query = `SELECT socketid from cliente_socketid where idcliente in (${listIdCliente})`;
//     return emitirRespuesta(read_query);        
// }
// module.exports.getSocketIdCliente = getSocketIdCliente;


const getSocketIdCliente = async (listIdCliente) => {
    const query = `
        SELECT socketid
        FROM cliente_socketid
        WHERE idcliente IN (${listIdCliente});
    `;

    return await ejecutarQuery(query);
};
module.exports.getSocketIdCliente = getSocketIdCliente;




// const getObjCarta = async function (dataCLiente) {
// 	console.log( 'getObjCarta data cliente', dataCLiente )
// 	const idorg = dataCLiente.idorg;
//     const idsede = dataCLiente.idsede;           
//     const iscliente = dataCLiente.iscliente == 'true' ? 1 : 0;
//     console.log( 'getObjCarta data cliente iscliente', iscliente );
        
//     const read_query = `call porcedure_pwa_pedido_carta(${idorg},${idsede},${iscliente})`;
//     return emitirRespuestaSP(read_query);        
// }
// module.exports.getObjCarta = getObjCarta;

const getObjCarta = async (dataCliente) => {
    const { idorg, idsede, iscliente } = dataCliente;
    const isClienteValue = iscliente === 'true' ? 1 : 0;

    const query = `CALL porcedure_pwa_pedido_carta(${idorg}, ${idsede}, ${isClienteValue})`;
    console.log('carta === > ', query)
    return await emitirRespuestaSP(query);
};
module.exports.getObjCarta = getObjCarta;



// datos de la sede, impresoras
// const getDataSede = async function (dataCLiente) {	
// 	const idorg = dataCLiente.idorg;
//     const idsede = dataCLiente.idsede;           
        
//     const read_query = `call procedure_pwa_pedido_dataorg(${idorg},${idsede})`;    
//     return emitirRespuestaSP(read_query);    
// }
// module.exports.getDataSede = getDataSede;


// datos de la sede, impresoras
const getDataSede = async (dataCliente) => {
    const { idorg, idsede } = dataCliente;

    const query = `CALL procedure_pwa_pedido_dataorg(${idorg}, ${idsede})`;
    return await emitirRespuestaSP(query);
};
module.exports.getDataSede = getDataSede;


// const getDataSedeDescuentos = async function (dataCLiente) {  
//     const idorg = dataCLiente.idorg;
//     const idsede = dataCLiente.idsede;           
        
//     const read_query = `call procedure_pwa_sede_descuentos(${idsede})`;    
//     return emitirRespuestaSP(read_query);    
// }
// module.exports.getDataSedeDescuentos = getDataSedeDescuentos;

const getDataSedeDescuentos = async (dataCliente) => {
    const { idsede } = dataCliente;

    const query = `CALL procedure_pwa_sede_descuentos(${idsede})`;
    return await emitirRespuestaSP(query);
};
module.exports.getDataSedeDescuentos = getDataSedeDescuentos;


// const getTipoConsumo = async function (dataCLiente) {
// 	const idorg = dataCLiente.idorg;
//     const idsede = dataCLiente.idsede;
//     const read_query = `SELECT idtipo_consumo, descripcion, titulo, idimpresora from tipo_consumo where (idorg=${idorg} and idsede=${idsede}) and estado=0`;
//     return emitirRespuesta(read_query);        
// }
// module.exports.getTipoConsumo = getTipoConsumo;

const getTipoConsumo = async (dataCliente) => {
    const { idorg, idsede } = dataCliente;
    const query = `
        SELECT idtipo_consumo, descripcion, titulo, idimpresora 
        FROM tipo_consumo 
        WHERE (idorg = ${idorg} AND idsede = ${idsede}) AND estado = 0`;
    return await emitirRespuesta(query);
};
module.exports.getTipoConsumo = getTipoConsumo;



// const getReglasCarta = async function (dataCLiente) {
// 	// console.log( 'data cliente', dataCLiente )
// 	const idorg = dataCLiente.idorg;
//     const idsede = dataCLiente.idsede;           
        
//     const read_query = `call procedure_pwa_reglas_carta_subtotales(${idorg},${idsede})`;
//     return emitirRespuestaSP(read_query);           
// }
// module.exports.getReglasCarta = getReglasCarta;


const getReglasCarta = async (dataCliente) => {
    const { idorg, idsede } = dataCliente;
    const query = `CALL procedure_pwa_reglas_carta_subtotales(${idorg}, ${idsede})`;
    return await emitirRespuestaSP(query);
};
module.exports.getReglasCarta = getReglasCarta;



// para el caso de monitor pedidos
const setItemCartaAfter = async function (op, item) {	
    // nos aseguramos de quitar los espacios en blanco
    let read_query = '';
    if ( item.isalmacen.toString() === '1' ) { // si es producto}
        const _item = {cantidadSumar: item.cantidadSumar, idcarta_lista: item.idcarta_lista, cantidad_reset: item.cantidad_reset};
        console.log('porcedure_pwa_update_cantidad_only_producto', _item)
        read_query = `call porcedure_pwa_update_cantidad_only_producto(${op},'${JSON.stringify(_item)}')`;
        console.log('read_query', read_query);
    } else {
        var item = JSON.stringify(item).replace(/\\n/g, '')
                                      .replace(/\\'/g, '')
                                      .replace(/\\"/g, '')
                                      .replace(/\\&/g, '')
                                      .replace(/\\r/g, '')
                                      .replace(/\\t/g, '')
                                      .replace(/\\b/g, '')
                                      .replace(/\\f/g, '');               
        // const read_query = `call porcedure_pwa_update_cantidad_item(${op},'${JSON.stringify(item)}')`;

        item = item.replace(/[\r\n]/g, '');
        read_query = `call porcedure_pwa_update_cantidad_item(${op},'${item}')`;
    }
    
    return emitirRespuestaSP(read_query);        
}
module.exports.setItemCartaAfter = setItemCartaAfter;


const setItemCarta = async (op, item, idsede) => {
    return handleStock.updateStock(op, item, idsede);
    
    // if (item.isalmacen === 1) {// si es producto
    //     const _item = {
    //         cantidadSumar: item.cantidadSumar,
    //         idcarta_lista: item.idcarta_lista,
    //         cantidad_reset: item.cantidad_reset
    //     };
    //     const query = `
    //         CALL porcedure_pwa_update_cantidad_only_producto(${op}, '${JSON.stringify(_item)}')`;
    //     return await emitirRespuestaSP(query);
    // } else {

    //     // evaluar si item.subitems es undefined
    //     // console.log('typeof item.subitems ', typeof item.subitems);
    //     // console.log('el item', item);
        
    //     const _existSubItemsWithCantidad = !item.subitems ?  false :
    //         //evalua si existe algun subitem con cantidad diferente a ND en su propiedad opciones.cantidad
    //         // evaluea si item.subitems es un array
    //         typeof item.subitems === 'object' ?
    //         item.subitems.some(subitem => subitem.opciones.some(opcion => opcion.cantidad !== 'ND')) : false; 

    //     // console.log('item.subitems', item.subitems)
    //     // console.log('_existSubItemsWithCantidad', _existSubItemsWithCantidad);

    //     let cantidadUpdate = item.cantidad_reset ? item.cantidad_reset : item.cantidadSumar;

        
    //     try {
            
    //         if ( _existSubItemsWithCantidad && item.subitems_selected) {
    //             // item subitems_selected                        
    //             let _idporcion = [];
    //             let _idproducto = [];
    //             let _iditem_subitem = [];
    
    //             // obtenemos los ids porcion y productos de los subitems seleccionados
    //             item.subitems_selected.forEach(subitem => {          
    //                 // processItemSubitemSeleted(subitem, cantidadUpdate);     
    //                 if (subitem.idporcion !== 0) { _idporcion.push(subitem.idporcion) }
    //                 if (subitem.idproducto !== 0) { _idproducto.push(subitem.idproducto);}                
    //                 _iditem_subitem.push(subitem.iditem_subitem);
    //             })
                
    //             _idporcion = _idporcion.length === 0 ? '' : _idporcion.join(',');
    //             _idproducto = _idproducto.length === 0 ? '' :_idproducto.join(',');
    //             _iditem_subitem = _iditem_subitem.length === 0 ? '' :_iditem_subitem.join(',');
    //             const showProcedureAllItems = _idporcion.length + _idproducto.length + _iditem_subitem.length > 0;
    
    //             if ( showProcedureAllItems ){
    //                 const allItems = {
    //                     idporcion: _idporcion,
    //                     idproducto: _idproducto,
    //                     iditem_subitem: _iditem_subitem,
    //                     iditem: item.iditem,
    //                     idcarta_lista: item.idcarta_lista,
    //                     cantidad_reset: item.cantidad_reset,
    //                     cantidadSumar: item.cantidadSumar,
    //                     isporcion: item.isporcion,
    //                     iditem2: item.iditem2,
    //                     cantidad: item.cantidad,  
    //                 }
        
    //                 processAllItemSubitemSeleted(allItems);
    //             }
    
    //             console.log('_idporcion', _idporcion);
    //             console.log('_idproducto', _idproducto);
    //             console.log('_iditem_subitem', _iditem_subitem);
                
    
    //         }
    //     } catch (error) {
    //         const dataError = {
    //             incidencia: {
    //                 message: error.toString(),
    //                 existSubItemsWithCantidad: _existSubItemsWithCantidad,
    //                 subitems_selected: item.subitems_selected,
    //                 data: {
    //                     item                        
    //                 }
    //             },
    //             origen: 'setItemCarta'
    //         }

    //         errorManager.logError(dataError);
    //     }

                    
    //     // en ingredientes
    //     if ( item.isporcion === 'SP' ) {
    //         // si es porcion
    //         console.log('ingresa processItemPorcion');
    //         return await processItemPorcion(item)
    //     } else {
    //         // si no es porcion
    //         console.log('ingresa processItem');
    //         return await processItem(item, idsede)
    //     }




        // esto hasta el momento venia funcionando mejor
        // if (item.isalmacen === 0 && !_existSubItemsWithCantidad) {            
        // } 
        // else {        
        //     const cleanedItem = JSON.stringify(item)
        //         .replace(/\\n/g, '')
        //         .replace(/\\'/g, '')
        //         .replace(/\\"/g, '')
        //         .replace(/\\&/g, '')
        //         .replace(/\\r/g, '')
        //         .replace(/\\t/g, '')
        //         .replace(/\\b/g, '')
        //         .replace(/\\f/g, '')            
        //         .replace(/[\r\n]/g, '').replace(/'/g, '');
    
        //     const query = `CALL porcedure_pwa_update_cantidad_item(${op}, '${cleanedItem}')`;
        //     return await emitirRespuestaSP(query);
        // }
    
};
module.exports.setItemCarta = setItemCarta;




// const setNuevoPedido = async function (dataCLiente, dataPedido) {
    
// 	// const idorg = dataCLiente.idorg;
//  //    const idsede = dataCLiente.idsede;		              
//  //    const idusuario = dataCLiente.idusuario;		              

//     // tomamos los datos del cliente del pedido y no del socket, puede estar haciendo conflicto
//     // y enviando a otros comercios
//     const _dataCliente = dataPedido.dataUsuario
//     const idorg = _dataCliente.idorg;
//     const idsede = _dataCliente.idsede;                    
//     const idusuario = _dataCliente.idusuario;                      
//     var _json = JSON.stringify(dataPedido).replace(/\\n/g, '')
//                                       .replace(/\\'/g, '')
//                                       .replace(/\\"/g, '')
//                                       .replace(/\\&/g, '')
//                                       .replace(/\\r/g, '')
//                                       .replace(/\\t/g, '')
//                                       .replace(/\\b/g, '')
//                                       .replace(/\\f/g, '');

//     const read_query = `call procedure_pwa_pedido_guardar(${idorg}, ${idsede}, ${idusuario},'${_json}')`;
//     return emitirRespuestaSP(read_query);        
// }
// module.exports.setNuevoPedido = setNuevoPedido;

const setNuevoPedido = async (dataCliente, dataPedido) => {
    console.log('pasa a =========== procedure_pwa_pedido_guardar 1');    
    const { idorg, idsede, idusuario } = dataPedido.dataUsuario ? dataPedido.dataUsuario : dataCliente;
    console.log('idorg, idsede, idusuario === ', idorg, idsede, idusuario);




    // Enfoque simplificado para sanitizar JSON
    // 1. Primero limpiamos el objeto para eliminar caracteres problemáticos
    const cleanObject = JSON.parse(JSON.stringify(dataPedido, (key, value) => {
        // Si es un string, limpiamos caracteres problemáticos
        if (typeof value === 'string') {
            return value
                .replace(/[\u0000-\u001F]/g, '') // Eliminar caracteres de control
                .replace(/[\u007F-\u009F]/g, '') // Eliminar caracteres de control adicionales
                .replace(/[\u200B-\u200D\uFEFF]/g, '') // Eliminar caracteres de ancho cero
                .replace(/\n/g, ' ') // Reemplazar saltos de línea por espacios
                .replace(/\r/g, ' ') // Reemplazar retornos de carro por espacios
                .replace(/\t/g, ' ') // Reemplazar tabulaciones por espacios
                .replace(/\f/g, ' '); // Reemplazar form feeds por espacios
        }
        return value;
    }));
    
    // 2. Convertir a JSON y escapar comillas simples para SQL
    let _json = JSON.stringify(cleanObject).replace(/'/g, "\\'"); // Escape single quotes
// Ya no necesitamos estos reemplazos adicionales



    const query = `CALL procedure_pwa_pedido_guardar(${idorg}, ${idsede}, ${idusuario},'${_json}')`;
    console.log(`CALL procedure_pwa_pedido_guardar(${idorg}, ${idsede}, ${idusuario},'${_json}')`);
    // return await emitirRespuestaSP(query);

    try {
        return await emitirRespuestaSP(query);
    } catch (error) {
        return ReE(res, error);
    }
};
module.exports.setNuevoPedido = setNuevoPedido;




// para evitar pedidos perdidos cuando el socket pierde conexion
// const setNuevoPedido2 = async function (req, res) {
    
//     // const idorg = dataCLiente.idorg;
//  //    const idsede = dataCLiente.idsede;                     
//  //    const idusuario = dataCLiente.idusuario;                   

//     // tomamos los datos del cliente del pedido y no del socket, puede estar haciendo conflicto
//     // y enviando a otros comercios
//     const dataPedido = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;    
//     const _dataCliente = dataPedido.dataUsuario
//     const idorg = _dataCliente.idorg;
//     const idsede = _dataCliente.idsede;                    
//     const idusuario = _dataCliente.idusuario;                      
//     var _json = JSON.stringify(dataPedido).replace(/\\n/g, '')
//                                       .replace(/\\'/g, '')
//                                       .replace(/\\"/g, '')
//                                       .replace(/\\&/g, '')
//                                       .replace(/\\r/g, '')
//                                       .replace(/\\t/g, '')
//                                       .replace(/\\b/g, '')
//                                       .replace(/\\f/g, '');

//     const read_query = `call procedure_pwa_pedido_guardar(${idorg}, ${idsede}, ${idusuario},'${_json}')`;
//     // console.log(read_query);
//     emitirRespuestaSP_RES(read_query, res);        


// para evitar pedidos perdidos cuando el socket pierde conexion
const setNuevoPedido2 = async (req, res) => {
    console.log('pasa a =========== procedure_pwa_pedido_guardar 2');
    const dataPedido = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    const _dataCliente = dataPedido.dataUsuario;
    const { idorg, idsede, idusuario } = _dataCliente;
    
    // Enfoque simplificado para sanitizar JSON
    // 1. Primero limpiamos el objeto para eliminar caracteres problemáticos
    const cleanObject = JSON.parse(JSON.stringify(dataPedido, (key, value) => {
        // Si es un string, limpiamos caracteres problemáticos
        if (typeof value === 'string') {
            return value
                .replace(/[\u0000-\u001F]/g, '') // Eliminar caracteres de control
                .replace(/[\u007F-\u009F]/g, '') // Eliminar caracteres de control adicionales
                .replace(/[\u200B-\u200D\uFEFF]/g, '') // Eliminar caracteres de ancho cero
                .replace(/\n/g, ' ') // Reemplazar saltos de línea por espacios
                .replace(/\r/g, ' ') // Reemplazar retornos de carro por espacios
                .replace(/\t/g, ' ') // Reemplazar tabulaciones por espacios
                .replace(/\f/g, ' '); // Reemplazar form feeds por espacios
        }
        return value;
    }));
    
    // 2. Convertir a JSON y escapar comillas simples para SQL
    const _json = JSON.stringify(cleanObject).replace(/'/g, "\\'");
    
    const query = `CALL procedure_pwa_pedido_guardar(${idorg}, ${idsede}, ${idusuario},'${_json}')`;

    try {
        return await emitirRespuestaSP_RES(query, res);
    } catch (error) {
        return ReE(res, error);
    }
};
module.exports.setNuevoPedido2 = setNuevoPedido2;
//     const idsede = dataCLiente.idsede;		              
//     const idusuario = dataCLiente.idusuario;		              
//     const read_query = `call procedure_pwa_print_comanda(${idorg}, ${idsede}, ${idusuario},'${JSON.stringify(dataPrint)}')`;
//     return emitirRespuestaSP(read_query);        
// }
// module.exports.setPrintComanda = setPrintComanda;

const setPrintComanda = async (dataCliente, dataPrint) => {
    const { idorg, idsede, idusuario } = dataCliente;
    const query = `CALL procedure_pwa_print_comanda(${idorg}, ${idsede}, ${idusuario},'${JSON.stringify(dataPrint)}')`;
    return await emitirRespuestaSP(query);
};
module.exports.setPrintComanda = setPrintComanda;

// const setPrinterOtherDocs = async function (req, res) {
//     const idorg = managerFilter.getInfoToken(req,'idorg');
//     const idsede = managerFilter.getInfoToken(req, 'idsede');
//     const idusuario = managerFilter.getInfoToken(req, 'idusuario');
//     const dataPrint = req.body.dataPrint;
//     const isprecuenta = req.body.isprecuenta || 0;
//     const read_query = `call procedure_pwa_print_comanda(${idorg}, ${idsede}, ${idusuario},'${JSON.stringify(dataPrint)}', ${isprecuenta})`;
//     // return emitirRespuestaSP(read_query);        
//     emitirRespuestaSP_RES(read_query, res);

// }
// module.exports.setPrinterOtherDocs = setPrinterOtherDocs;


const setPrinterOtherDocs = async (req, res) => {
    const idorg = managerFilter.getInfoToken(req, 'idorg');
    const idsede = managerFilter.getInfoToken(req, 'idsede');
    const idusuario = managerFilter.getInfoToken(req, 'idusuario');
    const dataPrint = req.body.dataPrint;
    const isprecuenta = req.body.isprecuenta || 0;
    const query = `CALL procedure_pwa_print_comanda(${idorg}, ${idsede}, ${idusuario},'${JSON.stringify(dataPrint)}', ${isprecuenta})`;
    return await emitirRespuestaSP_RES(query, res);
};
module.exports.setPrinterOtherDocs = setPrinterOtherDocs;


// const getLaCuenta = async function (req, res) {
// 	const idorg = req.body.idorg || managerFilter.getInfoToken(req,'idorg');
// 	const idsede = req.body.idsede || managerFilter.getInfoToken(req, 'idsede');
//     const mesa = req.body.mesa ? req.body.mesa : '0';
//     const idpedido = req.body.idpedido ? req.body.idpedido : '';

//     console.log('req.body', req.body)
    
// 	const read_query = `call procedure_bus_pedido_bd_3051(${mesa}, '', '${idpedido}', ${idorg}, ${idsede}, 0, -1);`;	
//     emitirRespuestaSP_RES(read_query, res);

//     // const read_query = `call procedure_pwa_print_comanda(${idorg}, ${idsede}, ${idusuario},'${JSON.stringify(dataPrint)}')`;
//     // return emitirRespuestaSP(read_query);        
// }
// module.exports.getLaCuenta = getLaCuenta;
let debounceTimes = {};
let debounceKeys = [];
const getLaCuenta = async (req, res) => {
    const idorg = req.body.idorg || managerFilter.getInfoToken(req, 'idorg');
    const idsede = req.body.idsede || managerFilter.getInfoToken(req, 'idsede');
    const mesa = req.body.mesa ? req.body.mesa : '0';
    const idpedido = req.body.idpedido ? req.body.idpedido : '';
    
    const key = `${idorg}-${idsede}-${mesa}-${idpedido}`;
    const now = Date.now();
    const lastTime = debounceTimes[key];    

    if (lastTime && now - lastTime < 3000) {
        console.log('menos de 3seg');
        // Si la última solicitud fue hace menos de 2 segundos, no procesar la solicitud
        return res.status(429).json({ error: 'Too Many Requests' });
    }
    debounceTimes[key] = now;
    debounceKeys.push(key);

    // Si debounceTimes tiene más de 60 elementos, eliminar los primeros 40
    if (debounceKeys.length > 60) {
        for (let i = 0; i < 40; i++) {
            const keyToRemove = debounceKeys.shift();
            delete debounceTimes[keyToRemove];
        }
    }

    const query = `CALL procedure_bus_pedido_bd_3051(${mesa}, '', '${idpedido}', ${idorg}, ${idsede}, 0, -1);`;
    return await emitirRespuestaSP_RES(query, res);
};
module.exports.getLaCuenta = getLaCuenta;

// la cuenta desde el cliente

const getLaCuentaFromCliente = async function (req, res) {	
	const idsede = req.body.idsede;
    const idcliente = req.body.idcliente;
    const num_mesa = req.body.num_mesa;

	const read_query = `call procedure_pwa_cuenta_cliente(${idcliente}, ${idsede}, ${num_mesa});`;	
    return await emitirRespuestaSP_RES(read_query, res); 
}
module.exports.getLaCuentaFromCliente = getLaCuentaFromCliente;


// la cuenta desde el cliente - solo totales
const getLaCuentaFromClienteTotales = async function (req, res) {	
	const idsede = req.body.idsede;
    const idcliente = req.body.idcliente;
    const num_mesa = req.body.num_mesa;
    const idpedido = req.body.idpedido ? req.body.idpedido : null;

	const read_query = `call procedure_pwa_cuenta_cliente_totales(${idcliente}, ${idsede}, ${idpedido}, ${num_mesa});`;	
    return await emitirRespuestaSP_RES(read_query, res); 
}
module.exports.getLaCuentaFromClienteTotales = getLaCuentaFromClienteTotales;

const getLaCuentaFromPedidoTotales = async function (req, res) {
    const idpedido = req.body.idpedido;

	const read_query = `call procedure_pwa_cuenta_cliente_totales('', '', ${idpedido});`;	
    return await emitirRespuestaSP_RES(read_query, res); 
}
module.exports.getLaCuentaFromPedidoTotales = getLaCuentaFromPedidoTotales;


const getConsultaDatosCliente = async function (req, res) {
	// const idorg = managerFilter.getInfoToken(req,'idorg');
	const idsede = managerFilter.getInfoToken(req, 'idsede');
    const onlySede = req.body.only_sede || false;
    const doc = req.body.documento;    
    // const _str_only_sede = onlySede ? ' and idsede = ' + idsede : ''; 
    var read_query = '';

    if ( onlySede ) {
        read_query = `SELECT * FROM cliente c 
                        inner join cliente_sede cs on c.idcliente = cs.idcliente 
                    where c.estado=0 and c.ruc='${doc}' and cs.idsede = ${idsede} order by nombres limit 1`;
    } else {
        read_query = `SELECT * FROM cliente where estado=0 and ruc='${doc}' order by nombres limit 1`;  
    }

    console.log('doc cliente: ', doc);
    // idorg=${idorg}) AND 
	// const read_query = `SELECT * FROM cliente where estado=0 and ruc='${doc}' ${_str_only_sede} order by nombres limit 1`;	
    return await emitirRespuesta_RES(read_query, res);
}
module.exports.getConsultaDatosCliente = getConsultaDatosCliente;

const getConsultaDatosClienteNoTk = async function (req, res) {
    // const idorg = managerFilter.getInfoToken(req,'idorg');
    // const idsede = managerFilter.getInfoToken(req, 'idsede');
    const doc = req.body.documento;

    // console.log('doc cliente: ', doc);
    // idorg=${idorg}) AND 
    // const read_query = `SELECT * FROM cliente where estado=0 and ruc='${doc}' order by pwa_id desc, telefono desc limit 1`;    
    const read_query = `SELECT * FROM cliente where estado=0 and pwa_id='dni|${doc}' and ruc='${doc}' order by pwa_id desc, telefono desc, pwa_code_verification desc limit 1`;    
    return await emitirRespuesta_RES(read_query, res);
}
module.exports.getConsultaDatosClienteNoTk = getConsultaDatosClienteNoTk;


// guarda los datos de facturacion que especifica el usuario desde pwa
const setDatosFacturacionClientePwa = async function (req, res) {
    const data = req.body;
    const read_query = `call procedure_set_datos_facturacion_pwa('${JSON.stringify(data)}');`;   
    return await emitirRespuestaSP_RES(read_query, res); 
}
module.exports.setDatosFacturacionClientePwa = setDatosFacturacionClientePwa;

// datos al inicio despues de escanear codigo
const getDataSedeIni = async function (req, res) {	
	const idsede = req.body.idsede;
    // console.log('cuenta de mesa: ', mesa);
	const read_query = `SELECT idsede, idorg, nombre, eslogan, pwa_msj_ini, pwa_time_limit, pwa_delivery_comercio_online from sede where (idsede=${idsede}) AND estado=0`;	
    return await emitirRespuesta_RES(read_query, res);
}
module.exports.getDataSedeIni = getDataSedeIni;

const getIdSedeFromNickName = async function (req, res) {  
    const nomsede = req.body.nomsede;
    // console.log('cuenta de mesa: ', mesa);
    const read_query = `SELECT idsede, idorg, nombre, eslogan, pwa_msj_ini, pwa_time_limit, is_holding from sede where link_carta='${nomsede}' AND estado=0`;    
    return await emitirRespuesta_RES(read_query, res);
}
module.exports.getIdSedeFromNickName = getIdSedeFromNickName;


const getReglasApp = async function (req, res) {	
	const read_query = `SELECT * from pwa_reglas_app where estado=0`;	
    return await emitirRespuesta_RES(read_query, res);
}
module.exports.getReglasApp = getReglasApp;

const getConsAppDelivery = async function (req, res) {	
	const read_query = `SELECT value from sys_const where llave in ('DELIVERY_CANTIDAD_ITEMS_ESCALA', 'DELIVERY_COSTO_ITEMS_ESCALA')`;	
    return await emitirRespuesta_RES(read_query, res);
}
module.exports.getConsAppDelivery = getConsAppDelivery;


const setRegisterClienteLogin = async function (req, res) {
	// const idorg = req.body.idorg;
	const dataLogin = req.body;
	const read_query = `call procedure_pwa_register_cliente_login('${JSON.stringify(dataLogin)}')`;

    return await emitirRespuestaSP_RES(read_query, res); 
}
module.exports.setRegisterClienteLogin = setRegisterClienteLogin;

const getCalcTimeDespacho = async function (req, res) {	
	const idsede = req.body.idsede;
	const read_query = `call procedure_pwa_calc_time_despacho('${idsede}')`;

    return await emitirRespuestaSP_RES(read_query, res); 
}
module.exports.getCalcTimeDespacho = getCalcTimeDespacho;


// encuesta al terminar de pagar la cuenta // agarra la primer encuesta por los momentos
const getEncuesta = async function (req, res) {	
    const idsede = req.body.idsede;
        
    const read_query = `SELECT preguntas from encuesta_sede_conf where idsede=${idsede} and estado=0 limit 1`;
    // return emitirRespuestaSP(read_query);      
    return await emitirRespuesta_RES(read_query, res);  
}
module.exports.getEncuesta = getEncuesta;

// opciones de la encuesta, bueno, excelente ...
const getEncuestaOpRespuesta = async function (req, res) {	
    const idsede = req.body.idsede;
        
    const read_query = `select * from encuesta_respuesta where estado=0`;
    // return emitirRespuestaSP(read_query);      
    return await emitirRespuesta_RES(read_query, res);  
}
module.exports.getEncuestaOpRespuesta = getEncuestaOpRespuesta;


// guadar encuensta
const setEncuestaGuardar = async function (req, res) {	
	const id = req.body.i;
	const item = req.body.item;
	const read_query = `call procedure_save_encuesta(${id}, '${JSON.stringify(item)}')`;

    return await emitirRespuestaSP_RES(read_query, res); 
}
module.exports.setEncuestaGuardar = setEncuestaGuardar;

// sede obtener  pwa_requiere_gps  > si sede requiere geolocalizacion
const getSedeRequiereGPS = async function (req, res) {	
    const idsede = req.body.idsede;
        
    const read_query = `select pwa_requiere_gps, is_holding from sede where idsede=${idsede} and estado=0`;
    // return emitirRespuestaSP(read_query);      
    return await emitirRespuesta_RES(read_query, res);  
}
module.exports.getSedeRequiereGPS = getSedeRequiereGPS;


// cliente log por dni, buscar
const getUsuarioClietenByDNI = async function (req, res) {	
    const numdocumento = req.body.documento;
        
    const read_query = `select * from cliente where ruc='${numdocumento}' and estado=0`;
    // return emitirRespuestaSP(read_query);      
    return await emitirRespuesta_RES(read_query, res);  
}
module.exports.getUsuarioClietenByDNI = getUsuarioClietenByDNI;


// cliente perfil
const getClientePerfil = async function (req, res) {	
    const idcliente = req.body.idcliente;
        
    const read_query = `select * from cliente where idcliente='${idcliente}' and estado=0`;
    // return emitirRespuestaSP(read_query);      
    return await emitirRespuesta_RES(read_query, res);  
}
module.exports.getClientePerfil = getClientePerfil;

const setClientePerfil = async function (req, res) {	
    const idcliente = req.body.idcliente;
        
    const read_query = `update cliente set ruc='${req.body.ruc}', email='${req.body.email}', f_nac='${req.body.f_nac}' where idcliente=${idcliente}`;
    // return emitirRespuestaSP(read_query);      
    return await emitirRespuesta_RES(read_query, res);
}
module.exports.setClientePerfil = setClientePerfil;

// guarda direccion de cliente pwa
const setClienteNewDireccion = async function (req, res) {	
	// const id = req.body.i;
	const _data = req.body;
	const read_query = `call procedure_pwa_guardar_direccion_cliente('${JSON.stringify(_data)}')`;

    return await emitirRespuestaSP_RES(read_query, res); 
}
module.exports.setClienteNewDireccion = setClienteNewDireccion;


const setHistoryError = async function (req, res) {	
    const _elerror = req.body.elerror;
    const _elorigen = req.body.elorigen;
        
    const read_query = `insert into  historial_error(fecha, error, origen) values (now(), '${JSON.stringify(_elerror)}', '${_elorigen}')`;
    // return emitirRespuestaSP(read_query);      
    return await emitirRespuesta_RES(read_query, res);  
}
module.exports.setHistoryError = setHistoryError;

const getAllClienteBySearch = async function (req, res) {
    const read_query = `call pwa_delivery_get_all_clientes()`;
    return await emitirRespuestaSP_RES(read_query, res); 
}
module.exports.getAllClienteBySearch = getAllClienteBySearch;

const getAllClienteBySearchName = async function (req, res) {
    const buscar = req.body.buscar;
    const idsede = managerFilter.getInfoToken(req, 'idsede');
    const onlySede = req.body.only_sede || false;
    // const _str_only_sede = onlySede ? ' and idsede = ' + idsede : ''; 
    var read_query = '';

    if ( onlySede ) {
        read_query = `SELECT c.idcliente, c.nombres, c.ruc, c.telefono FROM cliente c 
                        inner join cliente_sede cs on c.idcliente = cs.idcliente 
                    where c.estado=0 and c.nombres!='' and cs.idsede = ${idsede} and LENGTH(c.nombres) > 10 and c.nombres like '%${buscar}%' group by c.nombres order by c.nombres`;
    } else {
        read_query = `select idcliente, nombres, ruc, telefono from cliente where estado=0 and nombres!='' and LENGTH(nombres) > 10 and nombres like '%${buscar}%' group by nombres order by nombres`;
    }
    
    return await emitirRespuesta_RES(read_query, res); 
}
module.exports.getAllClienteBySearchName = getAllClienteBySearchName;

const getLastComisionEntrega = async function (req, res) {    
    const code_postal = req.body.codigo_postal;
        
    const read_query = `select * from sede_config_service_delivery where codigo_postal like '%${code_postal}%' limit 1`;
    // return emitirRespuestaSP(read_query);      
    return await emitirRespuesta_RES(read_query, res);  
}
module.exports.getLastComisionEntrega = getLastComisionEntrega;


const getCanalesConsumo = async function (req, res) {    
    const idsede = req.body.idsede;
    const read_query = `SELECT idtipo_consumo, descripcion, titulo from tipo_consumo where idsede=${idsede} and estado=0`;
    return await emitirRespuesta_RES(read_query, res);        
}
module.exports.getCanalesConsumo = getCanalesConsumo;

const setRegisterScanQr = async function (req, res) {    
    const idsede = req.body.idsede;
    const canal = req.body.canal;
    const idscan = req.body.idscan || 0;
        
    const read_query = `call procedure_register_scan_qr(${idsede}, '${canal}', ${idscan})`;
    // return emitirRespuestaSP(read_query);      
    return await emitirRespuestaSP_RES(read_query, res);  
}
module.exports.setRegisterScanQr = setRegisterScanQr;

// enviado desde el servidor de impresion
const setFlagPrinter = async function (id) {                
    const read_query = `update print_server_detalle set impreso=1 where idprint_server_detalle=${id}`;    
    return await emitirRespuestaSP(read_query);
}
module.exports.setFlagPrinter = setFlagPrinter;

const setFlagPrinterChangeEstadoPedido = async function (id) {                
    const read_query = `update pedido set pwa_estado='A' where idpedido=${id}`;    
    return await emitirRespuestaSP(read_query);
}
module.exports.setFlagPrinterChangeEstadoPedido = setFlagPrinterChangeEstadoPedido;


// busca los subitems del item seleccionado, para hacer mas rapida la consulta
const getSearchSubitemsItem = async function (iditem) {    
    // const iditem = req.body.iditem;
        
    const read_query = `call porcedure_pwa_pedido_carta_get_subitens(${iditem})`;
    // return emitirRespuestaSP(read_query);      
    // emitirRespuestaSP_RES(read_query, res);
    return await emitirRespuestaSP(read_query);  
}
module.exports.getSearchSubitemsItem = getSearchSubitemsItem;


const setCodigoVerificacionTelefonoCliente =  async function (data) {    
    // const iditem = req.body.iditem;
    const numTelefono = parseInt(data.idcliente) < 0 ? data.numberphone : '';
    const read_query = `call porcedure_pwa_update_phono_sms_cliente(${data.idcliente},'${numTelefono}', '${data.cod}')`;    
    return await emitirRespuestaSP(read_query);  
}
module.exports.setCodigoVerificacionTelefonoCliente = setCodigoVerificacionTelefonoCliente;

const saveCallClientMesa =  async function (data, op) {        
    const read_query = `call procedure_pwa_call_client_mesa('${JSON.stringify(data)}', ${op})`;
    return await emitirRespuestaSP(read_query);
}
module.exports.saveCallClientMesa = saveCallClientMesa;

const listCallClientMesa =  async function (data) {        
    const read_query = `SELECT num_mesa from cliente_solicita_atencion_mesa where idsede=${data.idsede} and atendido=0`;
    return await emitirRespuesta(read_query);    
}
module.exports.listCallClientMesa = listCallClientMesa;


// datos de facturacion
const getComprobantesSede = async function (req, res) {   
    const idsede = req.body.idsede;    
    const read_query = `SELECT tc.idtipo_comprobante, tc.descripcion from tipo_comprobante_serie tcs 
                        inner join tipo_comprobante tc on tcs.idtipo_comprobante = tc.idtipo_comprobante 
                        where tcs.idsede = ${idsede} and tcs.estado = 0 and tc.codsunat != '0'`;
    
    return await emitirRespuesta_RES(read_query, res);
}
module.exports.getComprobantesSede = getComprobantesSede;


const getLastPedidoClienteThisTable = async function (req, res) {   
    const idsede = req.body.idsede;    
    const nummesa = req.body.nummesa;   
    const read_query = `select p.referencia, TIMESTAMPDIFF(MINUTE, p.fecha_hora, now()) min 
                        from pedido p left join pedido_correlativos pc on pc.idsede = p.idsede 
                        where p.idpedido > pc.last_id_pedido_cierre and p.idsede=${idsede} and p.flag_is_cliente = 1 and p.nummesa = ${nummesa} and p.estado = 0 order by p.idpedido desc limit 1`;
    
    return await emitirRespuesta_RES(read_query, res);
}
module.exports.getLastPedidoClienteThisTable = getLastPedidoClienteThisTable;


const getListMesas = async function (req, res) {   
    const idsede = req.body.idsede;    
    const obj = req.body.obj;       
    let read_query = '';

    if ( obj ) {
        read_query = `call procedure_refresh_mesas_list_mozo(${idsede}, '${JSON.stringify(obj)}')`;    
    } else {
        read_query = `call procedure_refresh_mesas_list_mozo(${idsede}, null)`;    
    }
    
    return await emitirRespuestaSP_RES(read_query, res);
}
module.exports.getListMesas = getListMesas;


const updateTimeLinePedido = async function (idpedido,time_line) {
    const read_query = `insert into pedido_time_line_entrega (idpedido, time_line) values (${idpedido}, '${JSON.stringify(time_line)}') ON DUPLICATE KEY UPDATE time_line = '${JSON.stringify(time_line)}'`;
    // console.log('updateTimeLinePedido', read_query);
    return await emitirRespuesta(read_query);        
}
module.exports.updateTimeLinePedido = updateTimeLinePedido;

// const setUserAccountRemove = async function (req, res) { 
//     const user = req.body.user;      
//     console.log('user remove', user);
//     if ( user.isCliente ) {
//         const read_query = `update usuario set estado=1 where idusuario=${idusuario}`;
//         emitirRespuestaSP(read_query);                
//     }
//     res.status(200).json({success: true})
// }
// module.exports.setUserAccountRemove = setUserAccountRemove;

const setUserAccountRemove = async (req, res) => {
    const user = req.body.user;
    // console.log('user remove', user);

    try {
        if (user.isCliente) {
            const read_query = `UPDATE usuario SET estado = 1 WHERE idusuario = ${user.idusuario}`;
            return await emitirRespuestaSP(read_query);
        }

        res.status(200).json({ success: true });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, error: 'An error occurred.' });
    }
};
module.exports.setUserAccountRemove = setUserAccountRemove;

// listar todos los mozos para change user
const getAllMozosChangeUser = async function (req, res) {
    const idsede = managerFilter.getInfoToken(req, 'idsede');
    const read_query = `select idusuario, nombres, usuario from usuario where idsede=${idsede} and estado=0 and acc like '%A2%'`;
    return await emitirRespuesta_RES(read_query, res);    
}
module.exports.getAllMozosChangeUser = getAllMozosChangeUser;

// solicitud remoto de borrar
const updatePermissionDeleteItemPedido = async function (idpedido_detalle) {
    const read_query = `update pedido_detalle set permission_delete = '1' where idpedido_detalle=${idpedido_detalle}`;
    await ejecutarQuery(read_query);        
}
module.exports.updatePermissionDeleteItemPedido = updatePermissionDeleteItemPedido;

// solicitud remoto de borrar
const updatePermissionDeleteAllPedido = async function (idpedido) {
    const read_query = `update pedido set permission_delete = '1' where idpedido in (${idpedido})`;
    await ejecutarQuery(read_query);        
}
module.exports.updatePermissionDeleteAllPedido = updatePermissionDeleteAllPedido;

// solicitud cambiar metodo de pago
const updatePermissionChangeMetodoPago = async function (idregistro_pago_detalle) {
    const read_query = `update registro_pago_detalle set permission_change = '1' where idregistro_pago_detalle = ${idregistro_pago_detalle}`;
    await ejecutarQuery(read_query);        
}
module.exports.updatePermissionChangeMetodoPago = updatePermissionChangeMetodoPago;

const updatePermissionRemoveRegistroPago = async function (idregistro_pago) {
    const read_query = `update registro_pago set permission_delete = '1' where idregistro_pago = ${idregistro_pago}`;
    await ejecutarQuery(read_query);        
}
module.exports.updatePermissionRemoveRegistroPago = updatePermissionRemoveRegistroPago;

const calculateQuantity = (item) => {

    // si la cantidad es un string como una operacion matematica como '5-1' o '4+1' entonces resolverla
    console.log('item.cantidad ====', item.cantidad);
    if (typeof item.cantidad === 'string' && item.cantidad.match(/[\+\-\*\/]/)) {
        item.cantidad = 1;
    }
    console.log('item.cantidad ====', item.cantidad);


    if ( !item.cantidad && item.isporcion === 'SP' ) {
        item.cantidad = item.cantidad_seleccionada || 1;
    }

    // convertir la cantidad a int
    item.cantidad = item.cantidad !== 'ND' && item.cantidad !== 'SP' && item.cantidad === undefined ? parseInt(item.cantidad) : item.cantidad;



    item.cantidad = isNaN(item.cantidad) || item.cantidad === null || item.cantidad === undefined ? 'ND' : item.cantidad;
    item.cantidad = parseInt(item.cantidad) >= 9999 ? item.isporcion || 'ND' : item.cantidad;
    if (item.cantidad != 'ND') {
        var _cantSumar = item.venta_x_peso === 1 ? -item.cantidad : item.sumar ? -1 : parseInt(item.sumar) === 0 ? 0 : 1;
        item.cantidadSumar = _cantSumar;
    }
    return item;
}
module.exports.calculateQuantity = calculateQuantity;

const updateSubItems = (item, listSubItems) => {
    if (listSubItems && item.subitems) {
        try {
            listSubItems.map(subitem => {
                item.subitems.map(s => {
                    if (s.opciones && Array.isArray(s.opciones)) {
                        let itemFind = s.opciones.filter(_subItem => parseInt(_subItem.iditem_subitem) === parseInt(subitem.iditem_subitem))[0];
                        if (itemFind) {
                            itemFind.cantidad = subitem.cantidad;
                        }
                    }
                });
            });
        } catch (error) {
            console.log(error);
        }
    }
    return item;
}
module.exports.updateSubItems = updateSubItems;


const saveCallMozoHolding = (data) => {
    const {idpedido, idusuario} = data;
    const read_query = `insert into sede_holding_call_pedido_listo(fecha, idpedido, idusuario, data) values (now(), ${idpedido}, ${idusuario}, '${JSON.stringify(data)}')`;
    return emitirRespuesta(read_query);
}
module.exports.saveCallMozoHolding = saveCallMozoHolding;

const saveCallMozoHoldingEstado = (idpedido) => {
    const read_query = `update sede_holding_call_pedido_listo set estado='1' where idpedido=${idpedido}`;
    return emitirRespuesta(read_query);
}
module.exports.saveCallMozoHoldingEstado = saveCallMozoHoldingEstado;

const getListCallMozoHolding = async function (req, res) {
    const idusuario= managerFilter.getInfoToken(req, 'idusuario');
    const read_query = `select * from sede_holding_call_pedido_listo where estado=0 and idusuario=${idusuario}`;
    return await emitirRespuesta_RES(read_query, res);    
}
module.exports.getListCallMozoHolding = getListCallMozoHolding;

// separar proceso de actualizar stock de porcedure_pwa_update_cantidad_item

// async function processItem(item, idsede) {
//     let result = [{
//         cantidad: null,
//         listItemsPorcion: null,
//         listSubItems: null
//     }];

//     const _item = {
//         iditem: item.iditem,
//         idcarta_lista: item.idcarta_lista,
//         cantidad_reset: item.cantidad_reset,
//         cantidadSumar: item.cantidadSumar,
//         isporcion: item.isporcion,
//         iditem2: item.iditem2        
//     }

//     let updatedItem;    
//     try {     
//         updatedItem = await emitirRespuestaSP(`call procedure_stock_item('${JSON.stringify(_item)}', ${idsede})`);    
//         result[0].cantidad = updatedItem[0].cantidad;
//         return result;
//     } catch (error) {
//         const sqlQuery = `call procedure_stock_item('${JSON.stringify(_item)}', ${idsede})`;
//         const dataError = {
//             incidencia: {
//                 message: error,
//                 data: {
//                     item_process: _item,                    
//                     query: sqlQuery,
//                     res_query: updatedItem
//                 }
//             },
//             origen: 'processItem'            
//         }
//         errorManager.logError(dataError);
//         console.error('processItem====', error);
//     }
        
//     // cambiamos 220624 -> no funciono, mas funciona lo antrior a esto
//     //     try {
//     //         // Calcular la cantidad a actualizar
//     //         let cantidadUpdate = item.cantidad_reset ? item.cantidad_reset : item.cantidadSumar;
//     //         // Iniciar una transacción
//     //         const t = await sequelize.transaction();
            
//     //         // esto porque puede venir de monitoreo de stock
//     //         // cantidadUpdate = cantidadUpdate === 0 ? item.cantidad : cantidadUpdate;
//     //         console.log('0cantidadUpdate', cantidadUpdate);
                            
//     //         // Actualizar la cantidad en la tabla carta_lista
//     //         await sequelize.query(`
//     //             UPDATE carta_lista 
//     //             SET cantidad = cantidad + :cantidadUpdate 
//     //             WHERE idcarta_lista = :idcarta_lista
//     //         `, {
//     //             replacements: { cantidadUpdate, idcarta_lista: item.idcarta_lista },
//     //             type: sequelize.QueryTypes.UPDATE,
//     //             transaction: t
//     //         });

//     //         await t.commit();
            

//     //         // Obtener la cantidad actualizada
//     //         const updatedItem = await sequelize.query(`
//     //             SELECT cantidad 
//     //             FROM carta_lista 
//     //             WHERE idcarta_lista = :idcarta_lista
//     //         `, {
//     //             replacements: { idcarta_lista: item.idcarta_lista },
//     //             type: sequelize.QueryTypes.SELECT,                
//     //         });            
            
//     //         result[0].cantidad = updatedItem[0].cantidad;

//     //         result[0].cantidad = updatedItem[0].cantidad;
           

//     //     } catch (err) {
//     //         // await t.rollback();

//     //         let errorObject = {
//     //             message: err.message,
//     //             error: err
//     //         };
            
//     //         sequelize.query(`
//     //             INSERT INTO historial_error (fecha, error, origen) 
//     //             VALUES (:fecha, :error, :origen)
//     //         `, {
//     //             replacements: { 
//     //                 fecha: new Date(), 
//     //                 error: JSON.stringify(errorObject), 
//     //                 origen: 'processItem update cantidad carta_lista' 
//     //             },
//     //             type: sequelize.QueryTypes.INSERT,
//     //             transaction: t
//     //         });

//     //         await t.commit();



//     //         console.error(err);
//     //         // Maneja el error de la manera que prefieras
//     //     }    

//     // return result;
// }
// module.exports.processItem = processItem;


// async function processItemPorcion(item) {    
//     let result = [{
//         cantidad: null,
//         listItemsPorcion: null,
//         listSubItems: null
//     }];

//     const _idItemUpdate = item.iditem === item.idcarta_lista ? item.iditem2 : item.iditem;

//     // mandamos como item solo los datos necesarios para actualizar
//     let updatedItem; 
//     let _itemProcessPorcion = {};
//     try { 
//         _itemProcessPorcion = {
//             iditem: item.iditem,
//             idcarta_lista: item.idcarta_lista,
//             cantidad_reset: item.cantidad_reset,
//             cantidadSumar: item.cantidadSumar,
//             isporcion: item.isporcion,
//             iditem2: item.iditem2        
//         }       
           
//         updatedItem = await emitirRespuestaSP(`call procedure_stock_item_porcion('${JSON.stringify(_itemProcessPorcion)}')`);    
//         console.log('updatedItem', updatedItem);
//         result[0].listItemsPorcion = updatedItem[0].listItemsPorcion;
//         const listItemsJson = JSON.parse(updatedItem[0].listItemsPorcion)
    
//         // buscamos en result[0].listItemsPorcion la cantidad segun item
//         const itemCantidad = listItemsJson.filter(i => i.iditem == _idItemUpdate);
//         result[0].cantidad = itemCantidad[0].cantidad;
//         return result;
//     } catch (error) {
//         const sqlQuery = `call procedure_stock_item_porcion('${JSON.stringify(_itemProcessPorcion)}')`;

//         const dataError = {
//             incidencia: {
//                 message: error.toString(),
//                 data: {
//                     item_process: _itemProcessPorcion,
//                     // item: item,
//                     query: sqlQuery,
//                     res_query: updatedItem
//                 }
//             },
//             origen: 'processItemPorcion'
//         }
//         errorManager.logError(dataError);

//         console.error('processItemPorcion====', error);
//     }
    
//     // cambiamos 220624 -> no funciono, mas funciona lo antrior a esto
//     // const t = await sequelize.transaction();
//     // try {
//     //     let cantidadUpdate = item.cantidad_reset ? item.cantidad_reset : item.cantidadSumar;
//     //     console.log('cantidadUpdate', cantidadUpdate);
//     //     // Actualizar la cantidad en la tabla porcion

//     //     const _idItemUpdate = item.iditem === item.idcarta_lista ? item.iditem2 : item.iditem;

//     //     await sequelize.query(`
//     //         UPDATE porcion AS p
// 	// 			LEFT JOIN item_ingrediente AS ii using (idporcion)
// 	// 		 SET p.stock = p.stock + (:cantidadUpdate * (ii.cantidad))
//     //         WHERE ii.iditem = :xIdItem
//     //     `, {
//     //         replacements: { cantidadUpdate, xIdItem: _idItemUpdate },
//     //         type: sequelize.QueryTypes.UPDATE,
//     //         transaction: t
//     //     })
//     //     // Actualizar la cantidad en la tabla producto_stock si esta relacionados con productos
//     //     await sequelize.query(`
//     //         UPDATE producto_stock AS ps
// 	// 			LEFT JOIN item_ingrediente AS ii using (idproducto_stock)					
// 	// 		SET ps.stock= ps.stock + (:cantidadUpdate * (ii.cantidad))
//     //         WHERE ii.iditem = :xIdItem
//     //     `, {
//     //         replacements: { cantidadUpdate, xIdItem: _idItemUpdate },
//     //         type: sequelize.QueryTypes.UPDATE,
//     //         transaction: t
//     //     })

//     //     await t.commit();

//     //     let updatedItem;
//     //     if (item.isporcion === 'SP') {
//     //         console.log('query iditem', item.iditem);
//     //         const t_cantidad = await sequelize.transaction();
//     //         updatedItem = await sequelize.query(`
//     //         SELECT FLOOR(
//     //             IF (
//     //                 SUM(i1.necesario) >= 1, 
//     //                 IF(i1.viene_de='1', MIN(CAST(p1.stock AS SIGNED)), MIN(CAST(ps.stock AS SIGNED))),
//     //                 IF(i1.viene_de='1', CAST(p1.stock AS SIGNED), CAST(ps.stock AS SIGNED))
//     //             ) / i1.cantidad
//     //         ) AS cantidad 
//     //         FROM item_ingrediente AS i1 
//     //         LEFT JOIN porcion AS p1 ON i1.idporcion=p1.idporcion 
//     //         LEFT JOIN producto_stock ps ON ps.idproducto_stock = i1.idproducto_stock
//     //         WHERE i1.iditem = :iditem 
//     //         GROUP BY i1.iditem, i1.necesario 
//     //         ORDER BY i1.necesario DESC, i1.iditem_ingrediente 
//     //         LIMIT 1
//     //         `, {
//     //             replacements: { iditem: _idItemUpdate },
//     //             type: sequelize.QueryTypes.SELECT,  
//     //             transaction: t_cantidad              
//     //         });
//     //         await t_cantidad.commit();
//     //     } else {
//     //         updatedItem = await sequelize.query(`
//     //             SELECT cantidad 
//     //                 FROM carta_lista 
//     //             WHERE idcarta_lista = :idcarta_lista
//     //         `, {
//     //             replacements: { idcarta_lista: item.idcarta_lista },
//     //             type: sequelize.QueryTypes.SELECT,                
//     //         });
//     //     }

//     //     console.log('updatedItem', updatedItem);

//     //     result[0].cantidad = updatedItem[0].cantidad;

//     // } catch (error) {
//     //     console.error(error);
//     // }

//     // return result;

// }
// module.exports.processItemPorcion = processItemPorcion;

// async function processAllItemSubitemSeleted(allItems) {
    
//     // const sqlQuery = `call procedure_stock_all_subitems('${JSON.stringify(allItems)}')`;
//     let updatedItem;
//     try {        
//         updatedItem = await emitirRespuestaSP(`call procedure_stock_all_subitems('${JSON.stringify(allItems)}')`);
//         console.log('updatedItem', updatedItem);
//         return updatedItem;
//     } catch (error) {
//         const sqlQuery = `call procedure_stock_all_subitems('${JSON.stringify(allItems)}')`;

//         const dataError = {
//             incidencia: {
//                 message: error,
//                 data: {
//                     item_process: _item,                    
//                     query: sqlQuery,
//                     res_query: updatedItem
//                 }
//             },
//             origen: 'processAllItemSubitemSeleted'            
//         }
//         errorManager.logError(dataError);

//         console.error('processAllItemSubitemSeleted====', error);        
//     }
//     // result[0].listItemsPorcion = updatedItem[0].cantidad;
// }
// module.exports.processAllItemSubitemSeleted = processAllItemSubitemSeleted;


// cambiamos 220624 -> no funciono, mas funciona lo antrior a esto
// async function processItemSubitemSeleted(subitem_selected, cantidadSumar) {    
//     console.log('subitem_selected', subitem_selected);
//     console.log('cantidadSumar', cantidadSumar);
//     const t = await sequelize.transaction();
//     if ( subitem_selected.idporcion > 0 ) {
//         try {
//             await sequelize.query(`
//                 UPDATE porcion 
//                 SET stock = stock + :cantidad 
//                 WHERE idporcion = :idporcion
//             `, {
//                 replacements: { cantidad: cantidadSumar, idporcion: subitem_selected.idporcion },
//                 type: sequelize.QueryTypes.UPDATE,
//                 transaction: t
//             });
//         } catch (error) {
//             console.error(error);
//         }    
//     }

//     if ( subitem_selected.idproducto > 0 ) {
//         try {
//             await sequelize.query(`
//                 UPDATE producto_stock 
//                 SET stock = stock + :cantidad 
//                 WHERE idproducto_stock = :idproducto
//             `, {
//                 replacements: { cantidad: cantidadSumar, idproducto: subitem_selected.idproducto },
//                 type: sequelize.QueryTypes.UPDATE,
//                 transaction: t
//             });
//         } catch (error) {
//             console.error(error);
//         }
//     }

//     // si acaso no es porcion ni porducto
//     if ( subitem_selected.cantidad !== 'ND' && subitem_selected.idporcion === 0 && subitem_selected.idproducto === 0 ) {
//         try {
//             await sequelize.query(`
//                 UPDATE item_subitem 
//                 SET cantidad = cantidad + :cantidad 
//                 WHERE iditem_subitem = :iditem_subitem
//             `, {
//                 replacements: { cantidad: cantidadSumar, iditem_subitem: subitem_selected.iditem_subitem },
//                 type: sequelize.QueryTypes.UPDATE,
//                 transaction: t
//             });
//         } catch (error) {
//             console.error(error);
//         }
//     }

//     await t.commit();
// }
// module.exports.processItemSubitemSeleted = processItemSubitemSeleted;


async function processAndEmitItem(item, chanelConect, io, idsede, notificar = true) {
    let rpt;
    try {
        item = calculateQuantity(item);

        // vemos si tiene subitems con cantidad distinta de ND
        // si los tiene entonces no se modifica el stock
        let _existSubItemsWithCantidadInND = false;
        console.log('_existSubItemsWithCantidadInND', _existSubItemsWithCantidadInND);
        if (item.cantidad == 'ND') {
            _existSubItemsWithCantidadInND = handleStock.checkExistSubItemsWithCantidad(item);
            if (_existSubItemsWithCantidadInND) {
                item.cantidad = 'SUBITEM-CANTIDAD'; // para manejar solo los subitems
            }
        }
        
        if (item.cantidad !== 'ND') {
            const rptCantidad = await setItemCarta(0, item, idsede);            
            console.log('rptCantidad', rptCantidad);
            item.cantidad = _existSubItemsWithCantidadInND ? 'ND' : rptCantidad[0].cantidad;

            // Check if rptCantidad[0] and listSubItems exist before using them
            const listSubItems = rptCantidad[0] && rptCantidad[0].listSubItems ? rptCantidad[0].listSubItems : null;
            item = updateSubItems(item, listSubItems);
            rpt = {
                item : item,
                listItemPorcion: item.isporcion === 'SP' && rptCantidad[0] && rptCantidad[0].listItemsPorcion ? JSON.parse(rptCantidad[0].listItemsPorcion) : null,    
                listSubItems: listSubItems                
            }

            console.log('rpt', rpt);
            if ( notificar ) {
                io.to(chanelConect).emit('itemModificado-pwa', rpt);
                io.to(chanelConect).emit('itemModificado', item); 
            }
        } else {
            if ( notificar ) {
                io.to(chanelConect).emit('itemModificado', item);
                io.to(chanelConect).emit('itemModificado-pwa', item);
            }
        }   
    } catch (_error) {
        console.error(_error);
        
        const dataError = {
            incidencia: {
                message: _error.toString(),
                data: {
                    item_process: item,                               
                    res_query: rpt
                }
            },
            origen: 'processAndEmitItem'            
        }
        errorManager.logError(dataError);

        io.to(chanelConect).emit('error', { message: 'Error al modificar el item', _error });
    }
}
module.exports.processAndEmitItem = processAndEmitItem;

// const setModificaStockTest = async function (req, res) { 
//     const id = req.body;      
//     console.log('==========> llego setModificaStockTest', id)
//     res.status(200).json({success: true})
// }
// module.exports.setModificaStockTest = setModificaStockTest



// function emitirRespuesta_RES(xquery, res) {
// 	console.log(xquery);
// 	return sequelize.query(xquery, {type: sequelize.QueryTypes.SELECT})
// 	.then(function (rows) {
		
// 		return ReS(res, {
// 			data: rows
// 		});
// 		// return rows;
// 	})
// 	.catch((err) => {
// 		return false;
// 	});
// }




// function emitirRespuesta(xquery, res) {
// 	console.log(xquery);
// 	return sequelize.query(xquery, {type: sequelize.QueryTypes.SELECT})
// 	.then(function (rows) {
		
// 		// return ReS(res, {
// 		// 	data: rows
// 		// });
// 		return rows;
// 	})
// 	.catch((err) => {
// 		return false;
// 	});
// }


// function emitirRespuestaSP(xquery) {
// 	console.log(xquery);
// 	return sequelize.query(xquery, {		
// 		type: sequelize.QueryTypes.SELECT
// 	})
// 	.then(function (rows) {

// 		// convertimos en array ya que viene en object
// 		var arr = [];
// 		arr = Object.values(rows[0]);		
		
// 		return arr;
// 	})
// 	.catch((err) => {
// 		return false;
// 	});
// }



// function emitirRespuestaSP_RES(xquery, res) {
// 	console.log(xquery);
// 	sequelize.query(xquery, {		
// 		type: sequelize.QueryTypes.SELECT
// 	})
// 	.then(function (rows) {

// 		// convertimos en array ya que viene en object
// 		var arr = [];
// 		arr = Object.values(rows[0]) ;
		
// 		return ReS(res, {
// 			data: arr
// 		});
// 	})
// 	.catch((err) => {
// 		return ReE(res, err);
// 	});
// }

