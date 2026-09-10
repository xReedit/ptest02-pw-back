// Uso: node scripts/dump-procedure.js procedure_pwa_pedido_guardar > sql/tmp.sql
// Vuelca un procedimiento almacenado como script re-aplicable (sin DEFINER).
require('dotenv').config();
const { sequelize } = require('../config/database');

(async () => {
  const nombre = process.argv[2];
  if (!nombre || !/^[A-Za-z0-9_]+$/.test(nombre)) {
    throw new Error('Nombre de procedimiento invalido');
  }
  const [rows] = await sequelize.query(`SHOW CREATE PROCEDURE ${nombre}`);
  const body = rows[0]['Create Procedure'].replace(/CREATE DEFINER=`[^`]+`@`[^`]+` PROCEDURE/, 'CREATE PROCEDURE');
  process.stdout.write(`DROP PROCEDURE IF EXISTS ${nombre};\n${body}\n`);
  await sequelize.close();
})().catch(e => { console.error(e); process.exit(1); });
