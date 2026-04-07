import { createDatabaseAdapter, loadDatabaseConfig } from './index';
import type { DatabaseAdapter, DatabaseDialect } from './types';

export type RuntimeDatabaseState = {
  adapter: DatabaseAdapter;
  requestedDialect: DatabaseDialect;
  activeDialect: DatabaseDialect;
  postgresRuntimeReady: boolean;
};

export async function initializeRuntimeDatabase(): Promise<RuntimeDatabaseState> {
  const config = loadDatabaseConfig();

  const adapter = createDatabaseAdapter();
  await adapter.initialize();

  return {
    adapter,
    requestedDialect: config.dialect,
    activeDialect: adapter.dialect,
    postgresRuntimeReady: adapter.dialect === 'postgres'
  };
}
