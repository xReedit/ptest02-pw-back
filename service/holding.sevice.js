const apiPwa = require('../controllers/apiPwa_v1');
const apiHolding = require('../controllers/apiHolding');
const cocinarArrayPrinter = require('../service/cocinar.array.printer')
const logger = require('../utilitarios/logger');

async function proccessSavePedidoHolding(dataSend, io) {    
    // console.log('object dataSend', JSON.stringify(dataSend));  
    const arrPedidosAgrupados = await agruparPedidosHolding(dataSend);        
    return await savePedidosAgrupados(arrPedidosAgrupados, dataSend.dataPedido.p_subtotales, io)    
}

async function agruparPedidosHolding(pedidoHolding) {
    try {
        // Array para almacenar pedidos agrupados
        const pedidosAgrupados = [];
        
        // Extraer secciones de todos los tipos de consumo
        const arrTipoConsumoPedido = pedidoHolding.dataPedido.p_body.tipoconsumo;
        const secciones = arrTipoConsumoPedido.reduce((acc, tc) => {
            return [...acc, ...tc.secciones];
        }, []);
        

        // Agrupar secciones por idsede y idorg
        const grupos = {};
        secciones.forEach((seccion, index) => {
            if (!seccion.idsede || !seccion.idorg) return; 
            const key = `${seccion.idsede}-${seccion.idorg}`;
            
            if (!grupos[key]) {
                grupos[key] = {
                    idsede: seccion.idsede,
                    idorg: seccion.idorg,
                    secciones: []
                };
            }
            
            grupos[key].secciones.push(seccion);
        });        

        // Convertir grupos en array de pedidos
        for (const key in grupos) {
            const grupo = grupos[key];
            if (!grupo.idsede || !grupo.idorg) continue;
            
            // aca modificados el idsede y idorg por los del grupo
            let _dataUsuario = pedidoHolding.dataUsuario;
            _dataUsuario.idsede = grupo.idsede;
            _dataUsuario.idorg = grupo.idorg;


            

            // Filtrar dataPrint por sede
            const dataPrintFiltrado = filtrarDataPrintPorSede(
                pedidoHolding.dataPrint,
                grupo.idsede,
                grupo.idorg
            );

            // Crear estructura de pedido individual
            const pedidoAdd = {
                dataPedido: {
                        p_body: {
                            tipoconsumo: [{
                                titulo: arrTipoConsumoPedido[0].titulo,
                                secciones: grupo.secciones,
                                descripcion: arrTipoConsumoPedido[0].descripcion,
                                idtipo_consumo: arrTipoConsumoPedido[0].idtipo_consumo
                            }]
                        },
                        idpedido: 0,
                        p_header: {
                            ...pedidoHolding.dataPedido.p_header,
                            idsede: grupo.idsede,
                            idorg: grupo.idorg,
                        },
                        p_sede: {
                            idsede: grupo.idsede,
                            idorg: grupo.idorg,
                            holding: pedidoHolding.dataPedido.p_header.holding || {}
                        },
                        p_subtotales: calcularSubtotales(grupo.secciones)
                    },
                dataUsuario: _dataUsuario,
                dataPrint: dataPrintFiltrado
            };

            
            const impresora = await apiHolding.getPrinterMarcaInHolding(grupo.idsede);            
            const arrPrint = cocinarArrayPrinter.relationRowToPrint(pedidoAdd.dataPedido, impresora);
            
            let dataPrint = [];
            if (Array.isArray(arrPrint) && arrPrint.length > 0) {
                dataPrint.push({
                    Array_enca: pedidoHolding.dataPrint[0].Array_enca,
                    ArraySubTotales: pedidoAdd.dataPedido.p_subtotales,
                    ArrayItem: arrPrint[0].arrBodyPrint,
                    Array_print: arrPrint[0].arrPrinters
                });            
            } else {
                dataPrint.push({
                    Array_enca: pedidoHolding.dataPrint[0].Array_enca,
                    ArraySubTotales: pedidoAdd.dataPedido.p_subtotales,
                    ArrayItem: [],
                    Array_print: []
                });
            }
            
            pedidoAdd.dataPrint = dataPrint;
            pedidosAgrupados.push(pedidoAdd);
        }

        return pedidosAgrupados;

    } catch (error) {
        console.error('Error al agrupar pedidos:', error);
        throw error;
    }
}

function filtrarDataPrintPorSede(dataPrint, idsede, idorg) {
    if (!Array.isArray(dataPrint)) return [];

    return dataPrint.map(printer => {
        // Copia profunda del objeto printer
        const printerCopy = JSON.parse(JSON.stringify(printer));

        // Filtrar Array_item por sede
        if (printerCopy.ArrayItem) {
            printerCopy.ArrayItem = printerCopy.ArrayItem.filter(item => {
                const itemData = Object.values(item)[0];
                return itemData && 
                       itemData.idsede === idsede && 
                       itemData.idorg === idorg;
            });
        }

        return printerCopy;
    }).filter(printer => printer.ArrayItem && printer.ArrayItem.length > 0);
}

function calcularSubtotales(secciones) {
    // Calcular total de items en las secciones usando precio_print
    const total = secciones.reduce((sum, seccion) => {        
        return sum + seccion.items.reduce((itemSum, item) => {
            const precio = parseFloat(item.precio_print || item.precio || 0);
            // const cantidad = parseInt(item.cantidad_seleccionada || item.cantidad || 1);
            // return itemSum + (precio * cantidad);
            return itemSum + precio;
        }, 0);
    }, 0);
    

    return [
        {
            id: 0,
            quitar: false,
            importe: total.toFixed(2),
            tachado: false,
            visible: true,
            esImpuesto: 0,
            descripcion: "SUB TOTAL",
            visible_cpe: true
        },
        {
            id: 0,
            quitar: false,
            importe: total.toFixed(2),
            tachado: false,
            visible: true,
            esImpuesto: 0,
            descripcion: "TOTAL",
            visible_cpe: true
        }
    ];
}

async function emitPedidoEvents(io, pedido, chanelMarca, chanelHolding) {
    try {                
        await io.to(chanelMarca).emit('nuevoPedido', pedido);
        await io.to(chanelHolding).emit('nuevoPedido', pedido);
    } catch (error) {
        console.error('Error emitting pedido events:', error);
        throw new Error('Failed to emit pedido events');
    }
}

async function handlePedidoPrinting(io, chanelMarca, dataRpt, impresora) {
    
    try {
        

        if (!impresora || !impresora[0]) {
            return;
        }

        if (impresora[0].ip !== '0' && impresora[0].ip !== '') {
            dataRpt.print.detalle_json.Array_print = impresora;
            dataRpt.print.detalle_json.Array_print.ip_print = impresora[0].ip;
            xMandarImprimirComanda([dataRpt], io, chanelMarca);
        }
    } catch (error) {
        console.error('Error handling pedido printing:', error);
        throw new Error('Failed to handle pedido printing');
    }
}

// onlyMozoCobra = true puede que no sea holding solo que el mozo este permitido a cobrar
async function savePedidosAgrupados(pedidosAgrupados, arrSubtotales, io, onlyMozoCobra = false) {
    // Validate inputs
    if (!Array.isArray(pedidosAgrupados) || !io) {
        throw new Error('Invalid input parameters');
    }

    const results = [];
    const pedidosParaPago = []; // Array para almacenar todos los pedidos

    // Process each pedido sequentially
    for (const pedido of pedidosAgrupados) {
        // try {
            // Validate pedido data      
            // console.log('pedido === ', JSON.stringify(pedido));     
            // console.log('onlyMozoCobra === ', onlyMozoCobra);
            
            const idsedePedido = onlyMozoCobra ? pedido.dataUsuario.idsede : pedido.dataPedido.p_sede.idsede;
            const idorgPedido = onlyMozoCobra ? pedido.dataUsuario.idorg : pedido.dataPedido.p_sede.idorg;

            if (!idsedePedido || !idorgPedido) {
                results.push({ success: false, error: 'Missing required pedido data', pedido });
                continue;
            }

            
            // onlyMozoCobra no es holding
            const idsedeHolding = onlyMozoCobra ? '' : pedido.dataPedido.p_header.holding.idsede;
            const idorgHolding = onlyMozoCobra ? '' : pedido.dataPedido.p_header.holding.idorg;

            const dataUsuario = {
                idsede: idsedePedido,
                idorg: idorgPedido,
                idusuario: pedido.dataPedido.p_header.paymentMozo?.idusuario || 0
            };

            pedido.dataUsuario.idsede = idsedePedido;
            pedido.dataUsuario.idorg = idorgPedido

            // console.log('dataUsuario === ', dataUsuario);

            // Save pedido
            let rptSave = await apiPwa.setNuevoPedido(dataUsuario, pedido);            
            
            // console.log('rptSave ===>', JSON.stringify(rptSave));

            if (!rptSave?.[0]?.idpedido) {
                results.push({ success: false, error: 'Failed to save pedido', pedido });
                continue;
            }

            pedido.idpedido = rptSave[0].idpedido;
            pedido.dataPedido.idpedido = pedido.idpedido;

            pedidosParaPago.push({
                idpedido: pedido.idpedido,
                dataPedido: pedido.dataPedido,
                dataUsuario
            });

            // Setup channels
            const chanelMarca = `room${dataUsuario.idorg}${dataUsuario.idsede}`;
            const chanelHolding = onlyMozoCobra ? '' : `room${idorgHolding}${idsedeHolding}`;

            // Emit events
            pedido.dataPedido.idpedido = pedido.idpedido;
            // const pedidoSendSocket = {
            //     ...pedido.dataPedido
            // }
            
            emitPedidoEvents(io, pedido.dataPedido, chanelMarca, chanelHolding);

            const impresora = onlyMozoCobra ? pedido.listPrinters : pedido.dataPrint[0].Array_print;

            if (impresora.length > 0) {
                handlePedidoPrinting(io, chanelMarca, rptSave[0].data[0], impresora);
            }
            

            results.push({ success: true, pedido, idpedido: pedido.idpedido });

        // } catch (error) {
        //     console.error('Error processing pedido:', {
        //         error: error.message,
        //         pedido: pedido?.idpedido
        //     });
        //     results.push({ success: false, error: error.message, pedido });
        // }
    }

    // Process single payment for all pedidos
    if (pedidosParaPago.length > 0) {
        try {
            // Get all pedido details
            const allPedidoDetails = await Promise.all(
                pedidosParaPago.map(p => 
                    apiHolding.getListItemsPedidoDetalle(p.idpedido)
                )
            );

            // console.log('allPedidoDetails === ', JSON.stringify(allPedidoDetails));

            // Combine all pedido details
            const consolidatedPedidoDetails = allPedidoDetails.flat();
            // console.log('consolidatedPedidoDetails === ', JSON.stringify(consolidatedPedidoDetails));

            pedidosParaPago[0].dataPedido.idsede = pedidosParaPago[0].dataUsuario.idsede;
            pedidosParaPago[0].dataPedido.idorg = pedidosParaPago[0].dataUsuario.idorg;
            
            // Create single payment record
            pedidosParaPago[0].dataPedido.p_subtotales = arrSubtotales;            
            const rptPago = await apiHolding.saveRegistroPagoPedido(
                pedidosParaPago[0].dataPedido,
                consolidatedPedidoDetails                
            );
            logger.debug({ rptPago }, 'rptPago === ');
            
        } catch (error) {
            logger.error({ error }, 'Error saving consolidated payment');
        }
    }

    return results;
}


function xMandarImprimirComanda(dataPrint, io, chanelConect) {
		// data print
        const _dataPrint = dataPrint;
		if ( _dataPrint == null ) { return }
		_dataPrint.map(x => {
			if ( x.print ) {
				var dataPrintSend = {
					detalle_json: JSON.stringify(x.print.detalle_json),
					idprint_server_estructura: 1,
					tipo: 'comanda',
					descripcion_doc: 'comanda',
					nom_documento: 'comanda',
					idprint_server_detalle: x.print.idprint_server_detalle
				}				
                // console.log(' ====== printerComanda ===== xMandarImprimirComanda', dataPrintSend);
				io.to(chanelConect).emit('printerComanda', dataPrintSend);
			}				
		});	
	}





module.exports = {    
    agruparPedidosHolding,
    proccessSavePedidoHolding,
    savePedidosAgrupados
};