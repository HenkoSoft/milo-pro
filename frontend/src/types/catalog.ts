export interface Category {
  id: number;
  name: string;
  full_name?: string | null;
  parent_id?: number | null;
  depth?: number;
  product_count?: number;
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
