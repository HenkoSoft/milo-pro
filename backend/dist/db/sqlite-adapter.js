"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SqliteDatabaseAdapter = void 0;
const legacyDatabase = require('../../../database');
const database = legacyDatabase;
class SqliteDatabaseAdapter {
    dialect = 'sqlite';
    async initialize() {
        await database.initializeDatabase();
    }
    async close() {
        return Promise.resolve();
    }
    async get(sql, params = []) {
        return database.get(sql, params);
    }
    async all(sql, params = []) {
        return database.all(sql, params);
    }
    async run(sql, params = []) {
        const result = database.run(sql, params);
        return {
            lastInsertRowid: typeof result?.lastInsertRowid === 'number' ? result.lastInsertRowid : null,
            rowCount: 0
        };
    }
    async transaction(fn) {
        const wrapped = database.transaction(() => fn(this));
        return Promise.resolve(wrapped());
    }
    async save() {
        database.saveDatabase();
    }
}
exports.SqliteDatabaseAdapter = SqliteDatabaseAdapter;
