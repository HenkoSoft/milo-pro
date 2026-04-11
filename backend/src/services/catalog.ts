const { createDatabaseAccess } = require('./runtime-db.js');

type DatabaseRow = Record<string, unknown>;

type DatabaseAccess = {
  get: (sql: string, params?: unknown[]) => Promise<DatabaseRow | null>;
  all: (sql: string, params?: unknown[]) => Promise<DatabaseRow[]>;
  run: (sql: string, params?: unknown[]) => Promise<{ lastInsertRowid?: number | null }>;
};

type CategoryRecord = DatabaseRow & {
  id?: unknown;
  name?: unknown;
  slug?: unknown;
  description?: unknown;
  parent_id?: unknown;
  woocommerce_category_id?: unknown;
  active?: unknown;
  updated_at?: unknown;
};

type BrandRecord = DatabaseRow & {
  id?: unknown;
  name?: unknown;
  slug?: unknown;
  woocommerce_brand_id?: unknown;
  active?: unknown;
  updated_at?: unknown;
};

type ProductRecord = DatabaseRow & {
  id?: unknown;
  category_id?: unknown;
  category_primary_id?: unknown;
  brand_id?: unknown;
  woocommerce_id?: unknown;
  woocommerce_product_id?: unknown;
  category_name?: unknown;
  brand_name?: unknown;
  color?: unknown;
  image_url?: unknown;
};

type ProductCategoryPivotRecord = CategoryRecord & {
  es_principal?: unknown;
  orden?: unknown;
  full_name?: unknown;
};

type ProductImageRecord = DatabaseRow & {
  id?: unknown;
  nombre_archivo?: unknown;
  ruta_local?: unknown;
  url_publica?: unknown;
  url_local?: unknown;
  url_remote?: unknown;
  woocommerce_media_id?: unknown;
  orden?: unknown;
  es_principal?: unknown;
};

type CategoryPayload = {
  name?: unknown;
  slug?: unknown;
  description?: unknown;
  parent_id?: unknown;
  woocommerce_category_id?: unknown;
  active?: unknown;
};

type BrandPayload = {
  name?: unknown;
  slug?: unknown;
  woocommerce_brand_id?: unknown;
  active?: unknown;
};

type ProductImageInput = string | {
  nombre_archivo?: unknown;
  ruta_local?: unknown;
  url_publica?: unknown;
  url_local?: unknown;
  url_remote?: unknown;
  woocommerce_media_id?: unknown;
  orden?: unknown;
  es_principal?: unknown;
};

let runtimeDatabase: DatabaseAccess | null = null;

export function setRuntimeDatabase(adapter: DatabaseAccess | null) {
  runtimeDatabase = adapter || null;
}

function getDatabaseAccess(): DatabaseAccess {
  return createDatabaseAccess(runtimeDatabase);
}

export function normalizeCatalogText(value: unknown) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

export function slugify(value: unknown) {
  return normalizeCatalogText(value)
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function toIntegerList(values: unknown) {
  return [...new Set((Array.isArray(values) ? values : [values])
    .map((value) => Number.parseInt(String(value ?? ''), 10))
    .filter((value) => Number.isFinite(value) && value > 0))];
}

async function getAllCategoriesRaw() {
  const db = getDatabaseAccess();
  return db.all('SELECT * FROM categories ORDER BY name, id') as Promise<CategoryRecord[]>;
}

export async function getCategoryById(categoryId: unknown) {
  const db = getDatabaseAccess();
  return db.get('SELECT * FROM categories WHERE id = ?', [categoryId]) as Promise<CategoryRecord | null>;
}

export async function getCategoryByWooId(woocommerceCategoryId: unknown) {
  const db = getDatabaseAccess();
  return db.get('SELECT * FROM categories WHERE woocommerce_category_id = ?', [woocommerceCategoryId]) as Promise<CategoryRecord | null>;
}

export async function getBrandById(brandId: unknown) {
  const db = getDatabaseAccess();
  return db.get('SELECT * FROM brands WHERE id = ?', [brandId]) as Promise<BrandRecord | null>;
}

export async function getBrandByWooId(woocommerceBrandId: unknown) {
  const db = getDatabaseAccess();
  return db.get('SELECT * FROM brands WHERE woocommerce_brand_id = ?', [woocommerceBrandId]) as Promise<BrandRecord | null>;
}

export async function findCategoryByNameAndParent(name: unknown, parentId: unknown = null) {
  const normalized = normalizeCatalogText(name);
  if (!normalized) return null;
  const categories = await getAllCategoriesRaw();
  return categories.find((item) => {
    return normalizeCatalogText(item.name) === normalized
      && Number(item.parent_id || 0) === Number(parentId || 0);
  }) || null;
}

export async function findBrandByName(name: unknown) {
  const normalized = normalizeCatalogText(name);
  if (!normalized) return null;
  const db = getDatabaseAccess();
  const brands = await db.all('SELECT * FROM brands ORDER BY name, id') as BrandRecord[];
  return brands.find((item) => normalizeCatalogText(item.name) === normalized) || null;
}

export async function getCategoryTrail(categoryId: unknown) {
  const categories = await getAllCategoriesRaw();
  const byId = new Map<number, CategoryRecord>(categories.map((item) => [Number(item.id), item]));
  const trail: CategoryRecord[] = [];
  let current = byId.get(Number(categoryId));
  const seen = new Set<number>();

  while (current && !seen.has(Number(current.id))) {
    trail.unshift(current);
    seen.add(Number(current.id));
    current = current.parent_id ? byId.get(Number(current.parent_id)) : undefined;
  }

  return trail;
}

export async function getCategoryFullName(categoryId: unknown) {
  const trail = await getCategoryTrail(categoryId);
  return trail.map((item) => item.name).join(' / ');
}

export async function collapseCategoryIdsToLeaves(categoryIds: unknown[] = []) {
  const normalizedIds = toIntegerList(categoryIds);
  if (normalizedIds.length <= 1) return normalizedIds;

  const leafChecks = await Promise.all(normalizedIds.map(async (categoryId) => {
    const isAncestor = await Promise.all(normalizedIds.map(async (otherId) => {
      if (Number(otherId) === Number(categoryId)) return false;
      const trail = await getCategoryTrail(otherId);
      return trail.some((item) => Number(item.id) === Number(categoryId));
    }));
    return { categoryId, keep: !isAncestor.some(Boolean) };
  }));

  return leafChecks.filter((item) => item.keep).map((item) => item.categoryId);
}

export async function listCategoriesTree() {
  const categories = await getAllCategoriesRaw();
  const childrenMap = new Map<number, CategoryRecord[]>();

  categories.forEach((item) => {
    const key = Number(item.parent_id || 0);
    if (!childrenMap.has(key)) childrenMap.set(key, []);
    childrenMap.get(key)?.push(item);
  });

  const rows: Array<CategoryRecord & { depth: number; full_name: string }> = [];
  const visit = async (parentId = 0, depth = 0): Promise<void> => {
    const children = (childrenMap.get(Number(parentId || 0)) || [])
      .slice()
      .sort((a, b) => String(a.name || '').localeCompare(String(b.name || '')));
    for (const item of children) {
      rows.push({
        ...item,
        depth,
        full_name: await getCategoryFullName(item.id)
      });
      await visit(Number(item.id), depth + 1);
    }
  };

  await visit(0, 0);
  return rows;
}

export async function ensureCategoryRecord(payload: CategoryPayload = {}) {
  const db = getDatabaseAccess();
  const name = String(payload.name || '').trim();
  if (!name) return null;
  const parentId = payload.parent_id ? Number(payload.parent_id) : null;
  const slug = String(payload.slug || slugify(name) || '');
  const active = payload.active === false || payload.active === 0 ? 0 : 1;
  const description = payload.description || null;
  const wooId = payload.woocommerce_category_id ? Number(payload.woocommerce_category_id) : null;

  let existing = wooId ? await getCategoryByWooId(wooId) : null;
  if (!existing) {
    existing = await findCategoryByNameAndParent(name, parentId);
  }

  if (existing) {
    await db.run(
      `UPDATE categories
       SET name = ?, slug = ?, description = ?, parent_id = ?, woocommerce_category_id = COALESCE(?, woocommerce_category_id),
           active = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [name, slug || existing.slug || slugify(name), description, parentId, wooId, active, existing.id]
    );
    return getCategoryById(existing.id);
  }

  const result = await db.run(
    `INSERT INTO categories (name, slug, description, parent_id, woocommerce_category_id, active)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [name, slug, description, parentId, wooId, active]
  );
  return getCategoryById(result.lastInsertRowid);
}

export async function ensureBrandRecord(payload: BrandPayload = {}) {
  const db = getDatabaseAccess();
  const name = String(payload.name || '').trim();
  if (!name) return null;
  const slug = String(payload.slug || slugify(name) || '');
  const active = payload.active === false || payload.active === 0 ? 0 : 1;
  const wooId = payload.woocommerce_brand_id ? Number(payload.woocommerce_brand_id) : null;

  let existing = wooId ? await getBrandByWooId(wooId) : null;
  if (!existing) {
    existing = await findBrandByName(name);
  }

  if (existing) {
    await db.run(
      `UPDATE brands
       SET name = ?, slug = ?, woocommerce_brand_id = COALESCE(?, woocommerce_brand_id), active = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [name, slug || existing.slug || slugify(name), wooId, active, existing.id]
    );
    return getBrandById(existing.id);
  }

  const result = await db.run(
    'INSERT INTO brands (name, slug, woocommerce_brand_id, active) VALUES (?, ?, ?, ?)',
    [name, slug, wooId, active]
  );
  return getBrandById(result.lastInsertRowid);
}

export async function getProductCategories(productId: unknown) {
  const db = getDatabaseAccess();
  const categories = await db.all(
    `SELECT c.*, pc.es_principal, pc.orden
     FROM product_categories pc
     JOIN categories c ON c.id = pc.category_id
     WHERE pc.product_id = ?
     ORDER BY pc.es_principal DESC, pc.orden ASC, c.name ASC`,
    [productId]
  ) as ProductCategoryPivotRecord[];

  return Promise.all(categories.map(async (item) => ({
    ...item,
    full_name: await getCategoryFullName(item.id)
  })));
}

export async function getProductImages(productId: unknown) {
  const db = getDatabaseAccess();
  return db.all(
    `SELECT *
     FROM product_images
     WHERE product_id = ?
     ORDER BY es_principal DESC, orden ASC, id ASC`,
    [productId]
  ) as Promise<ProductImageRecord[]>;
}

export async function syncProductCategories(productId: unknown, categoryIds: unknown[] = [], primaryCategoryId: unknown = null) {
  const db = getDatabaseAccess();
  const normalizedIds = await collapseCategoryIdsToLeaves(categoryIds);
  const nextPrimaryId = primaryCategoryId ? Number(primaryCategoryId) : (normalizedIds[0] || null);
  const finalIds = nextPrimaryId && !normalizedIds.includes(nextPrimaryId)
    ? [nextPrimaryId, ...normalizedIds]
    : normalizedIds;

  await db.run('DELETE FROM product_categories WHERE product_id = ?', [productId]);
  for (const [index, categoryId] of finalIds.entries()) {
    await db.run(
      'INSERT INTO product_categories (product_id, category_id, es_principal, orden) VALUES (?, ?, ?, ?)',
      [productId, categoryId, Number(categoryId) === Number(nextPrimaryId || 0) ? 1 : 0, index]
    );
  }

  await db.run(
    'UPDATE products SET category_id = ?, category_primary_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
    [nextPrimaryId, nextPrimaryId, productId]
  );
}

export async function syncProductImages(productId: unknown, images: ProductImageInput[] = []) {
  const db = getDatabaseAccess();
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

  await db.run('DELETE FROM product_images WHERE product_id = ?', [productId]);
  for (const item of normalized) {
    await db.run(
      `INSERT INTO product_images (product_id, nombre_archivo, ruta_local, url_publica, url_local, url_remote, woocommerce_media_id, orden, es_principal)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [productId, item.nombre_archivo, item.ruta_local, item.url_publica, item.url_local, item.url_remote, item.woocommerce_media_id, item.orden, item.es_principal]
    );
  }

  const primary = normalized.find((item) => item.es_principal) || normalized[0] || null;
  await db.run(
    'UPDATE products SET image_url = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
    [primary ? (primary.url_publica || primary.url_remote || primary.url_local || null) : null, productId]
  );
}

export async function hydrateProductRecord(product: ProductRecord | null) {
  if (!product) return null;
  const categories = await getProductCategories(product.id);
  const images = await getProductImages(product.id);
  const primaryCategory =
    categories.find((item) => Number(item.es_principal) === 1)
    || (product.category_id ? categories.find((item) => Number(item.id) === Number(product.category_id)) : null)
    || categories[0]
    || (product.category_id ? await getCategoryById(product.category_id) : null);
  const primaryImage = images.find((item) => Number(item.es_principal) === 1) || images[0] || null;
  const categoryNames = categories.map((item) => item.full_name || item.name).filter(Boolean);
  const brand = product.brand_id ? await getBrandById(product.brand_id) : null;

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
    brand_name: product.brand_name || (brand ? brand.name : null)
  };
}

export async function getProductById(productId: unknown) {
  const db = getDatabaseAccess();
  const product = await db.get(
    `SELECT p.*, c.name AS category_name, b.name AS brand_name
     FROM products p
     LEFT JOIN categories c ON c.id = p.category_id
     LEFT JOIN brands b ON b.id = p.brand_id
     WHERE p.id = ?`,
    [productId]
  ) as ProductRecord | null;
  return hydrateProductRecord(product);
}

export async function listProductsWithCatalog(baseSql: string, params: unknown[] = []) {
  const db = getDatabaseAccess();
  const products = await db.all(baseSql, params) as ProductRecord[];
  return Promise.all(products.map((item) => hydrateProductRecord(item)));
}
