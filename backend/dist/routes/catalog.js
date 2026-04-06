"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.normalizeCategoryPayload = normalizeCategoryPayload;
exports.sanitizeCategory = sanitizeCategory;
exports.sanitizeBrand = sanitizeBrand;
exports.sanitizeDeviceType = sanitizeDeviceType;
exports.sanitizeDeviceModel = sanitizeDeviceModel;
exports.buildBrandPayload = buildBrandPayload;
exports.buildDeviceTypePayload = buildDeviceTypePayload;
exports.buildDeviceModelPayload = buildDeviceModelPayload;
function isRecord(value) {
    return typeof value === 'object' && value !== null;
}
function toNullableString(value) {
    if (value === undefined || value === null || value === '')
        return null;
    return String(value).trim();
}
function toNumberOrNull(value) {
    if (value === undefined || value === null || value === '')
        return null;
    const num = Number(value);
    return Number.isFinite(num) ? num : null;
}
function toActiveFlag(value) {
    return value === false || value === 0 ? 0 : 1;
}
function normalizeCategoryPayload(body) {
    const data = isRecord(body) ? body : {};
    return {
        name: String(data.name || '').trim(),
        slug: String(data.slug || '').trim(),
        description: String(data.description || ''),
        parent_id: toNumberOrNull(data.parent_id),
        woocommerce_category_id: toNumberOrNull(data.woocommerce_category_id),
        active: data.active === false || data.active === 0 ? 0 : 1
    };
}
function sanitizeCategory(record) {
    const data = isRecord(record) ? record : {};
    return {
        id: Number(data.id || 0),
        name: String(data.name || ''),
        slug: toNullableString(data.slug),
        description: toNullableString(data.description),
        parent_id: toNumberOrNull(data.parent_id),
        woocommerce_category_id: toNumberOrNull(data.woocommerce_category_id),
        active: Number(data.active ?? 1),
        full_name: toNullableString(data.full_name),
        depth: toNumberOrNull(data.depth) ?? 0,
        product_count: toNumberOrNull(data.product_count) ?? 0
    };
}
function sanitizeBrand(record) {
    const data = isRecord(record) ? record : {};
    return {
        id: Number(data.id || 0),
        name: String(data.name || ''),
        slug: toNullableString(data.slug),
        active: Number(data.active ?? 1),
        woocommerce_brand_id: toNumberOrNull(data.woocommerce_brand_id)
    };
}
function sanitizeDeviceType(record) {
    const data = isRecord(record) ? record : {};
    return {
        id: Number(data.id || 0),
        name: String(data.name || ''),
        active: Number(data.active ?? 1)
    };
}
function sanitizeDeviceModel(record) {
    const data = isRecord(record) ? record : {};
    return {
        id: Number(data.id || 0),
        name: String(data.name || ''),
        brand_id: toNumberOrNull(data.brand_id),
        active: Number(data.active ?? 1)
    };
}
function buildBrandPayload(body) {
    const data = isRecord(body) ? body : {};
    const name = String(data.name || '').trim();
    return {
        name,
        slug: String(data.slug || name).trim().toLowerCase().replace(/[^a-z0-9]+/g, '-'),
        active: toActiveFlag(data.active),
        woocommerce_brand_id: toNumberOrNull(data.woocommerce_brand_id)
    };
}
function buildDeviceTypePayload(body) {
    const data = isRecord(body) ? body : {};
    return {
        name: String(data.name || '').trim()
    };
}
function buildDeviceModelPayload(body) {
    const data = isRecord(body) ? body : {};
    return {
        name: String(data.name || '').trim(),
        brand_id: toNumberOrNull(data.brand_id)
    };
}
