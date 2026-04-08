const { fetchWooOrderById, fetchWooOrdersPaginated } = require('./woo-order-client');
const { syncWooOrder } = require('./woo-order-sync');

async function importWooOrderById(orderId, options = {}) {
  const order = await fetchWooOrderById(orderId);
  return syncWooOrder(order, {
    origin: options.origin || 'woocommerce_api',
    eventType: options.eventType || 'order.import'
  });
}

async function importWooOrders(filters = {}, options = {}) {
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
        error: error.message
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

module.exports = {
  importWooOrderById,
  importWooOrders
};
