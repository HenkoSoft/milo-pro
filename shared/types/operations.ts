export interface ProductDto {
  id: number;
  sku?: string | null;
  barcode?: string | null;
  name: string;
  description?: string | null;
  short_description?: string | null;
  color?: string | null;
  category_id?: number | null;
  category_primary_id?: number | null;
  brand_id?: number | null;
  supplier?: string | null;
  purchase_price?: number;
  sale_price?: number;
  stock?: number;
  min_stock?: number;
  image_url?: string | null;
  sync_status?: string | null;
  active?: number;
}

export interface RepairLogDto {
  id: number;
  repair_id: number;
  status: string;
  notes?: string | null;
  created_at: string;
}

export interface RepairDto {
  id: number;
  ticket_number: string;
  customer_id: number;
  customer_name?: string | null;
  customer_phone?: string | null;
  customer_email?: string | null;
  customer_address?: string | null;
  device_type: string;
  brand?: string | null;
  model?: string | null;
  serial_number?: string | null;
  imei?: string | null;
  password?: string | null;
  pattern?: string | null;
  problem_description: string;
  accessories?: string | null;
  status: string;
  status_label?: string | null;
  estimated_price?: number | null;
  final_price?: number | null;
  technician_notes?: string | null;
  created_at?: string;
  delivery_date?: string | null;
  logs?: RepairLogDto[];
}

export interface RepairPayload {
  customer_id: string | number;
  device_type: string;
  brand?: string;
  model?: string;
  serial_number?: string;
  imei?: string;
  password?: string;
  pattern?: string;
  problem_description: string;
  accessories?: string;
  estimated_price?: string | number | null;
  final_price?: string | number | null;
  technician_notes?: string;
}
