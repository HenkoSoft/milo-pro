"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.normalizeRepairPayload = normalizeRepairPayload;
exports.sanitizeRepairLog = sanitizeRepairLog;
exports.sanitizeRepair = sanitizeRepair;
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
function normalizeRepairPayload(body) {
    const data = isRecord(body) ? body : {};
    return {
        customer_id: String(data.customer_id || '').trim(),
        device_type: String(data.device_type || '').trim(),
        brand: String(data.brand || ''),
        model: String(data.model || ''),
        serial_number: String(data.serial_number || ''),
        imei: String(data.imei || ''),
        password: String(data.password || ''),
        pattern: String(data.pattern || ''),
        problem_description: String(data.problem_description || '').trim(),
        accessories: String(data.accessories || ''),
        estimated_price: toNumberOrNull(data.estimated_price),
        final_price: toNumberOrNull(data.final_price),
        technician_notes: String(data.technician_notes || '')
    };
}
function sanitizeRepairLog(record) {
    const data = isRecord(record) ? record : {};
    return {
        id: Number(data.id || 0),
        repair_id: Number(data.repair_id || 0),
        status: String(data.status || ''),
        notes: toNullableString(data.notes),
        created_at: String(data.created_at || '')
    };
}
function sanitizeRepair(record, statusLabels, logs = []) {
    const data = isRecord(record) ? record : {};
    const status = String(data.status || 'received');
    return {
        id: Number(data.id || 0),
        ticket_number: String(data.ticket_number || ''),
        customer_id: Number(data.customer_id || 0),
        customer_name: toNullableString(data.customer_name),
        customer_phone: toNullableString(data.customer_phone),
        customer_email: toNullableString(data.customer_email),
        customer_address: toNullableString(data.customer_address),
        device_type: String(data.device_type || ''),
        brand: toNullableString(data.brand),
        model: toNullableString(data.model),
        serial_number: toNullableString(data.serial_number),
        imei: toNullableString(data.imei),
        password: toNullableString(data.password),
        pattern: toNullableString(data.pattern),
        problem_description: String(data.problem_description || ''),
        accessories: toNullableString(data.accessories),
        status,
        status_label: statusLabels[status] || null,
        estimated_price: toNumberOrNull(data.estimated_price),
        final_price: toNumberOrNull(data.final_price),
        technician_notes: toNullableString(data.technician_notes),
        created_at: typeof data.created_at === 'string' ? data.created_at : undefined,
        delivery_date: typeof data.delivery_date === 'string' ? data.delivery_date : null,
        logs
    };
}
