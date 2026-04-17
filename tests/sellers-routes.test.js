const assert = require('node:assert/strict');
const fs = require('fs');
const http = require('http');
const path = require('path');
const express = require('express');
const jwt = require('jsonwebtoken');

async function createHarness() {
  const dbFilename = `sellers-routes-test-${Date.now()}-${Math.random().toString(16).slice(2)}.db`;
  process.env.MILO_DB_FILENAME = dbFilename;
  process.env.MILO_DISABLE_SEED = '1';

  const moduleIds = [
    '../backend/dist/config/database.js',
    '../backend/dist/config/auth.js',
    '../backend/dist/routes/sellers.js'
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

  const customerResult = database.run(
    'INSERT INTO customers (name, seller) VALUES (?, ?)',
    ['Cliente Mostrador', 'Juan Perez']
  );

  database.run(
    `
      INSERT INTO sales (customer_id, user_id, receipt_type, point_of_sale, receipt_number, total, payment_method)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `,
    [customerResult.lastInsertRowid, adminUser.id, 'C', '001', 1, 1000, 'cash']
  );

  database.saveDatabase();

  const { JWT_SECRET } = require('../backend/dist/config/auth.js');
  const sellersRoutes = require('../backend/dist/routes/sellers.js');

  const app = express();
  app.use(express.json());
  app.use('/api/sellers', sellersRoutes);

  const server = await new Promise((resolve) => {
    const instance = app.listen(0, () => resolve(instance));
  });

  const adminToken = jwt.sign(adminUser, JWT_SECRET, { expiresIn: '24h' });

  return {
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
  await runCase('sellers requiere auth y persiste catalogo y pagos', async () => {
    const harness = await createHarness();
    try {
      const unauthorized = await harness.request('GET', '/api/sellers');
      assert.equal(unauthorized.statusCode, 401);

      const derivedList = await harness.request('GET', '/api/sellers', undefined, { token: harness.adminToken });
      assert.equal(derivedList.statusCode, 200);
      assert.equal(derivedList.body.length, 1);
      assert.equal(derivedList.body[0].id, 'seller-juan-perez');
      assert.equal(derivedList.body[0].name, 'Juan Perez');

      const save = await harness.request(
        'POST',
        '/api/sellers',
        {
          id: 'seller-juan-perez',
          code: 'VEN-001',
          name: 'Juan Perez',
          address: 'Calle 123',
          phone: '1111-1111',
          cell: '2222-2222',
          commission_percent: 7.5,
          source: 'derived'
        },
        { token: harness.adminToken }
      );
      assert.equal(save.statusCode, 201);
      assert.equal(save.body.commission_percent, 7.5);

      const createManual = await harness.request(
        'POST',
        '/api/sellers',
        {
          code: 'VEN-002',
          name: 'Maria Gomez',
          address: '',
          phone: '',
          cell: '',
          commission_percent: 5
        },
        { token: harness.adminToken }
      );
      assert.equal(createManual.statusCode, 201);
      assert.equal(createManual.body.id, 'seller-maria-gomez');

      const createPayment = await harness.request(
        'POST',
        '/api/sellers/payments',
        {
          payment_date: '2026-04-15T12:00:00.000Z',
          seller_id: 'seller-juan-perez',
          seller_name: 'Juan Perez',
          total_paid: 75,
          total_sales: 1000,
          sale_ids: ['1']
        },
        { token: harness.adminToken }
      );
      assert.equal(createPayment.statusCode, 201);
      assert.deepEqual(createPayment.body.sale_ids, ['1']);

      const payments = await harness.request('GET', '/api/sellers/payments', undefined, { token: harness.adminToken });
      assert.equal(payments.statusCode, 200);
      assert.equal(payments.body.length, 1);
      assert.equal(payments.body[0].seller_id, 'seller-juan-perez');

      const remove = await harness.request('DELETE', '/api/sellers/seller-maria-gomez', undefined, { token: harness.adminToken });
      assert.equal(remove.statusCode, 200);

      const finalList = await harness.request('GET', '/api/sellers', undefined, { token: harness.adminToken });
      assert.equal(finalList.statusCode, 200);
      assert.equal(finalList.body.some((seller) => seller.id === 'seller-maria-gomez'), false);
      assert.equal(finalList.body.some((seller) => seller.id === 'seller-juan-perez'), true);
    } finally {
      await harness.cleanup();
    }
  });
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
