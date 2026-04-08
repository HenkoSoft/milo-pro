const assert = require('node:assert/strict');
const fs = require('fs');
const http = require('http');
const path = require('path');
const express = require('express');
const jwt = require('jsonwebtoken');

async function createHarness() {
  const dbFilename = `sales-routes-test-${Date.now()}-${Math.random().toString(16).slice(2)}.db`;
  process.env.MILO_DB_FILENAME = dbFilename;
  process.env.MILO_DISABLE_SEED = '1';

  const moduleIds = [
    '../backend/src/config/database',
    '../backend/src/config/auth',
    '../backend/src/routes/sales',
    '../backend/src/services/woocommerce-sync',
    '../backend/src/services/woo-order-sync'
  ];

  moduleIds.forEach((moduleId) => {
    try {
      delete require.cache[require.resolve(moduleId)];
    } catch (error) {
      // ignore cache misses
    }
  });

  const database = require('../backend/src/config/database');
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

  let customer = database.get('SELECT id, name FROM customers WHERE email = ?', ['sales@test.local']);
  if (!customer) {
    const customerResult = database.run('INSERT INTO customers (name, phone, email) VALUES (?, ?, ?)', ['Cliente Ventas', '1111222233', 'sales@test.local']);
    customer = { id: customerResult.lastInsertRowid, name: 'Cliente Ventas' };
  }

  let product = database.get('SELECT id, name, stock FROM products WHERE name = ?', ['Producto Venta Test']);
  if (!product) {
    const productResult = database.run(
      'INSERT INTO products (sku, name, sale_price, stock, min_stock, active) VALUES (?, ?, ?, ?, ?, ?)',
      ['ART-000999', 'Producto Venta Test', 1500, 10, 2, 1]
    );
    product = { id: productResult.lastInsertRowid, name: 'Producto Venta Test', stock: 10 };
  }

  database.saveDatabase();

  const syncCalls = [];
  const testSyncCalls = [];
  const statusCalls = [];

  const wooSyncPath = require.resolve('../backend/src/services/woocommerce-sync');
  require.cache[wooSyncPath] = {
    id: wooSyncPath,
    filename: wooSyncPath,
    loaded: true,
    exports: {
      syncProductSnapshotToWooCommerce: async (snapshot, options = {}) => {
        syncCalls.push({ snapshot, options });
        return { success: true, skipped: true, productId: snapshot.id };
      },
      syncProductToWooCommerce: async (productId, options = {}) => {
        testSyncCalls.push({ productId, options });
        return { success: true, skipped: true, productId: Number(productId) };
      }
    }
  };

  const orderSyncPath = require.resolve('../backend/src/services/woo-order-sync');
  require.cache[orderSyncPath] = {
    id: orderSyncPath,
    filename: orderSyncPath,
    loaded: true,
    exports: {
      normalizeInternalSaleStatus: (value) => String(value || '')
        .trim()
        .toLowerCase()
        .replace(/\s+/g, '_')
        .replace(/-/g, '_') || 'pending_payment',
      updateSaleStatus: async (saleId, nextStatus, options = {}) => {
        statusCalls.push({ saleId, nextStatus, options });
        const sale = database.get('SELECT * FROM sales WHERE id = ?', [saleId]);
        if (!sale) {
          throw new Error('Sale not found');
        }
        database.run(
          'UPDATE sales SET status = ?, payment_status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
          [nextStatus, nextStatus === 'paid' || nextStatus === 'completed' || nextStatus === 'ready_for_delivery' ? 'paid' : 'pending', saleId]
        );
        const updated = database.get('SELECT * FROM sales WHERE id = ?', [saleId]);
        database.saveDatabase();
        return {
          success: true,
          sale: updated,
          note: options.note || '',
          syncToWoo: options.syncToWoo !== false
        };
      }
    }
  };

  const { JWT_SECRET } = require('../backend/src/config/auth');
  const salesRoutes = require('../backend/src/routes/sales');

  const app = express();
  app.use(express.json());
  app.use('/api/sales', salesRoutes);
  app.use((err, _req, res, next) => {
    if (res.headersSent) return next(err);
    res.status(500).json({ error: err.message || 'Internal error' });
  });

  const server = await new Promise((resolve) => {
    const instance = app.listen(0, () => resolve(instance));
  });

  const adminToken = jwt.sign(adminUser, JWT_SECRET, { expiresIn: '24h' });

  return {
    database,
    adminToken,
    customerId: customer.id,
    productId: product.id,
    syncCalls,
    testSyncCalls,
    statusCalls,
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
  await runCase('sales crea venta local, descuenta stock y expone endpoints de consulta', async () => {
    const harness = await createHarness();
    try {
      const unauthorized = await harness.request('GET', '/api/sales');
      assert.equal(unauthorized.statusCode, 401);

      const nextNumber = await harness.request('GET', '/api/sales/next-number?receiptType=C&pointOfSale=1', undefined, { token: harness.adminToken });
      assert.equal(nextNumber.statusCode, 200);
      assert.equal(nextNumber.body.receipt_type, 'C');
      assert.equal(nextNumber.body.point_of_sale, '001');
      assert.equal(Number(nextNumber.body.receipt_number), 1);

      const create = await harness.request(
        'POST',
        '/api/sales',
        {
          customer_id: harness.customerId,
          payment_method: 'cash',
          notes: 'Venta test',
          receipt_type: 'C',
          point_of_sale: '1',
          items: [
            { product_id: harness.productId, quantity: 2, unit_price: 1500 }
          ]
        },
        { token: harness.adminToken }
      );
      assert.equal(create.statusCode, 201);
      assert.equal(Number(create.body.sale.total), 3000);
      assert.equal(harness.syncCalls.length, 1);

      const productAfterCreate = harness.database.get('SELECT stock FROM products WHERE id = ?', [harness.productId]);
      assert.equal(Number(productAfterCreate.stock), 8);

      const today = await harness.request('GET', '/api/sales/today', undefined, { token: harness.adminToken });
      assert.equal(today.statusCode, 200);
      assert.equal(Number(today.body.salesCount), 1);
      assert.equal(Number(today.body.totalRevenue), 3000);

      const detail = await harness.request('GET', `/api/sales/${create.body.sale.id}`, undefined, { token: harness.adminToken });
      assert.equal(detail.statusCode, 200);
      assert.equal(detail.body.items.length, 1);
      assert.equal(Number(detail.body.items[0].quantity), 2);

      const list = await harness.request('GET', '/api/sales', undefined, { token: harness.adminToken });
      assert.equal(list.statusCode, 200);
      assert.ok(Array.isArray(list.body));
      assert.ok(list.body.some((sale) => Number(sale.id) === Number(create.body.sale.id)));
    } finally {
      await harness.cleanup();
    }
  });

  await runCase('sales feed online, test-sync, estado y borrado funcionan', async () => {
    const harness = await createHarness();
    try {
      const saleResult = harness.database.run(
        'INSERT INTO sales (customer_id, user_id, channel, status, payment_status, receipt_type, point_of_sale, receipt_number, total, payment_method, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [harness.customerId, 1, 'woocommerce', 'pending_payment', 'pending', 'C', '001', 1, 4500, 'cash', 'Pedido web']
      );
      harness.database.run(
        'INSERT INTO sale_items (sale_id, product_id, quantity, unit_price, subtotal) VALUES (?, ?, ?, ?, ?)',
        [saleResult.lastInsertRowid, harness.productId, 1, 1500, 1500]
      );
      harness.database.saveDatabase();

      const onlineFeed = await harness.request('GET', '/api/sales/online-feed', undefined, { token: harness.adminToken });
      assert.equal(onlineFeed.statusCode, 200);
      assert.ok(onlineFeed.body.some((sale) => Number(sale.id) === Number(saleResult.lastInsertRowid)));

      const testSync = await harness.request('POST', `/api/sales/test-sync/${harness.productId}`, undefined, { token: harness.adminToken });
      assert.equal(testSync.statusCode, 200);
      assert.equal(harness.testSyncCalls.length, 1);

      const updateStatus = await harness.request(
        'PUT',
        `/api/sales/${saleResult.lastInsertRowid}/status`,
        { status: 'paid', note: 'Cobrado', sync_to_woo: false },
        { token: harness.adminToken }
      );
      assert.equal(updateStatus.statusCode, 200);
      assert.equal(updateStatus.body.sale.status, 'paid');
      assert.equal(harness.statusCalls.length, 1);
      assert.equal(harness.statusCalls[0].options.syncToWoo, false);

      const invalidStatus = await harness.request(
        'PUT',
        `/api/sales/${saleResult.lastInsertRowid}/status`,
        { status: 'estado-raro' },
        { token: harness.adminToken }
      );
      assert.equal(invalidStatus.statusCode, 400);

      const saleToDelete = await harness.request(
        'POST',
        '/api/sales',
        {
          customer_id: harness.customerId,
          payment_method: 'cash',
          receipt_type: 'C',
          point_of_sale: '1',
          items: [{ product_id: harness.productId, quantity: 2, unit_price: 1500 }]
        },
        { token: harness.adminToken }
      );
      assert.equal(saleToDelete.statusCode, 201);
      const productAfterCreate = harness.database.get('SELECT stock FROM products WHERE id = ?', [harness.productId]);
      assert.equal(Number(productAfterCreate.stock), 8);

      const remove = await harness.request('DELETE', `/api/sales/${saleToDelete.body.sale.id}`, undefined, { token: harness.adminToken });
      assert.equal(remove.statusCode, 200);
      assert.equal(remove.body.success, true);

      const productAfterDelete = harness.database.get('SELECT stock FROM products WHERE id = ?', [harness.productId]);
      assert.equal(Number(productAfterDelete.stock), 10);
    } finally {
      await harness.cleanup();
    }
  });
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

