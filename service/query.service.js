// service/util.service.js
let Sequelize = require('sequelize');
let config = require('../_config');
let sequelize = new Sequelize(config.database, config.username, config.password, config.sequelizeOption);

const logger = require('../utilitarios/logger');

class QueryService {
    
    static emitirRespuesta = async (xquery) => {
        // console.log(xquery);
        try {
            return await sequelize.query(xquery, { type: sequelize.QueryTypes.SELECT });
        } catch (err) {
            logger.error(err);
            return false;
        }
    };

    // procesar solicitud update
    static emitirRespuesta_UPDATE = async (xquery) => {
        // console.log(xquery);
        try {
            return await sequelize.query(xquery);
        } catch (err) {
            logger.error(err);
            return false;
        }
    };


    static async emitirRespuestaSP(query) {        
        try {
            const rows = await sequelize.query(query, { type: sequelize.QueryTypes.SELECT });
            return Object.values(rows[0]);
        } catch (err) {
            logger.error(err);
            throw err;
        }
    }

    static async emitirRespuestaSP_RAW(query, params = []) {
        try {
            const [results] = await sequelize.query(query, {
                replacements: params,
                type: sequelize.QueryTypes.RAW
            });
            // Asegurar que la respuesta sea un array
            if (!Array.isArray(results)) {
                return [results];
            }

            // Si está vacío, devolver array con objeto vacío
            if (results.length === 0) {
                return [{}];
            }

            // Retornar los resultados
            return results;
        } catch (error) {
            logger.error('Error en emitirRespuestaSP_RAW:', error);
            throw error;
        }
    }
}

module.exports = QueryService;