import type {
  DashboardAlertsDto,
  DashboardLowStockProductDto,
  DashboardReadyRepairDto,
  DashboardRecentActivityDto,
  DashboardStatsDto
} from '@shared/types/dashboard';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function toNullableString(value: unknown): string | null {
  if (value === undefined || value === null || value === '') return null;
  return String(value).trim();
}

function toNumber(value: unknown, fallback = 0): number {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
}

export function buildDashboardStats(record: unknown): DashboardStatsDto {
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

export function sanitizeDashboardLowStockProduct(record: unknown): DashboardLowStockProductDto {
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

export function sanitizeDashboardReadyRepair(record: unknown): DashboardReadyRepairDto {
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

export function buildDashboardAlerts(lowStock: unknown[], readyForPickup: unknown[]): DashboardAlertsDto {
  return {
    lowStock: lowStock.map(sanitizeDashboardLowStockProduct),
    readyForPickup: readyForPickup.map(sanitizeDashboardReadyRepair)
  };
}

export function sanitizeDashboardRecentActivity(record: unknown): DashboardRecentActivityDto {
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
