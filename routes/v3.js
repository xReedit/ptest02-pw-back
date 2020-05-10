// PWA-APP-PEDIDOS
let express = require("express");
let routerV3 = express.Router();

const apiPwaAppPedidos = require('../controllers/apiPwa_v1');
const apiPwaAppPedidosPago = require('../controllers/apiPago');
const apiPwaAppDelivery = require('../controllers/apiDelivery');
const apiPwaAppRepartidor = require('../controllers/apiRepartidor');
const apiPwaPruebas = require('../controllers/apiPruebas');
const apiPwaAppComercio = require('../controllers/apiComercio');
const apiConsultaDniRuc = require('../controllers/apiConsultaDniRuc');
const apiServiceFacturacion = require('../controllers/serviceFacturacion');
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
routerV3.post('/pedido/lacuenta-zona-delivery', apiPwaAppPedidos.getLaCuenta);
//  para usuario autorizado - colaboradores --->>

// para usuario cliente
routerV3.post('/ini/info-sede', apiPwaAppPedidos.getDataSedeIni);
routerV3.post('/ini/info-sede-gps', apiPwaAppPedidos.getSedeRequiereGPS);
routerV3.get('/ini/reglas-app', apiPwaAppPedidos.getReglasApp);
routerV3.post('/ini/login-cliente-dni', apiPwaAppPedidos.getUsuarioClietenByDNI);

routerV3.post('/pedido/lacuenta-cliente', apiPwaAppPedidos.getLaCuentaFromCliente);
routerV3.post('/pedido/lacuenta-cliente-totales', apiPwaAppPedidos.getLaCuentaFromClienteTotales);
routerV3.post('/pedido/lacuenta-pedido-totales', apiPwaAppPedidos.getLaCuentaFromPedidoTotales);
routerV3.get('/pedido/get-const-delivery-items-escala', apiPwaAppPedidos.getConsAppDelivery);

routerV3.post('/service/consulta-dni-ruc', auth.verificarToken, apiPwaAppPedidos.getConsultaDatosCliente);


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
routerV3.post('/delivery/calificar-servicio', apiPwaAppDelivery.setCalificarServicio);
routerV3.get('/delivery/get-categorias', apiPwaAppDelivery.getCategorias);


// mensajes
routerV3.post('/delivery/verificar-codigo-sms', apiPwaAppDelivery.verificarCodigoSMS);
routerV3.post('/delivery/send-sms-confirmation', auth.verificarTokenSms, apiPwaSMS.sendMsjConfirmacion);
routerV3.post('/delivery/send-push-test', apiPwaSMS.sendPushNotificactionOneRepartidorTEST);

// notificaciones push
// guardar suscripcion
routerV3.post('/push/suscripcion', apiPwaSMS.pushSuscripcion);
routerV3.post('/push/send-notification', apiPwaSMS.sendPushNotificaction);
	
// routerV3.post('/pago/set-data-transaction', apiPwaAppPedidos.setDataTransaction); // gurdamos datos de la transacion
// routerV3.post('/pago/get-data-transaction', apiPwaAppPedidos.getDataTransaction); // obtenemos datos de la transaccion


// routerV3.post('/info/getDataSede', apiPwaAppPedidos.getDataSede);



/// REPARTIDOR
/// REPARTIDOR

// login 
routerV3.post('/login-usuario-autorizado-repartidor', login.loggerUsAutorizadoRepartidor);

routerV3.post('/repartidor/push-suscripcion', auth.verificarToken, apiPwaAppRepartidor.pushSuscripcion);
routerV3.post('/repartidor/set-efectivo-mano', auth.verificarToken, apiPwaAppRepartidor.setEfectivoMano);
routerV3.post('/repartidor/set-position-now', auth.verificarToken, apiPwaAppRepartidor.setPositionNow);
routerV3.post('/repartidor/set-asignar-pedido', auth.verificarToken, apiPwaAppRepartidor.setAsignarPedido);
routerV3.post('/repartidor/get-estado-pedido', auth.verificarToken, apiPwaAppRepartidor.getEstadoPedido);
routerV3.post('/repartidor/set-fin-pedido-entregado', auth.verificarToken, apiPwaAppRepartidor.setFinPedidoEntregado);
routerV3.get('/repartidor/get-pedidos-entregados-dia', auth.verificarToken, apiPwaAppRepartidor.getPedidosEntregadoDia);
routerV3.get('/repartidor/get-pedidos-resumen-entregados-dia', auth.verificarToken, apiPwaAppRepartidor.getPedidosResumenEntregadoDia);
routerV3.get('/repartidor/get-repartidor-propio-mis-pedidos', auth.verificarToken, apiPwaAppRepartidor.getPropioPedidos);


routerV3.get('/repartidor/ruc-proceso-buscar-repartidor', apiPwaAppRepartidor.runLoopPrueba);


// pruebas
routerV3.get('/comercio/get-sin-token', apiPwaAppComercio.getSinToken);
routerV3.get('/pruebas/get-sin-token-procedure', apiPwaPruebas.getProcedure);
routerV3.get('/pruebas/get-categorias-pruebas', apiPwaAppComercio.getCategoriasComercio);
// get con token
routerV3.get('/pruebas/get-con-token', auth.verificarToken, apiPwaAppComercio.getProcedure);
// get con select sin token
routerV3.get('/pruebas/get-con-select-sin-token', apiPwaPruebas.getSinToken);
// put sin token
routerV3.post('/repartidor/put-sin-token', apiPwaAppRepartidor.getSinToken);
// put con token
routerV3.post('/repartidor/put-con-token', auth.verificarToken, apiPwaAppRepartidor.putSinToken);



/// COMERCIO
/// COMERCIO
routerV3.post('/comercio/set-online', auth.verificarToken, apiPwaAppComercio.setOnline);
routerV3.post('/comercio/get-pedidos-pendientes', auth.verificarToken, apiPwaAppComercio.getOrdenesPedientes);
routerV3.post('/comercio/get-pedido-by-id', auth.verificarToken, apiPwaAppComercio.getOrdenesByid);
routerV3.post('/comercio/set-estado-pedido', auth.verificarToken, apiPwaAppComercio.setEstadoPedido);
routerV3.post('/comercio/set-pwa-facturado', auth.verificarToken, apiPwaAppComercio.setPwaFacturado);
routerV3.get('/comercio/get-comercio-repartidor-suscrito', auth.verificarToken, apiPwaAppComercio.getComercioRepartidorSuscrito);
routerV3.get('/comercio/get-tipo-comprobantes', auth.verificarToken, apiPwaAppComercio.getTipoComprobante);
routerV3.get('/comercio/get-datos-impresion', auth.verificarToken, apiPwaAppComercio.getDatosImpresion);
routerV3.get('/comercio/get-tipo-pago', auth.verificarToken, apiPwaAppComercio.getTiposPago);
routerV3.post('/comercio/set-registrar-pago-pedido-comercio', auth.verificarToken, apiPwaAppComercio.setRegistrarPago);
routerV3.post('/comercio/set-repartidor-to-pedido', auth.verificarToken, apiPwaAppComercio.setRepartidorToPedido);
routerV3.get('/comercio/get-data-cierre-caja', auth.verificarToken, apiPwaAppComercio.getDataCierreCaja);


// comercio registro
routerV3.get('/comercio/get-categoria-registro', apiPwaAppComercio.getCategoriasComercio);
routerV3.post('/comercio/registro-solicitud-comercio', apiPwaAppComercio.setRegistroSolicitud);


routerV3.post('/consulta/dni-ruc', auth.verificarToken, apiConsultaDniRuc.getConsultaDatosCliente);
routerV3.post('/consulta/registrar-cliente-nuevo', auth.verificarToken, apiConsultaDniRuc.setGuardarClienteNuevo);

routerV3.post('/service/facturacion-e', auth.verificarToken, apiServiceFacturacion.cocinarFactura);

module.exports = routerV3;