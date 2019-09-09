const apiPwa = require('./apiPwa_v1.js');
//const auth = require('../middleware/autentificacion');

var onlineUsers = {};
var onlineCount = 0;
var dataCliente = {
	idorg: 1,
	idsede: 1,
	idusuario: 1
}

var objCarta = {}; 

module.exports.socketsOn = function(io){ // Success Web Response
	io.on('connection', async function(socket){

		// ni bien el cliente se conecta sirve la carta
		objCarta = await apiPwa.getObjCarta(dataCliente);

		// obtener tipos de consumo
		objTipoConsumo = await apiPwa.getTipoConsumo(dataCliente);

		// obtener reglas de la carta y subtotales
		objReglasCarta = await apiPwa.getReglasCarta(dataCliente);

		// data del la sede
		objDataSede = await apiPwa.getDataSede(dataCliente);

		console.log('tipo consumo', objTipoConsumo)
		console.log('reglas carta y subtotales', objReglasCarta)
		console.log('a user connected sokecontroller - servimos la carta', objCarta );		
		console.log('a user connected sokecontroller - servimos datos de la sede', objDataSede );

		socket.emit('getLaCarta', objCarta);
		socket.emit('getTipoConsumo', objTipoConsumo);
		socket.emit('getReglasCarta', objReglasCarta);
		socket.emit('getDataSede', objDataSede);

		// item modificado
		socket.on('itemModificado', (item) => {
			console.log('itemModificado', item);

			// actualizamos en bd - si un cliente nuevo solicita la carta tendra actualizado
			if (item.cantidad != 'ND') {
				apiPwa.setItemCarta(0, item);
			}
			
			socket.broadcast.emit('itemModificado', item);
		});

		// restablecer pedido despues de que se termino el tiempo de espera
		socket.on('resetPedido', (listPedido) => {
			console.log('resetPedido ', listPedido);
			// recibe items
			listPedido.map(item => {				
				if (item.cantidad != 'ND') {
					item.cantidad_reset = item.cantidad_seleccionada;					
					item.cantidad_seleccionada = 0;
					console.log('items recuperar ', item);
					
					apiPwa.setItemCarta(1, item);
					socket.broadcast.emit('itemResetCant', item);
				}				
			});
		});

		// hay un nuevo pedido - guardar
		socket.on('nuevoPedido', (dataSend) => {
			console.log('nuevoPedido ', dataSend.dataPedido);
			apiPwa.setNuevoPedido(dataCliente, dataSend);

			// para actaluzar vista de caja // control de pedidos
			socket.broadcast.emit('nuevoPedido', dataSend.dataPedido);


			// registrar comanda en print_server_detalle
			console.log('printerComanda', dataSend.dataPrint);
			//apiPwa.setPrintComanda(dataCliente, dataSend.dataPrint);
			// emitimos para print server
			socket.broadcast.emit('printerComanda', dataSend.dataPrint);
		});
		
	});
}


function getObjCarta () {
	
}