export interface WooSyncLog {
  id?: number;
  product_id?: number | null;
  synced_at?: string | null;
  action?: string | null;
  status?: string | null;
  message?: string | null;
}

export interface WooOrderConfig {
  enabled?: boolean;
  sync_mode?: string | null;
  sales_channel?: string | null;
  status_map?: Record<string, string>;
  stock_statuses?: string[];
  paid_statuses?: string[];
  customer_sync_strategy?: string | null;
  generic_customer_name?: string | null;
  webhook_secret?: string | null;
  webhook_auth_token?: string | null;
  webhook_signature_header?: string | null;
  webhook_delivery_header?: string | null;
}

export interface WooStatusResponse {
  connected?: boolean;
  active?: boolean;
  polling_active?: boolean;
  store_url?: string | null;
  sync_direction?: string | null;
  sync_mode?: string | null;
  sync_interval_minutes?: number | null;
  auto_sync?: boolean | number;
  tax_mode?: string | null;
  category_mode?: string | null;
  conflict_priority?: string | null;
  api_version?: string | null;
  sync_products?: boolean;
  sync_customers?: boolean;
  sync_orders?: boolean;
  sync_stock?: boolean;
  sync_prices?: boolean;
  order_sync_mode?: string | null;
  order_sales_channel?: string | null;
  customer_sync_strategy?: string | null;
  generic_customer_name?: string | null;
  webhook_signature_header?: string | null;
  webhook_delivery_header?: string | null;
  logs?: WooSyncLog[];
  logs_summary?: {
    total?: number;
    success?: number;
    error?: number;
  };
  orderConfig?: WooOrderConfig;
}

export interface WooConfigPayload {
  store_url: string;
  consumer_key: string;
  consumer_secret: string;
  wp_username: string;
  wp_app_password: string;
  api_version: string;
  sync_direction: string;
  sync_products: boolean;
  sync_customers: boolean;
  sync_orders: boolean;
  sync_stock: boolean;
  sync_prices: boolean;
  sync_mode: string;
  sync_interval_minutes: string;
  auto_sync: boolean;
  tax_mode: string;
  category_mode: string;
  conflict_priority: string;
  webhook_secret: string;
  webhook_auth_token: string;
  webhook_signature_header: string;
  webhook_delivery_header: string;
  order_sync_mode: string;
  order_sales_channel: string;
  customer_sync_strategy: string;
  generic_customer_name: string;
}

export interface WooConnectionTestPayload {
  store_url: string;
  consumer_key: string;
  consumer_secret: string;
  api_version: string;
  wp_username: string;
  wp_app_password: string;
}

export interface WooSyncProgressEvent {
  status?: string;
  progress?: number;
  done?: boolean;
  error?: string;
  results?: {
    imported?: number;
    exported?: number;
    updated?: number;
    errors?: string[];
    total?: number;
    processed?: number;
  };
}
