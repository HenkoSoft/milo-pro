const fs = require('fs');
const { createDatabaseAccess } = require('./runtime-db.js');
const {
  getWooAttributeOptions: getWooAttributeOptionsBase,
  getWooPrimaryBrand: getWooPrimaryBrandBase,
  getWooPrimaryCategory,
  getWooPrimaryColor: getWooPrimaryColorBase,
  getWooProductImages,
  normalizePrice,
  normalizeStock,
  upsertWooAttribute
} = require('./woocommerce-sync-utils.js');
const {
  woocommerceRequest: woocommerceRequestBase,
  wordpressRequest: wordpressRequestBase
} = require('./woocommerce-request.js');
const {
  collapseCategoryIdsToLeaves,
  ensureBrandRecord,
  ensureCategoryRecord,
  findBrandByName,
  findCategoryByNameAndParent,
  getBrandById,
  getBrandByWooId,
  getCategoryById,
  getCategoryTrail,
  getCategoryByWooId,
  getProductById,
  getProductCategories,
  getProductImages,
  normalizeCatalogText
} = require('./catalog.js');
const { getNextAutomaticProductSku } = require('./product-sku.js');

type AnyRecord = Record<string, any>;
type RuntimeDatabaseLike = AnyRecord | null;
type WooConfig = AnyRecord | null;
type WooCategoryRecord = AnyRecord;
type WooProductRecord = AnyRecord;
type SyncProductOptions = {
  action?: string;
  persistChanges?: boolean;
  retries?: number;
};

declare const module: any;

let runtimeDatabase: RuntimeDatabaseLike = null;
let cachedWooConfig: WooConfig = null;

function setRuntimeDatabase(adapter: RuntimeDatabaseLike) {
  runtimeDatabase = adapter || null;
}

function getDatabaseAccess() {
  return createDatabaseAccess(runtimeDatabase);
}

function getActiveWooConfig(): WooConfig {
  return cachedWooConfig;
}

async function getActiveWooConfigAsync(): Promise<WooConfig> {
  const db = getDatabaseAccess();
  cachedWooConfig = await db.get('SELECT * FROM woocommerce_sync WHERE id = 1 AND active = 1');
  return cachedWooConfig;
}

function isWooExportEnabled(config: WooConfig) {
  return Boolean(config && config.store_url && config.sync_direction !== 'import');
}

function getWooAttributeOptions(wooProduct: WooProductRecord, attributeNames: string[] = []) {
  return getWooAttributeOptionsBase(wooProduct, normalizeCatalogText, attributeNames);
}

function getWooPrimaryBrand(wooProduct: WooProductRecord) {
  return getWooPrimaryBrandBase(wooProduct, normalizeCatalogText);
}

function getWooPrimaryColor(wooProduct: WooProductRecord) {
  return getWooPrimaryColorBase(wooProduct, normalizeCatalogText);
}

async function buildWooManagedAttribute(attributes: any[] = [], config: WooConfig, name: string, slug: string, options: any) {
  const nextOptions = [...new Set((Array.isArray(options) ? options : [options]).map((item) => String(item || '').trim()).filter(Boolean))];
  if (!name || nextOptions.length === 0) return attributes;

  const attribute = await ensureWooProductAttribute(config, name, slug).catch(() => null);
  if (attribute && attribute.id) {
    for (const option of nextOptions) {
      await ensureWooAttributeTerm(config, attribute.id, option).catch(() => null);
    }

    const list = Array.isArray(attributes) ? attributes.slice() : [];
    const existingIndex = list.findIndex((item) => Number(item && item.id) === Number(attribute.id) || normalizeCatalogText(item && item.name) === normalizeCatalogText(name));
    const payload = {
      id: attribute.id,
      name: attribute.name || name,
      visible: true,
      variation: false,
      options: nextOptions
    };

    if (existingIndex >= 0) {
      list[existingIndex] = {
        ...list[existingIndex],
        ...payload
      };
      return list;
    }

    list.push(payload);
    return list;
  }

  return upsertWooAttribute(attributes, normalizeCatalogText, name, nextOptions);
}

async function ensureLocalCategory(categoryName: string, parentId: number | null = null, extra: AnyRecord = {}) {
  if (!categoryName) return null;
  const category = await ensureCategoryRecord({
    name: categoryName,
    parent_id: parentId,
    ...extra
  });
  return category ? category.id : null;
}

async function ensureLocalBrand(brandName: string, extra: AnyRecord = {}) {
  if (!brandName) return null;
  const brand = await ensureBrandRecord({
    name: brandName,
    ...extra
  });
  return brand ? brand.id : null;
}

function woocommerceRequest(method: string, apiPath: string, data: any = null, config: WooConfig = null, requestOptions: AnyRecord | null = null) {
  return woocommerceRequestBase(method, apiPath, data, config, requestOptions, getActiveWooConfigAsync);
}

function wordpressRequest(method: string, apiPath: string, body: any = null, headers: AnyRecord = {}, config: WooConfig = null) {
  return wordpressRequestBase(method, apiPath, body, headers, config, getActiveWooConfigAsync);
}

async function getWooCategoryDetail(categoryId: number | string, config: WooConfig = null, cache = new Map<number, any>()) {
  if (!categoryId) return null;
  const activeConfig = config || await getActiveWooConfigAsync();
  const key = Number(categoryId);
  if (cache.has(key)) return cache.get(key);
  const detail = await woocommerceRequest('GET', `/products/categories/${categoryId}`, null, activeConfig);
  cache.set(key, detail);
  return detail;
}

async function ensureLocalCategoryFromWooCategory(wooCategory: WooCategoryRecord, config: WooConfig = null, cache = new Map<number, any>()): Promise<any> {
  const activeConfig = config || await getActiveWooConfigAsync();
  if (!wooCategory || !wooCategory.id) return null;
  const detailed = wooCategory.parent !== undefined && wooCategory.slug !== undefined
    ? wooCategory
    : await getWooCategoryDetail(wooCategory.id, activeConfig, cache);
  if (!detailed || !detailed.id) return null;

  let parentId = null;
  if (Number(detailed.parent || 0) > 0) {
    const parentCategory = await ensureLocalCategoryFromWooCategory({ id: detailed.parent }, activeConfig, cache);
    parentId = parentCategory ? parentCategory.id : null;
  }

  return ensureCategoryRecord({
    name: detailed.name,
    slug: detailed.slug,
    parent_id: parentId,
    woocommerce_category_id: detailed.id,
    active: 1
  });
}

async function ensureLocalCategoriesFromWooProduct(wooProduct: WooProductRecord, config: WooConfig = null) {
  const activeConfig = config || await getActiveWooConfigAsync();
  const cache = new Map<number, any>();
  const categories: any[] = [];
  for (const category of (Array.isArray(wooProduct && wooProduct.categories) ? wooProduct.categories : [])) {
    const local = await ensureLocalCategoryFromWooCategory(category, activeConfig, cache);
    if (local && !categories.some((item) => Number(item.id) === Number(local.id))) {
      categories.push(local);
    }
  }
  return categories;
}

async function findWooCategoryByName(config: WooConfig, name: string, parentWooId = 0) {
  if (!name) return null;
  const result = await woocommerceRequest('GET', `/products/categories?search=${encodeURIComponent(name)}&per_page=100`, null, config);
  if (!Array.isArray(result)) return null;
  const normalized = normalizeCatalogText(name);
  return result.find((item) => {
    return normalizeCatalogText(item.name) === normalized
      && Number(item.parent || 0) === Number(parentWooId || 0);
  }) || null;
}

async function ensureWooCategoryFromLocal(localCategoryId: number | string, config: WooConfig = null, cache = new Map<number, any>()) {
  const db = getDatabaseAccess();
  const activeConfig = config || await getActiveWooConfigAsync();
  if (!localCategoryId) return null;
  const key = Number(localCategoryId);
  if (cache.has(key)) return cache.get(key);

  const localCategory = await getCategoryById(localCategoryId);
  if (!localCategory) return null;

  let existing = localCategory.woocommerce_category_id
    ? await woocommerceRequest('GET', `/products/categories/${localCategory.woocommerce_category_id}`, null, activeConfig).catch(() => null)
    : null;

  let parentWooId = 0;
  if (localCategory.parent_id) {
    const parentWoo = await ensureWooCategoryFromLocal(localCategory.parent_id, activeConfig, cache);
    parentWooId = parentWoo && parentWoo.id ? parentWoo.id : 0;
  }

  if (!existing) {
    existing = await findWooCategoryByName(activeConfig, localCategory.name, parentWooId);
  }

  if (!existing) {
    existing = await woocommerceRequest(
      'POST',
      '/products/categories',
      {
        name: localCategory.name,
        slug: localCategory.slug || undefined,
        parent: parentWooId || 0
      },
      activeConfig
    );
  }

  if (existing && existing.id) {
    await db.run(
      'UPDATE categories SET woocommerce_category_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [existing.id, localCategoryId]
    );
  }

  cache.set(key, existing);
  return existing;
}

async function findWooBrandByName(config: WooConfig, name: string) {
  if (!name) return null;
  try {
    const result = await woocommerceRequest('GET', `/products/brands?search=${encodeURIComponent(name)}&per_page=100`, null, config);
    if (!Array.isArray(result)) return null;
    const normalized = normalizeCatalogText(name);
    return result.find((item) => normalizeCatalogText(item.name) === normalized) || null;
  } catch (error: any) {
    if (/404|Invalid route|No route/i.test(String(error.message || ''))) return null;
    throw error;
  }
}

async function findWooAttributeByName(config: WooConfig, name: string) {
  if (!name) return null;
  const result = await woocommerceRequest('GET', `/products/attributes?search=${encodeURIComponent(name)}&per_page=100`, null, config);
  if (!Array.isArray(result)) return null;
  const normalized = normalizeCatalogText(name);
  return result.find((item) => normalizeCatalogText(item.name) === normalized) || null;
}

async function ensureWooProductAttribute(config: WooConfig, name: string, slug: string) {
  if (!name) return null;
  let attribute = await findWooAttributeByName(config, name);
  if (!attribute) {
    attribute = await woocommerceRequest('POST', '/products/attributes', {
      name,
      slug: slug || normalizeCatalogText(name).replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, ''),
      type: 'select',
      order_by: 'menu_order',
      has_archives: true
    }, config).catch(() => null);
  }
  return attribute && attribute.id ? attribute : null;
}

async function findWooAttributeTerm(config: WooConfig, attributeId: number | string, termName: string) {
  if (!attributeId || !termName) return null;
  const result = await woocommerceRequest('GET', `/products/attributes/${attributeId}/terms?search=${encodeURIComponent(termName)}&per_page=100`, null, config);
  if (!Array.isArray(result)) return null;
  const normalized = normalizeCatalogText(termName);
  return result.find((item) => normalizeCatalogText(item.name) === normalized) || null;
}

async function ensureWooAttributeTerm(config: WooConfig, attributeId: number | string, termName: string) {
  if (!attributeId || !termName) return null;
  let term = await findWooAttributeTerm(config, attributeId, termName);
  if (!term) {
    term = await woocommerceRequest('POST', `/products/attributes/${attributeId}/terms`, {
      name: termName,
      slug: normalizeCatalogText(termName).replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
    }, config).catch(() => null);
  }
  return term && term.id ? term : null;
}

async function ensureWooBrand(config: WooConfig, brandName: string, brandId: number | null = null) {
  const db = getDatabaseAccess();
  if (!brandName) return null;

  let existing = brandId ? await getBrandById(brandId) : await findBrandByName(brandName);
  let remote = existing && existing.woocommerce_brand_id
    ? await woocommerceRequest('GET', `/products/brands/${existing.woocommerce_brand_id}`, null, config).catch(() => null)
    : null;

  if (!remote) {
    remote = await findWooBrandByName(config, brandName);
  }

  if (!remote) {
    try {
      remote = await woocommerceRequest('POST', '/products/brands', { name: brandName }, config);
    } catch (error: any) {
      if (!/404|Invalid route|No route/i.test(String(error.message || ''))) throw error;
    }
  }

  if (existing && remote && remote.id) {
    await db.run(
      'UPDATE brands SET woocommerce_brand_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [remote.id, existing.id]
    );
  }

  return remote;
}

async function buildWooProductPayload(product: AnyRecord, config: WooConfig = null) {
  const db = getDatabaseAccess();
  const activeConfig = config || await getActiveWooConfigAsync();
  const snapshot = product && product.id ? ((await getProductById(product.id)) || product) : product;
  const sku = snapshot.sku || getNextAutomaticProductSku(await db.all('SELECT sku FROM products'));
  const stockQuantity = normalizeStock(snapshot.stock);
  const payload: AnyRecord = {
    name: snapshot.name || `Producto ${snapshot.id}`,
    description: snapshot.description || '',
    short_description: snapshot.short_description || '',
    regular_price: normalizePrice(snapshot.sale_price),
    stock_quantity: stockQuantity,
    manage_stock: true,
    stock_status: stockQuantity > 0 ? 'instock' : 'outofstock',
    sku,
    status: 'publish'
  };

  let existingWooProduct = null;
  const snapshotWooId = snapshot.woocommerce_product_id || snapshot.woocommerce_id || null;
  if (snapshotWooId) {
    existingWooProduct = await woocommerceRequest('GET', `/products/${snapshotWooId}`, null, activeConfig).catch(() => null);
  }

  const categoryCache = new Map<number, any>();
  const localCategories = Array.isArray(snapshot.categories) && snapshot.categories.length > 0
    ? snapshot.categories
    : await getProductCategories(snapshot.id);
  const wooCategories: Array<{ id: number | string }> = [];
  const categoryIdsToSync: Array<number | string> = [];

  for (const category of localCategories) {
    const trail = await getCategoryTrail(category.id);
    const ids = trail.length > 0 ? trail.map((item: AnyRecord) => item.id) : [category.id];
    ids.forEach((id: number | string) => {
      if (!categoryIdsToSync.includes(id)) {
        categoryIdsToSync.push(id);
      }
    });
  }

  for (const categoryId of categoryIdsToSync) {
    const remote = await ensureWooCategoryFromLocal(categoryId, activeConfig, categoryCache);
    if (remote && remote.id && !wooCategories.some((item: { id: number | string }) => Number(item.id) === Number(remote.id))) {
      wooCategories.push({ id: remote.id });
    }
  }

  if (wooCategories.length > 0) {
    payload.categories = wooCategories;
  }

  const brandRecord = snapshot.brand_id ? await getBrandById(snapshot.brand_id) : null;
  const brand = snapshot.brand_name || (brandRecord ? brandRecord.name : null) || '';
  if (brand) {
    const wooBrand = await ensureWooBrand(activeConfig, brand, snapshot.brand_id);
    if (wooBrand && wooBrand.id) {
      payload.brands = [{ id: wooBrand.id }];
    }
  }

  let attributes = Array.isArray(existingWooProduct && existingWooProduct.attributes)
    ? existingWooProduct.attributes.filter((attr: AnyRecord) => !['marca', 'brand', 'color', 'colour', 'colores'].includes(normalizeCatalogText(attr && attr.name)))
    : [];
  if (brand) {
    attributes = await buildWooManagedAttribute(attributes, activeConfig, 'Marca', 'marca', [brand]);
  }
  if (snapshot.color) {
    attributes = await buildWooManagedAttribute(attributes, activeConfig, 'Color', 'color', [snapshot.color]);
  }
  if (attributes.length > 0) {
    payload.attributes = attributes;
  }

  const images = Array.isArray(snapshot.images) && snapshot.images.length > 0
    ? snapshot.images
    : await getProductImages(snapshot.id);
  const wooImages = [];
  for (let index = 0; index < images.length; index += 1) {
    const item = images[index];
    let mediaId = item.woocommerce_media_id || null;
    if (!mediaId && item.ruta_local && fs.existsSync(item.ruta_local)) {
      const uploadedMedia = await uploadProductImageToWooCommerce(snapshot.id, item, activeConfig).catch(() => null);
      if (uploadedMedia && uploadedMedia.id) {
        mediaId = uploadedMedia.id;
        await db.run(
          'UPDATE product_images SET woocommerce_media_id = ? WHERE id = ?',
          [mediaId, item.id]
        );
      }
    }

    const fallbackSrc = [item.url_remote, item.url_publica, item.url_local].find((value) => /^https?:\/\//i.test(String(value || '').trim())) || '';
    const imagePayload = {
      id: mediaId || undefined,
      src: fallbackSrc,
      position: Number.isFinite(Number(item.orden)) ? Number(item.orden) : index
    };

    if (imagePayload.id || imagePayload.src) {
      wooImages.push(imagePayload);
    }
  }

  if (wooImages.length > 0) {
    payload.images = wooImages;
  }

  return payload;
}

async function uploadProductImageToWooCommerce(productId: number | string, image: AnyRecord, config: WooConfig = null) {
  const activeConfig = config || await getActiveWooConfigAsync();
  if (!image || !image.ruta_local || !fs.existsSync(image.ruta_local)) {
    return null;
  }

  const fileBuffer = fs.readFileSync(image.ruta_local);
  const fileName = image.nombre_archivo || `producto-${productId}.webp`;
  const response = await wordpressRequest(
    'POST',
    '/wp-json/wp/v2/media',
    fileBuffer,
    {
      'Content-Type': 'image/webp',
      'Content-Disposition': `attachment; filename="${fileName}"`,
      'Content-Length': fileBuffer.length
    },
    activeConfig
  );
  return response && response.id ? response : null;
}

async function insertSyncLog(product: AnyRecord, action: string, status: string, message: string) {
  const db = getDatabaseAccess();
  await db.run(
    'INSERT INTO product_sync_log (milo_id, woocommerce_id, action, status, message) VALUES (?, ?, ?, ?, ?)',
    [product?.id || null, product?.woocommerce_product_id || product?.woocommerce_id || null, action, status, message]
  );
}

async function findWooProductBySku(config: WooConfig, sku: string) {
  if (!sku) return null;
  const statusVariants = ['', 'publish', 'draft', 'pending', 'private', 'trash'];
  for (const status of statusVariants) {
    const query = `/products?sku=${encodeURIComponent(sku)}&per_page=1${status ? `&status=${status}` : ''}`;
    try {
      const result = await woocommerceRequest('GET', query, null, config);
      if (Array.isArray(result) && result.length > 0) {
        return result[0];
      }
    } catch (error: any) {
      if (!status) throw error;
    }
  }
  return null;
}

async function syncProductSnapshotToWooCommerce(productSnapshot: AnyRecord, options: SyncProductOptions = {}) {
  const db = getDatabaseAccess();
  const { action = 'sale_sync', persistChanges = true, retries = 2 } = options;
  if (!productSnapshot || !productSnapshot.id) {
    throw new Error('Producto invalido para sincronizar');
  }

  const config = await getActiveWooConfigAsync();
  if (!isWooExportEnabled(config)) {
    return { success: true, skipped: true, productId: productSnapshot.id };
  }

  let lastError = null;

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      const latestProduct = (await getProductById(productSnapshot.id)) || productSnapshot;
      const payload: AnyRecord = await buildWooProductPayload(latestProduct, config);

      let wooProductId = latestProduct.woocommerce_product_id || latestProduct.woocommerce_id || null;
      if (!wooProductId) {
        const bySku = await findWooProductBySku(config, payload.sku);
        if (bySku && bySku.id) wooProductId = bySku.id;
      }

      const endpoint = wooProductId ? `/products/${wooProductId}` : '/products';
      const method = wooProductId ? 'PUT' : 'POST';
      const result = await woocommerceRequest(method, endpoint, payload, config);

      if (!result || !result.id) {
        throw new Error('WooCommerce no devolvio un ID de producto');
      }

      await db.run(
        `UPDATE products
         SET woocommerce_id = ?, woocommerce_product_id = ?, sync_status = 'synced', last_sync_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
        [result.id, result.id, latestProduct.id]
      );
      await db.run('UPDATE woocommerce_sync SET last_sync = CURRENT_TIMESTAMP WHERE id = 1');
      await insertSyncLog({ ...latestProduct, woocommerce_product_id: result.id }, action, 'success', `${method === 'POST' ? 'Creado' : 'Actualizado'} en WooCommerce`);

      if (persistChanges) await db.save();

      return {
        success: true,
        action: method === 'POST' ? 'created' : 'updated',
        productId: latestProduct.id,
        woocommerce_id: result.id
      };
    } catch (error: any) {
      if (
        /SKU/i.test(String(error.message || ''))
        && /lookup|tabla de b[uú]squeda|search/i.test(String(error.message || ''))
      ) {
        try {
          const latestProduct = (await getProductById(productSnapshot.id)) || productSnapshot;
          const payload = await buildWooProductPayload(latestProduct, config);
          const bySku = await findWooProductBySku(config, payload.sku);
          if (bySku && bySku.id) {
            const rescued = await woocommerceRequest('PUT', `/products/${bySku.id}`, payload, config);
            if (rescued && rescued.id) {
              await db.run(
                `UPDATE products
                 SET woocommerce_id = ?, woocommerce_product_id = ?, sync_status = 'synced', last_sync_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
                 WHERE id = ?`,
                [rescued.id, rescued.id, latestProduct.id]
              );
              await db.run('UPDATE woocommerce_sync SET last_sync = CURRENT_TIMESTAMP WHERE id = 1');
              await insertSyncLog(
                { ...latestProduct, woocommerce_product_id: rescued.id },
                action,
                'success',
                'Producto vinculado por SKU existente y actualizado en WooCommerce'
              );
              if (persistChanges) await db.save();
              return {
                success: true,
                action: 'updated',
                productId: latestProduct.id,
                woocommerce_id: rescued.id
              };
            }
          }
        } catch (rescueError: any) {
          lastError = rescueError;
        }
      }
      lastError = error;
      if (attempt < retries) {
        await new Promise((resolve) => setTimeout(resolve, 300 * (attempt + 1)));
      }
    }
  }

  await db.run(
    `UPDATE products
     SET sync_status = 'error', last_sync_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
     WHERE id = ?`,
    [productSnapshot.id]
  );
  await insertSyncLog(productSnapshot, action, 'error', lastError.message);
  if (persistChanges) await db.save();

  return {
    success: false,
    productId: productSnapshot.id,
    error: lastError.message
  };
}

async function syncProductToWooCommerce(productId: number | string, options: SyncProductOptions = {}) {
  const product = await getProductById(productId);
  if (!product) {
    return { success: false, productId, error: 'Producto no encontrado' };
  }

  return syncProductSnapshotToWooCommerce(product, options);
}

async function deleteProductFromWooCommerce(productSnapshot: AnyRecord, options: SyncProductOptions = {}) {
  const db = getDatabaseAccess();
  const { action = 'product_delete', persistChanges = true } = options;
  if (!productSnapshot || !productSnapshot.id) {
    throw new Error('Producto invalido para eliminar en WooCommerce');
  }

  const config = await getActiveWooConfigAsync();
  const wooProductId = productSnapshot.woocommerce_product_id || productSnapshot.woocommerce_id || null;

  if (!config || !config.store_url || !wooProductId) {
    return { success: true, skipped: true, productId: productSnapshot.id };
  }

  try {
    await woocommerceRequest('DELETE', `/products/${wooProductId}?force=true`, null, config);
    await insertSyncLog(productSnapshot, action, 'success', 'Producto eliminado en WooCommerce');
    if (persistChanges) await db.save();
    return { success: true, productId: productSnapshot.id, woocommerce_id: wooProductId };
  } catch (error: any) {
    await insertSyncLog(productSnapshot, action, 'error', error.message || 'No se pudo eliminar en WooCommerce');
    if (persistChanges) await db.save();
    return { success: false, productId: productSnapshot.id, error: error.message };
  }
}

module.exports = {
  buildWooProductPayload,
  deleteProductFromWooCommerce,
  ensureLocalBrand,
  ensureLocalCategory,
  ensureLocalCategoryFromWooCategory,
  ensureLocalCategoriesFromWooProduct,
  ensureWooCategoryFromLocal,
  findWooProductBySku,
  getActiveWooConfig,
  getActiveWooConfigAsync,
  getWooPrimaryBrand,
  getWooPrimaryCategory,
  getWooPrimaryColor,
  getWooProductImages,
  isWooExportEnabled,
  normalizeWooText: normalizeCatalogText,
  setRuntimeDatabase,
  syncProductSnapshotToWooCommerce,
  syncProductToWooCommerce,
  woocommerceRequest
};

