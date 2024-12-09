let express = require("express");
let routerPinPad = express.Router();

const apiPinPad = require('../controllers/apiPinPad');

routerPinPad.get('/', function (req, res, next) {	
	res.json({
		status: "success",
		message: "API V3 - routerPinPad",
		data: {
			"version_number": "v1.0.0"
		}
	})
});

routerPinPad.post('/check', apiPinPad.checkServicesPinPad);
routerPinPad.post('/setuser', apiPinPad.setUserPindPad);
routerPinPad.post('/login', apiPinPad.loginPinPad);
routerPinPad.post('/test', apiPinPad.testPinPad);
routerPinPad.post('/transaccion', apiPinPad.transaccionPinPad);
routerPinPad.post('/remove', apiPinPad.transaccionPinPad);


module.exports = routerPinPad;