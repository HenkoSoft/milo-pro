const express = require('express');
const { get, run, all, saveDatabase } = require('../database');
const { authenticate } = require('../auth');
const {
  buildWooProductPayload,
  getActiveWooConfig,
  syncProductSnapshotToWooCommerce,
  woocommerceRequest
} = require('../services/woocommerce-sync');

const router = express.Router();

const POLLING_INTERVAL_MS = 30000;
let pollingInterval = null;
let pollingInFlight = false;

function canImportFromWoo(config) {
  return Boolean(config && config.store_url && config.sync_direction !== 'export');
}

function getWooImageUrl(wooProduct) {
  return wooProduct.images && wooProduct.images.length > 0 ? wooProduct.images[0].src : null;
}

function parseWooStock(wooProduct) {
  const stock = Number.parseInt(wooProduct.stock_quantity, 10);
  return Number.isFinite(stock) ? stock : 0;
}

function parseWooPrice(wooProduct) {
  const price = Number(wooProduct.price);
  return Number.isFinite(price) ? price : 0;
}

function getExistingLocalProduct(wooProduct) {
  let existing = get('SELECT * FROM products WHERE woocommerce_id = ?', [wooProduct.id]);
  if (!existing && wooProduct.sku) {
    existing = get('SELECT * FROM products WHERE sku = ?', [wooProduct.sku]);
  }
  if (!existing) {
    existing = get('SELECT * FROM products WHERE sku = ?', [`WOO-${wooProduct.id}`]);
  }
  return existing;
}

function upsertWooProductIntoLocal(wooProduct, action) {
  if (!wooProduct || !wooProduct.id) {
    throw new Error('Producto de WooCommerce invalido');
  }

  const stock = parseWooStock(wooProduct);
  const price = parseWooPrice(wooProduct);
  const imageUrl = getWooImageUrl(wooProduct);
  const sku = wooProduct.sku || `WOO-${wooProduct.id}`;
  const existing = getExistingLocalProduct(wooProduct);

  if (existing) {
    const changed =
      existing.name !== (wooProduct.name || '') ||
      (existing.description || '') !== (wooProduct.description || '') ||
      Number(existing.sale_price || 0) !== price ||
      Number(existing.stock || 0) !== stock ||
      (existing.sku || '') !== sku ||
      (existing.image_url || '') !== (imageUrl || '') ||
      Number(existing.woocommerce_id || 0) !== Number(wooProduct.id);

    run(
      `UPDATE products
       SET sku = ?, name = ?, description = ?, sale_price = ?, stock = ?, image_url = ?, woocommerce_id = ?
       WHERE id = ?`,
      [sku, wooProduct.name, wooProduct.description || '', price, stock, imageUrl, wooProduct.id, existing.id]
    );

    run(
      'INSERT INTO product_sync_log (milo_id, woocommerce_id, action, status, message) VALUES (?, ?, ?, ?, ?)',
      [existing.id, wooProduct.id, action, 'success', changed ? 'Producto actualizado desde WooCommerce' : 'Producto verificado desde WooCommerce']
    );

    return { changed, imported: false, updated: changed, unchanged: !changed, miloId: existing.id };
  }

  const result = run(
    `INSERT INTO products (sku, name, description, sale_price, stock, image_url, woocommerce_id)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [sku, wooProduct.name, wooProduct.description || '', price, stock, imageUrl, wooProduct.id]
  );

  run(
    'INSERT INTO product_sync_log (milo_id, woocommerce_id, action, status, message) VALUES (?, ?, ?, ?, ?)',
    [result.lastInsertRowid, wooProduct.id, action, 'success', 'Producto importado desde WooCommerce']
  );

  return { changed: true, imported: true, updated: false, unchanged: false, miloId: result.lastInsertRowid };
}

function unlinkWooProductFromLocal(wooProductId, action) {
  const existing = get('SELECT id FROM products WHERE woocommerce_id = ?', [wooProductId]);
  if (!existing) {
    return false;
  }

  run('UPDATE products SET woocommerce_id = NULL WHERE woocommerce_id = ?', [wooProductId]);
  run(
    'INSERT INTO product_sync_log (milo_id, woocommerce_id, action, status, message) VALUES (?, ?, ?, ?, ?)',
    [existing.id, wooProductId, action, 'success', 'Producto desvinculado por eliminacion en WooCommerce']
  );
  return true;
}

async function importWooProducts({ action }) {
  const config = getActiveWooConfig();
  if (!canImportFromWoo(config)) {
    return { imported: 0, updated: 0, unchanged: 0, total: 0 };
  }

  const wooProducts = await woocommerceRequest('GET', '/products?per_page=100');
  if (!Array.isArray(wooProducts)) {
    throw new Error('No se pudieron obtener productos de WooCommerce');
  }

  let imported = 0;
  let updated = 0;
  let unchanged = 0;

  for (const wooProduct of wooProducts) {
    const result = upsertWooProductIntoLocal(wooProduct, action);
    imported += result.imported ? 1 : 0;
    updated += result.updated ? 1 : 0;
    unchanged += result.unchanged ? 1 : 0;
  }

  run('UPDATE woocommerce_sync SET last_sync = CURRENT_TIMESTAMP WHERE id = 1');
  if (imported > 0 || updated > 0) {
    saveDatabase();
  }

  return {
    imported,
    updated,
    unchanged,
    total: wooProducts.length
  };
}

async function pollWooCommerce(action = 'polling_import') {
  if (pollingInFlight) {
    return;
  }

  pollingInFlight = true;
  try {
    const result = await importWooProducts({ action });
    if (result.imported > 0 || result.updated > 0) {
      console.log(`[WOO-POLLING] Imported ${result.imported}, updated ${result.updated}`);
    }
  } catch (error) {
    console.error('[WOO-POLLING] Error:', error.message);
  } finally {
    pollingInFlight = false;
  }
}

function stopWooPolling(reason = 'manual') {
  if (pollingInterval) {
    clearInterval(pollingInterval);
    pollingInterval = null;
    console.log(`[WOO-POLLING] Polling stopped (${reason})`);
  }
}

function startWooPolling({ manual = false } = {}) {
  const config = getActiveWooConfig();
  if (!config || !config.store_url) {
    return { success: false, error: 'WooCommerce not configured' };
  }

  if (!canImportFromWoo(config)) {
    return { success: false, error: 'Polling disabled: sync direction is export only' };
  }

  if (pollingInterval) {
    return { success: true, alreadyRunning: true, interval_seconds: POLLING_INTERVAL_MS / 1000 };
  }

  console.log('[WOO-POLLING] Starting polling interval...');
  pollWooCommerce(manual ? 'manual_polling_import' : 'auto_polling_import');
  pollingInterval = setInterval(() => {
    pollWooCommerce('polling_import');
  }, POLLING_INTERVAL_MS);

  return { success: true, interval_seconds: POLLING_INTERVAL_MS / 1000 };
}

function initializeWooAutomation() {
  const config = getActiveWooConfig();
  if (config && canImportFromWoo(config)) {
    startWooPolling({ manual: false });
  } else {
    stopWooPolling('startup_config');
  }
}

router.get('/status', authenticate, (req, res) => {
  const config = get('SELECT * FROM woocommerce_sync WHERE id = 1');
  if (!config || !config.store_url) {
    return res.json({ connected: false, message: 'WooCommerce not configured' });
  }

  res.json({
    connected: true,
    store_url: config.store_url,
    sync_direction: config.sync_direction,
    last_sync: config.last_sync,
    auto_sync: config.auto_sync,
    polling_active: pollingInterval !== null
  });
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

router.put('/config', authenticate, async (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Solo el administrador puede modificar configuraciones' });
  }

  const { store_url, consumer_key, consumer_secret, sync_direction, auto_sync } = req.body;
  const existing = get('SELECT * FROM woocommerce_sync WHERE id = 1');

  if (existing) {
    run(
      `UPDATE woocommerce_sync SET
       store_url = ?, consumer_key = ?, consumer_secret = ?,
       sync_direction = ?, auto_sync = ?, active = 1
       WHERE id = 1`,
      [store_url, consumer_key, consumer_secret, sync_direction || 'both', auto_sync ? 1 : 0]
    );
  } else {
    run(
      `INSERT INTO woocommerce_sync (id, store_url, consumer_key, consumer_secret, sync_direction, auto_sync)
       VALUES (1, ?, ?, ?, ?, ?)`,
      [store_url, consumer_key, consumer_secret, sync_direction || 'both', auto_sync ? 1 : 0]
    );
  }

  saveDatabase();
  initializeWooAutomation();
  res.json({ success: true, polling_active: pollingInterval !== null });
});

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
    const isImport = config.sync_direction === 'both' || config.sync_direction === 'import';
    const isExport = config.sync_direction === 'both' || config.sync_direction === 'export';

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
        const wooProduct = wooProducts[i];
        try {
          const importResult = upsertWooProductIntoLocal(wooProduct, 'manual_import_sync');
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
    const product = get('SELECT * FROM products WHERE id = ?', [req.params.id]);
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

router.get('/logs', authenticate, (req, res) => {
  const logs = all('SELECT * FROM product_sync_log ORDER BY synced_at DESC LIMIT 50');
  res.json(logs);
});

router.delete('/disconnect', authenticate, (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Solo el administrador puede modificar configuraciones' });
  }

  stopWooPolling('disconnect');
  run('DELETE FROM woocommerce_sync WHERE id = 1');
  saveDatabase();
  res.json({ success: true });
});

router.post('/webhook', async (req, res) => {
  res.status(200).json({ received: true });

  try {
    const topic = req.headers['x-wc-webhook-topic'];
    const product = req.body;

    if ((topic === 'product.updated' || topic === 'product.created') && product && product.id) {
      upsertWooProductIntoLocal(product, 'webhook_import');
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

router.post('/start-polling', authenticate, (req, res) => {
  const result = startWooPolling({ manual: true });
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
  res.json({ active: pollingInterval !== null, interval_seconds: POLLING_INTERVAL_MS / 1000 });
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

router.initializeWooAutomation = initializeWooAutomation;

module.exports = router;
