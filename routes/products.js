const express = require('express');
const { authenticate } = require('../auth');
const { getDatabaseAccessForRequest } = require('../services/runtime-db');
const {
  deleteProductFromWooCommerce,
  getActiveWooConfigAsync,
  isWooExportEnabled,
  syncProductSnapshotToWooCommerce
} = require('../services/woocommerce-sync');
const { processProductImages } = require('../services/product-images');
const { getNextAutomaticProductSku } = require('../services/product-sku');
const {
  getProductById,
  listProductsWithCatalog,
  syncProductCategories,
  syncProductImages,
  toIntegerList
} = require('../services/catalog');

const router = express.Router();

function toNullableString(value) {
  if (value === undefined || value === null || value === '') return null;
  return String(value).trim();
}

function toNumber(value, fallback = 0) {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
}

function sanitizeProductSummary(product) {
  if (!product) return null;
  return {
    ...product,
    id: Number(product.id || 0),
    sku: toNullableString(product.sku),
    barcode: toNullableString(product.barcode),
    name: String(product.name || ''),
    description: toNullableString(product.description),
    short_description: toNullableString(product.short_description),
    color: toNullableString(product.color),
    purchase_price: toNumber(product.purchase_price),
    sale_price: toNumber(product.sale_price),
    stock: toNumber(product.stock),
    min_stock: toNumber(product.min_stock, 2),
    image_url: toNullableString(product.image_url),
    sync_status: toNullableString(product.sync_status),
    active: toNumber(product.active, 1)
  };
}

function buildProductsQuery({ search, category, lowStock }) {
  let query = `
    SELECT p.*, c.name as category_name, b.name as brand_name
    FROM products p
    LEFT JOIN categories c ON p.category_id = c.id
    LEFT JOIN brands b ON b.id = p.brand_id
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

async function buildProductPayload(db, body = {}) {
  const primaryCategoryId = body.category_primary_id || body.category_id || null;
  const isGenericUncategorized = (value) => {
    const normalized = String(value || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim();
    return normalized === 'uncategorized' || normalized === 'sin categoria';
  };
  const rawCategoryIds = [
    ...(Array.isArray(body.category_ids) ? body.category_ids : []),
    ...(Array.isArray(body.additional_category_ids) ? body.additional_category_ids : []),
    primaryCategoryId
  ];
  const filteredCategoryIds = [];
  for (const item of rawCategoryIds) {
    if (!primaryCategoryId) {
      filteredCategoryIds.push(item);
      continue;
    }
    if (String(item) === String(primaryCategoryId)) {
      filteredCategoryIds.push(item);
      continue;
    }
    const categoryRecord = item ? await db.get('SELECT name FROM categories WHERE id = ?', [item]) : null;
    const rawName = categoryRecord ? categoryRecord.name : '';
    if (!isGenericUncategorized(rawName)) {
      filteredCategoryIds.push(item);
    }
  }
  const categoryIds = toIntegerList(filteredCategoryIds);

  const images = Array.isArray(body.images)
    ? body.images
    : String(body.image_urls || '')
      .split(/\r?\n/)
      .map((item) => item.trim())
      .filter(Boolean)
      .map((item) => ({ url_remote: item }));

  const primaryImageUrl = String(body.image_url || '').trim();
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
    purchase_price: toNumber(body.purchase_price, 0),
    sale_price: toNumber(body.sale_price, 0),
    sale_price_includes_tax: body.sale_price_includes_tax ? 1 : 0,
    sale_price_2: toNumber(body.sale_price_2, 0),
    sale_price_2_includes_tax: body.sale_price_2_includes_tax ? 1 : 0,
    sale_price_3: toNumber(body.sale_price_3, 0),
    sale_price_3_includes_tax: body.sale_price_3_includes_tax ? 1 : 0,
    sale_price_4: toNumber(body.sale_price_4, 0),
    sale_price_4_includes_tax: body.sale_price_4_includes_tax ? 1 : 0,
    sale_price_5: toNumber(body.sale_price_5, 0),
    sale_price_5_includes_tax: body.sale_price_5_includes_tax ? 1 : 0,
    sale_price_6: toNumber(body.sale_price_6, 0),
    sale_price_6_includes_tax: body.sale_price_6_includes_tax ? 1 : 0,
    stock: toNumber(body.stock, 0),
    min_stock: toNumber(body.min_stock, 2),
    woocommerce_id: body.woocommerce_id || body.woocommerce_product_id || null,
    woocommerce_product_id: body.woocommerce_product_id || body.woocommerce_id || null,
    image_url: primaryImageUrl || null,
    images: normalizedImages,
    sync_status: body.sync_status || 'pending',
    active: body.active === false || body.active === 0 ? 0 : 1
  };
}

async function persistProduct(db, payload, productId = null) {
  if (!payload.name) {
    throw new Error('El nombre es requerido');
  }

  const wooConfig = await getActiveWooConfigAsync();
  if (isWooExportEnabled(wooConfig)) {
    // No bloquear el guardado local por atributos opcionales de catalogo.
  }

  if (productId) {
    const existingProduct = await getProductById(productId);
    const nextSku = payload.sku || (existingProduct && existingProduct.sku) || getNextAutomaticProductSku(await db.all('SELECT sku FROM products'));
    await db.run(
      `UPDATE products
       SET sku = ?, barcode = ?, name = ?, description = ?, short_description = ?, color = ?, category_id = ?, category_primary_id = ?,
           brand_id = ?, supplier = ?, purchase_price = ?, sale_price = ?, stock = ?, min_stock = ?, woocommerce_id = ?,
           sale_price_includes_tax = ?, sale_price_2 = ?, sale_price_2_includes_tax = ?, sale_price_3 = ?, sale_price_3_includes_tax = ?,
           sale_price_4 = ?, sale_price_4_includes_tax = ?, sale_price_5 = ?, sale_price_5_includes_tax = ?, sale_price_6 = ?, sale_price_6_includes_tax = ?,
           woocommerce_product_id = ?, image_url = ?, sync_status = ?, active = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [
        nextSku,
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
        payload.sale_price_includes_tax,
        payload.sale_price_2,
        payload.sale_price_2_includes_tax,
        payload.sale_price_3,
        payload.sale_price_3_includes_tax,
        payload.sale_price_4,
        payload.sale_price_4_includes_tax,
        payload.sale_price_5,
        payload.sale_price_5_includes_tax,
        payload.sale_price_6,
        payload.sale_price_6_includes_tax,
        payload.woocommerce_product_id,
        payload.image_url,
        payload.sync_status,
        payload.active,
        productId
      ]
    );
  } else {
    const nextSku = payload.sku || getNextAutomaticProductSku(await db.all('SELECT sku FROM products'));
    const result = await db.run(
      `INSERT INTO products (
        sku, barcode, name, description, short_description, color, category_id, category_primary_id, brand_id, supplier,
        purchase_price, sale_price, sale_price_includes_tax, sale_price_2, sale_price_2_includes_tax, sale_price_3, sale_price_3_includes_tax,
        sale_price_4, sale_price_4_includes_tax, sale_price_5, sale_price_5_includes_tax, sale_price_6, sale_price_6_includes_tax,
        stock, min_stock, woocommerce_id, woocommerce_product_id, image_url, sync_status, active
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)` ,
      [
        nextSku,
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
        payload.sale_price_includes_tax,
        payload.sale_price_2,
        payload.sale_price_2_includes_tax,
        payload.sale_price_3,
        payload.sale_price_3_includes_tax,
        payload.sale_price_4,
        payload.sale_price_4_includes_tax,
        payload.sale_price_5,
        payload.sale_price_5_includes_tax,
        payload.sale_price_6,
        payload.sale_price_6_includes_tax,
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
  await syncProductCategories(productId, payload.category_ids, payload.category_primary_id);
  await syncProductImages(productId, processedImages);
  await db.save();
  return await getProductById(productId);
}

router.get('/', authenticate, async (req, res) => {
  const { query, params } = buildProductsQuery(req.query || {});
  res.json((await listProductsWithCatalog(query, params)).map((product) => sanitizeProductSummary(product)));
});

router.get('/next-sku/value', authenticate, async (req, res) => {
  const db = getDatabaseAccessForRequest(req);
  const nextSku = getNextAutomaticProductSku(await db.all('SELECT sku FROM products'));
  res.json({ sku: nextSku });
});

router.get('/:id', authenticate, async (req, res) => {
  const product = await getProductById(req.params.id);
  if (!product) return res.status(404).json({ error: 'Product not found' });
  res.json(sanitizeProductSummary(product));
});

router.post('/', authenticate, async (req, res) => {
  try {
    const db = getDatabaseAccessForRequest(req);
    const payload = await buildProductPayload(db, req.body || {});
    const product = await persistProduct(db, payload);
    const syncResult = await syncProductSnapshotToWooCommerce(product, { action: 'product_create' });
    const refreshedProduct = sanitizeProductSummary(await getProductById(product.id) || product);

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
    const db = getDatabaseAccessForRequest(req);
    const payload = await buildProductPayload(db, req.body || {});
    const product = await persistProduct(db, payload, req.params.id);
    const syncResult = await syncProductSnapshotToWooCommerce(product, { action: 'product_update' });
    const refreshedProduct = sanitizeProductSummary(await getProductById(product.id) || product);

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
  const db = getDatabaseAccessForRequest(req);
  if (req.params.id === 'all') {
    await db.run('DELETE FROM product_images');
    await db.run('DELETE FROM product_categories');
    await db.run('DELETE FROM products');
    await db.save();
    return res.json({ success: true, message: 'Todos los productos eliminados' });
  }

  const product = await getProductById(req.params.id);
  if (!product) {
    return res.status(404).json({ error: 'Product not found' });
  }

  let remoteDeleteWarning = '';
  if (product.woocommerce_product_id || product.woocommerce_id) {
    const wooDeleteResult = await deleteProductFromWooCommerce(product, {
      action: 'product_delete'
    });
    remoteDeleteWarning = (!wooDeleteResult.success && !wooDeleteResult.skipped)
      ? (wooDeleteResult.error || 'No se pudo eliminar en WooCommerce')
      : '';
  }

  await db.run('DELETE FROM product_images WHERE product_id = ?', [req.params.id]);
  await db.run('DELETE FROM product_categories WHERE product_id = ?', [req.params.id]);
  await db.run('DELETE FROM products WHERE id = ?', [req.params.id]);
  await db.save();
  res.json({ success: true, remote_delete_warning: remoteDeleteWarning || '' });
});

router.get('/low-stock/alerts', authenticate, async (req, res) => {
  const products = (await listProductsWithCatalog(
    `SELECT p.*, c.name as category_name, b.name as brand_name
     FROM products p
     LEFT JOIN categories c ON p.category_id = c.id
     LEFT JOIN brands b ON p.brand_id = b.id
     WHERE COALESCE(p.active, 1) = 1 AND p.stock <= p.min_stock
     ORDER BY p.stock ASC`
  )).map((product) => sanitizeProductSummary(product));
  res.json(products);
});

module.exports = router;




