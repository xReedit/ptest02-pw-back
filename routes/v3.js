// PWA-APP-PEDIDOS
let express = require("express");
let routerV3 = express.Router();

const apiPwaAppPedidos = require('../controllers/apiPwa_v1');
const apiPwaAppPedidosPago = require('../controllers/apiPago');
const apiPwaAppDelivery = require('../controllers/apiDelivery');
const apiPwaSMS = require('../controllers/sendMsj');
const login = require('../controllers/login');
const auth = require('../middleware/autentificacion');

routerV3.get('/', function (req, res, next) {
	res.json({
		status: "success",
		message: "API V3",
		data: {
			"version_number": "v1.0.0"
		}
	})
});

// PWA-APP PEDIDO //
// PWA-APP PEDIDO //

// para usuario autorizado - colaboradores --->>>
routerV3.post('/login-usuario-autorizado', login.loggerUsAutorizado);
routerV3.post('/verificarToken', auth.verificarToken);
routerV3.post('/pedido/lacuenta', auth.verificarToken, apiPwaAppPedidos.getLaCuenta);
routerV3.post('/service/consulta-dni-ruc', auth.verificarToken, apiPwaAppPedidos.getConsultaDatosCliente);
//  para usuario autorizado - colaboradores --->>

// para usuario cliente
routerV3.post('/ini/info-sede', apiPwaAppPedidos.getDataSedeIni);
routerV3.post('/ini/info-sede-gps', apiPwaAppPedidos.getSedeRequiereGPS);
routerV3.get('/ini/reglas-app', apiPwaAppPedidos.getReglasApp);
routerV3.post('/ini/login-cliente-dni', apiPwaAppPedidos.getUsuarioClietenByDNI);

routerV3.post('/pedido/lacuenta-cliente', apiPwaAppPedidos.getLaCuentaFromCliente);
routerV3.post('/pedido/lacuenta-cliente-totales', apiPwaAppPedidos.getLaCuentaFromClienteTotales);

routerV3.post('/encuesta/la-encuesta', apiPwaAppPedidos.getEncuesta);
routerV3.post('/encuesta/las-opciones', apiPwaAppPedidos.getEncuestaOpRespuesta);
routerV3.post('/encuesta/guardar', apiPwaAppPedidos.setEncuestaGuardar);

routerV3.post('/pedido/calc-time-despacho', apiPwaAppPedidos.getCalcTimeDespacho);

routerV3.post('/ini/register-cliente-login', apiPwaAppPedidos.setRegisterClienteLogin);

// cliente profile
routerV3.post('/cliente/perfil', apiPwaAppPedidos.getClientePerfil);
routerV3.post('/cliente/perfil-save', apiPwaAppPedidos.setClientePerfil);
routerV3.post('/cliente/new-direccion', apiPwaAppPedidos.setClienteNewDireccion);


// pago
routerV3.get('/transaction/get-purchasenumber', apiPwaAppPedidosPago.getPurchasenumber); // gurdamos datos de la transacion
routerV3.post('/transaction/get-email-client', apiPwaAppPedidosPago.getEmailClient);
routerV3.post('/transaction/registrar-pago', apiPwaAppPedidosPago.setRegistrarPago);


// delivery
routerV3.post('/delivery/get-establecimientos', apiPwaAppDelivery.getEstablecimientos);
routerV3.post('/delivery/get-direccion-cliente', apiPwaAppDelivery.getDireccionCliente);
routerV3.post('/delivery/get-mis-pedidos', apiPwaAppDelivery.getMisPedido);
routerV3.post('/delivery/verificar-codigo-sms', apiPwaAppDelivery.verificarCodigoSMS);

// mensajes
routerV3.post('/delivery/send-sms-confirmation', auth.verificarTokenSms, apiPwaSMS.sendMsjConfirmacion);
	
// routerV3.post('/pago/set-data-transaction', apiPwaAppPedidos.setDataTransaction); // gurdamos datos de la transacion
// routerV3.post('/pago/get-data-transaction', apiPwaAppPedidos.getDataTransaction); // obtenemos datos de la transaccion


// routerV3.post('/info/getDataSede', apiPwaAppPedidos.getDataSede);


module.exports = routerV3;