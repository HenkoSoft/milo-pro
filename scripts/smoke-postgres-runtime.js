const { spawn } = require('child_process');

function requirePostgresEnv() {
  const hasConnectionString = Boolean(process.env.DATABASE_URL);
  const hasDiscreteConfig = Boolean(process.env.PGHOST && process.env.PGDATABASE && process.env.PGUSER);

  if (!hasConnectionString && !hasDiscreteConfig) {
    throw new Error('Defini DATABASE_URL o PGHOST + PGDATABASE + PGUSER para ejecutar el smoke test PostgreSQL.');
  }
}

function waitForServer(child, timeoutMs) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`Timeout esperando arranque del backend PostgreSQL (${timeoutMs}ms)`));
    }, timeoutMs);

    child.stdout.on('data', (chunk) => {
      const text = String(chunk);
      process.stdout.write(text);
      if (text.includes('milo-pro running on http://localhost:')) {
        clearTimeout(timer);
        resolve();
      }
    });

    child.stderr.on('data', (chunk) => {
      process.stderr.write(String(chunk));
    });

    child.on('exit', (code) => {
      clearTimeout(timer);
      reject(new Error(`El backend termino antes del smoke test (exit ${code})`));
    });
  });
}

async function main() {
  requirePostgresEnv();

  const port = Number(process.env.PORT || 3010);
  const child = spawn(
    process.execPath,
    ['backend/dist/server.js'],
    {
      env: {
        ...process.env,
        DATABASE_DIALECT: 'postgres',
        PORT: String(port),
        FRONTEND_MODE: process.env.FRONTEND_MODE || 'react'
      },
      stdio: ['ignore', 'pipe', 'pipe']
    }
  );

  try {
    await waitForServer(child, 20000);

    const healthResponse = await fetch(`http://127.0.0.1:${port}/api/health`);
    if (!healthResponse.ok) {
      throw new Error(`Health check devolvio HTTP ${healthResponse.status}`);
    }

    const health = await healthResponse.json();
    if (health.active_db_dialect !== 'postgres') {
      throw new Error(`Se esperaba active_db_dialect=postgres y llego ${health.active_db_dialect}`);
    }

    if (!health.postgres_runtime_ready) {
      throw new Error('postgres_runtime_ready sigue en false');
    }

    const loginResponse = await fetch(`http://127.0.0.1:${port}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'admin', password: 'admin123' })
    });

    if (!loginResponse.ok) {
      throw new Error(`Login smoke devolvio HTTP ${loginResponse.status}`);
    }

    const loginPayload = await loginResponse.json();
    if (!loginPayload.token || !loginPayload.user) {
      throw new Error('Login smoke no devolvio token/user');
    }

    console.log('[PG-SMOKE] Health y login PostgreSQL OK');
  } finally {
    child.kill('SIGTERM');
  }
}

main().catch((error) => {
  console.error('[PG-SMOKE] Failed:', error);
  process.exit(1);
});
