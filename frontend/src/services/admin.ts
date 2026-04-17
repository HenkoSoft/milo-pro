import { apiRequest } from './client';
import type { AdminAuxRow, AdminAuxTableKey, AdminConfigStore, AdminConnectedSession } from '../types/admin';

export function getAdminConfig() {
  return apiRequest<AdminConfigStore>('/admin/config');
}

export function updateAdminConfig(payload: AdminConfigStore) {
  return apiRequest<AdminConfigStore>('/admin/config', {
    method: 'PUT',
    body: JSON.stringify(payload)
  });
}

export function getConnectedUsers() {
  return apiRequest<AdminConnectedSession[]>('/admin/connected-users');
}

export function forceCloseConnectedUser(sessionId: string) {
  return apiRequest<{ ok: boolean }>(`/admin/connected-users/${encodeURIComponent(sessionId)}`, {
    method: 'DELETE'
  });
}

export function getAdminAuxRows(tableKey?: AdminAuxTableKey) {
  const query = tableKey ? `?tableKey=${encodeURIComponent(tableKey)}` : '';
  return apiRequest<AdminAuxRow[]>(`/admin/aux-tables${query}`);
}

export function createAdminAuxRow(payload: { table_key: AdminAuxTableKey; description: string; code?: string; active?: boolean }) {
  return apiRequest<AdminAuxRow>('/admin/aux-tables', {
    method: 'POST',
    body: JSON.stringify(payload)
  });
}

export function deleteAdminAuxRow(id: string) {
  return apiRequest<{ ok: boolean }>(`/admin/aux-tables/${encodeURIComponent(id)}`, {
    method: 'DELETE'
  });
}

export function clearAdminConnectedUsersCache() {
  return apiRequest<{ ok: boolean }>('/admin/troubleshoot/cache', {
    method: 'POST'
  });
}
