export interface SupplierDto {
  id: number;
  name: string;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  city?: string | null;
  tax_id?: string | null;
  notes?: string | null;
  balance?: number;
  total_purchases?: number;
  total_credits?: number;
  total_payments?: number;
}

export interface SupplierPayload {
  name: string;
  phone: string;
  email: string;
  address: string;
  city: string;
  tax_id: string;
  notes: string;
}

export interface PurchaseItemPayload {
  product_id?: string | number | null;
  product_name: string;
  product_code: string;
  quantity: string | number;
  unit_cost: string | number;
}

export interface PurchasePayload {
  supplier_id?: string | number | null;
  invoice_type?: string;
  invoice_number?: string;
  invoice_date?: string;
  items: PurchaseItemPayload[];
  notes?: string;
}

export interface SupplierPaymentPayload {
  supplier_id: string | number;
  amount: string | number;
  payment_method?: string;
  reference?: string;
  notes?: string;
}

export interface SupplierCreditPayload {
  supplier_id?: string | number | null;
  credit_note_number?: string;
  reference_invoice?: string;
  invoice_date?: string;
  items: Array<{
    product_id?: string | number | null;
    product_name: string;
    product_code: string;
    quantity: string | number;
    unit_price: string | number;
  }>;
  notes?: string;
  update_stock?: boolean;
  update_cash?: boolean;
}
