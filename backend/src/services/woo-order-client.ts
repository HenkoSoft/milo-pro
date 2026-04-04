import type { WooOrderFetchFilters } from '@shared/types/woocommerce';

function clampWooPerPage(value: unknown): number {
  const perPage = Number(value);
  return Math.min(Math.max(Number.isFinite(perPage) ? perPage : 25, 1), 100);
}

function clampWooPage(value: unknown): number {
  const page = Number(value);
  return Math.max(Number.isFinite(page) ? page : 1, 1);
}

export function sanitizeWooOrderFilters(filters: WooOrderFetchFilters = {}): string {
  const params = new URLSearchParams();

  if (filters.status) {
    const statuses = Array.isArray(filters.status) ? filters.status : String(filters.status).split(',');
    const normalized = statuses.map((item) => String(item || '').trim()).filter(Boolean);
    if (normalized.length === 1) {
      params.set('status', normalized[0]);
    } else if (normalized.length > 1) {
      params.set('status', normalized.join(','));
    }
  }

  if (filters.after) params.set('after', filters.after);
  if (filters.before) params.set('before', filters.before);
  if (filters.orderby) params.set('orderby', filters.orderby);
  if (filters.order) params.set('order', filters.order);
  params.set('per_page', String(clampWooPerPage(filters.per_page)));
  params.set('page', String(clampWooPage(filters.page)));

  return params.toString();
}
