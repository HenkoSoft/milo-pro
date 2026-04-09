export interface SaleItem {
  id?: number;
  sale_id?: number;
  product_id: number;
  product_name?: string | null;
  sku?: string | null;
  quantity: number;
  unit_price: number;
  subtotal?: number;
}

export interface Sale {
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
  external_status?: string | null;
  external_reference?: string | null;
  created_at?: string;
  items?: SaleItem[];
}

export interface SalePayloadItem {
  product_id: string;
  quantity: string;
  unit_price: string;
}

export interface SalePayload {
  customer_id: string;
  payment_method: string;
  notes: string;
  receipt_type: string;
  point_of_sale: string;
  items: SalePayloadItem[];
}

export interface ReceiptNumberResponse {
  receipt_type: string;
  point_of_sale: string;
  receipt_number: number;
}

export interface TodaySalesResponse {
  sales: Sale[];
  totalRevenue: number;
  salesCount: number;
}

export interface SaleStatusUpdatePayload {
  status: string;
  note: string;
  sync_to_woo: boolean;
}

export interface SaleSyncResult {
  success?: boolean;
  productId?: number;
  product_id?: number;
  action?: string;
  error?: string | null;
}

export interface CreateSaleResponse {
  sale: Sale;
  syncResults?: SaleSyncResult[];
}
