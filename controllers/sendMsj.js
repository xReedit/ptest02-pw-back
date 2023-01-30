const { to, ReE, ReS }  = require('../service/uitl.service');
// const atob = require('atob');
const config = require('../config');
const webpush = require('web-push');
let Sequelize = require('sequelize');

const nodemailer = require("nodemailer");

// notificaciones push
const gcm = require('node-gcm');
const sender = new gcm.Sender(config.firebaseApikey);


webpush.setVapidDetails(
  'mailto:papaya.restobar@gmail.com',
  config.publicKeyVapid,
  config.privateKeyVapid
);

let sequelize = new Sequelize(config.database, config.username, config.password, config.sequelizeOption);

// sms mensaje de confirmacion de telefono
const sendMsjConfirmacion = async function (req, res) {
	// console.log ('idcliente', req.body);
	// const numberPhone = req.body.numberphone;
	// const idcliente = req.body.idcliente;

	// const codigoVerificacion = Math.round(Math.random()* (9000 - 1)+parseInt(1000));
	// console.log('codigo de verificacion', codigoVerificacion);
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

 // //    clientSMS.messages.create({
// 	//   from: 'whatsapp:+14155238886',
// 	//   body: 'Ahoy world!',
// 	//   to: 'whatsapp:+51'+numberPhone
// 	// }).then(message => console.log(message.sid));

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

	// console.log(contenido);

    // var clientSMS = require('twilio')(config.accountSidSms, config.authTokenSms);

    // clientSMS.messages.create({
    // 	body: contenido,
    // 	to: '+51'+numberPhone,  // Text this number
    // 	from: '+17852279308' // From a valid Twilio number
	// })
	// .then((message) => {	
	// 	console.log(message.sid);
	// 	return res.json({success:true});
	// })
	// .catch(err => {
	// 	console.log('error al enviar mensaje');
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
	    console.log('Email sent')
	    return res.json({success:true});
	  })
	  .catch((error) => {
	    console.error(error)
	    return res.json({success:false});
	  })

}
module.exports.sendEmailSendGrid = sendEmailSendGrid;

const sendEmailSendAWSSES = async function (req, res) {

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

	  console.log("Message sent: %s", info.messageId);
	  // Message sent: <b658f8ca-6296-ccf4-8306-87d57a0b4321@example.com>

	  // Preview only available when sending through an Ethereal account
	  // console.log("Preview URL: %s", nodemailer.getTestMessageUrl(info));
	  // Preview URL: https://ethereal.email/message/WaQKMgKddxQDoou...
	}

	main().catch((error) => {
		console.error(error)
	    return res.json({success:false});
	});

	res.status(200).json({
		ok: true,
		message: 'Envio correcto'
	});

}
module.exports.sendEmailSendAWSSES = sendEmailSendAWSSES;


// notificaciones push
// guardar suscripcion notificacion push
const pushSuscripcion = async function (req) {
	const suscripcion = req.body.suscripcion;
	const idcliente = req.body.idcliente;

	const read_query = `update cliente_socketid set key_suscripcion_push = '${JSON.stringify(suscripcion)}' where idcliente = ${idcliente}`;
	return emitirRespuesta(read_query);
}
module.exports.pushSuscripcion = pushSuscripcion;

// envia notificacion a los usuario filtrados
const sendPushNotificaction = function (req, res) {
	const codigo_postal = req.body.codigo_postal;
	const idcliente = req.body.idcliente;
	const notificationPayload = req.body.notification

	console.log('notificationPayload', notificationPayload);

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
		console.log(allSubscriptions);
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
            console.error("Error sending notification, reason: ", err);
            res.sendStatus(500);
        });	       
	});
	// console.log('listUsuarios send notificacion', listUsuarios);
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


	// console.log('notificationPayload', payload);
	// para web
    webpush.sendNotification(
    	key_suscripcion_push, JSON.stringify(payload) )
		.then(() => 
			// res.status(200).json({message: 'mensaje enviado con exito'})
			console.log('ok')
		)
        .catch(err => {
           	console.error("Error sending notification, reason: ", err);
           	// res.sendStatus(500);
        });

	// res.json(payloadNotification)
}
module.exports.sendPushNotificactionComercio = sendPushNotificactionComercio;

// envia notificacion push a repartidor de que tiene un pedido
const sendPushNotificactionOneRepartidor = function (key_suscripcion_push, tipo_msj) {	
	if ( !key_suscripcion_push || key_suscripcion_push.length === 0 ) {return ;}
	let payloadNotification = '';
	switch (tipo_msj) {
      case 0: // notifica a repartidor nuevo pedido
      payloadNotification = {
			title: "🎉 Nuevo Pedido",
			icon: "./favicon.ico",
			body: "Acepta el pedido, tiene un minuto para aceptarlo.",
			vibrate: [200, 100, 200],
        	sound: "default"
		}       
        break;
    }	

		
    //081222 firebase
    var message = new gcm.Message({
		collapseKey: 'demo',
		priority: 'high',
		contentAvailable: true,
		delayWhileIdle: true,
		timeToLive: 3,					
		notification: payloadNotification
	});

	const registrationIds = [key_suscripcion_push];

	sender.send(message, { registrationIds: registrationIds }, (err, response) => {
	  if (err) {
	  	// res.sendStatus(500);
	    console.error(err);
	  } else {
	  	// res.status(200).json({message: 'mensaje enviado con exito'})
	    console.log(response);
	  }
	});

	
	



	// console.log('notificationPayload', payload);

	let payload = {
		"notification": {		        
		        "title": "🎉 Nuevo Pedido",
		        "body": `Acepta el pedido, tiene un minuto para aceptarlo.`,
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
			console.log('ok')
		)
        .catch(err => {
           	console.error("Error sending notification, reason: ", err);
           	// res.sendStatus(500);
        });

	// res.json(payload)
}
module.exports.sendPushNotificactionOneRepartidor = sendPushNotificactionOneRepartidor;

// TEST
// envia notificacion push a repartidor de que tiene un pedido
const sendPushNotificactionRepartidorAceptaPedido = function (_dataMsjs) {
	const key_suscripcion_push = _dataMsjs.key_suscripcion_push;
	if ( !key_suscripcion_push || key_suscripcion_push.length === 0 ) {return ;}
	
	console.log('push key_push', key_suscripcion_push);
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
           	console.error("Error sending notification, reason: ", err);
           	res.sendStatus(500);
        });



	
}
module.exports.sendPushNotificactionRepartidorAceptaPedido = sendPushNotificactionRepartidorAceptaPedido;


// TEST
// envia notificacion push a repartidor de que tiene un pedido
const sendPushNotificactionOneRepartidorTEST = function (req, res) {
	console.log('push test');
	const key_suscripcion_push = req.body.key_suscripcion_push;
	const _payload = req.body.payload || null;
	const tipo_msj = 0;	

	// console.log('push key_push', key_suscripcion_push);
	// // const key_suscripcion_push = Repartidor.key_suscripcion_push;	
	// // const notificationPayload = payload;
	// let payload;	
	// if ( !_payload ) {
	// 	switch (tipo_msj) {
	//       case 0: // notifica a repartidor nuevo pedido
	//       payload = {
	// 		"notification": {
	// 		        // "notification": {
	// 		            "title": "Nuevo Pedido",
	// 		            "body": `Te llego un pedido.`,
	// 		            "icon": "./favicon.ico",
	// 		            "lang": "es",
	// 		            "vibrate": [100, 50, 100, 100, 100, 50 , 50, 100, 50, 100, 100, 100, 50 , 50, 100, 50, 100, 100, 100, 50 , 50, 100, 50, 100, 100, 100, 50 , 50, 100, 50, 100, 100, 100, 50 , 50, 100, 50, 100, 100, 100, 50 , 50, 100, 50, 100, 100, 100, 50 , 50, 100, 50, 100, 100, 100, 50 , 50, 100, 50, 100, 100, 100, 50 , 50],
	// 		            "actions": [
    //                         {"action": "foo", "title": "Enviar Mensaje"},
    //                         {"action": "foo2", "title": "Llamar"}
    //                     ],
    //                     "data": {
    //                         "onActionClick": {
    //                             "foo": {"operation": "openWindow", "url": "https://api.whatsapp.com/send?phone=51934746830"},
    //                             "foo2": {"operation": "openWindow", "url": "tel:934746830"}      
    //                         }
	// 		            }
			       		
	// 		        }
	// 		    // }
	// 		}       
	//         break;
	//     }
	// } else {
	// 	payload = _payload;
	// }

	

	// if ( !key_suscripcion_push || key_suscripcion_push.length === 0 ) {return ;}

	// console.log('notificationPayload', payload);
	
    // // Promise.all(
    // webpush.sendNotification(
    // 	key_suscripcion_push, JSON.stringify(payload) )
	// 	.then(() => 
	// 		res.status(200).json({message: 'mensaje enviado con exito'})
	// 	)
    //     .catch(err => {
    //        	console.error("Error sending notification, reason: ", err);
    //        	res.sendStatus(500);
    //     });

	const payloadNotification = {
			title: "🪂 Nuevo Pedido",
			icon: "./favicon.ico",
			body: "Acepta el pedido, tiene un minuto para aceptarlo.",
			vibrate: [200, 100, 200],
        	sound: "default"
		} 

    //081222 firebase
    var message = new gcm.Message({
		collapseKey: 'demo',
		priority: 'high',
		contentAvailable: true,
		delayWhileIdle: true,
		timeToLive: 3,					
		notification: payloadNotification
	});

	const registrationIds = [key_suscripcion_push];

	sender.send(message, { registrationIds: registrationIds }, (err, response) => {
	  if (err) {
	  	res.sendStatus(500);
	    console.error(err);
	  } else {
	  	res.status(200).json({message: 'mensaje enviado con exito'})
	    console.log(response);
	  }
	});



	// web
	let payload = {
		"notification": {		        
		        "title": "🎉 Nuevo Pedido",
		        "body": `Nuevo Pedido Papaya Expres.`,
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
			console.log('ok')
		)
        .catch(err => {
           	console.error("Error sending notification, reason: ", err);
           	// res.sendStatus(500);
        });


}
module.exports.sendPushNotificactionOneRepartidorTEST = sendPushNotificactionOneRepartidorTEST;





function emitirRespuestaSP(xquery) {
	console.log(xquery);
	return sequelize.query(xquery, {		
		type: sequelize.QueryTypes.SELECT
	})
	.then(function (rows) {

		// convertimos en array ya que viene en object
		var arr = [];
		arr = Object.values(rows[0]);		
		
		return arr;
	})
	.catch((err) => {
		return false;
	});
}


function emitirRespuesta(xquery, res) {
	console.log(xquery);
	return sequelize.query(xquery, {type: sequelize.QueryTypes.SELECT})
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