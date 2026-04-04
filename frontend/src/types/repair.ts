export interface RepairLog {
  id: number;
  repair_id: number;
  status: string;
  notes?: string | null;
  created_at: string;
}

export interface Repair {
  id: number;
  ticket_number: string;
  customer_id: number;
  customer_name?: string | null;
  customer_phone?: string | null;
  customer_email?: string | null;
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
  entry_date?: string;
  delivery_date?: string | null;
  logs?: RepairLog[];
}

export interface RepairPayload {
  customer_id: string;
  device_type: string;
  brand: string;
  model: string;
  serial_number: string;
  imei: string;
  password: string;
  pattern: string;
  problem_description: string;
  accessories: string;
  estimated_price: string;
  final_price: string;
  technician_notes: string;
}

export interface RepairStats {
  received: number;
  diagnosing: number;
  waiting_parts: number;
  repairing: number;
  ready: number;
  delivered: number;
}
