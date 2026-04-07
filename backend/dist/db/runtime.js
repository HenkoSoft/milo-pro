"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.initializeRuntimeDatabase = initializeRuntimeDatabase;
const index_1 = require("./index");
async function initializeRuntimeDatabase() {
    const config = (0, index_1.loadDatabaseConfig)();
    const adapter = (0, index_1.createDatabaseAdapter)();
    await adapter.initialize();
    return {
        adapter,
        requestedDialect: config.dialect,
        activeDialect: adapter.dialect,
        postgresRuntimeReady: adapter.dialect === 'postgres'
    };
}
