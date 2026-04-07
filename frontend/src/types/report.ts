import type { Customer } from './customer';
import type { Purchase } from './purchase';
import type { Sale } from './sale';

export interface SalesReportSummary {
  totalRevenue: number;
  totalTransactions: number;
  averageSale: number;
}

export interface SalesReportResponse {
  sales: Sale[];
  summary: SalesReportSummary;
}

export interface RepairsReportBucket {
  status?: string;
  device_type?: string;
  count: number;
  totalRevenue: number;
}

export interface RepairsReportResponse {
  byStatus: RepairsReportBucket[];
  byDeviceType: RepairsReportBucket[];
  summary: {
    totalRepairs: number;
    totalRevenue: number;
    averagePrice: number;
  };
}

export interface ProductTopSellingItem {
  id: number;
  name: string;
  sku?: string | null;
  stock: number;
  sale_price: number;
  totalSold: number;
  totalRevenue: number;
}

export interface ProductLowStockItem {
  id: number;
  name?: string;
  sku?: string | null;
  category_name?: string | null;
  stock: number;
  min_stock: number;
  sale_price: number;
}

export interface ProductByCategoryItem {
  category: string;
  productCount: number;
  totalStock: number;
  totalValue: number;
}

export interface ProductsReportResponse {
  topSelling: ProductTopSellingItem[];
  lowStock: ProductLowStockItem[];
  byCategory: ProductByCategoryItem[];
}

export interface RevenuePoint {
  date: string;
  revenue: number;
  count: number;
}

export interface RevenueReportResponse {
  salesRevenue: number;
  salesCount: number;
  repairsRevenue: number;
  repairsCount: number;
  totalRevenue: number;
  dailySales: RevenuePoint[];
}

export interface CustomerSalesSummaryRow extends Customer {
  salesCount: number;
  totalSpent: number;
}

export interface PurchasesSummaryRow extends Purchase {
  supplier_name?: string | null;
}
