function getDatabaseAccess(req, deps) {
  const runtimeDb = req && req.app && req.app.locals ? req.app.locals.database : null;
  return {
    get: runtimeDb && typeof runtimeDb.get === 'function'
      ? (sql, params = []) => runtimeDb.get(sql, params)
      : async (sql, params = []) => deps.get(sql, params),
    all: runtimeDb && typeof runtimeDb.all === 'function'
      ? (sql, params = []) => runtimeDb.all(sql, params)
      : async (sql, params = []) => deps.all(sql, params),
    run: runtimeDb && typeof runtimeDb.run === 'function'
      ? (sql, params = []) => runtimeDb.run(sql, params)
      : async (sql, params = []) => deps.run(sql, params),
    save: runtimeDb && typeof runtimeDb.save === 'function'
      ? () => runtimeDb.save()
      : async () => deps.saveDatabase()
  };
}

function registerWooPollingRoutes(router, deps) {
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

  router.post('/start-polling', authenticate, async (req, res) => {
    const result = sanitizeWooPollingResult(await startWooPolling({ manual: true }));
    if (!result.success) {
      return res.status(400).json({ error: result.error });
    }

    res.json({
      success: true,
      message: result.alreadyRunning ? 'Polling already running' : 'Polling started',
      interval_seconds: result.interval_seconds
    });
  });

  router.post('/stop-polling', authenticate, (req, res) => {
    stopWooPolling('manual');
    res.json({ success: true, message: 'Polling stopped' });
  });

  router.get('/polling-status', authenticate, (req, res) => {
    res.json(sanitizeWooPollingStatus({ active: isWooPollingActive(), interval_seconds: getWooPollingIntervalSeconds() }));
  });

  router.post('/cleanup', authenticate, async (req, res) => {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Solo el administrador puede ejecutar esta operacion' });
    }

    const db = getDatabaseAccess(req, deps);

    try {
      const config = await db.get('SELECT * FROM woocommerce_sync WHERE id = 1');
      if (!config || !config.store_url) {
        return res.status(400).json({ error: 'WooCommerce no configurado' });
      }

      const productsWithWoo = await db.all('SELECT id, woocommerce_id FROM products WHERE woocommerce_id IS NOT NULL');
      let cleaned = 0;
      let verified = 0;

      for (const product of productsWithWoo) {
        try {
          const result = await woocommerceRequest('GET', `/products/${product.woocommerce_id}`);
          if (result && result.id) {
            verified += 1;
          } else {
            await db.run('UPDATE products SET woocommerce_id = NULL WHERE id = ?', [product.id]);
            cleaned += 1;
          }
        } catch (err) {
          await db.run('UPDATE products SET woocommerce_id = NULL WHERE id = ?', [product.id]);
          cleaned += 1;
        }
      }

      await db.save();
      res.json({ success: true, message: `Limpieza completada: ${verified} verificados, ${cleaned} limpiados` });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });
}

module.exports = {
  registerWooPollingRoutes
};

