const { fetchWooOrderById, fetchWooOrdersPaginated } = require('./woo-order-client.js');
const { syncWooOrder } = require('./woo-order-sync.js');

type ImportOptions = {
  origin?: string;
  eventType?: string;
};

export async function importWooOrderById(orderId: unknown, options: ImportOptions = {}) {
  const order = await fetchWooOrderById(orderId);
  return syncWooOrder(order, {
    origin: options.origin || 'woocommerce_api',
    eventType: options.eventType || 'order.import'
  });
}

export async function importWooOrders(filters: Record<string, unknown> = {}, options: ImportOptions = {}) {
  const orders = await fetchWooOrdersPaginated(filters);
  const results = [];

  for (const order of orders) {
    try {
      const result = await syncWooOrder(order, {
        origin: options.origin || 'woocommerce_api',
        eventType: options.eventType || 'order.backfill'
      });
      results.push({
        order_id: order.id,
        success: true,
        ...result
      });
    } catch (error) {
      results.push({
        order_id: order && order.id ? order.id : null,
        success: false,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  return {
    total: orders.length,
    success: results.filter((item) => item.success).length,
    failed: results.filter((item) => !item.success).length,
    results
  };
}
