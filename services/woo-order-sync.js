const crypto = require('crypto');
const { get, run, all, transaction, saveDatabase } = require('../database');

const DEFAULT_STATUS_MAP = {
  pending: 'pending_payment',
  processing: 'paid',
  completed: 'completed',
  'on-hold': 'on_hold',
  cancelled: 'cancelled',
  refunded: 'refunded',
  failed: 'payment_failed'
};

const DEFAULT_STOCK_STATUSES = ['paid', 'completed'];
const DEFAULT_PAID_STATUSES = ['paid', 'completed'];
const DEFAULT_INTERNAL_TO_WOO_STATUS_MAP = {
  pending_payment: 'pending',
  paid: 'processing',
  ready_for_delivery: 'processing',
  completed: 'completed',
  on_hold: 'on-hold',
  cancelled: 'cancelled',
  refunded: 'refunded',
  payment_failed: 'failed'
};
const INTERNAL_STATUS_ALIASES = {
  pendiente: 'pending_payment',
  pending_payment: 'pending_payment',
  paid: 'paid',
  pago: 'paid',
  procesando: 'paid',
  processing: 'paid',
  ready_for_delivery: 'ready_for_delivery',
  listo_para_entrega: 'ready_for_delivery',
  listo_para_entregar: 'ready_for_delivery',
  completed: 'completed',
  completado: 'completed',
  on_hold: 'on_hold',
  'on-hold': 'on_hold',
  en_espera: 'on_hold',
  cancelado: 'cancelled',
  cancelled: 'cancelled',
  reintegrado: 'refunded',
  refunded: 'refunded',
  fallido: 'payment_failed',
  failed: 'payment_failed',
  payment_failed: 'payment_failed'
};

function parseJsonOrDefault(value, fallback) {
  if (value === undefined || value === null || value === '') return fallback;
  if (typeof value !== 'string') return value;
  try {
    return JSON.parse(value);
  } catch (error) {
    return fallback;
  }
}

function normalizeString(value) {
  return String(value || '').trim();
}

function normalizeInternalSaleStatus(value) {
  const raw = String(value || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_')
    .replace(/-/g, '_');
  return INTERNAL_STATUS_ALIASES[raw] || raw || 'pending_payment';
}

function normalizeEmail(value) {
  const email = normalizeString(value).toLowerCase();
  return email || null;
}

function normalizePhone(value) {
  const digits = String(value || '').replace(/\D/g, '');
  return digits || null;
}

function safeJson(value) {
  try {
    return JSON.stringify(value ?? null);
  } catch (error) {
    return JSON.stringify({ serialization_error: error.message });
  }
}

function currentTimestamp() {
  return new Date().toISOString();
}

function computeHmacBase64(secret, rawBody) {
  return crypto.createHmac('sha256', secret).update(rawBody).digest('base64');
}

function getWooOrderSyncConfig() {
  const row = get('SELECT * FROM woocommerce_sync WHERE id = 1');
  const envStatusMap = parseJsonOrDefault(process.env.WOO_ORDER_STATUS_MAP, null);
  const envStockStatuses = parseJsonOrDefault(process.env.WOO_ORDER_STOCK_STATUSES, null);
  const envPaidStatuses = parseJsonOrDefault(process.env.WOO_ORDER_PAID_STATUSES, null);

  return {
    statusMap: {
      ...DEFAULT_STATUS_MAP,
      ...parseJsonOrDefault(row && row.order_status_map, {}),
      ...(envStatusMap || {})
    },
    stockStatuses: Array.isArray(envStockStatuses)
      ? envStockStatuses
      : parseJsonOrDefault(row && row.order_stock_statuses, DEFAULT_STOCK_STATUSES),
    paidStatuses: Array.isArray(envPaidStatuses)
      ? envPaidStatuses
      : parseJsonOrDefault(row && row.order_paid_statuses, DEFAULT_PAID_STATUSES),
    salesChannel: process.env.WOO_ORDER_SALES_CHANNEL || (row && row.order_sales_channel) || 'woocommerce',
    customerStrategy: process.env.WOO_CUSTOMER_SYNC_STRATEGY || (row && row.customer_sync_strategy) || 'create_or_link',
    genericCustomerName: process.env.WOO_GENERIC_CUSTOMER_NAME || (row && row.generic_customer_name) || 'Cliente WooCommerce',
    webhookSecret: process.env.WOO_WEBHOOK_SECRET || (row && row.webhook_secret) || '',
    webhookAuthToken: process.env.WOO_WEBHOOK_AUTH_TOKEN || (row && row.webhook_auth_token) || '',
    signatureHeader: (process.env.WOO_WEBHOOK_SIGNATURE_HEADER || (row && row.webhook_signature_header) || 'x-wc-webhook-signature').toLowerCase(),
    deliveryHeader: (process.env.WOO_WEBHOOK_DELIVERY_HEADER || (row && row.webhook_delivery_header) || 'x-wc-webhook-delivery-id').toLowerCase(),
    syncEnabled: row ? Number(row.sync_orders || 0) === 1 : true
  };
}

function mapWooStatus(wooStatus, config = getWooOrderSyncConfig()) {
  return normalizeInternalSaleStatus(config.statusMap[wooStatus] || wooStatus || 'pending_payment');
}

function isPaidStatus(internalStatus, config = getWooOrderSyncConfig()) {
  const normalized = normalizeInternalSaleStatus(internalStatus);
  return config.paidStatuses.includes(normalized) || normalized === 'ready_for_delivery';
}

function shouldApplyStockForStatus(internalStatus, config = getWooOrderSyncConfig()) {
  const normalized = normalizeInternalSaleStatus(internalStatus);
  return config.stockStatuses.includes(normalized) || normalized === 'ready_for_delivery';
}

function computePaymentStatusFromInternal(internalStatus, config = getWooOrderSyncConfig()) {
  return isPaidStatus(normalizeInternalSaleStatus(internalStatus), config) ? 'paid' : 'pending';
}

function mapInternalStatusToWoo(internalStatus) {
  const normalizedStatus = normalizeInternalSaleStatus(internalStatus);
  const envMap = parseJsonOrDefault(process.env.WOO_INTERNAL_STATUS_MAP, {});
  return envMap[normalizedStatus] || DEFAULT_INTERNAL_TO_WOO_STATUS_MAP[normalizedStatus] || normalizedStatus;
}

function buildExternalReference(orderId) {
  return `woo-order-${orderId}`;
}

function extractAddress(order = {}) {
  const billing = order.billing || {};
  const parts = [
    billing.address_1,
    billing.address_2,
    billing.city,
    billing.state,
    billing.postcode,
    billing.country
  ].map(normalizeString).filter(Boolean);
  return parts.join(', ') || null;
}

function normalizeWooOrder(order, config = getWooOrderSyncConfig()) {
  const internalStatus = mapWooStatus(order.status, config);
  const paymentStatus = isPaidStatus(internalStatus, config) ? 'paid' : 'pending';
  const metaData = Array.isArray(order.meta_data) ? order.meta_data : [];
  const lineItems = Array.isArray(order.line_items) ? order.line_items : [];
  const customerNote = normalizeString(order.customer_note);
  const billing = order.billing || {};
  const shipping = order.shipping || {};

  return {
    woocommerceOrderId: Number(order.id),
    woocommerceOrderKey: normalizeString(order.order_key) || null,
    externalReference: buildExternalReference(order.id),
    channel: config.salesChannel,
    wooStatus: normalizeString(order.status),
    internalStatus,
    paymentStatus,
    currency: normalizeString(order.currency) || 'ARS',
    subtotal: Number(order.discount_total ? Number(order.total) + Number(order.discount_total) : order.total || 0),
    total: Number(order.total || 0),
    discountTotal: Number(order.discount_total || 0),
    taxTotal: Number(order.total_tax || 0),
    shippingTotal: Number(order.shipping_total || 0),
    totalPaid: paymentStatus === 'paid' ? Number(order.total || 0) : 0,
    paymentMethod: normalizeString(order.payment_method_title || order.payment_method || 'woocommerce'),
    paymentMethodCode: normalizeString(order.payment_method),
    notes: [customerNote, normalizeString(order.status_note)].filter(Boolean).join(' | ') || null,
    customer: {
      externalCustomerId: order.customer_id ? String(order.customer_id) : null,
      name: normalizeString(`${billing.first_name || ''} ${billing.last_name || ''}`) || normalizeString(shipping.first_name || shipping.last_name),
      email: normalizeEmail(billing.email),
      phone: normalizePhone(billing.phone),
      address: extractAddress(order),
      city: normalizeString(billing.city) || null,
      province: normalizeString(billing.state) || null,
      country: normalizeString(billing.country) || null,
      notes: customerNote || null
    },
    items: lineItems.map((item) => ({
      externalLineId: item.id ? String(item.id) : null,
      externalProductId: item.variation_id ? String(item.variation_id) : (item.product_id ? String(item.product_id) : null),
      wooProductId: Number(item.variation_id || item.product_id || 0) || null,
      sku: normalizeString(item.sku),
      name: normalizeString(item.name) || 'Item WooCommerce',
      quantity: Number(item.quantity || 0),
      unitPrice: Number(item.quantity ? Number(item.total || 0) / Number(item.quantity) : item.price || 0),
      subtotal: Number(item.total || 0),
      taxTotal: Number(item.total_tax || 0),
      metaData: item.meta_data || []
    })),
    raw: order,
    createdAt: order.date_created_gmt || order.date_created || currentTimestamp(),
    updatedAt: order.date_modified_gmt || order.date_modified || currentTimestamp(),
    deliveryId: metaData.find((item) => item && item.key === '_delivery_id')?.value || null
  };
}

function writeSyncLog(entry) {
  run(
    `INSERT INTO sync_logs (
      origin, entity_type, entity_id, external_id, event_type, delivery_id, status, message, error, payload, context
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      entry.origin,
      entry.entityType,
      entry.entityId || null,
      entry.externalId || null,
      entry.eventType || null,
      entry.deliveryId || null,
      entry.status,
      entry.message || null,
      entry.error || null,
      entry.payload ? safeJson(entry.payload) : null,
      entry.context ? safeJson(entry.context) : null
    ]
  );
}

function getSystemUserId() {
  const preferred = Number(process.env.WOO_SYNC_USER_ID || 0);
  if (preferred > 0) {
    const byId = get('SELECT id FROM users WHERE id = ?', [preferred]);
    if (byId) return byId.id;
  }

  const admin = get("SELECT id FROM users WHERE role = 'admin' ORDER BY id ASC LIMIT 1");
  if (admin) return admin.id;
  const first = get('SELECT id FROM users ORDER BY id ASC LIMIT 1');
  if (first) return first.id;

  const created = run(
    "INSERT INTO users (username, password, role, name) VALUES (?, ?, ?, ?)",
    ['woo-sync', crypto.randomUUID(), 'system', 'Woo Sync']
  );
  return created.lastInsertRowid;
}

function findExistingCustomerByEmail(email) {
  if (!email) return null;
  return get('SELECT * FROM customers WHERE lower(email) = lower(?) ORDER BY id ASC LIMIT 1', [email]);
}

function findExistingCustomerByPhone(phone) {
  if (!phone) return null;
  const customers = all('SELECT * FROM customers WHERE phone IS NOT NULL');
  return customers.find((item) => normalizePhone(item.phone) === phone) || null;
}

function ensureGenericCustomer(config) {
  const existing = get(
    'SELECT * FROM customers WHERE is_generic = 1 AND external_source = ? ORDER BY id ASC LIMIT 1',
    ['woocommerce']
  );
  if (existing) return existing;

  const result = run(
    `INSERT INTO customers (
      name, notes, external_source, is_generic
    ) VALUES (?, ?, ?, 1)`,
    [
      config.genericCustomerName,
      'Cliente generico para ordenes importadas desde WooCommerce',
      'woocommerce'
    ]
  );

  return get('SELECT * FROM customers WHERE id = ?', [result.lastInsertRowid]);
}

function resolveCustomer(normalizedOrder, config = getWooOrderSyncConfig()) {
  const customerData = normalizedOrder.customer;
  const byEmail = findExistingCustomerByEmail(customerData.email);
  if (byEmail) return byEmail;

  const byPhone = findExistingCustomerByPhone(customerData.phone);
  if (byPhone) return byPhone;

  if (config.customerStrategy === 'generic') {
    return ensureGenericCustomer(config);
  }

  const result = run(
    `INSERT INTO customers (
      name, phone, email, address, city, province, country, notes, external_source, external_customer_id, is_generic
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)`,
    [
      customerData.name || config.genericCustomerName,
      customerData.phone,
      customerData.email,
      customerData.address,
      customerData.city,
      customerData.province,
      customerData.country,
      customerData.notes,
      'woocommerce',
      customerData.externalCustomerId
    ]
  );

  return get('SELECT * FROM customers WHERE id = ?', [result.lastInsertRowid]);
}

function resolveProductForLine(item) {
  let product = null;

  if (item.sku) {
    product = get('SELECT * FROM products WHERE sku = ? LIMIT 1', [item.sku]);
  }

  if (!product && item.wooProductId) {
    product = get(
      'SELECT * FROM products WHERE woocommerce_product_id = ? OR woocommerce_id = ? LIMIT 1',
      [item.wooProductId, item.wooProductId]
    );
  }

  return product;
}

function normalizeOrderItems(normalizedOrder) {
  const matchedItems = [];
  const issues = [];

  normalizedOrder.items.forEach((item) => {
    const product = resolveProductForLine(item);

    if (!product) {
      issues.push({
        type: 'product_unmapped',
        message: `No se pudo mapear el item "${item.name}"`,
        sku: item.sku || null,
        external_product_id: item.externalProductId || null,
        line_id: item.externalLineId || null
      });
      return;
    }

    matchedItems.push({
      productId: product.id,
      externalLineId: item.externalLineId,
      externalProductId: item.externalProductId,
      sku: item.sku || product.sku || null,
      productName: item.name || product.name,
      quantity: Number(item.quantity || 0),
      unitPrice: Number(item.unitPrice || 0),
      subtotal: Number(item.subtotal || 0),
      product
    });
  });

  return { matchedItems, issues };
}

function loadSaleItemSnapshot(saleId) {
  return all(
    `SELECT product_id, quantity
     FROM sale_items
     WHERE sale_id = ?`,
    [saleId]
  ).reduce((acc, row) => {
    acc[row.product_id] = Number(acc[row.product_id] || 0) + Number(row.quantity || 0);
    return acc;
  }, {});
}

function applyInventoryDelta(previousItems, nextItems) {
  const deltas = new Map();

  Object.entries(previousItems || {}).forEach(([productId, quantity]) => {
    deltas.set(Number(productId), (deltas.get(Number(productId)) || 0) - Number(quantity || 0));
  });

  nextItems.forEach((item) => {
    deltas.set(item.productId, (deltas.get(item.productId) || 0) + Number(item.quantity || 0));
  });

  deltas.forEach((delta, productId) => {
    if (!delta) return;
    run('UPDATE products SET stock = stock - ? WHERE id = ?', [delta, productId]);
  });
}

function upsertExternalLink({ saleId, normalizedOrder, payload, issues }) {
  const existing = get(
    'SELECT * FROM external_order_links WHERE channel = ? AND woocommerce_order_id = ?',
    [normalizedOrder.channel, normalizedOrder.woocommerceOrderId]
  );

  if (existing) {
    run(
      `UPDATE external_order_links
       SET sale_id = ?, local_sale_id = ?, woocommerce_order_key = ?, external_reference = ?,
           sync_state = ?, last_error = ?, last_payload = ?, last_synced_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [
        saleId,
        saleId,
        normalizedOrder.woocommerceOrderKey,
        normalizedOrder.externalReference,
        issues.length > 0 ? 'partial' : 'synced',
        issues.length > 0 ? issues.map((item) => item.message).join(' | ') : null,
        safeJson(payload),
        existing.id
      ]
    );
    return existing.id;
  }

  const created = run(
    `INSERT INTO external_order_links (
      sale_id, channel, woocommerce_order_id, woocommerce_order_key, local_sale_id,
      external_reference, sync_state, last_error, last_payload
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      saleId,
      normalizedOrder.channel,
      normalizedOrder.woocommerceOrderId,
      normalizedOrder.woocommerceOrderKey,
      saleId,
      normalizedOrder.externalReference,
      issues.length > 0 ? 'partial' : 'synced',
      issues.length > 0 ? issues.map((item) => item.message).join(' | ') : null,
      safeJson(payload)
    ]
  );

  return created.lastInsertRowid;
}

function persistSaleItems(saleId, matchedItems) {
  run('DELETE FROM sale_items WHERE sale_id = ?', [saleId]);

  matchedItems.forEach((item) => {
    run(
      `INSERT INTO sale_items (
        sale_id, product_id, external_line_id, external_product_id, sku, product_name, quantity, unit_price, subtotal
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        saleId,
        item.productId,
        item.externalLineId,
        item.externalProductId,
        item.sku,
        item.productName,
        item.quantity,
        item.unitPrice,
        item.subtotal
      ]
    );
  });
}

function upsertSaleRecord({ saleId, normalizedOrder, customerId, systemUserId, issues }) {
  if (saleId) {
    run(
      `UPDATE sales
      SET customer_id = ?, user_id = ?, channel = ?, status = ?, payment_status = ?, external_status = ?,
           currency = ?, subtotal = ?, discount_total = ?, tax_total = ?, shipping_total = ?, total = ?,
           total_paid = ?, external_reference = ?, payment_method = ?, notes = ?, external_created_at = ?,
           external_updated_at = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [
        customerId,
        systemUserId,
        normalizedOrder.channel,
        normalizedOrder.internalStatus,
        normalizedOrder.paymentStatus,
        normalizedOrder.wooStatus,
        normalizedOrder.currency,
        normalizedOrder.subtotal,
        normalizedOrder.discountTotal,
        normalizedOrder.taxTotal,
        normalizedOrder.shippingTotal,
        normalizedOrder.total,
        normalizedOrder.totalPaid,
        normalizedOrder.externalReference,
        normalizedOrder.paymentMethod,
        issues.length > 0
          ? [normalizedOrder.notes, 'Requiere revision manual por items no mapeados'].filter(Boolean).join(' | ')
          : normalizedOrder.notes,
        normalizedOrder.createdAt,
        normalizedOrder.updatedAt,
        saleId
      ]
    );
    return saleId;
  }

  const nextReceiptNumber = get(
    `
      SELECT COALESCE(MAX(receipt_number), 0) + 1 as next_number
      FROM sales
      WHERE receipt_type = 'WEB' AND point_of_sale = 'WEB'
    `
  );

  const created = run(
    `INSERT INTO sales (
      customer_id, user_id, channel, status, payment_status, external_status, currency, subtotal,
      discount_total, tax_total, shipping_total, receipt_type, point_of_sale, receipt_number, total,
      total_paid, external_reference, payment_method, notes, external_created_at, external_updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'WEB', 'WEB', ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      customerId,
      systemUserId,
      normalizedOrder.channel,
      normalizedOrder.internalStatus,
      normalizedOrder.paymentStatus,
      normalizedOrder.wooStatus,
      normalizedOrder.currency,
      normalizedOrder.subtotal,
      normalizedOrder.discountTotal,
      normalizedOrder.taxTotal,
      normalizedOrder.shippingTotal,
      nextReceiptNumber && nextReceiptNumber.next_number ? Number(nextReceiptNumber.next_number) : 1,
      normalizedOrder.total,
      normalizedOrder.totalPaid,
      normalizedOrder.externalReference,
      normalizedOrder.paymentMethod,
      issues.length > 0
        ? [normalizedOrder.notes, 'Requiere revision manual por items no mapeados'].filter(Boolean).join(' | ')
        : normalizedOrder.notes,
      normalizedOrder.createdAt,
      normalizedOrder.updatedAt
    ]
  );

  return created.lastInsertRowid;
}

function verifyWebhookRequest(headers = {}, rawBody = Buffer.alloc(0), config = getWooOrderSyncConfig()) {
  if (config.webhookAuthToken) {
    const authHeader = normalizeString(headers.authorization || headers.Authorization);
    if (authHeader !== `Bearer ${config.webhookAuthToken}`) {
      const error = new Error('Webhook token invalido');
      error.statusCode = 401;
      throw error;
    }
  }

  if (config.webhookSecret) {
    const signature = normalizeString(headers[config.signatureHeader]);
    if (!signature) {
      const error = new Error('Firma de webhook ausente');
      error.statusCode = 401;
      throw error;
    }
    const expected = computeHmacBase64(config.webhookSecret, rawBody);
    if (signature !== expected) {
      const error = new Error('Firma de webhook invalida');
      error.statusCode = 401;
      throw error;
    }
  }
}

const syncWooOrderTransaction = transaction(({ payload, origin, eventType, deliveryId }) => {
  const config = getWooOrderSyncConfig();
  const normalizedOrder = normalizeWooOrder(payload, config);
  const systemUserId = getSystemUserId();
  const customer = resolveCustomer(normalizedOrder, config);
  const { matchedItems, issues } = normalizeOrderItems(normalizedOrder);

  const existingLink = get(
    'SELECT * FROM external_order_links WHERE channel = ? AND woocommerce_order_id = ?',
    [normalizedOrder.channel, normalizedOrder.woocommerceOrderId]
  );
  const saleId = existingLink ? existingLink.local_sale_id : null;
  const existingSale = saleId ? get('SELECT * FROM sales WHERE id = ?', [saleId]) : null;
  const previousItems = existingSale ? loadSaleItemSnapshot(existingSale.id) : {};
  const persistedSaleId = upsertSaleRecord({
    saleId: existingSale ? existingSale.id : null,
    normalizedOrder,
    customerId: customer.id,
    systemUserId,
    issues
  });

  persistSaleItems(persistedSaleId, matchedItems);
  const refreshedSale = get('SELECT * FROM sales WHERE id = ?', [persistedSaleId]);

  const shouldApplyStock = shouldApplyStockForStatus(normalizedOrder.internalStatus, config);
  const stockWasApplied = Boolean(refreshedSale && refreshedSale.stock_applied_at);

  if (shouldApplyStock) {
    applyInventoryDelta(stockWasApplied ? previousItems : {}, matchedItems);
    run(
      'UPDATE sales SET stock_applied_at = COALESCE(stock_applied_at, CURRENT_TIMESTAMP), stock_applied_state = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [normalizedOrder.internalStatus, persistedSaleId]
    );
  } else if (stockWasApplied) {
    issues.push({
      type: 'stock_review_required',
      message: `La orden paso a ${normalizedOrder.internalStatus} despues de descontar stock. Revisar manualmente.`
    });
    run(
      'UPDATE sales SET stock_applied_state = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [normalizedOrder.internalStatus, persistedSaleId]
    );
  }

  upsertExternalLink({
    saleId: persistedSaleId,
    normalizedOrder,
    payload,
    issues
  });

  const result = {
    saleId: persistedSaleId,
    externalReference: normalizedOrder.externalReference,
    created: !existingSale,
    updated: Boolean(existingSale),
    duplicated: Boolean(existingSale),
    issues,
    matched_items: matchedItems.length,
    unmatched_items: issues.filter((item) => item.type === 'product_unmapped').length,
    stockApplied: shouldApplyStock,
    paymentStatus: normalizedOrder.paymentStatus,
    internalStatus: normalizedOrder.internalStatus
  };

  writeSyncLog({
    origin,
    entityType: 'order',
    entityId: String(persistedSaleId),
    externalId: String(normalizedOrder.woocommerceOrderId),
    eventType,
    deliveryId,
    status: issues.length > 0 ? 'partial' : 'success',
    message: existingSale ? 'Orden WooCommerce actualizada' : 'Orden WooCommerce importada',
    payload,
    context: result
  });

  return result;
});

async function syncWooOrder(payload, options = {}) {
  const origin = options.origin || 'woocommerce_webhook';
  const eventType = options.eventType || 'order.updated';
  const deliveryId = options.deliveryId || null;

  try {
    const result = syncWooOrderTransaction({ payload, origin, eventType, deliveryId });
    saveDatabase();
    return result;
  } catch (error) {
    writeSyncLog({
      origin,
      entityType: 'order',
      externalId: payload && payload.id ? String(payload.id) : null,
      eventType,
      deliveryId,
      status: 'error',
      message: 'Error sincronizando orden WooCommerce',
      error: error.message,
      payload,
      context: { stack: error.stack }
    });
    saveDatabase();
    throw error;
  }
}

function loadSaleItemsWithProducts(saleId) {
  return all(
    `SELECT si.*, p.name as product_name_local
     FROM sale_items si
     LEFT JOIN products p ON p.id = si.product_id
     WHERE si.sale_id = ?`,
    [saleId]
  );
}

function applyStockForExistingSaleItems(items, direction = 'decrease') {
  const multiplier = direction === 'increase' ? 1 : -1;
  items.forEach((item) => {
    const quantity = Number(item.quantity || 0);
    if (!quantity) return;
    run('UPDATE products SET stock = stock + ? WHERE id = ?', [multiplier * quantity, item.product_id]);
  });
}

const updateLocalSaleStatusTransaction = transaction(({ saleId, nextStatus, note }) => {
  const sale = get('SELECT * FROM sales WHERE id = ?', [saleId]);
  if (!sale) {
    throw new Error('Sale not found');
  }

  const items = loadSaleItemsWithProducts(saleId);
  const config = getWooOrderSyncConfig();
  const previousStatus = normalizeInternalSaleStatus(sale.status || '');
  const normalizedNextStatus = normalizeInternalSaleStatus(nextStatus);
  const nextPaymentStatus = computePaymentStatusFromInternal(normalizedNextStatus, config);
  const nextWooStatus = mapInternalStatusToWoo(normalizedNextStatus);
  const stockApplied = Boolean(sale.stock_applied_at);
  const stockReverted = Boolean(sale.stock_reverted_at);
  const shouldApplyStock = shouldApplyStockForStatus(normalizedNextStatus, config);
  const shouldReverseStock = ['cancelled', 'refunded'].includes(normalizedNextStatus);

  if (shouldApplyStock && !stockApplied) {
    applyStockForExistingSaleItems(items, 'decrease');
    run(
      `UPDATE sales
       SET stock_applied_at = CURRENT_TIMESTAMP,
           stock_applied_state = ?,
           stock_reverted_at = NULL,
           stock_reverted_state = NULL
       WHERE id = ?`,
      [normalizedNextStatus, saleId]
    );
  } else if (shouldApplyStock && stockReverted) {
    applyStockForExistingSaleItems(items, 'decrease');
    run(
      `UPDATE sales
       SET stock_reverted_at = NULL,
           stock_reverted_state = NULL,
           stock_applied_state = ?
       WHERE id = ?`,
      [normalizedNextStatus, saleId]
    );
  } else if (shouldReverseStock && stockApplied && !stockReverted) {
    applyStockForExistingSaleItems(items, 'increase');
    run(
      `UPDATE sales
       SET stock_reverted_at = CURRENT_TIMESTAMP,
           stock_reverted_state = ?
       WHERE id = ?`,
      [normalizedNextStatus, saleId]
    );
  }

  const nextNotes = [sale.notes, note].filter(Boolean).join(' | ') || null;
  run(
    `UPDATE sales
     SET status = ?, payment_status = ?, external_status = ?, notes = ?, updated_at = CURRENT_TIMESTAMP
     WHERE id = ?`,
    [normalizedNextStatus, nextPaymentStatus, nextWooStatus, nextNotes, saleId]
  );

  writeSyncLog({
    origin: 'milo_local',
    entityType: 'order',
    entityId: String(saleId),
    externalId: sale.external_reference || null,
    eventType: 'order.status_changed_local',
    status: 'success',
      message: `Estado local cambiado de ${previousStatus || '-'} a ${normalizedNextStatus}`,
      context: {
        sale_id: saleId,
        previous_status: previousStatus,
        next_status: normalizedNextStatus,
        next_woo_status: nextWooStatus
      }
  });

  return {
    sale: get('SELECT * FROM sales WHERE id = ?', [saleId]),
    nextWooStatus
  };
});

async function syncSaleStatusToWooCommerce(saleId, nextStatus, options = {}) {
  const sale = get('SELECT * FROM sales WHERE id = ?', [saleId]);
  if (!sale) {
    throw new Error('Sale not found');
  }

  const link = get(
    'SELECT * FROM external_order_links WHERE local_sale_id = ? ORDER BY id DESC LIMIT 1',
    [saleId]
  );

  if (!link || !link.woocommerce_order_id) {
    return { success: true, skipped: true, reason: 'Sale has no WooCommerce link' };
  }

  const wooStatus = mapInternalStatusToWoo(nextStatus);
  const payload = { status: wooStatus };
  if (options.note) {
    payload.customer_note = options.note;
  }

  const timeoutMs = Math.max(5000, Number(process.env.WOO_ORDER_STATUS_TIMEOUT_MS || 30000));
  const maxAttempts = Math.max(1, Number(process.env.WOO_ORDER_STATUS_RETRIES || 3));
  let lastError = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      const result = await require('./woocommerce-sync').woocommerceRequest(
        'PUT',
        `/orders/${link.woocommerce_order_id}`,
        payload,
        null,
        { timeout_ms: timeoutMs }
      );

      run(
        `UPDATE external_order_links
         SET sync_state = 'synced', last_error = NULL, last_payload = ?, last_synced_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
        [safeJson(result), link.id]
      );

      writeSyncLog({
        origin: 'milo_local',
        entityType: 'order',
        entityId: String(saleId),
        externalId: String(link.woocommerce_order_id),
        eventType: 'order.status_synced_to_woo',
        status: 'success',
        message: `Estado sincronizado a WooCommerce: ${wooStatus}`,
        payload: result,
        context: { attempts: attempt, timeout_ms: timeoutMs }
      });

      saveDatabase();
      return { success: true, wooStatus, result, attempts: attempt };
    } catch (error) {
      lastError = error;
      if (attempt < maxAttempts) {
        await new Promise((resolve) => setTimeout(resolve, 400 * attempt));
      }
    }
  }

  run(
    `UPDATE external_order_links
     SET sync_state = 'error', last_error = ?, last_synced_at = CURRENT_TIMESTAMP
     WHERE id = ?`,
    [lastError.message, link.id]
  );

  writeSyncLog({
    origin: 'milo_local',
    entityType: 'order',
    entityId: String(saleId),
    externalId: String(link.woocommerce_order_id),
    eventType: 'order.status_synced_to_woo',
    status: 'error',
    message: 'No se pudo sincronizar el cambio de estado a WooCommerce',
    error: lastError.message,
    context: { next_status: nextStatus, woo_status: wooStatus, attempts: maxAttempts, timeout_ms: timeoutMs }
  });

  saveDatabase();
  return { success: false, wooStatus, error: lastError.message, attempts: maxAttempts };
}

async function updateSaleStatus(saleId, nextStatus, options = {}) {
  const result = updateLocalSaleStatusTransaction({
    saleId,
    nextStatus: normalizeInternalSaleStatus(nextStatus),
    note: options.note || ''
  });

  saveDatabase();

  const sale = result.sale;
  const shouldSyncRemote = options.syncToWoo !== false && ['woocommerce', 'web'].includes(String(sale.channel || '').toLowerCase());
  const remoteSync = shouldSyncRemote
    ? await syncSaleStatusToWooCommerce(saleId, nextStatus, options)
    : { success: true, skipped: true };

  return {
    sale: get('SELECT * FROM sales WHERE id = ?', [saleId]),
    remoteSync
  };
}

function getSyncLogs(limit = 100) {
  return all(
    `SELECT *
     FROM sync_logs
     WHERE entity_type = 'order'
     ORDER BY created_at DESC, id DESC
     LIMIT ?`,
    [Math.min(Math.max(Number(limit) || 100, 1), 500)]
  );
}

function getOrderLinkByWooId(orderId, channel = 'woocommerce') {
  return get(
    'SELECT * FROM external_order_links WHERE channel = ? AND woocommerce_order_id = ?',
    [channel, orderId]
  );
}

module.exports = {
  DEFAULT_PAID_STATUSES,
  DEFAULT_STATUS_MAP,
  DEFAULT_STOCK_STATUSES,
  DEFAULT_INTERNAL_TO_WOO_STATUS_MAP,
  buildExternalReference,
  computePaymentStatusFromInternal,
  getOrderLinkByWooId,
  getSyncLogs,
  getWooOrderSyncConfig,
  mapInternalStatusToWoo,
  mapWooStatus,
  normalizeInternalSaleStatus,
  normalizeWooOrder,
  shouldApplyStockForStatus,
  syncWooOrder,
  updateSaleStatus,
  verifyWebhookRequest
};
