function parseWooBoolean(value: unknown, fallback = false) {
  if (value === undefined || value === null || value === '') return fallback;
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value > 0;
  const normalized = String(value).trim().toLowerCase();
  return ['1', 'true', 'on', 'yes', 'si'].includes(normalized);
}

function toNullableWooString(value: unknown) {
  if (value === undefined || value === null || value === '') return null;
  return String(value).trim();
}

function toRequiredWooString(value: unknown, fallback = '') {
  return String(value ?? fallback).trim() || fallback;
}

function toWooNumber(value: unknown, fallback = 0) {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
}

function toWooJsonString(value: unknown, fallback: unknown) {
  if (typeof value === 'string' && value.trim()) return value;
  try {
    return JSON.stringify(value ?? fallback);
  } catch (_error) {
    return JSON.stringify(fallback);
  }
}

function preserveWooSecret(input: unknown, fallback = '') {
  const nextValue = toNullableWooString(input);
  return nextValue || fallback;
}

function normalizeWooSyncDirection(value: unknown, fallback = 'export') {
  const normalized = toRequiredWooString(value, fallback).toLowerCase();
  if (normalized === 'bidirectional') return 'both';
  if (normalized === 'local_to_remote') return 'export';
  if (normalized === 'remote_to_local') return 'import';
  if (normalized === 'both' || normalized === 'export' || normalized === 'import') return normalized;
  return fallback;
}

function normalizeWooConflictPriority(value: unknown, fallback = 'milo') {
  const normalized = toRequiredWooString(value, fallback).toLowerCase();
  if (normalized === 'local') return 'milo';
  if (normalized === 'remote') return 'woocommerce';
  if (normalized === 'milo' || normalized === 'woocommerce') return normalized;
  return fallback;
}

function normalizeWooCategoryMode(value: unknown, fallback = 'milo') {
  const normalized = toRequiredWooString(value, fallback).toLowerCase();
  if (normalized === 'sync') return 'milo';
  if (normalized === 'milo' || normalized === 'local_only') return normalized;
  return fallback;
}

function normalizeWooCustomerStrategy(value: unknown, fallback = 'create_or_link') {
  const normalized = toRequiredWooString(value, fallback).toLowerCase();
  if (normalized === 'match_or_create') return 'create_or_link';
  if (normalized === 'generic_customer' || normalized === 'create_or_link') return normalized;
  return fallback;
}

export function normalizeWooConnectionTestPayload(body: unknown) {
  const data = body && typeof body === 'object' ? body as Record<string, unknown> : {};
  return {
    store_url: toRequiredWooString(data.store_url),
    consumer_key: toRequiredWooString(data.consumer_key),
    consumer_secret: toRequiredWooString(data.consumer_secret),
    api_version: toRequiredWooString(data.api_version, 'wc/v3'),
    wp_username: toRequiredWooString(data.wp_username),
    wp_app_password: toRequiredWooString(data.wp_app_password)
  };
}

export function normalizeWooConfigPayload(body: unknown, existing: unknown) {
  const data = body && typeof body === 'object' ? body as Record<string, unknown> : {};
  const current = existing && typeof existing === 'object' ? existing as Record<string, unknown> : {};

  return {
    store_url: toRequiredWooString(data.store_url, toRequiredWooString(current.store_url)),
    consumer_key: preserveWooSecret(data.consumer_key, toRequiredWooString(current.consumer_key)),
    consumer_secret: preserveWooSecret(data.consumer_secret, toRequiredWooString(current.consumer_secret)),
    wp_username: preserveWooSecret(data.wp_username, toRequiredWooString(current.wp_username)),
    wp_app_password: preserveWooSecret(data.wp_app_password, toRequiredWooString(current.wp_app_password)),
    api_version: toRequiredWooString(data.api_version, toRequiredWooString(current.api_version, 'wc/v3')),
    sync_direction: normalizeWooSyncDirection(data.sync_direction, normalizeWooSyncDirection(current.sync_direction, 'export')),
    sync_products: parseWooBoolean(data.sync_products, parseWooBoolean(current.sync_products, true)) ? 1 : 0,
    sync_customers: parseWooBoolean(data.sync_customers, parseWooBoolean(current.sync_customers, false)) ? 1 : 0,
    sync_orders: parseWooBoolean(data.sync_orders, parseWooBoolean(current.sync_orders, false)) ? 1 : 0,
    sync_stock: parseWooBoolean(data.sync_stock, parseWooBoolean(current.sync_stock, true)) ? 1 : 0,
    sync_prices: parseWooBoolean(data.sync_prices, parseWooBoolean(current.sync_prices, true)) ? 1 : 0,
    sync_mode: toRequiredWooString(data.sync_mode, toRequiredWooString(current.sync_mode, 'manual')),
    sync_interval_minutes: Math.max(1, toWooNumber(data.sync_interval_minutes, toWooNumber(current.sync_interval_minutes, 60))),
    auto_sync: parseWooBoolean(data.auto_sync, parseWooBoolean(current.auto_sync, false)) ? 1 : 0,
    tax_mode: toRequiredWooString(data.tax_mode, toRequiredWooString(current.tax_mode, 'woocommerce')),
    category_mode: normalizeWooCategoryMode(data.category_mode, normalizeWooCategoryMode(current.category_mode, 'milo')),
    conflict_priority: normalizeWooConflictPriority(data.conflict_priority, normalizeWooConflictPriority(current.conflict_priority, 'milo')),
    order_status_map: toWooJsonString(data.order_status_map, {
      pending: 'pendiente',
      processing: 'procesando',
      completed: 'completado',
      cancelled: 'cancelado',
      refunded: 'reintegrado',
      failed: 'fallido'
    }),
    order_stock_statuses: toWooJsonString(data.order_stock_statuses, ['paid', 'completed']),
    order_paid_statuses: toWooJsonString(data.order_paid_statuses, ['paid', 'completed']),
    order_sync_mode: toRequiredWooString(data.order_sync_mode, toRequiredWooString(current.order_sync_mode, 'webhook')),
    order_sales_channel: toRequiredWooString(data.order_sales_channel, toRequiredWooString(current.order_sales_channel, 'woocommerce')),
    customer_sync_strategy: normalizeWooCustomerStrategy(data.customer_sync_strategy, normalizeWooCustomerStrategy(current.customer_sync_strategy, 'create_or_link')),
    generic_customer_name: toRequiredWooString(data.generic_customer_name, toRequiredWooString(current.generic_customer_name, 'Cliente WooCommerce')),
    webhook_secret: preserveWooSecret(data.webhook_secret, toRequiredWooString(current.webhook_secret)),
    webhook_auth_token: preserveWooSecret(data.webhook_auth_token, toRequiredWooString(current.webhook_auth_token)),
    webhook_signature_header: toRequiredWooString(data.webhook_signature_header, toRequiredWooString(current.webhook_signature_header, 'x-wc-webhook-signature')),
    webhook_delivery_header: toRequiredWooString(data.webhook_delivery_header, toRequiredWooString(current.webhook_delivery_header, 'x-wc-webhook-delivery-id'))
  };
}

export function normalizeWooOrderImportPayload(body: unknown) {
  const data = body && typeof body === 'object' ? body as Record<string, unknown> : {};
  const rawStatus = data.status;
  let status;

  if (Array.isArray(rawStatus)) {
    const next = rawStatus.map((item) => String(item || '').trim()).filter(Boolean);
    status = next.length > 0 ? next : undefined;
  } else if (typeof rawStatus === 'string') {
    const parts = rawStatus.split(',').map((item) => item.trim()).filter(Boolean);
    status = parts.length <= 1 ? parts[0] : parts;
  }

  return {
    after: toNullableWooString(data.after) || undefined,
    before: toNullableWooString(data.before) || undefined,
    status,
    per_page: Math.min(Math.max(toWooNumber(data.per_page, 25), 1), 100)
  };
}

export function normalizeWooLogsLimit(value: unknown) {
  return Math.min(Math.max(toWooNumber(value, 100), 1), 500);
}

export function sanitizeWooStatusResponse(record: unknown) {
  const data = record && typeof record === 'object' ? record as Record<string, unknown> : {};
  const logsSummary = data.logs_summary && typeof data.logs_summary === 'object' ? data.logs_summary as Record<string, unknown> : {};
  const recentErrors = Array.isArray(logsSummary.recent_errors) ? logsSummary.recent_errors : [];
  const logs = Array.isArray(data.logs) ? data.logs as Array<Record<string, unknown>> : [];
  const orderConfig = data.orderConfig && typeof data.orderConfig === 'object' ? data.orderConfig as Record<string, unknown> : {};

  return {
    connected: parseWooBoolean(data.connected, false),
    message: toNullableWooString(data.message) || undefined,
    store_url: toNullableWooString(data.store_url) || undefined,
    api_version: toNullableWooString(data.api_version) || undefined,
    sync_direction: toNullableWooString(data.sync_direction) || undefined,
    sync_products: data.sync_products === undefined ? undefined : parseWooBoolean(data.sync_products, true),
    sync_customers: data.sync_customers === undefined ? undefined : parseWooBoolean(data.sync_customers, false),
    sync_orders: data.sync_orders === undefined ? undefined : parseWooBoolean(data.sync_orders, false),
    sync_stock: data.sync_stock === undefined ? undefined : parseWooBoolean(data.sync_stock, true),
    sync_prices: data.sync_prices === undefined ? undefined : parseWooBoolean(data.sync_prices, true),
    sync_mode: toNullableWooString(data.sync_mode) || undefined,
    sync_interval_minutes: data.sync_interval_minutes === undefined ? undefined : toWooNumber(data.sync_interval_minutes, 60),
    tax_mode: toNullableWooString(data.tax_mode) || undefined,
    category_mode: toNullableWooString(data.category_mode) || undefined,
    conflict_priority: toNullableWooString(data.conflict_priority) || undefined,
    order_status_map: toNullableWooString(data.order_status_map) || undefined,
    last_sync: toNullableWooString(data.last_sync),
    auto_sync: data.auto_sync === undefined ? undefined : parseWooBoolean(data.auto_sync, false),
    polling_active: data.polling_active === undefined ? undefined : parseWooBoolean(data.polling_active, false),
    orders_sync_enabled: data.orders_sync_enabled === undefined ? undefined : parseWooBoolean(data.orders_sync_enabled, false),
    order_sync_mode: toNullableWooString(data.order_sync_mode) || undefined,
    order_sales_channel: toNullableWooString(data.order_sales_channel) || undefined,
    customer_sync_strategy: toNullableWooString(data.customer_sync_strategy) || undefined,
    generic_customer_name: toNullableWooString(data.generic_customer_name) || undefined,
    webhook_signature_header: toNullableWooString(data.webhook_signature_header) || undefined,
    webhook_delivery_header: toNullableWooString(data.webhook_delivery_header) || undefined,
    order_status_map_effective: data.order_status_map_effective && typeof data.order_status_map_effective === 'object'
      ? Object.fromEntries(Object.entries(data.order_status_map_effective).map(([key, value]) => [String(key), String(value)]))
      : undefined,
    order_stock_statuses: Array.isArray(data.order_stock_statuses)
      ? data.order_stock_statuses.map((item) => String(item || '').trim()).filter(Boolean)
      : undefined,
    order_paid_statuses: Array.isArray(data.order_paid_statuses)
      ? data.order_paid_statuses.map((item) => String(item || '').trim()).filter(Boolean)
      : undefined,
    has_consumer_key: data.has_consumer_key === undefined ? undefined : parseWooBoolean(data.has_consumer_key, false),
    has_consumer_secret: data.has_consumer_secret === undefined ? undefined : parseWooBoolean(data.has_consumer_secret, false),
    has_wp_username: data.has_wp_username === undefined ? undefined : parseWooBoolean(data.has_wp_username, false),
    has_wp_app_password: data.has_wp_app_password === undefined ? undefined : parseWooBoolean(data.has_wp_app_password, false),
    has_webhook_secret: data.has_webhook_secret === undefined ? undefined : parseWooBoolean(data.has_webhook_secret, false),
    has_webhook_auth_token: data.has_webhook_auth_token === undefined ? undefined : parseWooBoolean(data.has_webhook_auth_token, false),
    logs: logs.map((log) => sanitizeWooProductSyncLog(log)),
    orderConfig: Object.keys(orderConfig).length > 0 ? {
      enabled: orderConfig.enabled === undefined ? undefined : parseWooBoolean(orderConfig.enabled, false),
      sync_mode: toNullableWooString(orderConfig.sync_mode) || undefined,
      sales_channel: toNullableWooString(orderConfig.sales_channel) || undefined,
      customer_sync_strategy: toNullableWooString(orderConfig.customer_sync_strategy) || undefined,
      generic_customer_name: toNullableWooString(orderConfig.generic_customer_name) || undefined,
      webhook_secret: toNullableWooString(orderConfig.webhook_secret) || undefined,
      webhook_auth_token: toNullableWooString(orderConfig.webhook_auth_token) || undefined,
      webhook_signature_header: toNullableWooString(orderConfig.webhook_signature_header) || undefined,
      webhook_delivery_header: toNullableWooString(orderConfig.webhook_delivery_header) || undefined
    } : undefined,
    logs_summary: {
      processed: toWooNumber(logsSummary.processed),
      errors: toWooNumber(logsSummary.errors),
      recent_errors: recentErrors.map((item) => {
        const row = item && typeof item === 'object' ? item as Record<string, unknown> : {};
        return {
          id: toWooNumber(row.id),
          message: toNullableWooString(row.message),
          synced_at: toNullableWooString(row.synced_at),
          action: toNullableWooString(row.action)
        };
      })
    }
  };
}

export function sanitizeWooPollingResult(record: unknown) {
  const row = record && typeof record === 'object' ? record as Record<string, unknown> : {};
  return {
    success: parseWooBoolean(row.success, false),
    error: toNullableWooString(row.error) || undefined,
    alreadyRunning: row.alreadyRunning === undefined ? undefined : parseWooBoolean(row.alreadyRunning, false),
    interval_seconds: row.interval_seconds === undefined ? undefined : toWooNumber(row.interval_seconds),
    message: toNullableWooString(row.message) || undefined
  };
}

export function sanitizeWooPollingStatus(record: unknown) {
  const row = record && typeof record === 'object' ? record as Record<string, unknown> : {};
  return {
    active: parseWooBoolean(row.active, false),
    interval_seconds: toWooNumber(row.interval_seconds)
  };
}

export function sanitizeWooProductSyncLog(record: Record<string, unknown>) {
  return {
    id: toWooNumber(record.id),
    milo_id: record.milo_id === undefined || record.milo_id === null ? null : toWooNumber(record.milo_id),
    woocommerce_id: record.woocommerce_id === undefined || record.woocommerce_id === null ? null : toWooNumber(record.woocommerce_id),
    action: toNullableWooString(record.action),
    status: toNullableWooString(record.status),
    message: toNullableWooString(record.message),
    synced_at: toNullableWooString(record.synced_at)
  };
}

export function sanitizeWooOrderSyncLog(record: Record<string, unknown>) {
  return {
    id: toWooNumber(record.id),
    origin: toNullableWooString(record.origin),
    entity_type: toNullableWooString(record.entity_type),
    entity_id: toNullableWooString(record.entity_id),
    external_id: toNullableWooString(record.external_id),
    event_type: toNullableWooString(record.event_type),
    delivery_id: toNullableWooString(record.delivery_id),
    status: toNullableWooString(record.status),
    message: toNullableWooString(record.message),
    error: toNullableWooString(record.error),
    created_at: toNullableWooString(record.created_at)
  };
}

export function buildWooStatusResponse(config: Record<string, unknown> | null = null, options: Record<string, unknown> = {}) {
  if (!config || !config.store_url) {
    return sanitizeWooStatusResponse({ connected: false, message: 'WooCommerce not configured' });
  }

  const logs = Array.isArray(options.logs) ? options.logs as Array<Record<string, unknown>> : [];
  const recentErrors = logs.filter((log) => log.status === 'error').slice(0, 10);
  const orderConfig = options.orderConfig && typeof options.orderConfig === 'object' ? options.orderConfig as Record<string, unknown> : {};

  return sanitizeWooStatusResponse({
    connected: true,
    store_url: config.store_url,
    api_version: config.api_version || 'wc/v3',
    sync_direction: config.sync_direction || 'export',
    sync_products: parseWooBoolean(config.sync_products, true),
    sync_customers: parseWooBoolean(config.sync_customers, false),
    sync_orders: parseWooBoolean(config.sync_orders, false),
    sync_stock: parseWooBoolean(config.sync_stock, true),
    sync_prices: parseWooBoolean(config.sync_prices, true),
    sync_mode: config.sync_mode || 'manual',
    sync_interval_minutes: Number(config.sync_interval_minutes || 60),
    tax_mode: config.tax_mode || 'woocommerce',
    category_mode: config.category_mode || 'milo',
    conflict_priority: config.conflict_priority || 'milo',
    order_status_map: config.order_status_map || '{"pending":"pendiente","processing":"procesando","completed":"completado","cancelled":"cancelado","refunded":"reintegrado","failed":"fallido"}',
    last_sync: config.last_sync,
    auto_sync: parseWooBoolean(config.auto_sync, false),
    polling_active: Boolean(options.pollingActive),
    orders_sync_enabled: parseWooBoolean(config.sync_orders, false),
    order_sync_mode: config.order_sync_mode || 'webhook',
    order_sales_channel: config.order_sales_channel || 'woocommerce',
    customer_sync_strategy: config.customer_sync_strategy || 'create_or_link',
    generic_customer_name: config.generic_customer_name || 'Cliente WooCommerce',
    webhook_signature_header: config.webhook_signature_header || 'x-wc-webhook-signature',
    webhook_delivery_header: config.webhook_delivery_header || 'x-wc-webhook-delivery-id',
    order_status_map_effective: orderConfig.statusMap,
    order_stock_statuses: orderConfig.stockStatuses,
    order_paid_statuses: orderConfig.paidStatuses,
    has_consumer_key: Boolean(config.consumer_key),
    has_consumer_secret: Boolean(config.consumer_secret),
    has_wp_username: Boolean(config.wp_username),
    has_wp_app_password: Boolean(config.wp_app_password),
    has_webhook_secret: Boolean(config.webhook_secret || process.env.WOO_WEBHOOK_SECRET),
    has_webhook_auth_token: Boolean(config.webhook_auth_token || process.env.WOO_WEBHOOK_AUTH_TOKEN),
    logs: logs.map((log) => sanitizeWooProductSyncLog(log)),
    orderConfig: {
      enabled: parseWooBoolean(config.sync_orders, false),
      sync_mode: config.order_sync_mode || 'webhook',
      sales_channel: config.order_sales_channel || 'woocommerce',
      customer_sync_strategy: config.customer_sync_strategy || 'create_or_link',
      generic_customer_name: config.generic_customer_name || 'Cliente WooCommerce',
      webhook_secret: config.webhook_secret || '',
      webhook_auth_token: config.webhook_auth_token || '',
      webhook_signature_header: config.webhook_signature_header || 'x-wc-webhook-signature',
      webhook_delivery_header: config.webhook_delivery_header || 'x-wc-webhook-delivery-id'
    },
    logs_summary: {
      processed: logs.length,
      errors: recentErrors.length,
      recent_errors: recentErrors.map((log) => ({
        id: log.id,
        message: log.message,
        synced_at: log.synced_at,
        action: log.action
      }))
    }
  });
}

export {
  parseWooBoolean
};
