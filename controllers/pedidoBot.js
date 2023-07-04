const { to, ReE, ReS }  = require('../service/uitl.service');
let config = require('../config');
let managerFilter = require('../utilitarios/filters');
// import io from 'socket.io-client';

const io = require("socket.io-client");

const setPedidoBot = function (req, res) {  
	const payload = req.body	
	const infoUser = payload.query
	const pedido = payload.dataSend
	const urlSocket = `http://127.0.0.1:${config.portSocket}`  
	
	console.log('conectando === ', urlSocket)
	const socket = io(urlSocket,{
		query: infoUser
	});


	socket.emit('nuevoPedido', pedido)

}

module.exports.setPedidoBot = setPedidoBot;