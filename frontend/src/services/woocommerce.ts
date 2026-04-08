import { apiRequest } from './client';
import type { WooConfigPayload, WooConnectionTestPayload, WooStatusResponse } from '../types/woocommerce';

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
