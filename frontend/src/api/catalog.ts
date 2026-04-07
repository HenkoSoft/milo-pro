import { apiRequest } from './client';
import type {
  Category,
  CategoryPayload,
  Brand,
  BrandPayload,
  DeviceModel,
  DeviceModelPayload,
  DeviceType,
  DeviceTypePayload
} from '../types/catalog';

export function getCategories() {
  return apiRequest<Category[]>('/categories');
}

export function createCategory(payload: CategoryPayload) {
  return apiRequest<Category>('/categories', {
    method: 'POST',
    body: JSON.stringify(payload)
  });
}

export function deleteCategory(id: number | string) {
  return apiRequest<{ success: boolean }>(`/categories/${id}`, {
    method: 'DELETE'
  });
}

export function getBrands() {
  return apiRequest<Brand[]>('/device-options/brands');
}

export function createBrand(payload: BrandPayload) {
  return apiRequest<Brand>('/device-options/brands', {
    method: 'POST',
    body: JSON.stringify(payload)
  });
}

export function deleteBrand(id: number | string) {
  return apiRequest<{ success: boolean }>(`/device-options/brands/${id}`, {
    method: 'DELETE'
  });
}

export function getDeviceTypes() {
  return apiRequest<DeviceType[]>('/device-options/device-types');
}

export function createDeviceType(payload: DeviceTypePayload) {
  return apiRequest<DeviceType>('/device-options/device-types', {
    method: 'POST',
    body: JSON.stringify(payload)
  });
}

export function deleteDeviceType(id: number | string) {
  return apiRequest<{ success: boolean }>(`/device-options/device-types/${id}`, {
    method: 'DELETE'
  });
}

export function getDeviceModels(brandId = '') {
  const query = brandId ? `?brand_id=${encodeURIComponent(brandId)}` : '';
  return apiRequest<DeviceModel[]>(`/device-options/models${query}`);
}

export function createDeviceModel(payload: DeviceModelPayload) {
  return apiRequest<DeviceModel>('/device-options/models', {
    method: 'POST',
    body: JSON.stringify(payload)
  });
}

export function deleteDeviceModel(id: number | string) {
  return apiRequest<{ success: boolean }>(`/device-options/models/${id}`, {
    method: 'DELETE'
  });
}
