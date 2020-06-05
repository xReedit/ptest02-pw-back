const apiPwa = require('./apiPwa_v1.js');
const apiPwaRepartidor = require('./apiRepartidor.js');
const apiPwaComercio = require('./apiComercio.js');
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

		/// repartidor
		if (dataCliente.isRepartidor) {
			// socketMaster = socket; 
			socketRepartidor(dataCliente,socket);
			return;
		}

		if (dataCliente.isOutCarta === 'true') {
			// socketMaster = socket; 
			socketClienteDeliveryEstablecimientos(dataCliente,socket);
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

			// obtener tipos de consumo
			const objTipoConsumo = await apiPwa.getTipoConsumo(dataCliente);

			// obtener reglas de la carta y subtotales
			const objReglasCarta = await apiPwa.getReglasCarta(dataCliente);

			// data del la sede
			const objDataSede = await apiPwa.getDataSede(dataCliente);

			// console.log('tipo consumo', objTipoConsumo);
			// console.log('reglas carta y subtotales', objReglasCarta);
			// console.log('a user connected sokecontroller - servimos la carta', objCarta );		
			// console.log('a user connected sokecontroller - servimos datos de la sede', objDataSede );

			console.log('emitido a ', chanelConect);
			socket.emit('getLaCarta', objCarta);
			socket.emit('getTipoConsumo', objTipoConsumo);
			socket.emit('getReglasCarta', objReglasCarta);
			socket.emit('getDataSede', objDataSede);

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
							item.subitems.map(s => {							
								let itemFind = s.opciones.filter(_subItem => parseInt(_subItem.iditem_subitem) === parseInt(subitem.iditem_subitem))[0];

								if ( itemFind ) {
									itemFind.cantidad = subitem.cantidad;
								}
							});
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

		// hay un nuevo pedido - guardar
		socket.on('nuevoPedido', async (dataSend) => {
			console.log('nuevoPedido ', dataSend);			
			const rpt = await apiPwa.setNuevoPedido(dataCliente, dataSend);

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


				// notificamos push al comercio
				const socketIdComercio = await apiPwaComercio.getSocketIdComercio(dataCliente.idsede);
				// notifica mensaje texto si tiene teleono
				if ( socketIdComercio[0].telefono_notifica !== undefined ) {
					if ( socketIdComercio[0].telefono_notifica !== '' ) {
						apiPwaComercio.sendNotificacionNewPedidoSMS(socketIdComercio[0].telefono_notifica);
					}
					// console.log(' ==== notifica sms comercio =====', socketIdComercio[0].telefono_notifica);					
				} 

				// notificacion push
				apiPwaComercio.sendOnlyNotificaPush(socketIdComercio[0].key_suscripcion_push, 0);				

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


			// registrar comanda en print_server_detalle
			// console.log('printerComanda', rpt);
			//apiPwa.setPrintComanda(dataCliente, dataSend.dataPrint);
			// emitimos para print server
			socket.broadcast.to(chanelConect).emit('printerComanda', rpt);
		});

		// no guarda lo que envia el cliente solo notifica que hay un nuevo pedido, para imprimir en patalla o ticketera
		// para imprmir solo la comanda desde control pedidos, venta rapida, zona despacho
		socket.on('printerOnly', (dataSend) => {			
			dataSend.hora = n;
			console.log('printerOnly', dataSend);
			socket.broadcast.to(chanelConect).emit('printerOnly', dataSend);
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
			socket.broadcast.to(chanelConect).emit('notificar-cliente-llamado', numMesa);
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


	});


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
		

		// registrar como conectado en cliente_socketid
		apiPwaRepartidor.setRepartidorConectado(dataCliente);		

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
				console.log('repartidor-notifica-ubicacion ==> al cliente', socketIdCliente[0].socketid + '  -> '+ JSON.stringify(datosUbicacion));
				io.to(socketIdCliente[0].socketid).emit('repartidor-notifica-ubicacion', datosUbicacion.coordenadas);					
			}			

			// notifica a comercio
			if ( datosUbicacion.idsede ) {
				const socketIdComercio = await apiPwaComercio.getSocketIdComercio(datosUbicacion.idsede);
				console.log('repartidor-notifica-ubicacion ==> al comercio', socketIdComercio[0].socketid + '  -> '+ JSON.stringify(datosUbicacion));
				io.to(socketIdComercio[0].socketid).emit('repartidor-notifica-ubicacion', datosUbicacion);	
			}			

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
		});



		// notifica el fin de todo el grupo de pedidos
		socket.on('repartidor-grupo-pedido-finalizado', (idrepartidor) => {
			console.log('repartidor-grupo-pedido-finalizado', idrepartidor);			
			apiPwaRepartidor.setUpdateRepartidorOcupado(idrepartidor, 0);
		});


	}

	function socketClienteDeliveryEstablecimientos(dataCliente, socket) {
		console.log('desde func socketClienteDeliveryEstablecimientos', dataCliente);

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
}
