const { to, ReE, ReS }  = require('../service/uitl.service');
// const atob = require('atob');
// const config = require('../config');
let config = require('../_config');
const webpush = require('web-push');
// let Sequelize = require('sequelize');
const io = require("socket.io-client");
const QueryServiceV1 = require('../service/query.service.v1');
const { sequelize, QueryTypes } = require('../config/database');


const nodemailer = require("nodemailer");
const logger = require('../utilitarios/logger');

// Usar instancia de Firebase Admin ya inicializada
const { admin: adminFirebase } = require('../firebase_config');
// const transporter = nodemailer.createTransport({
//     host: "email-smtp.us-east-2.amazonaws.com",
//     port: 465,
//     secure: true, // true for 465, false for other ports
//     auth: {
//         user: config.SEED_SES_USER, // generated ethereal user
//         pass: config.SEED_SES_PASS, // generated ethereal password
//     },
// });

// notificaciones push
const gcm = require('node-gcm');
const sender = new gcm.Sender(config.firebaseApikey);

// api de firebase
// let apiFireBase = require('../controllers/apiFireBase');


webpush.setVapidDetails(
  'mailto:papaya.restobar@gmail.com',
  config.publicKeyVapid,
  config.privateKeyVapid
);

// let sequelize = new Sequelize(config.database, config.username, config.password, config.sequelizeOption);

// sms mensaje de confirmacion de telefono
const sendMsjConfirmacion = async function (req, res) {	
	// const numberPhone = req.body.numberphone;
	// const idcliente = req.body.idcliente;

	// const codigoVerificacion = Math.round(Math.random()* (9000 - 1)+parseInt(1000));	
    // // const read_query = `SELECT * from cliente_pwa_direccion where idcliente = ${idcliente} and estado = 0`;
    // // emitirRespuesta_RES(read_query, res);        
    // var clientSMS = require('twilio')(config.accountSidSms, config.authTokenSms);
    // clientSMS.messages.create({
    // 	body: 'Papaya.com.pe, codigo de verificacion: ' + codigoVerificacion,
    // 	to: '+51'+numberPhone,  // Text this number
    // 	from: '+17852279308' // From a valid Twilio number
	// })
	// .then((message) => {
	// 	// genera codigo y guarda
	// 	const numTelefono = parseInt(idcliente) < 0 ? numberPhone : '';
	// 	const read_query = `call porcedure_pwa_update_phono_sms_cliente(${idcliente},'${numTelefono}', '${codigoVerificacion}')`;
    // 	emitirRespuestaSP(read_query);
	// 	return ReS(res, {
	// 		msj: true
	// 	});
	// })
	// .catch(err => {
	// 	return ReS(res, {
	// 		msj: false
	// 	});
	// });
}
module.exports.sendMsjConfirmacion = sendMsjConfirmacion;


const sendMsjWhatsAp = function (numberPhone) {
	// var client = require('twilio')(config.accountSidSms, config.authTokenSms);
	// client.messages.create({
	//   from: 'whatsapp:+14155238886',
	//   to: 'whatsapp:+51960518915',
	//   body: 'Hola desde api whatsapp!'

	// }).then(message => console.log(message.sid));	

}
module.exports.sendMsjWhatsAp = sendMsjWhatsAp;

// sms mensaje avisa nuevo pedido
const sendMsjSMSNewPedido = async function (numberPhone, dato = 'Repartidor ') {	

	// la doble notificacion se debio a que lanzaba 2 veces el socket
	// 191120 verificar esta enviando mensajes nulos y esta duplicando los envios
	// return true;

	// const numberPhone = req.body.numberphone;
    // const read_query = `SELECT * from cliente_pwa_direccion where idcliente = ${idcliente} and estado = 0`;
    // emitirRespuesta_RES(read_query, res);        
 //    var clientSMS = require('twilio')(config.accountSidSms, config.authTokenSms);

 //    clientSMS.messages.create({
 //    	body: dato  + 'Papaya Express. Tiene un nuevo pedido.',
 //    	to: '+51'+numberPhone,  // Text this number
 //    	from: '+17852279308' // From a valid Twilio number
// 	})
// 	.then((message) => {		
// 		return true;
// 	})
// 	.catch(err => {
// 		return false;
// 	});
}
module.exports.sendMsjSMSNewPedido = sendMsjSMSNewPedido;

// sms mensaje sms a clientes
const sendMsjSMS = async function (req, res) {	
	// const numberPhone = req.body.phone;
	// const contenido = req.body.contenido;

	

    // var clientSMS = require('twilio')(config.accountSidSms, config.authTokenSms);

    // clientSMS.messages.create({
    // 	body: contenido,
    // 	to: '+51'+numberPhone,  // Text this number
    // 	from: '+17852279308' // From a valid Twilio number
	// })
	// .then((message) => {	
	// 	return res.json({success:true});
	// })
	// .catch(err => {
	// 	return res.json({success:false});
	// });
}
module.exports.sendMsjSMS = sendMsjSMS;

const sendEmailSendGrid = async function (req, res) {

	const _msj = req.body.msj;

	const sgMail = require('@sendgrid/mail')	
	sgMail.setApiKey(config.SEED_EMAIL)
	const msg = {
	  to: _msj.to, // Change to your recipient
	  from: 'papaya.restobar@gmail.com', // Change to your verified sender
	  subject: _msj.asunto,
	  text: _msj.titulo,
	  html: _msj.htmlContent,
	}

	sgMail
	  .send(msg)
	  .then(() => {
	    return res.json({success:true});
	  })
	  .catch((error) => {
	    return res.json({success:false});
	  })

}
module.exports.sendEmailSendGrid = sendEmailSendGrid;

/*const sendEmailSendAWSSES = async function (req, res) {

	const _msj = req.body.msj;

	async function main() {
	  // Generate test SMTP service account from ethereal.email
	  // Only needed if you don't have a real mail account for testing
	  // let testAccount = await nodemailer.createTestAccount();

	  // create reusable transporter object using the default SMTP transport
	  let transporter = nodemailer.createTransport({
	    host: "email-smtp.us-east-2.amazonaws.com",
	    port: 587,
	    secure: false, // true for 465, false for other ports
	    auth: {
	      user: config.SEED_SES_USER, // generated ethereal user
	      pass: config.SEED_SES_PASS, // generated ethereal password
	    },
	  });

	  // send mail with defined transport object
	  let info = await transporter.sendMail({
	    from: 'papaya.restobar@gmail.com', // sender address
	    to: _msj.to, // list of receivers
	    subject: _msj.asunto, // Subject line
	    text: _msj.titulo, // plain text body
	    html: _msj.htmlContent, // html body
	  });

	}

	try {
		main().catch((error) => {
			return res.json({success:false});
		});

		res.status(200).json({
			ok: true,
			message: 'Envio correcto'
		});
	} catch(err) {
		res.status(400).json({
			ok: false,
			message: 'Problemas al enviar correcto electronico'
		});
	}

	

	

}
module.exports.sendEmailSendAWSSES = sendEmailSendAWSSES;
*/

const sendEmailSendAWSSES = async function (req, res) {
    const _msj = req.body.msj;

    try {

		


		// create reusable transporter object using the default SMTP transport
		const transporter = nodemailer.createTransport({
			host: "email-smtp.us-east-2.amazonaws.com",
			port: 465,
			secure: true, // true for 465, false for other ports
			auth: {
				user: config.SEED_SES_USER, // generated ethereal user
				pass: config.SEED_SES_PASS, // generated ethereal password
			},
		});

        // send mail with defined transport object
        let info = await transporter.sendMail({
            from: 'papaya.restobar@gmail.com', // sender address
            to: _msj.to, // list of receivers
            subject: _msj.asunto, // Subject line
            text: _msj.titulo, // plain text body
            html: _msj.htmlContent // html body			
        });

        logger.debug("Message sent: %s", info);

        res.status(200).json({
            ok: true,
            message: 'Envio correcto'
        });
    } catch(err) {
        console.error(err);
        res.status(400).json({
            ok: false,
            message: 'Problemas al enviar correo electrónico' + err
        });
    }
}

module.exports.sendEmailSendAWSSES = sendEmailSendAWSSES;

// notificaciones push
// guardar suscripcion notificacion push
const pushSuscripcion = async function (req) {
	const suscripcion = req.body.suscripcion;
	const idcliente = req.body.idcliente;

	// const read_query = `update cliente_socketid set key_suscripcion_push = '${JSON.stringify(suscripcion)}' where idcliente = ${idcliente}`;
	// return emitirRespuesta(read_query);
	const update_query = `update cliente_socketid set key_suscripcion_push = ? where idcliente = ?`;
	return await QueryServiceV1.ejecutarConsulta(update_query, [JSON.stringify(suscripcion), idcliente], 'UPDATE', 'pushSuscripcion');
}
module.exports.pushSuscripcion = pushSuscripcion;

// envia notificacion a los usuario filtrados
const sendPushNotificaction = function (req, res) {
	const codigo_postal = req.body.codigo_postal;
	const idcliente = req.body.idcliente;
	const notificationPayload = req.body.notification
	

	// const notificationPayload = {
 //        "notification": {
 //            "title": "Angular News",
 //            "body": "Newsletter Available!",
 //            "icon": "assets/main-page-logo-small-hat.png",
 //            "vibrate": [100, 50, 100],
 //            "data": {
 //                "dateOfArrival": Date.now(),
 //                "primaryKey": 1
 //            },
 //            "actions": [{
 //                "action": "explore",
 //                "title": "Go to the site"
 //            }]
 //        }
 //    };

    const where_query = idcliente ? `cs.idcliente = ${idcliente} and` :  codigo_postal  ? `cd.codigo in (${codigo_postal}) and` : '';
	const read_query = `select DISTINCT cs.idcliente, cs.key_suscripcion_push
						from cliente_socketid cs
							inner join cliente_pwa_direccion as cd on cs.idcliente = cd.idcliente
						where ${where_query} cs.key_suscripcion_push != ''`;



	emitirRespuesta(read_query).then(allSubscriptions => {		
		res.json(allSubscriptions);

		 // Promise.all(
		 // allSubscriptions.map(sub => 
		 // 	webpush.sendNotification
		 // 	(sub.key_suscripcion_push, JSON.stringify(notificationPayload) )))
	  //       .then(() => res.status(200).json({message: 'Newsletter sent successfully.'}))
	  //       .catch(err => {
	  //           console.error("Error sending notification, reason: ", err);
	  //           res.sendStatus(500);
   //      });

	    Promise.all(allSubscriptions.map(sub => webpush.sendNotification(
        sub, JSON.stringify(notificationPayload) )))
        .then(() => res.status(200).json({message: 'Newsletter sent successfully.'}))
        .catch(err => {            
            res.sendStatus(500);
        });	       
	});	
}
module.exports.sendPushNotificaction = sendPushNotificaction;


// envia notificacion push a repartidor de que tiene un pedido
const sendPushNotificactionComercio = function (key_suscripcion_push, tipo_msj) {	
	if ( !key_suscripcion_push || key_suscripcion_push.length === 0 ) {return ;}
	
	// let payloadNotification = '';
	// switch (tipo_msj) {
    //   case 0: // notifica a repartidor nuevo pedido
    //   payloadNotification = {
	// 		title: "🎉 Nuevo Pedido",
	// 		icon: "./favicon.ico",
	// 		body: "Tiene un nuevo pedido por Papaya Express.",
	// 		vibrate: [200, 100, 200],
    //     	sound: "default"
	// 	}       
    //     break;
    // }	


    // solo web 
    let payload = {
		"notification": {		        
		        "title": "🎉 Nuevo Pedido",
		        "body": `Tiene un nuevo pedido por Papaya Express`,
		        "icon": "./favicon.ico",
		        "lang": "es",
		        "vibrate": [100, 50, 100, 100, 100, 50 , 50, 100, 50, 100, 100, 100, 50 , 50, 100, 50, 100, 100, 100, 50 , 50, 100, 50, 100, 100, 100, 50 , 50, 100, 50, 100, 100, 100, 50 , 50, 100, 50, 100, 100, 100, 50 , 50, 100, 50, 100, 100, 100, 50 , 50, 100, 50, 100, 100, 100, 50 , 50, 100, 50, 100, 100, 100, 50 , 50]		        
		    }
		} 


	// para web
    webpush.sendNotification(
    	key_suscripcion_push, JSON.stringify(payload) )
		.then(() => 
			// res.status(200).json({message: 'mensaje enviado con exito'})
			logger.debug('mensaje enviado con exito')
		)
        .catch(err => {
           	logger.error("Error sending notification, reason: ", {
				statusCode: err.statusCode,
				body: err.body,
				message: err.message,
				stack: err.stack
			});
			
			// Si es 404 o 410, la suscripción ya no es válida
			if (err.statusCode === 404 || err.statusCode === 410) {
				logger.warn('Suscripción push inválida o expirada. Se debe limpiar de la BD.');
			}
           	// res.sendStatus(500);
        });

	// res.json(payloadNotification)
}
module.exports.sendPushNotificactionComercio = sendPushNotificactionComercio;

// envia notificacion push a repartidor de que tiene un pedido
// const sendPushNotificactionOneRepartidor = function (key_suscripcion_push, tipo_msj, user_repartidor=null) {
// 	let fcm_token = null;
// 	if (user_repartidor) {
// 		key_suscripcion_push = user_repartidor.key_suscripcion_push;
// 		fcm_token = user_repartidor.fcm_token;
// 	}
// 	if ( !key_suscripcion_push || key_suscripcion_push.length === 0 ) {return ;}


// 		// para version web
// 		let payload = {
// 			"notification": {		        
// 			        "title": " Nuevo Pedido",
// 			        "body": `Acepta el pedido, tiene un minuto para aceptarlo.`,
// 			        "icon": "./favicon.ico",
// 			        "lang": "es",
// 			        "vibrate": [100, 50, 100, 100, 100, 50 , 50, 100, 50, 100, 100, 100, 50 , 50, 100, 50, 100, 100, 100, 50 , 50, 100, 50, 100, 100, 100, 50 , 50, 100, 50, 100, 100, 100, 50 , 50, 100, 50, 100, 100, 100, 50 , 50, 100, 50, 100, 100, 100, 50 , 50, 100, 50, 100, 100, 100, 50 , 50, 100, 50, 100, 100, 100, 50 , 50]		        
// 			    }
// 			} 
// 		// para web
// 	    webpush.sendNotification(
// 	    	key_suscripcion_push, JSON.stringify(payload) )
// 			.then(() => 
// 				// res.status(200).json({message: 'mensaje enviado con exito'})
// 				logger.debug('ok')
// 			)
// 	        .catch(err => {
// 	           	logger.error("Error sending notification to repartidor: ", {
// 				statusCode: err.statusCode,
// 				body: err.body,
// 				message: err.message,
// 				headers: err.headers
// 			});
			
// 			// Si es 404 o 410, la suscripción ya no es válida
// 			if (err.statusCode === 404 || err.statusCode === 410) {
// 				logger.warn(' Suscripción push del repartidor inválida o expirada (statusCode: ' + err.statusCode + '). Se debe actualizar/limpiar en la BD.');
// 				// TODO: Marcar key_suscripcion_push como inválido en la tabla repartidor
// 			}
// 	           	// res.sendStatus(500);
// 	        });



// 	// notificacion ios android

// 	let payloadNotification = '';
// 	switch (tipo_msj) {
//       case 0: // notifica a repartidor nuevo pedido
//       payloadNotification = {
// 			title: " Nuevo Pedido",
// 			icon: "./favicon.ico",
// 			body: "Acepta el pedido, tiene un minuto para aceptarlo.",
// 			vibrate: [200, 100, 200],
//         	sound: "default"
// 		}       
//         break;
//     }	

		
//     //081222 firebase
//     var message = new gcm.Message({
// 		collapseKey: 'demo',
// 		priority: 'high',
// 		contentAvailable: true,
// 		delayWhileIdle: true,
// 		timeToLive: 3,					
// 		notification: payloadNotification
// 	});

// 	const registrationIds = [key_suscripcion_push];

// 	sender.send(message, { registrationIds: registrationIds }, (err, response) => {
// 	  if (err) {
// 	    logger.error(err);
// 	  } else {
// 	    logger.debug(response);
// 	  }
// 	});

	
// 	// lo ultimo para firebase flutterflow 30042024
// 	const _bodyFlutter = {
// 		titulo: ' Nuevo Pedido',
// 		body: 'Acepta el pedido, tiene un minuto para aceptarlo.'
// 	}
	
// }
// module.exports.sendPushNotificactionOneRepartidor = sendPushNotificactionOneRepartidor;

// notificacion repartidor 311225
const buildWebPayload = (tipo_msj) => {
	// switch (tipo_msj) {
	// 	case 0:
	// 	default:
	// 		return {
	// 			notification: {
	// 				title: 'Nuevo Pedido',
	// 				body: 'Acepta el pedido, tiene un minuto para aceptarlo.',
	// 				icon: './favicon.ico',
	// 				lang: 'es',
	// 				vibrate: [200, 100, 200]
	// 			}
	// 		};
	// }


	return {
		notification: {
			title: 'Nuevo Pedido',
			body: tipo_msj === 0 ? 'Acepta el pedido, tiene un minuto para aceptarlo.' : tipo_msj,
			icon: './favicon.ico',
			lang: 'es',
			vibrate: [200, 100, 200]
		}
	};
};

const buildFcmNotification = (tipo_msj) => {
	// switch (tipo_msj) {
	// 	case 0:
	// 	default:
	// 		return {
	// 			title: 'Nuevo Pedido',
	// 			icon: './favicon.ico',
	// 			body: 'Acepta el pedido, tiene un minuto para aceptarlo.',
	// 			vibrate: [200, 100, 200],
	// 			sound: 'default'
	// 		};
	// }

	return {
		title: 'Nuevo Pedido',
		icon: './favicon.ico',
		body: tipo_msj === 0 ? 'Acepta el pedido, tiene un minuto para aceptarlo.' : tipo_msj,
		vibrate: [200, 100, 200],
		sound: 'default'
	};
};

const parseWebSubscription = (pwa_code_verification) => {
	if (!pwa_code_verification) return null;

	// Puede llegar como objeto o string JSON
	if (typeof pwa_code_verification === 'object') {
		return pwa_code_verification?.endpoint && pwa_code_verification?.keys
			? pwa_code_verification
			: null;
	}

	if (typeof pwa_code_verification === 'string') {
		try {
			const sub = JSON.parse(pwa_code_verification);
			return sub?.endpoint && sub?.keys ? sub : null;
		} catch (e) {
			return null;
		}
	}

	return null;
};

const sendPushNotificactionOneRepartidor = async function (
	key_suscripcion_push, // compat (ya no se usa como fuente principal)
	tipo_msj,
	user_repartidor = null
) {
	// Fuente real ahora: user_repartidor
	const pwa_code_verification = user_repartidor?.pwa_code_verification || null;
	const fcm_token = user_repartidor?.fcm_token || null;

	// 1) WEB PUSH
	const subscription = parseWebSubscription(pwa_code_verification);
	if (subscription) {
		const payload = buildWebPayload(tipo_msj);

		try {
			await webpush.sendNotification(subscription, JSON.stringify(payload));
			logger.debug('WEB PUSH OK');
			return;
		} catch (err) {
			logger.error('Error sending WEB PUSH to repartidor: ', {
				statusCode: err?.statusCode,
				body: err?.body,
				message: err?.message,
				headers: err?.headers
			});

			// Si es 404 o 410, la suscripción ya no es válida
			if (err?.statusCode === 404 || err?.statusCode === 410) {
				logger.warn(
					'Suscripción WEB PUSH inválida/expirada (statusCode: ' +
					err.statusCode +
					'). Se debe limpiar pwa_code_verification en BD.'
				);
				// TODO: limpiar pwa_code_verification en BD para user_repartidor.idrepartidor
			}
			return;
		}
	}

	// 2) FCM / GCM (Nativo)
	if (typeof fcm_token === 'string' && fcm_token.length > 0) {
		const notification = buildFcmNotification(tipo_msj);

		const message = {
			token: fcm_token,
			notification: {
				title: notification.title,
				body: notification.body
			},
			android: {
				priority: 'high',
				notification: {
					sound: 'default',
					channelId: 'fcm_default_channel',
					priority: 'high'
				}
			},
			apns: {
				payload: {
					aps: {
						sound: 'default',
						contentAvailable: true
					}
				}
			}
		};

		try {
			const response = await adminFirebase.messaging().send(message);
			logger.debug('FCM OK:', response);
			return;
		} catch (err) {
			logger.error('Error enviando FCM:', {
				code: err.code,
				message: err.message
			});

			return;	
		}
	}

	// 3) No hay data de push
	logger.log('Repartidor sin pwa_code_verification ni fcm_token, no se envía push.');
};

module.exports.sendPushNotificactionOneRepartidor = sendPushNotificactionOneRepartidor;

// TEST
// envia notificacion push a repartidor de que tiene un pedido
const sendPushNotificactionRepartidorAceptaPedido = function (_dataMsjs) {
	const key_suscripcion_push = _dataMsjs.key_suscripcion_push;
	if ( !key_suscripcion_push || key_suscripcion_push.length === 0 ) {return ;}
	
	logger.debug('push key_push', key_suscripcion_push);
	// const key_suscripcion_push = Repartidor.key_suscripcion_push;	
	// const notificationPayload = payload;
	let payload;	
	let iconPush = '';	
	// if ( !_payload ) {
		switch (_dataMsjs.tipo_msj) {
	      case 0: // notifica a repartidor nuevo pedido
	      	  iconPush = 'https://img-premium.flaticon.com/png/512/2332/2332139.png?token=exp=1622510180~hmac=2023e4941f54e545cee8d8d1f5ef279c';
		      payload = {
				"notification": {
				        // "notification": {
				            "title": _dataMsjs.msj,
				            "body": _dataMsjs.titulo,
				            "icon": iconPush,
				            "lang": "es",
				            "vibrate": [100, 50, 100, 100, 100, 50 , 50, 100, 50, 100, 100, 100, 50 , 50, 100, 50, 100, 100, 100, 50 , 50, 100, 50, 100, 100, 100, 50 , 50, 100, 50, 100, 100, 100, 50 , 50, 100, 50, 100, 100, 100, 50 , 50, 100, 50, 100, 100, 100, 50 , 50, 100, 50, 100, 100, 100, 50 , 50, 100, 50, 100, 100, 100, 50 , 50],
				            "actions": _dataMsjs._actions,
	                        "data": _dataMsjs._data				       		
				        }
				    }
				// }


	        break;
	    }
	// } 
	
    // Promise.all(
    webpush.sendNotification(
    	key_suscripcion_push, JSON.stringify(payload) )
		.then(() => 
			res.status(200).json({message: 'mensaje enviado con exito'})
		)
        .catch(err => {
           	console.error("Error sending notification, reason: ", {
				statusCode: err.statusCode,
				body: err.body,
				message: err.message
			});
			
			// Si es 404 o 410, la suscripción ya no es válida
			if (err.statusCode === 404 || err.statusCode === 410) {
				logger.warn(' Suscripción push inválida (statusCode: ' + err.statusCode + ')');
			}
           	res.sendStatus(500);
        });



	
}
module.exports.sendPushNotificactionRepartidorAceptaPedido = sendPushNotificactionRepartidorAceptaPedido;


// test 311225
const sendPushNotificactionOneRepartidorTEST = async function (req, res) {
	logger.debug('push test');
	const user_repartidor = req.body.user_repartidor || null;
	const tipo_msj = Number(req.body.tipo_msj ?? 0);
	if (!user_repartidor) {
		return res.status(400).json({
			success: false,
			message: 'Falta req.body.user_repartidor'
		});
	}
	try {
		// Llamas a tu función refactorizada (la que decide webpush vs fcm)
		await sendPushNotificactionOneRepartidor(
			user_repartidor?.pwa_code_verification || user_repartidor?.fcm_token || '',
			tipo_msj,
			user_repartidor
		);
		return res.status(200).json({
			success: true,
			message: 'Push enviado (según canal disponible)',
			tipo_msj
		});
	} catch (err) {
		logger.error('Error en push test', { err });
		return res.status(500).json({
			success: false,
			message: 'Error enviando push test'
		});
	}
};
module.exports.sendPushNotificactionOneRepartidorTEST = sendPushNotificactionOneRepartidorTEST;


// TEST
// envia notificacion push a repartidor de que tiene un pedido
// const sendPushNotificactionOneRepartidorTEST = function (req, res) {
// 	logger.debug('push test');
// 	const key_suscripcion_push = req.body.key_suscripcion_push;
// 	const _payload = req.body.payload || null;
// 	const tipo_msj = 0;	


// 	const payloadNotification = {
// 			title: " Nuevo Pedido",
// 			icon: "./favicon.ico",
// 			body: "Acepta el pedido, tiene un minuto para aceptarlo.",
// 			vibrate: [200, 100, 200],
//         	sound: "default"
// 		} 

//     //081222 firebase
//     var message = new gcm.Message({
// 		collapseKey: 'demo',
// 		priority: 'high',
// 		contentAvailable: true,
// 		delayWhileIdle: true,
// 		timeToLive: 3,					
// 		notification: payloadNotification
// 	});

// 	const registrationIds = [key_suscripcion_push];

// 	sender.send(message, { registrationIds: registrationIds }, (err, response) => {
// 	  if (err) {
// 	  	res.sendStatus(500);
// 	    logger.error(err);
// 	  } else {
// 	  	res.status(200).json({message: 'mensaje enviado con exito'})
// 	    logger.debug(response);
// 	  }
// 	});



// 	// web
// 	let payload = {
// 		"notification": {		        
// 		        "title": " Nuevo Pedido",
// 		        "body": `Nuevo Pedido Papaya Expres.`,
// 		        "icon": "./favicon.ico",
// 		        "lang": "es",
// 		        "vibrate": [100, 50, 100, 100, 100, 50 , 50, 100, 50, 100, 100, 100, 50 , 50, 100, 50, 100, 100, 100, 50 , 50, 100, 50, 100, 100, 100, 50 , 50, 100, 50, 100, 100, 100, 50 , 50, 100, 50, 100, 100, 100, 50 , 50, 100, 50, 100, 100, 100, 50 , 50, 100, 50, 100, 100, 100, 50 , 50, 100, 50, 100, 100, 100, 50 , 50]		        
// 		    }
// 		} 
// 	// para web
//     webpush.sendNotification(
//     	key_suscripcion_push, JSON.stringify(payload) )
// 		.then(() => 
// 			// res.status(200).json({message: 'mensaje enviado con exito'})
// 			logger.debug('ok')
// 		)
//         .catch(err => {
//            	logger.error("Error sending notification, reason: ", {
// 				statusCode: err.statusCode,
// 				body: err.body,
// 				message: err.message
// 			});
			
// 			// Si es 404 o 410, la suscripción ya no es válida
// 			if (err.statusCode === 404 || err.statusCode === 410) {
// 				logger.warn(' Suscripción push inválida (statusCode: ' + err.statusCode + ')');
// 			}
//            	// res.sendStatus(500);
//         });


// 	// lo ultimo para firebase flutterflow 30042024
// 	const _bodyFlutter = {
// 		titulo: ' Nuevo Pedido',
// 		body: 'Acepta el pedido, tiene un minuto para aceptarlo.'
// 	}

// 	// apiFireBase.sendPushNotification(key_suscripcion_push, _bodyFlutter);



// }
// module.exports.sendPushNotificactionOneRepartidorTEST = sendPushNotificactionOneRepartidorTEST;


const sendPushWebTest = async function (req, res) {
    try {
        const { key_suscripcion_push, payload } = req.body;
        
        // Validar key_suscripcion_push
        if (!key_suscripcion_push) {
            return res.status(400).json({ 
                success: false, 
                message: 'key_suscripcion_push is required' 
            });
        }

        // Parsear key_suscripcion_push si viene como string
        const subscription = typeof key_suscripcion_push === 'string' 
            ? JSON.parse(key_suscripcion_push) 
            : key_suscripcion_push;

        // Payload por defecto
        const defaultPayload = {
            notification: {
                title: "🎉 Nuevo Pedido",
                body: "Nuevo Pedido Papaya Express",
                icon: "./favicon.ico",
                badge: "./favicon.ico",
                lang: "es",
                tag: "pedido",
                requireInteraction: true,
                renotify: true,
                vibrate: [100, 50, 100],
                sound: "./notification.mp3",
                timestamp: Date.now()
            }
        };

        // Usar payload personalizado o el default
        const finalPayload = payload || defaultPayload;

        // Enviar notificación
        await webpush.sendNotification(
            subscription,
            JSON.stringify(finalPayload)
        );

        return res.status(200).json({
            success: true,
            message: 'Notificación enviada correctamente'
        });

    } catch (error) {
        console.error('Error sending web push:', error);
        return res.status(500).json({
            success: false,
            message: error.message
        });
    }
};
module.exports.sendPushWebTest = sendPushWebTest;


// function emitirRespuestaSP(xquery) {	
// 	return sequelize.query(xquery, {		
// 		type: sequelize.QueryTypes.SELECT
// 	})
// 	.then(function (rows) {

// 		// convertimos en array ya que viene en object
// 		var arr = [];
// 		arr = Object.values(rows[0]);		
		
// 		return arr;
// 	})
// 	.catch((err) => {
// 		return false;
// 	});
// }


function emitirRespuesta(xquery, res) {	
	return sequelize.query(xquery, {type: QueryTypes.SELECT})
	.then(function (rows) {
		
		// return ReS(res, {
		// 	data: rows
		// });
		return rows;
	})
	.catch((err) => {
		return false;
	});
}