const mysql = require('mysql2'); 
require('dotenv').config();      

const requiredEnvVars = ['DB_HOST', 'DB_USER', 'DB_PASSWORD'];
const missingEnvVars = requiredEnvVars.filter((key) => !process.env[key]);

const DB_NAME = process.env.DB_NAME || 'defaultdb';
const DB_PORT = Number(process.env.DB_PORT || 28828);

if (missingEnvVars.length > 0) {
  console.error(`Missing required database environment variables: ${missingEnvVars.join(', ')}`);
  process.exit(1);
}

const db = mysql.createConnection({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: DB_NAME,
  port: DB_PORT,
  connectTimeout: 10000,
  enableKeepAlive: true,
  
  // 🛡️ Configuración SSL directa y segura (Evita que colapse el handshake con Aiven)
  ssl: { 
    rejectUnauthorized: false 
  }
});

// Conectar a la base de datos
db.connect((err) => {
  if (err) {
    console.error('❌ Error crítico al conectar a la base de datos de Aiven:', err);
    return;
  }
  const destino = `${process.env.DB_HOST}:${DB_PORT}/${DB_NAME}`;
  console.log(`✅ Conectado exitosamente a la base de datos MySQL en: ${destino}`);
});

module.exports = db;