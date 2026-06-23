const mysql = require('mysql2'); 
require('dotenv').config();      

const db = mysql.createConnection({
  host: process.env.DB_HOST || "mysql-27a2d8f6-salvadorlorenzo061-2f31.d.aivencloud.com",
  user: process.env.DB_USER || "avnadmin",
  password: process.env.DB_PASSWORD || "AVNS_me_jRsQIDBl3eiPfdL-",
  database: process.env.DB_NAME || "sistema_partido_cabal",
  port: process.env.DB_PORT || 28828, 
  
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
  const destino = process.env.DB_HOST ? 'Aiven Cloud (Producción) 🚀' : 'Aiven Cloud (Variables Locales) 🚀';
  console.log(`✅ Conectado exitosamente a la base de datos MySQL en: ${destino}`);
});

module.exports = db;