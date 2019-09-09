const { to, ReE, ReS } = require('../service/uitl.service');
let jwt = require('jsonwebtoken');
const SEED = require('../config').SEED;

exports.verificarToken = function (req, res, next) {
        var token = req.headers.authorization; //req.query.token ;

        jwt.verify(token, SEED, (err, decode) => {
                if (err) {                        
                        return ReE(res, 'Token incorrecto.', 401);                                
                }

                req.usuariotoken = decode.usuario;                
                next();
        });
        // next();
}