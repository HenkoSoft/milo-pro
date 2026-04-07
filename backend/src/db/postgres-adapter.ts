import type { DatabaseAdapter, DatabaseParams, DatabaseRow, DatabaseRunResult, PostgresDatabaseConfig } from './types';
import { bootstrapPostgresSchema, quoteIdentifier } from './postgres-schema';

function convertSqliteDateFunctionsToPg(sql: string): string {
  return sql
    .replace(/date\('now'\s*,\s*'-([0-9]+)\s+days'\)/gi, "CURRENT_DATE - INTERVAL '$1 days'")
    .replace(/date\('now'\)/gi, 'CURRENT_DATE')
    .replace(/datetime\('now'\)/gi, 'CURRENT_TIMESTAMP')
    .replace(/strftime\('%Y-%m',\s*([^)]+)\)\s*=\s*strftime\('%Y-%m',\s*'now'\)/gi, "TO_CHAR($1, 'YYYY-MM') = TO_CHAR(CURRENT_DATE, 'YYYY-MM')")
    .replace(/strftime\('%Y',\s*([^)]+)\)\s*=\s*strftime\('%Y',\s*'now'\)/gi, "TO_CHAR($1, 'YYYY') = TO_CHAR(CURRENT_DATE, 'YYYY')")
    .replace(/\bdate\(\s*([a-z_][a-z0-9_]*(?:\.[a-z_][a-z0-9_]*)?)\s*\)/gi, 'CAST($1 AS DATE)');
}

function convertQuestionParamsToPg(sql: string): string {
  const normalizedSql = convertSqliteDateFunctionsToPg(sql);
  let index = 0;
  let result = '';
  let inSingleQuote = false;

  for (let i = 0; i < normalizedSql.length; i += 1) {
    const char = normalizedSql[i];
    const next = normalizedSql[i + 1];

    if (char === "'") {
      result += char;
      if (inSingleQuote && next === "'") {
        result += next;
        i += 1;
        continue;
      }
      inSingleQuote = !inSingleQuote;
      continue;
    }

    if (char === '?' && !inSingleQuote) {
      index += 1;
      result += `$${index}`;
      continue;
    }

    result += char;
  }

  return result;
}

function resolveClientConstructor(): new (...args: unknown[]) => {
  connect: () => Promise<void>;
  end: () => Promise<void>;
  query: (sql: string, params?: readonly unknown[]) => Promise<{ rows: DatabaseRow[]; rowCount?: number }>;
} {
  try {
    const pg = require('pg');
    if (!pg?.Client) {
      throw new Error('pg.Client no esta disponible');
    }
    return pg.Client;
  } catch (error) {
    throw new Error('PostgreSQL requiere instalar la dependencia `pg` antes de activar DATABASE_DIALECT=postgres');
  }
}

export class PostgresDatabaseAdapter implements DatabaseAdapter {
  public readonly dialect = 'postgres' as const;

  private readonly config: PostgresDatabaseConfig;
  private client: {
    connect: () => Promise<void>;
    end: () => Promise<void>;
    query: (sql: string, params?: readonly unknown[]) => Promise<{ rows: DatabaseRow[]; rowCount?: number }>;
  } | null = null;

  public constructor(config: PostgresDatabaseConfig) {
    this.config = config;
  }

  public async initialize(): Promise<void> {
    if (!this.config.connectionString && !(this.config.host && this.config.database && this.config.user)) {
      throw new Error('Configuracion PostgreSQL incompleta. Defini DATABASE_URL o PGHOST/PGDATABASE/PGUSER.');
    }

    const Client = resolveClientConstructor();
    this.client = new Client({
      connectionString: this.config.connectionString || undefined,
      host: this.config.host || undefined,
      port: this.config.port,
      database: this.config.database || undefined,
      user: this.config.user || undefined,
      password: this.config.password || undefined,
      ssl: this.config.ssl.enabled
        ? { rejectUnauthorized: this.config.ssl.rejectUnauthorized }
        : undefined
    });

    await this.client.connect();

    if (this.config.schema && this.config.schema !== 'public') {
      await this.client.query(`CREATE SCHEMA IF NOT EXISTS ${quoteIdentifier(this.config.schema)}`);
      await this.client.query(`SET search_path TO ${quoteIdentifier(this.config.schema)}`);
    }

    await bootstrapPostgresSchema(this.client, this.config.schema);
  }

  public async close(): Promise<void> {
    if (!this.client) {
      return;
    }

    await this.client.end();
    this.client = null;
  }

  public async get<T extends DatabaseRow = DatabaseRow>(sql: string, params: DatabaseParams = []): Promise<T | null> {
    const result = await this.query<T>(sql, params);
    return result.rows[0] || null;
  }

  public async all<T extends DatabaseRow = DatabaseRow>(sql: string, params: DatabaseParams = []): Promise<T[]> {
    const result = await this.query<T>(sql, params);
    return result.rows;
  }

  public async run(sql: string, params: DatabaseParams = []): Promise<DatabaseRunResult> {
    const result = await this.query(sql, params);
    const firstRow = result.rows[0] as { id?: unknown } | undefined;
    let lastInsertRowid = typeof firstRow?.id === 'number' ? firstRow.id : null;

    if (lastInsertRowid === null && /^\s*insert\s+into\b/i.test(sql)) {
      try {
        const lastValue = await this.query<{ id?: unknown }>('SELECT LASTVAL() AS id');
        const rawId = lastValue.rows[0]?.id;
        const numericId = Number(rawId);
        if (Number.isFinite(numericId)) {
          lastInsertRowid = numericId;
        }
      } catch (_error) {
        // Some inserts use explicit ids and do not advance a sequence.
      }
    }

    return {
      lastInsertRowid,
      rowCount: typeof result.rowCount === 'number' ? result.rowCount : 0
    };
  }

  public async transaction<T>(fn: (adapter: DatabaseAdapter) => Promise<T> | T): Promise<T> {
    await this.query('BEGIN');
    try {
      const value = await fn(this);
      await this.query('COMMIT');
      return value;
    } catch (error) {
      await this.query('ROLLBACK');
      throw error;
    }
  }

  public async save(): Promise<void> {
    return Promise.resolve();
  }

  private async query<T extends DatabaseRow = DatabaseRow>(sql: string, params: DatabaseParams = []): Promise<{ rows: T[]; rowCount?: number }> {
    if (!this.client) {
      throw new Error('PostgreSQL adapter no inicializado');
    }

    return this.client.query(convertQuestionParamsToPg(sql), params) as Promise<{ rows: T[]; rowCount?: number }>;
  }
}

export { convertQuestionParamsToPg };
