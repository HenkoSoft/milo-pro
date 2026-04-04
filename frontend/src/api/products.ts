import { apiRequest } from './client';
import type { Product, ProductListParams } from '../types/product';

function buildProductsQuery(params: ProductListParams = {}) {
  const searchParams = new URLSearchParams();
  if (params.search?.trim()) searchParams.set('search', params.search.trim());
  if (params.category?.trim()) searchParams.set('category', params.category.trim());
  if (params.lowStock) searchParams.set('lowStock', 'true');
  const query = searchParams.toString();
  return query ? `?${query}` : '';
}

export function getProducts(params: ProductListParams = {}) {
  return apiRequest<Product[]>(`/products${buildProductsQuery(params)}`);
}

export function getProductById(id: number) {
  return apiRequest<Product>(`/products/${id}`);
}

export function getNextSku() {
  return apiRequest<{ sku: string }>('/products/next-sku/value');
}

export function createProduct(payload: object) {
  return apiRequest<Product & { sync_warning?: string }>('/products', {
    method: 'POST',
    body: JSON.stringify(payload)
  });
}

export function updateProduct(id: number, payload: object) {
  return apiRequest<Product & { sync_warning?: string }>(`/products/${id}`, {
    method: 'PUT',
    body: JSON.stringify(payload)
  });
}

export function deleteProduct(id: number) {
  return apiRequest<{ success: boolean; remote_delete_warning?: string }>(`/products/${id}`, {
    method: 'DELETE'
  });
}

export function getLowStockProducts() {
  return apiRequest<Product[]>('/products/low-stock/alerts');
}
