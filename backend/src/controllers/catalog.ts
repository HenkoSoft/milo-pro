import type { BrandDto, CategoryDto, CategoryPayload, DeviceModelDto, DeviceTypeDto } from '@shared/types/catalog';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function toNullableString(value: unknown): string | null {
  if (value === undefined || value === null || value === '') return null;
  return String(value).trim();
}

function toNumberOrNull(value: unknown): number | null {
  if (value === undefined || value === null || value === '') return null;
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

function toActiveFlag(value: unknown): number {
  return value === false || value === 0 ? 0 : 1;
}

export function normalizeCategoryPayload(body: unknown): CategoryPayload {
  const data = isRecord(body) ? body : {};
  return {
    name: String(data.name || '').trim(),
    slug: String(data.slug || '').trim(),
    description: String(data.description || ''),
    parent_id: toNumberOrNull(data.parent_id),
    woocommerce_category_id: toNumberOrNull(data.woocommerce_category_id),
    active: data.active === false || data.active === 0 ? 0 : 1
  };
}

export function sanitizeCategory(record: unknown): CategoryDto {
  const data = isRecord(record) ? record : {};
  return {
    id: Number(data.id || 0),
    name: String(data.name || ''),
    slug: toNullableString(data.slug),
    description: toNullableString(data.description),
    parent_id: toNumberOrNull(data.parent_id),
    woocommerce_category_id: toNumberOrNull(data.woocommerce_category_id),
    active: Number(data.active ?? 1),
    full_name: toNullableString(data.full_name),
    depth: toNumberOrNull(data.depth) ?? 0,
    product_count: toNumberOrNull(data.product_count) ?? 0
  };
}

export function sanitizeBrand(record: unknown): BrandDto {
  const data = isRecord(record) ? record : {};
  return {
    id: Number(data.id || 0),
    name: String(data.name || ''),
    slug: toNullableString(data.slug),
    active: Number(data.active ?? 1),
    woocommerce_brand_id: toNumberOrNull(data.woocommerce_brand_id)
  };
}

export function sanitizeDeviceType(record: unknown): DeviceTypeDto {
  const data = isRecord(record) ? record : {};
  return {
    id: Number(data.id || 0),
    name: String(data.name || ''),
    active: Number(data.active ?? 1)
  };
}

export function sanitizeDeviceModel(record: unknown): DeviceModelDto {
  const data = isRecord(record) ? record : {};
  return {
    id: Number(data.id || 0),
    name: String(data.name || ''),
    brand_id: toNumberOrNull(data.brand_id),
    active: Number(data.active ?? 1)
  };
}

export function buildBrandPayload(body: unknown) {
  const data = isRecord(body) ? body : {};
  const name = String(data.name || '').trim();
  return {
    name,
    slug: String(data.slug || name).trim().toLowerCase().replace(/[^a-z0-9]+/g, '-'),
    active: toActiveFlag(data.active),
    woocommerce_brand_id: toNumberOrNull(data.woocommerce_brand_id)
  };
}

export function buildDeviceTypePayload(body: unknown) {
  const data = isRecord(body) ? body : {};
  return {
    name: String(data.name || '').trim()
  };
}

export function buildDeviceModelPayload(body: unknown) {
  const data = isRecord(body) ? body : {};
  return {
    name: String(data.name || '').trim(),
    brand_id: toNumberOrNull(data.brand_id)
  };
}
