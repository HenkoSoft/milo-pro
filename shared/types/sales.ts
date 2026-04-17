export interface SaleItemDto {
  id?: number;
  sale_id?: number;
  product_id: number;
  product_name?: string | null;
  sku?: string | null;
  quantity: number;
  unit_price: number;
  subtotal?: number;
}

export interface SaleDto {
  id: number;
  customer_id?: number | null;
  customer_name?: string | null;
  customer_phone?: string | null;
  user_name?: string | null;
  receipt_type?: string | null;
  point_of_sale?: string | null;
  receipt_number?: number | null;
  total: number;
  payment_method?: string | null;
  notes?: string | null;
  channel?: string | null;
  status?: string | null;
  payment_status?: string | null;
  external_status?: string | null;
  stock_applied_at?: string | null;
  stock_applied_state?: string | null;
  stock_reverted_at?: string | null;
  stock_reverted_state?: string | null;
  created_at?: string;
  items?: SaleItemDto[];
}

export interface SalePayloadItem {
  product_id: string | number;
  quantity: string | number;
  unit_price: string | number;
}

export interface SalePayload {
  customer_id?: string | number | null;
  customer_tax_condition?: string | null;
  payment_method?: string;
  notes?: string;
  receipt_type?: string;
  point_of_sale?: string;
  affects_stock?: boolean;
  items: SalePayloadItem[];
}

export interface SaleStatusUpdatePayload {
  status: string;
  note?: string;
  sync_to_woo?: boolean;
}
