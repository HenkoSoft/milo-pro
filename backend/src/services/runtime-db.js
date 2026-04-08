function getLegacyDatabase() {
  return require('../config/database');
}

function runLegacyTransaction(fn, overrides = {}) {
  const wrapped = getLegacyDatabase().transaction(() => fn(createDatabaseAccess(null, overrides)));
  return wrapped();
}

function createDatabaseAccess(runtimeDb = null, overrides = {}) {
  const db = runtimeDb || null;

  return {
    get: db && typeof db.get === 'function'
      ? (sql, params = []) => db.get(sql, params)
      : async (sql, params = []) => getLegacyDatabase().get(sql, params),
    all: db && typeof db.all === 'function'
      ? (sql, params = []) => db.all(sql, params)
      : async (sql, params = []) => getLegacyDatabase().all(sql, params),
    run: db && typeof db.run === 'function'
      ? (sql, params = []) => db.run(sql, params)
      : async (sql, params = []) => getLegacyDatabase().run(sql, params),
    save: db && typeof db.save === 'function'
      ? () => db.save()
      : async () => getLegacyDatabase().saveDatabase(),
    transaction: db && typeof db.transaction === 'function'
      ? (fn) => db.transaction(fn)
      : async (fn) => {
          if (typeof overrides.transactionFallback === 'function') {
            return overrides.transactionFallback(fn);
          }
          return runLegacyTransaction(fn, overrides);
        }
  };
}

function getRequestRuntimeDb(req) {
  return req && req.app && req.app.locals ? req.app.locals.database || null : null;
}

function getDatabaseAccessForRequest(req, overrides = {}) {
  return createDatabaseAccess(getRequestRuntimeDb(req), overrides);
}

module.exports = {
  createDatabaseAccess,
  getLegacyDatabase,
  getDatabaseAccessForRequest,
  getRequestRuntimeDb,
  runLegacyTransaction
};

