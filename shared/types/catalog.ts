export interface CategoryDto {
  id: number;
  name: string;
  slug?: string | null;
  description?: string | null;
  parent_id?: number | null;
  woocommerce_category_id?: number | null;
  active?: number;
  full_name?: string | null;
  depth?: number;
  product_count?: number;
}

export interface CategoryPayload {
  name: string;
  slug?: string;
  description?: string;
  parent_id?: string | number | null;
  woocommerce_category_id?: string | number | null;
  active?: boolean | number;
}

export interface BrandDto {
  id: number;
  name: string;
  slug?: string | null;
  active?: number;
  woocommerce_brand_id?: number | null;
}

export interface DeviceTypeDto {
  id: number;
  name: string;
  active?: number;
}

export interface DeviceModelDto {
  id: number;
  name: string;
  brand_id?: number | null;
  active?: number;
}
