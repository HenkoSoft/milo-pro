"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.normalizeWooConnectionTestPayload = normalizeWooConnectionTestPayload;
exports.normalizeWooConfigPayload = normalizeWooConfigPayload;
exports.normalizeWooOrderImportPayload = normalizeWooOrderImportPayload;
exports.normalizeWooLogsLimit = normalizeWooLogsLimit;
exports.sanitizeWooStatusResponse = sanitizeWooStatusResponse;
exports.sanitizeWooPollingResult = sanitizeWooPollingResult;
exports.sanitizeWooPollingStatus = sanitizeWooPollingStatus;
exports.sanitizeWooProductSyncLog = sanitizeWooProductSyncLog;
exports.sanitizeWooOrderSyncLog = sanitizeWooOrderSyncLog;
function isRecord(value) {
    return typeof value === 'object' && value !== null;
}
function toNullableString(value) {
    if (value === undefined || value === null || value === '')
        return null;
    return String(value).trim();
}
function toRequiredString(value, fallback = '') {
    return String(value ?? fallback).trim() || fallback;
}
function toBoolean(value, fallback = false) {
    if (value === undefined || value === null || value === '')
        return fallback;
    if (typeof value === 'boolean')
        return value;
    if (typeof value === 'number')
        return value > 0;
    const normalized = String(value).trim().toLowerCase();
    return ['1', 'true', 'on', 'yes', 'si'].includes(normalized);
}
function toNumber(value, fallback = 0) {
    const num = Number(value);
    return Number.isFinite(num) ? num : fallback;
}
function toJsonString(value, fallback) {
    if (typeof value === 'string' && value.trim())
        return value;
    try {
        return JSON.stringify(value ?? fallback);
    }
    catch {
        return JSON.stringify(fallback);
    }
}
function preserveSecret(input, fallback = '') {
    const nextValue = toNullableString(input);
    return nextValue || fallback;
}
function normalizeWooConnectionTestPayload(body) {
    const data = isRecord(body) ? body : {};
    return {
        store_url: toRequiredString(data.store_url),
        consumer_key: toRequiredString(data.consumer_key),
        consumer_secret: toRequiredString(data.consumer_secret),
        api_version: toRequiredString(data.api_version, 'wc/v3'),
        wp_username: toRequiredString(data.wp_username),
        wp_app_password: toRequiredString(data.wp_app_password)
    };
}
function normalizeWooConfigPayload(body, existing) {
    const data = isRecord(body) ? body : {};
    const current = isRecord(existing) ? existing : {};
    return {
        store_url: toRequiredString(data.store_url, toRequiredString(current.store_url)),
        consumer_key: preserveSecret(data.consumer_key, toRequiredString(current.consumer_key)),
        consumer_secret: preserveSecret(data.consumer_secret, toRequiredString(current.consumer_secret)),
        wp_username: preserveSecret(data.wp_username, toRequiredString(current.wp_username)),
        wp_app_password: preserveSecret(data.wp_app_password, toRequiredString(current.wp_app_password)),
        api_version: toRequiredString(data.api_version, toRequiredString(current.api_version, 'wc/v3')),
        sync_direction: toRequiredString(data.sync_direction, toRequiredString(current.sync_direction, 'export')),
        sync_products: toBoolean(data.sync_products, toBoolean(current.sync_products, true)) ? 1 : 0,
        sync_customers: toBoolean(data.sync_customers, toBoolean(current.sync_customers, false)) ? 1 : 0,
        sync_orders: toBoolean(data.sync_orders, toBoolean(current.sync_orders, false)) ? 1 : 0,
        sync_stock: toBoolean(data.sync_stock, toBoolean(current.sync_stock, true)) ? 1 : 0,
        sync_prices: toBoolean(data.sync_prices, toBoolean(current.sync_prices, true)) ? 1 : 0,
        sync_mode: toRequiredString(data.sync_mode, toRequiredString(current.sync_mode, 'manual')),
        sync_interval_minutes: Math.max(1, toNumber(data.sync_interval_minutes, toNumber(current.sync_interval_minutes, 60))),
        auto_sync: toBoolean(data.auto_sync, toBoolean(current.auto_sync, false)) ? 1 : 0,
        tax_mode: toRequiredString(data.tax_mode, toRequiredString(current.tax_mode, 'woocommerce')),
        category_mode: toRequiredString(data.category_mode, toRequiredString(current.category_mode, 'milo')),
        conflict_priority: toRequiredString(data.conflict_priority, toRequiredString(current.conflict_priority, 'milo')),
        order_status_map: toJsonString(data.order_status_map, {
            pending: 'pendiente',
            processing: 'procesando',
            completed: 'completado',
            cancelled: 'cancelado',
            refunded: 'reintegrado',
            failed: 'fallido'
        }),
        order_stock_statuses: toJsonString(data.order_stock_statuses, ['paid', 'completed']),
        order_paid_statuses: toJsonString(data.order_paid_statuses, ['paid', 'completed']),
        order_sync_mode: toRequiredString(data.order_sync_mode, toRequiredString(current.order_sync_mode, 'webhook')),
        order_sales_channel: toRequiredString(data.order_sales_channel, toRequiredString(current.order_sales_channel, 'woocommerce')),
        customer_sync_strategy: toRequiredString(data.customer_sync_strategy, toRequiredString(current.customer_sync_strategy, 'create_or_link')),
        generic_customer_name: toRequiredString(data.generic_customer_name, toRequiredString(current.generic_customer_name, 'Cliente WooCommerce')),
        webhook_secret: preserveSecret(data.webhook_secret, toRequiredString(current.webhook_secret)),
        webhook_auth_token: preserveSecret(data.webhook_auth_token, toRequiredString(current.webhook_auth_token)),
        webhook_signature_header: toRequiredString(data.webhook_signature_header, toRequiredString(current.webhook_signature_header, 'x-wc-webhook-signature')),
        webhook_delivery_header: toRequiredString(data.webhook_delivery_header, toRequiredString(current.webhook_delivery_header, 'x-wc-webhook-delivery-id'))
    };
}
function normalizeWooOrderImportPayload(body) {
    const data = isRecord(body) ? body : {};
    const rawStatus = data.status;
    let status;
    if (Array.isArray(rawStatus)) {
        const next = rawStatus.map((item) => String(item || '').trim()).filter(Boolean);
        status = next.length > 0 ? next : undefined;
    }
    else if (typeof rawStatus === 'string') {
        const parts = rawStatus.split(',').map((item) => item.trim()).filter(Boolean);
        status = parts.length <= 1 ? parts[0] : parts;
    }
    return {
        after: toNullableString(data.after) || undefined,
        before: toNullableString(data.before) || undefined,
        status,
        per_page: Math.min(Math.max(toNumber(data.per_page, 25), 1), 100)
    };
}
function normalizeWooLogsLimit(value) {
    return Math.min(Math.max(toNumber(value, 100), 1), 500);
}
function sanitizeWooStatusResponse(record) {
    const data = isRecord(record) ? record : {};
    const logsSummary = isRecord(data.logs_summary) ? data.logs_summary : {};
    const recentErrors = Array.isArray(logsSummary.recent_errors) ? logsSummary.recent_errors : [];
    return {
        connected: toBoolean(data.connected, false),
        message: toNullableString(data.message) || undefined,
        store_url: toNullableString(data.store_url) || undefined,
        api_version: toNullableString(data.api_version) || undefined,
        sync_direction: toNullableString(data.sync_direction) || undefined,
        sync_products: data.sync_products === undefined ? undefined : toBoolean(data.sync_products, true),
        sync_customers: data.sync_customers === undefined ? undefined : toBoolean(data.sync_customers, false),
        sync_orders: data.sync_orders === undefined ? undefined : toBoolean(data.sync_orders, false),
        sync_stock: data.sync_stock === undefined ? undefined : toBoolean(data.sync_stock, true),
        sync_prices: data.sync_prices === undefined ? undefined : toBoolean(data.sync_prices, true),
        sync_mode: toNullableString(data.sync_mode) || undefined,
        sync_interval_minutes: data.sync_interval_minutes === undefined ? undefined : toNumber(data.sync_interval_minutes, 60),
        tax_mode: toNullableString(data.tax_mode) || undefined,
        category_mode: toNullableString(data.category_mode) || undefined,
        conflict_priority: toNullableString(data.conflict_priority) || undefined,
        order_status_map: toNullableString(data.order_status_map) || undefined,
        last_sync: toNullableString(data.last_sync),
        auto_sync: data.auto_sync === undefined ? undefined : toBoolean(data.auto_sync, false),
        polling_active: data.polling_active === undefined ? undefined : toBoolean(data.polling_active, false),
        orders_sync_enabled: data.orders_sync_enabled === undefined ? undefined : toBoolean(data.orders_sync_enabled, false),
        order_sync_mode: toNullableString(data.order_sync_mode) || undefined,
        order_sales_channel: toNullableString(data.order_sales_channel) || undefined,
        customer_sync_strategy: toNullableString(data.customer_sync_strategy) || undefined,
        generic_customer_name: toNullableString(data.generic_customer_name) || undefined,
        webhook_signature_header: toNullableString(data.webhook_signature_header) || undefined,
        webhook_delivery_header: toNullableString(data.webhook_delivery_header) || undefined,
        order_status_map_effective: isRecord(data.order_status_map_effective)
            ? Object.fromEntries(Object.entries(data.order_status_map_effective).map(([key, value]) => [String(key), String(value)]))
            : undefined,
        order_stock_statuses: Array.isArray(data.order_stock_statuses)
            ? data.order_stock_statuses.map((item) => String(item || '').trim()).filter(Boolean)
            : undefined,
        order_paid_statuses: Array.isArray(data.order_paid_statuses)
            ? data.order_paid_statuses.map((item) => String(item || '').trim()).filter(Boolean)
            : undefined,
        has_consumer_key: data.has_consumer_key === undefined ? undefined : toBoolean(data.has_consumer_key, false),
        has_consumer_secret: data.has_consumer_secret === undefined ? undefined : toBoolean(data.has_consumer_secret, false),
        has_wp_username: data.has_wp_username === undefined ? undefined : toBoolean(data.has_wp_username, false),
        has_wp_app_password: data.has_wp_app_password === undefined ? undefined : toBoolean(data.has_wp_app_password, false),
        has_webhook_secret: data.has_webhook_secret === undefined ? undefined : toBoolean(data.has_webhook_secret, false),
        has_webhook_auth_token: data.has_webhook_auth_token === undefined ? undefined : toBoolean(data.has_webhook_auth_token, false),
        logs_summary: {
            processed: toNumber(logsSummary.processed),
            errors: toNumber(logsSummary.errors),
            recent_errors: recentErrors.map((item) => {
                const row = isRecord(item) ? item : {};
                return {
                    id: toNumber(row.id),
                    message: toNullableString(row.message),
                    synced_at: toNullableString(row.synced_at),
                    action: toNullableString(row.action)
                };
            })
        }
    };
}
function sanitizeWooPollingResult(record) {
    const data = isRecord(record) ? record : {};
    return {
        success: toBoolean(data.success, false),
        error: toNullableString(data.error) || undefined,
        alreadyRunning: data.alreadyRunning === undefined ? undefined : toBoolean(data.alreadyRunning, false),
        interval_seconds: data.interval_seconds === undefined ? undefined : toNumber(data.interval_seconds),
        message: toNullableString(data.message) || undefined
    };
}
function sanitizeWooPollingStatus(record) {
    const data = isRecord(record) ? record : {};
    return {
        active: toBoolean(data.active, false),
        interval_seconds: toNumber(data.interval_seconds)
    };
}
function sanitizeWooProductSyncLog(record) {
    const data = isRecord(record) ? record : {};
    return {
        id: toNumber(data.id),
        milo_id: data.milo_id === undefined || data.milo_id === null ? null : toNumber(data.milo_id),
        woocommerce_id: data.woocommerce_id === undefined || data.woocommerce_id === null ? null : toNumber(data.woocommerce_id),
        action: toNullableString(data.action),
        status: toNullableString(data.status),
        message: toNullableString(data.message),
        synced_at: toNullableString(data.synced_at)
    };
}
function sanitizeWooOrderSyncLog(record) {
    const data = isRecord(record) ? record : {};
    return {
        id: toNumber(data.id),
        origin: toNullableString(data.origin),
        entity_type: toNullableString(data.entity_type),
        entity_id: toNullableString(data.entity_id),
        external_id: toNullableString(data.external_id),
        event_type: toNullableString(data.event_type),
        delivery_id: toNullableString(data.delivery_id),
        status: toNullableString(data.status),
        message: toNullableString(data.message),
        error: toNullableString(data.error),
        created_at: toNullableString(data.created_at)
    };
}
