const apiPwa = require('./apiPwa_v1.js');
const apiPwaRepartidor = require('./apiRepartidor.js');
const apiPwaComercio = require('./apiComercio.js');
let apiPrintServer = require('./apiPrintServer');
var btoa = require('btoa');
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
// var socketMaster; 

module.exports.socketsOn = function(io){ // Success Web Response

	// middleware
	// io.use((socket, next) => {
	//   let token = socket.handshake.query.token;
	//   console.log('token', token);
	//   // if (isValid(token)) {
	//     return next();
	//   // }
	//   // return next(new Error('authentication error'));
	// });


	io.on('connection', async function(socket) {
		console.log('datos socket', socket.id);
		let dataSocket = socket.handshake.query;		
		dataSocket.socketid = socket.id;

		// const rptDate = new Date().toLocaleString().split(' ');
		// var aaa = '2020-05-28'.replace(',', '');
		// aaa = aaa.replace(/(\d+)\/(\d+)\/(\d+)/, '$3-$1-$2');
		// console.log('===== rptDate ========', aaa);		
		// console.log('===== rptDate ========', rptDate[1]);		

		console.log('datos socket JSON', dataSocket);

		const dataCliente = dataSocket;

		// mensaje de confirmacion de telefono
		socket.on('msj-confirma-telefono', async (data) => {
			console.log('msj-confirma-telefono', data);
			const codigoVerificacion = Math.round(Math.random()* (9000 - 1)+parseInt(1000));
			const _sendServerMsj = `{"tipo": 1, "cod": ${codigoVerificacion}, "t": "${data.numberphone}", "idcliente": ${data.idcliente}, "idsocket": "${data.idsocket}"}`;

			data.cod = codigoVerificacion;
			// guardamos codigo en bd
			apiPwa.setCodigoVerificacionTelefonoCliente(data);

			sendMsjSocketWsp(_sendServerMsj);
		});

		// obtener date
		socket.on('date-now-info', (e) =>{
			socket.emit('date-now-info', new Date());
		});


		// nuevo pedido mandado
		socket.on('nuevo-pedido-mandado', async () => {
			// notifica al monitor
			console.log('nuevo-pedido-mandado');
			io.to('MONITOR').emit('monitor-nuevo-pedido-mandado', true);
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

		



		
		
		
		// si viene desde app pedidos
		// 1 is from pwa 0 is web // si es 0 web no da carta
		const isFromPwa = dataSocket.isFromApp ? parseInt(dataSocket.isFromApp) : 1;
		console.log('isFromPwa', isFromPwa);

		// nos conectamos al canal idorg+idsede
		const chanelConect = 'room'+dataSocket.idorg + dataSocket.idsede;
		console.log('conectado al room ', chanelConect);

		socket.join(chanelConect);


		// Servidor de Impresion 070222
		if (dataCliente.isServerPrint === '1') {
			// socketMaster = socket; 
			console.log('es print server');
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

			// console.log('tipo consumo', objTipoConsumo);
			// console.log('reglas carta y subtotales', objReglasCarta);
			// console.log('a user connected sokecontroller - servimos la carta', objCarta );		
			// console.log('a user connected sokecontroller - servimos datos de la sede', objDataSede );

			console.log('emitido a ', chanelConect);
			// socket.emit('getLaCarta', objCarta);
			console.log('=========emitido carta=====', chanelConect);
			// socket.emit('getTipoConsumo', objTipoConsumo);
			// socket.emit('getReglasCarta', objReglasCarta);
			// socket.emit('getDataSede', objDataSede);
			// socket.emit('getDataSedeDescuentos', objDescuentos);

			// socket.emit('finishLoadDataInitial');

		}		

		// para sacar el loader
		socket.emit('finishLoadDataInitial');

		// item modificado
		socket.on('itemModificado', async function(item) {
			// console.log('itemModificado', item);

			// manejar cantidad/

			

			console.log('item', item);
			// actualizamos en bd - si un cliente nuevo solicita la carta tendra la carta actualizado
			item.cantidad = isNaN(item.cantidad) || item.cantidad === null || item.cantidad === undefined ? 'ND'  : item.cantidad;
			
			// la cantidad viene 999 cuando es nd y la porcion si viene nd
			// si isporcion es undefined entonces es un subtitem agregado desde venta rapida, colocamos ND
			item.cantidad = parseInt(item.cantidad) >= 999 ? item.isporcion || 'ND' : item.cantidad;
			if (item.cantidad != 'ND') {	
				console.log('item.sumar', item);	
				// var _cantItem = parseFloat(item.cantidad);
				var _cantSumar = item.sumar ? -1 : parseInt(item.sumar) === 0 ? 0 : 1;
				item.cantidadSumar = _cantSumar;
				console.log('item.cantidadSumar', item.cantidadSumar);
				// item.cantidad = _cantItem;		

				// console.log('json item ', JSON.stringify(item));

				const rptCantidad = await apiPwa.setItemCarta(0, item);
				console.log('cantidad update mysql ', rptCantidad);

				// if ( item.isporcion != 'SP' ) {
				item.cantidad = rptCantidad[0].cantidad;
				//}				

				// subitems
				console.log('rptCantidad[0].listSubItems ', rptCantidad[0].listSubItems );

				// console.log('item subitems', item.subitems);

				if ( rptCantidad[0].listSubItems ) {
					rptCantidad[0].listSubItems.map(subitem => {

						item.subitems.map(s => {							
							let itemFind = s.opciones.filter(_subItem => parseInt(_subItem.iditem_subitem) === parseInt(subitem.iditem_subitem))[0];

							if ( itemFind ) {
								itemFind.cantidad = subitem.cantidad;
							}
						});
					});
				}			

				const rpt = {
					item : item,
					listItemPorcion: item.isporcion === 'SP' ? JSON.parse(rptCantidad[0].listItemsPorcion) : null,	
					listSubItems: rptCantidad[0].listSubItems				
				}

				console.log('itemModificado', item);		

				io.to(chanelConect).emit('itemModificado', item); 
				io.to(chanelConect).emit('itemModificado-pwa', rpt); // para no modificar en web
			} else {
				io.to(chanelConect).emit('itemModificado', item);
				io.to(chanelConect).emit('itemModificado-pwa', item);
			}			
			
			// envia la cantidad a todos incluyendo al emisor, para actualizar en objCarta
			// io.emit('itemModificado', item);
		});


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
			console.log('nuevoItemAddInCarta', item);
			socket.broadcast.to(chanelConect).emit('nuevoItemAddInCarta', item);
		});

		// restablecer pedido despues de que se termino el tiempo de espera
		socket.on('resetPedido', (listPedido) => {
			console.log('resetPedido ', listPedido);
			// recibe items
			listPedido.map(async (item) => {				
				item.cantidad = isNaN(item.cantidad) || item.cantidad === null || item.cantidad === undefined ? 'ND'  : item.cantidad;
				// item.cantidad = parseInt(item.cantidad) === 999 ? item.isporcion : item.cantidad; // la cantidad viene 999 cuando es nd y la porcion si viene nd
				// la cantidad viene 999 cuando es nd y la porcion si viene nd
				// si isporcion es undefined entonces es un subtitem agregado desde venta rapida, colocamos ND
				item.cantidad = parseInt(item.cantidad) >= 999 || parseInt(item.stock_actual) >= 999 ? item.isporcion || 'ND' : item.cantidad;
				if (item.cantidad != 'ND') {
					item.cantidad_reset = item.cantidad_seleccionada;					
					item.cantidad_seleccionada = 0;
					console.log('items recuperar ', item);
					
					const rptCantidad = await apiPwa.setItemCarta(1, item);
					item.cantidad = rptCantidad[0].cantidad;
					console.log('subitems_view ', item.subitems_view);

					console.log('respuesta reset ', rptCantidad);

					// subitems
					console.log('rptCantidad[0].listSubItems ', rptCantidad[0].listSubItems );

					// console.log('item.subitems', item.subitems);

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
										console.log(error);
										console.log('item.subitems', item.subitems);
									}	

								}								
							}							
						});
					}

					// console.log('item reseteado', item);
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
			console.log('respuesta del socket ', rpt);
			callback(rpt);
		});

		// hay un nuevo pedido - guardar
		socket.on('nuevoPedido', async (dataSend, callback) => {
			console.log('tipo dato', typeof dataSend);

			var telefonoComercio = '';

			// console.log('nuevoPedido ', dataSend);			
			if ( typeof dataSend === 'string' ) {
				dataSend = JSON.parse(dataSend);
			}
			const rpt = await apiPwa.setNuevoPedido(dataCliente, dataSend);

			console.log('respuesta del socket ', rpt);

			if ( callback ) {
				callback(rpt);			
			}
			

			// error
			if ( rpt === false ) {
				return;
			}
			// console.log('respuesta guardar pedido ', JSON.stringify(rpt[0].idpedido));


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
				// 	// console.log(' ==== notifica sms comercio =====', socketIdComercio[0].telefono_notifica);					
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

			// 	console.log ('datos para enviar repartidor ', JSON.stringify(_dataPedido));
				
			// 	// obtener lista de repartidores
			// 	const listRepartidores = await apiPwaRepartidor.getRepartidoreForPedido(_dataPedido);

			// 	// pasamos a funcion que maneja las notificaciones
			// 	console.log('lista de repartidores', listRepartidores);
			// 	apiPwaRepartidor.sendPedidoRepartidor(listRepartidores, _dataPedido, io);


			}


			// para actaluzar vista de caja // control de pedidos
			// socket.broadcast.to(chanelConect).emit('nuevoPedido', dataSend.dataPedido);			


			io.to(chanelConect).emit('nuevoPedido', dataSend.dataPedido);			

			io.to(chanelConect).emit('nuevoPedido-for-list-mesas', dataSend.dataPedido);

			// notifica al monitor nuevo pedido para emitir alerta
			if ( dataSend.dataPedido.p_header.delivery === 1 ) {
				io.to('MONITOR').emit('nuevoPedido', dataSend.dataPedido);

				console.log(' ====== notifica al servidor de mensajes ===== telefono notifica ====> ', telefonoComercio);

				if ( telefonoComercio !== '' ) {
					const _sendServerMsj = `{"tipo":0, "s": "${dataCliente.idorg}.${dataCliente.idsede}", "p": ${dataSend.dataPedido.idpedido}, "h": "${new Date().toISOString()}", "t":"${telefonoComercio}"}`;					
					sendMsjSocketWsp(_sendServerMsj);
				}				
			}
			// io.to('MONITOR').emit('nuevoPedido', dataCliente);


			// registrar comanda en print_server_detalle
			// console.log('printer comanda', JSON.stringify(rpt[0]));
			// console.log('printerComanda', JSON.stringify(rpt[0].data));
			//apiPwa.setPrintComanda(dataCliente, dataSend.dataPrint);
			// emitimos para print server
			// socket.broadcast.to(chanelConect).emit('printerComanda', rpt);
			xMandarImprimirComanda (rpt[0].data, socket, chanelConect);
		});

		// esta funcion no guarda solo notifica del nuevo pedido
		// solo envia el data pedido con el id del pedido registrado por http		
		// para evitar pedidos perdidos cuando el socket pierde conexion
		socket.on('nuevoPedido2', async (dataSend) => {
			console.log('nuevoPedido2 ', dataSend);	

			var telefonoComercio = '';		
			// const rpt = await apiPwa.setNuevoPedido(dataCliente, dataSend);

			// console.log('respuesta guardar pedido ', JSON.stringify(rpt[0].idpedido));


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
				// 	// console.log(' ==== notifica sms comercio =====', socketIdComercio[0].telefono_notifica);					
				// } 

				// notificacion push
				const socketIdComercio = await apiPwaComercio.getSocketIdComercio(dataCliente.idsede);
				telefonoComercio = socketIdComercio[0].telefono_notifica;
				apiPwaComercio.sendOnlyNotificaPush(socketIdComercio[0].key_suscripcion_push, 0);				

			}


			io.to(chanelConect).emit('nuevoPedido', dataSend.dataPedido);

			// notifica al monitor nuevo pedido para emitir alerta
			console.log(' ====== notifica al monitor =====');
			if ( dataSend.dataPedido.p_header.delivery === 1 ) {
				io.to('MONITOR').emit('nuevoPedido', dataSend.dataPedido);


				console.log(' ====== notifica al servidor de mensajes ===== telefono notifica ====> ', telefonoComercio);
				if ( telefonoComercio !== '' ) {
					const _sendServerMsj = `{"tipo":0, "s": "${dataCliente.idorg}.${dataCliente.idsede}", "p": ${dataSend.dataPedido.idpedido}, "h": "${new Date().toISOString()}", "t":"${telefonoComercio}"}`;
					// io.to('SERVERMSJ').emit('nuevoPedido', _sendServerMsj); // para enviar el url del pedido
					sendMsjSocketWsp(_sendServerMsj);
				}
			}


			// data print
			
			const _dataPrint = dataSend.dataPrint;			
			if ( _dataPrint == null ) { return }
			console.log('!!!! ====== notifica al dataSend del mandar imprimir =====', JSON.stringify(dataSend));
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

					console.log(' ====== printerComanda =====', dataPrintSend);
					socket.broadcast.to(chanelConect).emit('printerComanda', dataPrintSend);
				}				
			});			
		});

		// no guarda lo que envia el cliente solo notifica que hay un nuevo pedido, para imprimir en patalla o ticketera
		// para imprmir solo la comanda desde control pedidos, venta rapida, zona despacho
		socket.on('printerOnly', (dataSend) => {			
			dataSend.hora = n;
			console.log('printerOnly', dataSend);
			socket.broadcast.to(chanelConect).emit('printerOnly', dataSend);
			socket.broadcast.to(chanelConect).emit('nuevoPedido-for-list-mesas', dataSend);

			// verificar si es delivery que viene de venta rapida para actualizar monitor			
			let isNotificaMonitor = false;
			
			try {
				const jsonPedido = JSON.parse(dataSend.detalle_json);
    			isNotificaMonitor = jsonPedido.Array_enca.delivery === 1;
			} catch (error) {
			    isNotificaMonitor = false;
			}

			console.log('nuevoPedidoUpdateVista', isNotificaMonitor)

			if ( isNotificaMonitor ) {
				console.log('nuevoPedidoUpdateVista', chanelConect)
				io.to(chanelConect).emit('nuevoPedidoUpdateVista', true);				
			}

			
		});

		// marca el pedido como impresor // enviado desde servidor de impresion		
		socket.on('printer-flag-impreso', (dataPedido) => {				
			console.log('==== notifica-impresion-comanda ', dataPedido);
			socket.broadcast.to(chanelConect).emit('notifica-impresion-comanda', dataPedido);
			// apiPwa.setFlagPrinter(dataPedido);

			// notifica a monitor
			io.to('MONITOR').emit('notifica-impresion-comanda', dataPedido);
			apiPwa.setFlagPrinterChangeEstadoPedido(dataPedido);
		});


		// update impreso print_detalle
		socket.on('printer-flag-impreso-update', (id) => {				
			console.log('printer-flag-impreso-update ',id);			
			apiPwa.setFlagPrinter(id);			

			// socket.broadcast.to(chanelConect).emit('notifica-impresion-comanda', JSON.stringify(objP));
		});

		// notifica que se mando a imprimir precuenta para refrescar en el control de pedidos del comercio
		socket.on('notificar-impresion-precuenta', (dataSend) => {						
			console.log('notificar-impresion-precuenta ', chanelConect);
			socket.broadcast.to(chanelConect).emit('notifica-impresion-precuenta', 1);
		});

		// cuando cancela la cuenta // para usuario cliente
		// en front-end busca si la cuenta ha sido cancelada en su totalidad y actualiza la cuenta
		// la notificacion debe ser enviada solo a ese usuario de la cuenta
		// verificar si el pedido ha sido realizado por un usuario cliente - front-end
		socket.on('pedido-pagado-cliente', async (listIdCliente) => {
			const listIdsClie = listIdCliente.join(',');
			console.log('pedido-pagado-cliente', listIdsClie);

			const socketIdCliente = await apiPwa.getSocketIdCliente(listIdsClie);
			console.log('res list socket id', socketIdCliente);
			// buscar socketid por idcliente	

			// emite evento al cliente especifico
			socketIdCliente.map(x => {
				io.to(x.socketid).emit('pedido-pagado-cliente', x.socketid);
			});			
		});
		

		socket.on('disconnect', (reason) => {
			console.log('disconnect');
			// socket.broadcast.to(socket.id).emit('disconnect');
			if (reason === 'io server disconnect') {
			  // the disconnection was initiated by the server, you need to reconnect manually
			  console.log('disconnect ok');
			  socket.connect();			  
			}

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
			console.log('emit notificar-pago-pwa');
			socket.broadcast.to(chanelConect).emit('notificar-pago-pwa', data);
		});

		// notifica llamado del cliente solicitando atentcion
		socket.on('notificar-cliente-llamado', (numMesa) => {			
			const _dataSend = {
				idcliente: dataCliente.idcliente,
				idsede: dataCliente.idsede,
				num_mesa: numMesa
			}

			console.log('notificar-cliente-llamado', _dataSend)

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
			console.log('notificar-cliente-llamado-voy', _dataSend)
			
			apiPwa.saveCallClientMesa(_dataSend,1);

			socket.broadcast.to(chanelConect).emit('notificar-cliente-llamado-remove', numMesa);
		});



		// restobar
		// notifica al pedido que tiene un pedido asignado desde el comercio control de pedidos
		socket.on('set-repartidor-pedido-asigna-comercio', async (dataPedido) => {
			console.log('set-repartidor-pedido-asigna-comercio', dataPedido);
			const socketIdRepartidor = await apiPwaRepartidor.getSocketIdRepartidor(dataPedido.idrepartidor);
			io.to(socketIdRepartidor[0].socketid).emit('set-repartidor-pedido-asigna-comercio', dataPedido);				

			// notificacion push nuevo pedido
			apiPwaRepartidor.sendOnlyNotificaPush(socketIdRepartidor[0].key_suscripcion_push, 0);
		});






		// delivery cliente

		// notifica cambio de estado del pedido
		socket.on('delivery-pedido-estado', async (idcliente) => {
			// const listIdsClie = listIdCliente.join(',');
			console.log('delivery-pedido-estado', idcliente);

			const socketIdCliente = await apiPwa.getSocketIdCliente(idcliente);
			console.log('delivery-pedido-estado', socketIdCliente);
			// buscar socketid por idcliente	

			// emite evento al cliente especifico
			socketIdCliente.map(x => {
				io.to(x.socketid).emit('delivery-pedido-estado', x.socketid);
			});			
		});



		// restobar envia notificacion de pago de servcio
		socket.on('restobar-pago-servicio-on', async (payload) => {
			console.log('restobar-pago-servicio-on', payload);
			io.to('MONITOR').emit('restobar-pago-servicio-on', true);
		});

		// restobar envia url pdf comprobante para enviar a whastapp		
		socket.on('restobar-send-comprobante-url-ws', async (payload) => {
			payload.tipo = 3;			
			console.log('restobar-send-comprobante-url-ws', payload);			
			sendMsjSocketWsp(payload);
			
		});

		socket.on('restobar-notifica-pay-pedido', async (payload) => {			
			console.log('restobar-notifica-pay-pedido-res', payload);	
			socket.broadcast.to(chanelConect).emit('restobar-notifica-pay-pedido-res', payload);					
		});


		// respuesta solicitud de cierre
		socket.on('restobar-permiso-cierre-remoto-respuesta', async (payload) => {			
			console.log('restobar-permiso-cierre-remoto-respuesta', payload);	
			socket.broadcast.to(chanelConect).emit('restobar-permiso-cierre-remoto-respuesta', payload);					
		});

		socket.on('restobar-venta-registrada', () => {			
			const _res = `se proceso un pago >  ${chanelConect}`;
			console.log('=>>>>>>>>>>>>>>>>> ', _res);
			socket.to(chanelConect).emit('restobar-venta-registrada-res', _res);
		});


		// notifica al cliente que repartidor tomo su pedido
		socket.on('repartidor-notifica-cliente-acepto-pedido', async (listClienteNotifica) => {
			console.log('repartidor-notifica-cliente-acepto-pedido ===========', listClienteNotifica)
			listClienteNotifica.map(c => {
				c.tipo = 2;
				sendMsjSocketWsp(c)
			});
		});


		

	});

	
	function xMandarImprimirComanda(dataPrint, socket, chanelConect) {
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

					console.log(' ====== printerComanda ===== xMandarImprimirComanda', dataPrintSend);
					socket.broadcast.to(chanelConect).emit('printerComanda', dataPrintSend);
				}				
			});	
	}


	async function socketRepartidor(dataCliente, socket) {
		console.log('desde func repartatidor', dataCliente);

		// mantener el socket id del repartidor
		// if (dataCliente.firts_socketid) {
		// 	dataCliente.socketid = dataCliente.firts_socketid;
		// 	socket.id = dataCliente.firts_socketid;

		console.log ('repartidor conectado ==========');
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
		

		// registrar como conectado en cliente_socketid
		apiPwaRepartidor.setRepartidorConectado(dataCliente);		

		// notificador online ofline
		socket.on('notifica-repartidor-online', (socketId) => {
			console.log('notifica-repartidor-online');
			io.to('MONITOR').emit('notifica-repartidor-online', dataCliente);
		});

		socket.on('notifica-repartidor-ofline', (socketId) => {
			console.log('notifica-repartidor-ofline');
			io.to('MONITOR').emit('notifica-repartidor-online', dataCliente);
		});

		// ver si tenemos un pedido pendiente de aceptar // ver si solicito libear pedido
		const pedioPendienteAceptar = await apiPwaRepartidor.getPedidoPendienteAceptar(dataCliente.idrepartidor);

		console.log('pedioPendienteAceptar', pedioPendienteAceptar);
		if ( pedioPendienteAceptar[0].solicita_liberar_pedido === 1 ) {
			apiPwaRepartidor.setLiberarPedido(dataCliente.idrepartidor);
		} else {
			socket.emit('repartidor-get-pedido-pendiente-aceptar', pedioPendienteAceptar);
		}		


		// escuchar estado del pedido // reparitor asignado // en camino //  llego
		socket.on('repartidor-notifica-estado-pedido', async (dataCliente) => {			
			// update estado del pedido
			apiPwaRepartidor.setUpdateEstadoPedido(dataCliente.idpedido, dataCliente.estado);

			const socketIdCliente = await apiPwa.getSocketIdCliente(dataCliente.idcliente);
			console.log('repartidor-notifica-estado-pedido', socketIdCliente[0].socketid +'  estado: '+dataCliente.estado);

			io.to(socketIdCliente[0].socketid).emit('repartidor-notifica-estado-pedido', dataCliente.estado);	
		});

		// escuchar ubicacion del repartidor al cliente
		socket.on('repartidor-notifica-ubicacion', async (datosUbicacion) => {
			// notifica a cliente
			if ( datosUbicacion.idcliente ) {
				const socketIdCliente = await apiPwa.getSocketIdCliente(datosUbicacion.idcliente);
				if ( socketIdCliente[0].socketid ) { // puede ser un pedido que el comercio llamo repartidor
					console.log('repartidor-notifica-ubicacion ==> al cliente', socketIdCliente[0].socketid + '  -> '+ JSON.stringify(datosUbicacion));
					io.to(socketIdCliente[0].socketid).emit('repartidor-notifica-ubicacion', datosUbicacion.coordenadas);
				}				
			}			

			// notifica a comercio
			if ( datosUbicacion.idsede ) {
				const socketIdComercio = await apiPwaComercio.getSocketIdComercio(datosUbicacion.idsede);
				console.log('repartidor-notifica-ubicacion ==> al comercio', socketIdComercio[0].socketid + '  -> '+ JSON.stringify(datosUbicacion));
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
		// 	console.log('repartidor-declina-pedido enviar a', listRepartidores[_dataPedido.num_reasignado]);
		// 	apiPwaRepartidor.sendPedidoRepartidor(listRepartidores, _dataPedido, io);
		// });		


		/// repartidor - comunicacion con el comercio 
		/// repartidor - comunicacion con el comercio


		// dataPedido = { idpedido, idsede, datosRepartidor }
		socket.on('repartidor-acepta-pedido', async (dataPedido) => {

			

			// buscamos socketid de comercio para notificar
			const socketidComercio = await apiPwaComercio.getSocketIdComercio(dataPedido.idsede);
			console.log('repartidor-notifica-a-comercio-pedido-aceptado', socketidComercio +'  pedido: '+ dataPedido);

			io.to(socketidComercio[0].socketid).emit('repartidor-notifica-a-comercio-pedido-aceptado', dataPedido);	

			// NOTIFICA a la central
			io.to('MONITOR').emit('repartidor-notifica-a-comercio-pedido-aceptado', true);

		});


		// notifica al cliente que repartidor tomo su pedido
		socket.on('repartidor-notifica-cliente-acepto-pedido', async (listClienteNotifica) => {
			console.log('repartidor-notifica-cliente-acepto-pedido ===========', listClienteNotifica)
			listClienteNotifica.map(c => {
				c.tipo = 2;
				sendMsjSocketWsp(c)
			});
		});


		// repartidor propio
		socket.on('repartidor-propio-notifica-fin-pedido', async (dataPedido) => {
			console.log('repartidor-propio-notifica-fin-pedido', dataPedido);
			apiPwaRepartidor.setUpdateEstadoPedido(dataPedido.idpedido, 4); // fin pedido
			apiPwaRepartidor.setUpdateRepartidorOcupado(dataPedido.idrepartidor, 0);

			// para que el comercio actualice el marker
			// notifica a comercio			
			const socketidComercio = await apiPwaComercio.getSocketIdComercio(dataPedido.datosComercio.idsede);
			io.to(socketidComercio[0].socketid).emit('repartidor-propio-notifica-fin-pedido', dataPedido);


			io.to('MONITOR').emit('repartidor-notifica-fin-pedido', {idrepartidor: dataPedido.idrepartidor, idpedido: dataPedido.idpedido});
		});

		// notifica fin de solo un pedido de grupo de pedidos
		socket.on('repartidor-notifica-fin-one-pedido', async (dataPedido) => {
			console.log('repartidor-notifica-fin-one-pedido', dataPedido);

			apiPwaRepartidor.setUpdateEstadoPedido(dataPedido.idpedido, 4); // fin pedido
			// apiPwaRepartidor.setUpdateRepartidorOcupado(dataPedido.idrepartidor, 0);

			// para que el comercio actualice el marker
			// notifica a comercio			
			const idComercio = dataPedido.datosComercio ? dataPedido.datosComercio.idsede : dataPedido.idsede;
			const socketidComercio = await apiPwaComercio.getSocketIdComercio(idComercio);
			io.to(socketidComercio[0].socketid).emit('repartidor-notifica-fin-pedido', dataPedido);

			io.to('MONITOR').emit('repartidor-notifica-fin-pedido', {idrepartidor: dataPedido.idrepartidor, idpedido: dataPedido.idpedido});
		});



		// notifica el fin de todo el grupo de pedidos
		socket.on('repartidor-grupo-pedido-finalizado', (idrepartidor) => {
			console.log('repartidor-grupo-pedido-finalizado', idrepartidor);			
			apiPwaRepartidor.setUpdateRepartidorOcupado(idrepartidor, 0);

			// notifica a monitor
			io.to('MONITOR').emit('repartidor-grupo-pedido-finalizado', idrepartidor);
		});


	}

	function socketClienteDeliveryEstablecimientos(dataCliente, socket) {
		console.log('desde func socketClienteDeliveryEstablecimientos', dataCliente);

		const chanelConectPatioDelivery = 'roomPatioDelivery';
		console.log('conectado al room ', chanelConectPatioDelivery);
		socket.join(chanelConectPatioDelivery);

		// mantener el socket id
		// if (dataCliente.firts_socketid) {
		// 	dataCliente.socketid = dataCliente.firts_socketid;
		// 	socket.id = dataCliente.firts_socketid;

			console.log ('sin cambiar socket', dataCliente);
		// }
		
		// registrar como conectado en cliente_socketid
		apiPwa.setClienteConectado(dataCliente);

		// escuhar fin del pedido cuando el cliente recibio el pedido y califico el servicio
		socket.on('repartidor-notifica-fin-pedido', async (dataPedido) => {
			const socketIdCliente = await apiPwaRepartidor.getSocketIdRepartidor(dataPedido.idrepartidor);
			console.log('repartidor-notifica-fin-pedido', socketIdCliente[0].socketid);

			// cerrar pedido
			apiPwaRepartidor.setUpdateEstadoPedido(dataPedido.idpedido, 4); // fin pedido
			// apiPwaRepartidor.setUpdateRepartidorOcupado(dataPedido.idrepartidor, 0);

			// notifica al repartidor para que califique cliente
			io.to(socketIdCliente[0].socketid).emit('repartidor-notifica-fin-pedido', dataPedido);
		});		
		

		
		// nuevo pedido mandado - > arriba
		// socket.on('nuevo-pedido-mandado', async () => {
		// 	// notifica al monitor
		// 	console.log('nuevo-pedido-mandado');
		// 	io.to('MONITOR').emit('monitor-nuevo-pedido-mandado', true);
		// });

	}


	// retiros cash atm
	function socketClienteCashAtm(dataCliente, socket) {
		console.log('desde func socketClienteCashAtm', dataCliente);	

		// retiro cash atm
		socket.on('nuevo-retiro-cash-atm', async () => {
			// notifica al monitor
			console.log('nuevo-retiro-cash-atm notifica monitor');
			io.to('MONITOR').emit('monitor-nuevo-retiro-cash-atm', true);
		});
	}


	// comercio
	async function socketComercioDelivery(dataCliente, socket) {
		console.log('desde func socketComercio', dataCliente);
		apiPwaComercio.setComercioConectado(dataCliente);

		// data del la sede
		const objDataSede = await apiPwa.getDataSede(dataCliente);
		socket.emit('getDataSede', objDataSede);


		// traer ordenes pendientes
		// const objPedidosPendientes = await apiPwaComercio.getOrdenesPedientesSocket(dataCliente);		
		// socket.emit('get-comercio-pedidos-pendientes', null);

		// notifica al pedido que tiene un pedido asignado desde el comercio
		socket.on('set-repartidor-pedido-asigna-comercio', async (dataPedido) => {
			console.log('set-repartidor-pedido-asigna-comercio', dataPedido);

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
		console.log('desde func monitor pacman', dataCliente);
		socket.join('MONITOR');

		// notifica al repartidor del pedido asinado manualmente
		socket.on('set-asigna-pedido-repartidor-manual', async (dataPedido) => {				
			console.log('set-asigna-pedido-repartidor-manual');
			const pedioPendienteAceptar = await apiPwaRepartidor.getPedidoPendienteAceptar(dataPedido.idrepartidor);
			const socketIdRepartidor = pedioPendienteAceptar[0].socketid;
			io.to(socketIdRepartidor).emit('repartidor-get-pedido-pendiente-aceptar', pedioPendienteAceptar);

			// notificacion push nuevo pedido
			apiPwaRepartidor.sendOnlyNotificaPush(pedioPendienteAceptar[0].key_suscripcion_push, 0);

			// notifica a monitor para refesh vista
			io.to('MONITOR').emit('set-asigna-pedido-repartidor-manual', {idrepartidor: dataPedido.idrepartidor});
		});		


		// cerarr comercio desde el pacman
		socket.on('set-cerrar-comercio-from-pacman', async (comercioId) => {
			console.log('set-cerrar-comercio-from-pacman', comercioId);
			socket.to('roomPatioDelivery').emit('set-comercio-open-change-from-monitor', comercioId);
		});


		// notifica al cliente que repartidor tomo su pedido
		socket.on('repartidor-notifica-cliente-acepto-pedido', async (listClienteNotifica) => {
			console.log('repartidor-notifica-cliente-acepto-pedido ===========', listClienteNotifica)
			listClienteNotifica.map(c => {
				c.tipo = 2;
				sendMsjSocketWsp(c)
			});
		});

		// notifica dede pacman al cliente de recoger su pedido
		socket.on('set-monitor-pedido-recoger', async (_sendServerMsj) => {
			console.log('mensaje recoger =============> ', _sendServerMsj);
			apiPwaRepartidor.setAsignarRepartoAtencionCliente(_sendServerMsj.idpedido);
			sendMsjSocketWsp(_sendServerMsj);
		});		

	}


	function socketServerSendMsj(dataCliente, socket) {
		socket.join('SERVERMSJ');
		console.log('desde func server send msjs conectado a SERVERMSJ', dataCliente);

		socket.on('mensaje-test-w', async (val) => {
			console.log('mensaje-test-w', val);			
			io.to('SERVERMSJ').emit('mensaje-test-w', val);
		});


		socket.on('mensaje-verificacion-telefono-rpt', async (val) => {
			console.log('mensaje-verificacion-telefono-rpt', val);			
			io.to(val.idsocket).emit('mensaje-verificacion-telefono-rpt', val);
		});

		io.to('SERVERMSJ').emit('connect', true);

		// setTimeout(function(){ 
		// 	console.log('enviado-send-msj')

		// 	const _sendServerMsj = `{"tipo": 0, "s": "16.13", "p": 20630, "h": "${new Date().toISOString()}", "t": "960518915"}`;
		// 	sendMsjSocketWsp(_sendServerMsj);
		// 	// io.to('SERVERMSJ').emit('enviado-send-msj', _sendServerMsj);
		// }, 3000);
		
	}


	// evniar mensajes al whatsapp 130621
	function sendMsjSocketWsp(dataMsj) {
		// 0: nuevo pedido notifica comercio
		// 1: verificar telefono
		// 2: notifica al cliente el repartidor que acepto pedido
		console.log('dataMsj ===========> ', dataMsj);
		dataMsj = typeof dataMsj !== 'object' ? JSON.parse(dataMsj) : dataMsj;
		const tipo = dataMsj.tipo;

		var _sendServerMsj = {telefono: 0, msj: '', tipo: 0};
		var msj;
		var url = '';
		var _dataUrl = '';

		if ( tipo === 0 ) {
			_dataUrl = `{"s": "${dataMsj.s}", "p": ${dataMsj.p}, "h": "${dataMsj.h}"}`;
			// url = `https://comercio.papaya.com.pe/#/order-last?p=${btoa(_dataUrl)}`; // 2322 quitamos el hashtag #
			url = `https://comercio.papaya.com.pe/order-last?p=${btoa(_dataUrl)}`;
			msj = `🤖 🎉 🎉 Tienes un nuevo pedido por Papaya Express, chequealo aqui: ${url}`;
			_sendServerMsj.tipo = 0;
			_sendServerMsj.telefono = dataMsj.t;
			_sendServerMsj.msj = msj;
		}

		// verificar telefono
		if ( tipo === 1 ) {			
			_sendServerMsj.tipo = 1;
			_sendServerMsj.telefono = dataMsj.t;
			_sendServerMsj.msj = '📞🔐 Papaya Express, su código de verificación es: ' + dataMsj.cod;
			_sendServerMsj.idcliente = dataMsj.idcliente;
			_sendServerMsj.idsocket = dataMsj.idsocket;
		}


		// notifica al cliente el repartidor que acepto pedido
		if ( tipo === 2 ) {			
			_sendServerMsj.tipo = 2;
			_sendServerMsj.telefono = dataMsj.telefono;
			_sendServerMsj.msj = `🤖 Hola ${dataMsj.nombre}, el repartidor que está a cargo de su pedido de ${dataMsj.establecimiento} es: ${dataMsj.repartidor_nom} 📞 ${dataMsj.repartidor_telefono} 🙋‍♂️\n\nLe llamará cuando este cerca ó para informarle de su pedido.`			
		}

		// notifica url descarga pdf comprobante
		if ( tipo === 3 ) {
			const _ulrComprobante = `https://apifac.papaya.com.pe/downloads/document/pdf/${dataMsj.external_id}`;
			_sendServerMsj.tipo = 3;
			_sendServerMsj.telefono = dataMsj.telefono;
			// _sendServerMsj.msj = `🤖 Hola, adjuntamos el link de descarga de su comprobante electrónico de ${dataMsj.comercio} número ${dataMsj.numero_comprobante}. \n\n 📄👆 ${_ulrComprobante} \n\nTambién lo puede consultar en: papaya.com.pe`;			
			_sendServerMsj.msj = `🤖 Hola, adjuntamos su comprobante electrónico de ${dataMsj.comercio} número ${dataMsj.numero_comprobante}. También lo puede consultar en: papaya.com.pe`;			
			
			_sendServerMsj.url_comprobante = _ulrComprobante;
			_sendServerMsj.url_comprobante_xml = _ulrComprobante.replace('/pdf/','/xml/');
			_sendServerMsj.nombre_file = dataMsj.numero_comprobante;
		}

		// notifica al cliente que pase a recoger el pedido
		if ( tipo === 4 ) {
			_sendServerMsj.tipo = 4;
			_sendServerMsj.telefono = dataMsj.telefono;
			_sendServerMsj.msj = `🤖 Hola ${dataMsj.nombre} su pedido de ${dataMsj.establecimiento} puede pasar a recogerlo en ${dataMsj.tiempo_entrega} aproximadamente.`;
		}


		io.to('SERVERMSJ').emit('enviado-send-msj', _sendServerMsj);
	}
}
