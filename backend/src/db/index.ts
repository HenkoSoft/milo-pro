export * from './types';
export { getDatabaseDialect, hasPostgresConnectionInfo, loadDatabaseConfig } from './config';
export { SqliteDatabaseAdapter } from './sqlite-adapter';
export { PostgresDatabaseAdapter, convertQuestionParamsToPg } from './postgres-adapter';
export { initializeRuntimeDatabase } from './runtime';

import { loadDatabaseConfig } from './config';
import { PostgresDatabaseAdapter } from './postgres-adapter';
import { SqliteDatabaseAdapter } from './sqlite-adapter';
import type { DatabaseAdapter } from './types';

export function createDatabaseAdapter(): DatabaseAdapter {
  const config = loadDatabaseConfig();
  return config.dialect === 'postgres'
    ? new PostgresDatabaseAdapter(config)
    : new SqliteDatabaseAdapter();
}
