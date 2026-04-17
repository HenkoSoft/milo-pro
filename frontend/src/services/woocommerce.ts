import { apiRequest } from './client';
import type { WooConfigPayload, WooConnectionTestPayload, WooStatusResponse, WooSyncProgressEvent } from '../types/woocommerce';

const API_BASE_URL = '/api';
const TOKEN_STORAGE_KEY = 'milo_react_token';

export function getWooStatus() {
  return apiRequest<WooStatusResponse>('/woocommerce/status');
}

export function testWooConnection(payload: WooConnectionTestPayload) {
  return apiRequest<{ success: boolean; store?: string; version?: string; error?: string }>('/woocommerce/test-connection', {
    method: 'POST',
    body: JSON.stringify(payload)
  });
}

export function updateWooConfig(payload: WooConfigPayload) {
  return apiRequest<{ success: boolean; polling_active?: boolean; config?: WooStatusResponse }>('/woocommerce/config', {
    method: 'PUT',
    body: JSON.stringify(payload)
  });
}

export function disconnectWoo() {
  return apiRequest<{ success: boolean }>('/woocommerce/disconnect', {
    method: 'DELETE'
  });
}

export function startWooPolling() {
  return apiRequest<{ success: boolean; polling_active?: boolean }>('/woocommerce/start-polling', {
    method: 'POST'
  });
}

export function stopWooPolling() {
  return apiRequest<{ success: boolean; polling_active?: boolean }>('/woocommerce/stop-polling', {
    method: 'POST'
  });
}

export function getWooPollingStatus() {
  return apiRequest<{ active?: boolean; polling_active?: boolean }>('/woocommerce/polling-status');
}

export function syncWooProduct(id: number) {
  return apiRequest<{ success: boolean; error?: string; woocommerce_id?: number | null }>(`/woocommerce/sync-product/${id}`, {
    method: 'POST'
  });
}

export async function syncWooCatalog(onProgress: (event: WooSyncProgressEvent) => void) {
  const token = window.localStorage.getItem(TOKEN_STORAGE_KEY);
  const response = await fetch(`${API_BASE_URL}/woocommerce/sync`, {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : {}
  });

  if (!response.ok) {
    const rawText = await response.text();
    throw new Error(rawText || `Request failed with status ${response.status}`);
  }

  if (!response.body) {
    throw new Error('La respuesta de sincronizacion no incluye progreso en tiempo real.');
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let lastEvent: WooSyncProgressEvent | null = null;

  while (true) {
    const { done, value } = await reader.read();
    buffer += decoder.decode(value || new Uint8Array(), { stream: !done });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      const parsed = JSON.parse(trimmed) as WooSyncProgressEvent;
      lastEvent = parsed;
      onProgress(parsed);
    }

    if (done) break;
  }

  if (buffer.trim()) {
    const parsed = JSON.parse(buffer.trim()) as WooSyncProgressEvent;
    lastEvent = parsed;
    onProgress(parsed);
  }

  return lastEvent;
}
