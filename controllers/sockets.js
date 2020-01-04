const apiPwa = require('./apiPwa_v1.js');
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

		console.log('datos socket JSON', dataSocket);

		const dataCliente = dataSocket;
		
		// si viene desde app pedidos
		// 1 is from pwa 0 is web // si es 0 web no da carta
		const isFromPwa = dataSocket.isFromApp ? parseInt(dataSocket.isFromApp) : 1;
		console.log('isFromPwa', isFromPwa);

		// nos conectamos al canal idorg+idsede
		const chanelConect = 'room'+dataSocket.idorg + dataSocket.idsede;
		console.log('conectado al room ', chanelConect);

		socket.join(chanelConect);

		// registrar como conectado en cliente_socketid
		apiPwa.setClienteConectado(dataCliente);


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
			item.cantidad = parseInt(item.cantidad) === 999 ? item.isporcion : item.cantidad; // la cantidad viene 999 cuando es nd y la porcion si viene nd
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
				item.cantidad = rptCantidad[0].cantidad;

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

				// console.log('itemModificado', item);

				io.to(chanelConect).emit('itemModificado', item);
			} else {
				io.to(chanelConect).emit('itemModificado', item);
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
				if (item.cantidad != 'ND') {
					item.cantidad_reset = item.cantidad_seleccionada;					
					item.cantidad_seleccionada = 0;
					// console.log('items recuperar ', item);
					
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

					// socket.broadcast.emit('itemResetCant', item);
					io.to(chanelConect).emit('itemResetCant', item);
				}
			});
		});

		// hay un nuevo pedido - guardar
		socket.on('nuevoPedido', async (dataSend) => {
			console.log('nuevoPedido ', dataSend);
			const rpt = await apiPwa.setNuevoPedido(dataCliente, dataSend);

			console.log('respuesta guardar pedido ', rpt);

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
		socket.on('pedido-pagado-cliente', async (idcliente) => {			
			console.log('pedido-pagado-cliente', idcliente);

			const socketIdCliente = await apiPwa.getSocketIdCliente(idcliente);
			// buscar socketid por idcliente	

			// emite evento al cliente especifico
			io.to(socketIdCliente).emit('pedido-pagado-cliente', idcliente);			
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
	});
}
