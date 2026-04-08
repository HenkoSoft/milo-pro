const assert = require('node:assert/strict');

function withEnv(overrides, fn) {
  const previous = {
    DATABASE_DIALECT: process.env.DATABASE_DIALECT,
    DATABASE_URL: process.env.DATABASE_URL,
    PGHOST: process.env.PGHOST,
    PGDATABASE: process.env.PGDATABASE,
    PGUSER: process.env.PGUSER
  };

  Object.keys(previous).forEach((key) => {
    if (Object.prototype.hasOwnProperty.call(overrides, key)) {
      const nextValue = overrides[key];
      if (nextValue === undefined || nextValue === null) {
        delete process.env[key];
      } else {
        process.env[key] = String(nextValue);
      }
    }
  });

  try {
    fn();
  } finally {
    Object.entries(previous).forEach(([key, value]) => {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    });
  }
}

function loadConfigModule() {
  const modulePath = require.resolve('../backend/dist/db/config.js');
  delete require.cache[modulePath];
  return require(modulePath);
}

function runCase(name, fn) {
  try {
    fn();
    console.log(`PASS ${name}`);
  } catch (error) {
    console.error(`FAIL ${name}`);
    throw error;
  }
}

runCase('auto usa sqlite cuando no hay config postgres', () => {
  withEnv({
    DATABASE_DIALECT: undefined,
    DATABASE_URL: undefined,
    PGHOST: undefined,
    PGDATABASE: undefined,
    PGUSER: undefined
  }, () => {
    const config = loadConfigModule();
    assert.equal(config.getDatabaseDialect(), 'sqlite');
  });
});

runCase('auto usa postgres con DATABASE_URL', () => {
  withEnv({
    DATABASE_DIALECT: undefined,
    DATABASE_URL: 'postgres://demo:demo@localhost:5432/demo',
    PGHOST: undefined,
    PGDATABASE: undefined,
    PGUSER: undefined
  }, () => {
    const config = loadConfigModule();
    assert.equal(config.getDatabaseDialect(), 'postgres');
  });
});

runCase('auto usa postgres con variables discretas', () => {
  withEnv({
    DATABASE_DIALECT: undefined,
    DATABASE_URL: undefined,
    PGHOST: '127.0.0.1',
    PGDATABASE: 'milo',
    PGUSER: 'postgres'
  }, () => {
    const config = loadConfigModule();
    assert.equal(config.getDatabaseDialect(), 'postgres');
  });
});

runCase('sqlite explicito pisa autodeteccion', () => {
  withEnv({
    DATABASE_DIALECT: 'sqlite',
    DATABASE_URL: 'postgres://demo:demo@localhost:5432/demo',
    PGHOST: '127.0.0.1',
    PGDATABASE: 'milo',
    PGUSER: 'postgres'
  }, () => {
    const config = loadConfigModule();
    assert.equal(config.getDatabaseDialect(), 'sqlite');
  });
});

runCase('postgres explicito fuerza postgres', () => {
  withEnv({
    DATABASE_DIALECT: 'postgres',
    DATABASE_URL: undefined,
    PGHOST: undefined,
    PGDATABASE: undefined,
    PGUSER: undefined
  }, () => {
    const config = loadConfigModule();
    assert.equal(config.getDatabaseDialect(), 'postgres');
  });
});
