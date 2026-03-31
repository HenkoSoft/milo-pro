const express = require('express');
const { get, run, all, saveDatabase } = require('../database');
const { authenticate } = require('../auth');
const {
  ensureCategoryRecord,
  getCategoryById,
  listCategoriesTree,
  normalizeCatalogText
} = require('../services/catalog');

const router = express.Router();

function serializeCategory(category) {
  if (!category) return null;
  const productCount = get(
    `SELECT COUNT(*) AS count
     FROM product_categories
     WHERE category_id = ?`,
    [category.id]
  ) || { count: 0 };

  return {
    ...category,
    depth: Number(category.depth || 0),
    product_count: Number(productCount.count || 0)
  };
}

function validateCategoryPayload(payload, currentId = null) {
  const name = String((payload || {}).name || '').trim();
  if (!name) {
    throw new Error('El nombre de la categoria es obligatorio.');
  }

  const parentId = payload.parent_id ? Number(payload.parent_id) : null;
  if (currentId && parentId && Number(currentId) === Number(parentId)) {
    throw new Error('Una categoria no puede ser su propia categoria padre.');
  }

  const categories = all('SELECT * FROM categories');
  const duplicate = categories.find((item) => {
    return Number(item.id) !== Number(currentId || 0)
      && normalizeCatalogText(item.name) === normalizeCatalogText(name)
      && Number(item.parent_id || 0) === Number(parentId || 0);
  });

  if (duplicate) {
    throw new Error('Ya existe una categoria con ese nombre en el mismo nivel.');
  }
}

router.get('/', authenticate, (req, res) => {
  const categories = listCategoriesTree().map((item) => serializeCategory(item));
  res.json(categories);
});

router.get('/:id', authenticate, (req, res) => {
  const category = getCategoryById(req.params.id);
  if (!category) return res.status(404).json({ error: 'Category not found' });
  const treeRow = listCategoriesTree().find((item) => Number(item.id) === Number(req.params.id));
  res.json(serializeCategory(treeRow || category));
});

router.post('/', authenticate, (req, res) => {
  try {
    validateCategoryPayload(req.body);
    const category = ensureCategoryRecord(req.body);
    saveDatabase();
    res.status(201).json(serializeCategory(category));
  } catch (error) {
    res.status(400).json({ error: error.message || 'No se pudo crear la categoria.' });
  }
});

router.put('/:id', authenticate, (req, res) => {
  const existing = getCategoryById(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Category not found' });

  try {
    validateCategoryPayload(req.body, req.params.id);
    run(
      `UPDATE categories
       SET name = ?, slug = ?, description = ?, parent_id = ?, woocommerce_category_id = ?, active = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [
        req.body.name,
        req.body.slug || existing.slug || null,
        req.body.description || null,
        req.body.parent_id || null,
        req.body.woocommerce_category_id || existing.woocommerce_category_id || null,
        req.body.active === false || req.body.active === 0 ? 0 : 1,
        req.params.id
      ]
    );
    saveDatabase();
    res.json(serializeCategory(getCategoryById(req.params.id)));
  } catch (error) {
    res.status(400).json({ error: error.message || 'No se pudo actualizar la categoria.' });
  }
});

router.delete('/:id', authenticate, (req, res) => {
  const categoryId = Number(req.params.id);
  const productCount = get('SELECT COUNT(*) AS count FROM product_categories WHERE category_id = ?', [categoryId]);
  if (productCount && Number(productCount.count) > 0) {
    return res.status(400).json({ error: 'Cannot delete category with products' });
  }

  const childCount = get('SELECT COUNT(*) AS count FROM categories WHERE parent_id = ?', [categoryId]);
  if (childCount && Number(childCount.count) > 0) {
    return res.status(400).json({ error: 'No se puede eliminar una categoria que tiene subcategorias.' });
  }

  run('DELETE FROM categories WHERE id = ?', [categoryId]);
  saveDatabase();
  res.json({ success: true });
});

module.exports = router;
