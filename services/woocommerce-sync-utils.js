const http = require('http');
const https = require('https');

function getTransport(url) {
  return url.protocol === 'http:' ? http : https;
}

function getPort(url) {
  if (url.port) return Number(url.port);
  return url.protocol === 'http:' ? 80 : 443;
}

function buildApiPath(url, apiPath, config = null) {
  const basePath = url.pathname && url.pathname !== '/' ? url.pathname.replace(/\/$/, '') : '';
  const normalizedApiPath = apiPath.startsWith('/') ? apiPath : `/${apiPath}`;
  const versionPath = ((config && config.api_version) ? String(config.api_version) : 'wc/v3').replace(/^\/+|\/+$/g, '');
  return `${basePath}/wp-json/${versionPath}${normalizedApiPath}`;
}

function normalizeStock(value) {
  const stock = Number.parseInt(value, 10);
  return Number.isFinite(stock) ? stock : 0;
}

function normalizePrice(value) {
  const price = Number(value);
  return Number.isFinite(price) ? price.toString() : '0';
}

function getWooPrimaryCategory(wooProduct) {
  return Array.isArray(wooProduct && wooProduct.categories) && wooProduct.categories.length > 0
    ? wooProduct.categories[0]
    : null;
}

function getWooPrimaryBrand(wooProduct, normalizeCatalogText) {
  if (wooProduct && Array.isArray(wooProduct.brands) && wooProduct.brands.length > 0) {
    return wooProduct.brands[0];
  }

  const attrs = Array.isArray(wooProduct && wooProduct.attributes) ? wooProduct.attributes : [];
  const brandAttr = attrs.find((attr) => ['brand', 'marca'].includes(normalizeCatalogText(attr.name)));
  if (brandAttr && Array.isArray(brandAttr.options) && brandAttr.options.length > 0) {
    return { name: brandAttr.options[0] };
  }

  return null;
}

function getWooAttributeOptions(wooProduct, normalizeCatalogText, attributeNames = []) {
  const normalizedNames = (Array.isArray(attributeNames) ? attributeNames : [attributeNames])
    .map((item) => normalizeCatalogText(item))
    .filter(Boolean);
  if (normalizedNames.length === 0) return [];

  const attrs = Array.isArray(wooProduct && wooProduct.attributes) ? wooProduct.attributes : [];
  const match = attrs.find((attr) => normalizedNames.includes(normalizeCatalogText(attr.name)));
  return match && Array.isArray(match.options)
    ? match.options.map((item) => String(item || '').trim()).filter(Boolean)
    : [];
}

function getWooPrimaryColor(wooProduct, normalizeCatalogText) {
  const options = getWooAttributeOptions(wooProduct, normalizeCatalogText, ['color', 'colour', 'colores']);
  return options[0] || null;
}

function upsertWooAttribute(attributes, normalizeCatalogText, name, options) {
  const nextOptions = [...new Set((Array.isArray(options) ? options : [options]).map((item) => String(item || '').trim()).filter(Boolean))];
  if (!name || nextOptions.length === 0) return attributes;

  const list = Array.isArray(attributes) ? attributes.slice() : [];
  const normalizedName = normalizeCatalogText(name);
  const existingIndex = list.findIndex((item) => normalizeCatalogText(item && item.name) === normalizedName);
  const payload = {
    name,
    visible: true,
    variation: false,
    options: nextOptions
  };

  if (existingIndex >= 0) {
    list[existingIndex] = {
      ...list[existingIndex],
      ...payload
    };
    return list;
  }

  list.push(payload);
  return list;
}

function getWooProductImages(wooProduct) {
  return (Array.isArray(wooProduct && wooProduct.images) ? wooProduct.images : []).map((image, index) => ({
    url_local: null,
    url_remote: image.src || '',
    woocommerce_media_id: image.id || null,
    orden: Number.isFinite(Number(image.position)) ? Number(image.position) : index,
    es_principal: index === 0
  })).filter((item) => item.url_remote);
}

module.exports = {
  buildApiPath,
  getPort,
  getTransport,
  getWooAttributeOptions,
  getWooPrimaryBrand,
  getWooPrimaryCategory,
  getWooPrimaryColor,
  getWooProductImages,
  normalizePrice,
  normalizeStock,
  upsertWooAttribute
};
