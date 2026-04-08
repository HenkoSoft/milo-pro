const express = require('express');
const { authenticate } = require('../auth');
const { getDatabaseAccessForRequest } = require('../services/runtime-db');

const router = express.Router();

function toNullableString(value) {
  if (value === undefined || value === null || value === '') return null;
  return String(value).trim();
}

function toNumberOrNull(value) {
  if (value === undefined || value === null || value === '') return null;
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

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

function normalizeCategoryPayload(body) {
  const data = body && typeof body === 'object' ? body : {};
  return {
    name: String(data.name || '').trim(),
    slug: String(data.slug || '').trim(),
    description: String(data.description || ''),
    parent_id: toNumberOrNull(data.parent_id),
    woocommerce_category_id: toNumberOrNull(data.woocommerce_category_id),
    active: data.active === false || data.active === 0 ? 0 : 1
  };
}

async function getAllCategoriesRaw(db) {
  return db.all('SELECT * FROM categories ORDER BY name, id');
}

async function getCategoryByIdDb(db, categoryId) {
  return db.get('SELECT * FROM categories WHERE id = ?', [categoryId]);
}

async function getCategoryByWooIdDb(db, wooId) {
  return db.get('SELECT * FROM categories WHERE woocommerce_category_id = ?', [wooId]);
}

function getCategoryFullNameFromMap(byId, categoryId) {
  const trail = [];
  const seen = new Set();
  let current = byId.get(Number(categoryId));

  while (current && !seen.has(Number(current.id))) {
    trail.unshift(current);
    seen.add(Number(current.id));
    current = current.parent_id ? byId.get(Number(current.parent_id)) : null;
  }

  return trail.map((item) => item.name).join(' / ');
}

async function listCategoriesTreeDb(db) {
  const categories = await getAllCategoriesRaw(db);
  const byId = new Map(categories.map((item) => [Number(item.id), item]));
  const childrenMap = new Map();

  categories.forEach((item) => {
    const key = Number(item.parent_id || 0);
    if (!childrenMap.has(key)) {
      childrenMap.set(key, []);
    }
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
        full_name: getCategoryFullNameFromMap(byId, item.id)
      });
      visit(item.id, depth + 1);
    });
  };

  visit(0, 0);
  return rows;
}

async function serializeCategory(db, category) {
  if (!category) return null;
  const productCount = await db.get(
    `SELECT COUNT(*) AS count
     FROM product_categories
     WHERE category_id = ?`,
    [category.id]
  ) || { count: 0 };

  return {
    ...category,
    name: String(category.name || ''),
    slug: toNullableString(category.slug),
    description: toNullableString(category.description),
    parent_id: toNumberOrNull(category.parent_id),
    woocommerce_category_id: toNumberOrNull(category.woocommerce_category_id),
    depth: Number(category.depth || 0),
    product_count: Number(productCount.count || 0)
  };
}

async function validateCategoryPayload(db, payload, currentId = null) {
  const name = String((payload || {}).name || '').trim();
  if (!name) {
    throw new Error('El nombre de la categoria es obligatorio.');
  }

  const parentId = payload.parent_id ? Number(payload.parent_id) : null;
  if (currentId && parentId && Number(currentId) === Number(parentId)) {
    throw new Error('Una categoria no puede ser su propia categoria padre.');
  }

  const categories = await db.all('SELECT * FROM categories');
  const duplicate = categories.find((item) => {
    return Number(item.id) !== Number(currentId || 0)
      && normalizeCatalogText(item.name) === normalizeCatalogText(name)
      && Number(item.parent_id || 0) === Number(parentId || 0);
  });

  if (duplicate) {
    throw new Error('Ya existe una categoria con ese nombre en el mismo nivel.');
  }
}

async function ensureCategoryRecordDb(db, payload = {}) {
  const name = String(payload.name || '').trim();
  if (!name) return null;

  const parentId = payload.parent_id ? Number(payload.parent_id) : null;
  const slug = String(payload.slug || slugify(name) || '');
  const active = payload.active === false || payload.active === 0 ? 0 : 1;
  const description = toNullableString(payload.description);
  const wooId = payload.woocommerce_category_id ? Number(payload.woocommerce_category_id) : null;

  const categories = await getAllCategoriesRaw(db);
  let existing = wooId ? await getCategoryByWooIdDb(db, wooId) : null;

  if (!existing) {
    existing = categories.find((item) => {
      return normalizeCatalogText(item.name) === normalizeCatalogText(name)
        && Number(item.parent_id || 0) === Number(parentId || 0);
    }) || null;
  }

  if (existing) {
    await db.run(
      `UPDATE categories
       SET name = ?, slug = ?, description = ?, parent_id = ?, woocommerce_category_id = COALESCE(?, woocommerce_category_id),
           active = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [name, slug || existing.slug || slugify(name), description, parentId, wooId, active, existing.id]
    );
    return getCategoryByIdDb(db, existing.id);
  }

  const result = await db.run(
    `INSERT INTO categories (name, slug, description, parent_id, woocommerce_category_id, active)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [name, slug, description, parentId, wooId, active]
  );

  return getCategoryByIdDb(db, result.lastInsertRowid);
}

router.get('/', authenticate, async (req, res) => {
  const db = getDatabaseAccessForRequest(req);
  const categories = await listCategoriesTreeDb(db);
  const serialized = [];
  for (const item of categories) {
    serialized.push(await serializeCategory(db, item));
  }
  res.json(serialized);
});

router.get('/:id', authenticate, async (req, res) => {
  const db = getDatabaseAccessForRequest(req);
  const category = await getCategoryByIdDb(db, req.params.id);
  if (!category) return res.status(404).json({ error: 'Category not found' });
  const tree = await listCategoriesTreeDb(db);
  const treeRow = tree.find((item) => Number(item.id) === Number(req.params.id));
  res.json(await serializeCategory(db, treeRow || category));
});

router.post('/', authenticate, async (req, res) => {
  const db = getDatabaseAccessForRequest(req);
  try {
    const payload = normalizeCategoryPayload(req.body);
    await validateCategoryPayload(db, payload);
    const category = await ensureCategoryRecordDb(db, payload);
    await db.save();
    res.status(201).json(await serializeCategory(db, category));
  } catch (error) {
    res.status(400).json({ error: error.message || 'No se pudo crear la categoria.' });
  }
});

router.put('/:id', authenticate, async (req, res) => {
  const db = getDatabaseAccessForRequest(req);
  const existing = await getCategoryByIdDb(db, req.params.id);
  if (!existing) return res.status(404).json({ error: 'Category not found' });

  try {
    const payload = normalizeCategoryPayload(req.body);
    await validateCategoryPayload(db, payload, req.params.id);
    await db.run(
      `UPDATE categories
       SET name = ?, slug = ?, description = ?, parent_id = ?, woocommerce_category_id = ?, active = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [
        payload.name,
        payload.slug || existing.slug || null,
        toNullableString(payload.description),
        payload.parent_id,
        payload.woocommerce_category_id || existing.woocommerce_category_id || null,
        payload.active,
        req.params.id
      ]
    );
    await db.save();
    res.json(await serializeCategory(db, await getCategoryByIdDb(db, req.params.id)));
  } catch (error) {
    res.status(400).json({ error: error.message || 'No se pudo actualizar la categoria.' });
  }
});

router.delete('/:id', authenticate, async (req, res) => {
  const db = getDatabaseAccess(req);
  const categoryId = Number(req.params.id);
  const productCount = await db.get('SELECT COUNT(*) AS count FROM product_categories WHERE category_id = ?', [categoryId]);
  if (productCount && Number(productCount.count) > 0) {
    return res.status(400).json({ error: 'Cannot delete category with products' });
  }

  const childCount = await db.get('SELECT COUNT(*) AS count FROM categories WHERE parent_id = ?', [categoryId]);
  if (childCount && Number(childCount.count) > 0) {
    return res.status(400).json({ error: 'No se puede eliminar una categoria que tiene subcategorias.' });
  }

  await db.run('DELETE FROM categories WHERE id = ?', [categoryId]);
  await db.save();
  res.json({ success: true });
});

module.exports = router;
