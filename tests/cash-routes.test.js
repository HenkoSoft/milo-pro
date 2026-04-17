const assert = require('node:assert/strict');
const fs = require('fs');
const http = require('http');
const path = require('path');
const express = require('express');
const jwt = require('jsonwebtoken');

async function createHarness() {
  const dbFilename = `cash-routes-test-${Date.now()}-${Math.random().toString(16).slice(2)}.db`;
  process.env.MILO_DB_FILENAME = dbFilename;
  process.env.MILO_DISABLE_SEED = '1';

  const moduleIds = [
    '../backend/dist/config/database.js',
    '../backend/dist/config/auth.js',
    '../backend/dist/routes/cash.js'
  ];

  moduleIds.forEach((moduleId) => {
    try {
      delete require.cache[require.resolve(moduleId)];
    } catch (_error) {
      // ignore cache misses
    }
  });

  const database = require('../backend/dist/config/database.js');
  await database.initializeDatabase();

  let adminUser = database.get('SELECT id, username, role, name FROM users WHERE username = ?', ['admin']);
  if (!adminUser) {
    const bcrypt = require('bcryptjs');
    const result = database.run(
      'INSERT INTO users (username, password, role, name) VALUES (?, ?, ?, ?)',
      ['admin', bcrypt.hashSync('admin123', 10), 'admin', 'Admin Test']
    );
    adminUser = { id: result.lastInsertRowid, username: 'admin', role: 'admin', name: 'Admin Test' };
  }

  database.saveDatabase();

  const { JWT_SECRET } = require('../backend/dist/config/auth.js');
  const cashRoutes = require('../backend/dist/routes/cash.js');

  const app = express();
  app.use(express.json());
  app.use('/api/cash', cashRoutes);

  const server = await new Promise((resolve) => {
    const instance = app.listen(0, () => resolve(instance));
  });

  const adminToken = jwt.sign(adminUser, JWT_SECRET, { expiresIn: '24h' });

  return {
    database,
    adminToken,
    async request(method, routePath, body, options = {}) {
      const payload = body === undefined ? null : JSON.stringify(body);
      const headers = {
        ...(payload ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) } : {}),
        ...(options.token ? { Authorization: `Bearer ${options.token}` } : {}),
        ...(options.headers || {})
      };

      return new Promise((resolve, reject) => {
        const req = http.request({
          hostname: '127.0.0.1',
          port: server.address().port,
          path: routePath,
          method,
          headers
        }, (res) => {
          let responseBody = '';
          res.on('data', (chunk) => {
            responseBody += chunk;
          });
          res.on('end', () => {
            let parsed = null;
            if (responseBody) {
              try {
                parsed = JSON.parse(responseBody);
              } catch {
                parsed = responseBody;
              }
            }
            resolve({ statusCode: res.statusCode, body: parsed });
          });
        });
        req.on('error', reject);
        if (payload) req.write(payload);
        req.end();
      });
    },
    async cleanup() {
      await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
      const dbPath = path.join(process.cwd(), 'data', dbFilename);
      if (fs.existsSync(dbPath)) {
        fs.unlinkSync(dbPath);
      }
      delete process.env.MILO_DB_FILENAME;
      delete process.env.MILO_DISABLE_SEED;
      moduleIds.forEach((moduleId) => {
        try {
          delete require.cache[require.resolve(moduleId)];
        } catch (_error) {
          // ignore cache misses
        }
      });
    }
  };
}

async function runCase(name, fn) {
  try {
    await fn();
    console.log(`PASS ${name}`);
  } catch (error) {
    console.error(`FAIL ${name}`);
    throw error;
  }
}

async function main() {
  await runCase('cash requiere auth y permite crear y listar movimientos', async () => {
    const harness = await createHarness();
    try {
      const unauthorized = await harness.request('GET', '/api/cash');
      assert.equal(unauthorized.statusCode, 401);

      const createIncome = await harness.request(
        'POST',
        '/api/cash',
        { type: 'income', date: '2026-04-15', description: 'Cobranza mostrador', person: 'Cliente Demo', amount: 1500, notes: 'Ingreso manual' },
        { token: harness.adminToken }
      );
      assert.equal(createIncome.statusCode, 201);
      assert.equal(createIncome.body.type, 'income');

      const createExpense = await harness.request(
        'POST',
        '/api/cash',
        { type: 'expenses', date: '2026-04-15', description: 'Compra menor', person: 'Proveedor Demo', amount: 500, notes: 'Gasto manual' },
        { token: harness.adminToken }
      );
      assert.equal(createExpense.statusCode, 201);
      assert.equal(createExpense.body.type, 'expenses');

      const list = await harness.request('GET', '/api/cash', undefined, { token: harness.adminToken });
      assert.equal(list.statusCode, 200);
      assert.equal(list.body.length, 2);

      const onlyIncome = await harness.request('GET', '/api/cash?type=income', undefined, { token: harness.adminToken });
      assert.equal(onlyIncome.statusCode, 200);
      assert.equal(onlyIncome.body.length, 1);
      assert.equal(onlyIncome.body[0].type, 'income');
    } finally {
      await harness.cleanup();
    }
  });
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
