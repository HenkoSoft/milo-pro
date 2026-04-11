const PRODUCT_SKU_PREFIX = 'ART-';
const PRODUCT_SKU_DIGITS = 6;

export function buildAutomaticProductSku(productId: unknown) {
  const numericId = Number.parseInt(String(productId ?? ''), 10);
  if (!Number.isFinite(numericId) || numericId <= 0) return null;
  return `${PRODUCT_SKU_PREFIX}${String(numericId).padStart(PRODUCT_SKU_DIGITS, '0')}`;
}

export function extractAutomaticProductSkuNumber(value: unknown) {
  const sku = String(value || '').trim().toUpperCase();
  const match = sku.match(/^ART-(\d{1,})$/);
  return match ? Number.parseInt(match[1], 10) : null;
}

export function getNextAutomaticProductSku(items: Array<string | { sku?: unknown }> = []) {
  let maxNumber = 0;
  (Array.isArray(items) ? items : []).forEach((item) => {
    const rawSku = typeof item === 'string' ? item : item && item.sku;
    const current = extractAutomaticProductSkuNumber(rawSku);
    if (typeof current === 'number' && Number.isFinite(current) && current > maxNumber) {
      maxNumber = current;
    }
  });
  return buildAutomaticProductSku(maxNumber + 1);
}

export function isLegacyGeneratedProductSku(value: unknown) {
  const sku = String(value || '').trim().toUpperCase();
  return /^WOO-\d+$/.test(sku) || /^TF-\d+$/.test(sku);
}
