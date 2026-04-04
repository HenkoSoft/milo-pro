const assert = require('node:assert/strict');
const fs = require('fs');
const http = require('http');
const path = require('path');
const express = require('express');
const jwt = require('jsonwebtoken');

async function createHarness() {
  const dbFilename = `auth-customers-test-${Date.now()}-${Math.random().toString(16).slice(2)}.db`;
  process.env.MILO_DB_FILENAME = dbFilename;
  process.env.MILO_DISABLE_SEED = '1';

  const moduleIds = [
    '../database',
    '../auth',
    '../routes/auth',
    '../routes/customers'
  ];

  moduleIds.forEach((moduleId) => {
    try {
      delete require.cache[require.resolve(moduleId)];
    } catch (error) {
      // ignore cache misses
    }
  });

  const database = require('../database');
  await database.initializeDatabase();

  let adminUser = database.get('SELECT id, username, role, name FROM users WHERE username = ?', ['admin']);
  let techUser = database.get('SELECT id, username, role, name FROM users WHERE username = ?', ['tech']);

  if (!adminUser) {
    const adminResult = database.run(
      'INSERT INTO users (username, password, role, name) VALUES (?, ?, ?, ?)',
      ['admin', require('bcryptjs').hashSync('admin123', 10), 'admin', 'Admin Test']
    );
    adminUser = { id: adminResult.lastInsertRowid, username: 'admin', role: 'admin', name: 'Admin Test' };
  }

  if (!techUser) {
    const techResult = database.run(
      'INSERT INTO users (username, password, role, name) VALUES (?, ?, ?, ?)',
      ['tech', require('bcryptjs').hashSync('tech123', 10), 'technician', 'Tech Test']
    );
    techUser = { id: techResult.lastInsertRowid, username: 'tech', role: 'technician', name: 'Tech Test' };
  }

  database.saveDatabase();

  const { JWT_SECRET } = require('../auth');
  const authRoutes = require('../routes/auth');
  const customerRoutes = require('../routes/customers');

  const app = express();
  app.use(express.json());
  app.use('/api/auth', authRoutes);
  app.use('/api/customers', customerRoutes);
  app.use((err, _req, res, next) => {
    if (res.headersSent) return next(err);
    res.status(500).json({ error: err.message || 'Internal error' });
  });

  const server = await new Promise((resolve) => {
    const instance = app.listen(0, () => resolve(instance));
  });

  const adminToken = jwt.sign(adminUser, JWT_SECRET, { expiresIn: '24h' });
  const techToken = jwt.sign(techUser, JWT_SECRET, { expiresIn: '24h' });

  return {
    database,
    adminToken,
    techToken,
    port: server.address().port,
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
              } catch (error) {
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
        } catch (error) {
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
  await runCase('auth login, me y permisos de usuarios funcionan', async () => {
    const harness = await createHarness();
    try {
      const login = await harness.request('POST', '/api/auth/login', { username: 'admin', password: 'admin123' });
      assert.equal(login.statusCode, 200);
      assert.ok(login.body.token);
      assert.equal(login.body.user.username, 'admin');
      assert.equal(login.body.user.role, 'admin');
      assert.equal(login.body.user.password, undefined);

      const invalid = await harness.request('POST', '/api/auth/login', { username: 'admin', password: 'wrong' });
      assert.equal(invalid.statusCode, 401);
      assert.match(invalid.body.error, /invalid credentials/i);

      const me = await harness.request('GET', '/api/auth/me', undefined, { token: login.body.token });
      assert.equal(me.statusCode, 200);
      assert.equal(me.body.username, 'admin');

      const createDenied = await harness.request(
        'POST',
        '/api/auth/users',
        { username: 'user-nope', password: '1234', role: 'technician', name: 'No Admin' },
        { token: harness.techToken }
      );
      assert.equal(createDenied.statusCode, 403);

      const createUser = await harness.request(
        'POST',
        '/api/auth/users',
        { username: 'new-user', password: '1234', role: 'technician', name: 'Nuevo Usuario' },
        { token: harness.adminToken }
      );
      assert.equal(createUser.statusCode, 200);
      assert.equal(createUser.body.username, 'new-user');
      assert.equal(createUser.body.role, 'technician');

      const users = await harness.request('GET', '/api/auth/users', undefined, { token: harness.adminToken });
      assert.equal(users.statusCode, 200);
      assert.ok(Array.isArray(users.body));
      assert.ok(users.body.some((user) => user.username === 'new-user'));
      assert.ok(users.body.every((user) => user.password === undefined));
    } finally {
      await harness.cleanup();
    }
  });

  await runCase('customers requiere auth y permite CRUD basico', async () => {
    const harness = await createHarness();
    try {
      const unauthorized = await harness.request('GET', '/api/customers');
      assert.equal(unauthorized.statusCode, 401);

      const create = await harness.request(
        'POST',
        '/api/customers',
        {
          name: 'Cliente Uno',
          phone: '11-5555-1111',
          email: 'cliente1@test.local',
          city: 'Buenos Aires',
          credit_limit: '15000',
          discount_percent: '10',
          price_list: '2'
        },
        { token: harness.adminToken }
      );
      assert.equal(create.statusCode, 201);
      assert.equal(create.body.name, 'Cliente Uno');
      assert.equal(Number(create.body.credit_limit), 15000);
      assert.equal(Number(create.body.discount_percent), 10);
      assert.equal(String(create.body.price_list), '2');

      const list = await harness.request('GET', '/api/customers?search=Cliente', undefined, { token: harness.adminToken });
      assert.equal(list.statusCode, 200);
      assert.equal(list.body.length, 1);
      assert.equal(list.body[0].email, 'cliente1@test.local');

      const update = await harness.request(
        'PUT',
        `/api/customers/${create.body.id}`,
        {
          name: 'Cliente Uno Editado',
          phone: '',
          email: 'editado@test.local',
          city: 'Cordoba',
          credit_limit: '20000',
          discount_percent: '12'
        },
        { token: harness.adminToken }
      );
      assert.equal(update.statusCode, 200);
      assert.equal(update.body.name, 'Cliente Uno Editado');
      assert.equal(update.body.phone, null);
      assert.equal(update.body.email, 'editado@test.local');
      assert.equal(Number(update.body.credit_limit), 20000);
      assert.equal(Number(update.body.discount_percent), 12);

      const remove = await harness.request('DELETE', `/api/customers/${create.body.id}`, undefined, { token: harness.adminToken });
      assert.equal(remove.statusCode, 200);
      assert.equal(remove.body.success, true);

      const listAfterDelete = await harness.request('GET', '/api/customers', undefined, { token: harness.adminToken });
      assert.equal(listAfterDelete.statusCode, 200);
      assert.equal(listAfterDelete.body.length, 0);
    } finally {
      await harness.cleanup();
    }
  });

  await runCase('customer detail devuelve ventas y reparaciones relacionadas', async () => {
    const harness = await createHarness();
    try {
      const customerResult = harness.database.run(
        'INSERT INTO customers (name, phone, email) VALUES (?, ?, ?)',
        ['Detalle Cliente', '1133445566', 'detalle@test.local']
      );
      harness.database.run(
        'INSERT INTO sales (customer_id, user_id, total, payment_method, notes) VALUES (?, ?, ?, ?, ?)',
        [customerResult.lastInsertRowid, 1, 12345, 'cash', 'Venta detalle']
      );
      harness.database.run(
        'INSERT INTO repairs (ticket_number, customer_id, device_type, brand, model, problem_description, status) VALUES (?, ?, ?, ?, ?, ?, ?)',
        ['R-0001', customerResult.lastInsertRowid, 'Telefono', 'Samsung', 'S23', 'Pantalla rota', 'received']
      );
      harness.database.saveDatabase();

      const detail = await harness.request('GET', `/api/customers/${customerResult.lastInsertRowid}`, undefined, { token: harness.adminToken });
      assert.equal(detail.statusCode, 200);
      assert.equal(detail.body.name, 'Detalle Cliente');
      assert.ok(Array.isArray(detail.body.sales));
      assert.ok(Array.isArray(detail.body.repairs));
      assert.equal(detail.body.sales.length, 1);
      assert.equal(Number(detail.body.sales[0].total), 12345);
      assert.ok(detail.body.sales[0].user_name);
      assert.equal(detail.body.repairs.length, 1);
      assert.equal(detail.body.repairs[0].brand, 'Samsung');
    } finally {
      await harness.cleanup();
    }
  });
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

