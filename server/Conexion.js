const mysql = require('mysql2'); 
require('dotenv').config();      

const normalizeEnv = (value) => (typeof value === 'string' ? value.replace(/\r|\n/g, '').trim() : '');

const DB_HOST = normalizeEnv(process.env.DB_HOST);
const DB_USER = normalizeEnv(process.env.DB_USER);
const DB_PASSWORD = normalizeEnv(process.env.DB_PASSWORD);
const requiredEnvVars = ['DB_HOST', 'DB_USER', 'DB_PASSWORD'];
const missingEnvVars = requiredEnvVars.filter((key) => {
  if (key === 'DB_HOST') return !DB_HOST;
  if (key === 'DB_USER') return !DB_USER;
  if (key === 'DB_PASSWORD') return !DB_PASSWORD;
  return !process.env[key];
});

const DB_NAME = normalizeEnv(process.env.DB_NAME) || 'defaultdb';
const DB_PORT = Number(normalizeEnv(process.env.DB_PORT) || 28828);

if (missingEnvVars.length > 0) {
  console.error(`Missing required database environment variables: ${missingEnvVars.join(', ')}`);
  process.exit(1);
}

const db = mysql.createPool({
  host: DB_HOST,
  user: DB_USER,
  password: DB_PASSWORD,
  database: DB_NAME,
  port: DB_PORT,
  connectTimeout: 10000,
  enableKeepAlive: true,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  
  // 🛡️ Configuración SSL directa y segura (Evita que colapse el handshake con Aiven)
  ssl: { 
    rejectUnauthorized: false 
  }
});

// Validar conexión inicial a la base de datos
db.getConnection((err, connection) => {
  if (err) {
    if (err.code === 'ER_ACCESS_DENIED_ERROR') {
      console.error(`❌ Autenticación MySQL fallida para el usuario '${DB_USER}' en host '${DB_HOST}'. Verifique DB_USER/DB_PASSWORD en Render.`);
    }
    console.error('❌ Error crítico al conectar a la base de datos de Aiven:', err);
    return;
  }
  const destino = `${DB_HOST}:${DB_PORT}/${DB_NAME}`;
  console.log(`✅ Conectado exitosamente a la base de datos MySQL en: ${destino}`);
  connection.release();
});

module.exports = db;