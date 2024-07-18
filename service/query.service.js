// service/util.service.js
let Sequelize = require('sequelize');
let config = require('../_config');
let sequelize = new Sequelize(config.database, config.username, config.password, config.sequelizeOption);

class QueryService {
    static async emitirRespuestaSP(query) {        
        try {
            const rows = await sequelize.query(query, { type: sequelize.QueryTypes.SELECT });
            return Object.values(rows[0]);
        } catch (err) {
            console.error(err);
            throw err;
        }
    }
}

module.exports = QueryService;