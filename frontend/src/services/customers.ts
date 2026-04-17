import { apiRequest } from './client';
import type { Customer, CustomerPayload } from '../types/customer';

function buildCustomerQuery(search: string) {
  const params = new URLSearchParams();
  if (search.trim()) {
    params.set('search', search.trim());
  }
  const query = params.toString();
  return query ? `?${query}` : '';
}

export function getCustomers(search = '') {
  return apiRequest<Customer[]>(`/customers${buildCustomerQuery(search)}`);
}

export function getCustomerByTaxId(taxId: string) {
  const params = new URLSearchParams();
  params.set('taxId', taxId.trim());
  return apiRequest<Customer>(`/customers/lookup/tax-id?${params.toString()}`);
}

export function createCustomer(payload: CustomerPayload) {
  return apiRequest<Customer>('/customers', {
    method: 'POST',
    body: JSON.stringify(payload)
  });
}

export function updateCustomer(id: number, payload: CustomerPayload) {
  return apiRequest<Customer>(`/customers/${id}`, {
    method: 'PUT',
    body: JSON.stringify(payload)
  });
}

export function deleteCustomer(id: number) {
  return apiRequest<{ success: boolean }>(`/customers/${id}`, {
    method: 'DELETE'
  });
}
