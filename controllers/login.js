const { to, ReE, ReS } = require('../service/uitl.service');
// let bcrypt = require('bcryptjs'); //password
let jwt = require('jsonwebtoken');
const SEED = require('../_config').SEED;
const loggerPino = require('../utilitarios/logger');

// ✅ IMPORTANTE: Usar instancia centralizada de Sequelize (mejor rendimiento)
// const sequelize = require('../config/database');
// const { Sequelize } = require('sequelize');
const QueryServiceV1 = require('../service/query.service.v1');

const init = async function (req, res) {
        return ReS(res, { message: 'hello desde LA API GENERAL 2 INIT version 1' });
}
module.exports.init = init;


const logger = async function (req, res) {
        try {
                const usuario = req.body.nomusuario;
                const pass = req.body.pass;
                
                // ✅ SEGURO: Prepared statement previene SQL Injection
                const read_query = `SELECT u.* FROM usuario u 
                        INNER JOIN sede s ON u.idsede = s.idsede 
                        LEFT JOIN sede_estado se ON s.idsede = se.idsede 
                        WHERE u.usuario = ? 
                        AND POSITION('A2' IN u.acc) > 0 
                        AND u.estado = 0 
                        AND (se.idsede IS NULL OR (se.is_bloqueado = 0 AND se.is_baja = 0)) 
                        AND u.estadistica = 1`;

                // const rows = await sequelize.query(read_query, { 
                //         replacements: [usuario],
                //         type: sequelize.QueryTypes.SELECT 
                // });

                const rows = await QueryServiceV1.ejecutarConsulta(read_query, [usuario], 'SELECT', 'logger');
                
                // ✅ Validar que el usuario exista
                if (!rows || rows.length === 0) {
                        return ReE(res, 'Credenciales Incorrectas.');
                }

                // TODO: Activar bcrypt en siguiente paso
                const result = pass === rows[0].pass; //bcrypt.compareSync(pass, rows[0].password);                        
                if (!result) {
                        return ReE(res, 'Credenciales Incorrectas.');
                }

                rows[0].pass = ':)';
                const token = jwt.sign({ usuario: rows[0] }, SEED, { expiresIn: 14400 });

                return ReS(res, { usuario: rows[0], token: token });

        } catch (err) {
                loggerPino.error({ err, usuario: req.body.nomusuario }, 'Error en login');
                return ReE(res, 'Error al procesar login', 500);
        }
}

module.exports.logger = logger;


// pwa-app-pedido
const loggerUsAutorizado = async function (req, res) {
        try {
                const usuario = req.body.nomusuario;
                const pass = req.body.pass;

                // ✅ SEGURO: Prepared statement previene SQL Injection
                const read_query = `SELECT u.*, s.is_holding, s.is_mozo_accept_payments 
                        FROM usuario u 
                        INNER JOIN sede s ON u.idsede = s.idsede 
                        LEFT JOIN sede_estado se ON s.idsede = se.idsede 
                        WHERE u.usuario = ? 
                        AND POSITION('A2' IN u.acc) > 0 
                        AND u.estado = 0 
                        AND (se.idsede IS NULL OR (se.is_bloqueado = 0 AND se.is_baja = 0))`;

                // const rows = await sequelize.query(read_query, { 
                //         replacements: [usuario],
                //         type: sequelize.QueryTypes.SELECT 
                // });

                const rows = await QueryServiceV1.ejecutarConsulta(read_query, [usuario], 'SELECT', 'loggerUsAutorizado');
                
                // ✅ Validar que el usuario exista
                if (!rows || rows.length === 0) {
                        return ReE(res, 'Credenciales Incorrectas.');
                }

                // TODO: Activar bcrypt en siguiente paso
                const result = pass === rows[0].pass; //bcrypt.compareSync(pass, rows[0].password);                        
                if (!result) {
                        return ReE(res, 'Credenciales Incorrectas.');
                }

                var p = rows[0].pass;
                p = Buffer.from(p).toString('base64');                        
                rows[0].pass = p;
                
                const token = jwt.sign({ usuario: rows[0] }, SEED, { expiresIn: '2d' });

                return ReS(res, { usuario: rows[0], token: token });

        } catch (err) {
                loggerPino.error({ err, usuario: req.body.nomusuario }, 'Error en login autorizado');
                return ReE(res, 'Error al procesar login', 500);
        }
}

module.exports.loggerUsAutorizado = loggerUsAutorizado;



const loggerUsAutorizadoRepartidor = async function (req, res) {
        try {
                const usuario = req.body.nomusuario;
                const pass = req.body.pass;
                
                // ✅ SEGURO: Prepared statement previene SQL Injection
                const read_query = `SELECT idrepartidor, nombre, apellido, ciudad, usuario, pass, idsede_suscrito, telefono  
                        FROM repartidor 
                        WHERE usuario = ? 
                        AND estado = 0`;

                // const rows = await sequelize.query(read_query, { 
                //         replacements: [usuario],
                //         type: sequelize.QueryTypes.SELECT 
                // });

                loggerPino.debug({ usuario }, 'Login repartidor');

                const rows = await QueryServiceV1.ejecutarConsulta(read_query, [usuario], 'SELECT', 'loggerUsAutorizadoRepartidor');

                loggerPino.debug({ rows }, 'respuesta Login repartidor');
                
                // ✅ Validar que el repartidor exista
                if (!rows || rows.length === 0) {
                        return ReE(res, 'Credenciales Incorrectas.');
                }

                // TODO: Activar bcrypt en siguiente paso
                const result = pass === rows[0].pass; //bcrypt.compareSync(pass, rows[0].password);                        
                if (!result) {
                        return ReE(res, 'Credenciales Incorrectas.');
                }

                var p = rows[0].pass;
                p = Buffer.from(p).toString('base64');                        
                rows[0].pass = p;
                
                const token = jwt.sign({ usuario: rows[0] }, SEED, { expiresIn: '2d'});

                return ReS(res, { usuario: rows[0], token: token });

        } catch (err) {
                loggerPino.error({ err, usuario: req.body.nomusuario }, 'Error en login repartidor');
                return ReE(res, 'Error al procesar login', 500);
        }
}

module.exports.loggerUsAutorizadoRepartidor = loggerUsAutorizadoRepartidor;



// pwa-app-pedido
const loggerUsAutorizadoPacman = async function (req, res) {
        try {
                const usuario = req.body.nomusuario;
                const pass = req.body.pass;

                // ✅ SEGURO: Prepared statement previene SQL Injection
                const read_query = `SELECT * FROM usuario 
                        WHERE usuario = ? 
                        AND pacman = 1 
                        AND estado = 0`;

                // const rows = await sequelize.query(read_query, { 
                //         replacements: [usuario],
                //         type: sequelize.QueryTypes.SELECT 
                // });

                const rows = await QueryServiceV1.ejecutarConsulta(read_query, [usuario], 'SELECT', 'loggerUsAutorizadoPacman');
                
                // ✅ Validar que el usuario exista
                if (!rows || rows.length === 0) {
                        return ReE(res, 'Credenciales Incorrectas.');
                }

                // TODO: Activar bcrypt en siguiente paso
                const result = pass === rows[0].pass; //bcrypt.compareSync(pass, rows[0].password);                        
                if (!result) {
                        return ReE(res, 'Credenciales Incorrectas.');
                }

                var p = rows[0].pass;
                p = Buffer.from(p).toString('base64');                        
                rows[0].pass = p;
                
                const token = jwt.sign({ usuario: rows[0] }, SEED, { expiresIn: '2d' });

                return ReS(res, { usuario: rows[0], token: token });

        } catch (err) {
                loggerPino.error({ err, usuario: req.body.nomusuario }, 'Error en login pacman');
                return ReE(res, 'Error al procesar login', 500);
        }
}

module.exports.loggerUsAutorizadoPacman = loggerUsAutorizadoPacman;


const loggerUsPrintServer = async function (req, res) {
        const usuario = req.body.nomusuario;
        const pass = req.body.pass;

        const sql = `select u.idorg, u.idsede, u.usuario nom_usuario, s.nombre nom_sede, u.pass, s.show_chatbot, s.chatbot_run from usuario u 
                        inner join sede s using(idsede) WHERE u.usuario = ? AND u.estado = 0 and s.estado=0`;

        const rows = await QueryServiceV1.ejecutarConsulta(sql, [usuario], 'SELECT', 'loggerUsPrintServer');
        

        // ✅ Validar que el usuario exista
        if (!rows || rows.length === 0) {
                return ReE(res, 'Credenciales Incorrectas.');
        }

        // TODO: Activar bcrypt en siguiente paso
        const result = pass === rows[0].pass; //bcrypt.compareSync(pass, rows[0].password);                        
        if (!result) {
                return ReE(res, 'Credenciales Incorrectas.');
        }

        var p = rows[0].pass;
        p = Buffer.from(p).toString('base64');
        rows[0].pass = p;

        const token = jwt.sign({ usuario: rows[0] }, SEED, { expiresIn: '1d' });

        return ReS(res, { usuario: rows[0], token: token });

}

module.exports.loggerUsPrintServer = loggerUsPrintServer;

