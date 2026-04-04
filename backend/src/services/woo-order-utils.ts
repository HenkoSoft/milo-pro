import type {
  NormalizedWooOrder,
  WooOrderSyncConfig
} from '@shared/types/woocommerce';

const DEFAULT_STATUS_MAP: Record<string, string> = {
  pending: 'pending_payment',
  processing: 'paid',
  completed: 'completed',
  'on-hold': 'on_hold',
  cancelled: 'cancelled',
  refunded: 'refunded',
  failed: 'payment_failed'
};

const DEFAULT_STOCK_STATUSES = ['paid', 'completed'] as const;
const DEFAULT_PAID_STATUSES = ['paid', 'completed'] as const;
const DEFAULT_INTERNAL_TO_WOO_STATUS_MAP: Record<string, string> = {
  pending_payment: 'pending',
  paid: 'processing',
  ready_for_delivery: 'processing',
  completed: 'completed',
  on_hold: 'on-hold',
  cancelled: 'cancelled',
  refunded: 'refunded',
  payment_failed: 'failed'
};

const INTERNAL_STATUS_ALIASES: Record<string, string> = {
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

export function parseJsonOrDefault<T>(value: unknown, fallback: T): T {
  if (value === undefined || value === null || value === '') return fallback;
  if (typeof value !== 'string') return value as T;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

export function normalizeString(value: unknown): string {
  return String(value ?? '').trim();
}

export function normalizeInternalSaleStatus(value: unknown): string {
  const raw = String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_')
    .replace(/-/g, '_');
  return INTERNAL_STATUS_ALIASES[raw] || raw || 'pending_payment';
}

export function normalizeEmail(value: unknown): string | null {
  const email = normalizeString(value).toLowerCase();
  return email || null;
}

export function normalizePhone(value: unknown): string | null {
  const digits = String(value ?? '').replace(/\D/g, '');
  return digits || null;
}

export function safeJson(value: unknown): string {
  try {
    return JSON.stringify(value ?? null);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'serialization_error';
    return JSON.stringify({ serialization_error: message });
  }
}

export function currentTimestamp(): string {
  return new Date().toISOString();
}

export function computeHmacBase64(secret: string, rawBody: string | ArrayBufferLike): string {
  const body = typeof rawBody === 'string' ? rawBody : String(rawBody);
  if (typeof globalThis.btoa === 'function') {
    return globalThis.btoa(`${secret}:${body}`);
  }
  return `${secret}:${body}`;
}

export function buildWooOrderSyncConfig(row: Record<string, unknown> | null | undefined, env: Record<string, string | undefined>): WooOrderSyncConfig {
  const envStatusMap = parseJsonOrDefault<Record<string, string> | null>(env.WOO_ORDER_STATUS_MAP, null);
  const envStockStatuses = parseJsonOrDefault<string[] | null>(env.WOO_ORDER_STOCK_STATUSES, null);
  const envPaidStatuses = parseJsonOrDefault<string[] | null>(env.WOO_ORDER_PAID_STATUSES, null);

  return {
    statusMap: {
      ...DEFAULT_STATUS_MAP,
      ...parseJsonOrDefault<Record<string, string>>(row?.order_status_map, {}),
      ...(envStatusMap || {})
    },
    stockStatuses: Array.isArray(envStockStatuses)
      ? envStockStatuses
      : parseJsonOrDefault<string[]>(row?.order_stock_statuses, [...DEFAULT_STOCK_STATUSES]),
    paidStatuses: Array.isArray(envPaidStatuses)
      ? envPaidStatuses
      : parseJsonOrDefault<string[]>(row?.order_paid_statuses, [...DEFAULT_PAID_STATUSES]),
    salesChannel: env.WOO_ORDER_SALES_CHANNEL || normalizeString(row?.order_sales_channel) || 'woocommerce',
    customerStrategy: env.WOO_CUSTOMER_SYNC_STRATEGY || normalizeString(row?.customer_sync_strategy) || 'create_or_link',
    genericCustomerName: env.WOO_GENERIC_CUSTOMER_NAME || normalizeString(row?.generic_customer_name) || 'Cliente WooCommerce',
    webhookSecret: env.WOO_WEBHOOK_SECRET || normalizeString(row?.webhook_secret),
    webhookAuthToken: env.WOO_WEBHOOK_AUTH_TOKEN || normalizeString(row?.webhook_auth_token),
    signatureHeader: (env.WOO_WEBHOOK_SIGNATURE_HEADER || normalizeString(row?.webhook_signature_header) || 'x-wc-webhook-signature').toLowerCase(),
    deliveryHeader: (env.WOO_WEBHOOK_DELIVERY_HEADER || normalizeString(row?.webhook_delivery_header) || 'x-wc-webhook-delivery-id').toLowerCase(),
    syncEnabled: row ? Number(row.sync_orders || 0) === 1 : true
  };
}

export function mapWooStatus(wooStatus: unknown, config: WooOrderSyncConfig): string {
  return normalizeInternalSaleStatus(config.statusMap[String(wooStatus ?? '')] || wooStatus || 'pending_payment');
}

export function isPaidStatus(internalStatus: unknown, config: WooOrderSyncConfig): boolean {
  const normalized = normalizeInternalSaleStatus(internalStatus);
  return config.paidStatuses.includes(normalized) || normalized === 'ready_for_delivery';
}

export function shouldApplyStockForStatus(internalStatus: unknown, config: WooOrderSyncConfig): boolean {
  const normalized = normalizeInternalSaleStatus(internalStatus);
  return config.stockStatuses.includes(normalized) || normalized === 'ready_for_delivery';
}

export function computePaymentStatusFromInternal(internalStatus: unknown, config: WooOrderSyncConfig): string {
  return isPaidStatus(normalizeInternalSaleStatus(internalStatus), config) ? 'paid' : 'pending';
}

export function mapInternalStatusToWoo(internalStatus: unknown, env: Record<string, string | undefined>): string {
  const normalizedStatus = normalizeInternalSaleStatus(internalStatus);
  const envMap = parseJsonOrDefault<Record<string, string>>(env.WOO_INTERNAL_STATUS_MAP, {});
  return envMap[normalizedStatus] || DEFAULT_INTERNAL_TO_WOO_STATUS_MAP[normalizedStatus] || normalizedStatus;
}

export function buildExternalReference(orderId: unknown): string {
  return `woo-order-${String(orderId ?? '').trim()}`;
}

export function extractAddress(order: unknown): string | null {
  const billing = isRecord(order) && isRecord(order.billing) ? order.billing : {};
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

export function normalizeWooOrder(order: Record<string, unknown>, config: WooOrderSyncConfig): NormalizedWooOrder {
  const internalStatus = mapWooStatus(order.status, config);
  const paymentStatus = isPaidStatus(internalStatus, config) ? 'paid' : 'pending';
  const metaData = Array.isArray(order.meta_data) ? order.meta_data : [];
  const lineItems = Array.isArray(order.line_items) ? order.line_items : [];
  const customerNote = normalizeString(order.customer_note);
  const billing = isRecord(order.billing) ? order.billing : {};
  const shipping = isRecord(order.shipping) ? order.shipping : {};

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
    items: lineItems.map((item) => {
      const row = isRecord(item) ? item : {};
      return {
        externalLineId: row.id ? String(row.id) : null,
        externalProductId: row.variation_id ? String(row.variation_id) : (row.product_id ? String(row.product_id) : null),
        wooProductId: Number(row.variation_id || row.product_id || 0) || null,
        sku: normalizeString(row.sku),
        name: normalizeString(row.name) || 'Item WooCommerce',
        quantity: Number(row.quantity || 0),
        unitPrice: Number(row.quantity ? Number(row.total || 0) / Number(row.quantity) : row.price || 0),
        subtotal: Number(row.total || 0),
        taxTotal: Number(row.total_tax || 0),
        metaData: Array.isArray(row.meta_data) ? row.meta_data : []
      };
    }),
    raw: order,
    createdAt: normalizeString(order.date_created_gmt || order.date_created) || currentTimestamp(),
    updatedAt: normalizeString(order.date_modified_gmt || order.date_modified) || currentTimestamp(),
    deliveryId: metaData.find((item) => isRecord(item) && item.key === '_delivery_id' ) && (metaData.find((item) => isRecord(item) && item.key === '_delivery_id') as Record<string, unknown>).value
  };
}

export {
  DEFAULT_INTERNAL_TO_WOO_STATUS_MAP,
  DEFAULT_PAID_STATUSES,
  DEFAULT_STATUS_MAP,
  DEFAULT_STOCK_STATUSES
};
