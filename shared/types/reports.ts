export interface SalesReportSummaryDto {
  totalRevenue: number;
  totalTransactions: number;
  averageSale: number;
}

export interface RepairsReportSummaryDto {
  totalRepairs: number;
  totalRevenue: number;
  averagePrice: number;
}

export interface RevenueReportPointDto {
  date: string;
  revenue: number;
  count: number;
}

export interface RevenueReportDto {
  salesRevenue: number;
  salesCount: number;
  repairsRevenue: number;
  repairsCount: number;
  totalRevenue: number;
  dailySales: RevenueReportPointDto[];
}
