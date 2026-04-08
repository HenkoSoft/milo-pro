const { getDatabaseAccessForRequest } = require('./runtime-db');

function registerWooAdminRoutes(router, deps) {
  const {
    authenticate,
    buildWooStatusResponse,
    getWooOrderSyncConfig,
    getWooOrderSyncConfigAsync,
    initializeWooAutomation,
    isWooPollingActive,
    normalizeWooConfigPayload,
    normalizeWooConnectionTestPayload,
    stopWooPolling,
    woocommerceRequest
  } = deps;

  async function resolveOrderSyncConfig() {
    if (typeof getWooOrderSyncConfigAsync === 'function') {
      return getWooOrderSyncConfigAsync();
    }
    if (typeof getWooOrderSyncConfig === 'function') {
      return getWooOrderSyncConfig();
    }
    return null;
  }

  router.get('/status', authenticate, async (req, res) => {
    const db = getDatabaseAccessForRequest(req);
    const config = await db.get('SELECT * FROM woocommerce_sync WHERE id = 1');
    const logs = await db.all('SELECT * FROM product_sync_log ORDER BY synced_at DESC LIMIT 50');
    const orderConfig = await resolveOrderSyncConfig();
    res.json(buildWooStatusResponse(config, { logs, orderConfig, pollingActive: isWooPollingActive() }));
  });

  router.get('/test', authenticate, async (req, res) => {
    try {
      const result = await woocommerceRequest('GET', '/system_status');
      if (result.environment) {
        res.json({ success: true, store: result.environment.site_url });
      } else {
        res.status(400).json({ success: false, error: 'Connection failed' });
      }
    } catch (err) {
      res.status(400).json({ success: false, error: err.message });
    }
  });

  router.post('/test-connection', authenticate, async (req, res) => {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Solo el administrador puede probar configuraciones' });
    }

    const payload = normalizeWooConnectionTestPayload(req.body);
    const { store_url, consumer_key, consumer_secret, api_version, wp_username, wp_app_password } = payload;
    if (!store_url || !consumer_key || !consumer_secret) {
      return res.status(400).json({ error: 'Complete URL, Consumer Key y Consumer Secret.' });
    }

    try {
      const result = await woocommerceRequest('GET', '/system_status', null, {
        store_url,
        consumer_key,
        consumer_secret,
        api_version
      });
      if (result && result.environment) {
        if (wp_username && wp_app_password) {
          const wpUrl = new URL(store_url);
          const transport = require(wpUrl.protocol === 'http:' ? 'http' : 'https');
          const auth = Buffer.from(`${wp_username}:${wp_app_password}`).toString('base64');
          await new Promise((resolve, reject) => {
            const reqWp = transport.request({
              hostname: wpUrl.hostname,
              port: wpUrl.port || (wpUrl.protocol === 'http:' ? 80 : 443),
              path: '/wp-json/wp/v2/media?per_page=1',
              method: 'GET',
              headers: { Authorization: `Basic ${auth}` }
            }, (resWp) => {
              let body = '';
              resWp.on('data', (chunk) => body += chunk);
              resWp.on('end', () => {
                if (resWp.statusCode >= 200 && resWp.statusCode < 300) {
                  return resolve(body);
                }
                reject(new Error(`Media API ${resWp.statusCode}: ${body}`));
              });
            });
            reqWp.on('error', reject);
            reqWp.end();
          });
        }
        return res.json({
          success: true,
          store: result.environment.site_url,
          version: result.environment.version || ''
        });
      }
      res.status(400).json({ success: false, error: 'No se pudo validar la tienda.' });
    } catch (err) {
      res.status(400).json({ success: false, error: err.message });
    }
  });

  router.put('/config', authenticate, async (req, res) => {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Solo el administrador puede modificar configuraciones' });
    }

    const db = getDatabaseAccessForRequest(req);
    const existing = await db.get('SELECT * FROM woocommerce_sync WHERE id = 1');
    const payload = normalizeWooConfigPayload(req.body, existing);

    if (existing) {
      await db.run(
        `UPDATE woocommerce_sync SET
         store_url = ?, consumer_key = ?, consumer_secret = ?, wp_username = ?, wp_app_password = ?,
         api_version = ?, sync_direction = ?, sync_products = ?, sync_customers = ?, sync_orders = ?,
         sync_stock = ?, sync_prices = ?, sync_mode = ?, sync_interval_minutes = ?, auto_sync = ?,
         tax_mode = ?, category_mode = ?, conflict_priority = ?, order_status_map = ?, order_stock_statuses = ?,
         order_paid_statuses = ?, order_sync_mode = ?, order_sales_channel = ?, customer_sync_strategy = ?,
         generic_customer_name = ?, webhook_secret = ?, webhook_auth_token = ?, webhook_signature_header = ?,
         webhook_delivery_header = ?, active = 1
         WHERE id = 1`,
        [
          payload.store_url,
          payload.consumer_key,
          payload.consumer_secret,
          payload.wp_username,
          payload.wp_app_password,
          payload.api_version,
          payload.sync_direction,
          payload.sync_products,
          payload.sync_customers,
          payload.sync_orders,
          payload.sync_stock,
          payload.sync_prices,
          payload.sync_mode,
          payload.sync_interval_minutes,
          payload.auto_sync,
          payload.tax_mode,
          payload.category_mode,
          payload.conflict_priority,
          payload.order_status_map,
          payload.order_stock_statuses,
          payload.order_paid_statuses,
          payload.order_sync_mode,
          payload.order_sales_channel,
          payload.customer_sync_strategy,
          payload.generic_customer_name,
          payload.webhook_secret,
          payload.webhook_auth_token,
          payload.webhook_signature_header,
          payload.webhook_delivery_header
        ]
      );
    } else {
      await db.run(
        `INSERT INTO woocommerce_sync (
          id, store_url, consumer_key, consumer_secret, wp_username, wp_app_password, api_version, sync_direction,
          sync_products, sync_customers, sync_orders, sync_stock, sync_prices,
          sync_mode, sync_interval_minutes, auto_sync, tax_mode, category_mode,
          conflict_priority, order_status_map, order_stock_statuses, order_paid_statuses, order_sync_mode,
          order_sales_channel, customer_sync_strategy, generic_customer_name, webhook_secret, webhook_auth_token,
          webhook_signature_header, webhook_delivery_header
        )
         VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          payload.store_url,
          payload.consumer_key,
          payload.consumer_secret,
          payload.wp_username,
          payload.wp_app_password,
          payload.api_version,
          payload.sync_direction,
          payload.sync_products,
          payload.sync_customers,
          payload.sync_orders,
          payload.sync_stock,
          payload.sync_prices,
          payload.sync_mode,
          payload.sync_interval_minutes,
          payload.auto_sync,
          payload.tax_mode,
          payload.category_mode,
          payload.conflict_priority,
          payload.order_status_map,
          payload.order_stock_statuses,
          payload.order_paid_statuses,
          payload.order_sync_mode,
          payload.order_sales_channel,
          payload.customer_sync_strategy,
          payload.generic_customer_name,
          payload.webhook_secret,
          payload.webhook_auth_token,
          payload.webhook_signature_header,
          payload.webhook_delivery_header
        ]
      );
    }

    await db.save();
    initializeWooAutomation();
    const updated = await db.get('SELECT * FROM woocommerce_sync WHERE id = 1');
    const logs = await db.all('SELECT * FROM product_sync_log ORDER BY synced_at DESC LIMIT 50');
    const orderConfig = await resolveOrderSyncConfig();
    res.json({
      success: true,
      polling_active: isWooPollingActive(),
      config: buildWooStatusResponse(updated, { logs, orderConfig, pollingActive: isWooPollingActive() })
    });
  });

  router.delete('/disconnect', authenticate, async (req, res) => {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Solo el administrador puede modificar configuraciones' });
    }

    const db = getDatabaseAccessForRequest(req);
    stopWooPolling('disconnect');
    await db.run('DELETE FROM woocommerce_sync WHERE id = 1');
    await db.save();
    res.json({ success: true });
  });
}

module.exports = {
  registerWooAdminRoutes
};
