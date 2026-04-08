import type { DatabaseAdapter, DatabaseParams, DatabaseRow, DatabaseRunResult } from './types';

const legacyDatabase = require('../../src/config/database.js');

type LegacyDatabaseModule = {
  initializeDatabase: () => Promise<unknown>;
  get: (sql: string, params?: readonly unknown[]) => DatabaseRow | null;
  all: (sql: string, params?: readonly unknown[]) => DatabaseRow[];
  run: (sql: string, params?: readonly unknown[]) => { lastInsertRowid?: number | null };
  transaction: <T>(fn: () => Promise<T> | T) => () => Promise<T> | T;
  saveDatabase: () => void;
};

const database = legacyDatabase as LegacyDatabaseModule;

export class SqliteDatabaseAdapter implements DatabaseAdapter {
  public readonly dialect = 'sqlite' as const;

  public async initialize(): Promise<void> {
    await database.initializeDatabase();
  }

  public async close(): Promise<void> {
    return Promise.resolve();
  }

  public async get<T extends DatabaseRow = DatabaseRow>(sql: string, params: DatabaseParams = []): Promise<T | null> {
    return database.get(sql, params) as T | null;
  }

  public async all<T extends DatabaseRow = DatabaseRow>(sql: string, params: DatabaseParams = []): Promise<T[]> {
    return database.all(sql, params) as T[];
  }

  public async run(sql: string, params: DatabaseParams = []): Promise<DatabaseRunResult> {
    const result = database.run(sql, params);
    return {
      lastInsertRowid: typeof result?.lastInsertRowid === 'number' ? result.lastInsertRowid : null,
      rowCount: 0
    };
  }

  public async transaction<T>(fn: (adapter: DatabaseAdapter) => Promise<T> | T): Promise<T> {
    const wrapped = database.transaction(() => fn(this));
    return Promise.resolve(wrapped());
  }

  public async save(): Promise<void> {
    database.saveDatabase();
  }
}
