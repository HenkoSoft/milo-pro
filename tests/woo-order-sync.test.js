const assert = require('node:assert/strict');
const path = require('path');
const fs = require('fs');

function buildOrderPayload(overrides = {}) {
  const id = overrides.id || 1001;
  return {
    id,
    order_key: overrides.order_key || `wc_order_${id}`,
    status: overrides.status || 'processing',
    currency: overrides.currency || 'ARS',
    total: overrides.total || '200.00',
    discount_total: overrides.discount_total || '0.00',
    total_tax: overrides.total_tax || '0.00',
    shipping_total: overrides.shipping_total || '0.00',
    payment_method: overrides.payment_method || 'bacs',
    payment_method_title: overrides.payment_method_title || 'Transferencia',
    customer_id: overrides.customer_id || 77,
    customer_note: overrides.customer_note || 'Entregar rapido',
    date_created_gmt: overrides.date_created_gmt || '2026-04-03T12:00:00',
    date_modified_gmt: overrides.date_modified_gmt || '2026-04-03T12:05:00',
    billing: {
      first_name: 'Ana',
      last_name: 'Perez',
      email: 'ana@example.com',
      phone: '+54 11 5555 0000',
      address_1: 'Calle 123',
      city: 'Buenos Aires',
      state: 'BA',
      country: 'AR',
      ...overrides.billing
    },
    shipping: {
      first_name: 'Ana',
      last_name: 'Perez',
      ...overrides.shipping
    },
    line_items: overrides.line_items || [
      {
        id: 9001,
        product_id: 501,
        variation_id: 0,
        sku: 'SKU-WOO-1',
        name: 'Producto Woo 1',
        quantity: 2,
        total: '200.00',
        total_tax: '0.00'
      }
    ],
    meta_data: overrides.meta_data || []
  };
}

async function createHarness() {
  const dbFilename = `woo-sync-test-${Date.now()}-${Math.random().toString(16).slice(2)}.db`;
  process.env.MILO_DB_FILENAME = dbFilename;
  process.env.MILO_DISABLE_SEED = '1';
  process.env.WOO_ORDER_STATUS_MAP = JSON.stringify({
    pending: 'pending_payment',
    processing: 'paid',
    completed: 'completed',
    'on-hold': 'on_hold',
    cancelled: 'cancelled',
    refunded: 'refunded',
    failed: 'payment_failed'
  });
  process.env.WOO_ORDER_STOCK_STATUSES = JSON.stringify(['paid', 'completed']);
  process.env.WOO_ORDER_PAID_STATUSES = JSON.stringify(['paid', 'completed']);

  const moduleIds = [
    '../backend/dist/config/database.js',
    '../backend/dist/services/woo-order-sync.js'
  ];

  moduleIds.forEach((moduleId) => {
    delete require.cache[require.resolve(moduleId)];
  });

  const database = require('../backend/dist/config/database.js');
  await database.initializeDatabase();

  database.run(
    'INSERT INTO users (username, password, role, name) VALUES (?, ?, ?, ?)',
    ['admin-test', 'secret', 'admin', 'Admin Test']
  );
  database.run(
    'INSERT INTO products (sku, name, stock, sale_price, woocommerce_id, woocommerce_product_id) VALUES (?, ?, ?, ?, ?, ?)',
    ['SKU-WOO-1', 'Producto Local 1', 10, 100, 501, 501]
  );
  database.run(
    'INSERT INTO products (sku, name, stock, sale_price, woocommerce_id, woocommerce_product_id) VALUES (?, ?, ?, ?, ?, ?)',
    ['SKU-WOO-2', 'Producto Local 2', 5, 50, 502, 502]
  );
  database.saveDatabase();

  const service = require('../backend/dist/services/woo-order-sync.js');

  return {
    database,
    service,
    cleanup() {
      const dbPath = path.join(process.cwd(), 'data', dbFilename);
      if (fs.existsSync(dbPath)) {
        fs.unlinkSync(dbPath);
      }
      delete process.env.MILO_DB_FILENAME;
      delete process.env.MILO_DISABLE_SEED;
      delete process.env.WOO_ORDER_STATUS_MAP;
      delete process.env.WOO_ORDER_STOCK_STATUSES;
      delete process.env.WOO_ORDER_PAID_STATUSES;
      moduleIds.forEach((moduleId) => {
        delete require.cache[require.resolve(moduleId)];
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
  await runCase('crea una venta local desde WooCommerce', async () => {
    const harness = await createHarness();
    try {
      const payload = buildOrderPayload();
      const result = await harness.service.syncWooOrder(payload, {
        origin: 'test',
        eventType: 'order.created'
      });

      const sale = harness.database.get('SELECT * FROM sales WHERE id = ?', [result.saleId]);
      const link = harness.database.get('SELECT * FROM external_order_links WHERE local_sale_id = ?', [result.saleId]);
      const customer = harness.database.get('SELECT * FROM customers WHERE id = ?', [sale.customer_id]);
      const items = harness.database.all('SELECT * FROM sale_items WHERE sale_id = ?', [result.saleId]);
      const product = harness.database.get('SELECT * FROM products WHERE sku = ?', ['SKU-WOO-1']);

      assert.equal(sale.channel, 'woocommerce');
      assert.equal(sale.status, 'paid');
      assert.equal(sale.payment_status, 'paid');
      assert.equal(link.woocommerce_order_id, payload.id);
      assert.equal(link.external_reference, `woo-order-${payload.id}`);
      assert.equal(customer.email, 'ana@example.com');
      assert.equal(items.length, 1);
      assert.equal(product.stock, 8);
    } finally {
      harness.cleanup();
    }
  });

  await runCase('no duplica la venta si llega dos veces la misma orden', async () => {
    const harness = await createHarness();
    try {
      const payload = buildOrderPayload({ id: 2001 });
      await harness.service.syncWooOrder(payload, { origin: 'test', eventType: 'order.created' });
      await harness.service.syncWooOrder(payload, { origin: 'test', eventType: 'order.created' });

      const sales = harness.database.all('SELECT * FROM sales');
      const links = harness.database.all('SELECT * FROM external_order_links');
      const product = harness.database.get('SELECT * FROM products WHERE sku = ?', ['SKU-WOO-1']);

      assert.equal(sales.length, 1);
      assert.equal(links.length, 1);
      assert.equal(product.stock, 8);
    } finally {
      harness.cleanup();
    }
  });

  await runCase('actualiza estado sin descontar stock dos veces', async () => {
    const harness = await createHarness();
    try {
      const pending = buildOrderPayload({ id: 3001, status: 'pending' });
      const completed = buildOrderPayload({ id: 3001, status: 'completed' });
      await harness.service.syncWooOrder(pending, { origin: 'test', eventType: 'order.created' });

      let product = harness.database.get('SELECT * FROM products WHERE sku = ?', ['SKU-WOO-1']);
      assert.equal(product.stock, 10);

      await harness.service.syncWooOrder(completed, { origin: 'test', eventType: 'order.updated' });
      await harness.service.syncWooOrder(completed, { origin: 'test', eventType: 'order.updated' });

      product = harness.database.get('SELECT * FROM products WHERE sku = ?', ['SKU-WOO-1']);
      const sale = harness.database.get('SELECT * FROM sales WHERE external_reference = ?', ['woo-order-3001']);

      assert.equal(product.stock, 8);
      assert.equal(sale.status, 'completed');
      assert.ok(sale.stock_applied_at);
    } finally {
      harness.cleanup();
    }
  });

  await runCase('registra inconsistencias cuando un producto no puede mapearse', async () => {
    const harness = await createHarness();
    try {
      const payload = buildOrderPayload({
        id: 4001,
        line_items: [
          {
            id: 9901,
            product_id: 9999,
            variation_id: 0,
            sku: 'SKU-INEXISTENTE',
            name: 'No mapeado',
            quantity: 1,
            total: '15.00',
            total_tax: '0.00'
          }
        ],
        total: '15.00'
      });

      const result = await harness.service.syncWooOrder(payload, {
        origin: 'test',
        eventType: 'order.created'
      });

      const items = harness.database.all('SELECT * FROM sale_items WHERE sale_id = ?', [result.saleId]);
      const link = harness.database.get('SELECT * FROM external_order_links WHERE local_sale_id = ?', [result.saleId]);
      const logs = harness.database.all(
        "SELECT * FROM sync_logs WHERE external_id = ? ORDER BY id DESC",
        [String(payload.id)]
      );

      assert.equal(items.length, 0);
      assert.equal(link.sync_state, 'partial');
      assert.equal(result.issues[0].type, 'product_unmapped');
      assert.equal(logs[0].status, 'partial');
    } finally {
      harness.cleanup();
    }
  });

  await runCase('un reintento manual sigue siendo idempotente', async () => {
    const harness = await createHarness();
    try {
      const payload = buildOrderPayload({ id: 5001, status: 'processing' });
      const first = await harness.service.syncWooOrder(payload, {
        origin: 'test',
        eventType: 'order.created'
      });
      const second = await harness.service.syncWooOrder(payload, {
        origin: 'test',
        eventType: 'order.manual_retry'
      });

      const sales = harness.database.all('SELECT * FROM sales WHERE external_reference = ?', ['woo-order-5001']);
      const product = harness.database.get('SELECT * FROM products WHERE sku = ?', ['SKU-WOO-1']);

      assert.equal(first.saleId, second.saleId);
      assert.equal(sales.length, 1);
      assert.equal(product.stock, 8);
    } finally {
      harness.cleanup();
    }
  });
}

main().catch((error) => {
  console.error(error.stack || error.message || error);
  process.exit(1);
});

