const express = require('express');
const { authenticate } = require('../auth');
const { createDatabaseAccess } = require('../services/runtime-db');
const { buildAutomaticProductSku, getNextAutomaticProductSku } = require('../services/product-sku');
const {
  ensureLocalBrand,
  ensureLocalCategoriesFromWooProduct,
  findWooProductBySku,
  getActiveWooConfigAsync,
  getWooPrimaryBrand,
  getWooPrimaryColor,
  getWooProductImages,
  syncProductSnapshotToWooCommerce,
  woocommerceRequest
} = require('../services/woocommerce-sync');
const {
  getSyncLogs: getOrderSyncLogs,
  getWooOrderSyncConfig,
  getWooOrderSyncConfigAsync,
  syncWooOrder,
  verifyWebhookRequest
} = require('../services/woo-order-sync');
const {
  importWooOrderById,
  importWooOrders
} = require('../services/woo-order-importer');
const { registerWooAdminRoutes } = require('../services/woocommerce-admin-routes');
const { createWooPollingManager } = require('../services/woocommerce-polling');
const { registerWooPollingRoutes } = require('../services/woocommerce-polling-routes');
const { registerWooProductRoutes } = require('../services/woocommerce-product-routes');
const { registerWooOrderRoutes } = require('../services/woocommerce-order-routes');
const {
  buildWooStatusResponse,
  normalizeWooConfigPayload,
  normalizeWooConnectionTestPayload,
  normalizeWooLogsLimit,
  normalizeWooOrderImportPayload,
  parseWooBoolean,
  sanitizeWooOrderSyncLog,
  sanitizeWooPollingResult,
  sanitizeWooPollingStatus,
  sanitizeWooProductSyncLog
} = require('../services/woocommerce-admin');
const {
  getProductById,
  collapseCategoryIdsToLeaves,
  setRuntimeDatabase: setCatalogRuntimeDatabase,
  syncProductCategories,
  syncProductImages
} = require('../services/catalog');

const router = express.Router();
const POLLING_INTERVAL_MS = 30000;
let runtimeDatabase = null;

function setRuntimeDatabase(adapter) {
  runtimeDatabase = adapter || null;
}

function getDatabaseAccess() {
  return createDatabaseAccess(runtimeDatabase);
}

async function resolveActiveWooConfig() {
  if (typeof getActiveWooConfigAsync === 'function') {
    return getActiveWooConfigAsync();
  }
  return null;
}

function requireAdmin(req, res) {
  if (req.user.role !== 'admin') {
    res.status(403).json({ error: 'Solo el administrador puede ejecutar esta accion' });
    return false;
  }
  return true;
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

async function getExistingLocalProduct(wooProduct) {
  const db = getDatabaseAccess();
  let existing = await db.get('SELECT * FROM products WHERE woocommerce_id = ?', [wooProduct.id]);
  if (!existing) {
    existing = await db.get('SELECT * FROM products WHERE woocommerce_product_id = ?', [wooProduct.id]);
  }
  if (!existing && wooProduct.sku) {
    existing = await db.get('SELECT * FROM products WHERE sku = ?', [wooProduct.sku]);
  }
  if (!existing) {
    existing = await db.get('SELECT * FROM products WHERE sku = ?', ['WOO-' + wooProduct.id]);
  }
  if (!existing) {
    existing = await db.get('SELECT * FROM products WHERE sku = ?', [buildAutomaticProductSku(wooProduct.id)]);
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

  const db = getDatabaseAccess();
  const stock = parseWooStock(wooProduct);
  const price = parseWooPrice(wooProduct);
  const images = getWooProductImages(wooProduct);
  const imageUrl = images[0] ? images[0].url_remote : null;
  const importedSku = String(wooProduct.sku || '').trim();
  const localCategories = await ensureLocalCategoriesFromWooProduct(wooProduct);
  const primaryBrand = getWooPrimaryBrand(wooProduct);
  const primaryColor = getWooPrimaryColor(wooProduct);
  const localCategoryIds = await collapseCategoryIdsToLeaves(localCategories.map((item) => item.id));
  const primaryCategory = localCategoryIds.length > 0
    ? (localCategories.find((item) => Number(item.id) === Number(localCategoryIds[0])) || null)
    : null;
  const localCategoryId = primaryCategory ? primaryCategory.id : null;
  const localBrandId = await ensureLocalBrand(primaryBrand ? primaryBrand.name : '', { woocommerce_brand_id: primaryBrand && primaryBrand.id ? primaryBrand.id : null });
  const existing = await getExistingLocalProduct(wooProduct);
  const shortDescription = wooProduct.short_description || '';
  const config = await resolveActiveWooConfig();
  const localWins = localCatalogWins(config);
  const skuRows = await db.all('SELECT sku FROM products');

  if (existing) {
    const sku = localWins
      ? (existing.sku || importedSku || getNextAutomaticProductSku(skuRows))
      : (importedSku || existing.sku || getNextAutomaticProductSku(skuRows));
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
    const mergedImages = localWins && existing.image_url && !imageUrl ? [] : images;
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

    await db.run(
      `UPDATE products
       SET sku = ?, name = ?, description = ?, short_description = ?, color = ?, category_id = ?, category_primary_id = ?, brand_id = ?, sale_price = ?, stock = ?, image_url = ?, woocommerce_id = ?, woocommerce_product_id = ?, sync_status = 'synced', last_sync_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [sku, nextName, nextDescription, nextShortDescription, nextColor, nextCategoryId, nextCategoryId, nextBrandId, nextPrice, nextStock, nextImageUrl, wooProduct.id, wooProduct.id, existing.id]
    );
    await syncProductCategories(existing.id, nextCategoryIds, nextCategoryId);
    if (mergedImages.length > 0 || !localWins) {
      await syncProductImages(existing.id, mergedImages.length > 0 ? mergedImages : images);
    }

    await db.run(
      'INSERT INTO product_sync_log (milo_id, woocommerce_id, action, status, message) VALUES (?, ?, ?, ?, ?)',
      [existing.id, wooProduct.id, action, 'success', localWins ? 'Producto conciliado desde WooCommerce sin pisar datos locales' : (changed ? 'Producto actualizado desde WooCommerce' : 'Producto verificado desde WooCommerce')]
    );

    return { changed, imported: false, updated: changed, unchanged: !changed, miloId: existing.id, product: await getProductById(existing.id) };
  }

  const result = await db.run(
    `INSERT INTO products (sku, name, description, short_description, color, category_id, category_primary_id, brand_id, sale_price, stock, image_url, woocommerce_id, woocommerce_product_id, sync_status, last_sync_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'synced', CURRENT_TIMESTAMP)`,
    [importedSku || getNextAutomaticProductSku(skuRows), wooProduct.name, wooProduct.description || '', shortDescription, primaryColor || null, localCategoryId, localCategoryId, localBrandId, price, stock, imageUrl, wooProduct.id, wooProduct.id]
  );
  await syncProductCategories(result.lastInsertRowid, localCategoryIds, localCategoryId);
  await syncProductImages(result.lastInsertRowid, images);

  await db.run(
    'INSERT INTO product_sync_log (milo_id, woocommerce_id, action, status, message) VALUES (?, ?, ?, ?, ?)',
    [result.lastInsertRowid, wooProduct.id, action, 'success', 'Producto importado desde WooCommerce']
  );

  return { changed: true, imported: true, updated: false, unchanged: false, miloId: result.lastInsertRowid, product: await getProductById(result.lastInsertRowid) };
}

async function unlinkWooProductFromLocal(wooProductId, action) {
  const db = getDatabaseAccess();
  const existing = await db.get('SELECT id FROM products WHERE woocommerce_id = ? OR woocommerce_product_id = ?', [wooProductId, wooProductId]);
  if (!existing) {
    return false;
  }

  await db.run(
    `UPDATE products
     SET woocommerce_id = NULL, woocommerce_product_id = NULL, sync_status = 'pending', updated_at = CURRENT_TIMESTAMP
     WHERE id = ?`,
    [existing.id]
  );
  await db.run(
    'INSERT INTO product_sync_log (milo_id, woocommerce_id, action, status, message) VALUES (?, ?, ?, ?, ?)',
    [existing.id, wooProductId, action, 'success', 'Producto desvinculado por eliminacion en WooCommerce']
  );
  return true;
}

const wooPollingManager = createWooPollingManager({
  pollingIntervalMs: POLLING_INTERVAL_MS,
  getConfig: () => resolveActiveWooConfig(),
  fetchWooProducts: () => woocommerceRequest('GET', '/products?per_page=100'),
  hydrateWooProduct: (wooProduct) => hydrateWooProductForImport(wooProduct),
  upsertWooProduct: (wooProduct, action) => upsertWooProductIntoLocal(wooProduct, action),
  markLastSync: async () => {
    const db = getDatabaseAccess();
    await db.run('UPDATE woocommerce_sync SET last_sync = CURRENT_TIMESTAMP WHERE id = 1');
  },
  persist: async () => {
    const db = getDatabaseAccess();
    await db.save();
  },
  log: console
});

function canImportFromWoo(config) {
  return wooPollingManager.canImportFromWoo(config);
}

function importWooProducts(options) {
  return wooPollingManager.importWooProducts(options);
}

function pollWooCommerce(action) {
  return wooPollingManager.pollWooCommerce(action);
}

function stopWooPolling(reason) {
  return wooPollingManager.stopWooPolling(reason);
}

function startWooPolling(options) {
  return wooPollingManager.startWooPolling(options);
}

function initializeWooAutomation() {
  return wooPollingManager.initializeWooAutomation();
}

function isWooPollingActive() {
  return wooPollingManager.isPollingActive();
}

function getWooPollingIntervalSeconds() {
  return wooPollingManager.getPollingIntervalSeconds();
}

registerWooAdminRoutes(router, {
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
});

registerWooProductRoutes(router, {
  authenticate,
  findWooProductBySku,
  getActiveWooConfig: resolveActiveWooConfig,
  getActiveWooConfigAsync,
  getProductById,
  hydrateWooProductForImport,
  parseWooBoolean,
  sanitizeWooProductSyncLog,
  syncProductSnapshotToWooCommerce,
  unlinkWooProductFromLocal,
  upsertWooProductIntoLocal,
  woocommerceRequest
});

registerWooOrderRoutes(router, {
  authenticate,
  getWooOrderSyncConfig,
  getOrderSyncLogs,
  getWooOrderSyncConfigAsync,
  importWooOrderById,
  importWooOrders,
  normalizeWooLogsLimit,
  normalizeWooOrderImportPayload,
  requireAdmin,
  sanitizeWooOrderSyncLog,
  syncWooOrder,
  verifyWebhookRequest
});

registerWooPollingRoutes(router, {
  authenticate,
  getWooPollingIntervalSeconds,
  isWooPollingActive,
  sanitizeWooPollingResult,
  sanitizeWooPollingStatus,
  startWooPolling,
  stopWooPolling,
  woocommerceRequest
});

router.initializeWooAutomation = initializeWooAutomation;
router.setRuntimeDatabase = (adapter) => {
  setRuntimeDatabase(adapter);
  setCatalogRuntimeDatabase(adapter);
};

module.exports = router;



