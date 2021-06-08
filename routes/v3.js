// PWA-APP-PEDIDOS
let express = require("express");
let routerV3 = express.Router();

const apiPwaAppPedidos = require('../controllers/apiPwa_v1');
const apiPwaAppPedidosPago = require('../controllers/apiPago');
const apiPwaAppDelivery = require('../controllers/apiDelivery');
const apiPwaAppRepartidor = require('../controllers/apiRepartidor');
// const apiPwaPruebas = require('../controllers/apiPruebas');
const apiPwaAppComercio = require('../controllers/apiComercio');
const apiPwaAppMonitor = require('../controllers/apiMonitor');

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
routerV3.post('/pedido/printer-precuenta', auth.verificarToken, apiPwaAppPedidos.setPrinterOtherDocs);
routerV3.post('/pedido/lacuenta-zona-delivery', apiPwaAppPedidos.getLaCuenta);
routerV3.post('/pedido/register-scan', apiPwaAppPedidos.setRegisterScanQr);

// nuevo pedido 150920 // para evitar cortes del socket y el pedido no se registra
routerV3.post('/pedido/registrar-nuevo-pedido', apiPwaAppPedidos.setNuevoPedido2);
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
routerV3.post('/pedido/get-last-comsion-entrega-sede', apiPwaAppPedidos.getLastComisionEntrega);

// para buscar todos los clientes
routerV3.get('/pedido/get-all-clientes', auth.verificarToken, apiPwaAppPedidos.getAllClienteBySearch);
routerV3.post('/pedido/get-find-cliente-by-name', auth.verificarToken, apiPwaAppPedidos.getAllClienteBySearchName);

routerV3.post('/service/consulta-dni-ruc', auth.verificarToken, apiPwaAppPedidos.getConsultaDatosCliente);
routerV3.post('/service/consulta-dni-ruc-no-tk', apiPwaAppPedidos.getConsultaDatosClienteNoTk);


routerV3.post('/encuesta/la-encuesta', apiPwaAppPedidos.getEncuesta);
routerV3.post('/encuesta/las-opciones', apiPwaAppPedidos.getEncuestaOpRespuesta);
routerV3.post('/encuesta/guardar', apiPwaAppPedidos.setEncuestaGuardar);

routerV3.post('/pedido/calc-time-despacho', apiPwaAppPedidos.getCalcTimeDespacho);
routerV3.post('/pedido/search-subitems-del-item', apiPwaAppPedidos.getSearchSubitemsItem);

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
routerV3.post('/delivery/get-sede-servicio-express', apiPwaAppDelivery.getAllSedesServiceExpress);
routerV3.post('/delivery/set-pedido-mandado', apiPwaAppDelivery.setPedidoMandado);
routerV3.post('/delivery/get-comsion-atm', apiPwaAppDelivery.getComnisionAtm);
routerV3.post('/delivery/set-cash-atm', apiPwaAppDelivery.setCashAtm);
routerV3.post('/delivery/get-shared-url-carta', apiPwaAppDelivery.getSharedUrlCarta);


// mensajes
routerV3.post('/delivery/verificar-codigo-sms', apiPwaAppDelivery.verificarCodigoSMS);
routerV3.post('/delivery/send-sms-confirmation', auth.verificarTokenSms, apiPwaSMS.sendMsjConfirmacion);
routerV3.post('/delivery/send-push-test', apiPwaSMS.sendPushNotificactionOneRepartidorTEST);
routerV3.post('/delivery/send-sms-test', apiPwaSMS.sendMsjSMSNewPedido);
routerV3.post('/delivery/send-sms', apiPwaSMS.sendMsjSMS);
routerV3.post('/delivery/send-email', apiPwaSMS.sendEmailSendGrid);
routerV3.post('/delivery/send-email-ses', apiPwaSMS.sendEmailSendAWSSES);
routerV3.post('/delivery/send-msj-whatsapp', apiPwaSMS.sendMsjWhatsAp);
routerV3.post('/delivery/get-comercio-x-calificar', apiPwaAppDelivery.getComercioXCalificar);
routerV3.get('/delivery/get-tipo-vehiculo', apiPwaAppDelivery.getTipoVehiculo);
routerV3.get('/delivery/get-ciudades-delivery', apiPwaAppDelivery.getCiudadesDelivery);
routerV3.post('/delivery/get-calificacion-sede', apiPwaAppDelivery.getCalificacionSede);

// notificaciones push
// guardar suscripcion
routerV3.post('/push/suscripcion', apiPwaSMS.pushSuscripcion);
routerV3.post('/push/send-notification', apiPwaSMS.sendPushNotificaction);
	
// routerV3.post('/pago/set-data-transaction', apiPwaAppPedidos.setDataTransaction); // gurdamos datos de la transacion
// routerV3.post('/pago/get-data-transaction', apiPwaAppPedidos.getDataTransaction); // obtenemos datos de la transaccion


// routerV3.post('/info/getDataSede', apiPwaAppPedidos.getDataSede);



/// REPARTIDOR
/// REPARTIDOR

// login repartidor
routerV3.post('/login-usuario-autorizado-repartidor', login.loggerUsAutorizadoRepartidor);
routerV3.post('/repartidor/get-info', auth.verificarToken, apiPwaAppRepartidor.getInfo);

routerV3.post('/repartidor/push-suscripcion', auth.verificarToken, apiPwaAppRepartidor.pushSuscripcion);
routerV3.post('/repartidor/set-efectivo-mano', apiPwaAppRepartidor.setEfectivoMano);
routerV3.post('/repartidor/set-position-now', auth.verificarToken, apiPwaAppRepartidor.setPositionNow);
routerV3.post('/repartidor/set-asignar-pedido', auth.verificarToken, apiPwaAppRepartidor.setAsignarPedido);
routerV3.post('/repartidor/set-paso-pedido-va', auth.verificarToken, apiPwaAppRepartidor.setPasoVaPedido);
routerV3.post('/repartidor/get-estado-pedido', auth.verificarToken, apiPwaAppRepartidor.getEstadoPedido);
routerV3.post('/repartidor/set-fin-pedido-entregado', auth.verificarToken, apiPwaAppRepartidor.setFinPedidoEntregado);
routerV3.post('/repartidor/set-fin-pedido-express-entregado', auth.verificarToken, apiPwaAppRepartidor.setFinPedidoExpressEntregado);
routerV3.get('/repartidor/get-pedidos-entregados-dia', auth.verificarToken, apiPwaAppRepartidor.getPedidosEntregadoDia);
routerV3.get('/repartidor/get-pedidos-resumen-entregados-dia', auth.verificarToken, apiPwaAppRepartidor.getPedidosResumenEntregadoDia);
routerV3.get('/repartidor/get-repartidor-propio-mis-pedidos', auth.verificarToken, apiPwaAppRepartidor.getPropioPedidos);
routerV3.post('/repartidor/get-pedidos-recibidos-group', auth.verificarToken, apiPwaAppRepartidor.getPedidosRecibidosGroup);
routerV3.post('/repartidor/set-cambio-pass-repartidor', auth.verificarToken, apiPwaAppRepartidor.setCambioPassRepartidor);
// routerV3.get('/repartidor/get-view-event-new-pedido', apiPwaAppRepartidor.getIfPedidoNuevo);


routerV3.get('/repartidor/ruc-proceso-buscar-repartidor', apiPwaAppRepartidor.runLoopPrueba);



/// COMERCIO
/// COMERCIO
routerV3.post('/comercio/set-online', auth.verificarToken, apiPwaAppComercio.setOnline);
routerV3.post('/comercio/push-suscripcion', auth.verificarToken, apiPwaAppComercio.pushSuscripcion);
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
routerV3.get('/comercio/get-mis-repartidores', auth.verificarToken, apiPwaAppComercio.getMisRepartidores);
routerV3.post('/comercio/set-registrar-repartidor', auth.verificarToken, apiPwaAppComercio.setRegistrarRepartidor);
routerV3.post('/comercio/borrar-mi-repartidor', auth.verificarToken, apiPwaAppComercio.borrarMiReparidor);
routerV3.post('/comercio/set-flag-solicita-repartidor-papaya', auth.verificarToken, apiPwaAppComercio.setFlagSolicitaRepartidorPapaya);


// comercio registro
routerV3.get('/comercio/get-categoria-registro', apiPwaAppComercio.getCategoriasComercio);
routerV3.post('/comercio/registro-solicitud-comercio', apiPwaAppComercio.setRegistroSolicitud);


routerV3.post('/consulta/dni-ruc', auth.verificarToken, apiConsultaDniRuc.getConsultaDatosCliente);
routerV3.post('/consulta/registrar-cliente-nuevo', auth.verificarToken, apiConsultaDniRuc.setGuardarClienteNuevo);

routerV3.post('/service/facturacion-e', auth.verificarToken, apiServiceFacturacion.cocinarFactura);



//// MONITOR PACMAN ///
routerV3.post('/login-usuario-autorizado-pacman', login.loggerUsAutorizadoPacman);
routerV3.post('/monitor/get-idpedido-firts-date', auth.verificarToken, apiPwaAppMonitor.getFirtsIdPedidoDate);
routerV3.post('/monitor/get-pedidos', auth.verificarToken, apiPwaAppMonitor.getPedidos);
routerV3.post('/monitor/get-pedidos-abono', auth.verificarToken, apiPwaAppMonitor.getPedidosAbono);
routerV3.get('/monitor/get-repartidores', auth.verificarToken, apiPwaAppMonitor.getRepartidores);
routerV3.get('/monitor/get-clientes', auth.verificarToken, apiPwaAppMonitor.getCientes);
routerV3.get('/monitor/get-pedidos-pendientes', auth.verificarToken, apiPwaAppMonitor.getPedidosPendientesRepartidor);
routerV3.post('/monitor/get-clientes-scan-qr', auth.verificarToken, apiPwaAppMonitor.getCientesScanQr);
routerV3.post('/monitor/set-reset-repartidor', auth.verificarToken, apiPwaAppMonitor.setResetRepartidor);
routerV3.post('/monitor/set-liberar-repartidor', auth.verificarToken, apiPwaAppMonitor.setLiberarRepartidor);
routerV3.post('/monitor/set-check-liquidado', auth.verificarToken, apiPwaAppMonitor.setCheckLiquidado);
routerV3.post('/monitor/set-check-abonado', auth.verificarToken, apiPwaAppMonitor.setCheckAbonado);
routerV3.post('/monitor/set-check-abonado-repartidor', auth.verificarToken, apiPwaAppMonitor.setCheckAbonadoRepartidor);
routerV3.post('/monitor/get-repartidores-ciudad', auth.verificarToken, apiPwaAppMonitor.getRepartidoreCiudad);
routerV3.post('/monitor/set-asignar-pedido-manual', auth.verificarToken, apiPwaAppMonitor.setAsignarPedidoManual);
routerV3.get('/monitor/get-comercios-resumen', auth.verificarToken, apiPwaAppMonitor.getComerciosResumen);
routerV3.post('/monitor/set-registrar-pago', auth.verificarToken, apiPwaAppMonitor.setRegistraPagoComercio);
routerV3.post('/monitor/set-historial-pago', auth.verificarToken, apiPwaAppMonitor.setHistorialPagoComercio);
routerV3.get('/monitor/get-historial-pago', auth.verificarToken, apiPwaAppMonitor.getComerciosAfiliados);
routerV3.get('/monitor/get-repartidores-conectado', auth.verificarToken, apiPwaAppMonitor.getRepartidoresConectados);
routerV3.get('/monitor/get-repartidores-pedidos-asignados', auth.verificarToken, apiPwaAppMonitor.getRepartidoresPedidosAceptados);
routerV3.post('/monitor/get-comercio-calcular-pago', auth.verificarToken, apiPwaAppMonitor.getComercioCalcularPago);
routerV3.post('/monitor/set-sede-info', auth.verificarToken, apiPwaAppMonitor.setSedeInfo);
routerV3.post('/monitor/get-comercio-all-pedidos-cobrar', auth.verificarToken, apiPwaAppMonitor.getAllPedidosComercio);
routerV3.get('/monitor/get-all-sedes', auth.verificarToken, apiPwaAppMonitor.getAllSedes);
routerV3.post('/monitor/get-select-tipo-aplica', auth.verificarToken, apiPwaAppMonitor.getAplicaA);
routerV3.post('/monitor/set-registrar-descuento', auth.verificarToken, apiPwaAppMonitor.setRegistrarDescuento);
routerV3.post('/monitor/get-all-sedes-descuentos', auth.verificarToken, apiPwaAppMonitor.getAllDescuentosSede);
routerV3.post('/monitor/get-item-sedes-descuentos', auth.verificarToken, apiPwaAppMonitor.getItemDescuentosSede);
routerV3.post('/monitor/delete-item-sedes-descuentos', auth.verificarToken, apiPwaAppMonitor.deleteItemDescuentosSede);
routerV3.get('/monitor/get-sede-con-servicio-express', auth.verificarToken, apiPwaAppMonitor.getAllSedesServiceExpress);
routerV3.get('/monitor/get-tabla-precipitacion', auth.verificarToken, apiPwaAppMonitor.getTablaPrecipitacion);
routerV3.post('/monitor/set-importe-comsion-lluvia', auth.verificarToken, apiPwaAppMonitor.setImporteComisionLluvia);
routerV3.post('/monitor/get-pedidos-mandados', auth.verificarToken, apiPwaAppMonitor.getPedidosMandados);
routerV3.post('/monitor/set-options-plaza', auth.verificarToken, apiPwaAppMonitor.setOptionPlaza);
routerV3.get('/monitor/get-calificaciones-comercios', auth.verificarToken, apiPwaAppMonitor.getCalificacionComercio);
routerV3.post('/monitor/set-oncombercio', auth.verificarToken, apiPwaAppMonitor.setOnComercio);
routerV3.post('/monitor/get-retiros-cash-atm', auth.verificarToken, apiPwaAppMonitor.getRetirosCashAtm);
routerV3.post('/monitor/set-pedido-no-atendido', auth.verificarToken, apiPwaAppMonitor.setPedidoNoAntendido);
routerV3.get('/monitor/get-load-list-programations', auth.verificarToken, apiPwaAppMonitor.getlistProgramations);
routerV3.post('/monitor/run-timer-change-costo-delivery', auth.verificarToken, apiPwaAppMonitor.runTimerChangeCosto);



//// MONITOR ///


// test
routerV3.post('/delivery/test-hora', apiPwaAppDelivery.testHora);

// errores
routerV3.post('/error/set-error', apiPwaAppPedidos.setHistoryError);

module.exports = routerV3;