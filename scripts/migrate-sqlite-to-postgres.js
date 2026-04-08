const fs = require('fs');
const path = require('path');
const initSqlJs = require('sql.js');
const { Client } = require('pg');

const ROOT_DIR = path.resolve(__dirname, '..');
const DATA_DIR = path.join(ROOT_DIR, 'data');
const DATABASE_FILENAME = process.env.MILO_DB_FILENAME || 'milo-pro.db';
const LEGACY_DATABASE_FILENAME = 'techfix.db';
const {
  IDENTITY_TABLES,
  TABLES_IN_IMPORT_ORDER,
  loadSourceRows,
  reconcileSyntheticRows
} = require('./postgres-migration-helpers');

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
    throw new Error('Defini DATABASE_URL o PGHOST/PGDATABASE/PGUSER antes de migrar a PostgreSQL.');
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
  db.run('PRAGMA foreign_keys = ON');
  return { db, dbPath };
}

async function ensurePostgresSchema(client, schema) {
  const { bootstrapPostgresSchema } = require(path.join(ROOT_DIR, 'backend', 'dist', 'db', 'postgres-schema.js'));
  const previousSeedFlag = process.env.MILO_DISABLE_SEED;
  process.env.MILO_DISABLE_SEED = '1';
  try {
    await bootstrapPostgresSchema(client, schema);
  } finally {
    if (previousSeedFlag === undefined) {
      delete process.env.MILO_DISABLE_SEED;
    } else {
      process.env.MILO_DISABLE_SEED = previousSeedFlag;
    }
  }
}

async function truncateTargetTables(client, schema) {
  const names = TABLES_IN_IMPORT_ORDER
    .slice()
    .reverse()
    .map((tableName) => `${quoteIdentifier(schema)}.${quoteIdentifier(tableName)}`)
    .join(', ');

  await client.query(`TRUNCATE TABLE ${names} RESTART IDENTITY CASCADE`);
}

async function getExistingTargetData(client, schema) {
  const existing = [];

  for (const tableName of TABLES_IN_IMPORT_ORDER) {
    const qualifiedTable = `${quoteIdentifier(schema)}.${quoteIdentifier(tableName)}`;
    const result = await client.query(`SELECT COUNT(*)::int AS count FROM ${qualifiedTable}`);
    const count = Number(result.rows[0]?.count || 0);
    if (count > 0) {
      existing.push({ tableName, count });
    }
  }

  return existing;
}

async function clearBootstrapOnlyRows(client, schema) {
  await client.query(`DELETE FROM ${quoteIdentifier(schema)}.${quoteIdentifier('settings')} WHERE id = 1`);
}

async function insertRows(client, schema, tableName, rows) {
  if (!rows.length) {
    return 0;
  }

  const columns = Object.keys(rows[0]);
  const quotedColumns = columns.map((column) => quoteIdentifier(column)).join(', ');
  const qualifiedTable = `${quoteIdentifier(schema)}.${quoteIdentifier(tableName)}`;

  for (const row of rows) {
    const values = columns.map((column) => row[column]);
    const placeholders = values.map((_, index) => `$${index + 1}`).join(', ');
    await client.query(
      `INSERT INTO ${qualifiedTable} (${quotedColumns}) VALUES (${placeholders})`,
      values
    );
  }

  return rows.length;
}

async function resetIdentitySequences(client, schema) {
  for (const tableName of IDENTITY_TABLES) {
    const qualifiedTable = `${quoteIdentifier(schema)}.${quoteIdentifier(tableName)}`;
    await client.query(
      `SELECT setval(pg_get_serial_sequence($1, 'id'), COALESCE((SELECT MAX(id) FROM ${qualifiedTable}), 1), COALESCE((SELECT MAX(id) FROM ${qualifiedTable}), 0) > 0)`,
      [`${schema}.${tableName}`]
    );
  }
}

async function main() {
  const schema = String(process.env.PGSCHEMA || 'public').trim() || 'public';
  const truncate = ['1', 'true', 'yes'].includes(String(process.env.PG_MIGRATE_TRUNCATE || '').trim().toLowerCase());

  const { db: sqliteDb, dbPath } = await loadSqliteDatabase();
  const client = new Client(buildPgConfig());

  try {
    await client.connect();
    await ensurePostgresSchema(client, schema);
    const rowsByTable = loadSourceRows(sqliteDb);
    const syntheticRows = reconcileSyntheticRows(rowsByTable);

    if (truncate) {
      await truncateTargetTables(client, schema);
    } else {
      const existing = await getExistingTargetData(client, schema);
      const onlyBootstrapSettings = existing.length === 1
        && existing[0].tableName === 'settings'
        && existing[0].count === 1;

      if (onlyBootstrapSettings) {
        await clearBootstrapOnlyRows(client, schema);
      } else if (existing.length > 0) {
        const summary = existing.map((item) => `${item.tableName}=${item.count}`).join(', ');
        throw new Error(
          `La base PostgreSQL destino ya contiene datos (${summary}). Usa PG_MIGRATE_TRUNCATE=1 para reiniciar antes de importar o limpia manualmente las tablas.`
        );
      }
    }

    const summary = [];
    for (const tableName of TABLES_IN_IMPORT_ORDER) {
      const rows = rowsByTable.get(tableName) || [];
      const imported = await insertRows(client, schema, tableName, rows);
      summary.push({ tableName, imported });
    }

    await resetIdentitySequences(client, schema);

    console.log(`[PG-MIGRATE] SQLite source: ${dbPath}`);
    console.log(`[PG-MIGRATE] Target schema: ${schema}`);
    console.log(`[PG-MIGRATE] Truncate before import: ${truncate ? 'yes' : 'no'}`);
    for (const [tableName, rows] of syntheticRows.entries()) {
      console.log(`[PG-MIGRATE] synthetic ${tableName}: ${rows.length}`);
    }
    for (const item of summary) {
      console.log(`[PG-MIGRATE] ${item.tableName}: ${item.imported}`);
    }
    console.log('[PG-MIGRATE] Import completed successfully');
  } finally {
    sqliteDb.close();
    await client.end().catch(() => {});
  }
}

main().catch((error) => {
  console.error('[PG-MIGRATE] Failed:', error);
  process.exit(1);
});
