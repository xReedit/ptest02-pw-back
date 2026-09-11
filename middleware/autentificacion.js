const { to, ReE, ReS } = require('../service/uitl.service');
let jwt = require('jsonwebtoken');
// const SEED = require('../config').SEED;
const SEED = require('../_config').SEED;
// SEED_SMS quedo sin uso al borrar verificarTokenSms en el sprint 5 (rutas de SMS muertas).

exports.verificarToken = function (req, res, next) {
        var token = req.headers.authorization; //req.query.token ;

        jwt.verify(token, SEED, (err, decode) => {
                if (err) {                        
                        return ReE(res, 'Token incorrecto.', 401);                                
                }                

                // console.log('decode', decode);
                req.usuariotoken = decode.usuario;                
                next();
        });
        // next();
}

// 112023
exports.validarTokenExperidado = function (req, res, next) {
        var token = req.headers.authorization; //req.query.token ;

        jwt.verify(token, SEED, (err, decode) => {
                if (err) {                        
                        return ReE(res, 'Token incorrecto.', 401);                                
                }       

                return ReS(res, {                        
                        token: token
                });         

                // console.log('decode', decode);
                // req.usuariotoken = decode.usuario;                
                // next();
        });
        // next();
}
