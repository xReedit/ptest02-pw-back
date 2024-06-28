let config = require('../_config');
let {Sequelize, QueryTypes} = require('sequelize');
let sequelize = new Sequelize(config.database, config.username, config.password, config.sequelizeOption);


// registrar errores
const logError = function (payload) {
    const data = payload;
    
    const errorString = JSON.stringify(data);
    const query = `INSERT INTO historial_error (error, origen, fecha) VALUES ('${errorString}', '${data.origen}', NOW())`;
    
    sequelize.query(query, { type: QueryTypes.INSERT })
        .then(function (rows) {
            console.log('Error logged successfully');
        })
        .catch((err) => { console.error('Error logging error:', err); });
}
module.exports.logError = logError;