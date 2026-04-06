"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getDatabaseDialect = getDatabaseDialect;
exports.loadDatabaseConfig = loadDatabaseConfig;
exports.hasPostgresConnectionInfo = hasPostgresConnectionInfo;
function toBoolean(value, fallback) {
    if (value === undefined) {
        return fallback;
    }
    const normalized = String(value).trim().toLowerCase();
    if (!normalized) {
        return fallback;
    }
    return ['1', 'true', 'yes', 'on'].includes(normalized);
}
function toNumber(value, fallback) {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : fallback;
}
function getDatabaseDialect() {
    const raw = String(process.env.DATABASE_DIALECT || 'sqlite').trim().toLowerCase();
    return raw === 'postgres' ? 'postgres' : 'sqlite';
}
function loadDatabaseConfig() {
    const dialect = getDatabaseDialect();
    if (dialect === 'postgres') {
        const config = {
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
    const sqliteConfig = {
        dialect: 'sqlite',
        filename: String(process.env.MILO_DB_FILENAME || 'milo-pro.db').trim() || 'milo-pro.db'
    };
    return sqliteConfig;
}
function hasPostgresConnectionInfo(config) {
    if (config.dialect !== 'postgres') {
        return false;
    }
    if (config.connectionString) {
        return true;
    }
    return Boolean(config.host && config.database && config.user);
}
