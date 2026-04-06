"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.normalizeCustomerPayload = normalizeCustomerPayload;
exports.buildCustomerInsertParams = buildCustomerInsertParams;
exports.sanitizeCustomer = sanitizeCustomer;
exports.sanitizeCustomerRelatedSale = sanitizeCustomerRelatedSale;
exports.sanitizeCustomerRelatedRepair = sanitizeCustomerRelatedRepair;
exports.buildCustomerDetail = buildCustomerDetail;
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
function normalizeCustomerPayload(body) {
    const data = isRecord(body) ? body : {};
    return {
        name: String(data.name || '').trim(),
        phone: String(data.phone || ''),
        email: String(data.email || ''),
        address: String(data.address || ''),
        contact: String(data.contact || ''),
        city: String(data.city || ''),
        province: String(data.province || ''),
        country: String(data.country || ''),
        tax_id: String(data.tax_id || ''),
        iva_condition: String(data.iva_condition || 'Consumidor Final').trim() || 'Consumidor Final',
        instagram: String(data.instagram || ''),
        transport: String(data.transport || ''),
        credit_limit: String(data.credit_limit || ''),
        zone: String(data.zone || ''),
        discount_percent: String(data.discount_percent || ''),
        seller: String(data.seller || ''),
        price_list: String(data.price_list || '1').trim() || '1',
        billing_conditions: String(data.billing_conditions || ''),
        notes: String(data.notes || '')
    };
}
function buildCustomerInsertParams(payload) {
    return [
        payload.name,
        toNullableString(payload.phone),
        toNullableString(payload.email),
        toNullableString(payload.address),
        toNullableString(payload.contact),
        toNullableString(payload.city),
        toNullableString(payload.province),
        toNullableString(payload.country),
        toNullableString(payload.tax_id),
        toNullableString(payload.iva_condition) || 'Consumidor Final',
        toNullableString(payload.instagram),
        toNullableString(payload.transport),
        toNumberOrNull(payload.credit_limit),
        toNullableString(payload.zone),
        toNumberOrNull(payload.discount_percent),
        toNullableString(payload.seller),
        toNullableString(payload.price_list) || '1',
        toNullableString(payload.billing_conditions),
        toNullableString(payload.notes)
    ];
}
function sanitizeCustomer(record) {
    const data = isRecord(record) ? record : {};
    return {
        id: Number(data.id || 0),
        name: String(data.name || ''),
        phone: toNullableString(data.phone),
        email: toNullableString(data.email),
        address: toNullableString(data.address),
        contact: toNullableString(data.contact),
        city: toNullableString(data.city),
        province: toNullableString(data.province),
        country: toNullableString(data.country),
        tax_id: toNullableString(data.tax_id),
        iva_condition: toNullableString(data.iva_condition),
        instagram: toNullableString(data.instagram),
        transport: toNullableString(data.transport),
        credit_limit: toNumberOrNull(data.credit_limit),
        zone: toNullableString(data.zone),
        discount_percent: toNumberOrNull(data.discount_percent),
        seller: toNullableString(data.seller),
        price_list: toNullableString(data.price_list),
        billing_conditions: toNullableString(data.billing_conditions),
        notes: toNullableString(data.notes),
        created_at: typeof data.created_at === 'string' ? data.created_at : undefined
    };
}
function sanitizeCustomerRelatedSale(record) {
    const data = isRecord(record) ? record : {};
    return {
        id: Number(data.id || 0),
        total: toNumberOrNull(data.total),
        created_at: typeof data.created_at === 'string' ? data.created_at : undefined,
        user_name: toNullableString(data.user_name)
    };
}
function sanitizeCustomerRelatedRepair(record) {
    const data = isRecord(record) ? record : {};
    return {
        id: Number(data.id || 0),
        ticket_number: toNullableString(data.ticket_number),
        status: toNullableString(data.status),
        created_at: typeof data.created_at === 'string' ? data.created_at : undefined
    };
}
function buildCustomerDetail(customer, sales, repairs) {
    return {
        ...sanitizeCustomer(customer),
        sales: sales.map(sanitizeCustomerRelatedSale),
        repairs: repairs.map(sanitizeCustomerRelatedRepair)
    };
}
