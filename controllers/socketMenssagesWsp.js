
// evniar mensajes al whatsapp 112023
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
			const _user_id = dataMsj.user_id ? `/${dataMsj.user_id}` : '';
			const _concat_external_id = dataMsj.external_id + _user_id;
			const _ulrComprobante = `https://apifac.papaya.com.pe/downloads/document/pdf/${_concat_external_id}`;
			_sendServerMsj.tipo = 3;
			_sendServerMsj.telefono = dataMsj.telefono;
			// _sendServerMsj.msj = `🤖 Hola, adjuntamos el link de descarga de su comprobante electrónico de ${dataMsj.comercio} número ${dataMsj.numero_comprobante}. \n\n 📄👆 ${_ulrComprobante} \n\nTambién lo puede consultar en: papaya.com.pe`;			

			const _adjuntaTelefonoComercio = dataMsj.comercio_telefono ? `\n\n*¡ATENCION!*, este es un mensaje automático enviado a través de nuestro servicio de bot 🤖. Por favor, NO REALIZE NINGUNA TRANSACCION a este número y tampoco responda a este mensaje ya que no llegará a un representante de servicio al cliente. Si tiene alguna duda comunicarse directamente con el comercio: ${dataMsj.comercio} Al telefono 📞: ${dataMsj.comercio_telefono} .` : '';
			_sendServerMsj.msj = `🤖 Hola, por encargo de ${dataMsj.comercio} adjuntamos su comprobante electrónico número ${dataMsj.numero_comprobante}. También lo puede consultar en: papaya.com.pe ${_adjuntaTelefonoComercio}`;			
			
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

		// notifica al cliente el repartidor time line del pedido
		if ( tipo === 5 ) {			
			_sendServerMsj.tipo = 5;
			_sendServerMsj.telefono = dataMsj.telefono;
			// _sendServerMsj.msj = `🤖 Hola ${dataMsj.nombre}, el repartidor que está a cargo de su pedido de ${dataMsj.establecimiento} es: ${dataMsj.repartidor_nom} 📞 ${dataMsj.repartidor_telefono} 🙋‍♂️\n\nLe llamará cuando este cerca ó para informarle de su pedido.`			
			_sendServerMsj.msj = dataMsj.msj
		}

		// notifica solicitud de permiso al administrador para borrar productos, eliminar cuentas, o cierre de caja
		// viene de restobar
		if ( tipo === 6 ) {
			let mjsPermiso = '';
			dataMsj.link = `https://chatbot.papaya.com.pe/solicitud-remoto/${dataMsj.link}`;
			// borrar producto de cuenta
			if ( dataMsj.tipo_permiso === 1 ) {
				mjsPermiso = `🔐 *[Solicitud de Permiso]*\nEl usuario: ${dataMsj.nomusuario_solicita} de ${dataMsj.nomsede} solicita permiso.\n\nHola ${dataMsj.nomusuario_admin}\n*Solicitud:* ${dataMsj.solicitud}\n*Motivo*: ${dataMsj.motivo}\n\nAutorizalo en este link: ${dataMsj.link}`;
			}

			_sendServerMsj.tipo = 6;
			_sendServerMsj.telefono = dataMsj.telefono_admin;			
			_sendServerMsj.msj = mjsPermiso
		}

		console.log('_sendServerMsj === ', _sendServerMsj);


		io.to('SERVERMSJ').emit('enviado-send-msj', _sendServerMsj);
}
module.exports.sendMsjSocketWsp = sendMsjSocketWsp;