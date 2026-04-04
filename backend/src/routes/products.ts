import type { ProductDto } from '@shared/types/operations';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function toNullableString(value: unknown): string | null {
  if (value === undefined || value === null || value === '') return null;
  return String(value).trim();
}

function toNumber(value: unknown, fallback = 0): number {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
}

function toNumberOrNull(value: unknown): number | null {
  if (value === undefined || value === null || value === '') return null;
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

export function sanitizeProduct(record: unknown): ProductDto {
  const data = isRecord(record) ? record : {};
  return {
    id: Number(data.id || 0),
    sku: toNullableString(data.sku),
    barcode: toNullableString(data.barcode),
    name: String(data.name || ''),
    description: toNullableString(data.description),
    short_description: toNullableString(data.short_description),
    color: toNullableString(data.color),
    category_id: toNumberOrNull(data.category_id),
    category_primary_id: toNumberOrNull(data.category_primary_id),
    brand_id: toNumberOrNull(data.brand_id),
    supplier: toNullableString(data.supplier),
    purchase_price: toNumber(data.purchase_price),
    sale_price: toNumber(data.sale_price),
    stock: toNumber(data.stock),
    min_stock: toNumber(data.min_stock, 2),
    image_url: toNullableString(data.image_url),
    sync_status: toNullableString(data.sync_status),
    active: toNumber(data.active, 1)
  };
}
