const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('fs');
const http = require('http');
const path = require('path');
const express = require('express');
const jwt = require('jsonwebtoken');

async function createHarness() {
  const dbFilename = `woo-routes-test-${Date.now()}-${Math.random().toString(16).slice(2)}.db`;
  process.env.MILO_DB_FILENAME = dbFilename;
  process.env.MILO_DISABLE_SEED = '1';

  const moduleIds = [
    '../backend/dist/config/database.js',
    '../backend/dist/config/auth.js',
    '../backend/dist/routes/woocommerce.js',
    '../backend/dist/services/woocommerce-sync.js',
    '../backend/dist/services/woo-order-importer.js',
    '../backend/dist/services/woo-order-sync.js',
    '../backend/dist/services/catalog.js',
    '../backend/dist/services/product-sku.js'
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

  const importedCalls = [];
  const syncedOrderCalls = [];
  const webhookVerificationCalls = [];
  const mockResults = {
    importResult: {
      total: 2,
      success: 2,
      failed: 0,
      results: [
        { order_id: 1, success: true },
        { order_id: 2, success: true }
      ]
    }
  };

  const woocommerceSyncPath = require.resolve('../backend/dist/services/woocommerce-sync.js');
  require.cache[woocommerceSyncPath] = {
    id: woocommerceSyncPath,
    filename: woocommerceSyncPath,
    loaded: true,
    exports: {
      ensureLocalBrand: () => null,
      ensureLocalCategoriesFromWooProduct: async () => [],
      findWooProductBySku: async () => null,
      getActiveWooConfig: () => database.get('SELECT * FROM woocommerce_sync WHERE id = 1'),
      getActiveWooConfigAsync: async () => database.get('SELECT * FROM woocommerce_sync WHERE id = 1'),
      getWooPrimaryBrand: () => null,
      getWooPrimaryColor: () => null,
      getWooProductImages: () => [],
      syncProductSnapshotToWooCommerce: async () => ({ success: true, action: 'updated', woocommerce_id: 99 }),
      woocommerceRequest: async (method, apiPath) => {
        if (method === 'GET' && apiPath === '/system_status') {
          return { environment: { site_url: 'https://example.com', version: '9.0.0' } };
        }
        if (method === 'GET' && apiPath === '/products?per_page=100') {
          return [];
        }
        if (method === 'GET' && apiPath.startsWith('/products/')) {
          return { id: 99 };
        }
        return {};
      }
    }
  };

  const importerPath = require.resolve('../backend/dist/services/woo-order-importer.js');
  require.cache[importerPath] = {
    id: importerPath,
    filename: importerPath,
    loaded: true,
    exports: {
      importWooOrderById: async (orderId, options = {}) => ({ orderId: Number(orderId), options, imported: true }),
      importWooOrders: async (filters, options = {}) => {
        importedCalls.push({ filters, options });
        return mockResults.importResult;
      }
    }
  };

  const orderSyncPath = require.resolve('../backend/dist/services/woo-order-sync.js');
  require.cache[orderSyncPath] = {
    id: orderSyncPath,
    filename: orderSyncPath,
    loaded: true,
    exports: {
      getSyncLogs: (limit = 100) => {
        const appliedLimit = Math.min(Math.max(Number(limit) || 100, 1), 500);
        return Array.from({ length: Math.min(appliedLimit, 3) }, (_, index) => ({
          id: index + 1,
          origin: 'test',
          entity_type: 'order',
          entity_id: String(index + 10),
          external_id: String(index + 20),
          event_type: 'order.manual_backfill',
          delivery_id: null,
          status: 'success',
          message: 'ok',
          error: null,
          created_at: '2026-04-04T00:00:00Z'
        }));
      },
      getWooOrderSyncConfig: () => {
        const row = database.get('SELECT * FROM woocommerce_sync WHERE id = 1') || {};
        return {
          statusMap: { processing: 'paid' },
          stockStatuses: ['paid', 'completed'],
          paidStatuses: ['paid', 'completed'],
          salesChannel: 'woocommerce',
          customerStrategy: 'create_or_link',
          genericCustomerName: 'Cliente WooCommerce',
          webhookSecret: row.webhook_secret || '',
          webhookAuthToken: row.webhook_auth_token || '',
          signatureHeader: String(row.webhook_signature_header || 'x-wc-webhook-signature').toLowerCase(),
          deliveryHeader: String(row.webhook_delivery_header || 'x-wc-webhook-delivery-id').toLowerCase(),
          syncEnabled: Number(row.sync_orders || 0) === 1 || row.sync_orders === undefined
        };
      },
      syncWooOrder: async (payload, options = {}) => {
        syncedOrderCalls.push({ payload, options });
        return { received: true, orderId: payload && payload.id ? Number(payload.id) : null, options };
      },
      verifyWebhookRequest: (headers, rawBody, config) => {
        webhookVerificationCalls.push({ headers, rawBody: Buffer.from(rawBody), config });
        if (config.webhookAuthToken) {
          const authHeader = String(headers.authorization || headers.Authorization || '').trim();
          if (authHeader !== Bearer ) {
            const error = new Error('Webhook token invalido');
            error.statusCode = 401;
            throw error;
          }
        }
        if (config.webhookSecret) {
          const signature = String(headers[config.signatureHeader] || '').trim();
          const expected = crypto.createHmac('sha256', config.webhookSecret).update(rawBody).digest('base64');
          if (!signature || signature !== expected) {
            const error = new Error('Firma de webhook invalida');
            error.statusCode = 401;
            throw error;
          }
        }
        return true;
      }
    }
  };

  const catalogPath = require.resolve('../backend/dist/services/catalog.js');
  require.cache[catalogPath] = {
    id: catalogPath,
    filename: catalogPath,
    loaded: true,
    exports: {
      getProductById: (id) => database.get('SELECT * FROM products WHERE id = ?', [id]),
      collapseCategoryIdsToLeaves: (ids) => ids,
      syncProductCategories: () => {},
      syncProductImages: () => {}
    }
  };

  const skuPath = require.resolve('../backend/dist/services/product-sku.js');
  require.cache[skuPath] = {
    id: skuPath,
    filename: skuPath,
    loaded: true,
    exports: {
      buildAutomaticProductSku: (id) => `AUTO-${id}`,
      getNextAutomaticProductSku: () => 'AUTO-1'
    }
  };

  const { JWT_SECRET } = require('../backend/dist/config/auth.js');
  const router = require('../backend/dist/routes/woocommerce.js');

  const app = express();
  app.use(express.json({
    verify: (req, res, buf) => {
      req.rawBody = Buffer.from(buf);
    }
  }));
  app.use('/api/woocommerce', router);
  app.use((err, req, res, next) => {
    if (res.headersSent) return next(err);
    res.status(500).json({ error: err.message || 'Internal error' });
  });

  const server = await new Promise((resolve) => {
    const instance = app.listen(0, () => resolve(instance));
  });

  const token = jwt.sign({ id: 1, username: 'admin', role: 'admin', name: 'Admin Test' }, JWT_SECRET);

  return {
    database,
    importedCalls,
    syncedOrderCalls,
    webhookVerificationCalls,
    mockResults,
    token,
    port: server.address().port,
    async request(method, routePath, body, extraHeaders = {}) {
      const payload = body === undefined ? null : JSON.stringify(body);
      return new Promise((resolve, reject) => {
        const req = http.request({
          hostname: '127.0.0.1',
          port: server.address().port,
          path: routePath,
          method,
          headers: {
            Authorization: `Bearer ${token}`,
            ...(payload ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) } : {}),
            ...extraHeaders
          }
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
      try {
        if (server.listening) {
          await this.request('POST', '/api/woocommerce/stop-polling');
        }
      } catch (error) {
        // ignore cleanup polling failures
      }
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
  await runCase('guarda config Woo desde la ruta y conserva secretos existentes', async () => {
    const harness = await createHarness();
    try {
      harness.database.run(
        `INSERT OR REPLACE INTO woocommerce_sync (
          id, store_url, consumer_key, consumer_secret, sync_products, sync_orders,
          webhook_secret, webhook_auth_token, active
        ) VALUES (1, ?, ?, ?, ?, ?, ?, ?, 1)`,
        ['https://old.example.com', 'ck_old', 'cs_old', 1, 1, 'old-secret', 'old-token']
      );

      const response = await harness.request('PUT', '/api/woocommerce/config', {
        store_url: 'https://new.example.com',
        sync_products: false,
        sync_orders: true,
        sync_interval_minutes: 15,
        webhook_signature_header: 'x-custom-signature'
      });

      assert.equal(response.statusCode, 200);
      assert.equal(response.body.success, true);
      assert.equal(response.body.config.store_url, 'https://new.example.com');
      assert.equal(response.body.config.sync_products, false);
      assert.equal(response.body.config.sync_orders, true);
      assert.equal(response.body.config.sync_interval_minutes, 15);
      assert.equal(response.body.config.webhook_signature_header, 'x-custom-signature');
      assert.equal(response.body.config.has_consumer_key, true);
      assert.equal(response.body.config.has_webhook_secret, true);

      const row = harness.database.get('SELECT * FROM woocommerce_sync WHERE id = 1');
      assert.equal(row.consumer_key, 'ck_old');
      assert.equal(row.consumer_secret, 'cs_old');
      assert.equal(row.webhook_secret, 'old-secret');
      assert.equal(row.sync_products, 0);
      assert.equal(row.sync_interval_minutes, 15);
    } finally {
      await harness.cleanup();
    }
  });

  await runCase('normaliza logs e import manual de ordenes en la ruta', async () => {
    const harness = await createHarness();
    try {
      harness.database.run(
        'INSERT OR REPLACE INTO woocommerce_sync (id, store_url, consumer_key, consumer_secret, sync_orders, active) VALUES (1, ?, ?, ?, 1, 1)',
        ['https://example.com', 'ck_test', 'cs_test']
      );

      const logsResponse = await harness.request('GET', '/api/woocommerce/orders/logs?limit=999');
      assert.equal(logsResponse.statusCode, 200);
      assert.equal(logsResponse.body.length, 3);
      assert.equal(typeof logsResponse.body[0].id, 'number');
      assert.equal(logsResponse.body[0].status, 'success');

      const importResponse = await harness.request('POST', '/api/woocommerce/orders/import', {
        after: '2026-04-01T00:00:00',
        status: ['processing', ' completed '],
        per_page: 999
      });

      assert.equal(importResponse.statusCode, 200);
      assert.equal(importResponse.body.success, 2);
      assert.equal(importResponse.body.failed, 0);
      assert.equal(harness.importedCalls.length, 1);
      assert.deepEqual(harness.importedCalls[0].filters, {
        after: '2026-04-01T00:00:00',
        before: undefined,
        status: ['processing', 'completed'],
        per_page: 100
      });
    } finally {
      await harness.cleanup();
    }
  });

  await runCase('procesa webhook de producto creado y lo inserta localmente', async () => {
    const harness = await createHarness();
    try {
      harness.database.run(
        'INSERT OR REPLACE INTO woocommerce_sync (id, store_url, consumer_key, consumer_secret, sync_direction, conflict_priority, active) VALUES (1, ?, ?, ?, ?, ?, 1)',
        ['https://example.com', 'ck_test', 'cs_test', 'both', 'woocommerce']
      );

      const response = await harness.request(
        'POST',
        '/api/woocommerce/webhook',
        {
          id: 654,
          sku: 'SKU-WEBHOOK-NEW',
          name: 'Producto nuevo Woo',
          description: 'Creado desde webhook',
          short_description: 'Corto',
          price: '145.50',
          stock_quantity: 7,
          categories: [],
          attributes: [],
          images: []
        },
        { 'x-wc-webhook-topic': 'product.created' }
      );

      assert.equal(response.statusCode, 200);
      assert.equal(response.body.received, true);

      await new Promise((resolve) => setTimeout(resolve, 25));

      const product = harness.database.get('SELECT * FROM products WHERE woocommerce_id = ?', [654]);
      const log = harness.database.get('SELECT * FROM product_sync_log WHERE woocommerce_id = ? ORDER BY id DESC LIMIT 1', [654]);

      assert.equal(product.name, 'Producto nuevo Woo');
      assert.equal(product.sku, 'SKU-WEBHOOK-NEW');
      assert.equal(Number(product.sale_price), 145.5);
      assert.equal(Number(product.stock), 7);
      assert.equal(log.action, 'webhook_import');
    } finally {
      await harness.cleanup();
    }
  });

  await runCase('rechaza webhook de orden con firma invalida', async () => {
    const harness = await createHarness();
    try {
      harness.database.run(
        'INSERT OR REPLACE INTO woocommerce_sync (id, store_url, consumer_key, consumer_secret, sync_orders, webhook_secret, active) VALUES (1, ?, ?, ?, 1, ?, 1)',
        ['https://example.com', 'ck_test', 'cs_test', 'super-secret']
      );

      const response = await harness.request(
        'POST',
        '/api/woocommerce/webhooks/orders',
        { id: 999, status: 'processing' },
        {
          'x-wc-webhook-topic': 'order.updated',
          'x-wc-webhook-signature': 'bad-signature'
        }
      );

      assert.ok([400, 401].includes(response.statusCode));
      assert.equal(response.body.received, false);
      assert.match(response.body.error, /Firma de webhook invalida/i);
      assert.equal(harness.webhookVerificationCalls.length, 1);
      assert.equal(harness.syncedOrderCalls.length, 0);
    } finally {
      await harness.cleanup();
    }
  });

  await runCase('rechaza webhook de orden si sync_orders esta desactivado', async () => {
    const harness = await createHarness();
    try {
      harness.database.run(
        'INSERT OR REPLACE INTO woocommerce_sync (id, store_url, consumer_key, consumer_secret, sync_orders, active) VALUES (1, ?, ?, ?, 0, 1)',
        ['https://example.com', 'ck_test', 'cs_test']
      );

      const response = await harness.request(
        'POST',
        '/api/woocommerce/webhooks/orders',
        { id: 1000, status: 'processing' },
        { 'x-wc-webhook-topic': 'order.updated' }
      );

      assert.equal(response.statusCode, 409);
      assert.equal(response.body.received, false);
      assert.match(response.body.error, /sincronizacion de ordenes esta desactivada/i);
      assert.equal(harness.webhookVerificationCalls.length, 0);
      assert.equal(harness.syncedOrderCalls.length, 0);
    } finally {
      await harness.cleanup();
    }
  });
  await runCase('procesa webhook de producto eliminado y desvincula el producto local', async () => {
    const harness = await createHarness();
    try {
      harness.database.run(
        'INSERT OR REPLACE INTO woocommerce_sync (id, store_url, consumer_key, consumer_secret, active) VALUES (1, ?, ?, ?, 1)',
        ['https://example.com', 'ck_test', 'cs_test']
      );
      harness.database.run(
        'INSERT INTO products (sku, name, stock, sale_price, woocommerce_id, woocommerce_product_id) VALUES (?, ?, ?, ?, ?, ?)',
        ['SKU-WEBHOOK-1', 'Producto webhook', 3, 100, 321, 321]
      );

      const response = await harness.request(
        'POST',
        '/api/woocommerce/webhook',
        { id: 321 },
        { 'x-wc-webhook-topic': 'product.deleted' }
      );

      assert.equal(response.statusCode, 200);
      assert.equal(response.body.received, true);

      await new Promise((resolve) => setTimeout(resolve, 25));

      const product = harness.database.get('SELECT * FROM products WHERE sku = ?', ['SKU-WEBHOOK-1']);
      const log = harness.database.get('SELECT * FROM product_sync_log WHERE woocommerce_id = ? ORDER BY id DESC LIMIT 1', [321]);

      assert.equal(product.woocommerce_id, null);
      assert.equal(product.woocommerce_product_id, null);
      assert.equal(product.sync_status, 'pending');
      assert.equal(log.action, 'webhook_delete');
    } finally {
      await harness.cleanup();
    }
  });

  await runCase('recibe webhook de orden y delega en syncWooOrder con delivery id', async () => {
    const harness = await createHarness();
    try {
      harness.database.run(
        'INSERT OR REPLACE INTO woocommerce_sync (id, store_url, consumer_key, consumer_secret, sync_orders, webhook_delivery_header, active) VALUES (1, ?, ?, ?, 1, ?, 1)',
        ['https://example.com', 'ck_test', 'cs_test', 'x-custom-delivery-id']
      );

      const payload = { id: 987, status: 'processing' };
      const response = await harness.request(
        'POST',
        '/api/woocommerce/webhooks/orders',
        payload,
        {
          'x-wc-webhook-topic': 'order.updated',
          'x-custom-delivery-id': 'delivery-123'
        }
      );

      assert.equal(response.statusCode, 200);
      assert.equal(response.body.received, true);
      assert.equal(response.body.result.orderId, 987);
      assert.equal(harness.webhookVerificationCalls.length, 1);
      assert.equal(harness.syncedOrderCalls.length, 1);
      assert.equal(harness.syncedOrderCalls[0].options.origin, 'woocommerce_webhook');
      assert.equal(harness.syncedOrderCalls[0].options.eventType, 'order.updated');
      assert.equal(harness.syncedOrderCalls[0].options.deliveryId, 'delivery-123');
    } finally {
      await harness.cleanup();
    }
  });

  await runCase('marca como skipped un webhook de orden sin id', async () => {
    const harness = await createHarness();
    try {
      harness.database.run(
        'INSERT OR REPLACE INTO woocommerce_sync (id, store_url, consumer_key, consumer_secret, sync_orders, active) VALUES (1, ?, ?, ?, 1, 1)',
        ['https://example.com', 'ck_test', 'cs_test']
      );

      const response = await harness.request(
        'POST',
        '/api/woocommerce/webhooks/orders',
        { ping: true },
        { 'x-wc-webhook-topic': 'order.updated' }
      );

      assert.equal(response.statusCode, 200);
      assert.equal(response.body.received, true);
      assert.equal(response.body.skipped, true);
      assert.equal(response.body.reason, 'Payload de prueba o sin order id');
      assert.equal(harness.webhookVerificationCalls.length, 1);
      assert.equal(harness.syncedOrderCalls.length, 0);
    } finally {
      await harness.cleanup();
    }
  });
  await runCase('expone polling status y permite iniciar y detener el polling', async () => {
    const harness = await createHarness();
    try {
      harness.database.run(
        'INSERT OR REPLACE INTO woocommerce_sync (id, store_url, consumer_key, consumer_secret, sync_direction, active) VALUES (1, ?, ?, ?, ?, 1)',
        ['https://example.com', 'ck_test', 'cs_test', 'both']
      );

      const initialStatus = await harness.request('GET', '/api/woocommerce/polling-status');
      assert.equal(initialStatus.statusCode, 200);
      assert.equal(initialStatus.body.active, false);
      assert.equal(initialStatus.body.interval_seconds, 30);

      const startResponse = await harness.request('POST', '/api/woocommerce/start-polling');
      assert.equal(startResponse.statusCode, 200);
      assert.equal(startResponse.body.success, true);
      assert.equal(startResponse.body.interval_seconds, 30);

      const runningStatus = await harness.request('GET', '/api/woocommerce/polling-status');
      assert.equal(runningStatus.statusCode, 200);
      assert.equal(runningStatus.body.active, true);

      const stopResponse = await harness.request('POST', '/api/woocommerce/stop-polling');
      assert.equal(stopResponse.statusCode, 200);
      assert.equal(stopResponse.body.success, true);

      const stoppedStatus = await harness.request('GET', '/api/woocommerce/polling-status');
      assert.equal(stoppedStatus.statusCode, 200);
      assert.equal(stoppedStatus.body.active, false);
    } finally {
      await harness.cleanup();
    }
  });
}

main().catch((error) => {
  console.error(error.stack || error.message || error);
  process.exit(1);
});











