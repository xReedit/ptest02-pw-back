const { to, ReE, ReS } = require('../service/uitl.service');
let jwt = require('jsonwebtoken');
// const SEED = require('../config').SEED;
const SEED = require('../_config').SEED;
const { sedeHabilitada, MENSAJE_SEDE_BLOQUEADA } = require('../service/sede-estado.service');
// SEED_SMS quedo sin uso al borrar verificarTokenSms en el sprint 5 (rutas de SMS muertas).

exports.verificarToken = function (req, res, next) {
        var token = req.headers.authorization; //req.query.token ;

        jwt.verify(token, SEED, (err, decode) => {
                if (err) {                        
                        return ReE(res, 'Token incorrecto.', 401);                                
                }                

                // Sede bloqueada o dada de baja: el token deja de servir (401 → las apps cierran sesión).
                sedeHabilitada(decode.usuario?.idsede).then((ok) => {
                        if (!ok) return ReE(res, MENSAJE_SEDE_BLOQUEADA, 401);
                        req.usuariotoken = decode.usuario;
                        next();
                });
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

                return sedeHabilitada(decode.usuario?.idsede).then((ok) =>
                        ok ? ReS(res, { token: token }) : ReE(res, MENSAJE_SEDE_BLOQUEADA, 401)
                );

                // console.log('decode', decode);
                // req.usuariotoken = decode.usuario;                
                // next();
        });
        // next();
}
