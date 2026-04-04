export interface WooOrderFetchFilters {
  status?: string | string[];
  after?: string;
  before?: string;
  orderby?: string;
  order?: string;
  per_page?: number;
  page?: number;
}

export interface WooStatusRecentErrorDto {
  id: number;
  message?: string | null;
  synced_at?: string | null;
  action?: string | null;
}

export interface WooStatusResponse {
  connected: boolean;
  message?: string;
  store_url?: string;
  api_version?: string;
  sync_direction?: string;
  sync_products?: boolean;
  sync_customers?: boolean;
  sync_orders?: boolean;
  sync_stock?: boolean;
  sync_prices?: boolean;
  sync_mode?: string;
  sync_interval_minutes?: number;
  tax_mode?: string;
  category_mode?: string;
  conflict_priority?: string;
  order_status_map?: string;
  last_sync?: string | null;
  auto_sync?: boolean;
  polling_active?: boolean;
  orders_sync_enabled?: boolean;
  order_sync_mode?: string;
  order_sales_channel?: string;
  customer_sync_strategy?: string;
  generic_customer_name?: string;
  webhook_signature_header?: string;
  webhook_delivery_header?: string;
  order_status_map_effective?: Record<string, string>;
  order_stock_statuses?: string[];
  order_paid_statuses?: string[];
  has_consumer_key?: boolean;
  has_consumer_secret?: boolean;
  has_wp_username?: boolean;
  has_wp_app_password?: boolean;
  has_webhook_secret?: boolean;
  has_webhook_auth_token?: boolean;
  logs_summary?: {
    processed: number;
    errors: number;
    recent_errors: WooStatusRecentErrorDto[];
  };
}

export interface WooConnectionTestPayload {
  store_url: string;
  consumer_key: string;
  consumer_secret: string;
  api_version?: string;
  wp_username?: string;
  wp_app_password?: string;
}

export interface WooConfigPayload {
  store_url: string;
  consumer_key: string;
  consumer_secret: string;
  wp_username: string;
  wp_app_password: string;
  api_version: string;
  sync_direction: string;
  sync_products: number;
  sync_customers: number;
  sync_orders: number;
  sync_stock: number;
  sync_prices: number;
  sync_mode: string;
  sync_interval_minutes: number;
  auto_sync: number;
  tax_mode: string;
  category_mode: string;
  conflict_priority: string;
  order_status_map: string;
  order_stock_statuses: string;
  order_paid_statuses: string;
  order_sync_mode: string;
  order_sales_channel: string;
  customer_sync_strategy: string;
  generic_customer_name: string;
  webhook_secret: string;
  webhook_auth_token: string;
  webhook_signature_header: string;
  webhook_delivery_header: string;
}

export interface WooOrderImportPayload {
  after?: string;
  before?: string;
  status?: string | string[];
  per_page: number;
}

export interface WooPollingResultDto {
  success: boolean;
  error?: string;
  alreadyRunning?: boolean;
  interval_seconds?: number;
  message?: string;
}

export interface WooPollingStatusDto {
  active: boolean;
  interval_seconds: number;
}

export interface WooProductSyncLogDto {
  id: number;
  milo_id?: number | null;
  woocommerce_id?: number | null;
  action?: string | null;
  status?: string | null;
  message?: string | null;
  synced_at?: string | null;
}

export interface WooOrderSyncLogDto {
  id: number;
  origin?: string | null;
  entity_type?: string | null;
  entity_id?: string | null;
  external_id?: string | null;
  event_type?: string | null;
  delivery_id?: string | null;
  status?: string | null;
  message?: string | null;
  error?: string | null;
  created_at?: string | null;
}
