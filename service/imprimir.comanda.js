// Envia las comandas al print server de la sede (evento 'printerComanda').
// Version reutilizable con io (sin socket del emisor) de xMandarImprimirComanda de controllers/sockets.js:1363
// y service/holding.sevice.js:349. Usar esta en codigo nuevo.
const logger = require('../utilitarios/logger');

// dataPrint: rpt[0].data que devuelve procedure_pwa_pedido_guardar; room: `room${idorg}${idsede}`
function xMandarImprimirComanda(dataPrint, io, room) {
	if (!Array.isArray(dataPrint) || !io) { return; }
	dataPrint.forEach(x => {
		if (!x || !x.print) { return; }
		const dataPrintSend = {
			detalle_json: JSON.stringify(x.print.detalle_json),
			idprint_server_estructura: 1,
			tipo: 'comanda',
			descripcion_doc: 'comanda',
			nom_documento: 'comanda',
			idprint_server_detalle: x.print.idprint_server_detalle
		};
		logger.debug({ room, idprint_server_detalle: dataPrintSend.idprint_server_detalle }, 'printerComanda');
		io.to(room).emit('printerComanda', dataPrintSend);
	});
}

module.exports = { xMandarImprimirComanda };
