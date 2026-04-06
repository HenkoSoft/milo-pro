"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.initializeRuntimeDatabase = exports.convertQuestionParamsToPg = exports.PostgresDatabaseAdapter = exports.SqliteDatabaseAdapter = exports.loadDatabaseConfig = exports.hasPostgresConnectionInfo = exports.getDatabaseDialect = void 0;
exports.createDatabaseAdapter = createDatabaseAdapter;
__exportStar(require("./types"), exports);
var config_1 = require("./config");
Object.defineProperty(exports, "getDatabaseDialect", { enumerable: true, get: function () { return config_1.getDatabaseDialect; } });
Object.defineProperty(exports, "hasPostgresConnectionInfo", { enumerable: true, get: function () { return config_1.hasPostgresConnectionInfo; } });
Object.defineProperty(exports, "loadDatabaseConfig", { enumerable: true, get: function () { return config_1.loadDatabaseConfig; } });
var sqlite_adapter_1 = require("./sqlite-adapter");
Object.defineProperty(exports, "SqliteDatabaseAdapter", { enumerable: true, get: function () { return sqlite_adapter_1.SqliteDatabaseAdapter; } });
var postgres_adapter_1 = require("./postgres-adapter");
Object.defineProperty(exports, "PostgresDatabaseAdapter", { enumerable: true, get: function () { return postgres_adapter_1.PostgresDatabaseAdapter; } });
Object.defineProperty(exports, "convertQuestionParamsToPg", { enumerable: true, get: function () { return postgres_adapter_1.convertQuestionParamsToPg; } });
var runtime_1 = require("./runtime");
Object.defineProperty(exports, "initializeRuntimeDatabase", { enumerable: true, get: function () { return runtime_1.initializeRuntimeDatabase; } });
const config_2 = require("./config");
const postgres_adapter_2 = require("./postgres-adapter");
const sqlite_adapter_2 = require("./sqlite-adapter");
function createDatabaseAdapter() {
    const config = (0, config_2.loadDatabaseConfig)();
    return config.dialect === 'postgres'
        ? new postgres_adapter_2.PostgresDatabaseAdapter(config)
        : new sqlite_adapter_2.SqliteDatabaseAdapter();
}
