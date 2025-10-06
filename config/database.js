/**
 * Configuración CENTRALIZADA de Sequelize para conexión con la base de datos
 * ⭐ IMPORTANTE: Usar SOLO esta instancia en todo el proyecto
 * 
 * Beneficios:
 * - Una sola conexión compartida (pool optimizado)
 * - Mejor rendimiento bajo alta carga
 * - Menor consumo de memoria
 * - Manejo automático de reconexiones
 */

const { Sequelize } = require('sequelize');
const config = require('../_config');

// ✅ Usar configuración centralizada de _config.js con pool optimizado
const sequelizeOptions = {
  ...config.sequelizeOption,
  dialectOptions: {
    timezone: '-05:00',      // GMT-5 para Perú/Colombia
    dateStrings: true,       // Evita conversiones automáticas
    typeCast: true          // Mantiene tipos correctos
  },
  // Pool optimizado para t3.2xlarge (8 vCPUs, 32GB RAM COMPARTIDA)
  // MySQL + Node.js + otros servicios en mismo servidor
  pool: {
    max: 100,             // Máximo 100 conexiones (conservador para servidor compartido)
    min: 10,              // Mínimo 10 conexiones siempre activas
    acquire: 30000,       // 30s para adquirir conexión
    idle: 20000,          // 20s de inactividad antes de liberar
    evict: 5000,          // Revisar conexiones inactivas cada 5s
    handleDisconnects: true  // Reconexión automática
  },
  // Reintentos automáticos en caso de deadlock
  retry: {
    max: 3,
    match: [
      /ER_LOCK_DEADLOCK/,
      /SQLITE_BUSY/
    ]
  }
};

// ⭐ Crear UNA SOLA instancia de Sequelize para toda la aplicación
const sequelize = new Sequelize(
  config.database,
  config.username,
  config.password,
  sequelizeOptions
);

// Verificar conexión al iniciar
sequelize.authenticate()
  .then(() => {
    const logger = require('../utilitarios/logger');
    logger.info({
      host: config.db_host,
      database: config.database,
      pool: sequelizeOptions.pool
    }, '✅ Base de datos conectada correctamente');
  })
  .catch(err => {
    const logger = require('../utilitarios/logger');
    logger.error({ err }, '❌ Error al conectar a la base de datos');
  });

// ⭐ Exportar SOLO esta instancia (no crear nuevas)
module.exports = {
  sequelize,
  Sequelize
};
