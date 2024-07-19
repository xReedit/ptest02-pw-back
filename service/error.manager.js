let config = require('../_config');
let Sequelize = require('sequelize');
let sequelize = new Sequelize(config.database, config.username, config.password, config.sequelizeOption);


// registrar errores
const logError = function (payload) {
    const data = payload;
    try {        
        let errorString = JSON.stringify(data);        
        errorString = errorString.replace(/'/g, "\\'");
        const query = `INSERT INTO historial_error (error, origen, fecha) VALUES ('${errorString}', '${data.origen}', NOW())`;
        console.log(query);
            
        sequelize.query(query, { type: sequelize.QueryTypes.INSERT })
            // .then(function (rows) {
            //     console.log('Error logged successfully');
            // })
            // .catch((err) => { console.error('Error logging error:', err); });
    } catch (error) {
        
        console.error('Error logging error:', error);        
    }
}
module.exports.logError = logError;


// const logError = function (payload) {
//     const data = payload;
    
//     const query = `INSERT INTO historial_error (error, origen, fecha) VALUES (:error, :origen, NOW())`;

//     sequelize.query(query, { 
//         replacements: { error: data, origen: data.origen },
//         type: QueryTypes.INSERT 
//     })
//     .then(function (rows) {
//         console.log('Error logged successfully');
//     })
//     .catch((err) => { console.error('Error logging error:', err); });
// }
// module.exports.logError = logError;