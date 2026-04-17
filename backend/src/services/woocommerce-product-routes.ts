const { getDatabaseAccessForRequest } = require('./runtime-db.js');

type JsonResponse = {
  status: (code: number) => JsonResponse;
  json: (body: unknown) => void;
  setHeader: (name: string, value: string) => void;
  write: (chunk: string) => void;
  end: () => void;
};

type RouteRequest = {
  body?: unknown;
  headers?: Record<string, string | string[] | undefined>;
  params?: Record<string, string>;
};

type ProductRouteDeps = {
  authenticate: unknown;
  getActiveWooConfig?: () => Promise<unknown> | unknown;
  getActiveWooConfigAsync?: () => Promise<unknown>;
  fetchAllWooProducts?: (config?: unknown) => Promise<any[]>;
  getProductById: (id: string | number) => any;
  findWooProductBySku: (config: unknown, sku: string) => Promise<any>;
  hydrateWooProductForImport: (product: Record<string, unknown>) => Promise<Record<string, unknown>>;
  parseWooBoolean: (value: unknown, fallback?: boolean) => boolean;
  sanitizeWooProductSyncLog: (log: unknown) => unknown;
  syncProductSnapshotToWooCommerce: (product: unknown, options?: Record<string, unknown>) => Promise<any>;
  unlinkWooProductFromLocal: (wooProductId: unknown, action: string) => Promise<boolean> | boolean;
  upsertWooProductIntoLocal: (wooProduct: Record<string, unknown>, action: string) => Promise<any>;
  woocommerceRequest: (method: string, path: string) => Promise<any>;
};

export function registerWooProductRoutes(router: any, deps: ProductRouteDeps) {
  const {
    authenticate,
    fetchAllWooProducts,
    getActiveWooConfig,
    getActiveWooConfigAsync,
    getProductById,
    findWooProductBySku,
    hydrateWooProductForImport,
    parseWooBoolean,
    sanitizeWooProductSyncLog,
    syncProductSnapshotToWooCommerce,
    unlinkWooProductFromLocal,
    upsertWooProductIntoLocal,
    woocommerceRequest
  } = deps;

  async function resolveWooConfig() {
    if (typeof getActiveWooConfigAsync === 'function') {
      return getActiveWooConfigAsync();
    }
    if (typeof getActiveWooConfig === 'function') {
      return getActiveWooConfig();
    }
    return null;
  }

  router.post('/sync', authenticate, async (req: RouteRequest, res: JsonResponse) => {
    const db = getDatabaseAccessForRequest(req);
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Transfer-Encoding', 'chunked');

    const sendProgress = (data: Record<string, unknown>) => {
      res.write(`${JSON.stringify(data)}\n`);
    };

    try {
      const config = await db.get('SELECT * FROM woocommerce_sync WHERE id = 1');
      if (!config || !config.store_url) {
        sendProgress({ error: 'WooCommerce not configured', done: true });
        res.end();
        return;
      }

      const results: { imported: number; exported: number; updated: number; errors: string[]; total: number; processed: number } = {
        imported: 0,
        exported: 0,
        updated: 0,
        errors: [],
        total: 0,
        processed: 0
      };
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
        res.end();
        return;
      }

      if (isExport) {
        const localProducts = await db.all('SELECT * FROM products');
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
            const message = error instanceof Error ? error.message : 'Unknown error';
            results.errors.push(`Milo Product ${product.id}: ${message}`);
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
        const wooProducts = typeof fetchAllWooProducts === 'function'
          ? await fetchAllWooProducts(config)
          : await woocommerceRequest('GET', '/products?per_page=100&page=1');

        if (!Array.isArray(wooProducts)) {
          sendProgress({ error: 'No se pudieron obtener productos de WooCommerce', done: true });
          res.end();
          return;
        }

        results.total = wooProducts.length;

        for (let i = 0; i < wooProducts.length; i += 1) {
          const wooProduct = await hydrateWooProductForImport(wooProducts[i]);
          try {
            const importResult = await upsertWooProductIntoLocal(wooProduct, 'manual_import_sync');
            results.imported += importResult.imported ? 1 : 0;
            results.updated += importResult.updated ? 1 : 0;
          } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            results.errors.push(`Woo Product ${wooProduct.id}: ${message}`);
          }

          results.processed = i + 1;
          const progress = isExport
            ? 40 + Math.round(((i + 1) / wooProducts.length) * 60)
            : Math.round(((i + 1) / wooProducts.length) * 100);
          sendProgress({ status: `Importando: ${wooProduct.name}`, progress, results });
        }
      }

      await db.run('UPDATE woocommerce_sync SET last_sync = CURRENT_TIMESTAMP WHERE id = 1');
      await db.save();
      sendProgress({ status: 'Sincronizacion completada', progress: 100, results, done: true });
      res.end();
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      sendProgress({ error: message, done: true });
      res.end();
    }
  });

  router.post('/sync-product/:id', authenticate, async (req: RouteRequest, res: JsonResponse) => {
    try {
      const product = await getProductById(String(req.params?.id || ''));
      if (!product) {
        res.status(404).json({ error: 'Product not found' });
        return;
      }

      const result = await syncProductSnapshotToWooCommerce(product, {
        action: 'manual_product_sync'
      });

      if (!result.success) {
        res.status(500).json({ error: result.error || 'Sync failed' });
        return;
      }

      res.json(result);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      res.status(500).json({ error: message });
    }
  });

  router.post('/reconcile-product/:id', authenticate, async (req: RouteRequest, res: JsonResponse) => {
    const db = getDatabaseAccessForRequest(req);
    try {
      const product = await getProductById(String(req.params?.id || ''));
      if (!product) {
        res.status(404).json({ error: 'Product not found' });
        return;
      }

      const config = await resolveWooConfig();
      if (!config || !(config as Record<string, unknown>).store_url) {
        res.status(400).json({ error: 'WooCommerce no configurado' });
        return;
      }

      let matchedWoo = null;
      if (product.sku) {
        matchedWoo = await findWooProductBySku(config, product.sku);
      }

      if (matchedWoo && matchedWoo.id) {
        await db.run(
          `UPDATE products
           SET woocommerce_id = ?, woocommerce_product_id = ?, sync_status = 'pending', updated_at = CURRENT_TIMESTAMP
           WHERE id = ?`,
          [matchedWoo.id, matchedWoo.id, product.id]
        );
        await db.save();
      } else {
        await db.run(
          `UPDATE products
           SET woocommerce_id = NULL, woocommerce_product_id = NULL, sync_status = 'pending', updated_at = CURRENT_TIMESTAMP
           WHERE id = ?`,
          [product.id]
        );
        await db.save();
      }

      const refreshed = await getProductById(product.id);
      const result = await syncProductSnapshotToWooCommerce(refreshed, {
        action: 'manual_product_reconcile'
      });

      if (!result.success) {
        res.status(500).json({ error: result.error || 'No se pudo reconciliar el producto' });
        return;
      }

      res.json({
        success: true,
        reconciled_by_sku: Boolean(matchedWoo && matchedWoo.id),
        woocommerce_id: result.woocommerce_id || (matchedWoo ? matchedWoo.id : null)
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      res.status(500).json({ error: message });
    }
  });

  router.post('/retry-product-images/:id', authenticate, async (req: RouteRequest, res: JsonResponse) => {
    const db = getDatabaseAccessForRequest(req);
    try {
      const product = await getProductById(String(req.params?.id || ''));
      if (!product) {
        res.status(404).json({ error: 'Product not found' });
        return;
      }

      if (!Array.isArray(product.images) || product.images.length === 0) {
        res.status(400).json({ error: 'El producto no tiene imagenes para reintentar.' });
        return;
      }

      await db.run('UPDATE product_images SET woocommerce_media_id = NULL WHERE product_id = ?', [product.id]);
      await db.run(
        `UPDATE products
         SET sync_status = 'pending', updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
        [product.id]
      );
      await db.save();

      const refreshed = await getProductById(product.id);
      const result = await syncProductSnapshotToWooCommerce(refreshed, {
        action: 'manual_product_image_retry'
      });

      if (!result.success) {
        res.status(500).json({ error: result.error || 'No se pudieron reintentar las imagenes.' });
        return;
      }

      res.json({ success: true, woocommerce_id: result.woocommerce_id || refreshed.woocommerce_product_id || null });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      res.status(500).json({ error: message });
    }
  });

  router.get('/logs', authenticate, async (req: RouteRequest, res: JsonResponse) => {
    const db = getDatabaseAccessForRequest(req);
    const logs = await db.all('SELECT * FROM product_sync_log ORDER BY synced_at DESC LIMIT 50');
    res.json(logs.map((log: unknown) => sanitizeWooProductSyncLog(log)));
  });

  router.post('/webhook', async (req: RouteRequest, res: JsonResponse) => {
    const db = getDatabaseAccessForRequest(req);
    res.status(200).json({ received: true });

    try {
      const topic = req.headers?.['x-wc-webhook-topic'];
      const product = req.body as Record<string, unknown>;

      if ((topic === 'product.updated' || topic === 'product.created') && product && product.id) {
        await upsertWooProductIntoLocal(product, 'webhook_import');
        await db.run('UPDATE woocommerce_sync SET last_sync = CURRENT_TIMESTAMP WHERE id = 1');
        await db.save();
        console.log('[WOO-WEBHOOK] Product imported from WooCommerce:', product.id);
        return;
      }

      if (topic === 'product.deleted' && product && product.id) {
        const changed = await unlinkWooProductFromLocal(product.id, 'webhook_delete');
        if (changed) {
          await db.run('UPDATE woocommerce_sync SET last_sync = CURRENT_TIMESTAMP WHERE id = 1');
          await db.save();
        }
        console.log('[WOO-WEBHOOK] Product deleted in WooCommerce:', product.id);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error('[WOO-WEBHOOK] Error processing webhook:', message);
    }
  });
}
