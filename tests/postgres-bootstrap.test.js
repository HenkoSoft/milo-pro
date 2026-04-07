const assert = require('node:assert/strict');

function runCase(name, fn) {
  Promise.resolve()
    .then(fn)
    .then(() => {
      console.log(`PASS ${name}`);
    })
    .catch((error) => {
      console.error(`FAIL ${name}`);
      throw error;
    });
}

function createClientMock(userCount = 0) {
  const calls = [];

  return {
    calls,
    async query(sql, params = []) {
      calls.push({ sql: String(sql), params: [...params] });
      if (String(sql).includes('SELECT COUNT(*)::int AS count FROM users')) {
        return { rows: [{ count: userCount }] };
      }
      return { rows: [] };
    }
  };
}

async function main() {
  const { bootstrapPostgresSchema } = require('../backend/dist/db/postgres-schema.js');

  await (async () => {
    const client = createClientMock(0);
    delete process.env.MILO_DISABLE_SEED;

    await bootstrapPostgresSchema(client, 'public');

    const statements = client.calls.map((entry) => entry.sql);

    assert.ok(statements.some((sql) => sql.includes('CREATE SCHEMA IF NOT EXISTS "public"')));
    assert.ok(statements.some((sql) => sql.includes('CREATE TABLE IF NOT EXISTS users')));
    assert.ok(statements.some((sql) => sql.includes('CREATE TABLE IF NOT EXISTS products')));
    assert.ok(statements.some((sql) => sql.includes('INSERT INTO settings (id, business_name) VALUES (1, \'Milo Pro\') ON CONFLICT (id) DO NOTHING')));
    assert.ok(statements.some((sql) => sql.includes("INSERT INTO users (username, password, role, name) VALUES ('admin'")));
    assert.ok(statements.some((sql) => sql.includes("INSERT INTO users (username, password, role, name) VALUES ('tech'")));
    assert.ok(statements.some((sql) => sql.includes('INSERT INTO categories (name, description) VALUES ($1, $2)')));
    assert.ok(statements.some((sql) => sql.includes('INSERT INTO products (sku, name, category_id, supplier, purchase_price, sale_price, stock)')));

    console.log('PASS bootstrap crea schema base y seed inicial cuando la base esta vacia');
  })();

  await (async () => {
    const client = createClientMock(2);
    delete process.env.MILO_DISABLE_SEED;

    await bootstrapPostgresSchema(client, 'public');

    const statements = client.calls.map((entry) => entry.sql);
    assert.ok(!statements.some((sql) => sql.includes("INSERT INTO users (username, password, role, name) VALUES ('admin'")));
    assert.ok(!statements.some((sql) => sql.includes('INSERT INTO products (sku, name, category_id, supplier, purchase_price, sale_price, stock)')));

    console.log('PASS bootstrap no duplica seed si ya existen usuarios');
  })();

  await (async () => {
    const client = createClientMock(0);
    process.env.MILO_DISABLE_SEED = '1';

    await bootstrapPostgresSchema(client, 'public');

    const statements = client.calls.map((entry) => entry.sql);
    assert.ok(!statements.some((sql) => sql.includes("INSERT INTO users (username, password, role, name) VALUES ('admin'")));
    assert.ok(!statements.some((sql) => sql.includes('SELECT COUNT(*)::int AS count FROM users')));

    delete process.env.MILO_DISABLE_SEED;
    console.log('PASS bootstrap respeta MILO_DISABLE_SEED');
  })();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
