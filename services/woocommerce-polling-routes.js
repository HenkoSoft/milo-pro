function registerWooPollingRoutes(router, deps) {
  const {
    all,
    authenticate,
    get,
    getWooPollingIntervalSeconds,
    isWooPollingActive,
    run,
    sanitizeWooPollingResult,
    sanitizeWooPollingStatus,
    saveDatabase,
    startWooPolling,
    stopWooPolling,
    woocommerceRequest
  } = deps;

  router.post('/start-polling', authenticate, (req, res) => {
    const result = sanitizeWooPollingResult(startWooPolling({ manual: true }));
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

    try {
      const config = get('SELECT * FROM woocommerce_sync WHERE id = 1');
      if (!config || !config.store_url) {
        return res.status(400).json({ error: 'WooCommerce no configurado' });
      }

      const productsWithWoo = all('SELECT id, woocommerce_id FROM products WHERE woocommerce_id IS NOT NULL');
      let cleaned = 0;
      let verified = 0;

      for (const product of productsWithWoo) {
        try {
          const result = await woocommerceRequest('GET', `/products/${product.woocommerce_id}`);
          if (result && result.id) {
            verified += 1;
          } else {
            run('UPDATE products SET woocommerce_id = NULL WHERE id = ?', [product.id]);
            cleaned += 1;
          }
        } catch (err) {
          run('UPDATE products SET woocommerce_id = NULL WHERE id = ?', [product.id]);
          cleaned += 1;
        }
      }

      saveDatabase();
      res.json({ success: true, message: `Limpieza completada: ${verified} verificados, ${cleaned} limpiados` });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });
}

module.exports = {
  registerWooPollingRoutes
};
