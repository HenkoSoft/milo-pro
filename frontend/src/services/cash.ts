import { apiRequest } from './client';
import type { CashMovement, CashMovementPayload, CashMovementType } from '../types/cash';

function buildCashQuery(params: { type?: CashMovementType; startDate?: string; endDate?: string } = {}) {
  const searchParams = new URLSearchParams();
  if (params.type) searchParams.set('type', params.type);
  if (params.startDate?.trim()) searchParams.set('startDate', params.startDate.trim());
  if (params.endDate?.trim()) searchParams.set('endDate', params.endDate.trim());
  const query = searchParams.toString();
  return query ? `?${query}` : '';
}

export function getCashMovements(params: { type?: CashMovementType; startDate?: string; endDate?: string } = {}) {
  return apiRequest<CashMovement[]>(`/cash${buildCashQuery(params)}`);
}

export function createCashMovement(payload: CashMovementPayload) {
  return apiRequest<CashMovement>('/cash', {
    method: 'POST',
    body: JSON.stringify(payload)
  });
}
