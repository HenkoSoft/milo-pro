import type { Category } from './catalog';

export interface ProductImage {
  id?: number | null;
  nombre_archivo?: string | null;
  ruta_local?: string | null;
  url_publica?: string | null;
  url_local?: string | null;
  url_remote?: string | null;
  woocommerce_media_id?: number | null;
  es_principal?: boolean | number;
  orden?: number;
  upload_data?: string | null;
}

export interface Product {
  id: number;
  sku: string | null;
  barcode: string | null;
  name: string;
  description?: string | null;
  short_description?: string | null;
  color?: string | null;
  category_id?: number | null;
  category_primary_id?: number | null;
  category_name?: string | null;
  category_ids?: number[];
  category_names?: string[];
  categories?: Category[];
  brand_id?: number | null;
  brand_name?: string | null;
  supplier?: string | null;
  purchase_price?: number;
  sale_price?: number;
  sale_price_2?: number;
  sale_price_3?: number;
  sale_price_4?: number;
  sale_price_5?: number;
  sale_price_6?: number;
  sale_price_includes_tax?: number | boolean;
  stock?: number;
  min_stock?: number;
  image_url?: string | null;
  images?: ProductImage[];
  sync_status?: string | null;
  woocommerce_id?: number | null;
  woocommerce_product_id?: number | null;
  active?: number;
}

export interface ProductPayload {
  sku: string;
  barcode: string;
  name: string;
  description: string;
  short_description: string;
  color: string;
  category_id: string;
  category_primary_id: string;
  category_ids: string[];
  brand_id: string;
  supplier: string;
  purchase_price: string;
  sale_price: string;
  sale_price_2: string;
  sale_price_3: string;
  sale_price_4: string;
  sale_price_5: string;
  sale_price_6: string;
  sale_price_includes_tax: boolean;
  stock: string;
  min_stock: string;
  image_url: string;
  image_upload_data: string;
  image_upload_name: string;
}

export interface ProductListParams {
  search?: string;
  category?: string;
  lowStock?: boolean;
}
