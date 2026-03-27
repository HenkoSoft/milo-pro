const API_BASE = '/api';

function buildQuery(params = {}) {
  const searchParams = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') {
      return;
    }
    searchParams.append(key, value);
  });

  const query = searchParams.toString();
  return query ? '?' + query : '';
}

async function request(endpoint, options = {}) {
  const token = localStorage.getItem('token');
  const headers = { ...(options.headers || {}) };

  if (!(options.body instanceof FormData) && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json';
  }
  if (token) headers['Authorization'] = 'Bearer ' + token;
  
  const response = await fetch(API_BASE + endpoint, { ...options, headers });
  
  try {
    const data = await response.json();
    if (!response.ok) {
      if (response.status === 401) {
        localStorage.removeItem('token');
        if (typeof showLogin === 'function') showLogin();
        throw new Error('Session expired');
      }
      throw new Error(data.error || 'Request failed');
    }
    return data;
  } catch (e) {
    if (e.message === 'Session expired') throw e;
    if (e instanceof SyntaxError) {
      if (response.status === 401) {
        localStorage.removeItem('token');
        throw new Error('Session expired');
      }
      throw new Error('Invalid response from server');
    }
    throw e;
  }
}

const api = {
  auth: {
    login: (username, password) => request('/auth/login', { method: 'POST', body: JSON.stringify({ username, password }) }),
    me: () => request('/auth/me'),
    logout: () => request('/auth/logout', { method: 'POST' }),
    getUsers: () => request('/auth/users'),
    createUser: (user) => request('/auth/users', { method: 'POST', body: JSON.stringify(user) })
  },
  products: {
    getAll: (params) => request('/products' + buildQuery(params)),
    getOne: (id) => request('/products/' + id),
    create: (product) => request('/products', { method: 'POST', body: JSON.stringify(product) }),
    update: (id, product) => request('/products/' + id, { method: 'PUT', body: JSON.stringify(product) }),
    delete: (id) => request('/products/' + id, { method: 'DELETE' }),
    lowStock: () => request('/products/low-stock/alerts')
  },
  categories: {
    getAll: () => request('/categories'),
    create: (cat) => request('/categories', { method: 'POST', body: JSON.stringify(cat) }),
    update: (id, cat) => request('/categories/' + id, { method: 'PUT', body: JSON.stringify(cat) }),
    delete: (id) => request('/categories/' + id, { method: 'DELETE' })
  },
  sales: {
    getAll: (params) => request('/sales' + buildQuery(params)),
    getOne: (id) => request('/sales/' + id),
    getToday: () => request('/sales/today'),
    nextNumber: (params) => request('/sales/next-number' + buildQuery(params)),
    create: (sale) => request('/sales', { method: 'POST', body: JSON.stringify(sale) }),
    delete: (id) => request('/sales/' + id, { method: 'DELETE' })
  },
  customers: {
    getAll: (params) => request('/customers' + buildQuery(params)),
    getOne: (id) => request('/customers/' + id),
    create: (customer) => request('/customers', { method: 'POST', body: JSON.stringify(customer) }),
    update: (id, customer) => request('/customers/' + id, { method: 'PUT', body: JSON.stringify(customer) }),
    delete: (id) => request('/customers/' + id, { method: 'DELETE' })
  },
  repairs: {
    getAll: (params) => request('/repairs' + buildQuery(params)),
    getOne: (id) => request('/repairs/' + id),
    getTicket: (num) => request('/repairs/ticket/' + num),
    getStats: () => request('/repairs/stats'),
    create: (repair) => request('/repairs', { method: 'POST', body: JSON.stringify(repair) }),
    update: (id, repair) => request('/repairs/' + id, { method: 'PUT', body: JSON.stringify(repair) }),
    updateStatus: (id, status, notes) => request('/repairs/' + id + '/status', { method: 'PUT', body: JSON.stringify({ status, notes }) }),
    signature: (id, signature) => request('/repairs/' + id + '/signature', { method: 'PUT', body: JSON.stringify({ signature }) }),
    delete: (id) => request('/repairs/' + id, { method: 'DELETE' })
  },
  dashboard: {
    stats: () => request('/dashboard/stats'),
    alerts: () => request('/dashboard/alerts'),
    recent: () => request('/dashboard/recent-activity')
  },
  reports: {
    sales: (params) => request('/reports/sales' + buildQuery(params)),
    repairs: (params) => request('/reports/repairs' + buildQuery(params)),
    products: () => request('/reports/products'),
    revenue: (period) => request('/reports/revenue?period=' + period)
  },
  settings: {
    get: () => request('/settings'),
    update: (settings) => request('/settings', { method: 'PUT', body: JSON.stringify(settings) })
  },
  deviceOptions: {
    getDeviceTypes: () => request('/device-options/device-types'),
    addDeviceType: (name) => request('/device-options/device-types', { method: 'POST', body: JSON.stringify({ name }) }),
    deleteDeviceType: (id) => request('/device-options/device-types/' + id, { method: 'DELETE' }),
    getBrands: () => request('/device-options/brands'),
    addBrand: (name) => request('/device-options/brands', { method: 'POST', body: JSON.stringify({ name }) }),
    deleteBrand: (id) => request('/device-options/brands/' + id, { method: 'DELETE' }),
    getModels: (brand_id) => {
      const url = '/device-options/models' + (brand_id ? '?brand_id=' + brand_id : '');
      console.log('getModels URL:', url);
      return request(url);
    },
    addModel: (data) => request('/device-options/models', { method: 'POST', body: JSON.stringify(data) }),
    deleteModel: (id) => request('/device-options/models/' + id, { method: 'DELETE' })
  },
  woocommerce: {
    status: () => request('/woocommerce/status'),
    test: () => request('/woocommerce/test'),
    config: (data) => request('/woocommerce/config', { method: 'PUT', body: JSON.stringify(data) }),
    sync: () => request('/woocommerce/sync', { method: 'POST' }),
    syncProduct: (id) => request('/woocommerce/sync-product/' + id, { method: 'POST' }),
    logs: () => request('/woocommerce/logs'),
    disconnect: () => request('/woocommerce/disconnect', { method: 'DELETE' })
  },
  purchases: {
    getAll: (params) => request('/purchases' + buildQuery(params)),
    getOne: (id) => request('/purchases/' + id),
    create: (purchase) => request('/purchases', { method: 'POST', body: JSON.stringify(purchase) }),
    delete: (id) => request('/purchases/' + id, { method: 'DELETE' }),
    getSuppliers: () => request('/purchases/suppliers'),
    createSupplier: (supplier) => request('/purchases/suppliers', { method: 'POST', body: JSON.stringify(supplier) }),
    updateSupplier: (id, supplier) => request('/purchases/suppliers/' + id, { method: 'PUT', body: JSON.stringify(supplier) }),
    deleteSupplier: (id) => request('/purchases/suppliers/' + id, { method: 'DELETE' }),
    getCredits: (params) => request('/purchases/credits' + buildQuery(params)),
    getCredit: (id) => request('/purchases/credits/' + id),
    createCredit: (credit) => request('/purchases/credits', { method: 'POST', body: JSON.stringify(credit) }),
    deleteCredit: (id) => request('/purchases/credits/' + id, { method: 'DELETE' }),
    getSupplierAccount: () => request('/purchases/supplier-account'),
    getSupplierAccountDetail: (id) => request('/purchases/supplier-account/' + id),
    createSupplierPayment: (payment) => request('/purchases/supplier-payments', { method: 'POST', body: JSON.stringify(payment) }),
    getPayments: (params) => request('/purchases/payments' + buildQuery(params))
  }
};

window.api = api;
console.log('API loaded');
