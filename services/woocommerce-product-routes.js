function registerWooProductRoutes(router, deps) {
  const {
    authenticate,
    all,
    get,
    getActiveWooConfig,
    getProductById,
    findWooProductBySku,
    hydrateWooProductForImport,
    parseWooBoolean,
    run,
    saveDatabase,
    sanitizeWooProductSyncLog,
    syncProductSnapshotToWooCommerce,
    unlinkWooProductFromLocal,
    upsertWooProductIntoLocal,
    woocommerceRequest
  } = deps;

  router.post('/sync', authenticate, async (req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Transfer-Encoding', 'chunked');

    const sendProgress = (data) => {
      res.write(`${JSON.stringify(data)}\n`);
    };

    try {
      const config = get('SELECT * FROM woocommerce_sync WHERE id = 1');
      if (!config || !config.store_url) {
        sendProgress({ error: 'WooCommerce not configured', done: true });
        return res.end();
      }

      const results = { imported: 0, exported: 0, updated: 0, errors: [], total: 0, processed: 0 };
      const productsEnabled = parseWooBoolean(config.sync_products, true);
      const isImport = productsEnabled && (config.sync_direction === 'both' || config.sync_direction === 'import');
      const isExport = productsEnabled && (config.sync_direction === 'both' || config.sync_direction === 'export');

      if (!productsEnabled) {
        sendProgress({
          status: 'La sincronizacion de productos esta desactivada en la configuracion.',
          progress: 100,
          results,
          done: true
        });
        return res.end();
      }

      if (isExport) {
        const localProducts = all('SELECT * FROM products');
        sendProgress({ status: 'Exportando cambios a WooCommerce...', progress: 0 });

        for (let i = 0; i < localProducts.length; i += 1) {
          const product = localProducts[i];
          try {
            const syncResult = await syncProductSnapshotToWooCommerce(product, {
              action: 'manual_export_sync',
              persistChanges: false
            });

            if (!syncResult.success) {
              results.errors.push(`Milo Product ${product.id}: ${syncResult.error || 'Unknown error'}`);
            } else if (syncResult.action === 'created') {
              results.exported += 1;
            } else if (syncResult.action === 'updated') {
              results.updated += 1;
            }
          } catch (error) {
            results.errors.push(`Milo Product ${product.id}: ${error.message || 'Unknown error'}`);
          }

          results.processed = i + 1;
          const progress = isImport
            ? Math.round(((i + 1) / localProducts.length) * 40)
            : Math.round(((i + 1) / localProducts.length) * 100);
          sendProgress({ status: `Exportando: ${product.name}`, progress, results });
        }
      }

      if (isImport) {
        sendProgress({ status: 'Importando cambios desde WooCommerce...', progress: isExport ? 40 : 0 });
        const wooProducts = await woocommerceRequest('GET', '/products?per_page=100');

        if (!Array.isArray(wooProducts)) {
          sendProgress({ error: 'No se pudieron obtener productos de WooCommerce', done: true });
          return res.end();
        }

        results.total = wooProducts.length;

        for (let i = 0; i < wooProducts.length; i += 1) {
          const wooProduct = await hydrateWooProductForImport(wooProducts[i]);
          try {
            const importResult = await upsertWooProductIntoLocal(wooProduct, 'manual_import_sync');
            results.imported += importResult.imported ? 1 : 0;
            results.updated += importResult.updated ? 1 : 0;
          } catch (error) {
            results.errors.push(`Woo Product ${wooProduct.id}: ${error.message}`);
          }

          results.processed = i + 1;
          const progress = isExport
            ? 40 + Math.round(((i + 1) / wooProducts.length) * 60)
            : Math.round(((i + 1) / wooProducts.length) * 100);
          sendProgress({ status: `Importando: ${wooProduct.name}`, progress, results });
        }
      }

      run('UPDATE woocommerce_sync SET last_sync = CURRENT_TIMESTAMP WHERE id = 1');
      saveDatabase();
      sendProgress({ status: 'Sincronizacion completada', progress: 100, results, done: true });
      res.end();
    } catch (err) {
      sendProgress({ error: err.message, done: true });
      res.end();
    }
  });

  router.post('/sync-product/:id', authenticate, async (req, res) => {
    try {
      const product = getProductById(req.params.id);
      if (!product) {
        return res.status(404).json({ error: 'Product not found' });
      }

      const result = await syncProductSnapshotToWooCommerce(product, {
        action: 'manual_product_sync'
      });

      if (!result.success) {
        return res.status(500).json({ error: result.error || 'Sync failed' });
      }

      res.json(result);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.post('/reconcile-product/:id', authenticate, async (req, res) => {
    try {
      const product = getProductById(req.params.id);
      if (!product) {
        return res.status(404).json({ error: 'Product not found' });
      }

      const config = getActiveWooConfig();
      if (!config || !config.store_url) {
        return res.status(400).json({ error: 'WooCommerce no configurado' });
      }

      let matchedWoo = null;
      if (product.sku) {
        matchedWoo = await findWooProductBySku(config, product.sku);
      }

      if (matchedWoo && matchedWoo.id) {
        run(
          `UPDATE products
           SET woocommerce_id = ?, woocommerce_product_id = ?, sync_status = 'pending', updated_at = CURRENT_TIMESTAMP
           WHERE id = ?`,
          [matchedWoo.id, matchedWoo.id, product.id]
        );
        saveDatabase();
      } else {
        run(
          `UPDATE products
           SET woocommerce_id = NULL, woocommerce_product_id = NULL, sync_status = 'pending', updated_at = CURRENT_TIMESTAMP
           WHERE id = ?`,
          [product.id]
        );
        saveDatabase();
      }

      const refreshed = getProductById(product.id);
      const result = await syncProductSnapshotToWooCommerce(refreshed, {
        action: 'manual_product_reconcile'
      });

      if (!result.success) {
        return res.status(500).json({ error: result.error || 'No se pudo reconciliar el producto' });
      }

      res.json({
        success: true,
        reconciled_by_sku: Boolean(matchedWoo && matchedWoo.id),
        woocommerce_id: result.woocommerce_id || (matchedWoo ? matchedWoo.id : null)
      });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.post('/retry-product-images/:id', authenticate, async (req, res) => {
    try {
      const product = getProductById(req.params.id);
      if (!product) {
        return res.status(404).json({ error: 'Product not found' });
      }

      if (!Array.isArray(product.images) || product.images.length === 0) {
        return res.status(400).json({ error: 'El producto no tiene imagenes para reintentar.' });
      }

      run('UPDATE product_images SET woocommerce_media_id = NULL WHERE product_id = ?', [product.id]);
      run(
        `UPDATE products
         SET sync_status = 'pending', updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
        [product.id]
      );
      saveDatabase();

      const refreshed = getProductById(product.id);
      const result = await syncProductSnapshotToWooCommerce(refreshed, {
        action: 'manual_product_image_retry'
      });

      if (!result.success) {
        return res.status(500).json({ error: result.error || 'No se pudieron reintentar las imagenes.' });
      }

      res.json({ success: true, woocommerce_id: result.woocommerce_id || refreshed.woocommerce_product_id || null });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.get('/logs', authenticate, (req, res) => {
    const logs = all('SELECT * FROM product_sync_log ORDER BY synced_at DESC LIMIT 50');
    res.json(logs.map((log) => sanitizeWooProductSyncLog(log)));
  });

  router.post('/webhook', async (req, res) => {
    res.status(200).json({ received: true });

    try {
      const topic = req.headers['x-wc-webhook-topic'];
      const product = req.body;

      if ((topic === 'product.updated' || topic === 'product.created') && product && product.id) {
        await upsertWooProductIntoLocal(product, 'webhook_import');
        run('UPDATE woocommerce_sync SET last_sync = CURRENT_TIMESTAMP WHERE id = 1');
        saveDatabase();
        console.log('[WOO-WEBHOOK] Product imported from WooCommerce:', product.id);
        return;
      }

      if (topic === 'product.deleted' && product && product.id) {
        const changed = unlinkWooProductFromLocal(product.id, 'webhook_delete');
        if (changed) {
          run('UPDATE woocommerce_sync SET last_sync = CURRENT_TIMESTAMP WHERE id = 1');
          saveDatabase();
        }
        console.log('[WOO-WEBHOOK] Product deleted in WooCommerce:', product.id);
      }
    } catch (error) {
      console.error('[WOO-WEBHOOK] Error processing webhook:', error.message);
    }
  });
}

module.exports = {
  registerWooProductRoutes
};
