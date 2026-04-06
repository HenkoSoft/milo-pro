"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sanitizeProduct = sanitizeProduct;
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
function toNumberOrNull(value) {
    if (value === undefined || value === null || value === '')
        return null;
    const num = Number(value);
    return Number.isFinite(num) ? num : null;
}
function sanitizeProduct(record) {
    const data = isRecord(record) ? record : {};
    return {
        id: Number(data.id || 0),
        sku: toNullableString(data.sku),
        barcode: toNullableString(data.barcode),
        name: String(data.name || ''),
        description: toNullableString(data.description),
        short_description: toNullableString(data.short_description),
        color: toNullableString(data.color),
        category_id: toNumberOrNull(data.category_id),
        category_primary_id: toNumberOrNull(data.category_primary_id),
        brand_id: toNumberOrNull(data.brand_id),
        supplier: toNullableString(data.supplier),
        purchase_price: toNumber(data.purchase_price),
        sale_price: toNumber(data.sale_price),
        stock: toNumber(data.stock),
        min_stock: toNumber(data.min_stock, 2),
        image_url: toNullableString(data.image_url),
        sync_status: toNullableString(data.sync_status),
        active: toNumber(data.active, 1)
    };
}
