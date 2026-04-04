function registerWooOrderRoutes(router, deps) {
  const {
    authenticate,
    get,
    getOrderSyncLogs,
    getWooOrderSyncConfig,
    importWooOrderById,
    importWooOrders,
    normalizeWooLogsLimit,
    normalizeWooOrderImportPayload,
    requireAdmin,
    sanitizeWooOrderSyncLog,
    syncWooOrder,
    verifyWebhookRequest
  } = deps;

  router.get('/orders/logs', authenticate, (req, res) => {
    const limit = normalizeWooLogsLimit(req.query.limit);
    res.json(getOrderSyncLogs(limit).map((log) => sanitizeWooOrderSyncLog(log)));
  });

  router.post('/orders/import/:id', authenticate, async (req, res) => {
    if (!requireAdmin(req, res)) return;
    if (!getWooOrderSyncConfig().syncEnabled) {
      return res.status(409).json({ success: false, error: 'La sincronizacion de ordenes esta desactivada' });
    }

    try {
      const result = await importWooOrderById(req.params.id, {
        origin: 'woocommerce_api_manual',
        eventType: 'order.manual_import'
      });
      res.json({ success: true, result });
    } catch (error) {
      res.status(400).json({ success: false, error: error.message });
    }
  });

  router.post('/orders/import', authenticate, async (req, res) => {
    if (!requireAdmin(req, res)) return;
    if (!getWooOrderSyncConfig().syncEnabled) {
      return res.status(409).json({ success: false, error: 'La sincronizacion de ordenes esta desactivada' });
    }

    try {
      const filters = normalizeWooOrderImportPayload(req.body);
      const result = await importWooOrders(
        filters,
        { origin: 'woocommerce_api_manual', eventType: 'order.manual_backfill' }
      );
      res.json({ success: true, ...result });
    } catch (error) {
      res.status(400).json({ success: false, error: error.message });
    }
  });

  router.post('/webhooks/orders', async (req, res) => {
    const config = get('SELECT * FROM woocommerce_sync WHERE id = 1');
    if (!config || !config.store_url) {
      return res.status(503).json({ error: 'WooCommerce no configurado' });
    }

    const rawBody = Buffer.isBuffer(req.rawBody) ? req.rawBody : Buffer.from(JSON.stringify(req.body || {}));
    const syncConfig = getWooOrderSyncConfig();
    if (!syncConfig.syncEnabled) {
      return res.status(409).json({ received: false, error: 'La sincronizacion de ordenes esta desactivada' });
    }
    const topic = req.headers['x-wc-webhook-topic'] || 'order.updated';
    const deliveryId = req.headers[syncConfig.deliveryHeader] || null;

    try {
      verifyWebhookRequest(req.headers, rawBody, syncConfig);

      if (!req.body || typeof req.body !== 'object' || !req.body.id) {
        return res.status(200).json({
          received: true,
          skipped: true,
          reason: 'Payload de prueba o sin order id'
        });
      }

      const result = await syncWooOrder(req.body, {
        origin: 'woocommerce_webhook',
        eventType: String(topic),
        deliveryId: deliveryId ? String(deliveryId) : null
      });
      res.status(200).json({ received: true, result });
    } catch (error) {
      const statusCode = error.statusCode || 400;
      res.status(statusCode).json({ received: false, error: error.message });
    }
  });

  router.get('/webhooks/orders', (req, res) => {
    const syncConfig = getWooOrderSyncConfig();
    res.json({
      ok: true,
      endpoint: 'woocommerce_orders_webhook',
      method: 'POST',
      sync_orders: syncConfig.syncEnabled,
      message: 'Endpoint listo para recibir webhooks de WooCommerce'
    });
  });
}

module.exports = {
  registerWooOrderRoutes
};
