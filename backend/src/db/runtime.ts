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

  if (config.dialect === 'postgres') {
    throw new Error(
      'DATABASE_DIALECT=postgres todavia no puede activarse en runtime. El backend actual sigue dependiendo de rutas y servicios sincronicos sobre database.js. Primero hay que migrar esos modulos a la abstraccion de backend/src/db.'
    );
  }

  const adapter = createDatabaseAdapter();
  await adapter.initialize();

  return {
    adapter,
    requestedDialect: config.dialect,
    activeDialect: adapter.dialect,
    postgresRuntimeReady: false
  };
}
