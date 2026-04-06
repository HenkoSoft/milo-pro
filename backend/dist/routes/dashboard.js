"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildDashboardStats = buildDashboardStats;
exports.sanitizeDashboardLowStockProduct = sanitizeDashboardLowStockProduct;
exports.sanitizeDashboardReadyRepair = sanitizeDashboardReadyRepair;
exports.buildDashboardAlerts = buildDashboardAlerts;
exports.sanitizeDashboardRecentActivity = sanitizeDashboardRecentActivity;
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
function buildDashboardStats(record) {
    const data = isRecord(record) ? record : {};
    return {
        todaySales: toNumber(data.todaySales),
        todayTransactions: toNumber(data.todayTransactions),
        totalProducts: toNumber(data.totalProducts),
        totalCustomers: toNumber(data.totalCustomers),
        lowStockProducts: toNumber(data.lowStockProducts),
        activeRepairs: toNumber(data.activeRepairs),
        readyForPickup: toNumber(data.readyForPickup)
    };
}
function sanitizeDashboardLowStockProduct(record) {
    const data = isRecord(record) ? record : {};
    return {
        id: toNumber(data.id),
        name: String(data.name || ''),
        sku: toNullableString(data.sku),
        stock: toNumber(data.stock),
        min_stock: toNumber(data.min_stock),
        category_name: toNullableString(data.category_name)
    };
}
function sanitizeDashboardReadyRepair(record) {
    const data = isRecord(record) ? record : {};
    return {
        id: toNumber(data.id),
        customer_name: toNullableString(data.customer_name),
        customer_phone: toNullableString(data.customer_phone),
        brand: toNullableString(data.brand),
        model: toNullableString(data.model),
        created_at: typeof data.created_at === 'string' ? data.created_at : undefined
    };
}
function buildDashboardAlerts(lowStock, readyForPickup) {
    return {
        lowStock: lowStock.map(sanitizeDashboardLowStockProduct),
        readyForPickup: readyForPickup.map(sanitizeDashboardReadyRepair)
    };
}
function sanitizeDashboardRecentActivity(record) {
    const data = isRecord(record) ? record : {};
    return {
        id: toNumber(data.id),
        type: data.type === 'repair' ? 'repair' : 'sale',
        created_at: String(data.created_at || ''),
        customer_name: toNullableString(data.customer_name),
        total: data.total === undefined || data.total === null ? null : toNumber(data.total),
        user_name: toNullableString(data.user_name),
        brand: toNullableString(data.brand),
        model: toNullableString(data.model),
        channel: toNullableString(data.channel)
    };
}
