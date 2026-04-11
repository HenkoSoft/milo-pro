const { getDatabaseAccessForRequest } = require('./runtime-db.js');
const NodeBuffer = require('node:buffer').Buffer as { from: (input: string) => unknown; isBuffer?: (value: unknown) => boolean };

type JsonResponse = {
  status: (code: number) => JsonResponse;
  json: (body: unknown) => void;
};

type RouteRequest = {
  body?: any;
  headers?: Record<string, string | string[] | undefined>;
  params?: Record<string, string>;
  query?: Record<string, string | string[] | undefined>;
  rawBody?: unknown;
};

type OrderDeps = {
  authenticate: unknown;
  getOrderSyncLogs: (limit: number) => Promise<any[]> | any[];
  getWooOrderSyncConfig?: () => Promise<any> | any;
  getWooOrderSyncConfigAsync?: () => Promise<any>;
  importWooOrderById: (id: string, options?: Record<string, unknown>) => Promise<unknown>;
  importWooOrders: (filters: Record<string, unknown>, options?: Record<string, unknown>) => Promise<unknown>;
  normalizeWooLogsLimit: (value: unknown) => number;
  normalizeWooOrderImportPayload: (body: unknown) => Record<string, unknown>;
  requireAdmin: (req: RouteRequest, res: JsonResponse) => boolean;
  sanitizeWooOrderSyncLog: (log: unknown) => unknown;
  syncWooOrder: (body: unknown, options?: Record<string, unknown>) => Promise<unknown>;
  verifyWebhookRequest: (headers: Record<string, unknown>, rawBody: unknown, config: Record<string, unknown>) => void;
};

export function registerWooOrderRoutes(router: any, deps: OrderDeps) {
  const {
    authenticate,
    getOrderSyncLogs,
    getWooOrderSyncConfig,
    getWooOrderSyncConfigAsync,
    importWooOrderById,
    importWooOrders,
    normalizeWooLogsLimit,
    normalizeWooOrderImportPayload,
    requireAdmin,
    sanitizeWooOrderSyncLog,
    syncWooOrder,
    verifyWebhookRequest
  } = deps;

  async function resolveOrderSyncConfig() {
    if (typeof getWooOrderSyncConfigAsync === 'function') {
      return getWooOrderSyncConfigAsync();
    }
    if (typeof getWooOrderSyncConfig === 'function') {
      return getWooOrderSyncConfig();
    }
    return { syncEnabled: false, deliveryHeader: 'x-wc-webhook-delivery-id' };
  }

  router.get('/orders/logs', authenticate, async (req: RouteRequest, res: JsonResponse) => {
    const limit = normalizeWooLogsLimit(req.query?.limit);
    const logs = await getOrderSyncLogs(limit);
    res.json(logs.map((log) => sanitizeWooOrderSyncLog(log)));
  });

  router.post('/orders/import/:id', authenticate, async (req: RouteRequest, res: JsonResponse) => {
    if (!requireAdmin(req, res)) return;
    const syncConfig = await resolveOrderSyncConfig();
    if (!syncConfig.syncEnabled) {
      res.status(409).json({ success: false, error: 'La sincronizacion de ordenes esta desactivada' });
      return;
    }

    try {
      const result = await importWooOrderById(String(req.params?.id || ''), {
        origin: 'woocommerce_api_manual',
        eventType: 'order.manual_import'
      });
      res.json({ success: true, result });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      res.status(400).json({ success: false, error: message });
    }
  });

  router.post('/orders/import', authenticate, async (req: RouteRequest, res: JsonResponse) => {
    if (!requireAdmin(req, res)) return;
    const syncConfig = await resolveOrderSyncConfig();
    if (!syncConfig.syncEnabled) {
      res.status(409).json({ success: false, error: 'La sincronizacion de ordenes esta desactivada' });
      return;
    }

    try {
      const filters = normalizeWooOrderImportPayload(req.body);
      const result = await importWooOrders(filters, { origin: 'woocommerce_api_manual', eventType: 'order.manual_backfill' });
      res.json({ success: true, ...(result as Record<string, unknown>) });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      res.status(400).json({ success: false, error: message });
    }
  });

  router.post('/webhooks/orders', async (req: RouteRequest, res: JsonResponse) => {
    const db = getDatabaseAccessForRequest(req);
    const config = await db.get('SELECT * FROM woocommerce_sync WHERE id = 1');
    if (!config || !config.store_url) {
      res.status(503).json({ error: 'WooCommerce no configurado' });
      return;
    }

    const rawBody = NodeBuffer.isBuffer && NodeBuffer.isBuffer(req.rawBody)
      ? req.rawBody
      : NodeBuffer.from(JSON.stringify(req.body || {}));
    const syncConfig = await resolveOrderSyncConfig();
    if (!syncConfig.syncEnabled) {
      res.status(409).json({ received: false, error: 'La sincronizacion de ordenes esta desactivada' });
      return;
    }
    const topic = req.headers?.['x-wc-webhook-topic'] || 'order.updated';
    const deliveryId = req.headers?.[syncConfig.deliveryHeader] || null;

    try {
      verifyWebhookRequest(req.headers || {}, rawBody, syncConfig);

      if (!req.body || typeof req.body !== 'object' || !(req.body as Record<string, unknown>).id) {
        res.status(200).json({
          received: true,
          skipped: true,
          reason: 'Payload de prueba o sin order id'
        });
        return;
      }

      const result = await syncWooOrder(req.body, {
        origin: 'woocommerce_webhook',
        eventType: String(topic),
        deliveryId: deliveryId ? String(deliveryId) : null
      });
      res.status(200).json({ received: true, result });
    } catch (error: any) {
      const statusCode = error?.statusCode || 400;
      const message = error instanceof Error ? error.message : String(error);
      res.status(statusCode).json({ received: false, error: message });
    }
  });

  router.get('/webhooks/orders', async (_req: RouteRequest, res: JsonResponse) => {
    const syncConfig = await resolveOrderSyncConfig();
    res.json({
      ok: true,
      endpoint: 'woocommerce_orders_webhook',
      method: 'POST',
      sync_orders: syncConfig.syncEnabled,
      message: 'Endpoint listo para recibir webhooks de WooCommerce'
    });
  });
}
