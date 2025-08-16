/**
 * Configuración de Sequelize para conexión con la base de datos
 * Centraliza los parámetros de conexión y configuración de pool
 */

const { Sequelize } = require('sequelize');

let _config;
try {
  _config = require('../_config');
} catch (e) {
  _config = {
    port: '',
    portSocket: '',
    database: '',
    username: '',
    password: '',
    db_host: '',
    port: '',
    db_port: '',
    publicKeyVapid: '',
    privateKeyVapid: '',
    firebaseApikey: ''
  };
}

// Obtener credenciales desde variables de entorno o usar valores por defecto
const dbConfig = {
  host: process.env.DB_HOST || _config?.db_host,
  port: process.env.DB_PORT || _config?.db_port,
  username: process.env.DB_USER || _config?.username,
  password: process.env.DB_PASSWORD || _config?.password,
  database: process.env.DB_NAME || _config?.database,
  dialect: 'mysql',
  // Opciones de pool optimizadas para alta demanda
  pool: {
    max: 20,             // Máximo de conexiones en pool (aumentado para alta demanda)
    min: 5,              // Mínimo de conexiones en pool
    acquire: 30000,      // Tiempo máximo para adquirir conexión (ms)
    idle: 10000,         // Tiempo máximo de inactividad (ms)
    evict: 1000,         // Tiempo entre comprobaciones de conexiones inactivas
    handleDisconnects: true // Manejar reconexiones automáticas
  },
  // Opciones adicionales para mejor rendimiento y manejo de errores
  dialectOptions: {
    // Tiempo de espera para conexión inicial
    connectTimeout: 60000, 
    // Flags recomendados para MySQL con alta concurrencia
    flags: [
      'FOUND_ROWS',
      'IGNORE_SPACE',
      'MULTI_STATEMENTS'
    ]
  },
  // Opciones para timeouts de consultas
  retry: {
    max: 3 // Reintentos máximos
  },
  // Tiempo de espera para consultas - a nivel general
  queryTimeout: 30000,
  // Opciones generales
  logging: process.env.NODE_ENV === 'production' ? false : console.log,
  timezone: '-05:00', // Ajustar a tu zona horaria
  define: {
    underscored: true,    // Usar snake_case para campos en DB
    timestamps: false,    // No usar timestamps automáticos
    freezeTableName: true // No pluralizar nombres de tablas
  }
};

// Crear instancia de Sequelize
const sequelize = new Sequelize(
  dbConfig.database,
  dbConfig.username,
  dbConfig.password,
  {
    host: dbConfig.host,
    port: dbConfig.port,
    dialect: dbConfig.dialect,
    pool: dbConfig.pool,
    dialectOptions: dbConfig.dialectOptions,
    logging: dbConfig.logging,
    timezone: dbConfig.timezone,
    define: dbConfig.define,
    // Configuraciones para mejor rendimiento en consultas
    query: {
      raw: true // Devuelve objetos JS planos por defecto
    }
  }
);

// Exportar instancia de Sequelize
module.exports = {
  sequelize,
  Sequelize
};
