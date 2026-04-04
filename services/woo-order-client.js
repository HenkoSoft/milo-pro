const { woocommerceRequest } = require('./woocommerce-sync');

function sanitizeOrderFilters(filters = {}) {
  const params = new URLSearchParams();

  if (filters.status) {
    const statuses = Array.isArray(filters.status) ? filters.status : String(filters.status).split(',');
    const normalized = statuses.map((item) => String(item || '').trim()).filter(Boolean);
    if (normalized.length === 1) {
      params.set('status', normalized[0]);
    } else if (normalized.length > 1) {
      params.set('status', normalized.join(','));
    }
  }

  if (filters.after) params.set('after', filters.after);
  if (filters.before) params.set('before', filters.before);
  if (filters.orderby) params.set('orderby', filters.orderby);
  if (filters.order) params.set('order', filters.order);
  params.set('per_page', String(Math.min(Math.max(Number(filters.per_page) || 25, 1), 100)));
  params.set('page', String(Math.max(Number(filters.page) || 1, 1)));

  return params.toString();
}

async function fetchWooOrderById(orderId) {
  return woocommerceRequest('GET', `/orders/${orderId}`);
}

async function fetchWooOrders(filters = {}) {
  const query = sanitizeOrderFilters(filters);
  return woocommerceRequest('GET', `/orders${query ? `?${query}` : ''}`);
}

async function fetchWooOrdersPaginated(filters = {}) {
  const collected = [];
  let page = 1;
  const perPage = Math.min(Math.max(Number(filters.per_page) || 25, 1), 100);

  while (true) {
    const batch = await fetchWooOrders({ ...filters, page, per_page: perPage });
    if (!Array.isArray(batch) || batch.length === 0) {
      break;
    }
    collected.push(...batch);
    if (batch.length < perPage) {
      break;
    }
    page += 1;
  }

  return collected;
}

module.exports = {
  fetchWooOrderById,
  fetchWooOrders,
  fetchWooOrdersPaginated
};
