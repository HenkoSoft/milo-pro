type DatabaseAccess = {
  get: (sql: string, params?: unknown[]) => Promise<unknown>;
  all: (sql: string, params?: unknown[]) => Promise<unknown[]>;
  run: (sql: string, params?: unknown[]) => Promise<unknown>;
  save: () => Promise<void>;
  transaction: <T>(fn: (db: DatabaseAccess) => Promise<T>) => Promise<T>;
};

type RuntimeDbLike = {
  get?: (sql: string, params?: unknown[]) => Promise<unknown> | unknown;
  all?: (sql: string, params?: unknown[]) => Promise<unknown[]> | unknown[];
  run?: (sql: string, params?: unknown[]) => Promise<unknown> | unknown;
  save?: () => Promise<void> | void;
  transaction?: <T>(fn: (db: DatabaseAccess) => Promise<T>) => Promise<T>;
};

function getLegacyDatabase() {
  return require('../../src/config/database.js');
}

export function runLegacyTransaction<T>(fn: (db: DatabaseAccess) => Promise<T>, overrides: Record<string, unknown> = {}) {
  const wrapped = getLegacyDatabase().transaction(() => fn(createDatabaseAccess(null, overrides)));
  return wrapped();
}

export function createDatabaseAccess(runtimeDb: RuntimeDbLike | null = null, overrides: Record<string, unknown> = {}): DatabaseAccess {
  const db = runtimeDb || null;
  const dbGet = db && typeof db.get === 'function' ? db.get.bind(db) : null;
  const dbAll = db && typeof db.all === 'function' ? db.all.bind(db) : null;
  const dbRun = db && typeof db.run === 'function' ? db.run.bind(db) : null;
  const dbSave = db && typeof db.save === 'function' ? db.save.bind(db) : null;
  const dbTransaction = db && typeof db.transaction === 'function' ? db.transaction.bind(db) : null;

  return {
    get: dbGet
      ? async (sql, params = []) => Promise.resolve(dbGet(sql, params))
      : async (sql, params = []) => getLegacyDatabase().get(sql, params),
    all: dbAll
      ? async (sql, params = []) => Promise.resolve(dbAll(sql, params))
      : async (sql, params = []) => getLegacyDatabase().all(sql, params),
    run: dbRun
      ? async (sql, params = []) => Promise.resolve(dbRun(sql, params))
      : async (sql, params = []) => getLegacyDatabase().run(sql, params),
    save: dbSave
      ? async () => {
          await Promise.resolve(dbSave());
        }
      : async () => getLegacyDatabase().saveDatabase(),
    transaction: dbTransaction
      ? async (fn) => Promise.resolve(dbTransaction(fn))
      : async (fn) => {
          if (typeof overrides.transactionFallback === 'function') {
            return (overrides.transactionFallback as (callback: (db: DatabaseAccess) => Promise<unknown>) => Promise<unknown>)(fn) as Promise<any>;
          }
          return runLegacyTransaction(fn, overrides);
        }
  };
}

export function getRequestRuntimeDb(req: { app?: { locals?: { database?: unknown } } } | null | undefined) {
  return req && req.app && req.app.locals ? req.app.locals.database || null : null;
}

export function getDatabaseAccessForRequest(req: { app?: { locals?: { database?: unknown } } } | null | undefined, overrides: Record<string, unknown> = {}) {
  return createDatabaseAccess(getRequestRuntimeDb(req) as RuntimeDbLike | null, overrides);
}
