const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('fs');
const path = require('path');

async function createHarness() {
  const dbFilename = `woo-config-test-${Date.now()}-${Math.random().toString(16).slice(2)}.db`;
  process.env.MILO_DB_FILENAME = dbFilename;
  process.env.MILO_DISABLE_SEED = '1';

  const moduleIds = [
    '../backend/dist/config/database.js',
    '../backend/dist/services/woo-order-sync.js',
    '../backend/dist/services/woo-order-client.js',
    '../backend/dist/services/woocommerce-sync.js'
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

  return {
    database,
    cleanup() {
      const dbPath = path.join(process.cwd(), 'data', dbFilename);
      if (fs.existsSync(dbPath)) {
        fs.unlinkSync(dbPath);
      }
      delete process.env.MILO_DB_FILENAME;
      delete process.env.MILO_DISABLE_SEED;
      delete process.env.WOO_ORDER_SALES_CHANNEL;
      delete process.env.WOO_WEBHOOK_SIGNATURE_HEADER;
      delete process.env.WOO_WEBHOOK_SECRET;
      delete process.env.WOO_WEBHOOK_AUTH_TOKEN;
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
  await runCase('lee config Woo desde DB y respeta overrides por entorno', async () => {
    const harness = await createHarness();
    try {
      harness.database.run(
        `INSERT OR REPLACE INTO woocommerce_sync (
          id, store_url, consumer_key, consumer_secret, sync_orders,
          order_sales_channel, webhook_secret, webhook_auth_token, webhook_signature_header
        ) VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          'https://example.com',
          'ck_test',
          'cs_test',
          1,
          'db-channel',
          'db-secret',
          'db-token',
          'x-db-signature'
        ]
      );

      process.env.WOO_ORDER_SALES_CHANNEL = 'env-channel';
      process.env.WOO_WEBHOOK_SIGNATURE_HEADER = 'x-env-signature';

      delete require.cache[require.resolve('../backend/dist/services/woo-order-sync.js')];
      const service = require('../backend/dist/services/woo-order-sync.js');
      const config = await service.getWooOrderSyncConfigAsync();

      assert.equal(config.salesChannel, 'env-channel');
      assert.equal(config.webhookSecret, 'db-secret');
      assert.equal(config.webhookAuthToken, 'db-token');
      assert.equal(config.signatureHeader, 'x-env-signature');
      assert.equal(config.syncEnabled, true);
    } finally {
      harness.cleanup();
    }
  });

  await runCase('valida token y firma de webhook correctamente', async () => {
    const harness = await createHarness();
    try {
      harness.database.run(
        `INSERT OR REPLACE INTO woocommerce_sync (
          id, store_url, consumer_key, consumer_secret, sync_orders,
          webhook_secret, webhook_auth_token, webhook_signature_header
        ) VALUES (1, ?, ?, ?, ?, ?, ?, ?)`,
        [
          'https://example.com',
          'ck_test',
          'cs_test',
          1,
          'super-secret',
          'super-token',
          'x-test-signature'
        ]
      );

      delete require.cache[require.resolve('../backend/dist/services/woo-order-sync.js')];
      const service = require('../backend/dist/services/woo-order-sync.js');
      const config = await service.getWooOrderSyncConfigAsync();
      const rawBody = Buffer.from('{"id":123}');
      const signature = crypto.createHmac('sha256', 'super-secret').update(rawBody).digest('base64');

      service.verifyWebhookRequest(
        {
          authorization: 'Bearer super-token',
          'x-test-signature': signature
        },
        rawBody,
        config
      );

      assert.throws(() => {
        service.verifyWebhookRequest(
          {
            authorization: 'Bearer bad-token',
            'x-test-signature': signature
          },
          rawBody,
          config
        );
      }, (error) => error.statusCode === 401 && /token/i.test(error.message));

      assert.throws(() => {
        service.verifyWebhookRequest(
          {
            authorization: 'Bearer super-token',
            'x-test-signature': 'bad-signature'
          },
          rawBody,
          config
        );
      }, (error) => error.statusCode === 401 && /firma/i.test(error.message));
    } finally {
      harness.cleanup();
    }
  });

  await runCase('normaliza filtros del cliente Woo y pagina hasta agotar resultados', async () => {
    const originalPath = require.resolve('../backend/dist/services/woocommerce-sync.js');
    const originalModule = require.cache[originalPath];
    const calls = [];

    require.cache[originalPath] = {
      id: originalPath,
      filename: originalPath,
      loaded: true,
      exports: {
        woocommerceRequest: async (method, apiPath) => {
          calls.push({ method, apiPath });
          const url = new URL(`https://local.test${apiPath}`);
          const page = Number(url.searchParams.get('page') || '1');
          if (page === 1) return [{ id: 1 }, { id: 2 }];
          if (page === 2) return [{ id: 3 }];
          return [];
        }
      }
    };

    delete require.cache[require.resolve('../backend/dist/services/woo-order-client.js')];

    try {
      const client = require('../backend/dist/services/woo-order-client.js');
      const query = client.sanitizeOrderFilters({
        status: ['processing', ' completed '],
        after: '2026-04-01T00:00:00',
        per_page: 999,
        page: 0
      });
      const params = new URLSearchParams(query);

      assert.equal(params.get('status'), 'processing,completed');
      assert.equal(params.get('per_page'), '100');
      assert.equal(params.get('page'), '1');
      assert.equal(params.get('after'), '2026-04-01T00:00:00');

      const result = await client.fetchWooOrdersPaginated({
        status: ['processing', 'completed'],
        per_page: 2
      });

      assert.equal(result.length, 3);
      assert.equal(calls.length, 2);
      assert.match(calls[0].apiPath, /page=1/);
      assert.match(calls[0].apiPath, /per_page=2/);
      assert.match(calls[1].apiPath, /page=2/);
    } finally {
      if (originalModule) {
        require.cache[originalPath] = originalModule;
      } else {
        delete require.cache[originalPath];
      }
      delete require.cache[require.resolve('../backend/dist/services/woo-order-client.js')];
    }
  });
}

main().catch((error) => {
  console.error(error.stack || error.message || error);
  process.exit(1);
});



