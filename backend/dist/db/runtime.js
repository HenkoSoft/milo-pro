"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.initializeRuntimeDatabase = initializeRuntimeDatabase;
const index_1 = require("./index");
async function initializeRuntimeDatabase() {
    const config = (0, index_1.loadDatabaseConfig)();
    if (config.dialect === 'postgres') {
        throw new Error('DATABASE_DIALECT=postgres todavia no puede activarse en runtime. El backend actual sigue dependiendo de rutas y servicios sincronicos sobre database.js. Primero hay que migrar esos modulos a la abstraccion de backend/src/db.');
    }
    const adapter = (0, index_1.createDatabaseAdapter)();
    await adapter.initialize();
    return {
        adapter,
        requestedDialect: config.dialect,
        activeDialect: adapter.dialect,
        postgresRuntimeReady: false
    };
}
