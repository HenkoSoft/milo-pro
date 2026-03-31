const { get, all, run } = require('../database');

function normalizeCatalogText(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function slugify(value) {
  return normalizeCatalogText(value)
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function toIntegerList(values) {
  return [...new Set((Array.isArray(values) ? values : [values])
    .map((value) => Number.parseInt(value, 10))
    .filter((value) => Number.isFinite(value) && value > 0))];
}

function getAllCategoriesRaw() {
  return all('SELECT * FROM categories ORDER BY name, id');
}

function getCategoryById(categoryId) {
  return get('SELECT * FROM categories WHERE id = ?', [categoryId]);
}

function getCategoryByWooId(woocommerceCategoryId) {
  return get('SELECT * FROM categories WHERE woocommerce_category_id = ?', [woocommerceCategoryId]);
}

function getBrandById(brandId) {
  return get('SELECT * FROM brands WHERE id = ?', [brandId]);
}

function getBrandByWooId(woocommerceBrandId) {
  return get('SELECT * FROM brands WHERE woocommerce_brand_id = ?', [woocommerceBrandId]);
}

function findCategoryByNameAndParent(name, parentId = null) {
  const normalized = normalizeCatalogText(name);
  if (!normalized) return null;
  return getAllCategoriesRaw().find((item) => {
    return normalizeCatalogText(item.name) === normalized
      && Number(item.parent_id || 0) === Number(parentId || 0);
  }) || null;
}

function findBrandByName(name) {
  const normalized = normalizeCatalogText(name);
  if (!normalized) return null;
  return all('SELECT * FROM brands ORDER BY name, id').find((item) => normalizeCatalogText(item.name) === normalized) || null;
}

function getCategoryTrail(categoryId) {
  const categories = getAllCategoriesRaw();
  const byId = new Map(categories.map((item) => [Number(item.id), item]));
  const trail = [];
  let current = byId.get(Number(categoryId));
  const seen = new Set();

  while (current && !seen.has(Number(current.id))) {
    trail.unshift(current);
    seen.add(Number(current.id));
    current = current.parent_id ? byId.get(Number(current.parent_id)) : null;
  }

  return trail;
}

function getCategoryFullName(categoryId) {
  const trail = getCategoryTrail(categoryId);
  return trail.map((item) => item.name).join(' / ');
}

function listCategoriesTree() {
  const categories = getAllCategoriesRaw();
  const childrenMap = new Map();

  categories.forEach((item) => {
    const key = Number(item.parent_id || 0);
    if (!childrenMap.has(key)) childrenMap.set(key, []);
    childrenMap.get(key).push(item);
  });

  const rows = [];
  const visit = (parentId = 0, depth = 0) => {
    const children = (childrenMap.get(Number(parentId || 0)) || [])
      .slice()
      .sort((a, b) => String(a.name || '').localeCompare(String(b.name || '')));
    children.forEach((item) => {
      rows.push({
        ...item,
        depth,
        full_name: getCategoryFullName(item.id)
      });
      visit(item.id, depth + 1);
    });
  };

  visit(0, 0);
  return rows;
}

function ensureCategoryRecord(payload = {}) {
  const name = String(payload.name || '').trim();
  if (!name) return null;
  const parentId = payload.parent_id ? Number(payload.parent_id) : null;
  const slug = String(payload.slug || slugify(name) || '');
  const active = payload.active === false || payload.active === 0 ? 0 : 1;
  const description = payload.description || null;
  const wooId = payload.woocommerce_category_id ? Number(payload.woocommerce_category_id) : null;

  let existing = wooId ? getCategoryByWooId(wooId) : null;
  if (!existing) {
    existing = findCategoryByNameAndParent(name, parentId);
  }

  if (existing) {
    run(
      `UPDATE categories
       SET name = ?, slug = ?, description = ?, parent_id = ?, woocommerce_category_id = COALESCE(?, woocommerce_category_id),
           active = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [name, slug || existing.slug || slugify(name), description, parentId, wooId, active, existing.id]
    );
    return getCategoryById(existing.id);
  }

  const result = run(
    `INSERT INTO categories (name, slug, description, parent_id, woocommerce_category_id, active)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [name, slug, description, parentId, wooId, active]
  );
  return getCategoryById(result.lastInsertRowid);
}

function ensureBrandRecord(payload = {}) {
  const name = String(payload.name || '').trim();
  if (!name) return null;
  const slug = String(payload.slug || slugify(name) || '');
  const active = payload.active === false || payload.active === 0 ? 0 : 1;
  const wooId = payload.woocommerce_brand_id ? Number(payload.woocommerce_brand_id) : null;

  let existing = wooId ? getBrandByWooId(wooId) : null;
  if (!existing) {
    existing = findBrandByName(name);
  }

  if (existing) {
    run(
      `UPDATE brands
       SET name = ?, slug = ?, woocommerce_brand_id = COALESCE(?, woocommerce_brand_id), active = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [name, slug || existing.slug || slugify(name), wooId, active, existing.id]
    );
    return getBrandById(existing.id);
  }

  const result = run(
    'INSERT INTO brands (name, slug, woocommerce_brand_id, active) VALUES (?, ?, ?, ?)',
    [name, slug, wooId, active]
  );
  return getBrandById(result.lastInsertRowid);
}

function getProductCategories(productId) {
  return all(
    `SELECT c.*, pc.es_principal, pc.orden
     FROM product_categories pc
     JOIN categories c ON c.id = pc.category_id
     WHERE pc.product_id = ?
     ORDER BY pc.es_principal DESC, pc.orden ASC, c.name ASC`,
    [productId]
  ).map((item) => ({
    ...item,
    full_name: getCategoryFullName(item.id)
  }));
}

function getProductImages(productId) {
  return all(
    `SELECT *
     FROM product_images
     WHERE product_id = ?
     ORDER BY es_principal DESC, orden ASC, id ASC`,
    [productId]
  );
}

function syncProductCategories(productId, categoryIds = [], primaryCategoryId = null) {
  const normalizedIds = toIntegerList(categoryIds);
  const nextPrimaryId = primaryCategoryId ? Number(primaryCategoryId) : (normalizedIds[0] || null);
  const finalIds = nextPrimaryId && !normalizedIds.includes(nextPrimaryId)
    ? [nextPrimaryId, ...normalizedIds]
    : normalizedIds;

  run('DELETE FROM product_categories WHERE product_id = ?', [productId]);
  finalIds.forEach((categoryId, index) => {
    run(
      'INSERT INTO product_categories (product_id, category_id, es_principal, orden) VALUES (?, ?, ?, ?)',
      [productId, categoryId, Number(categoryId) === Number(nextPrimaryId || 0) ? 1 : 0, index]
    );
  });

  run(
    'UPDATE products SET category_id = ?, category_primary_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
    [nextPrimaryId, nextPrimaryId, productId]
  );
}

function syncProductImages(productId, images = []) {
  const normalized = (Array.isArray(images) ? images : []).map((item, index) => {
    if (typeof item === 'string') {
      return {
        nombre_archivo: null,
        ruta_local: null,
        url_publica: item.trim(),
        url_local: null,
        url_remote: item.trim(),
        woocommerce_media_id: null,
        orden: index,
        es_principal: index === 0 ? 1 : 0
      };
    }

    return {
      nombre_archivo: item && item.nombre_archivo ? String(item.nombre_archivo).trim() : null,
      ruta_local: item && item.ruta_local ? String(item.ruta_local).trim() : null,
      url_publica: item && item.url_publica ? String(item.url_publica).trim() : null,
      url_local: item && item.url_local ? String(item.url_local).trim() : null,
      url_remote: item && item.url_remote ? String(item.url_remote).trim() : null,
      woocommerce_media_id: item && item.woocommerce_media_id ? Number(item.woocommerce_media_id) : null,
      orden: Number.isFinite(Number(item && item.orden)) ? Number(item.orden) : index,
      es_principal: item && item.es_principal ? 1 : 0
    };
  }).filter((item) => item.url_local || item.url_remote || item.url_publica);

  if (normalized.length > 0 && !normalized.some((item) => item.es_principal)) {
    normalized[0].es_principal = 1;
  }

  run('DELETE FROM product_images WHERE product_id = ?', [productId]);
  normalized.forEach((item) => {
    run(
      `INSERT INTO product_images (product_id, nombre_archivo, ruta_local, url_publica, url_local, url_remote, woocommerce_media_id, orden, es_principal)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [productId, item.nombre_archivo, item.ruta_local, item.url_publica, item.url_local, item.url_remote, item.woocommerce_media_id, item.orden, item.es_principal]
    );
  });

  const primary = normalized.find((item) => item.es_principal) || normalized[0] || null;
  run(
    'UPDATE products SET image_url = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
    [primary ? (primary.url_publica || primary.url_remote || primary.url_local || null) : null, productId]
  );
}

function hydrateProductRecord(product) {
  if (!product) return null;
  const categories = getProductCategories(product.id);
  const images = getProductImages(product.id);
  const primaryCategory = categories.find((item) => Number(item.es_principal) === 1)
    || (product.category_id ? categories.find((item) => Number(item.id) === Number(product.category_id)) : null)
    || categories[0]
    || (product.category_id ? getCategoryById(product.category_id) : null);
  const primaryImage = images.find((item) => Number(item.es_principal) === 1) || images[0] || null;
  const categoryNames = categories.map((item) => item.full_name || item.name).filter(Boolean);

  return {
    ...product,
    woocommerce_product_id: product.woocommerce_product_id || product.woocommerce_id || null,
    color: product.color || null,
    category_primary_id: product.category_primary_id || product.category_id || (primaryCategory ? primaryCategory.id : null),
    category_id: product.category_id || (primaryCategory ? primaryCategory.id : null),
    category_name: product.category_name || (primaryCategory ? primaryCategory.full_name || primaryCategory.name : null),
    category_names: categoryNames,
    category_ids: categories.map((item) => item.id),
    categories,
    images,
    image_url: product.image_url || (primaryImage ? (primaryImage.url_publica || primaryImage.url_remote || primaryImage.url_local || null) : null),
    brand_name: product.brand_name || ((product.brand_id ? getBrandById(product.brand_id) : null) || {}).name || null
  };
}

function getProductById(productId) {
  const product = get(
    `SELECT p.*, c.name AS category_name, b.name AS brand_name
     FROM products p
     LEFT JOIN categories c ON c.id = p.category_id
     LEFT JOIN brands b ON b.id = p.brand_id
     WHERE p.id = ?`,
    [productId]
  );
  return hydrateProductRecord(product);
}

function listProductsWithCatalog(baseSql, params = []) {
  return all(baseSql, params).map((item) => hydrateProductRecord(item));
}

module.exports = {
  ensureBrandRecord,
  ensureCategoryRecord,
  findBrandByName,
  findCategoryByNameAndParent,
  getBrandById,
  getBrandByWooId,
  getCategoryById,
  getCategoryByWooId,
  getCategoryFullName,
  getCategoryTrail,
  getProductById,
  getProductCategories,
  getProductImages,
  hydrateProductRecord,
  listCategoriesTree,
  listProductsWithCatalog,
  normalizeCatalogText,
  slugify,
  syncProductCategories,
  syncProductImages,
  toIntegerList
};
