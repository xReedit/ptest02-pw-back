// var SequelizeAuto = require('sequelize-auto')
// let config = require('../config');

// var auto = new SequelizeAuto(config.database, config.username, config.password, config.sequelizeOption);

// auto.run(function (err) {
//         if (err) throw err;

//         console.log(auto.tables); // table list
//         console.log(auto.foreignKeys); // foreign key list
// });


'use strict';

var fs = require('fs');
var path = require('path');
var Sequelize = require('sequelize');
var basename = path.basename(__filename);
var env = process.env.NODE_ENV || 'development';
// var config = require(__dirname + '/../config/config.js')[env];
let config = require('../config');
var db = {};

var sequelize = new Sequelize(config.database, config.username, config.password, config.sequelizeOption);

fs
        .readdirSync(__dirname)
        .filter(file => {
                return (file.indexOf('.') !== 0) && (file !== basename) && (file.slice(-3) === '.js');
        })
        .forEach(file => {
                var model = sequelize['import'](path.join(__dirname, file));
                db[model.name] = model;
        });

Object.keys(db).forEach(modelName => {
        if (db[modelName].associate) {
                db[modelName].associate(db);
        }
});

db['prueba'].belongsTo(db['test'], { foreignKey: "idtest" });

db['sede'].belongsTo(db['org'], { foreignKey: "idorg" });

db['categoria'].belongsTo(db['org'], { foreignKey: "idorg" });
db['categoria'].belongsTo(db['sede'], { foreignKey: "idsede" });

db['almacen'].belongsTo(db['org'], { foreignKey: "idorg" });
db['almacen'].belongsTo(db['sede'], { foreignKey: "idsede" });

db['cliente'].belongsTo(db['org'], { foreignKey: "idorg" });
db['cliente'].belongsTo(db['sede'], { foreignKey: "idsede" });
// db['cliente'].hasMany(db['cliente_linea_credito'], { foreignKey: "idcliente" });

db['marca'].belongsTo(db['org'], { foreignKey: "idorg" });
db['marca'].belongsTo(db['sede'], { foreignKey: "idsede" });

db['usuario'].belongsTo(db['org'], { foreignKey: "idorg" });
db['usuario'].belongsTo(db['sede'], { foreignKey: "idsede" });


db['producto'].belongsTo(db['org'], { foreignKey: "idorg" });
db['producto'].belongsTo(db['sede'], { foreignKey: "idsede" });
db['producto'].belongsTo(db['categoria'], { foreignKey: "idcategoria", as: 'categoria' });
db['producto'].belongsTo(db['marca'], { foreignKey: "idmarca" });
db['producto'].hasMany(db['producto_detalle'], { foreignKey: "idproducto" });


db['producto_detalle'].belongsTo(db['talla'], { foreignKey: "idtalla" });
db['producto_detalle'].belongsTo(db['producto'], { foreignKey: "idproducto" });

db['producto_stock'].belongsTo(db['producto_detalle'], { foreignKey: "idproducto_detalle" });
db['producto_stock'].belongsTo(db['almacen'], { foreignKey: "idalmacen" });

db['distribuicion'].belongsTo(db['almacen'], { as: 'a_idalmacen', foreignKey: "idalmacen_a" });
db['distribuicion'].belongsTo(db['almacen'], { as: 'd_idalmacen', foreignKey: "idalmacen_d" });
db['distribuicion'].belongsTo(db['usuario'], { foreignKey: "idusuario" });
db['distribuicion'].hasMany(db['distribuicion_detalle'], {foreignKey: "iddistribuicion"});

db['registro_pago'].belongsTo(db['org'], { foreignKey: "idorg" });
db['registro_pago'].belongsTo(db['sede'], { foreignKey: "idsede" });
db['registro_pago'].belongsTo(db['usuario'], { foreignKey: "idusuario" });
db['registro_pago'].belongsTo(db['cliente'], { foreignKey: "idcliente" });
db['registro_pago'].hasMany(db['registro_pago_detalle'], { foreignKey: "idregistro_pago" });

db['registro_pago_detalle'].belongsTo(db['registro_pago'], {foreignKey: "idregistro_pago"});
db['registro_pago_detalle'].belongsTo(db['tipo_pago'], {foreignKey: "idtipo_pago"});

db['registro_cobro'].belongsTo(db['org'], { foreignKey: "idorg" });
db['registro_cobro'].belongsTo(db['sede'], { foreignKey: "idsede" });
db['registro_cobro'].belongsTo(db['usuario'], { foreignKey: "idusuario" });
db['registro_cobro'].belongsTo(db['cliente'], { foreignKey: "idcliente" });
db['registro_cobro'].hasMany(db['registro_cobro_detalle'], { foreignKey: "idregistro_cobro" });

db['registro_cobro_detalle'].belongsTo(db['registro_cobro'], {foreignKey: "idregistro_cobro"});
db['registro_cobro_detalle'].belongsTo(db['tipo_pago'], {foreignKey: "idtipo_pago"});

db['registro_cobro_bitacora'].belongsTo(db['cliente'], { foreignKey: "idcliente" });
db['registro_cobro_bitacora'].belongsTo(db['usuario'], { foreignKey: "idusuario" });

db['venta'].belongsTo(db['org'], { foreignKey: "idorg" });
db['venta'].belongsTo(db['sede'], { foreignKey: "idsede" });
db['venta'].belongsTo(db['usuario'], { foreignKey: "idusuario" });
db['venta'].belongsTo(db['cliente'], { foreignKey: "idcliente" });

db['venta_detalle'].belongsTo(db['venta'], { foreignKey: "idventa" });
db['venta_detalle'].belongsTo(db['producto_stock'], { foreignKey: "idproducto_stock" });
db['venta_detalle'].belongsTo(db['producto_detalle'], { foreignKey: "idproducto_detalle" });


db['venta_detalle_pago'].belongsTo(db['venta'], { foreignKey: "idventa", as: 'venta' });
db['venta_detalle_pago'].belongsTo(db['tipo_pago'], { foreignKey: "idtipo_pago"});







// actualizar modelos
/// ./node_modules/sequelize-auto/bin/sequelize-auto -o "./models" -d transactor -h localhost -u adminTransactor -x @Dmin159159159 -e mysql


// colocar en password del usuario para proteger contraseña devuelta
// get() { return ':)'; }

db.sequelize = sequelize;
db.Sequelize = Sequelize;

module.exports = db;
