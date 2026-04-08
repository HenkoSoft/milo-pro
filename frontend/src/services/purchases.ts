import { apiRequest } from './client';
import type {
  Purchase,
  PurchasePayload,
  Supplier,
  SupplierPayload,
  SupplierCredit,
  SupplierCreditPayload,
  SupplierPayment,
  SupplierPaymentPayload,
  SupplierAccountDetail
} from '../types/purchase';

export function getSuppliers() {
  return apiRequest<Supplier[]>('/purchases/suppliers');
}

export function getPurchases() {
  return apiRequest<Purchase[]>('/purchases');
}

export function getPurchaseById(id: number | string) {
  return apiRequest<Purchase>(`/purchases/${id}`);
}

export function createSupplier(payload: SupplierPayload) {
  return apiRequest<Supplier>('/purchases/suppliers', {
    method: 'POST',
    body: JSON.stringify(payload)
  });
}

export function updateSupplier(id: number | string, payload: SupplierPayload) {
  return apiRequest<Supplier>(`/purchases/suppliers/${id}`, {
    method: 'PUT',
    body: JSON.stringify(payload)
  });
}

export function deleteSupplier(id: number | string) {
  return apiRequest<{ success: boolean }>(`/purchases/suppliers/${id}`, {
    method: 'DELETE'
  });
}

export function createPurchase(payload: PurchasePayload) {
  return apiRequest<Purchase>('/purchases', {
    method: 'POST',
    body: JSON.stringify(payload)
  });
}

export function deletePurchase(id: number | string) {
  return apiRequest<{ success: boolean }>(`/purchases/${id}`, {
    method: 'DELETE'
  });
}

export function getSupplierCredits() {
  return apiRequest<SupplierCredit[]>('/purchases/credits');
}

export function createSupplierCredit(payload: SupplierCreditPayload) {
  return apiRequest<SupplierCredit>('/purchases/credits', {
    method: 'POST',
    body: JSON.stringify(payload)
  });
}

export function deleteSupplierCredit(id: number | string) {
  return apiRequest<{ success: boolean }>(`/purchases/credits/${id}`, {
    method: 'DELETE'
  });
}

export function getSupplierPayments() {
  return apiRequest<SupplierPayment[]>('/purchases/payments');
}

export function createSupplierPayment(payload: SupplierPaymentPayload) {
  return apiRequest<{ success: boolean; balance: number }>('/purchases/supplier-payments', {
    method: 'POST',
    body: JSON.stringify(payload)
  });
}

export function getSupplierAccount() {
  return apiRequest<Supplier[]>('/purchases/supplier-account');
}

export function getSupplierAccountDetail(id: number | string) {
  return apiRequest<SupplierAccountDetail>(`/purchases/supplier-account/${id}`);
}
