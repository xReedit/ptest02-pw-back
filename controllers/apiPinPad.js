// const { to, ReE, ReS }  = require('../service/uitl.service');
const socketPinPad = require('../controllers/socketPinPad');

const handlePinPadRequest = async (req, res, pinPadFunction) => {
    const { pinPadSN, transaction, idsede } = req.body;    
    let response;
    try {
        const payload = { pinPadSN, transaction, idsede };
        console.log('payload == ', payload);
        response = await pinPadFunction(payload);
        console.log('Respuesta recibida:', response);
    } catch (error) {
        console.error('Error:', error);
        return res.json({
            success: false,
            message: 'PinPad no disponible',
            error: error.message
        });
    }
    return res.json(response);
}

const checkServicesPinPad = (req, res) => handlePinPadRequest(req, res, socketPinPad.checkServicesPinPad);
const setUserPindPad = (req, res) => handlePinPadRequest(req, res, socketPinPad.setUserPindPad);
const loginPinPad = (req, res) => handlePinPadRequest(req, res, socketPinPad.loginPinPad);
const testPinPad = (req, res) => handlePinPadRequest(req, res, socketPinPad.testPinPad);
const transaccionPinPad = (req, res) => handlePinPadRequest(req, res, socketPinPad.transaccionPinPad);





module.exports = {
    setUserPindPad,
    loginPinPad,
    testPinPad,
    transaccionPinPad,
    checkServicesPinPad
};