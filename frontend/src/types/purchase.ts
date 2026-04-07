export interface Supplier {
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

export interface PurchaseItemPayload {
  product_id: string | null;
  product_name: string;
  product_code: string;
  quantity: number;
  unit_cost: number;
  unit_price?: number;
}

export interface PurchasePayload {
  supplier_id: string | null;
  invoice_type: string;
  invoice_number: string;
  invoice_date: string;
  items: PurchaseItemPayload[];
  notes: string;
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

export interface Purchase {
  id: number;
  supplier_id?: number | null;
  supplier_name?: string | null;
  invoice_type?: string | null;
  invoice_number?: string | null;
  invoice_date?: string | null;
  subtotal?: number;
  iva?: number;
  total?: number;
  notes?: string | null;
  status?: string | null;
  items?: PurchaseItemPayload[];
}

export interface SupplierPaymentPayload {
  supplier_id: string;
  amount: number;
  payment_method: string;
  reference: string;
  notes: string;
}

export interface SupplierPayment {
  id: number;
  supplier_id: number;
  supplier_name?: string | null;
  amount: number;
  payment_method?: string | null;
  reference?: string | null;
  notes?: string | null;
  created_at?: string | null;
}

export interface SupplierCreditPayload {
  supplier_id: string | null;
  credit_note_number: string;
  reference_invoice: string;
  invoice_date: string;
  items: PurchaseItemPayload[];
  notes: string;
  update_stock: boolean;
  update_cash: boolean;
}

export interface SupplierCredit {
  id: number;
  supplier_id?: number | null;
  supplier_name?: string | null;
  credit_note_number?: string | null;
  reference_invoice?: string | null;
  invoice_date?: string | null;
  subtotal?: number;
  iva?: number;
  total?: number;
  notes?: string | null;
  status?: string | null;
  items?: PurchaseItemPayload[];
}

export interface SupplierAccountMovement {
  id: number;
  type: string;
  reference_id?: number | null;
  reference_number?: string | null;
  description?: string | null;
  debit?: number | null;
  credit?: number | null;
  balance?: number | null;
  created_at?: string | null;
}

export interface SupplierAccountDetail {
  supplier: Supplier;
  movements: SupplierAccountMovement[];
}
