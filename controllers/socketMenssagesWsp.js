
// evniar mensajes al whatsapp 112023

let config = require('../_config');

// --- Arrays de saludos y frases cordiales ---



const saludos = [
	"¡Hola! 👋",
	"¡Saludos! 😊",
	"¡Buen día! ☀️",
	"¡Un gusto saludarte! 🙌",
	"¡Esperamos que estés bien! 🍀",
	"¡Gracias por preferirnos! 🧡",
	"¡Hola estimado cliente! 🤗",
	"¡Te damos la bienvenida! 🎉",
	"¡Un placer atenderte! 🤝",
	"¡Qué tal! 👋",
	"¿Cómo le va? Esperamos muy bien 🌟",
	"¡Encantados de saludarte! 💫",
	"¡Qué gusto contactarte! 📱",
	"¡Feliz de tenerte como cliente! 🎊",
	"¡Hola! ¿Cómo estás hoy? 🌞",
	"¡Saludos cordiales! 🌹",
	"¡Nos alegra atenderte! 😃",
	"¡Bienvenido nuevamente! 🔄",
	"¡Un cordial saludo! 📬"	
];

const frasesNuevoPedido = [
	"Tienes un nuevo pedido disponible 📦",
	"Acabas de recibir un pedido nuevo 🚀",
	"¡Hay un nuevo pedido esperándote! 🛒",
	"Un cliente ha realizado un pedido 📝",
	"¡Se ha generado un nuevo pedido para ti! 🎊",
	"¡Un pedido más para tu negocio! 🥳",
	"¡Felicidades, tienes una venta nueva! 💰",
	"¡Atención! Pedido listo para procesar 🔔",
	"¡Sigue creciendo tu negocio con este pedido! 📈",
	"¡Otro cliente confió en ti! 🙏",
	"¡Nueva orden recibida con éxito! ✅",
	"¡Llegó un pedido a tu tienda! 🏪",
	"¡Buenas noticias! Tienes un pedido nuevo 🎯",
	"Un cliente está esperando tu servicio 🤝",
	"¡Alerta de nuevo pedido en tu sistema! 🔔",
	"¡Acaba de entrar un pedido fresco! 🆕",
	"¡Tu negocio sigue creciendo! Nuevo pedido 📊",
	"¡Tienes trabajo! Llegó un nuevo pedido 💼",
	"¡Genial! Alguien más eligió tu negocio 🌟",
	"¡Prepárate! Hay un pedido esperando ser procesado ⏱️"
];

const frasesRepartidor = [
	"El repartidor asignado a tu pedido es 🚴‍♂️",
	"Tu pedido será entregado por nuestro repartidor 🚚",
	"Te atenderá nuestro repartidor 👨‍💼",
	"El encargado de tu entrega es 👤",
	"¡Ya tenemos repartidor para tu pedido! 🛵",
	"Tu pedido está en buenas manos 🤲",
	"Nuestro equipo se encarga de tu entrega 💪",
	"Pronto recibirás tu pedido de manos de nuestro repartidor 😊",
	"Tu repartidor está en camino 🗺️",
	"¡Listos para entregar tu pedido! 📦",
	"Hemos asignado a un profesional para tu entrega 🏆",
	"Un experto en entregas llevará tu pedido 📬",
	"Tu repartidor ha sido notificado y está preparándose 🔄",
	"Un miembro de nuestro equipo de reparto te atenderá 👥",
	"Tu pedido ya tiene quien lo lleve hasta ti 🚶‍♂️",
	"Hemos seleccionado al mejor repartidor para ti 🌟",
	"Tu entrega está siendo coordinada por nuestro repartidor 📋",
	"Un especialista en entregas se dirige hacia ti 🧭",
	"Contamos con un excelente repartidor para tu pedido 🥇"
];

const frasesComprobante = [
	"Adjuntamos el comprobante electrónico solicitado 📄",
	"Aquí tienes el comprobante de tu compra 🧾",
	"Te enviamos el comprobante electrónico de tu pedido ✉️",
	"Puedes consultar tu comprobante en el siguiente enlace 🔗",
	"¡Tu comprobante está listo para descargar! 📥",
	"Accede a tu comprobante de manera fácil y rápida 💡",
	"Gracias por tu compra, aquí tienes tu comprobante 🙏",
	"Comprobante disponible para ti 👇",
	"Aquí está tu comprobante digital 📲",
	"¡Listo! Tu comprobante fue generado correctamente ✅"
];

const advertenciasComercio = [
	"*¡ATENCIÓN!* Este mensaje es automático. No realices pagos ni respondas aquí. Para consultas, contacta directamente al comercio: {comercio} 📞 {comercio_telefono} ⚠️",
	"*Importante*: No transfieras dinero ni respondas a este número. Si tienes dudas, comunícate con {comercio} al 📞 {comercio_telefono} ❗",
	"*Aviso*: Este número solo envía mensajes automáticos. Cualquier consulta, hazla directamente con {comercio} al teléfono 📞 {comercio_telefono} 🤖",
	"*Recuerda*: No respondas ni realices pagos a este número. Contacta a {comercio} para atención personalizada: 📞 {comercio_telefono} 🙏",
	"*Lea atentamente*: Comunícate solo con {comercio} al 📞 {comercio_telefono} para cualquier duda. No respondas a este mensaje. 🔒",
	"*Mensaje automático*: No realices transferencias ni respondas aquí. {comercio} te atenderá en el 📞 {comercio_telefono} 🛡️",
	"*Cuidado*: Este canal no recibe respuestas. Contacta a {comercio} directamente: 📞 {comercio_telefono} 💬",
	"*Nota*: Si necesitas ayuda, llama a {comercio} al 📞 {comercio_telefono}. No respondas a este mensaje. ☎️",
	"*Advertencia de seguridad*: Este es un canal automatizado. Para atención personalizada, contacta a {comercio}: 📞 {comercio_telefono} 🚨",
	"*Precaución*: No compartas datos personales ni bancarios por este medio. Contacta directamente a {comercio}: 📞 {comercio_telefono} 🔐",
	"*Información importante*: Este número es solo para envío de notificaciones. Para consultas: {comercio} 📞 {comercio_telefono} ℹ️",
	"*Ten en cuenta*: Este es un servicio de mensajería automática. Contacta a {comercio} al 📞 {comercio_telefono} para asistencia 📌",
	"*Aviso de seguridad*: No realices ninguna acción por este medio. Contacta a {comercio} al 📞 {comercio_telefono} 🛑",	
	"*Recuerda siempre*: No envíes información sensible por este medio. Contacta a {comercio}: 📞 {comercio_telefono} 🚫"
];

const frasesRecoger = [
	"Tu pedido está listo para ser recogido 🏪",
	"Puedes acercarte a recoger tu pedido cuando gustes 🕒",
	"¡Ya puedes pasar a recoger tu pedido! 🙌",
	"Tu pedido te espera en el establecimiento 📍",
	"¡Gracias por tu preferencia! Tu pedido está listo 🎁",
	"Recoge tu pedido y disfruta tu compra 😋",
	"¡Tu pedido está preparado y esperando por ti! 🍽️",
	"Ven por tu pedido, te esperamos con gusto 🤗",
	"Puedes pasar a la tienda para recoger tu pedido 🛍️",
	"¡No olvides tu pedido, ya está listo! 📦",
	"Tu orden está lista y esperando por ti 🎯",
	"Hemos terminado de preparar tu pedido, ¡ven a buscarlo! 🏁",
	"Todo listo para que recojas tu pedido 👌",
	"Tu compra está preparada para ser recogida 📩",
	"¡Misión cumplida! Tu pedido está listo para recoger 🚩",
	"Pedido completado y listo para entrega en tienda 🏬",
	"¡Buenas noticias! Tu pedido ya se puede recoger 🎊",
	"Hemos terminado tu pedido, pasa cuando quieras 🚶‍♀️",
	"Tu pedido ha sido empacado y está listo para ti 📦"	
];

// --- Funciones utilitarias ---
function elegirAleatorio(arr) {
	return arr[Math.floor(Math.random() * arr.length)];
}

function obtenerFechaHora() {
	const ahora = new Date();
	const dia = String(ahora.getDate()).padStart(2, '0');
	const mes = String(ahora.getMonth() + 1).padStart(2, '0');
	const anio = ahora.getFullYear();
	const hora = String(ahora.getHours()).padStart(2, '0');
	const minuto = String(ahora.getMinutes()).padStart(2, '0');
	return `${dia}/${mes}/${anio} ${hora}:${minuto}`;
}


const sendMsjSocketWsp = function (dataMsj, io) {
	// 0: nuevo pedido notifica comercio
		// 1: verificar telefono
		// 2: notifica al cliente el repartidor que acepto pedido
		console.log('dataMsj ===========> aa ==', dataMsj);
		dataMsj = typeof dataMsj !== 'object' ? JSON.parse(dataMsj) : dataMsj;
		const tipo = dataMsj.tipo;

		console.log("tipo === ", tipo)

		var _sendServerMsj = {telefono: 0, msj: '', tipo: 0};
		var msj;
		var url = '';
		var _dataUrl = '';

		if ( tipo === 0 ) {
			// Notifica nuevo pedido al comercio con cordialidad y variación
			const saludo = elegirAleatorio(saludos);
			const cuerpo = elegirAleatorio(frasesNuevoPedido);
			_dataUrl = `{"s": "${dataMsj.s}", "p": ${dataMsj.p}, "h": "${dataMsj.h}"}`;
			const dataUrl = btoa(_dataUrl);
			url = `https://comercio.papaya.com.pe/order-last?p=${dataUrl}`;
			msj = `${saludo} ${cuerpo} por Papaya Express. Puedes revisarlo aquí: ${url}\n\nEnviado el: ${obtenerFechaHora()}`;
			_sendServerMsj.tipo = 0;
			_sendServerMsj.telefono = dataMsj.t;
			_sendServerMsj.msj = msj;
			_sendServerMsj.nombre_plantilla = 'nuevo_pedido_papaya_express';
			_sendServerMsj.components = [
				{
					"type": "button",
					"sub_type": "url",
					"index": "0",  // primer botón
					"parameters": [
						{
							"type": "text",
							"text": dataUrl   // Este será el {{1}} del botón (el valor de ?key=...)
						}
					]
				}
			];
			_sendServerMsj.bodyParameters = [];
		}
		// 	_dataUrl = `{"s": "${dataMsj.s}", "p": ${dataMsj.p}, "h": "${dataMsj.h}"}`;
		// 	// url = `https://comercio.papaya.com.pe/#/order-last?p=${btoa(_dataUrl)}`; // 2322 quitamos el hashtag #
		// 	url = `https://comercio.papaya.com.pe/order-last?p=${btoa(_dataUrl)}`;
		// 	msj = `🤖 🎉 🎉 Tienes un nuevo pedido por Papaya Express, chequealo aqui: ${url}`;
		// 	_sendServerMsj.tipo = 0;
		// 	_sendServerMsj.telefono = dataMsj.t;
		// 	_sendServerMsj.msj = msj;
		// }

		// verificar telefono
		if ( tipo === 1 ) {			
			_sendServerMsj.tipo = 1;
			_sendServerMsj.telefono = dataMsj.t;
			_sendServerMsj.msj = '📞🔐 Papaya Express, su código de verificación es: ' + dataMsj.cod;
			_sendServerMsj.idcliente = dataMsj.idcliente;
			_sendServerMsj.idsocket = dataMsj.idsocket;
			_sendServerMsj.nombre_plantilla = 'verificar_telefono';
			_sendServerMsj.components = [
				{
					"type": "body",
					"parameters": [
						{
							"type": "text",
							"text": dataMsj.cod  // el código de verificación real
						}
					]
				}
			];
			_sendServerMsj.bodyParameters = [];
		}


		// notifica al cliente el repartidor que acepto pedido
		if ( tipo === 2 ) {
			// Notifica al cliente el repartidor que aceptó el pedido, cordial y variado
			const saludo = elegirAleatorio(saludos);
			const cuerpo = elegirAleatorio(frasesRepartidor);
			msj = `${saludo} ${dataMsj.nombre}, ${cuerpo}: ${dataMsj.repartidor_nom} 📞 ${dataMsj.repartidor_telefono} 🙋\n\nTe llamará cuando esté cerca o para informarte sobre tu pedido.\n\nEnviado el: ${obtenerFechaHora()}`;
			_sendServerMsj.tipo = 2;
			_sendServerMsj.telefono = dataMsj.telefono;
			_sendServerMsj.msj = msj;
			_sendServerMsj.nombre_plantilla = 'repartidor_asignado';
			_sendServerMsj.components = [
				{
					"type": "body",
					"parameters": [
						{ "type": "text", "text": dataMsj.nombre },     // {{1}} nombre del cliente
						{ "type": "text", "text": dataMsj.repartidor_nom },      // {{2}} nombre del repartidor
						{ "type": "text", "text": dataMsj.repartidor_telefono }   // {{3}} teléfono del repartidor
					]
				}
			];
			_sendServerMsj.bodyParameters = [];
		}

		// notifica url descarga pdf comprobante
		if ( tipo === 3 ) {
			// Notifica url descarga pdf comprobante, cordial y variado
			const saludo = elegirAleatorio(saludos);
			const cuerpo = elegirAleatorio(frasesComprobante);
			const _user_id = dataMsj.user_id ? `/${dataMsj.user_id}` : '';
			const _concat_external_id = dataMsj.external_id + _user_id;
			const _ulrComprobante = `https://apifac.papaya.com.pe/downloads/document/pdf/${_concat_external_id}`;
			const _adjuntaTelefonoComercio = dataMsj.comercio_telefono ? `\n\n${elegirAleatorio(advertenciasComercio).replace('{comercio}', dataMsj.comercio).replace('{comercio_telefono}', dataMsj.comercio_telefono)}` : '';
			msj = `${saludo} por encargo de ${dataMsj.comercio}, ${cuerpo} número ${dataMsj.numero_comprobante}. También puedes consultarlo en: papaya.com.pe ${_adjuntaTelefonoComercio}\n\nEnviado el: ${obtenerFechaHora()}`;
			_sendServerMsj.tipo = 3;
			_sendServerMsj.telefono = dataMsj.telefono;
			_sendServerMsj.msj = msj;
			_sendServerMsj.url_comprobante = _ulrComprobante;
			_sendServerMsj.url_comprobante_xml = _ulrComprobante.replace('/pdf/','/xml/');
			_sendServerMsj.nombre_file = dataMsj.numero_comprobante;
			_sendServerMsj.nombre_plantilla = 'envio_comprobante';
			_sendServerMsj.components = [
				{
					"type": "header",
					"parameters": [
						{
							"type": "document",
							"document": {
								"link": _ulrComprobante,
								"filename": dataMsj.numero_comprobante
							}
						}
					]
				},
				{
					"type": "body",
					"parameters": [
						{ "type": "text", "text": dataMsj.comercio },       // {{1}} nombre del comercio
						{ "type": "text", "text": dataMsj.numero_comprobante },   // {{2}} número del comprobante
						{ "type": "text", "text": dataMsj.comercio },   // {{3}} nombre del comercio
						{ "type": "text", "text": dataMsj.comercio_telefono } // {{4}} telefono del comercio
					]
				}
			];
			_sendServerMsj.bodyParameters = [];
		}

		// 	const _user_id = dataMsj.user_id ? `/${dataMsj.user_id}` : '';
		// 	const _concat_external_id = dataMsj.external_id + _user_id;
		// 	const _ulrComprobante = `https://apifac.papaya.com.pe/downloads/document/pdf/${_concat_external_id}`;
		// 	_sendServerMsj.tipo = 3;
		// 	_sendServerMsj.telefono = dataMsj.telefono;
		// 	// _sendServerMsj.msj = `🤖 Hola, adjuntamos el link de descarga de su comprobante electrónico de ${dataMsj.comercio} número ${dataMsj.numero_comprobante}. \n\n 📄👆 ${_ulrComprobante} \n\nTambién lo puede consultar en: papaya.com.pe`;			

		// 	const _adjuntaTelefonoComercio = dataMsj.comercio_telefono ? `\n\n*¡ATENCION!*, este es un mensaje automático enviado a través de nuestro servicio de bot 🤖. Por favor, NO REALIZE NINGUNA TRANSACCION a este número y tampoco responda a este mensaje ya que no llegará a un representante de servicio al cliente. *Si tiene alguna consulta comuniquese directamente con el comercio: ${dataMsj.comercio} al telefono 📞: ${dataMsj.comercio_telefono} .*` : '';
		// 	_sendServerMsj.msj = `🤖 Hola, por encargo de ${dataMsj.comercio} adjuntamos su comprobante electrónico número ${dataMsj.numero_comprobante}. También lo puede consultar en: papaya.com.pe ${_adjuntaTelefonoComercio}`;			
			
		// 	_sendServerMsj.url_comprobante = _ulrComprobante;
		// 	_sendServerMsj.url_comprobante_xml = _ulrComprobante.replace('/pdf/','/xml/');
		// 	_sendServerMsj.nombre_file = dataMsj.numero_comprobante;
		// }

		// notifica al cliente que pase a recoger el pedido
		if ( tipo === 4 ) {
			// Notifica al cliente que pase a recoger el pedido
			const saludo = elegirAleatorio(saludos);
			const cuerpo = elegirAleatorio(frasesRecoger);
			msj = `${saludo} ${dataMsj.nombre}, ${cuerpo} de ${dataMsj.establecimiento}. Puedes pasar a recogerlo en ${dataMsj.tiempo_entrega} aproximadamente.\n\nEnviado el: ${obtenerFechaHora()}`;
			_sendServerMsj.tipo = 4;
			_sendServerMsj.telefono = dataMsj.telefono;
			_sendServerMsj.msj = msj;
			_sendServerMsj.nombre_plantilla = 'pedido_listo_recojo_1';
			_sendServerMsj.components = [
				{
					"type": "body",
					"parameters": [
						{ "type": "text", "text": dataMsj.nombre },       // {{1}} nombre del repartidor
						{ "type": "text", "text": dataMsj.establecimiento },   // {{2}} nombre del local
						{ "type": "text", "text": dataMsj.comercio_telefono }   // {{3}} telefono del comercio
					]
				}
			];
		}

		// notifica al cliente el repartidor time line del pedido
		if ( tipo === 5 ) {			
			_sendServerMsj.tipo = 5;
			_sendServerMsj.telefono = dataMsj.telefono;
			// _sendServerMsj.msj = `🤖 Hola ${dataMsj.nombre}, el repartidor que está a cargo de su pedido de ${dataMsj.establecimiento} es: ${dataMsj.repartidor_nom} 📞 ${dataMsj.repartidor_telefono} 🙋‍♂️\n\nLe llamará cuando este cerca ó para informarle de su pedido.`			
			_sendServerMsj.msj = dataMsj.msj

			if (_sendServerMsj.msj.includes('llego')) {
				_sendServerMsj.nombre_plantilla = 'repartidor_llego_local';			
			} else {
				_sendServerMsj.nombre_plantilla = 'repartidor_en_camino';
			}
			_sendServerMsj.components = [
				{
					"type": "body",
					"parameters": [
						{ "type": "text", "text": dataMsj.nombre },       // {{1}} nombre del repartidor
						{ "type": "text", "text": dataMsj.establecimiento }   // {{2}} nombre del local
					]
				}
			];
			_sendServerMsj.bodyParameters = [];
		}

		// notifica solicitud de permiso al administrador para borrar productos, eliminar cuentas, o cierre de caja
		// viene de restobar
		if ( tipo === 6 ) {
			let mjsPermiso = '';
			dataMsj.link = `https://chatbot.papaya.com.pe/solicitud-remoto?key=${dataMsj.link}`;
			// borrar producto de cuenta
			mjsPermiso = `🔐 *[Solicitud de Permiso]*\nEl usuario: ${dataMsj.nomusuario_solicita} de ${dataMsj.nomsede} solicita permiso.\n\nHola ${dataMsj.nomusuario_admin}\n*Solicitud:* ${dataMsj.solicitud}\n*Motivo*: ${dataMsj.motivo}\n\nAutorizalo en este link: ${dataMsj.link}`;
			
			// if ( dataMsj.tipo_permiso === 1 ) {
			// }

			_sendServerMsj.tipo = 6;
			_sendServerMsj.telefono = dataMsj.telefono_admin;			
			_sendServerMsj.msj = mjsPermiso
			_sendServerMsj.nombre_plantilla = 'solicitud_autorizacion_remota';
			_sendServerMsj.components = [
				{
					"type": "body",
					"parameters": [
						{ "type": "text", "text": dataMsj.nomusuario_admin },      // {{1}}
						{ "type": "text", "text": dataMsj.nomusuario_solicita },               // {{2}}
						{ "type": "text", "text": dataMsj.nomsede },    // {{3}}
						{ "type": "text", "text": dataMsj.solicitud },     // {{4}}
						{ "type": "text", "text": dataMsj.motivo }     // {{5}}
					]
				},
				{
					"type": "button",
					"sub_type": "url",
					"index": "0",
					"parameters": [
						{
							"type": "text",
							"text": dataMsj.link  // valor que reemplaza {{6}} en el botón (por ejemplo el ID de la solicitud)
						}
					]
				}
			];
		}

		// cupones de descuento
		if ( tipo === 7 ) {
			_sendServerMsj.tipo = 7;
			_sendServerMsj.telefono = dataMsj.telefono;
			_sendServerMsj.msj = dataMsj.msj
		}

		console.log('_sendServerMsj === ', _sendServerMsj);


		io.to('SERVERMSJ').emit('enviado-send-msj', _sendServerMsj);
}

module.exports.sendMsjSocketWsp = sendMsjSocketWsp;