const express = require('express');
const { get, run, all, saveDatabase } = require('../database');
const { authenticate } = require('../auth');
const { buildAutomaticProductSku, getNextAutomaticProductSku } = require('../services/product-sku');
const {
  ensureLocalBrand,
  ensureLocalCategoriesFromWooProduct,
  findWooProductBySku,
  getActiveWooConfig,
  getWooPrimaryBrand,
  getWooPrimaryColor,
  getWooProductImages,
  syncProductSnapshotToWooCommerce,
  woocommerceRequest
} = require('../services/woocommerce-sync');
const {
  getSyncLogs: getOrderSyncLogs,
  getWooOrderSyncConfig,
  syncWooOrder,
  verifyWebhookRequest
} = require('../services/woo-order-sync');
const {
  importWooOrderById,
  importWooOrders
} = require('../services/woo-order-importer');
const {
  getProductById,
  collapseCategoryIdsToLeaves,
  syncProductCategories,
  syncProductImages
} = require('../services/catalog');

const router = express.Router();

const POLLING_INTERVAL_MS = 30000;
let pollingInterval = null;
let pollingInFlight = false;

function parseWooBoolean(value, fallback = false) {
  if (value === undefined || value === null || value === '') return fallback;
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value > 0;
  const normalized = String(value).trim().toLowerCase();
  return ['1', 'true', 'on', 'yes', 'si'].includes(normalized);
}

function requireAdmin(req, res) {
  if (req.user.role !== 'admin') {
    res.status(403).json({ error: 'Solo el administrador puede ejecutar esta accion' });
    return false;
  }
  return true;
}

function buildWooStatusResponse(config = null) {
  if (!config || !config.store_url) {
    return { connected: false, message: 'WooCommerce not configured' };
  }

  const logs = all('SELECT * FROM product_sync_log ORDER BY synced_at DESC LIMIT 50');
  const recentErrors = logs.filter((log) => log.status === 'error').slice(0, 10);
  const orderConfig = getWooOrderSyncConfig();

  return {
    connected: true,
    store_url: config.store_url,
    api_version: config.api_version || 'wc/v3',
    sync_direction: config.sync_direction || 'export',
    sync_products: parseWooBoolean(config.sync_products, true),
    sync_customers: parseWooBoolean(config.sync_customers, false),
    sync_orders: parseWooBoolean(config.sync_orders, false),
    sync_stock: parseWooBoolean(config.sync_stock, true),
    sync_prices: parseWooBoolean(config.sync_prices, true),
    sync_mode: config.sync_mode || 'manual',
    sync_interval_minutes: Number(config.sync_interval_minutes || 60),
    tax_mode: config.tax_mode || 'woocommerce',
    category_mode: config.category_mode || 'milo',
    conflict_priority: config.conflict_priority || 'milo',
    order_status_map: config.order_status_map || '{"pending":"pendiente","processing":"procesando","completed":"completado","cancelled":"cancelado","refunded":"reintegrado","failed":"fallido"}',
    last_sync: config.last_sync,
    auto_sync: parseWooBoolean(config.auto_sync, false),
    polling_active: pollingInterval !== null,
    orders_sync_enabled: parseWooBoolean(config.sync_orders, false),
    order_sync_mode: config.order_sync_mode || 'webhook',
    order_sales_channel: config.order_sales_channel || 'woocommerce',
    customer_sync_strategy: config.customer_sync_strategy || 'create_or_link',
    generic_customer_name: config.generic_customer_name || 'Cliente WooCommerce',
    webhook_signature_header: config.webhook_signature_header || 'x-wc-webhook-signature',
    webhook_delivery_header: config.webhook_delivery_header || 'x-wc-webhook-delivery-id',
    order_status_map_effective: orderConfig.statusMap,
    order_stock_statuses: orderConfig.stockStatuses,
    order_paid_statuses: orderConfig.paidStatuses,
    has_consumer_key: Boolean(config.consumer_key),
    has_consumer_secret: Boolean(config.consumer_secret),
    has_wp_username: Boolean(config.wp_username),
    has_wp_app_password: Boolean(config.wp_app_password),
    has_webhook_secret: Boolean(config.webhook_secret || process.env.WOO_WEBHOOK_SECRET),
    has_webhook_auth_token: Boolean(config.webhook_auth_token || process.env.WOO_WEBHOOK_AUTH_TOKEN),
    logs_summary: {
      processed: logs.length,
      errors: recentErrors.length,
      recent_errors: recentErrors.map((log) => ({
        id: log.id,
        message: log.message,
        synced_at: log.synced_at,
        action: log.action
      }))
    }
  };
}

function canImportFromWoo(config) {
  return Boolean(config && config.store_url && config.sync_direction !== 'export');
}

function localCatalogWins(config) {
  return !config
    || config.sync_direction === 'export'
    || config.conflict_priority === 'milo';
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
  if (!existing) {
    existing = get('SELECT * FROM products WHERE woocommerce_product_id = ?', [wooProduct.id]);
  }
  if (!existing && wooProduct.sku) {
    existing = get('SELECT * FROM products WHERE sku = ?', [wooProduct.sku]);
  }
  if (!existing) {
    existing = get('SELECT * FROM products WHERE sku = ?', [`WOO-${wooProduct.id}`]);
  }
  if (!existing) {
    existing = get('SELECT * FROM products WHERE sku = ?', [buildAutomaticProductSku(wooProduct.id)]);
  }
  return existing;
}

async function hydrateWooProductForImport(wooProduct) {
  const hasCategories = Array.isArray(wooProduct && wooProduct.categories) && wooProduct.categories.length > 0;
  const hasBrands = Array.isArray(wooProduct && wooProduct.brands) && wooProduct.brands.length > 0;
  const hasBrandAttributes = Array.isArray(wooProduct && wooProduct.attributes)
    && wooProduct.attributes.some((attr) => ['marca', 'brand'].includes(String(attr.name || '').trim().toLowerCase()));
  const hasColorAttributes = Array.isArray(wooProduct && wooProduct.attributes)
    && wooProduct.attributes.some((attr) => ['color', 'colour', 'colores'].includes(String(attr.name || '').trim().toLowerCase()));

  if (hasCategories && (hasBrands || hasBrandAttributes) && hasColorAttributes) {
    return wooProduct;
  }

  try {
    const detailed = await woocommerceRequest('GET', `/products/${wooProduct.id}`);
    return detailed && detailed.id ? detailed : wooProduct;
  } catch (error) {
    return wooProduct;
  }
}

async function upsertWooProductIntoLocal(wooProduct, action) {
  if (!wooProduct || !wooProduct.id) {
    throw new Error('Producto de WooCommerce invalido');
  }

  const stock = parseWooStock(wooProduct);
  const price = parseWooPrice(wooProduct);
  const images = getWooProductImages(wooProduct);
  const imageUrl = images[0] ? images[0].url_remote : null;
  const importedSku = String(wooProduct.sku || '').trim();
  const localCategories = await ensureLocalCategoriesFromWooProduct(wooProduct);
  const primaryBrand = getWooPrimaryBrand(wooProduct);
  const primaryColor = getWooPrimaryColor(wooProduct);
  const localCategoryIds = collapseCategoryIdsToLeaves(localCategories.map((item) => item.id));
  const primaryCategory = localCategoryIds.length > 0
    ? (localCategories.find((item) => Number(item.id) === Number(localCategoryIds[0])) || null)
    : null;
  const localCategoryId = primaryCategory ? primaryCategory.id : null;
  const localBrandId = ensureLocalBrand(primaryBrand ? primaryBrand.name : '', { woocommerce_brand_id: primaryBrand && primaryBrand.id ? primaryBrand.id : null });
  const existing = getExistingLocalProduct(wooProduct);
  const shortDescription = wooProduct.short_description || '';
  const config = getActiveWooConfig();
  const localWins = localCatalogWins(config);

  if (existing) {
    const sku = localWins
      ? (existing.sku || importedSku || getNextAutomaticProductSku(all('SELECT sku FROM products')))
      : (importedSku || existing.sku || getNextAutomaticProductSku(all('SELECT sku FROM products')));
    const nextCategoryId = localWins ? (existing.category_id || localCategoryId || null) : (localCategoryId || existing.category_id || null);
    const nextBrandId = localWins ? (existing.brand_id || localBrandId || null) : (localBrandId || existing.brand_id || null);
    const nextName = localWins ? (existing.name || wooProduct.name || '') : (wooProduct.name || existing.name || '');
    const nextDescription = localWins ? (existing.description || wooProduct.description || '') : (wooProduct.description || existing.description || '');
    const nextShortDescription = localWins ? (existing.short_description || shortDescription || '') : (shortDescription || existing.short_description || '');
    const nextColor = localWins ? (existing.color || primaryColor || '') : (primaryColor || existing.color || '');
    const nextPrice = localWins ? Number(existing.sale_price || price || 0) : price;
    const nextStock = localWins ? Number(existing.stock || stock || 0) : stock;
    const nextImageUrl = localWins ? (existing.image_url || imageUrl || null) : (imageUrl || existing.image_url || null);
    const nextCategoryIds = localWins
      ? ((existing.category_id || existing.category_primary_id) ? [existing.category_id || existing.category_primary_id, ...localCategoryIds] : localCategoryIds)
      : localCategoryIds;
    const mergedImages = localWins && existing.image_url && !imageUrl
      ? []
      : images;
    const changed =
      existing.name !== nextName ||
      (existing.description || '') !== nextDescription ||
      (existing.short_description || '') !== nextShortDescription ||
      (existing.color || '') !== nextColor ||
      Number(existing.sale_price || 0) !== Number(nextPrice || 0) ||
      Number(existing.stock || 0) !== Number(nextStock || 0) ||
      (existing.sku || '') !== sku ||
      Number(existing.category_id || 0) !== Number(nextCategoryId || 0) ||
      Number(existing.brand_id || 0) !== Number(nextBrandId || 0) ||
      (existing.image_url || '') !== (nextImageUrl || '') ||
      Number(existing.woocommerce_id || 0) !== Number(wooProduct.id);

    run(
      `UPDATE products
       SET sku = ?, name = ?, description = ?, short_description = ?, color = ?, category_id = ?, category_primary_id = ?, brand_id = ?, sale_price = ?, stock = ?, image_url = ?, woocommerce_id = ?, woocommerce_product_id = ?, sync_status = 'synced', last_sync_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [sku, nextName, nextDescription, nextShortDescription, nextColor, nextCategoryId, nextCategoryId, nextBrandId, nextPrice, nextStock, nextImageUrl, wooProduct.id, wooProduct.id, existing.id]
    );
    syncProductCategories(existing.id, nextCategoryIds, nextCategoryId);
    if (mergedImages.length > 0 || !localWins) {
      syncProductImages(existing.id, mergedImages.length > 0 ? mergedImages : images);
    }

    run(
      'INSERT INTO product_sync_log (milo_id, woocommerce_id, action, status, message) VALUES (?, ?, ?, ?, ?)',
      [existing.id, wooProduct.id, action, 'success', localWins ? 'Producto conciliado desde WooCommerce sin pisar datos locales' : (changed ? 'Producto actualizado desde WooCommerce' : 'Producto verificado desde WooCommerce')]
    );

    return { changed, imported: false, updated: changed, unchanged: !changed, miloId: existing.id, product: getProductById(existing.id) };
  }

  const result = run(
    `INSERT INTO products (sku, name, description, short_description, color, category_id, category_primary_id, brand_id, sale_price, stock, image_url, woocommerce_id, woocommerce_product_id, sync_status, last_sync_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'synced', CURRENT_TIMESTAMP)`,
    [importedSku || getNextAutomaticProductSku(all('SELECT sku FROM products')), wooProduct.name, wooProduct.description || '', shortDescription, primaryColor || null, localCategoryId, localCategoryId, localBrandId, price, stock, imageUrl, wooProduct.id, wooProduct.id]
  );
  syncProductCategories(result.lastInsertRowid, localCategoryIds, localCategoryId);
  syncProductImages(result.lastInsertRowid, images);

  run(
    'INSERT INTO product_sync_log (milo_id, woocommerce_id, action, status, message) VALUES (?, ?, ?, ?, ?)',
    [result.lastInsertRowid, wooProduct.id, action, 'success', 'Producto importado desde WooCommerce']
  );

  return { changed: true, imported: true, updated: false, unchanged: false, miloId: result.lastInsertRowid, product: getProductById(result.lastInsertRowid) };
}

function unlinkWooProductFromLocal(wooProductId, action) {
  const existing = get('SELECT id FROM products WHERE woocommerce_id = ? OR woocommerce_product_id = ?', [wooProductId, wooProductId]);
  if (!existing) {
    return false;
  }

  run(
    `UPDATE products
     SET woocommerce_id = NULL, woocommerce_product_id = NULL, sync_status = 'pending', updated_at = CURRENT_TIMESTAMP
     WHERE id = ?`,
    [existing.id]
  );
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
    const hydratedProduct = await hydrateWooProductForImport(wooProduct);
    const result = await upsertWooProductIntoLocal(hydratedProduct, action);
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
  res.json(buildWooStatusResponse(config));
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

  const { store_url, consumer_key, consumer_secret, api_version, wp_username, wp_app_password } = req.body || {};
  if (!store_url || !consumer_key || !consumer_secret) {
    return res.status(400).json({ error: 'Complete URL, Consumer Key y Consumer Secret.' });
  }

  try {
    const result = await woocommerceRequest('GET', '/system_status', null, {
      store_url,
      consumer_key,
      consumer_secret,
      api_version: api_version || 'wc/v3'
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
              if (resWp.statusCode >= 200 && resWp.statusCode < 300) return resolve(body);
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

  const {
    store_url,
    consumer_key,
    consumer_secret,
    wp_username,
    wp_app_password,
    api_version,
    sync_direction,
    sync_products,
    sync_customers,
    sync_orders,
    sync_stock,
    sync_prices,
    sync_mode,
    sync_interval_minutes,
    auto_sync,
    tax_mode,
    category_mode,
    conflict_priority,
    order_status_map,
    order_stock_statuses,
    order_paid_statuses,
    order_sync_mode,
    order_sales_channel,
    customer_sync_strategy,
    generic_customer_name,
    webhook_secret,
    webhook_auth_token,
    webhook_signature_header,
    webhook_delivery_header
  } = req.body;
  const existing = get('SELECT * FROM woocommerce_sync WHERE id = 1');
  const nextSecret = consumer_secret ? consumer_secret : (existing ? existing.consumer_secret : '');
  const nextKey = consumer_key ? consumer_key : (existing ? existing.consumer_key : '');
  const nextWpUsername = wp_username ? wp_username : (existing ? existing.wp_username : '');
  const nextWpAppPassword = wp_app_password ? wp_app_password : (existing ? existing.wp_app_password : '');
  const nextWebhookSecret = webhook_secret ? webhook_secret : (existing ? existing.webhook_secret : '');
  const nextWebhookAuthToken = webhook_auth_token ? webhook_auth_token : (existing ? existing.webhook_auth_token : '');
  const nextStatusMap = typeof order_status_map === 'string'
    ? order_status_map
    : JSON.stringify(order_status_map || {
      pending: 'pendiente',
      processing: 'procesando',
      completed: 'completado',
      cancelled: 'cancelado',
      refunded: 'reintegrado',
      failed: 'fallido'
    });
  const nextStockStatuses = typeof order_stock_statuses === 'string'
    ? order_stock_statuses
    : JSON.stringify(order_stock_statuses || ['paid', 'completed']);
  const nextPaidStatuses = typeof order_paid_statuses === 'string'
    ? order_paid_statuses
    : JSON.stringify(order_paid_statuses || ['paid', 'completed']);

  if (existing) {
    run(
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
        store_url,
        nextKey,
        nextSecret,
        nextWpUsername,
        nextWpAppPassword,
        api_version || existing.api_version || 'wc/v3',
        sync_direction || existing.sync_direction || 'export',
        parseWooBoolean(sync_products, parseWooBoolean(existing.sync_products, true)) ? 1 : 0,
        parseWooBoolean(sync_customers, parseWooBoolean(existing.sync_customers, false)) ? 1 : 0,
        parseWooBoolean(sync_orders, parseWooBoolean(existing.sync_orders, false)) ? 1 : 0,
        parseWooBoolean(sync_stock, parseWooBoolean(existing.sync_stock, true)) ? 1 : 0,
        parseWooBoolean(sync_prices, parseWooBoolean(existing.sync_prices, true)) ? 1 : 0,
        sync_mode || existing.sync_mode || 'manual',
        Number(sync_interval_minutes || existing.sync_interval_minutes || 60),
        parseWooBoolean(auto_sync, parseWooBoolean(existing.auto_sync, false)) ? 1 : 0,
        tax_mode || existing.tax_mode || 'woocommerce',
        category_mode || existing.category_mode || 'milo',
        conflict_priority || existing.conflict_priority || 'milo',
        nextStatusMap,
        nextStockStatuses,
        nextPaidStatuses,
        order_sync_mode || existing.order_sync_mode || 'webhook',
        order_sales_channel || existing.order_sales_channel || 'woocommerce',
        customer_sync_strategy || existing.customer_sync_strategy || 'create_or_link',
        generic_customer_name || existing.generic_customer_name || 'Cliente WooCommerce',
        nextWebhookSecret,
        nextWebhookAuthToken,
        webhook_signature_header || existing.webhook_signature_header || 'x-wc-webhook-signature',
        webhook_delivery_header || existing.webhook_delivery_header || 'x-wc-webhook-delivery-id'
      ]
    );
  } else {
    run(
      `INSERT INTO woocommerce_sync (
        id, store_url, consumer_key, consumer_secret, wp_username, wp_app_password, api_version, sync_direction,
        sync_products, sync_customers, sync_orders, sync_stock, sync_prices,
        sync_mode, sync_interval_minutes, auto_sync, tax_mode, category_mode,
        conflict_priority, order_status_map, order_stock_statuses, order_paid_statuses, order_sync_mode,
        order_sales_channel, customer_sync_strategy, generic_customer_name, webhook_secret, webhook_auth_token,
        webhook_signature_header, webhook_delivery_header
      )
       VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        store_url,
        nextKey,
        nextSecret,
        nextWpUsername,
        nextWpAppPassword,
        api_version || 'wc/v3',
        sync_direction || 'export',
        parseWooBoolean(sync_products, true) ? 1 : 0,
        parseWooBoolean(sync_customers, false) ? 1 : 0,
        parseWooBoolean(sync_orders, false) ? 1 : 0,
        parseWooBoolean(sync_stock, true) ? 1 : 0,
        parseWooBoolean(sync_prices, true) ? 1 : 0,
        sync_mode || 'manual',
        Number(sync_interval_minutes || 60),
        parseWooBoolean(auto_sync, false) ? 1 : 0,
        tax_mode || 'woocommerce',
        category_mode || 'milo',
        conflict_priority || 'milo',
        nextStatusMap,
        nextStockStatuses,
        nextPaidStatuses,
        order_sync_mode || 'webhook',
        order_sales_channel || 'woocommerce',
        customer_sync_strategy || 'create_or_link',
        generic_customer_name || 'Cliente WooCommerce',
        nextWebhookSecret,
        nextWebhookAuthToken,
        webhook_signature_header || 'x-wc-webhook-signature',
        webhook_delivery_header || 'x-wc-webhook-delivery-id'
      ]
    );
  }

  saveDatabase();
  initializeWooAutomation();
  const updated = get('SELECT * FROM woocommerce_sync WHERE id = 1');
  res.json({ success: true, polling_active: pollingInterval !== null, config: buildWooStatusResponse(updated) });
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

router.get('/orders/logs', authenticate, (req, res) => {
  res.json(getOrderSyncLogs(req.query.limit));
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
    const { after, before, status, per_page } = req.body || {};
    const result = await importWooOrders(
      { after, before, status, per_page },
      { origin: 'woocommerce_api_manual', eventType: 'order.manual_backfill' }
    );
    res.json({ success: true, ...result });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
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
