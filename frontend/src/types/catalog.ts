export interface Category {
  id: number;
  name: string;
  full_name?: string | null;
  parent_id?: number | null;
  depth?: number;
  product_count?: number;
  description?: string | null;
  slug?: string | null;
  active?: number;
  woocommerce_category_id?: number | null;
}

export interface Brand {
  id: number;
  name: string;
  slug?: string | null;
  active?: number;
  woocommerce_brand_id?: number | null;
}

export interface DeviceType {
  id: number;
  name: string;
  active?: number;
}

export interface DeviceModel {
  id: number;
  name: string;
  brand_id?: number | null;
  active?: number;
}

export interface CategoryPayload {
  name: string;
  description?: string;
  parent_id?: number | null;
  slug?: string;
  woocommerce_category_id?: number | null;
  active?: number;
}

export interface BrandPayload {
  name: string;
  slug?: string;
  active?: number;
  woocommerce_brand_id?: number | null;
}

export interface DeviceTypePayload {
  name: string;
}

export interface DeviceModelPayload {
  name: string;
  brand_id?: number | null;
}
