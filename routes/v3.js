// PWA-APP-PEDIDOS
let express = require("express");
let routerV3 = express.Router();

const apiPwaAppPedidos = require('../controllers/apiPwa_v1');
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
routerV3.get('/ini/reglas-app', apiPwaAppPedidos.getReglasApp);
routerV3.post('/pedido/lacuenta-cliente', apiPwaAppPedidos.getLaCuentaFromCliente);
routerV3.post('/pedido/lacuenta-cliente-totales', apiPwaAppPedidos.getLaCuentaFromClienteTotales);

routerV3.post('/pedido/calc-time-despacho', apiPwaAppPedidos.getCalcTimeDespacho);

routerV3.post('/ini/register-cliente-login', apiPwaAppPedidos.setRegisterClienteLogin);
// routerV3.post('/info/getDataSede', apiPwaAppPedidos.getDataSede);


module.exports = routerV3;