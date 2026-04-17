const assert = require('node:assert/strict');
const fs = require('fs');
const http = require('http');
const path = require('path');
const express = require('express');
const jwt = require('jsonwebtoken');

async function createHarness() {
  const dbFilename = `admin-routes-test-${Date.now()}-${Math.random().toString(16).slice(2)}.db`;
  process.env.MILO_DB_FILENAME = dbFilename;
  process.env.MILO_DISABLE_SEED = '1';

  const moduleIds = [
    '../backend/dist/config/database.js',
    '../backend/dist/config/auth.js',
    '../backend/dist/routes/admin.js'
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

  database.run(
    `
      INSERT INTO admin_connected_sessions (id, username, ip, login_date, last_activity, connection_status)
      VALUES (?, ?, ?, ?, ?, ?)
    `,
    ['sess-1', 'admin', '127.0.0.1', '2026-04-15T10:00:00.000Z', '2026-04-15T10:05:00.000Z', 'Activa']
  );
  database.saveDatabase();

  const { JWT_SECRET } = require('../backend/dist/config/auth.js');
  const adminRoutes = require('../backend/dist/routes/admin.js');

  const app = express();
  app.use(express.json({ limit: '35mb' }));
  app.use('/api/admin', adminRoutes);

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
  await runCase('admin requiere auth y persiste config sesiones y tablas auxiliares', async () => {
    const harness = await createHarness();
    try {
      const unauthorized = await harness.request('GET', '/api/admin/config');
      assert.equal(unauthorized.statusCode, 401);

      const config = await harness.request('GET', '/api/admin/config', undefined, { token: harness.adminToken });
      assert.equal(config.statusCode, 200);
      assert.equal(config.body.general.currency, 'ARS');

      const updateConfig = await harness.request(
        'PUT',
        '/api/admin/config',
        {
          general: { legal_name: 'Milo Pro SRL', logo_name: 'logo.png', logo_data_url: 'data:image/png;base64,AAA' },
          documents: { numbering_format: 'PV-00000001', control_stock: true, allow_negative_stock: false, control_min_price: false, decimals: 2 },
          mail: { smtp_server: 'smtp.demo.test', port: '587', username: 'mailer', password: 'secret', encryption: 'tls', sender_email: 'demo@test.com' }
        },
        { token: harness.adminToken }
      );
      assert.equal(updateConfig.statusCode, 200);
      assert.equal(updateConfig.body.general.legal_name, 'Milo Pro SRL');

      const sessions = await harness.request('GET', '/api/admin/connected-users', undefined, { token: harness.adminToken });
      assert.equal(sessions.statusCode, 200);
      assert.equal(sessions.body.length, 1);
      assert.equal(sessions.body[0].id, 'sess-1');

      const removeSession = await harness.request('DELETE', '/api/admin/connected-users/sess-1', undefined, { token: harness.adminToken });
      assert.equal(removeSession.statusCode, 200);

      const createAux = await harness.request(
        'POST',
        '/api/admin/aux-tables',
        { table_key: 'banks', description: 'Banco Demo', active: true },
        { token: harness.adminToken }
      );
      assert.equal(createAux.statusCode, 201);
      assert.equal(createAux.body.table_key, 'banks');

      const auxRows = await harness.request('GET', '/api/admin/aux-tables?tableKey=banks', undefined, { token: harness.adminToken });
      assert.equal(auxRows.statusCode, 200);
      assert.equal(auxRows.body.length, 1);
      assert.equal(auxRows.body[0].description, 'Banco Demo');

      const deleteAux = await harness.request(`DELETE`, `/api/admin/aux-tables/${auxRows.body[0].id}`, undefined, { token: harness.adminToken });
      assert.equal(deleteAux.statusCode, 200);

      const clearCache = await harness.request('POST', '/api/admin/troubleshoot/cache', {}, { token: harness.adminToken });
      assert.equal(clearCache.statusCode, 200);
    } finally {
      await harness.cleanup();
    }
  });
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
