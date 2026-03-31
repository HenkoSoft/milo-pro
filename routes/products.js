const express = require('express');
const { get, run, saveDatabase } = require('../database');
const { authenticate } = require('../auth');
const {
  deleteProductFromWooCommerce,
  getActiveWooConfig,
  isWooExportEnabled,
  syncProductSnapshotToWooCommerce
} = require('../services/woocommerce-sync');
const { processProductImages } = require('../services/product-images');
const {
  getProductById,
  getProductImages,
  listProductsWithCatalog,
  syncProductCategories,
  syncProductImages,
  toIntegerList
} = require('../services/catalog');

const router = express.Router();

function buildProductsQuery({ search, category, lowStock }) {
  let query = `
    SELECT p.*, c.name as category_name, b.name as brand_name
    FROM products p
    LEFT JOIN categories c ON p.category_id = c.id
    LEFT JOIN brands b ON p.brand_id = b.id
    WHERE COALESCE(p.active, 1) = 1
  `;
  const params = [];

  if (search) {
    query += ' AND (p.name LIKE ? OR p.sku LIKE ? OR p.barcode LIKE ? OR p.description LIKE ? OR b.name LIKE ? OR p.color LIKE ?)';
    params.push('%' + search + '%', '%' + search + '%', '%' + search + '%', '%' + search + '%', '%' + search + '%', '%' + search + '%');
  }

  if (category) {
    query += `
      AND EXISTS (
        SELECT 1
        FROM product_categories pc
        WHERE pc.product_id = p.id AND pc.category_id = ?
      )
    `;
    params.push(category);
  }

  if (lowStock === 'true') {
    query += ' AND p.stock <= p.min_stock';
  }

  query += ' ORDER BY p.created_at DESC';
  return { query, params };
}

function buildProductPayload(body = {}) {
  const primaryCategoryId = body.category_primary_id || body.category_id || null;
  const categoryIds = toIntegerList([
    ...(Array.isArray(body.category_ids) ? body.category_ids : []),
    ...(Array.isArray(body.additional_category_ids) ? body.additional_category_ids : []),
    primaryCategoryId
  ]);

  const images = Array.isArray(body.images)
    ? body.images
    : String(body.image_urls || '')
      .split(/\r?\n/)
      .map((item) => item.trim())
      .filter(Boolean)
      .map((item) => ({ url_remote: item }));

  const primaryImageUrl = (body.image_url || '').trim();
  const normalizedImages = primaryImageUrl
    ? [{ url_remote: primaryImageUrl, es_principal: true }, ...images.filter((item) => (item.url_remote || item.url_local) !== primaryImageUrl)]
    : images;

  return {
    sku: body.sku === undefined || body.sku === '' ? null : body.sku,
    barcode: body.barcode === undefined || body.barcode === '' ? null : body.barcode,
    name: body.name,
    description: body.description === undefined ? null : body.description,
    short_description: body.short_description === undefined ? null : body.short_description,
    color: body.color === undefined ? null : body.color,
    category_id: primaryCategoryId,
    category_primary_id: primaryCategoryId,
    category_ids: categoryIds,
    brand_id: body.brand_id === undefined || body.brand_id === '' ? null : body.brand_id,
    supplier: body.supplier === undefined ? null : body.supplier,
    purchase_price: body.purchase_price === undefined ? 0 : body.purchase_price,
    sale_price: body.sale_price === undefined ? 0 : body.sale_price,
    stock: body.stock === undefined ? 0 : body.stock,
    min_stock: body.min_stock === undefined ? 2 : body.min_stock,
    woocommerce_id: body.woocommerce_id || body.woocommerce_product_id || null,
    woocommerce_product_id: body.woocommerce_product_id || body.woocommerce_id || null,
    image_url: primaryImageUrl || null,
    images: normalizedImages,
    sync_status: body.sync_status || 'pending',
    active: body.active === false || body.active === 0 ? 0 : 1
  };
}

async function persistProduct(payload, productId = null) {
  if (!payload.name) {
    throw new Error('El nombre es requerido');
  }

  const wooConfig = getActiveWooConfig();
  if (isWooExportEnabled(wooConfig)) {
    if (!payload.brand_id) {
      throw new Error('La marca es obligatoria para publicar el articulo correctamente en WooCommerce.');
    }

    if (!String(payload.color || '').trim()) {
      throw new Error('El color es obligatorio para publicar el articulo correctamente en WooCommerce.');
    }
  }

  if (productId) {
    run(
      `UPDATE products
       SET sku = ?, barcode = ?, name = ?, description = ?, short_description = ?, color = ?, category_id = ?, category_primary_id = ?,
           brand_id = ?, supplier = ?, purchase_price = ?, sale_price = ?, stock = ?, min_stock = ?, woocommerce_id = ?,
           woocommerce_product_id = ?, image_url = ?, sync_status = ?, active = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [
        payload.sku,
        payload.barcode,
        payload.name,
        payload.description,
        payload.short_description,
        payload.color,
        payload.category_id,
        payload.category_primary_id,
        payload.brand_id,
        payload.supplier,
        payload.purchase_price,
        payload.sale_price,
        payload.stock,
        payload.min_stock,
        payload.woocommerce_id,
        payload.woocommerce_product_id,
        payload.image_url,
        payload.sync_status,
        payload.active,
        productId
      ]
    );
  } else {
    const result = run(
      `INSERT INTO products (
        sku, barcode, name, description, short_description, color, category_id, category_primary_id, brand_id, supplier,
        purchase_price, sale_price, stock, min_stock, woocommerce_id, woocommerce_product_id, image_url, sync_status, active
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        payload.sku,
        payload.barcode,
        payload.name,
        payload.description,
        payload.short_description,
        payload.color,
        payload.category_id,
        payload.category_primary_id,
        payload.brand_id,
        payload.supplier,
        payload.purchase_price,
        payload.sale_price,
        payload.stock,
        payload.min_stock,
        payload.woocommerce_id,
        payload.woocommerce_product_id,
        payload.image_url,
        payload.sync_status,
        payload.active
      ]
    );
    productId = result.lastInsertRowid;
  }

  const processedImages = await processProductImages(productId, payload.images);
  if (Array.isArray(payload.images) && payload.images.length > 0 && processedImages.length === 0) {
    throw new Error('Las imagenes no se pudieron procesar en el servidor.');
  }
  syncProductCategories(productId, payload.category_ids, payload.category_primary_id);
  syncProductImages(productId, processedImages);
  saveDatabase();
  return getProductById(productId);
}

router.get('/', authenticate, (req, res) => {
  const { query, params } = buildProductsQuery(req.query || {});
  res.json(listProductsWithCatalog(query, params));
});

router.get('/:id', authenticate, (req, res) => {
  const product = getProductById(req.params.id);
  if (!product) return res.status(404).json({ error: 'Product not found' });
  res.json(product);
});

router.post('/', authenticate, async (req, res) => {
  try {
    const payload = buildProductPayload(req.body || {});
    const product = await persistProduct(payload);
    const syncResult = await syncProductSnapshotToWooCommerce(product, { action: 'product_create' });
    const refreshedProduct = getProductById(product.id) || product;

    if (!syncResult.success && !syncResult.skipped) {
      return res.status(201).json({
        ...refreshedProduct,
        sync_warning: syncResult.error || 'No se pudo sincronizar con WooCommerce.'
      });
    }

    res.status(201).json(refreshedProduct);
  } catch (err) {
    res.status(400).json({ error: err.message || 'Error al crear el producto' });
  }
});

router.put('/:id', authenticate, async (req, res) => {
  try {
    const payload = buildProductPayload(req.body || {});
    const product = await persistProduct(payload, req.params.id);
    const syncResult = await syncProductSnapshotToWooCommerce(product, { action: 'product_update' });
    const refreshedProduct = getProductById(product.id) || product;

    if (!syncResult.success && !syncResult.skipped) {
      return res.json({
        ...refreshedProduct,
        sync_warning: syncResult.error || 'No se pudo sincronizar con WooCommerce.'
      });
    }

    res.json(refreshedProduct);
  } catch (err) {
    res.status(400).json({ error: err.message || 'Error al actualizar el producto' });
  }
});

router.delete('/:id', authenticate, async (req, res) => {
  if (req.params.id === 'all') {
    run('DELETE FROM product_images');
    run('DELETE FROM product_categories');
    run('DELETE FROM products');
    saveDatabase();
    return res.json({ success: true, message: 'Todos los productos eliminados' });
  }

  const product = getProductById(req.params.id);
  if (!product) {
    return res.status(404).json({ error: 'Product not found' });
  }

  if (product.woocommerce_product_id || product.woocommerce_id) {
    const wooDeleteResult = await deleteProductFromWooCommerce(product, {
      action: 'product_delete'
    });
    var remoteDeleteWarning = (!wooDeleteResult.success && !wooDeleteResult.skipped)
      ? (wooDeleteResult.error || 'No se pudo eliminar en WooCommerce')
      : '';
  }

  run('DELETE FROM product_images WHERE product_id = ?', [req.params.id]);
  run('DELETE FROM product_categories WHERE product_id = ?', [req.params.id]);
  run('DELETE FROM products WHERE id = ?', [req.params.id]);
  saveDatabase();
  res.json({ success: true, remote_delete_warning: remoteDeleteWarning || '' });
});

router.get('/low-stock/alerts', authenticate, (req, res) => {
  const products = listProductsWithCatalog(
    `SELECT p.*, c.name as category_name, b.name as brand_name
     FROM products p
     LEFT JOIN categories c ON p.category_id = c.id
     LEFT JOIN brands b ON p.brand_id = b.id
     WHERE COALESCE(p.active, 1) = 1 AND p.stock <= p.min_stock
     ORDER BY p.stock ASC`
  );
  res.json(products);
});

module.exports = router;
