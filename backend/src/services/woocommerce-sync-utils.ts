type WooProductImageDto = {
  id?: number | null;
  src?: string | null;
  position?: number | null;
  url_local?: string | null;
  url_remote?: string | null;
  woocommerce_media_id?: number | null;
  orden?: number | null;
  es_principal?: boolean | null;
};

type WooSyncConfigLike = {
  api_version?: string | null;
};

export interface WooCategoryLike {
  id?: number | null;
  name?: string | null;
}

export interface WooBrandLike {
  id?: number | null;
  name?: string | null;
}

export interface WooAttributeLike {
  id?: number | null;
  name?: string | null;
  options?: unknown[];
  visible?: boolean;
  variation?: boolean;
}

export interface WooProductLike {
  categories?: WooCategoryLike[];
  brands?: WooBrandLike[];
  attributes?: WooAttributeLike[];
  images?: Array<{ id?: number | null; src?: string | null; position?: number | null }>;
}

export function getPort(url: URL): number {
  if (url.port) return Number(url.port);
  return url.protocol === 'http:' ? 80 : 443;
}

export function buildApiPath(url: URL, apiPath: string, config: WooSyncConfigLike | null = null): string {
  const basePath = url.pathname && url.pathname !== '/' ? url.pathname.replace(/\/$/, '') : '';
  const normalizedApiPath = apiPath.startsWith('/') ? apiPath : `/${apiPath}`;
  const versionPath = ((config && config.api_version) ? String(config.api_version) : 'wc/v3').replace(/^\/+|\/+$/g, '');
  return `${basePath}/wp-json/${versionPath}${normalizedApiPath}`;
}

export function normalizeStock(value: unknown): number {
  const stock = Number.parseInt(String(value ?? ''), 10);
  return Number.isFinite(stock) ? stock : 0;
}

export function normalizePrice(value: unknown): string {
  const price = Number(value);
  return Number.isFinite(price) ? price.toString() : '0';
}

export function getWooPrimaryCategory(wooProduct: WooProductLike | null | undefined): WooCategoryLike | null {
  return Array.isArray(wooProduct?.categories) && wooProduct.categories.length > 0
    ? wooProduct.categories[0] || null
    : null;
}

export function getWooPrimaryBrand(wooProduct: WooProductLike | null | undefined, normalizeCatalogText: (value: unknown) => string): WooBrandLike | { name: string } | null {
  if (Array.isArray(wooProduct?.brands) && wooProduct.brands.length > 0) {
    return wooProduct.brands[0] || null;
  }

  const attrs = Array.isArray(wooProduct?.attributes) ? wooProduct.attributes : [];
  const brandAttr = attrs.find((attr) => ['brand', 'marca'].includes(normalizeCatalogText(attr?.name)));
  if (brandAttr && Array.isArray(brandAttr.options) && brandAttr.options.length > 0) {
    return { name: String(brandAttr.options[0] ?? '').trim() };
  }

  return null;
}

export function getWooAttributeOptions(wooProduct: WooProductLike | null | undefined, normalizeCatalogText: (value: unknown) => string, attributeNames: string | string[] = []): string[] {
  const normalizedNames = (Array.isArray(attributeNames) ? attributeNames : [attributeNames])
    .map((item) => normalizeCatalogText(item))
    .filter(Boolean);
  if (normalizedNames.length === 0) return [];

  const attrs = Array.isArray(wooProduct?.attributes) ? wooProduct.attributes : [];
  const match = attrs.find((attr) => normalizedNames.includes(normalizeCatalogText(attr?.name)));
  return match && Array.isArray(match.options)
    ? match.options.map((item) => String(item ?? '').trim()).filter(Boolean)
    : [];
}

export function getWooPrimaryColor(wooProduct: WooProductLike | null | undefined, normalizeCatalogText: (value: unknown) => string): string | null {
  const options = getWooAttributeOptions(wooProduct, normalizeCatalogText, ['color', 'colour', 'colores']);
  return options[0] || null;
}

export function upsertWooAttribute(attributes: WooAttributeLike[] | null | undefined, normalizeCatalogText: (value: unknown) => string, name: string, options: string | string[]): WooAttributeLike[] | null | undefined {
  const nextOptions = [...new Set((Array.isArray(options) ? options : [options]).map((item) => String(item ?? '').trim()).filter(Boolean))];
  if (!name || nextOptions.length === 0) return attributes;

  const list = Array.isArray(attributes) ? attributes.slice() : [];
  const normalizedName = normalizeCatalogText(name);
  const existingIndex = list.findIndex((item) => normalizeCatalogText(item?.name) === normalizedName);
  const payload: WooAttributeLike = {
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

export function getWooProductImages(wooProduct: WooProductLike | null | undefined): WooProductImageDto[] {
  return (Array.isArray(wooProduct?.images) ? wooProduct.images : []).map((image, index) => ({
    url_local: null,
    url_remote: String(image?.src ?? ''),
    woocommerce_media_id: image?.id ? Number(image.id) : null,
    orden: Number.isFinite(Number(image?.position)) ? Number(image?.position) : index,
    es_principal: index === 0
  })).filter((item) => item.url_remote);
}
