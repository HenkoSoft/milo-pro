import { apiRequest } from './client';
import type {
  ProductsReportResponse,
  RepairsReportResponse,
  RevenueReportResponse,
  SalesReportResponse
} from '../types/report';

function buildDateQuery(params: { startDate?: string; endDate?: string } = {}) {
  const searchParams = new URLSearchParams();
  if (params.startDate?.trim()) searchParams.set('startDate', params.startDate.trim());
  if (params.endDate?.trim()) searchParams.set('endDate', params.endDate.trim());
  const query = searchParams.toString();
  return query ? `?${query}` : '';
}

export function getSalesReport(params: { startDate?: string; endDate?: string } = {}) {
  return apiRequest<SalesReportResponse>(`/reports/sales${buildDateQuery(params)}`);
}

export function getRepairsReport() {
  return apiRequest<RepairsReportResponse>('/reports/repairs');
}

export function getProductsReport() {
  return apiRequest<ProductsReportResponse>('/reports/products');
}

export function getRevenueReport(period = 'month') {
  return apiRequest<RevenueReportResponse>(`/reports/revenue?period=${encodeURIComponent(period)}`);
}
