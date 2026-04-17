export interface SellerRecord {
  id: string;
  code: string | null;
  name: string | null;
  address: string | null;
  phone: string | null;
  cell: string | null;
  commission_percent: number;
  archived?: boolean;
  source?: 'derived' | 'manual' | string | null;
}

export interface SellerPayload {
  id?: string;
  code: string;
  name: string;
  address: string;
  phone: string;
  cell: string;
  commission_percent: number;
  source?: 'derived' | 'manual' | string;
}

export interface SellerPaymentRecord {
  id: number;
  payment_date: string;
  seller_id: string;
  seller_name: string;
  total_paid: number;
  total_sales: number;
  sale_ids: string[];
}

export interface SellerPaymentPayload {
  payment_date: string;
  seller_id: string;
  seller_name: string;
  total_paid: number;
  total_sales: number;
  sale_ids: string[];
}
