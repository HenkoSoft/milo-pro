import { apiRequest } from './client';
import type { BusinessSettings } from '../types/settings';

export function getSettings() {
  return apiRequest<BusinessSettings>('/settings');
}

export function updateSettings(payload: BusinessSettings) {
  return apiRequest<BusinessSettings>('/settings', {
    method: 'PUT',
    body: JSON.stringify(payload)
  });
}
