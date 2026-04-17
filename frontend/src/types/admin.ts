export type AdminConnectedSession = {
  id: string;
  username: string;
  ip?: string;
  loginDate?: string;
  lastActivity?: string;
  connectionStatus?: string;
};

export type AdminConfigStore = {
  general?: {
    legal_name?: string;
    tax_id?: string;
    currency?: string;
    date_format?: string;
    timezone?: string;
    logo_name?: string;
    logo_data_url?: string;
  };
  documents?: {
    numbering_format?: string;
    prefixes?: string;
    control_stock?: boolean;
    allow_negative_stock?: boolean;
    control_min_price?: boolean;
    decimals?: number;
  };
  mail?: {
    smtp_server?: string;
    port?: string;
    username?: string;
    password?: string;
    encryption?: string;
    sender_email?: string;
  };
};

export type AdminAuxRow = {
  id: string | number;
  table_key?: string;
  description: string;
  code?: string | null;
  active?: boolean;
  source?: 'api' | 'local';
};

export type AdminAuxTableKey =
  | 'banks'
  | 'categories'
  | 'incomeDetails'
  | 'expenseDetails'
  | 'brands'
  | 'numbering'
  | 'vouchers'
  | 'countries'
  | 'provinces'
  | 'rubros'
  | 'cards'
  | 'units'
  | 'zones';
