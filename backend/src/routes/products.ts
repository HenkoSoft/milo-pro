import type { AuthenticatedRequestLike } from '../types/http';

const express = require('express');
const { authenticate } = require('../config/auth.js');
const { getDatabaseAccessForRequest } = require('../services/runtime-db.js');
const {
  deleteProductFromWooCommerce,
  getActiveWooConfigAsync,
  isWooExportEnabled,
  syncProductSnapshotToWooCommerce
} = require('../services/woocommerce-sync.js');
const { processProductImages } = require('../services/product-images.js');
const {
  buildAutomaticProductSku,
  extractAutomaticProductSkuNumber,
  getNextAutomaticProductSku
} = require('../services/product-sku.js');
const {
  getProductById,
  listProductsWithCatalog,
  syncProductCategories,
  syncProductImages,
  toIntegerList
} = require('../services/catalog.js');

type JsonResponse = {
  status: (code: number) => JsonResponse;
  json: (body: unknown) => void;
};

type RouteRequest<TBody = unknown> = AuthenticatedRequestLike<TBody> & {
  params: Record<string, string>;
  query: Record<string, string | string[] | undefined>;
};

type ProductRecord = Record<string, unknown> & {
  id?: unknown;
  sku?: unknown;
  barcode?: unknown;
  name?: unknown;
  description?: unknown;
  short_description?: unknown;
  color?: unknown;
  purchase_price?: unknown;
  sale_price?: unknown;
  stock?: unknown;
  min_stock?: unknown;
  image_url?: unknown;
  sync_status?: unknown;
  active?: unknown;
  woocommerce_id?: unknown;
  woocommerce_product_id?: unknown;
};

function toNullableString(value: unknown) {
  if (value === undefined || value === null || value === '') return null;
  return String(value).trim();
}

function toNumber(value: unknown, fallback = 0) {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
}

function normalizeAutomaticSku(value: unknown) {
  const skuNumber = extractAutomaticProductSkuNumber(value);
  return typeof skuNumber === 'number' && Number.isFinite(skuNumber) && skuNumber > 0
    ? buildAutomaticProductSku(skuNumber)
    : null;
}

function normalizeProvidedSku(value: unknown) {
  const trimmed = toNullableString(value);
  if (!trimmed) return null;
  return normalizeAutomaticSku(trimmed) || trimmed;
}

function resolveProductSku(rawSku: unknown, fallbackSku: unknown, skuRows: Array<string | { sku?: unknown }> = []) {
  const normalizedInput = normalizeProvidedSku(rawSku);
  if (normalizedInput) return normalizedInput;

  const normalizedFallback = normalizeProvidedSku(fallbackSku);
  if (normalizedFallback) return normalizedFallback;

  return getNextAutomaticProductSku(skuRows);
}

function sanitizeProductSummary(product: ProductRecord | null) {
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

function buildProductsQuery({ search, category, lowStock }: Record<string, string | string[] | undefined>) {
  let query = `
    SELECT p.*, c.name as category_name, b.name as brand_name
    FROM products p
    LEFT JOIN categories c ON p.category_id = c.id
    LEFT JOIN brands b ON b.id = p.brand_id
    WHERE COALESCE(p.active, 1) = 1
  `;
  const params: unknown[] = [];

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

async function buildProductPayload(db: { get: Function }, body: Record<string, unknown> = {}) {
  const primaryCategoryId = body.category_primary_id || body.category_id || null;
  const isGenericUncategorized = (value: unknown) => {
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

  const filteredCategoryIds: unknown[] = [];
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
    const rawName = categoryRecord ? (categoryRecord as Record<string, unknown>).name : '';
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

async function persistProduct(db: { all: Function; run: Function; save: Function }, payload: Record<string, unknown>, productId: string | number | null = null) {
  if (!payload.name) {
    throw new Error('El nombre es requerido');
  }

  const wooConfig = await getActiveWooConfigAsync();
  if (isWooExportEnabled(wooConfig)) {
    // No bloquear el guardado local por atributos opcionales de catalogo.
  }

  if (productId) {
    const existingProduct = await getProductById(productId);
    const nextSku = resolveProductSku(payload.sku, existingProduct && existingProduct.sku, await db.all('SELECT sku FROM products'));
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
    const nextSku = resolveProductSku(payload.sku, null, await db.all('SELECT sku FROM products'));
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
    ) as { lastInsertRowid?: number | null };
    productId = result.lastInsertRowid ?? null;
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

const router = express.Router();

function sanitizeProductMovement(record: Record<string, unknown> | null) {
  if (!record) return null;
  return {
    id: String(record.id || ''),
    type: String(record.type || ''),
    product_id: record.product_id == null ? null : Number(record.product_id),
    date: String(record.date || ''),
    code: String(record.code || ''),
    description: String(record.description || ''),
    quantity: toNumber(record.quantity),
    reference: toNullableString(record.reference) || ''
  };
}

router.get('/', authenticate, async (req: RouteRequest, res: JsonResponse) => {
  const { query, params } = buildProductsQuery(req.query || {});
  const products = await listProductsWithCatalog(query, params);
  res.json(products.map((product: ProductRecord) => sanitizeProductSummary(product)));
});

router.get('/next-sku/value', authenticate, async (req: RouteRequest, res: JsonResponse) => {
  const db = getDatabaseAccessForRequest(req);
  const nextSku = getNextAutomaticProductSku(await db.all('SELECT sku FROM products'));
  res.json({ sku: nextSku });
});

router.get('/:id', authenticate, async (req: RouteRequest, res: JsonResponse) => {
  const product = await getProductById(req.params.id);
  if (!product) {
    res.status(404).json({ error: 'Product not found' });
    return;
  }
  res.json(sanitizeProductSummary(product));
});

router.post('/', authenticate, async (req: RouteRequest, res: JsonResponse) => {
  try {
    const db = getDatabaseAccessForRequest(req);
    const payload = await buildProductPayload(db, (req.body || {}) as Record<string, unknown>);
    const product = await persistProduct(db, payload);
    const syncResult = await syncProductSnapshotToWooCommerce(product, { action: 'product_create' });
    const refreshedProduct = sanitizeProductSummary(await getProductById((product as ProductRecord).id) || product);

    if (!syncResult.success && !syncResult.skipped) {
      res.status(201).json({
        ...refreshedProduct,
        sync_warning: syncResult.error || 'No se pudo sincronizar con WooCommerce.'
      });
      return;
    }

    res.status(201).json(refreshedProduct);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error al crear el producto';
    res.status(400).json({ error: message || 'Error al crear el producto' });
  }
});

router.put('/:id', authenticate, async (req: RouteRequest, res: JsonResponse) => {
  try {
    const db = getDatabaseAccessForRequest(req);
    const payload = await buildProductPayload(db, (req.body || {}) as Record<string, unknown>);
    const product = await persistProduct(db, payload, req.params.id);
    const syncResult = await syncProductSnapshotToWooCommerce(product, { action: 'product_update' });
    const refreshedProduct = sanitizeProductSummary(await getProductById((product as ProductRecord).id) || product);

    if (!syncResult.success && !syncResult.skipped) {
      res.json({
        ...refreshedProduct,
        sync_warning: syncResult.error || 'No se pudo sincronizar con WooCommerce.'
      });
      return;
    }

    res.json(refreshedProduct);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error al actualizar el producto';
    res.status(400).json({ error: message || 'Error al actualizar el producto' });
  }
});

router.delete('/:id', authenticate, async (req: RouteRequest, res: JsonResponse) => {
  const db = getDatabaseAccessForRequest(req);

  if (req.params.id === 'all') {
    await db.run('DELETE FROM product_images');
    await db.run('DELETE FROM product_categories');
    await db.run('DELETE FROM products');
    await db.save();
    res.json({ success: true, message: 'Todos los productos eliminados' });
    return;
  }

  const product = await getProductById(req.params.id);
  if (!product) {
    res.status(404).json({ error: 'Product not found' });
    return;
  }

  let remoteDeleteWarning = '';
  if ((product as ProductRecord).woocommerce_product_id || (product as ProductRecord).woocommerce_id) {
    const wooDeleteResult = await deleteProductFromWooCommerce(product, { action: 'product_delete' });
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

router.get('/low-stock/alerts', authenticate, async (_req: RouteRequest, res: JsonResponse) => {
  const products = await listProductsWithCatalog(
    `SELECT p.*, c.name as category_name, b.name as brand_name
     FROM products p
     LEFT JOIN categories c ON p.category_id = c.id
     LEFT JOIN brands b ON p.brand_id = b.id
     WHERE COALESCE(p.active, 1) = 1 AND p.stock <= p.min_stock
     ORDER BY p.stock ASC`
  );
  res.json(products.map((product: ProductRecord) => sanitizeProductSummary(product)));
});

router.get('/movements/history', authenticate, async (req: RouteRequest, res: JsonResponse) => {
  const db = getDatabaseAccessForRequest(req);
  const startDate = String(req.query.startDate || '').trim();
  const endDate = String(req.query.endDate || '').trim();
  const type = String(req.query.type || '').trim();

  let query = `
    SELECT *
    FROM product_movements
    WHERE 1=1
  `;
  const params: unknown[] = [];

  if (startDate) {
    query += ' AND date >= ?';
    params.push(startDate);
  }

  if (endDate) {
    query += ' AND date <= ?';
    params.push(endDate);
  }

  if (type) {
    query += ' AND type = ?';
    params.push(type);
  }

  query += ' ORDER BY date DESC, created_at DESC, id DESC';

  const rows = await db.all(query, params);
  res.json(rows.map((row: Record<string, unknown>) => sanitizeProductMovement(row)));
});

router.post('/movements/history', authenticate, async (req: RouteRequest, res: JsonResponse) => {
  const db = getDatabaseAccessForRequest(req);
  const body = req.body && typeof req.body === 'object' ? req.body as Record<string, unknown> : {};
  const type = String(body.type || '').trim();
  const productId = body.product_id == null || body.product_id === '' ? null : Number(body.product_id);
  const date = String(body.date || '').trim();
  const code = String(body.code || '').trim();
  const description = String(body.description || '').trim();
  const quantity = toNumber(body.quantity, 0);
  const reference = toNullableString(body.reference);
  const id = String(body.id || `${type}-${Date.now()}`).trim();

  if (type !== 'adjustment' && type !== 'output') {
    res.status(400).json({ error: 'Tipo de movimiento invalido.' });
    return;
  }

  if (!date) {
    res.status(400).json({ error: 'La fecha es obligatoria.' });
    return;
  }

  if (!code || !description) {
    res.status(400).json({ error: 'El articulo es obligatorio.' });
    return;
  }

  if (type === 'output' && quantity <= 0) {
    res.status(400).json({ error: 'La cantidad debe ser mayor a cero.' });
    return;
  }

  if (type === 'output' && (!Number.isFinite(productId) || Number(productId) <= 0)) {
    res.status(400).json({ error: 'El articulo es obligatorio.' });
    return;
  }

  if (type === 'adjustment' && quantity < 0) {
    res.status(400).json({ error: 'El nuevo stock no puede ser negativo.' });
    return;
  }

  if (type === 'output') {
    const product = await db.get('SELECT id, stock FROM products WHERE id = ?', [productId]);
    if (!product) {
      res.status(404).json({ error: 'Articulo no encontrado.' });
      return;
    }

    const currentStock = toNumber((product as Record<string, unknown>).stock, 0);
    if (currentStock < quantity) {
      res.status(400).json({ error: 'La cantidad supera el stock disponible.' });
      return;
    }

    await db.run(
      `
        UPDATE products
        SET stock = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `,
      [currentStock - quantity, productId]
    );
  }

  await db.run(
    `
      INSERT INTO product_movements (id, type, product_id, date, code, description, quantity, reference)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `,
    [id, type, productId, date, code, description, quantity, reference]
  );

  await db.save();
  const created = await db.get('SELECT * FROM product_movements WHERE id = ?', [id]);
  res.status(201).json(sanitizeProductMovement(created));
});

export = router;
