import { apiRequest } from './client';
import type { Category, Brand, DeviceModel, DeviceType } from '../types/catalog';

export function getCategories() {
  return apiRequest<Category[]>('/categories');
}

export function getBrands() {
  return apiRequest<Brand[]>('/device-options/brands');
}

export function getDeviceTypes() {
  return apiRequest<DeviceType[]>('/device-options/device-types');
}

export function getDeviceModels(brandId = '') {
  const query = brandId ? `?brand_id=${encodeURIComponent(brandId)}` : '';
  return apiRequest<DeviceModel[]>(`/device-options/models${query}`);
}
