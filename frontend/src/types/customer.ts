export interface Customer {
  id: number;
  name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  contact: string | null;
  city: string | null;
  province: string | null;
  country: string | null;
  tax_id: string | null;
  iva_condition: string | null;
  instagram: string | null;
  transport: string | null;
  credit_limit: number | null;
  zone: string | null;
  discount_percent: number | null;
  seller: string | null;
  price_list: string | null;
  billing_conditions: string | null;
  notes: string | null;
  created_at?: string;
}

export interface CustomerPayload {
  name: string;
  phone: string;
  email: string;
  address: string;
  contact: string;
  city: string;
  province: string;
  country: string;
  tax_id: string;
  iva_condition: string;
  instagram: string;
  transport: string;
  credit_limit: string;
  zone: string;
  discount_percent: string;
  seller: string;
  price_list: string;
  billing_conditions: string;
  notes: string;
}
