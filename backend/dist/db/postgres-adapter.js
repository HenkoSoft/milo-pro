"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PostgresDatabaseAdapter = void 0;
exports.convertQuestionParamsToPg = convertQuestionParamsToPg;
function convertQuestionParamsToPg(sql) {
    let index = 0;
    let result = '';
    let inSingleQuote = false;
    for (let i = 0; i < sql.length; i += 1) {
        const char = sql[i];
        const next = sql[i + 1];
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
function resolveClientConstructor() {
    try {
        const pg = require('pg');
        if (!pg?.Client) {
            throw new Error('pg.Client no esta disponible');
        }
        return pg.Client;
    }
    catch (error) {
        throw new Error('PostgreSQL requiere instalar la dependencia `pg` antes de activar DATABASE_DIALECT=postgres');
    }
}
class PostgresDatabaseAdapter {
    dialect = 'postgres';
    config;
    client = null;
    constructor(config) {
        this.config = config;
    }
    async initialize() {
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
            await this.client.query(`SET search_path TO ${this.config.schema}`);
        }
    }
    async close() {
        if (!this.client) {
            return;
        }
        await this.client.end();
        this.client = null;
    }
    async get(sql, params = []) {
        const result = await this.query(sql, params);
        return result.rows[0] || null;
    }
    async all(sql, params = []) {
        const result = await this.query(sql, params);
        return result.rows;
    }
    async run(sql, params = []) {
        const result = await this.query(sql, params);
        const firstRow = result.rows[0];
        return {
            lastInsertRowid: typeof firstRow?.id === 'number' ? firstRow.id : null,
            rowCount: typeof result.rowCount === 'number' ? result.rowCount : 0
        };
    }
    async transaction(fn) {
        await this.query('BEGIN');
        try {
            const value = await fn(this);
            await this.query('COMMIT');
            return value;
        }
        catch (error) {
            await this.query('ROLLBACK');
            throw error;
        }
    }
    async save() {
        return Promise.resolve();
    }
    async query(sql, params = []) {
        if (!this.client) {
            throw new Error('PostgreSQL adapter no inicializado');
        }
        return this.client.query(convertQuestionParamsToPg(sql), params);
    }
}
exports.PostgresDatabaseAdapter = PostgresDatabaseAdapter;
