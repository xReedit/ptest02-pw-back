let express = require("express");
let routerHolding = express.Router();

const apiHolding = require('../controllers/apiHolding');

routerHolding.get('/', function (req, res, next) {	
    res.json({
        status: "success",
        message: "API V3 - routerHolding",
        data: {
            "version_number": "v1.0.0"
        }
    })
});

routerHolding.post('/get-marcas', apiHolding.getMarcas);
routerHolding.post('/get-holding-by-idsede', apiHolding.getHoldingByIdSede);
routerHolding.post('/set-suscription-push-cliente', apiHolding.saveSuscripcionCliente);
routerHolding.post('/set-table-number', apiHolding.setTableNumber);

routerHolding.get('/get-metodo-pago-mozo', apiHolding.getMetodoPagoMozo);
routerHolding.get('/get-pedido-by-order-code', apiHolding.getPedidoClienteByOrdeCode);
routerHolding.post('/guardar-pedido-cliente-holding', apiHolding.setSavePedidoClienteHolding);
routerHolding.post('/get-pedido-cliente-by-holding', apiHolding.getPedidoClienteByHolding);
routerHolding.post('/set-marcar-pedido-cliente-holding-atendido', apiHolding.setPedidoClienteAtendido);
routerHolding.post('/get-usuario-pedido-cliente-holding', apiHolding.getUsuarioAceptePedidoClienteHolding);
routerHolding.post('/set-marcar-pedido-cliente-holding-pagado', apiHolding.setPedidoClientePagado);
routerHolding.post('/get-verify-pedido-cliente-pagado', apiHolding.getVerifyPedidoClienteMarcadoPagado);


module.exports = routerHolding;