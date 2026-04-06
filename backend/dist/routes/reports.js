"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildSalesReportSummary = buildSalesReportSummary;
exports.buildRepairsReportSummary = buildRepairsReportSummary;
exports.sanitizeRevenuePoint = sanitizeRevenuePoint;
exports.buildRevenueReport = buildRevenueReport;
function isRecord(value) {
    return typeof value === 'object' && value !== null;
}
function toNumber(value, fallback = 0) {
    const num = Number(value);
    return Number.isFinite(num) ? num : fallback;
}
function buildSalesReportSummary(record) {
    const data = isRecord(record) ? record : {};
    return {
        totalRevenue: toNumber(data.totalRevenue),
        totalTransactions: toNumber(data.totalTransactions),
        averageSale: toNumber(data.averageSale)
    };
}
function buildRepairsReportSummary(record) {
    const data = isRecord(record) ? record : {};
    return {
        totalRepairs: toNumber(data.totalRepairs),
        totalRevenue: toNumber(data.totalRevenue),
        averagePrice: toNumber(data.averagePrice)
    };
}
function sanitizeRevenuePoint(record) {
    const data = isRecord(record) ? record : {};
    return {
        date: String(data.date || ''),
        revenue: toNumber(data.revenue),
        count: toNumber(data.count)
    };
}
function buildRevenueReport(record) {
    return {
        salesRevenue: toNumber(record.salesRevenue),
        salesCount: toNumber(record.salesCount),
        repairsRevenue: toNumber(record.repairsRevenue),
        repairsCount: toNumber(record.repairsCount),
        totalRevenue: toNumber(record.totalRevenue),
        dailySales: (record.dailySales || []).map(sanitizeRevenuePoint)
    };
}
