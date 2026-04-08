const TABLES_IN_IMPORT_ORDER = [
  'users',
  'settings',
  'categories',
  'device_types',
  'brands',
  'device_models',
  'customers',
  'suppliers',
  'products',
  'purchases',
  'purchase_items',
  'supplier_payments',
  'supplier_credits',
  'supplier_credit_items',
  'supplier_account',
  'supplier_account_movements',
  'sales',
  'sale_items',
  'repairs',
  'repair_logs',
  'woocommerce_sync',
  'product_sync_log',
  'external_order_links',
  'sync_logs',
  'product_categories',
  'product_images'
];

const IDENTITY_TABLES = [
  'users',
  'categories',
  'products',
  'customers',
  'sales',
  'sale_items',
  'repairs',
  'repair_logs',
  'product_sync_log',
  'external_order_links',
  'sync_logs',
  'product_categories',
  'product_images',
  'device_types',
  'brands',
  'device_models',
  'suppliers',
  'purchases',
  'purchase_items',
  'supplier_payments',
  'supplier_credits',
  'supplier_credit_items',
  'supplier_account',
  'supplier_account_movements'
];

function readAllRows(sqliteDb, tableName) {
  const stmt = sqliteDb.prepare(`SELECT * FROM ${tableName}`);
  const rows = [];
  while (stmt.step()) {
    rows.push(stmt.getAsObject());
  }
  stmt.free();
  return rows;
}

function loadSourceRows(sqliteDb) {
  const rowsByTable = new Map();
  for (const tableName of TABLES_IN_IMPORT_ORDER) {
    rowsByTable.set(tableName, readAllRows(sqliteDb, tableName));
  }
  return rowsByTable;
}

function reconcileSyntheticRows(rowsByTable) {
  const syntheticRows = new Map();
  const ensureSyntheticList = (tableName) => {
    if (!syntheticRows.has(tableName)) {
      syntheticRows.set(tableName, []);
    }
    return syntheticRows.get(tableName);
  };

  const suppliers = rowsByTable.get('suppliers') || [];
  const supplierIds = new Set(suppliers.map((row) => Number(row.id)).filter(Number.isFinite));
  const referencedSupplierIds = new Set();

  for (const tableName of ['purchases', 'supplier_payments', 'supplier_credits', 'supplier_account', 'supplier_account_movements']) {
    for (const row of rowsByTable.get(tableName) || []) {
      const supplierId = Number(row.supplier_id);
      if (Number.isFinite(supplierId) && supplierId > 0) {
        referencedSupplierIds.add(supplierId);
      }
    }
  }

  for (const supplierId of referencedSupplierIds) {
    if (!supplierIds.has(supplierId)) {
      ensureSyntheticList('suppliers').push({
        id: supplierId,
        name: `[Migrated orphan supplier #${supplierId}]`,
        phone: null,
        email: null,
        address: null,
        city: null,
        tax_id: null,
        notes: 'Synthetic supplier created during PostgreSQL migration because related accounting rows referenced a deleted supplier.',
        total_purchases: 0,
        total_credits: 0,
        total_payments: 0,
        balance: 0,
        created_at: null
      });
      supplierIds.add(supplierId);
    }
  }

  const products = rowsByTable.get('products') || [];
  const productIds = new Set(products.map((row) => Number(row.id)).filter(Number.isFinite));
  const referencedProductIds = new Set();

  for (const tableName of ['sale_items', 'purchase_items', 'supplier_credit_items', 'product_categories', 'product_images']) {
    for (const row of rowsByTable.get(tableName) || []) {
      const productId = Number(row.product_id);
      if (Number.isFinite(productId) && productId > 0) {
        referencedProductIds.add(productId);
      }
    }
  }

  for (const productId of referencedProductIds) {
    if (!productIds.has(productId)) {
      ensureSyntheticList('products').push({
        id: productId,
        sku: `MIG-ORPHAN-${productId}`,
        barcode: null,
        name: `[Migrated orphan product #${productId}]`,
        description: 'Synthetic product created during PostgreSQL migration because transactional rows referenced a deleted product.',
        short_description: null,
        color: null,
        category_id: null,
        category_primary_id: null,
        brand_id: null,
        supplier: null,
        purchase_price: 0,
        sale_price: 0,
        sale_price_includes_tax: 1,
        sale_price_2: 0,
        sale_price_2_includes_tax: 0,
        sale_price_3: 0,
        sale_price_3_includes_tax: 0,
        sale_price_4: 0,
        sale_price_4_includes_tax: 0,
        sale_price_5: 0,
        sale_price_5_includes_tax: 0,
        sale_price_6: 0,
        sale_price_6_includes_tax: 0,
        stock: 0,
        min_stock: 0,
        woocommerce_id: null,
        woocommerce_product_id: null,
        image_url: null,
        sync_status: 'pending',
        last_sync_at: null,
        active: 0,
        created_at: null,
        updated_at: null
      });
      productIds.add(productId);
    }
  }

  for (const [tableName, rows] of syntheticRows.entries()) {
    const currentRows = rowsByTable.get(tableName) || [];
    rowsByTable.set(tableName, [...currentRows, ...rows]);
  }

  return syntheticRows;
}

module.exports = {
  IDENTITY_TABLES,
  TABLES_IN_IMPORT_ORDER,
  loadSourceRows,
  reconcileSyntheticRows
};
