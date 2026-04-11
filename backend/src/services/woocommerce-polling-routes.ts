const { getDatabaseAccessForRequest } = require('./runtime-db.js');

type JsonResponse = {
  status: (code: number) => JsonResponse;
  json: (body: unknown) => void;
};

type RouteRequest = {
  user?: { role?: string };
};

type PollingDeps = {
  authenticate: unknown;
  getWooPollingIntervalSeconds: () => number;
  isWooPollingActive: () => boolean;
  sanitizeWooPollingResult: (result: unknown) => Record<string, unknown>;
  sanitizeWooPollingStatus: (result: unknown) => Record<string, unknown>;
  startWooPolling: (options?: Record<string, unknown>) => Promise<Record<string, unknown>>;
  stopWooPolling: (reason?: string) => void;
  woocommerceRequest: (method: string, path: string) => Promise<unknown>;
};

export function registerWooPollingRoutes(router: any, deps: PollingDeps) {
  const {
    authenticate,
    getWooPollingIntervalSeconds,
    isWooPollingActive,
    sanitizeWooPollingResult,
    sanitizeWooPollingStatus,
    startWooPolling,
    stopWooPolling,
    woocommerceRequest
  } = deps;

  router.post('/start-polling', authenticate, async (_req: RouteRequest, res: JsonResponse) => {
    const result = sanitizeWooPollingResult(await startWooPolling({ manual: true }));
    if (!result.success) {
      res.status(400).json({ error: result.error });
      return;
    }

    res.json({
      success: true,
      message: result.alreadyRunning ? 'Polling already running' : 'Polling started',
      interval_seconds: result.interval_seconds
    });
  });

  router.post('/stop-polling', authenticate, (_req: RouteRequest, res: JsonResponse) => {
    stopWooPolling('manual');
    res.json({ success: true, message: 'Polling stopped' });
  });

  router.get('/polling-status', authenticate, (_req: RouteRequest, res: JsonResponse) => {
    res.json(sanitizeWooPollingStatus({ active: isWooPollingActive(), interval_seconds: getWooPollingIntervalSeconds() }));
  });

  router.post('/cleanup', authenticate, async (req: RouteRequest, res: JsonResponse) => {
    if (req.user?.role !== 'admin') {
      res.status(403).json({ error: 'Solo el administrador puede ejecutar esta operacion' });
      return;
    }

    const db = getDatabaseAccessForRequest(req);

    try {
      const config = await db.get('SELECT * FROM woocommerce_sync WHERE id = 1');
      if (!config || !config.store_url) {
        res.status(400).json({ error: 'WooCommerce no configurado' });
        return;
      }

      const productsWithWoo = await db.all('SELECT id, woocommerce_id FROM products WHERE woocommerce_id IS NOT NULL');
      let cleaned = 0;
      let verified = 0;

      for (const product of productsWithWoo) {
        try {
          const result = await woocommerceRequest('GET', `/products/${product.woocommerce_id}`);
          if (result && (result as Record<string, unknown>).id) {
            verified += 1;
          } else {
            await db.run('UPDATE products SET woocommerce_id = NULL WHERE id = ?', [product.id]);
            cleaned += 1;
          }
        } catch (_err) {
          await db.run('UPDATE products SET woocommerce_id = NULL WHERE id = ?', [product.id]);
          cleaned += 1;
        }
      }

      await db.save();
      res.json({ success: true, message: `Limpieza completada: ${verified} verificados, ${cleaned} limpiados` });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      res.status(500).json({ error: message });
    }
  });
}
