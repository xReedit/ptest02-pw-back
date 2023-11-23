const { to, ReE, ReS }  = require('../service/uitl.service');
// let config = require('../config');
let config = require('../_config');
let managerFilter = require('../utilitarios/filters');
// import io from 'socket.io-client';

const io = require("socket.io-client");

const setPedidoBot = function (req, res) {  
	const payload = req.body	
	const infoUser = payload.query
	const pedido = payload.dataSend
	
	// const urlSocket = `http://127.0.0.1:${config.portSocket}`  
	
	// console.log('conectando === ', urlSocket)
	// const socket = io(urlSocket,{
	// 	query: infoUser
	// });

	const socket = connectBotSocket(infoUser);




	socket.emit('nuevoPedido', pedido)

}

module.exports.setPedidoBot = setPedidoBot;


// acepta solicitud de permiso remoto desde chatbot key = link
const setAceptaSolicitudRemotoBot = function(req, res) {	
	const payload = req.body	
	const infoUser = payload.query	
	const data = payload.dataSend
	console.log('======= setAceptaSolicitudRemotoBot', infoUser)	

	const socket = connectBotSocket(infoUser);



	// borrar un producto
	if ( data.tipo_permiso == 1 ) {
		console.log('restobar-permiso-remove-producto-mesa', data)
		socket.emit('restobar-permiso-remove-producto-mesa', data)
	}

	// borrar pedidos completos
	if ( data.tipo_permiso == 2 ) {
		console.log('restobar-permiso-remove-pedido-mesa', data)
		socket.emit('restobar-permiso-remove-pedido-mesa', data)
	}	

}
module.exports.setAceptaSolicitudRemotoBot = setAceptaSolicitudRemotoBot;


function connectBotSocket(infoUser) {
	const urlSocket = `http://127.0.0.1:${config.portSocket}`
	console.log('conectando === ', urlSocket)
	const socket = io(urlSocket,{
		query: infoUser
	});

	return socket;
}

