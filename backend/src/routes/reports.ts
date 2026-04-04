import type {
  RepairsReportSummaryDto,
  RevenueReportDto,
  RevenueReportPointDto,
  SalesReportSummaryDto
} from '@shared/types/reports';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function toNumber(value: unknown, fallback = 0): number {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
}

export function buildSalesReportSummary(record: unknown): SalesReportSummaryDto {
  const data = isRecord(record) ? record : {};
  return {
    totalRevenue: toNumber(data.totalRevenue),
    totalTransactions: toNumber(data.totalTransactions),
    averageSale: toNumber(data.averageSale)
  };
}

export function buildRepairsReportSummary(record: unknown): RepairsReportSummaryDto {
  const data = isRecord(record) ? record : {};
  return {
    totalRepairs: toNumber(data.totalRepairs),
    totalRevenue: toNumber(data.totalRevenue),
    averagePrice: toNumber(data.averagePrice)
  };
}

export function sanitizeRevenuePoint(record: unknown): RevenueReportPointDto {
  const data = isRecord(record) ? record : {};
  return {
    date: String(data.date || ''),
    revenue: toNumber(data.revenue),
    count: toNumber(data.count)
  };
}

export function buildRevenueReport(record: {
  salesRevenue: unknown;
  salesCount: unknown;
  repairsRevenue: unknown;
  repairsCount: unknown;
  totalRevenue: unknown;
  dailySales: unknown[];
}): RevenueReportDto {
  return {
    salesRevenue: toNumber(record.salesRevenue),
    salesCount: toNumber(record.salesCount),
    repairsRevenue: toNumber(record.repairsRevenue),
    repairsCount: toNumber(record.repairsCount),
    totalRevenue: toNumber(record.totalRevenue),
    dailySales: (record.dailySales || []).map(sanitizeRevenuePoint)
  };
}
