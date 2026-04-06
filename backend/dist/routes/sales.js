"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.normalizeSaleItemPayload = normalizeSaleItemPayload;
exports.normalizeSalePayload = normalizeSalePayload;
exports.normalizeSaleStatusUpdatePayload = normalizeSaleStatusUpdatePayload;
exports.sanitizeSaleItem = sanitizeSaleItem;
exports.sanitizeSale = sanitizeSale;
function isRecord(value) {
    return typeof value === 'object' && value !== null;
}
function toNullableString(value) {
    if (value === undefined || value === null || value === '')
        return null;
    return String(value).trim();
}
function toNumber(value, fallback = 0) {
    const num = Number(value);
    return Number.isFinite(num) ? num : fallback;
}
function toStringNumberOrNull(value) {
    if (value === undefined || value === null || value === '')
        return null;
    if (typeof value === 'string' || typeof value === 'number')
        return value;
    return null;
}
function normalizeSaleItemPayload(item) {
    const data = isRecord(item) ? item : {};
    return {
        product_id: toStringNumberOrNull(data.product_id) ?? '',
        quantity: toNumber(data.quantity),
        unit_price: toNumber(data.unit_price)
    };
}
function normalizeSalePayload(body) {
    const data = isRecord(body) ? body : {};
    return {
        customer_id: toStringNumberOrNull(data.customer_id),
        payment_method: String(data.payment_method || 'cash').trim() || 'cash',
        notes: String(data.notes || ''),
        receipt_type: String(data.receipt_type || 'C').trim() || 'C',
        point_of_sale: String(data.point_of_sale || '001').trim() || '001',
        items: Array.isArray(data.items) ? data.items.map(normalizeSaleItemPayload) : []
    };
}
function normalizeSaleStatusUpdatePayload(body) {
    const data = isRecord(body) ? body : {};
    return {
        status: String(data.status || '').trim(),
        note: String(data.note || ''),
        sync_to_woo: data.sync_to_woo === false ? false : true
    };
}
function sanitizeSaleItem(record) {
    const data = isRecord(record) ? record : {};
    return {
        id: data.id === undefined ? undefined : toNumber(data.id),
        sale_id: data.sale_id === undefined ? undefined : toNumber(data.sale_id),
        product_id: toNumber(data.product_id),
        product_name: toNullableString(data.product_name),
        sku: toNullableString(data.sku),
        quantity: toNumber(data.quantity),
        unit_price: toNumber(data.unit_price),
        subtotal: data.subtotal === undefined ? undefined : toNumber(data.subtotal)
    };
}
function sanitizeSale(record, items = []) {
    const data = isRecord(record) ? record : {};
    return {
        id: toNumber(data.id),
        customer_id: data.customer_id === undefined || data.customer_id === null ? null : toNumber(data.customer_id),
        customer_name: toNullableString(data.customer_name),
        customer_phone: toNullableString(data.customer_phone),
        user_name: toNullableString(data.user_name),
        receipt_type: toNullableString(data.receipt_type),
        point_of_sale: toNullableString(data.point_of_sale),
        receipt_number: data.receipt_number === undefined || data.receipt_number === null ? null : toNumber(data.receipt_number),
        total: toNumber(data.total),
        payment_method: toNullableString(data.payment_method),
        notes: toNullableString(data.notes),
        channel: toNullableString(data.channel),
        status: toNullableString(data.status),
        payment_status: toNullableString(data.payment_status),
        external_status: toNullableString(data.external_status),
        created_at: typeof data.created_at === 'string' ? data.created_at : undefined,
        items
    };
}
