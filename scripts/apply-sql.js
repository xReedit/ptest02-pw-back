// Uso: node scripts/apply-sql.js sql/archivo.sql   (solo desarrollo)
// Aplica un script SQL contra la base configurada. Se niega a correr si el host
// no es uno de desarrollo: en produccion el DBA aplica el archivo a mano.
require('dotenv').config();
const fs = require('fs');
const mysql = require('mysql2/promise');
const config = require('../_config');

const HOSTS_DESARROLLO = ['', 'localhost', '127.0.0.1', '192.168.1.65'];

(async () => {
  const ruta = process.argv[2];
  if (!ruta) { throw new Error('Falta la ruta del archivo .sql'); }

  const host = (config.db_host || '').trim();
  if (!HOSTS_DESARROLLO.includes(host)) {
    throw new Error(`Host "${host}" no es de desarrollo: aplicar el SQL manualmente`);
  }

  const sql = fs.readFileSync(ruta, 'utf8').replace(/^﻿/, '');
  const conn = await mysql.createConnection({
    host: host || 'localhost',
    port: config.db_port,
    user: config.username,
    password: config.password,
    database: config.database,
    multipleStatements: true
  });
  try {
    await conn.query(sql);
  } finally {
    await conn.end();
  }
  console.log('aplicado', ruta);
})().catch(e => { console.error(e.message); process.exit(1); });
