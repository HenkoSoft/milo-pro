export interface WooOrderFetchFilters {
  status?: string | string[];
  after?: string;
  before?: string;
  orderby?: string;
  order?: string;
  per_page?: number;
  page?: number;
}

export interface WooOrderSyncConfig {
  statusMap: Record<string, string>;
  stockStatuses: string[];
  paidStatuses: string[];
  salesChannel: string;
  customerStrategy: string;
  genericCustomerName: string;
  webhookSecret: string;
  webhookAuthToken: string;
  signatureHeader: string;
  deliveryHeader: string;
  syncEnabled: boolean;
}

export interface WooOrderCustomer {
  externalCustomerId: string | null;
  name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  city: string | null;
  province: string | null;
  country: string | null;
  notes: string | null;
}

export interface WooOrderItem {
  externalLineId: string | null;
  externalProductId: string | null;
  wooProductId: number | null;
  sku: string;
  name: string;
  quantity: number;
  unitPrice: number;
  subtotal: number;
  taxTotal: number;
  metaData: unknown[];
}

export interface NormalizedWooOrder {
  woocommerceOrderId: number;
  woocommerceOrderKey: string | null;
  externalReference: string;
  channel: string;
  wooStatus: string;
  internalStatus: string;
  paymentStatus: string;
  currency: string;
  subtotal: number;
  total: number;
  discountTotal: number;
  taxTotal: number;
  shippingTotal: number;
  totalPaid: number;
  paymentMethod: string;
  paymentMethodCode: string;
  notes: string | null;
  customer: WooOrderCustomer;
  items: WooOrderItem[];
  raw: unknown;
  createdAt: string;
  updatedAt: string;
  deliveryId: unknown;
}

export interface WooSyncConfigLike {
  store_url?: string | null;
  consumer_key?: string | null;
  consumer_secret?: string | null;
  wp_username?: string | null;
  wp_app_password?: string | null;
  api_version?: string | null;
  sync_direction?: string | null;
}

export interface WooProductImageDto {
  url_local: string | null;
  url_remote: string;
  woocommerce_media_id: number | null;
  orden: number;
  es_principal: boolean;
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
