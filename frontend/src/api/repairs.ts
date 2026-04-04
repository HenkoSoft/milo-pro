import { apiRequest } from './client';
import type { Repair, RepairStats } from '../types/repair';

function buildRepairsQuery(params: { status?: string; search?: string } = {}) {
  const searchParams = new URLSearchParams();
  if (params.status?.trim()) searchParams.set('status', params.status.trim());
  if (params.search?.trim()) searchParams.set('search', params.search.trim());
  const query = searchParams.toString();
  return query ? `?${query}` : '';
}

export function getRepairs(params: { status?: string; search?: string } = {}) {
  return apiRequest<Repair[]>(`/repairs${buildRepairsQuery(params)}`);
}

export function getRepairById(id: number) {
  return apiRequest<Repair>(`/repairs/${id}`);
}

export function createRepair(payload: object) {
  return apiRequest<Repair>('/repairs', {
    method: 'POST',
    body: JSON.stringify(payload)
  });
}

export function updateRepair(id: number, payload: object) {
  return apiRequest<Repair>(`/repairs/${id}`, {
    method: 'PUT',
    body: JSON.stringify(payload)
  });
}

export function updateRepairStatus(id: number, status: string, notes: string) {
  return apiRequest<Repair>(`/repairs/${id}/status`, {
    method: 'PUT',
    body: JSON.stringify({ status, notes })
  });
}

export function deleteRepair(id: number) {
  return apiRequest<{ success: boolean }>(`/repairs/${id}`, {
    method: 'DELETE'
  });
}

export function getRepairStats() {
  return apiRequest<RepairStats>('/repairs/stats');
}
