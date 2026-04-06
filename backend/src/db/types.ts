export type DatabaseDialect = 'sqlite' | 'postgres';

export type DatabaseParams = readonly unknown[];

export type DatabaseRow = Record<string, unknown>;

export interface DatabaseRunResult {
  lastInsertRowid: number | null;
  rowCount: number;
}

export interface DatabaseAdapter {
  readonly dialect: DatabaseDialect;
  initialize(): Promise<void>;
  close(): Promise<void>;
  get<T extends DatabaseRow = DatabaseRow>(sql: string, params?: DatabaseParams): Promise<T | null>;
  all<T extends DatabaseRow = DatabaseRow>(sql: string, params?: DatabaseParams): Promise<T[]>;
  run(sql: string, params?: DatabaseParams): Promise<DatabaseRunResult>;
  transaction<T>(fn: (adapter: DatabaseAdapter) => Promise<T> | T): Promise<T>;
  save(): Promise<void>;
}

export interface BaseDatabaseConfig {
  dialect: DatabaseDialect;
}

export interface SqliteDatabaseConfig extends BaseDatabaseConfig {
  dialect: 'sqlite';
  filename: string;
}

export interface PostgresSslConfig {
  enabled: boolean;
  rejectUnauthorized: boolean;
}

export interface PostgresDatabaseConfig extends BaseDatabaseConfig {
  dialect: 'postgres';
  connectionString: string | null;
  host: string | null;
  port: number;
  database: string | null;
  user: string | null;
  password: string | null;
  schema: string;
  ssl: PostgresSslConfig;
}

export type DatabaseConfig = SqliteDatabaseConfig | PostgresDatabaseConfig;
