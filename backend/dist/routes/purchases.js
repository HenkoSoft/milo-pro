"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sanitizeSupplier = sanitizeSupplier;
exports.normalizeSupplierPayload = normalizeSupplierPayload;
exports.normalizePurchasePayload = normalizePurchasePayload;
exports.normalizePurchaseItemPayload = normalizePurchaseItemPayload;
exports.normalizeSupplierPaymentPayload = normalizeSupplierPaymentPayload;
exports.normalizeSupplierCreditPayload = normalizeSupplierCreditPayload;
exports.toNullableNumber = toNullableNumber;
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
function toStringNumberOrNull(value) {
    if (value === undefined || value === null || value === '')
        return null;
    if (typeof value === 'string' || typeof value === 'number')
        return value;
    return null;
}
function sanitizeSupplier(record) {
    const data = isRecord(record) ? record : {};
    return {
        id: Number(data.id || 0),
        name: String(data.name || ''),
        phone: toNullableString(data.phone),
        email: toNullableString(data.email),
        address: toNullableString(data.address),
        city: toNullableString(data.city),
        tax_id: toNullableString(data.tax_id),
        notes: toNullableString(data.notes),
        balance: data.balance === undefined ? undefined : toNumber(data.balance),
        total_purchases: data.total_purchases === undefined ? undefined : toNumber(data.total_purchases),
        total_credits: data.total_credits === undefined ? undefined : toNumber(data.total_credits),
        total_payments: data.total_payments === undefined ? undefined : toNumber(data.total_payments)
    };
}
function normalizeSupplierPayload(body) {
    const data = isRecord(body) ? body : {};
    return {
        name: String(data.name || '').trim(),
        phone: String(data.phone || ''),
        email: String(data.email || ''),
        address: String(data.address || ''),
        city: String(data.city || ''),
        tax_id: String(data.tax_id || ''),
        notes: String(data.notes || '')
    };
}
function normalizePurchasePayload(body) {
    const data = isRecord(body) ? body : {};
    return {
        supplier_id: toStringNumberOrNull(data.supplier_id),
        invoice_type: String(data.invoice_type || 'FA').trim() || 'FA',
        invoice_number: String(data.invoice_number || ''),
        invoice_date: String(data.invoice_date || ''),
        items: Array.isArray(data.items) ? data.items.map(normalizePurchaseItemPayload) : [],
        notes: String(data.notes || '')
    };
}
function normalizePurchaseItemPayload(item) {
    const data = isRecord(item) ? item : {};
    return {
        product_id: toStringNumberOrNull(data.product_id),
        product_name: String(data.product_name || ''),
        product_code: String(data.product_code || ''),
        quantity: toNumber(data.quantity),
        unit_cost: toNumber(data.unit_cost)
    };
}
function normalizeSupplierPaymentPayload(body) {
    const data = isRecord(body) ? body : {};
    return {
        supplier_id: String(data.supplier_id || '').trim(),
        amount: toNumber(data.amount),
        payment_method: String(data.payment_method || 'cash').trim() || 'cash',
        reference: String(data.reference || ''),
        notes: String(data.notes || '')
    };
}
function normalizeSupplierCreditPayload(body) {
    const data = isRecord(body) ? body : {};
    return {
        supplier_id: toStringNumberOrNull(data.supplier_id),
        credit_note_number: String(data.credit_note_number || ''),
        reference_invoice: String(data.reference_invoice || ''),
        invoice_date: String(data.invoice_date || ''),
        items: Array.isArray(data.items)
            ? data.items.map((item) => {
                const row = isRecord(item) ? item : {};
                return {
                    product_id: toStringNumberOrNull(row.product_id),
                    product_name: String(row.product_name || ''),
                    product_code: String(row.product_code || ''),
                    quantity: toNumber(row.quantity),
                    unit_price: toNumber(row.unit_price)
                };
            })
            : [],
        notes: String(data.notes || ''),
        update_stock: Boolean(data.update_stock),
        update_cash: Boolean(data.update_cash)
    };
}
function toNullableNumber(value) {
    return toNumberOrNull(value);
}
