const mysql = require('mysql2'); // Cambiado a mysql2 para soportar SSL de forma segura
require('dotenv').config();      // Carga las variables del archivo .env

const db = mysql.createConnection({
  host: process.env.DB_HOST || "mysql-27a2d8f6-salvadorlorenzo061-2f31.d.aivencloud.com",
  user: process.env.DB_USER || "avnadmin",
  password: process.env.DB_PASSWORD || "AVNS_me_jRsQIDBl3eiPfdL-",
  database: process.env.DB_NAME || "sistema_partido_cabal",
  port: process.env.DB_PORT || 28828, // 🔌 Cambiado al puerto de Aiven como respaldo directo
  // 🛡️ Configuración SSL obligatoria para conectarse a Aiven en la nube
  ssl: process.env.DB_HOST || true ? { rejectUnauthorized: false } : false
});

// Conectar a la base de datos
db.connect((err) => {
  if (err) {
    console.error('❌ Error al conectar a la base de datos:', err);
    return;
  }
  // Te avisará dinámicamente si estás en la nube o en local
  const destino = process.env.DB_HOST ? 'Aiven Cloud 🚀' : 'Aiven Cloud (Respaldo) 🚀';
  console.log(`✅ Conectado exitosamente a la base de datos MySQL en: ${destino}`);
});

// Exportar la conexión para usarla en otros archivos del servidor
module.exports = db;