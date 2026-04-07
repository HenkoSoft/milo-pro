const fs = require('fs');
const path = require('path');
const initSqlJs = require('sql.js');
const { Client } = require('pg');

const ROOT_DIR = path.resolve(__dirname, '..');
const DATA_DIR = path.join(ROOT_DIR, 'data');
const DATABASE_FILENAME = process.env.MILO_DB_FILENAME || 'milo-pro.db';
const LEGACY_DATABASE_FILENAME = 'techfix.db';

const TABLES = [
  'users',
  'settings',
  'categories',
  'device_types',
  'brands',
  'device_models',
  'customers',
  'suppliers',
  'products',
  'purchases',
  'purchase_items',
  'supplier_payments',
  'supplier_credits',
  'supplier_credit_items',
  'supplier_account',
  'supplier_account_movements',
  'sales',
  'sale_items',
  'repairs',
  'repair_logs',
  'woocommerce_sync',
  'product_sync_log',
  'external_order_links',
  'sync_logs',
  'product_categories',
  'product_images'
];

function quoteIdentifier(identifier) {
  return `"${String(identifier || '').replace(/"/g, '""')}"`;
}

function resolveSqlitePath() {
  const primary = path.join(DATA_DIR, DATABASE_FILENAME);
  const legacy = path.join(DATA_DIR, LEGACY_DATABASE_FILENAME);

  if (fs.existsSync(primary)) return primary;
  if (fs.existsSync(legacy)) return legacy;

  throw new Error(`No se encontro base SQLite en ${primary} ni fallback legacy en ${legacy}`);
}

function buildPgConfig() {
  const connectionString = process.env.DATABASE_URL || null;
  const host = process.env.PGHOST || null;
  const database = process.env.PGDATABASE || null;
  const user = process.env.PGUSER || null;

  if (!connectionString && !(host && database && user)) {
    throw new Error('Defini DATABASE_URL o PGHOST/PGDATABASE/PGUSER antes de verificar PostgreSQL.');
  }

  return {
    connectionString: connectionString || undefined,
    host: host || undefined,
    port: Number(process.env.PGPORT || 5432),
    database: database || undefined,
    user: user || undefined,
    password: process.env.PGPASSWORD || undefined,
    ssl: process.env.PGSSL === '1' || process.env.PGSSLMODE === 'true'
      ? { rejectUnauthorized: process.env.PGSSL_REJECT_UNAUTHORIZED !== '0' }
      : undefined
  };
}

async function loadSqliteDatabase() {
  const SQL = await initSqlJs();
  const dbPath = resolveSqlitePath();
  const buffer = fs.readFileSync(dbPath);
  const db = new SQL.Database(buffer);
  return { db, dbPath };
}

function getSqliteCount(db, tableName) {
  const stmt = db.prepare(`SELECT COUNT(*) AS count FROM ${tableName}`);
  stmt.step();
  const row = stmt.getAsObject();
  stmt.free();
  return Number(row.count || 0);
}

async function getPostgresCount(client, schema, tableName) {
  const qualifiedTable = `${quoteIdentifier(schema)}.${quoteIdentifier(tableName)}`;
  const result = await client.query(`SELECT COUNT(*)::int AS count FROM ${qualifiedTable}`);
  return Number(result.rows[0]?.count || 0);
}

async function main() {
  const schema = String(process.env.PGSCHEMA || 'public').trim() || 'public';
  const { db: sqliteDb, dbPath } = await loadSqliteDatabase();
  const client = new Client(buildPgConfig());

  try {
    await client.connect();

    const mismatches = [];
    for (const tableName of TABLES) {
      const sqliteCount = getSqliteCount(sqliteDb, tableName);
      const postgresCount = await getPostgresCount(client, schema, tableName);
      const ok = sqliteCount === postgresCount;

      console.log(`[PG-VERIFY] ${tableName}: sqlite=${sqliteCount} postgres=${postgresCount} ${ok ? 'OK' : 'MISMATCH'}`);
      if (!ok) {
        mismatches.push({ tableName, sqliteCount, postgresCount });
      }
    }

    console.log(`[PG-VERIFY] SQLite source: ${dbPath}`);
    console.log(`[PG-VERIFY] Target schema: ${schema}`);

    if (mismatches.length > 0) {
      throw new Error(`Se encontraron ${mismatches.length} tablas con conteos distintos.`);
    }

    console.log('[PG-VERIFY] Row-count verification completed successfully');
  } finally {
    sqliteDb.close();
    await client.end().catch(() => {});
  }
}

main().catch((error) => {
  console.error('[PG-VERIFY] Failed:', error);
  process.exit(1);
});
