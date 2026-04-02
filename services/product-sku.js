const PRODUCT_SKU_PREFIX = 'ART-';
const PRODUCT_SKU_DIGITS = 6;

function buildAutomaticProductSku(productId) {
  const numericId = Number.parseInt(productId, 10);
  if (!Number.isFinite(numericId) || numericId <= 0) return null;
  return `${PRODUCT_SKU_PREFIX}${String(numericId).padStart(PRODUCT_SKU_DIGITS, '0')}`;
}

function extractAutomaticProductSkuNumber(value) {
  const sku = String(value || '').trim().toUpperCase();
  const match = sku.match(/^ART-(\d{1,})$/);
  return match ? Number.parseInt(match[1], 10) : null;
}

function getNextAutomaticProductSku(items = []) {
  let maxNumber = 0;
  (Array.isArray(items) ? items : []).forEach((item) => {
    const rawSku = typeof item === 'string' ? item : item && item.sku;
    const current = extractAutomaticProductSkuNumber(rawSku);
    if (Number.isFinite(current) && current > maxNumber) {
      maxNumber = current;
    }
  });
  return buildAutomaticProductSku(maxNumber + 1);
}

function isLegacyGeneratedProductSku(value) {
  const sku = String(value || '').trim().toUpperCase();
  return /^WOO-\d+$/.test(sku) || /^TF-\d+$/.test(sku);
}

module.exports = {
  buildAutomaticProductSku,
  extractAutomaticProductSkuNumber,
  getNextAutomaticProductSku,
  isLegacyGeneratedProductSku
};
