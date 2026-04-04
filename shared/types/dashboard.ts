export interface DashboardStatsDto {
  todaySales: number;
  todayTransactions: number;
  totalProducts: number;
  totalCustomers: number;
  lowStockProducts: number;
  activeRepairs: number;
  readyForPickup: number;
}

export interface DashboardLowStockProductDto {
  id: number;
  name: string;
  sku?: string | null;
  stock: number;
  min_stock: number;
  category_name?: string | null;
}

export interface DashboardReadyRepairDto {
  id: number;
  customer_name?: string | null;
  customer_phone?: string | null;
  brand?: string | null;
  model?: string | null;
  created_at?: string;
}

export interface DashboardAlertsDto {
  lowStock: DashboardLowStockProductDto[];
  readyForPickup: DashboardReadyRepairDto[];
}

export interface DashboardRecentActivityDto {
  id: number;
  type: 'sale' | 'repair';
  created_at: string;
  customer_name?: string | null;
  total?: number | null;
  user_name?: string | null;
  brand?: string | null;
  model?: string | null;
  channel?: string | null;
}
