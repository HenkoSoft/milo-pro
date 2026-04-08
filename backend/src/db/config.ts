import type { DatabaseConfig, DatabaseDialect, PostgresDatabaseConfig, SqliteDatabaseConfig } from './types';

function toBoolean(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined) {
    return fallback;
  }

  const normalized = String(value).trim().toLowerCase();
  if (!normalized) {
    return fallback;
  }

  return ['1', 'true', 'yes', 'on'].includes(normalized);
}

function toNumber(value: string | undefined, fallback: number): number {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

export function getDatabaseDialect(): DatabaseDialect {
  const raw = String(process.env.DATABASE_DIALECT || 'auto').trim().toLowerCase();

  if (raw === 'postgres') {
    return 'postgres';
  }

  if (raw === 'sqlite') {
    return 'sqlite';
  }

  const hasConnectionString = Boolean(process.env.DATABASE_URL);
  const hasDiscretePostgresConfig = Boolean(process.env.PGHOST && process.env.PGDATABASE && process.env.PGUSER);

  return hasConnectionString || hasDiscretePostgresConfig ? 'postgres' : 'sqlite';
}

export function loadDatabaseConfig(): DatabaseConfig {
  const dialect = getDatabaseDialect();

  if (dialect === 'postgres') {
    const config: PostgresDatabaseConfig = {
      dialect: 'postgres',
      connectionString: process.env.DATABASE_URL || null,
      host: process.env.PGHOST || null,
      port: toNumber(process.env.PGPORT, 5432),
      database: process.env.PGDATABASE || null,
      user: process.env.PGUSER || null,
      password: process.env.PGPASSWORD || null,
      schema: String(process.env.PGSCHEMA || 'public').trim() || 'public',
      ssl: {
        enabled: toBoolean(process.env.PGSSLMODE, false) || toBoolean(process.env.PGSSL, false),
        rejectUnauthorized: toBoolean(process.env.PGSSL_REJECT_UNAUTHORIZED, true)
      }
    };

    return config;
  }

  const sqliteConfig: SqliteDatabaseConfig = {
    dialect: 'sqlite',
    filename: String(process.env.MILO_DB_FILENAME || 'milo-pro.db').trim() || 'milo-pro.db'
  };

  return sqliteConfig;
}

export function hasPostgresConnectionInfo(config: DatabaseConfig): config is PostgresDatabaseConfig {
  if (config.dialect !== 'postgres') {
    return false;
  }

  if (config.connectionString) {
    return true;
  }

  return Boolean(config.host && config.database && config.user);
}
