export interface DashboardStats {
  todaySales: number;
  todayTransactions: number;
  totalProducts: number;
  totalCustomers: number;
  lowStockProducts: number;
  activeRepairs: number;
  readyForPickup: number;
}

export interface DashboardLowStockProduct {
  id: number;
  name: string;
  sku: string | null;
  stock: number;
  min_stock: number;
  category_name?: string | null;
}

export interface DashboardReadyRepair {
  id: number;
  customer_name?: string | null;
  customer_phone?: string | null;
  brand?: string | null;
  model?: string | null;
}

export interface DashboardAlerts {
  lowStock: DashboardLowStockProduct[];
  readyForPickup: DashboardReadyRepair[];
}

export interface DashboardActivityItem {
  id: number;
  type: 'sale' | 'repair';
  created_at: string;
  customer_name?: string | null;
  total?: number;
  channel?: string | null;
  brand?: string | null;
  model?: string | null;
}

export interface OnlineSaleFeedItem {
  id: number;
  customer_name?: string | null;
  total?: number;
  status?: string | null;
  created_at?: string;
  channel?: string | null;
}

export interface DashboardOverview {
  stats: DashboardStats;
  alerts: DashboardAlerts;
  recentActivity: DashboardActivityItem[];
  onlineFeed: OnlineSaleFeedItem[];
}
