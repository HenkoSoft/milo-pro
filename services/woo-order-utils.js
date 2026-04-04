const crypto = require('crypto');

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

function buildWooOrderSyncConfig(row, env = process.env) {
  const envStatusMap = parseJsonOrDefault(env.WOO_ORDER_STATUS_MAP, null);
  const envStockStatuses = parseJsonOrDefault(env.WOO_ORDER_STOCK_STATUSES, null);
  const envPaidStatuses = parseJsonOrDefault(env.WOO_ORDER_PAID_STATUSES, null);

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
    salesChannel: env.WOO_ORDER_SALES_CHANNEL || (row && row.order_sales_channel) || 'woocommerce',
    customerStrategy: env.WOO_CUSTOMER_SYNC_STRATEGY || (row && row.customer_sync_strategy) || 'create_or_link',
    genericCustomerName: env.WOO_GENERIC_CUSTOMER_NAME || (row && row.generic_customer_name) || 'Cliente WooCommerce',
    webhookSecret: env.WOO_WEBHOOK_SECRET || (row && row.webhook_secret) || '',
    webhookAuthToken: env.WOO_WEBHOOK_AUTH_TOKEN || (row && row.webhook_auth_token) || '',
    signatureHeader: (env.WOO_WEBHOOK_SIGNATURE_HEADER || (row && row.webhook_signature_header) || 'x-wc-webhook-signature').toLowerCase(),
    deliveryHeader: (env.WOO_WEBHOOK_DELIVERY_HEADER || (row && row.webhook_delivery_header) || 'x-wc-webhook-delivery-id').toLowerCase(),
    syncEnabled: row ? Number(row.sync_orders || 0) === 1 : true
  };
}

function mapWooStatus(wooStatus, config) {
  return normalizeInternalSaleStatus(config.statusMap[wooStatus] || wooStatus || 'pending_payment');
}

function isPaidStatus(internalStatus, config) {
  const normalized = normalizeInternalSaleStatus(internalStatus);
  return config.paidStatuses.includes(normalized) || normalized === 'ready_for_delivery';
}

function shouldApplyStockForStatus(internalStatus, config) {
  const normalized = normalizeInternalSaleStatus(internalStatus);
  return config.stockStatuses.includes(normalized) || normalized === 'ready_for_delivery';
}

function computePaymentStatusFromInternal(internalStatus, config) {
  return isPaidStatus(normalizeInternalSaleStatus(internalStatus), config) ? 'paid' : 'pending';
}

function mapInternalStatusToWoo(internalStatus, env = process.env) {
  const normalizedStatus = normalizeInternalSaleStatus(internalStatus);
  const envMap = parseJsonOrDefault(env.WOO_INTERNAL_STATUS_MAP, {});
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

function normalizeWooOrder(order, config) {
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

module.exports = {
  DEFAULT_INTERNAL_TO_WOO_STATUS_MAP,
  DEFAULT_PAID_STATUSES,
  DEFAULT_STATUS_MAP,
  DEFAULT_STOCK_STATUSES,
  buildExternalReference,
  buildWooOrderSyncConfig,
  computeHmacBase64,
  computePaymentStatusFromInternal,
  currentTimestamp,
  extractAddress,
  isPaidStatus,
  mapInternalStatusToWoo,
  mapWooStatus,
  normalizeEmail,
  normalizeInternalSaleStatus,
  normalizePhone,
  normalizeString,
  normalizeWooOrder,
  parseJsonOrDefault,
  safeJson,
  shouldApplyStockForStatus
};
