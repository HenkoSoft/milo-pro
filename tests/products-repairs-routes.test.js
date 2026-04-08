const assert = require('node:assert/strict');
const fs = require('fs');
const http = require('http');
const path = require('path');
const express = require('express');
const jwt = require('jsonwebtoken');

async function createHarness() {
  const dbFilename = `products-repairs-test-${Date.now()}-${Math.random().toString(16).slice(2)}.db`;
  process.env.MILO_DB_FILENAME = dbFilename;
  process.env.MILO_DISABLE_SEED = '1';

  const moduleIds = [
    '../backend/src/config/database',
    '../backend/src/config/auth',
    '../backend/src/routes/products',
    '../backend/src/routes/repairs',
    '../backend/src/services/woocommerce-sync',
    '../backend/src/services/product-images',
    '../backend/src/services/product-sku',
    '../backend/src/services/catalog'
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

  let category = database.get('SELECT id, name FROM categories WHERE name = ?', ['Accesorios']);
  if (!category) {
    const categoryResult = database.run('INSERT INTO categories (name, slug, active) VALUES (?, ?, ?)', ['Accesorios', 'accesorios', 1]);
    category = { id: categoryResult.lastInsertRowid, name: 'Accesorios' };
  }

  let brand = database.get('SELECT id, name FROM brands WHERE name = ?', ['Samsung']);
  if (!brand) {
    const brandResult = database.run('INSERT INTO brands (name, slug, active) VALUES (?, ?, ?)', ['Samsung', 'samsung', 1]);
    brand = { id: brandResult.lastInsertRowid, name: 'Samsung' };
  }

  let customer = database.get('SELECT id, name FROM customers WHERE email = ?', ['cliente@test.local']);
  if (!customer) {
    const customerResult = database.run('INSERT INTO customers (name, phone, email) VALUES (?, ?, ?)', ['Cliente Test', '1133445566', 'cliente@test.local']);
    customer = { id: customerResult.lastInsertRowid, name: 'Cliente Test' };
  }

  database.saveDatabase();

  const woocommerceSyncPath = require.resolve('../backend/src/services/woocommerce-sync');
  require.cache[woocommerceSyncPath] = {
    id: woocommerceSyncPath,
    filename: woocommerceSyncPath,
    loaded: true,
    exports: {
      deleteProductFromWooCommerce: async () => ({ success: true, skipped: true }),
      getActiveWooConfig: () => null,
      getActiveWooConfigAsync: async () => null,
      isWooExportEnabled: () => false,
      syncProductSnapshotToWooCommerce: async () => ({ success: true, skipped: true })
    }
  };

  const productImagesPath = require.resolve('../backend/src/services/product-images');
  require.cache[productImagesPath] = {
    id: productImagesPath,
    filename: productImagesPath,
    loaded: true,
    exports: {
      processProductImages: async (_productId, images = []) => (Array.isArray(images) ? images : []).map((item, index) => ({
        nombre_archivo: item.nombre_archivo || `img-${index + 1}.webp`,
        ruta_local: null,
        url_publica: item.url_remote || item.url_publica || null,
        url_local: null,
        url_remote: item.url_remote || item.url_publica || null,
        woocommerce_media_id: item.woocommerce_media_id || null,
        orden: Number.isFinite(Number(item.orden)) ? Number(item.orden) : index,
        es_principal: item.es_principal ? 1 : 0
      }))
    }
  };

  const { JWT_SECRET } = require('../backend/src/config/auth');
  const productsRoutes = require('../backend/src/routes/products');
  const repairsRoutes = require('../backend/src/routes/repairs');

  const app = express();
  app.use(express.json());
  app.use('/api/products', productsRoutes);
  app.use('/api/repairs', repairsRoutes);
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
    categoryId: category.id,
    brandId: brand.id,
    customerId: customer.id,
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
  await runCase('products permite CRUD basico, filtros y low stock', async () => {
    const harness = await createHarness();
    try {
      const unauthorized = await harness.request('GET', '/api/products');
      assert.equal(unauthorized.statusCode, 401);

      const create = await harness.request(
        'POST',
        '/api/products',
        {
          name: 'Cable USB-C',
          category_id: harness.categoryId,
          category_primary_id: harness.categoryId,
          category_ids: [harness.categoryId],
          brand_id: harness.brandId,
          sale_price: '9999',
          stock: '3',
          min_stock: '5',
          images: [{ url_remote: 'https://example.com/cable.webp', es_principal: true }]
        },
        { token: harness.adminToken }
      );
      assert.equal(create.statusCode, 201);
      assert.equal(create.body.name, 'Cable USB-C');
      assert.equal(Number(create.body.stock), 3);
      assert.equal(Number(create.body.min_stock), 5);
      assert.ok(create.body.sku);

      const list = await harness.request('GET', '/api/products?search=Cable', undefined, { token: harness.adminToken });
      assert.equal(list.statusCode, 200);
      assert.ok(Array.isArray(list.body));
      assert.ok(list.body.some((product) => product.name === 'Cable USB-C'));

      const lowStock = await harness.request('GET', '/api/products/low-stock/alerts', undefined, { token: harness.adminToken });
      assert.equal(lowStock.statusCode, 200);
      assert.ok(Array.isArray(lowStock.body));
      assert.ok(lowStock.body.some((product) => product.name === 'Cable USB-C'));

      const update = await harness.request(
        'PUT',
        `/api/products/${create.body.id}`,
        {
          name: 'Cable USB-C Pro',
          category_id: harness.categoryId,
          category_primary_id: harness.categoryId,
          category_ids: [harness.categoryId],
          brand_id: harness.brandId,
          sale_price: '12500',
          stock: '10',
          min_stock: '2'
        },
        { token: harness.adminToken }
      );
      assert.equal(update.statusCode, 200);
      assert.equal(update.body.name, 'Cable USB-C Pro');
      assert.equal(Number(update.body.stock), 10);

      const detail = await harness.request('GET', `/api/products/${create.body.id}`, undefined, { token: harness.adminToken });
      assert.equal(detail.statusCode, 200);
      assert.equal(detail.body.name, 'Cable USB-C Pro');

      const remove = await harness.request('DELETE', `/api/products/${create.body.id}`, undefined, { token: harness.adminToken });
      assert.equal(remove.statusCode, 200);
      assert.equal(remove.body.success, true);

      const listAfterDelete = await harness.request('GET', '/api/products', undefined, { token: harness.adminToken });
      assert.equal(listAfterDelete.statusCode, 200);
      assert.ok(Array.isArray(listAfterDelete.body));
      assert.ok(!listAfterDelete.body.some((product) => Number(product.id) === Number(create.body.id)));
    } finally {
      await harness.cleanup();
    }
  });

  await runCase('repairs permite alta, cambio de estado, detalle y borrado', async () => {
    const harness = await createHarness();
    try {
      const create = await harness.request(
        'POST',
        '/api/repairs',
        {
          customer_id: harness.customerId,
          device_type: 'Telefono',
          brand: 'Samsung',
          model: 'S23',
          problem_description: 'Pantalla rota',
          estimated_price: '45000'
        },
        { token: harness.adminToken }
      );
      assert.equal(create.statusCode, 201);
      assert.equal(create.body.device_type, 'Telefono');
      assert.equal(create.body.status, 'received');
      assert.match(create.body.ticket_number, /^TF-/);

      const stats = await harness.request('GET', '/api/repairs/stats', undefined, { token: harness.adminToken });
      assert.equal(stats.statusCode, 200);
      assert.equal(Number(stats.body.received), 1);

      const changeStatus = await harness.request(
        'PUT',
        `/api/repairs/${create.body.id}/status`,
        { status: 'ready', notes: 'Equipo listo' },
        { token: harness.adminToken }
      );
      assert.equal(changeStatus.statusCode, 200);
      assert.equal(changeStatus.body.status, 'ready');

      const detail = await harness.request('GET', `/api/repairs/${create.body.id}`, undefined, { token: harness.adminToken });
      assert.equal(detail.statusCode, 200);
      assert.equal(detail.body.logs.length, 2);
      assert.equal(detail.body.logs[1].status, 'ready');

      const byTicket = await harness.request('GET', `/api/repairs/ticket/${create.body.ticket_number}`, undefined, { token: harness.adminToken });
      assert.equal(byTicket.statusCode, 200);
      assert.equal(byTicket.body.ticket_number, create.body.ticket_number);

      const remove = await harness.request('DELETE', `/api/repairs/${create.body.id}`, undefined, { token: harness.adminToken });
      assert.equal(remove.statusCode, 200);
      assert.equal(remove.body.success, true);
    } finally {
      await harness.cleanup();
    }
  });
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});


