import { apiRequest } from './client';
import type { SellerPayload, SellerPaymentPayload, SellerPaymentRecord, SellerRecord } from '../types/seller';

export function getSellers() {
  return apiRequest<SellerRecord[]>('/sellers');
}

export function saveSeller(payload: SellerPayload) {
  return apiRequest<SellerRecord>('/sellers', {
    method: 'POST',
    body: JSON.stringify(payload)
  });
}

export function deleteSeller(id: string) {
  return apiRequest<{ ok: boolean }>(`/sellers/${encodeURIComponent(id)}`, {
    method: 'DELETE'
  });
}

export function getSellerPayments() {
  return apiRequest<SellerPaymentRecord[]>('/sellers/payments');
}

export function createSellerPayment(payload: SellerPaymentPayload) {
  return apiRequest<SellerPaymentRecord>('/sellers/payments', {
    method: 'POST',
    body: JSON.stringify(payload)
  });
}
