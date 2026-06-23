const mysql = require('mysql2'); // Cambiado a mysql2 para soportar SSL de forma segura
require('dotenv').config();      // Carga las variables del archivo .env

const db = mysql.createConnection({
  host: process.env.DB_HOST || "localhost",
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD || "",
  database: process.env.DB_NAME || "sistema_partido_cabal",
  port: process.env.DB_PORT || 3306,
  // 🛡️ Configuración SSL obligatoria para conectarse a Aiven en la nube
  ssl: process.env.DB_HOST ? { rejectUnauthorized: false } : false
});

// Conectar a la base de datos
db.connect((err) => {
  if (err) {
    console.error('❌ Error al conectar a la base de datos:', err);
    return;
  }
  // Te avisará dinámicamente si estás en la nube o en local
  const destino = process.env.DB_HOST ? 'Aiven Cloud 🚀' : 'Localhost 💻';
  console.log(`✅ Conectado exitosamente a la base de datos MySQL en: ${destino}`);
});

// Exportar la conexión para usarla en otros archivos del servidor
module.exports = db;