const { to, ReE, ReS } = require('../service/uitl.service');
let jwt = require('jsonwebtoken');
const SEED = require('../config').SEED;
const SEED_SMS = require('../config').SEED_SMS;

exports.verificarToken = function (req, res, next) {
        var token = req.headers.authorization; //req.query.token ;

        jwt.verify(token, SEED, (err, decode) => {
                if (err) {                        
                        return ReE(res, 'Token incorrecto.', 401);                                
                }

                console.log('decode', decode);
                req.usuariotoken = decode.usuario;                
                next();
        });
        // next();
}


exports.verificarTokenSms = function (req, res, next) {
        var token = req.headers.authorization; //req.query.token ;

        jwt.verify(token, SEED_SMS, (err, decode) => {
                if (err) {                        
                        return ReE(res, 'Token incorrecto.', 401);                                
                }

                // req.usuariotoken = decode.usuario;                
                next();
        });
        // next();
}