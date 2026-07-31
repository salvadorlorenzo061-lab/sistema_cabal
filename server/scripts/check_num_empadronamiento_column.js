require('dotenv').config();
const fs = require('fs');
const mysql = require('mysql2/promise');

async function checkColumn() {
  const config = {
    host: (process.env.DB_HOST || '').trim(),
    user: (process.env.DB_USER || '').trim(),
    password: (process.env.DB_PASSWORD || '').trim(),
    database: (process.env.DB_NAME || 'defaultdb').trim(),
    port: Number((process.env.DB_PORT || '28828').trim()),
    ssl: { rejectUnauthorized: false }
  };

  const outPath = 'scripts/db_check_num_empadronamiento.txt';

  try {
    const conn = await mysql.createConnection(config);
    const [rows] = await conn.query(
      `SELECT COUNT(*) AS c
         FROM information_schema.columns
        WHERE table_schema = ?
          AND table_name = 'afiliados'
          AND column_name = 'num_empadronamiento'`,
      [config.database]
    );
    await conn.end();

    fs.writeFileSync(outPath, JSON.stringify(rows[0], null, 2));
  } catch (error) {
    fs.writeFileSync(outPath, `ERROR: ${error.message}`);
    process.exit(1);
  }
}

checkColumn();
