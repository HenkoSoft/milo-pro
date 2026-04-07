const { spawn } = require('child_process');

const STEPS = [
  { label: 'validate:postgres', command: 'npm.cmd', args: ['run', 'validate:postgres'] },
  { label: 'migrate:postgres', command: 'npm.cmd', args: ['run', 'migrate:postgres'] },
  { label: 'verify:postgres', command: 'npm.cmd', args: ['run', 'verify:postgres'] },
  { label: 'smoke:postgres', command: 'npm.cmd', args: ['run', 'smoke:postgres'] }
];

function ensurePostgresEnv() {
  const hasConnectionString = Boolean(process.env.DATABASE_URL);
  const hasDiscreteConfig = Boolean(process.env.PGHOST && process.env.PGDATABASE && process.env.PGUSER);

  if (!hasConnectionString && !hasDiscreteConfig) {
    throw new Error('Defini DATABASE_URL o PGHOST + PGDATABASE + PGUSER antes de ejecutar postgres:cutover-check.');
  }
}

function runStep(step) {
  return new Promise((resolve, reject) => {
    console.log(`[PG-CUTOVER] Running ${step.label}...`);

    const child = spawn(step.command, step.args, {
      env: {
        ...process.env,
        DATABASE_DIALECT: process.env.DATABASE_DIALECT || 'postgres'
      },
      stdio: 'inherit',
      shell: false
    });

    child.on('exit', (code) => {
      if (code === 0) {
        console.log(`[PG-CUTOVER] ${step.label} OK`);
        resolve();
        return;
      }

      reject(new Error(`${step.label} failed with exit code ${code}`));
    });
  });
}

async function main() {
  ensurePostgresEnv();

  for (const step of STEPS) {
    await runStep(step);
  }

  console.log('[PG-CUTOVER] PostgreSQL cutover check completed successfully');
}

main().catch((error) => {
  console.error('[PG-CUTOVER] Failed:', error);
  process.exit(1);
});
