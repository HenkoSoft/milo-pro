const assert = require('node:assert/strict');
const fs = require('fs');
const http = require('http');
const path = require('path');
const express = require('express');
const jwt = require('jsonwebtoken');

async function createHarness() {
  const dbFilename = `purchases-routes-test-${Date.now()}-${Math.random().toString(16).slice(2)}.db`;
  process.env.MILO_DB_FILENAME = dbFilename;
  process.env.MILO_DISABLE_SEED = '1';

  const moduleIds = [
    '../backend/dist/config/database.js',
    '../backend/dist/config/auth.js',
    '../backend/dist/routes/purchases.js'
  ];

  moduleIds.forEach((moduleId) => {
    try {
      delete require.cache[require.resolve(moduleId)];
    } catch (error) {
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

  let supplier = database.get('SELECT id, name FROM suppliers WHERE name = ?', ['Proveedor Test']);
  if (!supplier) {
    const supplierResult = database.run(
      'INSERT INTO suppliers (name, phone, email, city) VALUES (?, ?, ?, ?)',
      ['Proveedor Test', '1122334455', 'proveedor@test.local', 'Buenos Aires']
    );
    supplier = { id: supplierResult.lastInsertRowid, name: 'Proveedor Test' };
  }

  let product = database.get('SELECT id, name, stock FROM products WHERE sku = ?', ['PUR-0001']);
  if (!product) {
    const productResult = database.run(
      'INSERT INTO products (sku, name, sale_price, stock, min_stock, active) VALUES (?, ?, ?, ?, ?, ?)',
      ['PUR-0001', 'Producto Compras Test', 2500, 5, 1, 1]
    );
    product = { id: productResult.lastInsertRowid, name: 'Producto Compras Test', stock: 5 };
  }

  database.saveDatabase();

  const { JWT_SECRET } = require('../backend/dist/config/auth.js');
  const purchasesRoutes = require('../backend/dist/routes/purchases.js');

  const app = express();
  app.use(express.json());
  app.use('/api/purchases', purchasesRoutes);
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
    supplierId: supplier.id,
    productId: product.id,
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
  await runCase('purchases requiere auth y permite CRUD basico de proveedores', async () => {
    const harness = await createHarness();
    try {
      const unauthorized = await harness.request('GET', '/api/purchases/suppliers');
      assert.equal(unauthorized.statusCode, 401);

      const list = await harness.request('GET', '/api/purchases/suppliers', undefined, { token: harness.adminToken });
      assert.equal(list.statusCode, 200);
      assert.ok(Array.isArray(list.body));
      assert.ok(list.body.some((supplier) => Number(supplier.id) === Number(harness.supplierId)));

      const create = await harness.request(
        'POST',
        '/api/purchases/suppliers',
        { name: 'Proveedor Nuevo', email: 'nuevo@test.local', city: 'Cordoba' },
        { token: harness.adminToken }
      );
      assert.equal(create.statusCode, 201);
      assert.equal(create.body.name, 'Proveedor Nuevo');

      const update = await harness.request(
        'PUT',
        `/api/purchases/suppliers/${create.body.id}`,
        { name: 'Proveedor Nuevo SA', email: 'nuevo@test.local', city: 'Rosario' },
        { token: harness.adminToken }
      );
      assert.equal(update.statusCode, 200);
      assert.equal(update.body.name, 'Proveedor Nuevo SA');
      assert.equal(update.body.city, 'Rosario');

      const detail = await harness.request('GET', `/api/purchases/suppliers/${create.body.id}`, undefined, { token: harness.adminToken });
      assert.equal(detail.statusCode, 200);
      assert.equal(detail.body.name, 'Proveedor Nuevo SA');

      const remove = await harness.request('DELETE', `/api/purchases/suppliers/${create.body.id}`, undefined, { token: harness.adminToken });
      assert.equal(remove.statusCode, 200);
      assert.equal(remove.body.success, true);
    } finally {
      await harness.cleanup();
    }
  });

  await runCase('purchases crea compra, actualiza stock y cuenta corriente, y permite revertirla', async () => {
    const harness = await createHarness();
    try {
      const create = await harness.request(
        'POST',
        '/api/purchases',
        {
          supplier_id: harness.supplierId,
          invoice_type: 'FA',
          invoice_number: '0001-00000001',
          invoice_date: '2026-04-04',
          notes: 'Compra test',
          items: [
            {
              product_id: harness.productId,
              product_name: 'Producto Compras Test',
              product_code: 'PUR-0001',
              quantity: 3,
              unit_cost: 1000
            }
          ]
        },
        { token: harness.adminToken }
      );
      assert.equal(create.statusCode, 201);
      assert.equal(Number(create.body.subtotal), 3000);
      assert.equal(Number(create.body.iva), 630);
      assert.equal(Number(create.body.total), 3630);

      const productAfterCreate = harness.database.get('SELECT stock FROM products WHERE id = ?', [harness.productId]);
      assert.equal(Number(productAfterCreate.stock), 8);

      const account = harness.database.get('SELECT * FROM supplier_account WHERE supplier_id = ?', [harness.supplierId]);
      assert.equal(Number(account.total_purchases), 3630);
      assert.equal(Number(account.balance), 3630);

      const list = await harness.request('GET', `/api/purchases?supplier=${harness.supplierId}&status=completed`, undefined, { token: harness.adminToken });
      assert.equal(list.statusCode, 200);
      assert.ok(list.body.some((purchase) => Number(purchase.id) === Number(create.body.id)));

      const detail = await harness.request('GET', `/api/purchases/${create.body.id}`, undefined, { token: harness.adminToken });
      assert.equal(detail.statusCode, 200);
      assert.equal(detail.body.items.length, 1);
      assert.equal(Number(detail.body.items[0].quantity), 3);

      const supplierAccount = await harness.request('GET', `/api/purchases/supplier-account/${harness.supplierId}`, undefined, { token: harness.adminToken });
      assert.equal(supplierAccount.statusCode, 200);
      assert.equal(Number(supplierAccount.body.supplier.balance), 3630);
      assert.equal(supplierAccount.body.movements.length, 1);

      const remove = await harness.request('DELETE', `/api/purchases/${create.body.id}`, undefined, { token: harness.adminToken });
      assert.equal(remove.statusCode, 200);
      assert.equal(remove.body.success, true);

      const productAfterDelete = harness.database.get('SELECT stock FROM products WHERE id = ?', [harness.productId]);
      assert.equal(Number(productAfterDelete.stock), 5);

      const accountAfterDelete = harness.database.get('SELECT * FROM supplier_account WHERE supplier_id = ?', [harness.supplierId]);
      assert.equal(Number(accountAfterDelete.total_purchases), 0);
      assert.equal(Number(accountAfterDelete.balance), 0);
    } finally {
      await harness.cleanup();
    }
  });

  await runCase('purchases registra pagos y notas de credito con impacto en balance y stock', async () => {
    const harness = await createHarness();
    try {
      const createPurchase = await harness.request(
        'POST',
        '/api/purchases',
        {
          supplier_id: harness.supplierId,
          invoice_type: 'FA',
          invoice_number: '0001-00000002',
          invoice_date: '2026-04-04',
          items: [
            {
              product_id: harness.productId,
              product_name: 'Producto Compras Test',
              product_code: 'PUR-0001',
              quantity: 4,
              unit_cost: 500
            }
          ]
        },
        { token: harness.adminToken }
      );
      assert.equal(createPurchase.statusCode, 201);

      const payment = await harness.request(
        'POST',
        '/api/purchases/supplier-payments',
        {
          supplier_id: harness.supplierId,
          amount: 1000,
          payment_method: 'transfer',
          reference: 'TRX-123'
        },
        { token: harness.adminToken }
      );
      assert.equal(payment.statusCode, 201);
      assert.equal(payment.body.success, true);
      assert.equal(Number(payment.body.balance), 1420);

      const payments = await harness.request('GET', `/api/purchases/payments?supplier=${harness.supplierId}`, undefined, { token: harness.adminToken });
      assert.equal(payments.statusCode, 200);
      assert.equal(payments.body.length, 1);
      assert.equal(Number(payments.body[0].amount), 1000);

      const credit = await harness.request(
        'POST',
        '/api/purchases/credits',
        {
          supplier_id: harness.supplierId,
          credit_note_number: 'NC-0001',
          reference_invoice: '0001-00000002',
          invoice_date: '2026-04-04',
          update_stock: true,
          items: [
            {
              product_id: harness.productId,
              product_name: 'Producto Compras Test',
              product_code: 'PUR-0001',
              quantity: 2,
              unit_price: 500
            }
          ]
        },
        { token: harness.adminToken }
      );
      assert.equal(credit.statusCode, 201);
      assert.equal(Number(credit.body.total), 1210);

      const credits = await harness.request('GET', `/api/purchases/credits?supplier=${harness.supplierId}`, undefined, { token: harness.adminToken });
      assert.equal(credits.statusCode, 200);
      assert.equal(credits.body.length, 1);

      const creditDetail = await harness.request('GET', `/api/purchases/credits/${credit.body.id}`, undefined, { token: harness.adminToken });
      assert.equal(creditDetail.statusCode, 200);
      assert.equal(creditDetail.body.items.length, 1);

      const productAfterCredit = harness.database.get('SELECT stock FROM products WHERE id = ?', [harness.productId]);
      assert.equal(Number(productAfterCredit.stock), 7);

      const account = await harness.request('GET', `/api/purchases/supplier-account/${harness.supplierId}`, undefined, { token: harness.adminToken });
      assert.equal(account.statusCode, 200);
      assert.equal(Number(account.body.supplier.total_purchases), 2420);
      assert.equal(Number(account.body.supplier.total_payments), 1000);
      assert.equal(Number(account.body.supplier.total_credits), 1210);
      assert.equal(Number(account.body.supplier.balance), 210);
      assert.equal(account.body.movements.length, 3);

      const removeCredit = await harness.request('DELETE', `/api/purchases/credits/${credit.body.id}`, undefined, { token: harness.adminToken });
      assert.equal(removeCredit.statusCode, 200);
      assert.equal(removeCredit.body.success, true);

      const productAfterCreditDelete = harness.database.get('SELECT stock FROM products WHERE id = ?', [harness.productId]);
      assert.equal(Number(productAfterCreditDelete.stock), 9);
    } finally {
      await harness.cleanup();
    }
  });
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

