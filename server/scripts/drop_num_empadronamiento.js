require('dotenv').config();
const mysql = require('mysql2/promise');

async function run() {
  const config = {
    host: (process.env.DB_HOST || '').trim(),
    user: (process.env.DB_USER || '').trim(),
    password: (process.env.DB_PASSWORD || '').trim(),
    database: (process.env.DB_NAME || 'defaultdb').trim(),
    port: Number((process.env.DB_PORT || '28828').trim()),
    ssl: { rejectUnauthorized: false }
  };

  if (!config.host || !config.user || !config.password) {
    throw new Error('Missing DB_HOST, DB_USER or DB_PASSWORD in server/.env');
  }

  const conn = await mysql.createConnection(config);

  const [columns] = await conn.query(
    `SELECT COLUMN_NAME
       FROM information_schema.columns
      WHERE table_schema = ?
        AND table_name = 'afiliados'
        AND column_name = 'num_empadronamiento'`,
    [config.database]
  );

  if (columns.length === 0) {
    console.log('Column num_empadronamiento does not exist. Nothing to drop.');
    await conn.end();
    return;
  }

  const [indexes] = await conn.query(
    `SELECT DISTINCT INDEX_NAME
       FROM information_schema.statistics
      WHERE table_schema = ?
        AND table_name = 'afiliados'
        AND column_name = 'num_empadronamiento'
        AND INDEX_NAME <> 'PRIMARY'`,
    [config.database]
  );

  for (const idx of indexes) {
    await conn.query(`ALTER TABLE afiliados DROP INDEX \`${idx.INDEX_NAME}\``);
    console.log(`Dropped index: ${idx.INDEX_NAME}`);
  }

  await conn.query('ALTER TABLE afiliados DROP COLUMN num_empadronamiento');
  console.log('Dropped column: num_empadronamiento');

  await conn.end();
}

run().catch((error) => {
  console.error('DB migration failed:', error.message);
  process.exit(1);
});
