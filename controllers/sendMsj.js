const { to, ReE, ReS }  = require('../service/uitl.service');
const config = require('../config');
const webpush = require('web-push');
let Sequelize = require('sequelize');

webpush.setVapidDetails(
  'mailto:papaya.restobar@gmail.com',
  config.publicKeyVapid,
  config.privateKeyVapid
);

let sequelize = new Sequelize(config.database, config.username, config.password, config.sequelizeOption);

// sms mensaje de confirmacion de telefono
const sendMsjConfirmacion = async function (req, res) {
	// console.log ('idcliente', req.body);
	const numberPhone = req.body.numberphone;
	const idcliente = req.body.idcliente;

	const codigoVerificacion = Math.round(Math.random()* (9000 - 1)+parseInt(1000));
	console.log('codigo de verificacion', codigoVerificacion);
    // const read_query = `SELECT * from cliente_pwa_direccion where idcliente = ${idcliente} and estado = 0`;
    // emitirRespuesta_RES(read_query, res);        
    var clientSMS = require('twilio')(config.accountSidSms, config.authTokenSms);
    clientSMS.messages.create({
    	body: 'Papaya.com.pe, codigo de verificacion: ' + codigoVerificacion,
    	to: '+51'+numberPhone,  // Text this number
    	from: '+17852279308' // From a valid Twilio number
	})
	.then((message) => {
		// genera codigo y guarda
		const read_query = `call porcedure_pwa_update_phono_sms_cliente(${idcliente},'', '${codigoVerificacion}')`;
    	emitirRespuestaSP(read_query);
		return ReS(res, {
			msj: true
		});
	})
	.catch(err => {
		return ReS(res, {
			msj: false
		});
	});
}
module.exports.sendMsjConfirmacion = sendMsjConfirmacion;




// sms mensaje avisa nuevo pedido
const sendMsjSMSNewPedido = async function (numberPhone, dato = 'Repartidor ') {	
	// const numberPhone = req.body.numberphone;
    // const read_query = `SELECT * from cliente_pwa_direccion where idcliente = ${idcliente} and estado = 0`;
    // emitirRespuesta_RES(read_query, res);        
    var clientSMS = require('twilio')(config.accountSidSms, config.authTokenSms);

 //    clientSMS.messages.create({
	//   from: 'whatsapp:+14155238886',
	//   body: 'Ahoy world!',
	//   to: 'whatsapp:+51'+numberPhone
	// }).then(message => console.log(message.sid));

    clientSMS.messages.create({
    	body: dato  + 'Papaya Express. Tiene un nuevo pedido.',
    	to: '+51'+numberPhone,  // Text this number
    	from: '+17852279308' // From a valid Twilio number
	})
	.then((message) => {		
		return true;
	})
	.catch(err => {
		return false;
	});
}
module.exports.sendMsjSMSNewPedido = sendMsjSMSNewPedido;


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
const sendPushNotificactionOneRepartidor = function (key_suscripcion_push, tipo_msj) {
	// const key_suscripcion_push = Repartidor.key_suscripcion_push;	
	// const notificationPayload = payload;
	let payload;
	switch (tipo_msj) {
      case 0: // notifica a repartidor nuevo pedido
      payload = {
		"notification": {
		        // "notification": {
		            "title": "Nuevo Pedido",
		            "body": `Te llego un pedido.`,
		            "icon": "./favicon.ico",
		            "lang": "es",
		            "vibrate": [100, 50, 100, 100, 100, 50 , 50, 100, 50, 100, 100, 100, 50 , 50, 100, 50, 100, 100, 100, 50 , 50, 100, 50, 100, 100, 100, 50 , 50, 100, 50, 100, 100, 100, 50 , 50, 100, 50, 100, 100, 100, 50 , 50, 100, 50, 100, 100, 100, 50 , 50, 100, 50, 100, 100, 100, 50 , 50, 100, 50, 100, 100, 100, 50 , 50]
		        // }
		    }
		}       
        break;
    }	

	if ( !key_suscripcion_push || key_suscripcion_push.length === 0 ) {return ;}

	console.log('notificationPayload', payload);

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
const sendPushNotificactionOneRepartidorTEST = function (req, res) {
	console.log('push test');
	const key_suscripcion_push = req.body.key_suscripcion_push;
	const _payload = req.body.payload || null;
	const tipo_msj = 0;	

	console.log('push key_push', key_suscripcion_push);
	// const key_suscripcion_push = Repartidor.key_suscripcion_push;	
	// const notificationPayload = payload;
	let payload;	
	if ( !_payload ) {
		switch (tipo_msj) {
	      case 0: // notifica a repartidor nuevo pedido
	      payload = {
			"notification": {
			        // "notification": {
			            "title": "Nuevo Pedido",
			            "body": `Te llego un pedido.`,
			            "icon": "./favicon.ico",
			            "lang": "es",
			            "vibrate": [100, 50, 100, 100, 100, 50 , 50, 100, 50, 100, 100, 100, 50 , 50, 100, 50, 100, 100, 100, 50 , 50, 100, 50, 100, 100, 100, 50 , 50, 100, 50, 100, 100, 100, 50 , 50, 100, 50, 100, 100, 100, 50 , 50, 100, 50, 100, 100, 100, 50 , 50, 100, 50, 100, 100, 100, 50 , 50, 100, 50, 100, 100, 100, 50 , 50]
			       //      ,"data": { 
        		// 				"url" : "http://reparto.papaya.com.pe/"
    						// }
			        }
			    // }
			}       
	        break;
	    }
	} else {
		payload = _payload;
	}

	

	if ( !key_suscripcion_push || key_suscripcion_push.length === 0 ) {return ;}

	console.log('notificationPayload', payload);
	
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