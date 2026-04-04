export interface BusinessSettings {
  id?: number;
  business_name: string;
  business_address: string | null;
  business_phone: string | null;
  business_email: string | null;
  updated_at?: string | null;
}
