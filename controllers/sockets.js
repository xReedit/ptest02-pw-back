const apiPwa = require('./apiPwa_v1.js');
const apiPwaRepartidor = require('./apiRepartidor.js');
const apiPwaComercio = require('./apiComercio.js');
const apiMessageWsp = require('./socketMenssagesWsp.js');
const apiHoldingServices = require('./../service/holding.sevice.js');
let apiPrintServer = require('./apiPrintServer');
let socketPinPad = require('./socketPinPad.js');
const async = require('async');
var btoa = require('btoa');
const { collectionGroup } = require('firebase/firestore');
const handleStock = require('../service/handle.stock.v1');
const logger = require('../utilitarios/logger');




//const auth = require('../middleware/autentificacion');

// var onlineUsers = {};
// var onlineCount = 0;
// var dataCliente = {
// 	idorg: 1,
// 	idsede: 1,
// 	idusuario: 1
// }

// dataCliente = {};

// hora
var d = new Date();
var n = d.toLocaleTimeString(); 
const nameRoomMozo = 'MOZO';
// var socketMaster; 



module.exports.socketsOn = function(io){ // Success Web Response
	// middleware
	// io.use((socket, next) => {
	//   let token = socket.handshake.query.token;	
	//   // if (isValid(token)) {
	//     return next();
	//   // }
	//   // return next(new Error('authentication error'));
	// });

	apiPwaRepartidor.runLoopSearchRepartidor(io, 0);


	io.on('connection', async function(socket) {
		module.exports.elSocket = socket;		
		logger.debug({ socketId: socket.id }, 'Socket conectado');				
		let dataSocket = socket.handshake.query;		
		
		// si viene de un websocket isFromBot // socket.handshake.headers.query
		dataSocket = dataSocket.isFromBot === 1 ? JSON.parse(socket.handshake.headers.query) : dataSocket
		dataSocket.socketid = socket.id;		

		// const rptDate = new Date().toLocaleString().split(' ');
		// var aaa = '2020-05-28'.replace(',', '');
		// aaa = aaa.replace(/(\d+)\/(\d+)\/(\d+)/, '$3-$1-$2');		

		logger.info({ dataSocket }, 'Datos socket recibidos');

		const dataCliente = dataSocket;

		if (dataCliente.isMensajeria === '1') {
			const roomMensajeria = `mensajeria_${dataCliente.roomId}`;
			logger.debug({ roomMensajeria }, 'Conectado a mensajeria');
			socket.join(roomMensajeria);
			return;
		}

		if (dataCliente.isClienteHolding === '1') {			
			
			socket.on('restobar-send-number-table-client', (data) => {
				logger.debug({ data }, 'Restobar-send-number-table-client');
				io.to(data.rooms).emit('restobar-send-number-table-client', data);				
			});
		}		

		if (dataCliente.isHolding === '1') {
			const chanelHoldingMozo = `${nameRoomMozo}${dataCliente.idusuario}`;
			logger.debug({ chanelHoldingMozo }, 'Conectado a holding');
			socket.join(chanelHoldingMozo);
		}

		// mensaje de confirmacion de telefono
		socket.on('msj-confirma-telefono', async (data) => {
			logger.debug({ data }, 'Msj-confirma-telefono');
			const codigoVerificacion = Math.round(Math.random()* (9000 - 1)+parseInt(1000));
			const _sendServerMsj = `{"tipo": 1, "cod": ${codigoVerificacion}, "t": "${data.numberphone}", "idcliente": ${data.idcliente}, "idsocket": "${data.idsocket}"}`;

			data.cod = codigoVerificacion;
			// guardamos codigo en bd
			apiPwa.setCodigoVerificacionTelefonoCliente(data);

			sendMsjSocketWsp(_sendServerMsj);
		});

		// escucha respuesta del servidor de mensajeria
		socket.on('mensaje-verificacion-telefono-rpt', async (val) => {
			logger.debug({ val }, 'Mensaje verificacion telefono rpt');			
			io.to(val.idsocket).emit('mensaje-verificacion-telefono-rpt', val);
		});

		// obtener date
		socket.on('date-now-info', (e) =>{
			socket.emit('date-now-info', new Date());
		});


		// nuevo pedido mandado
		socket.on('nuevo-pedido-mandado', async () => {
			// notifica al monitor
			logger.debug({ }, 'Nuevo pedido mandado');
			io.to('MONITOR').emit('monitor-nuevo-pedido-mandado', true);
		});

		// ping al servicio de mensajeria
		socket.on('ping-mensajeria', async (data) => {
			const roomMensajeria = `mensajeria_${data.roomId}`;
			const pingId = `${roomMensajeria}_${Date.now()}`;

			logger.debug({ roomMensajeria }, 'Connectando ping a roomMensajeria');
			
			socket.to(roomMensajeria).timeout(5000).emit('ping', { pingId }, (err, responses) => {
				logger.debug({ responses }, 'Respuesta recibida de mensajeria', responses);
				if (responses && responses.length > 0 && responses[0].success){
					const isWspConectado = responses[0].whatsappConnected ? responses[0].whatsappConnected : true;
					socket.emit('pong-mensajeria', { pingId, success: isWspConectado });
				}
			});
		});


		/// repartidor
		if (dataCliente.isRepartidor) {
			// socketMaster = socket; 
			socketRepartidor(dataCliente,socket);
			return;
		}

		/// monitor pacman
		if (dataCliente.isMonitorPacman === 'true') {
			// socketMaster = socket; 
			socketMonitorPacman(dataCliente,socket);
			return;
		}

		/// sever send msj
		if (dataCliente.isServerSendMsj === '1') {
			// socketMaster = socket; 
			socketServerSendMsj(dataCliente,socket);
			return;
		}

		if (dataCliente.isOutCarta === 'true') {
			// socketMaster = socket; 
			socketClienteDeliveryEstablecimientos(dataCliente,socket);
			return;
		}

		// atm cash
		if (dataCliente.isCashAtm === 'true') {
			// socketMaster = socket; 
			socketClienteCashAtm(dataCliente,socket);
			return;
		}

		// si es el servicio local pinpad
		if (dataCliente.isPinPad === '1') {
			// socketMaster = socket; 
			// socketLocalPinpad(dataCliente,socket);
			const chanelConectPinPad = `pinpad-${dataCliente.pinPadSN}`;
			dataCliente.room = chanelConectPinPad;
			logger.debug({ chanelConectPinPad }, 'IsLocalPinpad conectado al room');

			socket.join(chanelConectPinPad);

			socketPinPad.connection(dataCliente, socket, io);
			return;
		}

		


		



		
		
		
		// si viene desde app pedidos
		// 1 is from pwa 0 is web // si es 0 web no da carta
		const isFromPwa = dataSocket.isFromApp ? parseInt(dataSocket.isFromApp) : 1;
		logger.debug({ isFromPwa }, 'IsFromPwa');

		// nos conectamos al canal idorg+idsede
		const chanelConect = 'room'+dataSocket.idorg + dataSocket.idsede;
		logger.debug({ chanelConect }, 'Conectado al room');

		socket.join(chanelConect);


		// Servidor de Impresion 070222
		if (dataCliente.isServerPrint === '1') {
			// socketMaster = socket; 
			logger.debug({ dataCliente }, 'Es print server');
			apiPrintServer.socketPrintServerClient(dataCliente,socket);
			return;
		}


		if (dataCliente.isComercio === 'true') {
			// socketMaster = socket; 
			socketComercioDelivery(dataCliente,socket);
			return;
		}

		// registrar como conectado en cliente_socketid
		if (dataCliente.iscliente === 'true') {
			apiPwa.setClienteConectado(dataCliente);
		}		


		if ( dataSocket.isFromApp == 1 ) {

			// ni bien el cliente se conecta sirve la carta
			const objCarta = await apiPwa.getObjCarta(dataCliente);			
			socket.emit('getLaCarta', objCarta);

			// obtener tipos de consumo
			const objTipoConsumo = await apiPwa.getTipoConsumo(dataCliente);
			socket.emit('getTipoConsumo', objTipoConsumo);

			// obtener reglas de la carta y subtotales
			const objReglasCarta = await apiPwa.getReglasCarta(dataCliente);
			socket.emit('getReglasCarta', objReglasCarta);

			// data del la sede
			const objDataSede = await apiPwa.getDataSede(dataCliente);
			socket.emit('getDataSede', objDataSede);

			// data descuentos
			const objDescuentos = await apiPwa.getDataSedeDescuentos(dataCliente);
			socket.emit('getDataSedeDescuentos', objDescuentos);

			if ( dataCliente.iscliente !== 'true' ) { // si es personal autorizado
				const objDescuentos = await apiPwa.listCallClientMesa(dataCliente);
				socket.emit('load-list-cliente-llamado', objDescuentos);				
			}
	
			logger.debug({ chanelConect }, 'Emitido a');
			// socket.emit('getLaCarta', objCarta);
			logger.debug({ chanelConect }, '=========emitido carta========');
			// socket.emit('getTipoConsumo', objTipoConsumo);
			// socket.emit('getReglasCarta', objReglasCarta);
			// socket.emit('getDataSede', objDataSede);
			// socket.emit('getDataSedeDescuentos', objDescuentos);

			// socket.emit('finishLoadDataInitial');

		}

		logger.debug('=== limite comprobaciones');		

		socket.on('hola-test', async function(item) {
			logger.debug({ item }, '==========> llego HOLA TEST');
		})

		// para sacar el loader
		socket.emit('finishLoadDataInitial');

		socket.on('itemModificado-test', async function(item) {
			logger.debug({ item }, '==========> llego');
		})

		// cola de procesamiento
		const queue = async.queue((item, callback) => {			
			apiPwa.processAndEmitItem(item, chanelConect, io, dataCliente.idsede)
				.then(() => callback())
				.catch(callback);
		}, 4);

		
		socket.on('itemAllModificado', async (items) => {
			 try {
				// Procesa todos los items en paralelo
				// await Promise.all(items.map(item => apiPwa.processAndEmitItem(item, chanelConect, io, dataCliente.idsede)));

				// Agregar todos los items a la cola en lugar de procesarlos en paralelo
				const processPromises = items.map(item => {
					return new Promise((resolve, reject) => {
						queue.push(item, (err) => {
							if (err) reject(err);
							else resolve();
						});
					});
				});
				
				// Esperar a que todos los items sean procesados por la cola
				await Promise.all(processPromises);
				

				// // Emite un solo evento con todos los items procesados
				// io.to(chanelConect).emit('itemsModificados', processedItems);
			} catch (error) {
				logger.error(error);
			}

			// registrar como cliente usuario desconectado
			apiPwa.setClienteDesconectado(dataCliente);
		});

		socket.on('itemModificado', async function(item) {
			item.idsede = dataCliente.idsede;
			item.idusuario = dataCliente.idusuario;
			logger.debug({ item }, 'Item modificado ==== aca');			
			// Verificar si es del monitor
			if (item?.from_monitor === true) {
				socketItemModificadoAfter(item);
				return;
			}
			

			queue.push(item);
		});
		        
        // var _cantItem = parseFloat(item.cantidad);

		// 10124 para monitor de pedidos
		async function socketItemModificadoAfter(item) {
			

			// manejar cantidad/

			
			
			// actualizamos en bd - si un cliente nuevo solicita la carta tendra la carta actualizado
			item.cantidad = isNaN(item.cantidad) || item.cantidad === null || item.cantidad === undefined ? 'ND'  : item.cantidad;
			
			// la cantidad viene 999 cuando es nd y la porcion si viene nd
			// si isporcion es undefined entonces es un subtitem agregado desde venta rapida, colocamos ND
			item.cantidad = parseInt(item.cantidad) >= 9999 ? item.isporcion || 'ND' : item.cantidad;
			if (item.cantidad != 'ND') {				
				// var _cantItem = parseFloat(item.cantidad);

				// item.venta_x_peso solo para productos
				var _cantSumar = item.venta_x_peso === 1 ? -item.cantidad : item.sumar ? -1 : parseInt(item.sumar) === 0 ? 0 : 1;
				item.cantidadSumar = _cantSumar;
				logger.debug({ item }, 'Item cantidad sumar');
				// item.cantidad = _cantItem;		


				const rptCantidad = await apiPwa.setItemCartaAfter(0, item);

				logger.debug({ rptCantidad }, 'RESPUESTA Rpt cantidad ====== ');

				// if ( item.isporcion != 'SP' ) {
				item.cantidad = rptCantidad[0].cantidad;
				//}				

				// subitems
				logger.debug({ rptCantidad }, 'Rpt cantidad');
				

				if ( rptCantidad[0].listSubItems ) {
					try {
						rptCantidad[0].listSubItems.map(subitem => {

							if ( !item.subitems ) {
								item.subitems.map(s => {							
									let itemFind = s.opciones.filter(_subItem => parseInt(_subItem.iditem_subitem) === parseInt(subitem.iditem_subitem))[0];

									if ( itemFind ) {
										itemFind.cantidad = subitem.cantidad;
									}
								});
							}						
						});
					}
					catch (error) {
						logger.error({ error }, 'Error al actualizar subitems');
					}
				}			

				const rpt = {
					item : item,
					listItemPorcion: item.isporcion === 'SP' ? JSON.parse(rptCantidad[0].listItemsPorcion) : null,	
					listSubItems: rptCantidad[0].listSubItems				
				}

				io.to(chanelConect).emit('itemModificado', item); 
				io.to(chanelConect).emit('itemModificado-pwa', rpt); // para no modificar en web
			} else {
				io.to(chanelConect).emit('itemModificado', item);
				io.to(chanelConect).emit('itemModificado-pwa', item);
			}			
			
			// envia la cantidad a todos incluyendo al emisor, para actualizar en objCarta
			// io.emit('itemModificado', item);
		} //);


		socket.on('getOnlyCarta', async () => {
			// ni bien el cliente se conecta sirve la carta
			const objCarta = await apiPwa.getObjCarta(dataCliente);
			socket.emit('getLaCarta', objCarta);
		});

		// item modificado desde subitems del monitor de pedidos
		// solo informa porque ya guarda en la bd desde el cliente
		socket.on('itemModificadoFromMonitorSubItems', async function(item) {
			io.to(chanelConect).emit('itemModificado', item);
		});

		// nuevo item agregado a la carta - from monitoreo stock
		socket.on('nuevoItemAddInCarta', (item) => {			
			socket.broadcast.to(chanelConect).emit('nuevoItemAddInCarta', item);
		});

		// restablecer pedido despues de que se termino el tiempo de espera
		socket.on('resetPedido', (listPedido) => {
			logger.debug({ listPedido }, 'Reset pedido');
			// recibe items
			listPedido.map(async (item) => {				
				// si la cantidad seleccionada es 0 entonces continua al siguiente
				if ( parseFloat(item.cantidad_seleccionada) === 0 ) {
					return;
				}

				item.idsede = dataCliente.idsede;
				item.idusuario = dataCliente.idusuario;

				item.cantidad = isNaN(item.cantidad) || item.cantidad === null || item.cantidad === undefined ? 'ND'  : item.cantidad;
				const isCheckExistSubItemsWithCantidad = handleStock.checkExistSubItemsWithCantidad(item);
				logger.debug({ isCheckExistSubItemsWithCantidad }, 'Is check exist subitems with cantidad');
				// item.cantidad = parseInt(item.cantidad) === 999 ? item.isporcion : item.cantidad; // la cantidad viene 999 cuando es nd y la porcion si viene nd
				// la cantidad viene 999 cuando es nd y la porcion si viene nd
				// si isporcion es undefined entonces es un subtitem agregado desde venta rapida, colocamos ND
				item.cantidad = parseInt(item.cantidad) >= 9999 || parseInt(item.stock_actual) >= 999 ? item.isporcion || 'ND' : item.cantidad;
				if (item.cantidad != 'ND' || isCheckExistSubItemsWithCantidad) {
					item.cantidad_reset = item.cantidad_seleccionada;					
					item.cantidad_seleccionada = 0;
					
										
					const rptCantidad = await apiPwa.setItemCarta(1, item, dataCliente.idsede);
					item.cantidad = rptCantidad[0].cantidad;

					// subitems

					if ( rptCantidad[0].listSubItems ) {
						rptCantidad[0].listSubItems.map(subitem => {
							// item.subitems.filter(_subItem => parseInt(_subItem.iditem_subitem) === parseInt(subitem.iditem_subitem))[0].cantidad = subitem.cantidad;
							if ( item.subitems ) {

								if (item.subitems.length > 0) {

									try {
										item.subitems.map(s => {							
											let itemFind = s.opciones.filter(_subItem => parseInt(_subItem.iditem_subitem) === parseInt(subitem.iditem_subitem))[0];

											if ( itemFind ) {
												itemFind.cantidad = subitem.cantidad;
											}
										});
									} catch(error) {										
										logger.error({ error }, 'Error al actualizar subitems');
									}	

								}								
							}							
						});
					}
					
					const rpt = {
						item : item,
						listItemPorcion: item.isporcion === 'SP' ? JSON.parse(rptCantidad[0].listItemsPorcion) : null,
						listSubItems: rptCantidad[0].listSubItems					
					}

					// socket.broadcast.emit('itemResetCant', item);
					io.to(chanelConect).emit('itemResetCant', item);
					io.to(chanelConect).emit('itemResetCant-pwa', rpt);
				}
			});
		});

		// buscar subitems del item seleccionado
		socket.on('search-subitems-del-item', async (iditem, callback) => {
			const rpt = await apiPwa.getSearchSubitemsItem(iditem);			
			callback(rpt);
		});

		// 26/09/2023 lo colocamos arriba // 06102025 lo eliminamos
		// apiPwaRepartidor.runLoopSearchRepartidor(io, 0);

		// hay un nuevo pedido - guardar
		socket.on('nuevoPedido', async (dataSend, callback) => {
			var telefonoComercio = '';


			if ( typeof dataSend === 'string' ) {
				dataSend = JSON.parse(dataSend);
			}
			

			/// <<<<< 250124 >>>> //
			// si es holding ///					

			// chequeamos si el header tiene paymentMozo.success
			const _savePedidoAndPago = dataSend.dataPedido.p_header.paymentMozo ? dataSend.dataPedido.p_header.paymentMozo.isPaymentSuccess : false;

			
			if (dataSend.dataPedido.p_header.is_holding == 1) {				
				const rptPedidoHolding = await apiHoldingServices.proccessSavePedidoHolding(dataSend, io);				
				io.to(socket.id).emit('nuevoPedidoRes', rptPedidoHolding)
				if ( callback ) {
					callback(rptPedidoHolding);	
				}
				return;	
			} 
			else if (_savePedidoAndPago) {
				logger.debug({ _savePedidoAndPago }, '_savePedidoAndPago');

				// si el mesero confirmo el pago // no holding
				const rptPedidoSave = await apiHoldingServices.savePedidosAgrupados([dataSend], dataSend.dataPedido.p_subtotales, io, _savePedidoAndPago);
				io.to(socket.id).emit('nuevoPedidoRes', rptPedidoSave)
				if ( callback ) {
					callback(rptPedidoSave);	
				}
				return;	
			}
			
			const rpt = await apiPwa.setNuevoPedido(dataCliente, dataSend);
			logger.debug({ rpt }, 'Rpt');
									
			io.to(socket.id).emit('nuevoPedidoRes', rpt)

			if ( callback ) {
				callback(rpt);			
			}
			

			// error
			if ( rpt === false ) {
				return;
			}			

			dataSend.dataPedido.idpedido = rpt[0].idpedido; // para buscar el pedido en comercio

			// devuele del idpedido a quien envio el pedido // lo ja desde el procedure
			// io.to(dataSend.socketid).emit('get-lastid-pedido', dataSend.dataPedido.idpedido);


			// si es delivery app // dataSend.isClienteRecogeLocal si el cliente recoge el pedido en el local
			if ( dataSend.isDeliveryAPP ) {

				if ( !dataSend.isClienteRecogeLocal ) {
					// run proceso de busqueda repartidor
					apiPwaRepartidor.runLoopSearchRepartidor(io, dataCliente.idsede);
				}				


				// quitamos, se remplazo por msj whatapp => sendMsjSocketWsp 030621
				// notificamos push al comercio
				// const socketIdComercio = await apiPwaComercio.getSocketIdComercio(dataCliente.idsede);
				// const telefonoComercio = socketIdComercio[0].telefono_notifica;
				// // notifica mensaje texto si tiene teleono
				// if ( telefonoComercio !== undefined ) {
				// 	if ( telefonoComercio !== '' ) {
				// 		apiPwaComercio.sendNotificacionNewPedidoSMS(telefonoComercio);
				// 	}
				
				// } 

				// notificacion push
				const socketIdComercio = await apiPwaComercio.getSocketIdComercio(dataCliente.idsede);
				telefonoComercio = socketIdComercio[0].telefono_notifica;
				if ( socketIdComercio[0].key_suscripcion_push ) {
					apiPwaComercio.sendOnlyNotificaPush(socketIdComercio[0].key_suscripcion_push, 0);				
				}				

			// 	const _dataPedido = {
			// 		dataItems: dataSend.dataPedido.p_body,
			// 		dataDelivery: dataSend.dataPedido.p_header.arrDatosDelivery,
			// 		idpedido: rpt[0].idpedido
			// 	}				
			
				
			// 	// obtener lista de repartidores
			// 	const listRepartidores = await apiPwaRepartidor.getRepartidoreForPedido(_dataPedido);

			// 	// pasamos a funcion que maneja las notificaciones			
			// 	apiPwaRepartidor.sendPedidoRepartidor(listRepartidores, _dataPedido, io);


			}


			// para actaluzar vista de caja // control de pedidos
			// socket.broadcast.to(chanelConect).emit('nuevoPedido', dataSend.dataPedido);			


			io.to(chanelConect).emit('nuevoPedido', dataSend.dataPedido);			

			io.to(chanelConect).emit('nuevoPedido-for-list-mesas', dataSend.dataPedido);

			// notifica al monitor nuevo pedido para emitir alerta
			if ( dataSend.dataPedido.p_header.delivery === 1 ) {
				io.to('MONITOR').emit('nuevoPedido', dataSend.dataPedido);				

				try {
					if ( telefonoComercio !== '' ) {
						let _sendServerMsj = `{"tipo":0, "s": "${dataCliente.idorg}.${dataCliente.idsede}", "p": ${dataSend.dataPedido.idpedido}, "h": "${new Date().toISOString()}", "t":"${telefonoComercio}"}`;
						_sendServerMsj = JSON.parse(_sendServerMsj);
						sendMsjSocketWsp(_sendServerMsj);
					}	
				} catch(error){
					logger.error({ error }, 'Error al enviar msj socket wsp');
				}
			}
			// io.to('MONITOR').emit('nuevoPedido', dataCliente);


			// registrar comanda en print_server_detalle			
			//apiPwa.setPrintComanda(dataCliente, dataSend.dataPrint);
			// emitimos para print server
			// socket.broadcast.to(chanelConect).emit('printerComanda', rpt);
			xMandarImprimirComanda(rpt[0].data, socket, chanelConect);
		});



		// esta funcion no guarda solo notifica del nuevo pedido
		// solo envia el data pedido con el id del pedido registrado por http		
		// para evitar pedidos perdidos cuando el socket pierde conexion
		socket.on('nuevoPedido2', async (dataSend) => {
			logger.debug({ dataSend }, 'nuevoPedido2');	

			var telefonoComercio = '';		
			// const rpt = await apiPwa.setNuevoPedido(dataCliente, dataSend);


			// dataSend.dataPedido.idpedido = rpt[0].idpedido; // para buscar el pedido en comercio

			// si es delivery app // dataSend.isClienteRecogeLocal si el cliente recoge el pedido en el local
			if ( dataSend.isDeliveryAPP ) {

				if ( !dataSend.isClienteRecogeLocal ) {
					// run proceso de busqueda repartidor
					apiPwaRepartidor.runLoopSearchRepartidor(io, dataCliente.idsede);
				}				


				// quitamos, se remplazo por msj whatapp => sendMsjSocketWsp 030621
				// notificamos push al comercio
				// const socketIdComercio = await apiPwaComercio.getSocketIdComercio(dataCliente.idsede);
				// // notifica mensaje texto si tiene teleono
				// const telefonoComercio = socketIdComercio[0].telefono_notifica;
				// if ( telefonoComercio !== undefined ) {
				// 	if ( telefonoComercio !== '' ) {
				// 		apiPwaComercio.sendNotificacionNewPedidoSMS(telefonoComercio);
				// 	}				
				// } 

				// notificacion push
				const socketIdComercio = await apiPwaComercio.getSocketIdComercio(dataCliente.idsede);
				telefonoComercio = socketIdComercio[0].telefono_notifica;
				apiPwaComercio.sendOnlyNotificaPush(socketIdComercio[0].key_suscripcion_push, 0);				

			}

			

			io.to(chanelConect).emit('nuevoPedido', dataSend.dataPedido);

			// notifica al monitor nuevo pedido para emitir alerta
			logger.debug('notifica al monitor');
			if ( dataSend.dataPedido.p_header.delivery === 1 ) {
				io.to('MONITOR').emit('nuevoPedido', dataSend.dataPedido);


				logger.debug('notifica al servidor de mensajes');
				if ( telefonoComercio !== '' ) {
					const _sendServerMsj = `{"tipo":0, "s": "${dataCliente.idorg}.${dataCliente.idsede}", "p": ${dataSend.dataPedido.idpedido}, "h": "${new Date().toISOString()}", "t":"${telefonoComercio}"}`;
					// io.to('SERVERMSJ').emit('nuevoPedido', _sendServerMsj); // para enviar el url del pedido
					sendMsjSocketWsp(_sendServerMsj);
				}
			}


			// data print
			
			const _dataPrint = dataSend.dataPrint;			
			if ( _dataPrint == null ) { return }
			logger.debug('notifica al dataSend del mandar imprimir');
			dataSend.dataPrint.map(x => {
				if ( x.print ) {
					var dataPrintSend = {
						detalle_json: JSON.stringify(x.print.detalle_json),
						idprint_server_estructura: 1,
						tipo: 'comanda',
						descripcion_doc: 'comanda',
						nom_documento: 'comanda',
						idprint_server_detalle: x.print.idprint_server_detalle
					}
					
					socket.broadcast.to(chanelConect).emit('printerComanda', dataPrintSend);
				}				
			});			
		});

		// no guarda lo que envia el cliente solo notifica que hay un nuevo pedido, para imprimir en patalla o ticketera
		// para imprmir solo la comanda desde control pedidos, venta rapida, zona despacho
		socket.on('printerOnly', (dataSend) => {			
			dataSend.hora = n;			

			socket.broadcast.to(chanelConect).emit('printerOnly', dataSend);
			socket.broadcast.to(chanelConect).emit('nuevoPedido-for-list-mesas', dataSend); // app mozo

			// verificar si es delivery que viene de venta rapida para actualizar monitor			
			let isNotificaMonitor = false;
			
			try {
				const jsonPedido = JSON.parse(dataSend.detalle_json);
    			isNotificaMonitor = jsonPedido.Array_enca.delivery === 1;
			} catch (error) {
			    isNotificaMonitor = false;
			}
			

			if ( isNotificaMonitor ) {
				logger.debug('nuevoPedidoUpdateVista', chanelConect)
				
				io.to(chanelConect).emit('nuevoPedidoUpdateVista', true);				
			}

			
		});

		// marca el pedido como impresor // enviado desde servidor de impresion		
		socket.on('printer-flag-impreso', (dataPedido) => {				
			logger.debug('notifica-impresion-comanda', dataPedido);
			socket.broadcast.to(chanelConect).emit('notifica-impresion-comanda', dataPedido);
			// apiPwa.setFlagPrinter(dataPedido);

			// notifica a monitor
			io.to('MONITOR').emit('notifica-impresion-comanda', dataPedido);
			apiPwa.setFlagPrinterChangeEstadoPedido(dataPedido);
		});


		// update impreso print_detalle
		socket.on('printer-flag-impreso-update', (id) => {				
			logger.debug('printer-flag-impreso-update ',id);			
			apiPwa.setFlagPrinter(id);			

			// socket.broadcast.to(chanelConect).emit('notifica-impresion-comanda', JSON.stringify(objP));
		});

		// notifica que se mando a imprimir precuenta para refrescar en el control de pedidos del comercio
		socket.on('notificar-impresion-precuenta', (dataSend) => {						
			logger.debug('notificar-impresion-precuenta ', chanelConect);
			socket.broadcast.to(chanelConect).emit('notifica-impresion-precuenta', 1);
		});

		// cuando cancela la cuenta // para usuario cliente
		// en front-end busca si la cuenta ha sido cancelada en su totalidad y actualiza la cuenta
		// la notificacion debe ser enviada solo a ese usuario de la cuenta
		// verificar si el pedido ha sido realizado por un usuario cliente - front-end
		socket.on('pedido-pagado-cliente', async (listIdCliente) => {
			const listIdsClie = listIdCliente.join(',');
			logger.debug('pedido-pagado-cliente', listIdsClie);

			const socketIdCliente = await apiPwa.getSocketIdCliente(listIdsClie);
			logger.debug('res list socket id', socketIdCliente);
			// buscar socketid por idcliente	

			// emite evento al cliente especifico
			socketIdCliente.map(x => {
				io.to(x.socketid).emit('pedido-pagado-cliente', x.socketid);
			});			
		});
		

		socket.on('disconnect', async (reason) => {
			logger.debug('cliente desconectado', socket.id);
						

			// Limpiar todos los listeners
			socket.removeAllListeners();

			// registrar como cliente usuario desconectado
			apiPwa.setClienteDesconectado(dataCliente);
			
			// else the socket will automatically try to reconnect
		});


		

		// verifica si hay conexion con el servidor
		socket.on('verificar-conexion', (socketId) => {
			// responde solo al que solicita la verificacion
			io.to(socketId).emit('verificar-conexion', true); // responde true si se logra la conexion
		});

		// notificar pago del cliente para ser visto en control de pedidos
		socket.on('notificar-pago-pwa', (data) => {
			logger.debug('emit notificar-pago-pwa');
			socket.broadcast.to(chanelConect).emit('notificar-pago-pwa', data);
		});

		// notifica llamado del cliente solicitando atentcion
		socket.on('notificar-cliente-llamado', (numMesa) => {			
			const _dataSend = {
				idcliente: dataCliente.idcliente,
				idsede: dataCliente.idsede,
				num_mesa: numMesa
			}

			logger.debug('notificar-cliente-llamado', _dataSend)

			// guardamos en bd
			apiPwa.saveCallClientMesa(_dataSend,0);

			socket.broadcast.to(chanelConect).emit('notificar-cliente-llamado', numMesa);
		});

		socket.on('notificar-cliente-llamado-voy', (numMesa) => {			
			const _dataSend = {
				idusuario: dataCliente.idusuario,
				idsede: dataCliente.idsede,
				num_mesa: numMesa
			}
			logger.debug('notificar-cliente-llamado-voy', _dataSend)
			
			apiPwa.saveCallClientMesa(_dataSend,1);

			socket.broadcast.to(chanelConect).emit('notificar-cliente-llamado-remove', numMesa);
		});



		// restobar
		// notifica al pedido que tiene un pedido asignado desde el comercio control de pedidos
		socket.on('set-repartidor-pedido-asigna-comercio', async (dataPedido) => {
			logger.debug('set-repartidor-pedido-asigna-comercio', dataPedido);
			const socketIdRepartidor = await apiPwaRepartidor.getSocketIdRepartidor(dataPedido.idrepartidor);
			io.to(socketIdRepartidor[0].socketid).emit('set-repartidor-pedido-asigna-comercio', dataPedido);				

			// notificacion push nuevo pedido
			apiPwaRepartidor.sendOnlyNotificaPush(socketIdRepartidor[0].key_suscripcion_push, 0);
		});






		// delivery cliente

		// notifica cambio de estado del pedido
		socket.on('delivery-pedido-estado', async (idcliente) => {
			// const listIdsClie = listIdCliente.join(',');
			logger.debug('delivery-pedido-estado', idcliente);

			const socketIdCliente = await apiPwa.getSocketIdCliente(idcliente);
			logger.debug('delivery-pedido-estado', socketIdCliente);
			// buscar socketid por idcliente	

			// emite evento al cliente especifico
			socketIdCliente.map(x => {
				io.to(x.socketid).emit('delivery-pedido-estado', x.socketid);
			});			
		});

		



		// restobar envia notificacion de pago de servcio
		socket.on('restobar-pago-servicio-on', async (payload) => {
			logger.debug('restobar-pago-servicio-on', payload);
			io.to('MONITOR').emit('restobar-pago-servicio-on', true);
		});

		// restobar envia url pdf comprobante para enviar a whastapp		
		socket.on('restobar-send-comprobante-url-ws', async (payload) => {
			payload.tipo = 3;			
			logger.debug('restobar-send-comprobante-url-ws', payload);			
			sendMsjSocketWsp(payload, dataSocket);
			
		});

		// restobar envia cupones al whastapp cliente
		socket.on('restobar-send-cupones-ws', async (payload) => {
			payload.tipo = 7;			
			logger.debug('restobar-send-cupones-ws', payload);
			sendMsjSocketWsp(payload);
			
		});

		socket.on('restobar-notifica-pay-pedido', async (payload) => {			
			logger.debug('restobar-notifica-pay-pedido-res', payload);	
			socket.broadcast.to(chanelConect).emit('restobar-notifica-pay-pedido-res', payload);					
		});


		// respuesta solicitud de cierre
		socket.on('restobar-permiso-cierre-remoto-respuesta', async (payload) => {			
			logger.debug('restobar-permiso-cierre-remoto-respuesta', payload);	
			socket.broadcast.to(chanelConect).emit('restobar-permiso-cierre-remoto-respuesta', payload);					
		});

		socket.on('restobar-venta-registrada', () => {			
			const _res = `se proceso un pago >  ${chanelConect}`;
			logger.debug('restobar-venta-registrada', _res);
			socket.to(chanelConect).emit('restobar-venta-registrada-res', _res);


		});

		// Cancelar pedido y restaurar stock
		socket.on('cancelar-pedido', async () => {
			try {
				// Notificar al cliente que el pedido fue cancelado
				socket.emit('pedido-cancelado', {
					success: true,
					message: 'Pedido cancelado correctamente',
					items: []
				});
			} catch (error) {
				logger.error('Error al cancelar pedido:', error);
				socket.emit('pedido-cancelado', {
					success: false,
					message: 'Error al cancelar pedido: ' + error.message
				});
			}
		});
		
		// Confirmar pedido para evitar restauración de stock
		socket.on('confirmar-pedido', async () => {
			try {
				logger.debug(`Pedido confirmado para socket ${socket.id}`);
				socket.emit('pedido-confirmado', {
					success: true,
					message: 'Pedido confirmado correctamente'
				});
			} catch (error) {
				logger.error('Error al confirmar pedido:', error);
				socket.emit('pedido-confirmado', {
					success: false,
					message: 'Error al confirmar pedido: ' + error.message
				});
			}
		});

		// Extender tiempo de reserva
		socket.on('extender-tiempo-pedido', async () => {
			try {
				logger.debug(`Tiempo extendido para socket ${socket.id}`);
				socket.emit('tiempo-pedido-extendido', {
					success: true,
					message: 'Tiempo extendido correctamente',
					nuevoTiempo: 60 // Default value in seconds
				});
			} catch (error) {
				logger.error('Error al extender tiempo de pedido:', error);
				socket.emit('tiempo-pedido-extendido', {
					success: false,
					message: 'Error al extender tiempo: ' + error.message
				});
			}
		});

		// solicitud anular registro de pagos
		socket.on('restobar-permiso-remove-registro-pago', async (payload) => {				
			apiPwa.updatePermissionRemoveRegistroPago(payload.data.data.idregistro_pago);
			socket.to(chanelConect).emit('restobar-permiso-remove-registro-pago', payload);
		});

		// llamar a mozo indicando que pedido esta listo en marca
		socket.on('restobar-call-mozo-holding', async (payload) => {
			const roomMozo = `${nameRoomMozo}${payload.idusuario}`;
			logger.debug('restobar-call-mozo-holding', roomMozo);
			apiPwa.saveCallMozoHolding(payload);
			socket.to(roomMozo).emit('restobar-call-mozo-holding', payload);
		});


		// notifica al cliente que repartidor tomo su pedido
		socket.on('repartidor-notifica-cliente-acepto-pedido', async (listClienteNotifica) => {
			logger.debug('repartidor-notifica-cliente-acepto-pedido===========', listClienteNotifica)			
			listClienteNotifica.map(c => {
				c.tipo = 2;

				// actualiza el time_line // hora_pedido_aceptado								
				apiPwa.updateTimeLinePedido(c.idpedido, c.time_line);
				sendMsjSocketWsp(c)
			});
		});


		// restobar notifica solicitud de permiso al administrador para borrar productos, eliminar cuentas, o cierre de caja
		socket.on('restobar-send-msj-ws-solicitud-permiso', async (payload) => {
			payload.tipo = 6;			
			logger.debug('restobar-send-msj-ws-solicitud-permiso', payload);
			sendMsjSocketWsp(payload);
			
		});


		// ecucha las solicitudes de permisos atendidos del chatbot - restobar borrar pedidos o productos
		// solicitud anular producto en pedido
		socket.on('restobar-permiso-remove-producto-mesa', async (payload) => {
			// update permissio_delete pedido_detalle

			apiPwa.updatePermissionDeleteItemPedido(payload.idpedido_detalle);
			socket.to(chanelConect).emit('restobar-permiso-remove-producto-mesa', payload);
		});

		// solicitud anular todo el pedido
		socket.on('restobar-permiso-remove-pedido-mesa', async (payload) => {	
			apiPwa.updatePermissionDeleteAllPedido(payload.idpedido);		
			socket.to(chanelConect).emit('restobar-permiso-remove-pedido-mesa', payload);			
		});
		
		// solicitud cambiar metodo de pago
		socket.on('restobar-permiso-change-metodo-pago', async (payload) => {	
			apiPwa.updatePermissionChangeMetodoPago(payload.data.data.idregistro_pago_detalle);		
			socket.to(chanelConect).emit('restobar-permiso-change-metodo-pago', payload);			
		});

		// solicitud cerrar caja
		socket.on('restobar-permiso-cerrar-caja', async (payload) => {	
			// apiPwa.updatePermissionChangeMetodoPago(payload.data.data.idregistro_pago_detalle);		
			socket.to(chanelConect).emit('restobar-permiso-cerrar-caja', payload);
		});

		// solicitud anular registro de pagos
		socket.on('restobar-permiso-remove-registro-pago', async (payload) => {				
			apiPwa.updatePermissionRemoveRegistroPago(payload.data.data.idregistro_pago);
			socket.to(chanelConect).emit('restobar-permiso-remove-registro-pago', payload);
		});


		// llamar a mozo indicando que pedido esta listo en marca
		socket.on('restobar-call-mozo-holding', async (payload) => {
			const roomMozo = `${nameRoomMozo}${payload.idusuario}`;
			logger.debug('restobar-call-mozo-holding', roomMozo);
			apiPwa.saveCallMozoHolding(payload);
			socket.to(roomMozo).emit('restobar-call-mozo-holding', payload);
		});

		// holding - mozo notifica a marca que esta en camino
		socket.on('notificar-marca-mozo-en-camino', async (data) => {
			logger.debug('data', data);			
			const roomMarcaHolding = `room${data.idorg_notificar}${data.idsede_notificar}`;
			logger.debug('notificar-marca-mozo-en-camino', roomMarcaHolding);
			socket.broadcast.to(roomMarcaHolding).emit('notificar-marca-mozo-en-camino', data.idpedido);

			apiPwa.saveCallMozoHoldingEstado(data.idpedido);
		});		

		

	});

	
	function xMandarImprimirComanda(dataPrint, socket, chanelConect) {
		// data print
		logger.debug('dataPrint xMandarImprimirComanda ===>', dataPrint);
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

					logger.debug(' ====== printerComanda ===== xMandarImprimirComanda', dataPrintSend);
					socket.broadcast.to(chanelConect).emit('printerComanda', dataPrintSend);
				}				
			});	
	}


	async function socketRepartidor(dataCliente, socket) {
		logger.debug('desde func repartatidor', dataCliente);

		// mantener el socket id del repartidor
		// if (dataCliente.firts_socketid) {
		// 	dataCliente.socketid = dataCliente.firts_socketid;
		// 	socket.id = dataCliente.firts_socketid;

		logger.debug ('repartidor conectado ==========');
		// Confirmar pedido para evitar restauración de stock
		socket.on('confirmar-pedido', async (pedidoId) => {
			try {
				logger.debug(`Pedido confirmado para socket ${socket.id}`);
				socket.emit('pedido-confirmado', {
					success: true,
					message: 'Pedido confirmado correctamente'
				});
			} catch (error) {
				logger.error('Error al confirmar pedido:', error);
				socket.emit('pedido-confirmado', {
					success: false,
					message: 'Error al confirmar pedido: ' + error.message
				});
			}
		});

		// verifica si hay conexion con el servidor
		socket.on('verificar-conexion', (socketId) => {
			// responde solo al que solicita la verificacion
			io.to(socketId).emit('verificar-conexion', true); // responde true si se logra la conexion
		});
		// }
		
		socket.emit('finishLoadDataInitial');

		// notifica que el repartidor esta online
		// 20052021 quitamos porque esto suscede cuando abren la aplicacion es decir cuando el socket se conecta
		// io.to('MONITOR').emit('notifica-repartidor-online', dataCliente);

		// ver si tenemos un pedido pendiente de aceptar // ver si solicito libear pedido
		const pedioPendienteAceptar = await apiPwaRepartidor.getPedidoPendienteAceptar(dataCliente.idrepartidor);
		
		try {
			if ( pedioPendienteAceptar ) {
				if ( pedioPendienteAceptar[0].solicita_liberar_pedido === 1 ) {
					apiPwaRepartidor.setLiberarPedido(dataCliente.idrepartidor);
				} else {					
					socket.emit('repartidor-get-pedido-pendiente-aceptar', pedioPendienteAceptar);
				}	
			}		
		} catch(error) {
			logger.error('error', error)
		}
		

		// registrar como conectado en cliente_socketid
		apiPwaRepartidor.setRepartidorConectado(dataCliente);		

		// notificador online ofline
		socket.on('notifica-repartidor-online', (socketId) => {
			logger.debug('notifica-repartidor-online');
			io.to('MONITOR').emit('notifica-repartidor-online', dataCliente);
		});

		socket.on('notifica-repartidor-ofline', (socketId) => {
			logger.debug('notifica-repartidor-ofline');
			io.to('MONITOR').emit('notifica-repartidor-online', dataCliente);
		});

		


		// escuchar estado del pedido // reparitor asignado // en camino //  llego
		socket.on('repartidor-notifica-estado-pedido', async (dataCliente) => {			
			// update estado del pedido
			apiPwaRepartidor.setUpdateEstadoPedido(dataCliente.idpedido, dataCliente.estado);

			const socketIdCliente = await apiPwa.getSocketIdCliente(dataCliente.idcliente);
			logger.debug('repartidor-notifica-estado-pedido', socketIdCliente[0].socketid +'  estado: '+dataCliente.estado);

			io.to(socketIdCliente[0].socketid).emit('repartidor-notifica-estado-pedido', dataCliente.estado);	
		});

		// escuchar ubicacion del repartidor al cliente
		socket.on('repartidor-notifica-ubicacion', async (datosUbicacion) => {
			// notifica a cliente
			if ( datosUbicacion.idcliente ) {
				const socketIdCliente = await apiPwa.getSocketIdCliente(datosUbicacion.idcliente);
				try {
					if ( socketIdCliente[0].socketid ) { // puede ser un pedido que el comercio llamo repartidor
						logger.debug('repartidor-notifica-ubicacion ==> al cliente', socketIdCliente[0].socketid + '  -> '+ JSON.stringify(datosUbicacion));
						io.to(socketIdCliente[0].socketid).emit('repartidor-notifica-ubicacion', datosUbicacion.coordenadas);
					}
				}						
				catch(err) {logger.error('cliente sin socket id',err)}
			}			

			// notifica a comercio
			if ( datosUbicacion.idsede ) {
				const socketIdComercio = await apiPwaComercio.getSocketIdComercio(datosUbicacion.idsede);
				logger.debug('repartidor-notifica-ubicacion ==> al comercio', socketIdComercio[0].socketid + '  -> '+ JSON.stringify(datosUbicacion));
				io.to(socketIdComercio[0].socketid).emit('repartidor-notifica-ubicacion', datosUbicacion);	
			}		

			// notificar a la central monitor
			io.to('MONITOR').emit('repartidor-notifica-ubicacion', datosUbicacion);

		});


		// reasignar pedido // enviar a otro repartidor
		// socket.on('repartidor-declina-pedido', async (_dataPedido) => {

		// 	// obtener lista de repartidores
		// 	const listRepartidores = await apiPwaRepartidor.getRepartidoreForPedido(_dataPedido);

		// 	// pasamos a funcion que maneja las notificaciones		
		// 	apiPwaRepartidor.sendPedidoRepartidor(listRepartidores, _dataPedido, io);
		// });		


		/// repartidor - comunicacion con el comercio 
		/// repartidor - comunicacion con el comercio


		// dataPedido = { idpedido, idsede, datosRepartidor }
		socket.on('repartidor-acepta-pedido', async (dataPedido) => {

			

			// dataPedido viene vacio =verificar= 221022
			try {
				// buscamos socketid de comercio para notificar
				const socketidComercio = await apiPwaComercio.getSocketIdComercio(dataPedido.idsede);
				logger.debug('repartidor-notifica-a-comercio-pedido-aceptado', socketidComercio +'  pedido: '+ dataPedido);

				io.to(socketidComercio[0].socketid).emit('repartidor-notifica-a-comercio-pedido-aceptado', dataPedido);	

				// NOTIFICA a la central
				io.to('MONITOR').emit('repartidor-notifica-a-comercio-pedido-aceptado', true);
			} catch (err) {logger.error(err)}

		});


		// notifica al cliente que repartidor tomo su pedido
		socket.on('repartidor-notifica-cliente-acepto-pedido', async (listClienteNotifica) => {
			logger.debug('repartidor-notifica-cliente-acepto-pedido =========== repartidor', listClienteNotifica)
			logger.debug('typeof listClienteNotifica', typeof listClienteNotifica);

			// si listClienteNotifica no es formato json lo convertimos
			if ( typeof listClienteNotifica === 'string' ) {
				listClienteNotifica = JSON.parse(listClienteNotifica);
			}
			
			// si no existe la funcion map en listClienteNotifica.map entonces manejamos el error
			if ( !listClienteNotifica.map ) {
				logger.error('error listClienteNotifica.map', listClienteNotifica);
				return;
			}	

			listClienteNotifica.map(c => {
				c.tipo = 2;
				sendMsjSocketWsp(c);

				// actualiza el time_line // hora_pedido_aceptado								
				apiPwa.updateTimeLinePedido(c.idpedido, c.time_line);


				// notifica al control de pedidos del comercio
				const _chanelNotifica = 'room' + c.idorg +''+ c.idsede;
				socket.to(_chanelNotifica).emit('repartidor-notifica-cliente-acepto-pedido-res', c);
				logger.debug('_chanelNotifica ===========', _chanelNotifica);
			});
		});

		// notifica al cliente time line del pedido
		socket.on('repartidor-notifica-cliente-time-line', async (listClienteNotifica) => {
			logger.debug('repartidor-notifica-cliente-time-line =========== repartidor', listClienteNotifica)
			listClienteNotifica.map(c => {
				c.tipo = 5; 
				switch (c.tipo_msj) {
					case 1: // llegue al comercio						
						c.msj = `🤖 Hola, el repartidor a cargo de su pedido *${c.repartidor_nom}* ya llegó a ${c.establecimiento}, y esta esperando su pedido. Puede comunicarse con él si tiene alguna indicación adicional. 📞 ${c.repartidor_telefono}`
						break;
					case 2: // estoy en camino a entregar el pedido
						c.msj = `🤖 El repartidor esta camino a entregarle su pedido, por favor este alerta a su teléfono le llamará cuando este cerca.`
						break;
				} 
					
				// actualiza time_line_pedido
				apiPwa.updateTimeLinePedido(c.idpedido, c.time_line);



				logger.debug('mensaje === ', c)
				sendMsjSocketWsp(c);

				// NOTIFICA a la central
				io.to('MONITOR').emit('repartidor-notifica-cliente-time-line', c);

				// notifica al control de pedidos del comercio
				// const _chanelNotifica = 'room' + c.idorg +''+ c.idsede;
				// socket.to(_chanelNotifica).emit('repartidor-notifica-cliente-time-line', c);				
			});
		});


		// repartidor propio
		socket.on('repartidor-propio-notifica-fin-pedido', async (dataPedido) => {
			logger.debug('repartidor-propio-notifica-fin-pedido', dataPedido);
			// dataPedido viene vacio =verificar= 221022
			try {
				apiPwaRepartidor.setUpdateEstadoPedido(dataPedido.idpedido, 4); // fin pedido
				apiPwaRepartidor.setUpdateRepartidorOcupado(dataPedido.idrepartidor, 0);

				// para que el comercio actualice el marker
				// notifica a comercio			
				const idsede = dataPedido.datosComercio ? dataPedido.datosComercio.idsede : dataPedido.idsede
				const socketidComercio = await apiPwaComercio.getSocketIdComercio(idsede);
				io.to(socketidComercio[0].socketid).emit('repartidor-propio-notifica-fin-pedido', dataPedido);


				io.to('MONITOR').emit('repartidor-notifica-fin-pedido', {idrepartidor: dataPedido.idrepartidor, idpedido: dataPedido.idpedido});
			} catch (err) { logger.error('error payload vacio', err) }
		});

		// notifica fin de solo un pedido de grupo de pedidos
		socket.on('repartidor-notifica-fin-one-pedido', async (dataPedido) => {
			logger.debug('repartidor-notifica-fin-one-pedido', dataPedido);

			apiPwaRepartidor.setUpdateEstadoPedido(dataPedido.idpedido, 4); // fin pedido
			// apiPwaRepartidor.setUpdateRepartidorOcupado(dataPedido.idrepartidor, 0);

			// para que el comercio actualice el marker
			// notifica a comercio			
			const idComercio = dataPedido.datosComercio ? dataPedido.datosComercio.idsede : dataPedido.idsede;
			const socketidComercio = await apiPwaComercio.getSocketIdComercio(idComercio);
			io.to(socketidComercio[0].socketid).emit('repartidor-notifica-fin-pedido', dataPedido);

			// notifica a control pedidos restobar
			const _chanelConect = `room${dataPedido.idorg}${dataPedido.idsede}`;
			logger.debug(_chanelConect);
			io.to(_chanelConect).emit('repartidor-notifica-fin-pedido', dataPedido.idpedido);

			io.to('MONITOR').emit('repartidor-notifica-fin-pedido', {idrepartidor: dataPedido.idrepartidor, idpedido: dataPedido.idpedido});
		});



		// notifica el fin de todo el grupo de pedidos
		socket.on('repartidor-grupo-pedido-finalizado', (idrepartidor) => {
			logger.debug('repartidor-grupo-pedido-finalizado', idrepartidor);			
			apiPwaRepartidor.setUpdateRepartidorOcupado(idrepartidor, 0);

			// notifica a monitor
			io.to('MONITOR').emit('repartidor-grupo-pedido-finalizado', idrepartidor);
		});


	}

	function socketClienteDeliveryEstablecimientos(dataCliente, socket) {
		logger.debug('desde func socketClienteDeliveryEstablecimientos', dataCliente);

		const chanelConectPatioDelivery = 'roomPatioDelivery';
		logger.debug('conectado al room ', chanelConectPatioDelivery);
		socket.join(chanelConectPatioDelivery);

		// mantener el socket id
		// if (dataCliente.firts_socketid) {
		// 	dataCliente.socketid = dataCliente.firts_socketid;
		// 	socket.id = dataCliente.firts_socketid;

			logger.debug ('sin cambiar socket', dataCliente);
		// }
		
		// registrar como conectado en cliente_socketid
		apiPwa.setClienteConectado(dataCliente);

		// escuhar fin del pedido cuando el cliente recibio el pedido y califico el servicio
		socket.on('repartidor-notifica-fin-pedido', async (dataPedido) => {
			const socketIdCliente = await apiPwaRepartidor.getSocketIdRepartidor(dataPedido.idrepartidor);
			logger.debug('repartidor-notifica-fin-pedido', socketIdCliente[0].socketid);

			// cerrar pedido
			apiPwaRepartidor.setUpdateEstadoPedido(dataPedido.idpedido, 4); // fin pedido
			// apiPwaRepartidor.setUpdateRepartidorOcupado(dataPedido.idrepartidor, 0);

			// notifica al repartidor para que califique cliente
			io.to(socketIdCliente[0].socketid).emit('repartidor-notifica-fin-pedido', dataPedido);
		});		
		

		
		// nuevo pedido mandado - > arriba
		// socket.on('nuevo-pedido-mandado', async () => {
		// 	// notifica al monitor		
		// 	io.to('MONITOR').emit('monitor-nuevo-pedido-mandado', true);
		// });

	}


	// retiros cash atm
	function socketClienteCashAtm(dataCliente, socket) {
		logger.debug('desde func socketClienteCashAtm', dataCliente);	

		// retiro cash atm
		socket.on('nuevo-retiro-cash-atm', async () => {
			// notifica al monitor
			logger.debug('nuevo-retiro-cash-atm notifica monitor');
			io.to('MONITOR').emit('monitor-nuevo-retiro-cash-atm', true);
		});
	}


	// comercio
	async function socketComercioDelivery(dataCliente, socket) {
		logger.debug('desde func socketComercio', dataCliente);
		apiPwaComercio.setComercioConectado(dataCliente);

		// data del la sede
		const objDataSede = await apiPwa.getDataSede(dataCliente);
		socket.emit('getDataSede', objDataSede);


		// traer ordenes pendientes
		// const objPedidosPendientes = await apiPwaComercio.getOrdenesPedientesSocket(dataCliente);		
		// socket.emit('get-comercio-pedidos-pendientes', null);

		// notifica al pedido que tiene un pedido asignado desde el comercio
		socket.on('set-repartidor-pedido-asigna-comercio', async (dataPedido) => {
			logger.debug('set-repartidor-pedido-asigna-comercio', dataPedido);

			const socketIdRepartidor = await apiPwaRepartidor.getSocketIdRepartidor(dataPedido.idrepartidor);
			io.to(socketIdRepartidor[0].socketid).emit('set-repartidor-pedido-asigna-comercio', dataPedido);				

			// notificacion push nuevo pedido
			apiPwaRepartidor.sendOnlyNotificaPush(socketIdRepartidor[0].key_suscripcion_push, 0);
		});


		// comercio con repartidores propios solicita repartidor de la red papaya
		socket.on('set-solicitar-repartidor-papaya', () => {
			apiPwaRepartidor.runLoopSearchRepartidor(io, dataCliente.idsede);
		});		



				


	}

	async function socketMonitorPacman(dataCliente, socket) {
		logger.debug('desde func socketMonitorPacman', dataCliente);
		socket.join('MONITOR');

		// notifica al repartidor del pedido asinado manualmente
		socket.on('set-asigna-pedido-repartidor-manual', async (dataPedido) => {				
			logger.debug('====== set-asigna-pedido-repartidor-manual', dataPedido);
			const pedioPendienteAceptar = await apiPwaRepartidor.getPedidoPendienteAceptar(dataPedido.idrepartidor);
			const socketIdRepartidor = pedioPendienteAceptar[0].socketid;
			io.to(socketIdRepartidor).emit('repartidor-get-pedido-pendiente-aceptar', pedioPendienteAceptar);

			// notificacion push nuevo pedido
			apiPwaRepartidor.sendOnlyNotificaPush(pedioPendienteAceptar[0].key_suscripcion_push, 0);

			// notifica a monitor para refesh vista
			io.to('MONITOR').emit('set-asigna-pedido-repartidor-manual', {idrepartidor: dataPedido.idrepartidor, pedidos: dataPedido.pedidos});
			// io.to('MONITOR').emit('set-asigna-pedido-repartidor-manual', {idrepartidor: dataPedido.idrepartidor});

			// quitar el pedido al repartidor que estaba notificando
			if ( dataPedido.socket_repartidor_quitar ) {
				io.to(dataPedido.socket_repartidor_quitar).emit('repartidor-notifica-server-quita-pedido', null);
			}
			
		});		


		// cerarr comercio desde el pacman
		socket.on('set-cerrar-comercio-from-pacman', async (comercioId) => {
			logger.debug('set-cerrar-comercio-from-pacman', comercioId);
			socket.to('roomPatioDelivery').emit('set-comercio-open-change-from-monitor', comercioId);
		});


		// notifica al cliente que repartidor tomo su pedido
		socket.on('repartidor-notifica-cliente-acepto-pedido', async (listClienteNotifica) => {
			logger.debug('repartidor-notifica-cliente-acepto-pedido ===========', listClienteNotifica)
			

			// notifica wsp cliente
			listClienteNotifica.map(c => {
				c.tipo = 2;
				sendMsjSocketWsp(c)

				// actualiza el time_line // hora_pedido_aceptado								
				apiPwa.updateTimeLinePedido(c.idpedido, c.time_line);

				// notifica al control de pedidos
				const _chanelNotifica = 'room' + c.idorg +''+ c.idsede;
				socket.to(_chanelNotifica).emit('repartidor-notifica-cliente-acepto-pedido-res', c);
				logger.debug('_chanelNotifica ===========', _chanelNotifica);
			});
		});

		// notifica dede pacman al cliente de recoger su pedido
		socket.on('set-monitor-pedido-recoger', async (_sendServerMsj) => {
			logger.debug('mensaje recoger =============> ', _sendServerMsj);
			apiPwaRepartidor.setAsignarRepartoAtencionCliente(_sendServerMsj.idpedido);
			sendMsjSocketWsp(_sendServerMsj);
		});		

	}


	function socketServerSendMsj(dataCliente, socket) {
		socket.join('SERVERMSJ');
		logger.debug('desde func server send msjs conectado a SERVERMSJ', dataCliente);

		socket.on('mensaje-test-w', async (val) => {
			logger.debug('mensaje-test-w', val);			
			io.to('SERVERMSJ').emit('mensaje-test-w', val);
		});


		socket.on('mensaje-verificacion-telefono-rpt', async (val) => {
			logger.debug('mensaje-verificacion-telefono-rpt', val);			
			io.to(val.idsocket).emit('mensaje-verificacion-telefono-rpt', val);
		});

		// io.to('SERVERMSJ').emit('connect', true);



		// setTimeout(function(){ 
		// 	const _sendServerMsj = `{"tipo": 0, "s": "16.13", "p": 20630, "h": "${new Date().toISOString()}", "t": "960518915"}`;
		// 	sendMsjSocketWsp(_sendServerMsj);
		// 	// io.to('SERVERMSJ').emit('enviado-send-msj', _sendServerMsj);
		// }, 3000);
		
	}


	// evniar mensajes al whatsapp 130621
	function sendMsjSocketWsp(dataMsj, dataSocket = null) {
		// 0: nuevo pedido notifica comercio
		// 1: verificar telefono
		// 2: notifica al cliente el repartidor que acepto pedido
		
		apiMessageWsp.sendMsjSocketWsp(dataMsj, io, dataSocket);
		
		// dataMsj = typeof dataMsj !== 'object' ? JSON.parse(dataMsj) : dataMsj;
		// const tipo = dataMsj.tipo;

		// var _sendServerMsj = {telefono: 0, msj: '', tipo: 0};
		// var msj;
		// var url = '';
		// var _dataUrl = '';

		// if ( tipo === 0 ) {
		// 	_dataUrl = `{"s": "${dataMsj.s}", "p": ${dataMsj.p}, "h": "${dataMsj.h}"}`;
		// 	// url = `https://comercio.papaya.com.pe/#/order-last?p=${btoa(_dataUrl)}`; // 2322 quitamos el hashtag #
		// 	url = `https://comercio.papaya.com.pe/order-last?p=${btoa(_dataUrl)}`;
		// 	msj = `🤖 🎉 🎉 Tienes un nuevo pedido por Papaya Express, chequealo aqui: ${url}`;
		// 	_sendServerMsj.tipo = 0;
		// 	_sendServerMsj.telefono = dataMsj.t;
		// 	_sendServerMsj.msj = msj;
		// }

		// // verificar telefono
		// if ( tipo === 1 ) {			
		// 	_sendServerMsj.tipo = 1;
		// 	_sendServerMsj.telefono = dataMsj.t;
		// 	_sendServerMsj.msj = '📞🔐 Papaya Express, su código de verificación es: ' + dataMsj.cod;
		// 	_sendServerMsj.idcliente = dataMsj.idcliente;
		// 	_sendServerMsj.idsocket = dataMsj.idsocket;
		// }


		// // notifica al cliente el repartidor que acepto pedido
		// if ( tipo === 2 ) {			
		// 	_sendServerMsj.tipo = 2;
		// 	_sendServerMsj.telefono = dataMsj.telefono;
		// 	_sendServerMsj.msj = `🤖 Hola ${dataMsj.nombre}, el repartidor que está a cargo de su pedido de ${dataMsj.establecimiento} es: ${dataMsj.repartidor_nom} 📞 ${dataMsj.repartidor_telefono} 🙋‍♂️\n\nLe llamará cuando este cerca ó para informarle de su pedido.`			
		// }

		// // notifica url descarga pdf comprobante
		// if ( tipo === 3 ) {
		// 	const _user_id = dataMsj.user_id ? `/${dataMsj.user_id}` : '';
		// 	const _concat_external_id = dataMsj.external_id + _user_id;
		// 	const _ulrComprobante = `https://apifac.papaya.com.pe/downloads/document/pdf/${_concat_external_id}`;
		// 	_sendServerMsj.tipo = 3;
		// 	_sendServerMsj.telefono = dataMsj.telefono;
		// 	// _sendServerMsj.msj = `🤖 Hola, adjuntamos el link de descarga de su comprobante electrónico de ${dataMsj.comercio} número ${dataMsj.numero_comprobante}. \n\n 📄👆 ${_ulrComprobante} \n\nTambién lo puede consultar en: papaya.com.pe`;			
		// 	_sendServerMsj.msj = `🤖 Hola, adjuntamos su comprobante electrónico de ${dataMsj.comercio} número ${dataMsj.numero_comprobante}. También lo puede consultar en: papaya.com.pe`;			
			
		// 	_sendServerMsj.url_comprobante = _ulrComprobante;
		// 	_sendServerMsj.url_comprobante_xml = _ulrComprobante.replace('/pdf/','/xml/');
		// 	_sendServerMsj.nombre_file = dataMsj.numero_comprobante;
		// }

		// // notifica al cliente que pase a recoger el pedido
		// if ( tipo === 4 ) {
		// 	_sendServerMsj.tipo = 4;
		// 	_sendServerMsj.telefono = dataMsj.telefono;
		// 	_sendServerMsj.msj = `🤖 Hola ${dataMsj.nombre} su pedido de ${dataMsj.establecimiento} puede pasar a recogerlo en ${dataMsj.tiempo_entrega} aproximadamente.`;
		// }

		// // notifica al cliente el repartidor time line del pedido
		// if ( tipo === 5 ) {			
		// 	_sendServerMsj.tipo = 5;
		// 	_sendServerMsj.telefono = dataMsj.telefono;
		// 	// _sendServerMsj.msj = `🤖 Hola ${dataMsj.nombre}, el repartidor que está a cargo de su pedido de ${dataMsj.establecimiento} es: ${dataMsj.repartidor_nom} 📞 ${dataMsj.repartidor_telefono} 🙋‍♂️\n\nLe llamará cuando este cerca ó para informarle de su pedido.`			
		// 	_sendServerMsj.msj = dataMsj.msj
		// }


		// io.to('SERVERMSJ').emit('enviado-send-msj', _sendServerMsj);
	}
}
