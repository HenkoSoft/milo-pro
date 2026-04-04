const http = require('http');
const https = require('https');
const fs = require('fs');
const { get, run, all, saveDatabase } = require('../database');
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
} = require('./catalog');
const { getNextAutomaticProductSku } = require('./product-sku');

function getActiveWooConfig() {
  return get('SELECT * FROM woocommerce_sync WHERE id = 1 AND active = 1');
}

function isWooExportEnabled(config = getActiveWooConfig()) {
  return Boolean(config && config.store_url && config.sync_direction !== 'import');
}

function getTransport(url) {
  return url.protocol === 'http:' ? http : https;
}

function getPort(url) {
  if (url.port) return Number(url.port);
  return url.protocol === 'http:' ? 80 : 443;
}

function buildApiPath(url, apiPath, config = null) {
  const basePath = url.pathname && url.pathname !== '/' ? url.pathname.replace(/\/$/, '') : '';
  const normalizedApiPath = apiPath.startsWith('/') ? apiPath : `/${apiPath}`;
  const versionPath = ((config && config.api_version) ? String(config.api_version) : 'wc/v3').replace(/^\/+|\/+$/g, '');
  return `${basePath}/wp-json/${versionPath}${normalizedApiPath}`;
}

function normalizeStock(value) {
  const stock = Number.parseInt(value, 10);
  return Number.isFinite(stock) ? stock : 0;
}

function normalizePrice(value) {
  const price = Number(value);
  return Number.isFinite(price) ? price.toString() : '0';
}

function getWooPrimaryCategory(wooProduct) {
  return Array.isArray(wooProduct && wooProduct.categories) && wooProduct.categories.length > 0
    ? wooProduct.categories[0]
    : null;
}

function getWooPrimaryBrand(wooProduct) {
  if (wooProduct && Array.isArray(wooProduct.brands) && wooProduct.brands.length > 0) {
    return wooProduct.brands[0];
  }

  const attrs = Array.isArray(wooProduct && wooProduct.attributes) ? wooProduct.attributes : [];
  const brandAttr = attrs.find((attr) => ['brand', 'marca'].includes(normalizeCatalogText(attr.name)));
  if (brandAttr && Array.isArray(brandAttr.options) && brandAttr.options.length > 0) {
    return { name: brandAttr.options[0] };
  }

  return null;
}

function getWooAttributeOptions(wooProduct, attributeNames = []) {
  const normalizedNames = (Array.isArray(attributeNames) ? attributeNames : [attributeNames])
    .map((item) => normalizeCatalogText(item))
    .filter(Boolean);
  if (normalizedNames.length === 0) return [];

  const attrs = Array.isArray(wooProduct && wooProduct.attributes) ? wooProduct.attributes : [];
  const match = attrs.find((attr) => normalizedNames.includes(normalizeCatalogText(attr.name)));
  return match && Array.isArray(match.options)
    ? match.options.map((item) => String(item || '').trim()).filter(Boolean)
    : [];
}

function getWooPrimaryColor(wooProduct) {
  const options = getWooAttributeOptions(wooProduct, ['color', 'colour', 'colores']);
  return options[0] || null;
}

function upsertWooAttribute(attributes, name, options) {
  const nextOptions = [...new Set((Array.isArray(options) ? options : [options]).map((item) => String(item || '').trim()).filter(Boolean))];
  if (!name || nextOptions.length === 0) return attributes;

  const list = Array.isArray(attributes) ? attributes.slice() : [];
  const normalizedName = normalizeCatalogText(name);
  const existingIndex = list.findIndex((item) => normalizeCatalogText(item && item.name) === normalizedName);
  const payload = {
    name,
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

async function buildWooManagedAttribute(attributes, config, name, slug, options) {
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

  return upsertWooAttribute(attributes, name, nextOptions);
}

function getWooProductImages(wooProduct) {
  return (Array.isArray(wooProduct && wooProduct.images) ? wooProduct.images : []).map((image, index) => ({
    url_local: null,
    url_remote: image.src || '',
    woocommerce_media_id: image.id || null,
    orden: Number.isFinite(Number(image.position)) ? Number(image.position) : index,
    es_principal: index === 0
  })).filter((item) => item.url_remote);
}

function ensureLocalCategory(categoryName, parentId = null, extra = {}) {
  if (!categoryName) return null;
  const category = ensureCategoryRecord({
    name: categoryName,
    parent_id: parentId,
    ...extra
  });
  return category ? category.id : null;
}

function ensureLocalBrand(brandName, extra = {}) {
  if (!brandName) return null;
  const brand = ensureBrandRecord({
    name: brandName,
    ...extra
  });
  return brand ? brand.id : null;
}

function woocommerceRequest(method, apiPath, data = null, config = null, requestOptions = null) {
  return new Promise((resolve, reject) => {
    const activeConfig = config || getActiveWooConfig();
    if (!activeConfig || !activeConfig.store_url) {
      return reject(new Error('WooCommerce not configured'));
    }

    const timeoutMs = Math.max(1000, Number((requestOptions && requestOptions.timeout_ms) || process.env.WOO_REQUEST_TIMEOUT_MS || 15000));
    const url = new URL(activeConfig.store_url);
    const transport = getTransport(url);
    const auth = Buffer.from(`${activeConfig.consumer_key}:${activeConfig.consumer_secret}`).toString('base64');
    const options = {
      hostname: url.hostname,
      port: getPort(url),
      path: buildApiPath(url, apiPath, activeConfig),
      method,
      headers: {
        Authorization: `Basic ${auth}`,
        'Content-Type': 'application/json'
      }
    };

    const req = transport.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => {
        body += chunk;
      });
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          if (!body) return resolve(null);
          try {
            resolve(JSON.parse(body));
          } catch (error) {
            resolve(body);
          }
          return;
        }

        try {
          const parsed = JSON.parse(body);
          reject(new Error(`WooCommerce API Error ${res.statusCode}: ${parsed.message || body}`));
        } catch (error) {
          reject(new Error(`WooCommerce API Error ${res.statusCode}: ${body}`));
        }
      });
    });

    req.setTimeout(timeoutMs, () => {
      req.destroy(new Error('WooCommerce request timed out'));
    });

    req.on('error', reject);

    if (data) {
      req.write(JSON.stringify(data));
    }

    req.end();
  });
}

function wordpressRequest(method, apiPath, body = null, headers = {}, config = null) {
  return new Promise((resolve, reject) => {
    const activeConfig = config || getActiveWooConfig();
    if (!activeConfig || !activeConfig.store_url) {
      return reject(new Error('WooCommerce not configured'));
    }
    if (!activeConfig.wp_username || !activeConfig.wp_app_password) {
      return reject(new Error('Faltan credenciales profesionales de WordPress para subir imagenes.'));
    }

    const url = new URL(activeConfig.store_url);
    const transport = getTransport(url);
    const auth = Buffer.from(`${activeConfig.wp_username}:${activeConfig.wp_app_password}`).toString('base64');
    const basePath = url.pathname && url.pathname !== '/' ? url.pathname.replace(/\/$/, '') : '';
    const normalizedApiPath = apiPath.startsWith('/') ? apiPath : `/${apiPath}`;
    const options = {
      hostname: url.hostname,
      port: getPort(url),
      path: `${basePath}${normalizedApiPath}`,
      method,
      headers: {
        Authorization: `Basic ${auth}`,
        ...headers
      }
    };

    const req = transport.request(options, (res) => {
      let responseBody = '';
      res.on('data', (chunk) => {
        responseBody += chunk;
      });
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          if (!responseBody) return resolve(null);
          try {
            resolve(JSON.parse(responseBody));
          } catch (error) {
            resolve(responseBody);
          }
          return;
        }
        reject(new Error(`WordPress API Error ${res.statusCode}: ${responseBody}`));
      });
    });

    req.setTimeout(20000, () => {
      req.destroy(new Error('WordPress request timed out'));
    });
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

async function getWooCategoryDetail(categoryId, config = getActiveWooConfig(), cache = new Map()) {
  if (!categoryId) return null;
  const key = Number(categoryId);
  if (cache.has(key)) return cache.get(key);
  const detail = await woocommerceRequest('GET', `/products/categories/${categoryId}`, null, config);
  cache.set(key, detail);
  return detail;
}

async function ensureLocalCategoryFromWooCategory(wooCategory, config = getActiveWooConfig(), cache = new Map()) {
  if (!wooCategory || !wooCategory.id) return null;
  const detailed = wooCategory.parent !== undefined && wooCategory.slug !== undefined
    ? wooCategory
    : await getWooCategoryDetail(wooCategory.id, config, cache);
  if (!detailed || !detailed.id) return null;

  let parentId = null;
  if (Number(detailed.parent || 0) > 0) {
    const parentCategory = await ensureLocalCategoryFromWooCategory({ id: detailed.parent }, config, cache);
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

async function ensureLocalCategoriesFromWooProduct(wooProduct, config = getActiveWooConfig()) {
  const cache = new Map();
  const categories = [];
  for (const category of (Array.isArray(wooProduct && wooProduct.categories) ? wooProduct.categories : [])) {
    const local = await ensureLocalCategoryFromWooCategory(category, config, cache);
    if (local && !categories.some((item) => Number(item.id) === Number(local.id))) {
      categories.push(local);
    }
  }
  return categories;
}

async function findWooCategoryByName(config, name, parentWooId = 0) {
  if (!name) return null;
  const result = await woocommerceRequest('GET', `/products/categories?search=${encodeURIComponent(name)}&per_page=100`, null, config);
  if (!Array.isArray(result)) return null;
  const normalized = normalizeCatalogText(name);
  return result.find((item) => {
    return normalizeCatalogText(item.name) === normalized
      && Number(item.parent || 0) === Number(parentWooId || 0);
  }) || null;
}

async function ensureWooCategoryFromLocal(localCategoryId, config = getActiveWooConfig(), cache = new Map()) {
  if (!localCategoryId) return null;
  const key = Number(localCategoryId);
  if (cache.has(key)) return cache.get(key);

  const localCategory = getCategoryById(localCategoryId);
  if (!localCategory) return null;

  let existing = localCategory.woocommerce_category_id
    ? await woocommerceRequest('GET', `/products/categories/${localCategory.woocommerce_category_id}`, null, config).catch(() => null)
    : null;

  let parentWooId = 0;
  if (localCategory.parent_id) {
    const parentWoo = await ensureWooCategoryFromLocal(localCategory.parent_id, config, cache);
    parentWooId = parentWoo && parentWoo.id ? parentWoo.id : 0;
  }

  if (!existing) {
    existing = await findWooCategoryByName(config, localCategory.name, parentWooId);
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
      config
    );
  }

  if (existing && existing.id) {
    run(
      'UPDATE categories SET woocommerce_category_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [existing.id, localCategoryId]
    );
  }

  cache.set(key, existing);
  return existing;
}

async function findWooBrandByName(config, name) {
  if (!name) return null;
  try {
    const result = await woocommerceRequest('GET', `/products/brands?search=${encodeURIComponent(name)}&per_page=100`, null, config);
    if (!Array.isArray(result)) return null;
    const normalized = normalizeCatalogText(name);
    return result.find((item) => normalizeCatalogText(item.name) === normalized) || null;
  } catch (error) {
    if (/404|Invalid route|No route/i.test(String(error.message || ''))) return null;
    throw error;
  }
}

async function findWooAttributeByName(config, name) {
  if (!name) return null;
  const result = await woocommerceRequest('GET', `/products/attributes?search=${encodeURIComponent(name)}&per_page=100`, null, config);
  if (!Array.isArray(result)) return null;
  const normalized = normalizeCatalogText(name);
  return result.find((item) => normalizeCatalogText(item.name) === normalized) || null;
}

async function ensureWooProductAttribute(config, name, slug) {
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

async function findWooAttributeTerm(config, attributeId, termName) {
  if (!attributeId || !termName) return null;
  const result = await woocommerceRequest('GET', `/products/attributes/${attributeId}/terms?search=${encodeURIComponent(termName)}&per_page=100`, null, config);
  if (!Array.isArray(result)) return null;
  const normalized = normalizeCatalogText(termName);
  return result.find((item) => normalizeCatalogText(item.name) === normalized) || null;
}

async function ensureWooAttributeTerm(config, attributeId, termName) {
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

async function ensureWooBrand(config, brandName, brandId = null) {
  if (!brandName) return null;

  let existing = brandId ? getBrandById(brandId) : findBrandByName(brandName);
  let remote = existing && existing.woocommerce_brand_id
    ? await woocommerceRequest('GET', `/products/brands/${existing.woocommerce_brand_id}`, null, config).catch(() => null)
    : null;

  if (!remote) {
    remote = await findWooBrandByName(config, brandName);
  }

  if (!remote) {
    try {
      remote = await woocommerceRequest('POST', '/products/brands', { name: brandName }, config);
    } catch (error) {
      if (!/404|Invalid route|No route/i.test(String(error.message || ''))) throw error;
    }
  }

  if (existing && remote && remote.id) {
    run(
      'UPDATE brands SET woocommerce_brand_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [remote.id, existing.id]
    );
  }

  return remote;
}

async function buildWooProductPayload(product, config = getActiveWooConfig()) {
  const snapshot = product && product.id ? (getProductById(product.id) || product) : product;
  const sku = snapshot.sku || getNextAutomaticProductSku(all('SELECT sku FROM products'));
  const stockQuantity = normalizeStock(snapshot.stock);
  const payload = {
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
    existingWooProduct = await woocommerceRequest('GET', `/products/${snapshotWooId}`, null, config).catch(() => null);
  }

  const categoryCache = new Map();
  const localCategories = Array.isArray(snapshot.categories) && snapshot.categories.length > 0
    ? snapshot.categories
    : getProductCategories(snapshot.id);
  const wooCategories = [];
  const categoryIdsToSync = [...new Set(localCategories.flatMap((category) => {
    const trail = getCategoryTrail(category.id);
    return trail.length > 0 ? trail.map((item) => item.id) : [category.id];
  }))];

  for (const categoryId of categoryIdsToSync) {
    const remote = await ensureWooCategoryFromLocal(categoryId, config, categoryCache);
    if (remote && remote.id && !wooCategories.some((item) => Number(item.id) === Number(remote.id))) {
      wooCategories.push({ id: remote.id });
    }
  }

  if (wooCategories.length > 0) {
    payload.categories = wooCategories;
  }

  const brand = snapshot.brand_name || ((snapshot.brand_id ? getBrandById(snapshot.brand_id) : null) || {}).name || '';
  if (brand) {
    const wooBrand = await ensureWooBrand(config, brand, snapshot.brand_id);
    if (wooBrand && wooBrand.id) {
      payload.brands = [{ id: wooBrand.id }];
    }
  }

  let attributes = Array.isArray(existingWooProduct && existingWooProduct.attributes)
    ? existingWooProduct.attributes.filter((attr) => !['marca', 'brand', 'color', 'colour', 'colores'].includes(normalizeCatalogText(attr && attr.name)))
    : [];
  if (brand) {
    attributes = await buildWooManagedAttribute(attributes, config, 'Marca', 'marca', [brand]);
  }
  if (snapshot.color) {
    attributes = await buildWooManagedAttribute(attributes, config, 'Color', 'color', [snapshot.color]);
  }
  if (attributes.length > 0) {
    payload.attributes = attributes;
  }

  const images = Array.isArray(snapshot.images) && snapshot.images.length > 0
    ? snapshot.images
    : getProductImages(snapshot.id);
  const wooImages = [];
  for (let index = 0; index < images.length; index += 1) {
    const item = images[index];
    let mediaId = item.woocommerce_media_id || null;
    if (!mediaId && item.ruta_local && fs.existsSync(item.ruta_local)) {
      const uploadedMedia = await uploadProductImageToWooCommerce(snapshot.id, item, config).catch(() => null);
      if (uploadedMedia && uploadedMedia.id) {
        mediaId = uploadedMedia.id;
        run(
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

async function uploadProductImageToWooCommerce(productId, image, config = getActiveWooConfig()) {
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
    config
  );
  return response && response.id ? response : null;
}

function insertSyncLog(product, action, status, message) {
  run(
    'INSERT INTO product_sync_log (milo_id, woocommerce_id, action, status, message) VALUES (?, ?, ?, ?, ?)',
    [product?.id || null, product?.woocommerce_product_id || product?.woocommerce_id || null, action, status, message]
  );
}

async function findWooProductBySku(config, sku) {
  if (!sku) return null;
  const statusVariants = ['', 'publish', 'draft', 'pending', 'private', 'trash'];
  for (const status of statusVariants) {
    const query = `/products?sku=${encodeURIComponent(sku)}&per_page=1${status ? `&status=${status}` : ''}`;
    try {
      const result = await woocommerceRequest('GET', query, null, config);
      if (Array.isArray(result) && result.length > 0) {
        return result[0];
      }
    } catch (error) {
      if (!status) throw error;
    }
  }
  return null;
}

async function syncProductSnapshotToWooCommerce(productSnapshot, options = {}) {
  const { action = 'sale_sync', persistChanges = true, retries = 2 } = options;
  if (!productSnapshot || !productSnapshot.id) {
    throw new Error('Producto invalido para sincronizar');
  }

  const config = getActiveWooConfig();
  if (!isWooExportEnabled(config)) {
    return { success: true, skipped: true, productId: productSnapshot.id };
  }

  let lastError = null;

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      const latestProduct = getProductById(productSnapshot.id) || productSnapshot;
      const payload = await buildWooProductPayload(latestProduct, config);

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

      run(
        `UPDATE products
         SET woocommerce_id = ?, woocommerce_product_id = ?, sync_status = 'synced', last_sync_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
        [result.id, result.id, latestProduct.id]
      );
      run('UPDATE woocommerce_sync SET last_sync = CURRENT_TIMESTAMP WHERE id = 1');
      insertSyncLog({ ...latestProduct, woocommerce_product_id: result.id }, action, 'success', `${method === 'POST' ? 'Creado' : 'Actualizado'} en WooCommerce`);

      if (persistChanges) saveDatabase();

      return {
        success: true,
        action: method === 'POST' ? 'created' : 'updated',
        productId: latestProduct.id,
        woocommerce_id: result.id
      };
    } catch (error) {
      if (
        /SKU/i.test(String(error.message || ''))
        && /lookup|tabla de b[uú]squeda|search/i.test(String(error.message || ''))
      ) {
        try {
          const latestProduct = getProductById(productSnapshot.id) || productSnapshot;
          const payload = await buildWooProductPayload(latestProduct, config);
          const bySku = await findWooProductBySku(config, payload.sku);
          if (bySku && bySku.id) {
            const rescued = await woocommerceRequest('PUT', `/products/${bySku.id}`, payload, config);
            if (rescued && rescued.id) {
              run(
                `UPDATE products
                 SET woocommerce_id = ?, woocommerce_product_id = ?, sync_status = 'synced', last_sync_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
                 WHERE id = ?`,
                [rescued.id, rescued.id, latestProduct.id]
              );
              run('UPDATE woocommerce_sync SET last_sync = CURRENT_TIMESTAMP WHERE id = 1');
              insertSyncLog(
                { ...latestProduct, woocommerce_product_id: rescued.id },
                action,
                'success',
                'Producto vinculado por SKU existente y actualizado en WooCommerce'
              );
              if (persistChanges) saveDatabase();
              return {
                success: true,
                action: 'updated',
                productId: latestProduct.id,
                woocommerce_id: rescued.id
              };
            }
          }
        } catch (rescueError) {
          lastError = rescueError;
        }
      }
      lastError = error;
      if (attempt < retries) {
        await new Promise((resolve) => setTimeout(resolve, 300 * (attempt + 1)));
      }
    }
  }

  run(
    `UPDATE products
     SET sync_status = 'error', last_sync_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
     WHERE id = ?`,
    [productSnapshot.id]
  );
  insertSyncLog(productSnapshot, action, 'error', lastError.message);
  if (persistChanges) saveDatabase();

  return {
    success: false,
    productId: productSnapshot.id,
    error: lastError.message
  };
}

async function syncProductToWooCommerce(productId, options = {}) {
  const product = getProductById(productId);
  if (!product) {
    return { success: false, productId, error: 'Producto no encontrado' };
  }

  return syncProductSnapshotToWooCommerce(product, options);
}

async function deleteProductFromWooCommerce(productSnapshot, options = {}) {
  const { action = 'product_delete', persistChanges = true } = options;
  if (!productSnapshot || !productSnapshot.id) {
    throw new Error('Producto invalido para eliminar en WooCommerce');
  }

  const config = getActiveWooConfig();
  const wooProductId = productSnapshot.woocommerce_product_id || productSnapshot.woocommerce_id || null;

  if (!config || !config.store_url || !wooProductId) {
    return { success: true, skipped: true, productId: productSnapshot.id };
  }

  try {
    await woocommerceRequest('DELETE', `/products/${wooProductId}?force=true`, null, config);
    insertSyncLog(productSnapshot, action, 'success', 'Producto eliminado en WooCommerce');
    if (persistChanges) saveDatabase();
    return { success: true, productId: productSnapshot.id, woocommerce_id: wooProductId };
  } catch (error) {
    insertSyncLog(productSnapshot, action, 'error', error.message || 'No se pudo eliminar en WooCommerce');
    if (persistChanges) saveDatabase();
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
  getWooPrimaryBrand,
  getWooPrimaryCategory,
  getWooPrimaryColor,
  getWooProductImages,
  isWooExportEnabled,
  normalizeWooText: normalizeCatalogText,
  syncProductSnapshotToWooCommerce,
  syncProductToWooCommerce,
  woocommerceRequest
};
