import { apiRequest } from './client';
import type {
  CreateSaleResponse,
  ReceiptNumberResponse,
  Sale,
  SalePayload,
  SaleStatusUpdatePayload,
  TodaySalesResponse
} from '../types/sale';

function buildSalesQuery(params: { startDate?: string; endDate?: string; customerId?: string } = {}) {
  const searchParams = new URLSearchParams();
  if (params.startDate?.trim()) searchParams.set('startDate', params.startDate.trim());
  if (params.endDate?.trim()) searchParams.set('endDate', params.endDate.trim());
  if (params.customerId?.trim()) searchParams.set('customerId', params.customerId.trim());
  const query = searchParams.toString();
  return query ? `?${query}` : '';
}

export function getSales(params: { startDate?: string; endDate?: string; customerId?: string } = {}) {
  return apiRequest<Sale[]>(`/sales${buildSalesQuery(params)}`);
}

export function getSaleById(id: number) {
  return apiRequest<Sale>(`/sales/${id}`);
}

export function getTodaySales() {
  return apiRequest<TodaySalesResponse>('/sales/today');
}

export function getOnlineFeed() {
  return apiRequest<Sale[]>('/sales/online-feed');
}

export function getNextReceiptNumber(params: { receiptType: string; pointOfSale: string }) {
  const query = new URLSearchParams({
    receiptType: params.receiptType,
    pointOfSale: params.pointOfSale
  }).toString();
  return apiRequest<ReceiptNumberResponse>(`/sales/next-number?${query}`);
}

export function createSale(payload: SalePayload) {
  return apiRequest<CreateSaleResponse>('/sales', {
    method: 'POST',
    body: JSON.stringify(payload)
  });
}

export function updateSaleStatus(id: number, payload: SaleStatusUpdatePayload) {
  return apiRequest<Sale>(`/sales/${id}/status`, {
    method: 'PUT',
    body: JSON.stringify(payload)
  });
}

export function deleteSale(id: number) {
  return apiRequest<{ success: boolean }>(`/sales/${id}`, {
    method: 'DELETE'
  });
}
