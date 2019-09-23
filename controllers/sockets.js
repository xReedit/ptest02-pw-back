const apiPwa = require('./apiPwa_v1.js');
//const auth = require('../middleware/autentificacion');

var onlineUsers = {};
var onlineCount = 0;
var dataCliente = {
	idorg: 1,
	idsede: 1,
	idusuario: 1
}

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


	io.on('connection', async function(socket){
		console.log('datos socket', socket.id);
		let dataSocket = socket.handshake.query;
		console.log('datos socket', socket.handshake.query);
		console.log('datos socket JSON', dataSocket);
		
		// si viene desde app pedidos
		// 1 is from pwa 0 is web
		const isFromPwa = dataSocket.isFromApp ? dataSocket.isFromApp : 1;
		console.log('isFromPwa', isFromPwa);
		if ( dataSocket.isFromApp = 1 ) {

			// ni bien el cliente se conecta sirve la carta
			objCarta = await apiPwa.getObjCarta(dataCliente);

			// obtener tipos de consumo
			objTipoConsumo = await apiPwa.getTipoConsumo(dataCliente);

			// obtener reglas de la carta y subtotales
			objReglasCarta = await apiPwa.getReglasCarta(dataCliente);

			// data del la sede
			objDataSede = await apiPwa.getDataSede(dataCliente);

			console.log('tipo consumo', objTipoConsumo);
			console.log('reglas carta y subtotales', objReglasCarta);
			console.log('a user connected sokecontroller - servimos la carta', objCarta );		
			console.log('a user connected sokecontroller - servimos datos de la sede', objDataSede );

			socket.emit('getLaCarta', objCarta);
			socket.emit('getTipoConsumo', objTipoConsumo);
			socket.emit('getReglasCarta', objReglasCarta);
			socket.emit('getDataSede', objDataSede);

			socket.emit('finishLoadDataInitial');

		}		

		// item modificado
		socket.on('itemModificado', async function(item) {
			// console.log('itemModificado', item);

			// manejar cantidad/

			

			// actualizamos en bd - si un cliente nuevo solicita la carta tendra la carta actualizado
			if (item.cantidad != 'ND') {	
				console.log('item.sumar', item);	
				// var _cantItem = parseFloat(item.cantidad);
				var _cantSumar = item.sumar ? -1 : parseInt(item.sumar) === 0 ? 0 : 1;
				item.cantidadSumar = _cantSumar;
				console.log('item.cantidadSumar', item.cantidadSumar);
				// item.cantidad = _cantItem;		

				const rptCantidad = await apiPwa.setItemCarta(0, item);
				console.log('cantidad update mysql ', rptCantidad);
				item.cantidad = rptCantidad[0].cantidad;

				io.emit('itemModificado', item);
			}
			
			// envia la cantidad a todos incluyendo al emisor, para actualizar en objCarta
			// io.emit('itemModificado', item);
		});

		// nuevo item agregado a la carta - from monitoreo stock
		socket.on('nuevoItemAddInCarta', (item) => {
			console.log('nuevoItemAddInCarta', item);
			socket.broadcast.emit('nuevoItemAddInCarta', item);
		});

		// restablecer pedido despues de que se termino el tiempo de espera
		socket.on('resetPedido', (listPedido) => {
			console.log('resetPedido ', listPedido);
			// recibe items
			listPedido.map(async (item) => {				
				if (item.cantidad != 'ND') {
					item.cantidad_reset = item.cantidad_seleccionada;					
					item.cantidad_seleccionada = 0;
					// console.log('items recuperar ', item);
					
					const rptCantidad = await apiPwa.setItemCarta(1, item);
					item.cantidad = rptCantidad;

					socket.broadcast.emit('itemResetCant', item);
				}
			});
		});

		// hay un nuevo pedido - guardar
		socket.on('nuevoPedido', async (dataSend) => {
			// console.log('nuevoPedido ', dataSend.dataPedido);
			const rpt = await apiPwa.setNuevoPedido(dataCliente, dataSend);

			// para actaluzar vista de caja // control de pedidos
			socket.broadcast.emit('nuevoPedido', dataSend.dataPedido);


			// registrar comanda en print_server_detalle
			// console.log('printerComanda', rpt);
			//apiPwa.setPrintComanda(dataCliente, dataSend.dataPrint);
			// emitimos para print server
			socket.broadcast.emit('printerComanda', rpt);
		});

		// no guarda lo que envia el cliente solo notifica que hay un nuevo pedido, para imprimir en patalla o ticketera
		// para imprmir solo la comanda desde control pedidos, venta rapida, zona despacho
		socket.on('printerOnly', (dataSend) => {			
			dataSend.hora = n;
			console.log('printerOnly', dataSend);
			socket.broadcast.emit('printerOnly', dataSend);
		});
		

		socket.on('disconnect', (reason) => {
			console.log('disconnect');
			if (reason === 'io server disconnect') {
			  // the disconnection was initiated by the server, you need to reconnect manually
			  console.log('disconnect ok');
			  socket.connect();			  
			}
			  // else the socket will automatically try to reconnect
		});
	});
}
