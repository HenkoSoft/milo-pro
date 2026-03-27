let reportsProducts = [];
let reportsCategories = [];
let reportsCustomers = [];
let reportsSales = [];
let reportsSalesSummary = {};
let reportsPurchases = [];
let reportsSuppliers = [];
let reportsRevenue = {};
let reportsProductStats = {};

const REPORTS_CASH_STORAGE_KEYS = {
  income: 'milo_cash_income',
  expenses: 'milo_cash_expenses',
  withdrawals: 'milo_cash_withdrawals'
};

const REPORT_SECTIONS = {
  articles: {
    title: 'Reportes de Articulos',
    kicker: 'Reportes',
    subtitle: 'Filtros simples, tabla clara y exportacion directa para control de stock y catalogo.',
    reportTypes: ['Listado de Articulos', 'Listado de Articulos por Rubro', 'Stock Valorizado', 'Listado de Stock Critico', 'Stock Inicial', 'Ajuste de Stock', 'Stock con Ubicacion', 'Salidas por Articulos'],
    searchPlaceholder: 'Buscar articulo...'
  },
  sales: {
    title: 'Reportes de Ventas',
    kicker: 'Reportes',
    subtitle: 'Pantalla unificada para consultas comerciales, margenes y seguimiento diario.',
    reportTypes: ['Resumen del dia', 'Resumen entre fechas', 'Ganancia entre fechas', 'Ganancia entre fechas (incluye NC)', 'Ventas del dia', 'Ventas entre fechas', 'Total de ventas por dia (incluye NC)', 'Ventas con medios de pago digital', 'Ventas con descuento', 'Total ventas mensuales', 'Ventas por articulo', 'Ventas por zona', 'Ventas por zona detallada', 'Ventas por usuario', 'Resumen de ventas por marca', 'Ventas de una marca', 'Ventas por rubro', 'Ventas por rubro detallado', 'Ventas de un rubro', 'IVA ventas', 'IVA ventas Excel', 'IVA ventas agrupado (Excel)', 'IVA ventas Excel por provincia', 'Facturas anuladas'],
    searchPlaceholder: 'Buscar comprobante, cliente o articulo...'
  },
  purchases: {
    title: 'Reportes de Compras',
    kicker: 'Reportes',
    subtitle: 'Consultas de compras preparadas para filtrar rapidamente por proveedor y fechas.',
    reportTypes: ['Compras del dia', 'Compras entre fechas', 'Compras por articulo', 'Compras por proveedor'],
    searchPlaceholder: 'Buscar compra o proveedor...'
  },
  customers: {
    title: 'Reportes de Clientes',
    kicker: 'Reportes',
    subtitle: 'Seguimiento comercial por cliente, vendedor y comportamiento de compra.',
    reportTypes: ['Listado por nombre', 'Listado de clientes a Excel', 'Cumpleanos del mes', 'Clientes activos', 'Clientes por vendedor / zona', 'Articulos comprados por un cliente', 'Ventas por cliente', 'Comprobantes por cliente', 'Ganancias por cliente', 'Ranking de articulos vendidos'],
    searchPlaceholder: 'Buscar cliente...'
  },
  deliveryNotes: {
    title: 'Reportes de Remitos',
    kicker: 'Reportes',
    subtitle: 'Consulta operativa con la misma estetica de Ventas para revisar entregas y pendientes.',
    reportTypes: ['Articulos enviados con remito', 'Remitos entre fechas', 'Remitos sin facturar', 'Remitos sin facturar por cliente', 'Remitos por vendedor', 'Remitos por vendedor detallado', 'Remitos por usuario'],
    searchPlaceholder: 'Buscar remito o cliente...'
  },
  accounts: {
    title: 'Reportes de Cuentas Corrientes',
    kicker: 'Reportes',
    subtitle: 'Vista administrativa para deudores, cobranzas y saldo pendiente por cliente.',
    reportTypes: ['Ventas a cuenta corriente', 'Cobranzas entre fechas', 'Deudores', 'Deudores por vendedor', 'Deudores por zona', 'Clientes con saldo a favor'],
    searchPlaceholder: 'Buscar cliente o zona...'
  },
  ranking: {
    title: 'Ranking de Ventas',
    kicker: 'Reportes',
    subtitle: 'Comparativos rapidos para detectar articulos, clientes y vendedores destacados.',
    reportTypes: ['Ranking por articulo', 'Ranking por cliente', 'Ranking por vendedor'],
    searchPlaceholder: 'Buscar entidad del ranking...'
  },
  cash: {
    title: 'Reportes de Caja',
    kicker: 'Reportes',
    subtitle: 'Resumen diario de ingresos y egresos para control financiero operativo.',
    reportTypes: ['Caja diaria', 'Ingresos varios diarios', 'Gastos varios diarios', 'Gastos por descripcion', 'Retiros diarios'],
    searchPlaceholder: 'Buscar movimiento de caja...'
  },
  excel: {
    title: 'Reportes a Excel',
    kicker: 'Reportes',
    subtitle: 'Generador simple para exportaciones rapidas sin salir del flujo administrativo.',
    reportTypes: [],
    searchPlaceholder: ''
  }
};

const reportsUiState = {
  activeSection: 'articles',
  filters: {},
  search: {},
  page: {},
  reportType: {},
  lastResult: null
};

function reportsEscapeHtml(value) {
  return app.escapeHtml(value ?? '');
}

function reportsEscapeAttr(value) {
  return app.escapeAttr(value ?? '');
}

function reportsNormalizeText(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function reportsFormatInputDate(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function reportsBuildOptions(items, selectedValue, placeholder = 'Todos') {
  const current = String(selectedValue || '');
  let html = '<option value="">' + reportsEscapeHtml(placeholder) + '</option>';
  items.forEach((item) => {
    const value = typeof item === 'object' ? item.value : item;
    const label = typeof item === 'object' ? item.label : item;
    html += '<option value="' + reportsEscapeAttr(value) + '"' + (current === String(value) ? ' selected' : '') + '>' + reportsEscapeHtml(label) + '</option>';
  });
  return html;
}

function reportsLoadStore(key) {
  try {
    return JSON.parse(localStorage.getItem(key) || '[]');
  } catch (error) {
    return [];
  }
}

function ensureReportsState(sectionId) {
  const section = REPORT_SECTIONS[sectionId];
  if (!reportsUiState.filters[sectionId]) {
    reportsUiState.filters[sectionId] = { from: '', to: '', customer: '', seller: '', supplier: '', category: '', user: '', type: '', top: '10', cashType: '' };
  }
  if (!reportsUiState.search[sectionId]) reportsUiState.search[sectionId] = '';
  if (!reportsUiState.page[sectionId]) reportsUiState.page[sectionId] = 1;
  if (!reportsUiState.reportType[sectionId]) {
    reportsUiState.reportType[sectionId] = (section && section.reportTypes[0]) || '';
  }
}

function getReportsSectionRoute(sectionId) {
  return {
    articles: 'reports',
    sales: 'reports-sales',
    purchases: 'reports-purchases',
    customers: 'reports-customers',
    deliveryNotes: 'reports-delivery-notes',
    accounts: 'reports-accounts',
    ranking: 'reports-ranking',
    cash: 'reports-cash',
    excel: 'reports-excel'
  }[sectionId] || 'reports';
}

async function renderReports(sectionId = 'articles') {
  const content = document.getElementById('page-content');
  content.innerHTML = '<div class="loading">Cargando...</div>';
  reportsUiState.activeSection = sectionId;
  ensureReportsState(sectionId);

  try {
    const [products, categories, customers, salesData, purchases, suppliers, revenue, productStats] = await Promise.all([
      api.products.getAll({}).catch(() => []),
      api.categories.getAll().catch(() => []),
      api.customers.getAll({}).catch(() => []),
      api.reports.sales({}).catch(() => ({ sales: [], summary: {} })),
      api.purchases.getAll({}).catch(() => []),
      api.purchases.getSuppliers().catch(() => []),
      api.reports.revenue('month').catch(() => ({})),
      api.reports.products().catch(() => ({}))
    ]);

    reportsProducts = Array.isArray(products) ? products : [];
    reportsCategories = Array.isArray(categories) ? categories : [];
    reportsCustomers = Array.isArray(customers) ? customers : [];
    reportsSales = Array.isArray(salesData.sales) ? salesData.sales : [];
    reportsSalesSummary = salesData.summary || {};
    reportsPurchases = Array.isArray(purchases) ? purchases : [];
    reportsSuppliers = Array.isArray(suppliers) ? suppliers : [];
    reportsRevenue = revenue || {};
    reportsProductStats = productStats || {};

    content.innerHTML = `
      <section class="reports-admin-content">
        <div class="reports-admin-panel card" id="reports-admin-panel"></div>
      </section>
    `;
    renderReportsSection();
  } catch (error) {
    content.innerHTML = '<div class="alert alert-warning">Error: ' + reportsEscapeHtml(error.message) + '</div>';
  }
}

function getReportsCategoryName(categoryId) {
  const item = reportsCategories.find((category) => String(category.id) === String(categoryId));
  return item ? item.name : '-';
}

function getCustomerById(customerId) {
  return reportsCustomers.find((customer) => String(customer.id) === String(customerId)) || null;
}

function getProductById(productId) {
  return reportsProducts.find((product) => String(product.id) === String(productId)) || null;
}

function getSalesRows() {
  return reportsSales.flatMap((sale) => {
    const customer = getCustomerById(sale.customer_id);
    const baseRow = {
      sale,
      customer,
      date: sale.created_at,
      number: `${String(sale.point_of_sale || '001').padStart(3, '0')}-${String(sale.receipt_number || sale.id || 0).padStart(8, '0')}`,
      customerName: sale.customer_name || (customer && customer.name) || 'Consumidor Final',
      seller: (customer && customer.seller) || sale.user_name || '-',
      zone: (customer && customer.zone) || '-',
      user: sale.user_name || '-',
      receiptType: sale.receipt_type || 'C'
    };

    if (!Array.isArray(sale.items) || sale.items.length === 0) {
      return [{ ...baseRow, article: '-', quantity: 0, price: 0, cost: 0, discount: 0, total: Number(sale.total || 0), gain: Number(sale.total || 0) }];
    }

    return sale.items.map((item) => {
      const product = getProductById(item.product_id);
      const quantity = Number(item.quantity || 0);
      const price = Number(item.unit_price || 0);
      const total = Number(item.subtotal || quantity * price || 0);
      const cost = Number(product && product.purchase_price ? product.purchase_price : 0);
      return {
        ...baseRow,
        article: item.product_name || (product && product.name) || '-',
        articleCode: item.sku || (product && (product.sku || product.barcode)) || '-',
        quantity,
        price,
        cost,
        discount: 0,
        total,
        gain: total - quantity * cost
      };
    });
  });
}

function applyReportsDateFilter(rows, filters, getValue) {
  return rows.filter((row) => {
    const rawDate = String(getValue(row) || '');
    const dateValue = rawDate.slice(0, 10);
    if (filters.from && dateValue < filters.from) return false;
    if (filters.to && dateValue > filters.to) return false;
    return true;
  });
}

function applyReportsSearch(rows, search, fields) {
  const normalized = reportsNormalizeText(search);
  if (!normalized) return rows;
  return rows.filter((row) => fields.some((field) => reportsNormalizeText(typeof field === 'function' ? field(row) : row[field]).includes(normalized)));
}

function buildArticleReportResult(sectionId) {
  const filters = reportsUiState.filters[sectionId];
  const type = reportsUiState.reportType[sectionId];
  const topSellingMap = new Map((reportsProductStats.topSelling || []).map((item) => [String(item.id), item]));

  let rows = reportsProducts.map((product) => {
    const stats = topSellingMap.get(String(product.id)) || {};
    return {
      code: product.sku || 'ART-' + product.id,
      description: product.name,
      rubro: '-',
      brand: '-',
      stock: Number(product.stock || 0),
      cost: Number(product.purchase_price || 0),
      price: Number(product.sale_price || 0),
      valueStock: Number(product.stock || 0) * Number(product.purchase_price || 0),
      location: '-',
      category: getReportsCategoryName(product.category_id),
      supplier: product.supplier || '-',
      moved: Number(stats.totalSold || 0)
    };
  });

  if (filters.category) rows = rows.filter((row) => row.category === getReportsCategoryName(filters.category));
  if (filters.supplier) rows = rows.filter((row) => row.supplier === filters.supplier);
  if (type === 'Listado de Stock Critico') rows = rows.filter((row) => row.stock <= Number((reportsProducts.find((item) => (item.sku || 'ART-' + item.id) === row.code) || {}).min_stock || 0));
  if (type === 'Salidas por Articulos') rows = rows.filter((row) => row.moved > 0);

  rows = applyReportsSearch(rows, reportsUiState.search[sectionId], ['code', 'description', 'supplier', 'category']);

  return {
    columns: ['Codigo', 'Descripcion', 'Rubro', 'Marca', 'Stock', 'Costo', 'Precio', 'Valor stock', 'Ubicacion'],
    rows: rows.map((row) => [row.code, row.description, row.rubro, row.brand, row.stock, app.formatMoney(row.cost), app.formatMoney(row.price), app.formatMoney(row.valueStock), row.location]),
    summary: [
      { label: 'Articulos listados', value: rows.length },
      { label: 'Stock total', value: rows.reduce((acc, row) => acc + Number(row.stock || 0), 0) },
      { label: 'Valor stock', value: app.formatMoney(rows.reduce((acc, row) => acc + Number(row.valueStock || 0), 0)) },
      { label: 'Categorias', value: new Set(rows.map((row) => row.category).filter(Boolean)).size }
    ]
  };
}

function buildSalesReportResult(sectionId) {
  const filters = reportsUiState.filters[sectionId];
  const type = reportsUiState.reportType[sectionId];
  let rows = getSalesRows();

  rows = applyReportsDateFilter(rows, filters, (row) => row.date);
  if (filters.customer) rows = rows.filter((row) => String(row.sale.customer_id || '') === String(filters.customer));
  if (filters.seller) rows = rows.filter((row) => row.seller === filters.seller);
  if (filters.type) rows = rows.filter((row) => row.receiptType === filters.type);
  if (type === 'Ventas con medios de pago digital') rows = rows.filter((row) => String(row.sale.payment_method || '').toLowerCase() !== 'cash');
  if (type === 'Ventas con descuento') rows = rows.filter((row) => Number(row.discount || 0) > 0);

  rows = applyReportsSearch(rows, reportsUiState.search[sectionId], ['number', 'customerName', 'article', 'seller', 'zone']);

  return {
    columns: ['Fecha', 'Numero comprobante', 'Cliente', 'Articulo', 'Cantidad', 'Precio', 'Costo', 'Descuento', 'Total', 'Ganancia'],
    rows: rows.map((row) => [app.formatDate(row.date), row.number, row.customerName, row.article, row.quantity, app.formatMoney(row.price), app.formatMoney(row.cost), row.discount + '%', app.formatMoney(row.total), app.formatMoney(row.gain)]),
    summary: [
      { label: 'Total vendido', value: app.formatMoney(rows.reduce((acc, row) => acc + Number(row.total || 0), 0)) },
      { label: 'Total costo', value: app.formatMoney(rows.reduce((acc, row) => acc + Number(row.cost || 0) * Number(row.quantity || 0), 0)) },
      { label: 'Total ganancia', value: app.formatMoney(rows.reduce((acc, row) => acc + Number(row.gain || 0), 0)) },
      { label: 'Comprobantes', value: new Set(rows.map((row) => row.number)).size || reportsSalesSummary.totalTransactions || 0 }
    ]
  };
}

function buildPurchasesReportResult(sectionId) {
  const filters = reportsUiState.filters[sectionId];
  let rows = reportsPurchases.map((purchase) => ({
    date: purchase.invoice_date || purchase.created_at,
    number: purchase.invoice_number || '-',
    supplier: purchase.supplier_name || '-',
    article: 'Compra general',
    quantity: '-',
    cost: Number(purchase.subtotal || purchase.total || 0),
    total: Number(purchase.total || 0)
  }));

  rows = applyReportsDateFilter(rows, filters, (row) => row.date);
  if (filters.supplier) rows = rows.filter((row) => row.supplier === filters.supplier);
  rows = applyReportsSearch(rows, reportsUiState.search[sectionId], ['number', 'supplier', 'article']);

  return {
    columns: ['Fecha', 'Numero comprobante', 'Proveedor', 'Articulo', 'Cantidad', 'Costo unitario', 'Total'],
    rows: rows.map((row) => [app.formatDate(row.date), row.number, row.supplier, row.article, row.quantity, app.formatMoney(row.cost), app.formatMoney(row.total)]),
    summary: [
      { label: 'Compras', value: rows.length },
      { label: 'Proveedores', value: new Set(rows.map((row) => row.supplier)).size },
      { label: 'Total invertido', value: app.formatMoney(rows.reduce((acc, row) => acc + Number(row.total || 0), 0)) },
      { label: 'Promedio', value: app.formatMoney(rows.length ? rows.reduce((acc, row) => acc + Number(row.total || 0), 0) / rows.length : 0) }
    ]
  };
}

function buildCustomersReportResult(sectionId) {
  const filters = reportsUiState.filters[sectionId];
  const salesByCustomer = new Map();
  reportsSales.forEach((sale) => {
    const customerId = String(sale.customer_id || '');
    if (!customerId) return;
    const current = salesByCustomer.get(customerId) || { count: 0, total: 0, lastDate: '' };
    current.count += 1;
    current.total += Number(sale.total || 0);
    current.lastDate = current.lastDate && current.lastDate > sale.created_at ? current.lastDate : sale.created_at;
    salesByCustomer.set(customerId, current);
  });

  let rows = reportsCustomers.map((customer) => {
    const stats = salesByCustomer.get(String(customer.id)) || { count: 0, total: 0, lastDate: '' };
    return {
      code: customer.id,
      name: customer.name || '-',
      taxId: customer.tax_id || '-',
      phone: customer.phone || '-',
      zone: customer.zone || '-',
      totalPurchases: stats.count,
      totalSpent: stats.total,
      lastPurchase: stats.lastDate ? app.formatDate(stats.lastDate) : '-',
      seller: customer.seller || '-'
    };
  });

  if (filters.customer) rows = rows.filter((row) => String(row.code) === String(filters.customer));
  if (filters.seller) rows = rows.filter((row) => row.seller === filters.seller);
  rows = applyReportsSearch(rows, reportsUiState.search[sectionId], ['code', 'name', 'taxId', 'phone', 'zone']);

  return {
    columns: ['Codigo cliente', 'Nombre', 'CUIT', 'Telefono', 'Zona', 'Total compras', 'Total gastado', 'Ultima compra'],
    rows: rows.map((row) => [row.code, row.name, row.taxId, row.phone, row.zone, row.totalPurchases, app.formatMoney(row.totalSpent), row.lastPurchase]),
    summary: [
      { label: 'Clientes listados', value: rows.length },
      { label: 'Clientes activos', value: rows.filter((row) => row.totalPurchases > 0).length },
      { label: 'Total gastado', value: app.formatMoney(rows.reduce((acc, row) => acc + Number(row.totalSpent || 0), 0)) },
      { label: 'Zonas', value: new Set(rows.map((row) => row.zone).filter((value) => value && value !== '-')).size }
    ]
  };
}

function buildDeliveryNotesReportResult(sectionId) {
  const filters = reportsUiState.filters[sectionId];
  let rows = getSalesRows().map((row) => ({
    date: row.date,
    number: row.number,
    customer: row.customerName,
    article: row.article,
    quantity: row.quantity,
    status: 'Facturado',
    seller: row.seller,
    user: row.user,
    customerId: row.sale.customer_id
  }));

  rows = applyReportsDateFilter(rows, filters, (row) => row.date);
  if (filters.customer) rows = rows.filter((row) => String(row.customerId || '') === String(filters.customer));
  if (filters.seller) rows = rows.filter((row) => row.seller === filters.seller);
  if (filters.user) rows = rows.filter((row) => row.user === filters.user);
  rows = applyReportsSearch(rows, reportsUiState.search[sectionId], ['number', 'customer', 'article', 'seller']);

  return {
    columns: ['Fecha', 'Numero remito', 'Cliente', 'Articulo', 'Cantidad', 'Estado facturacion'],
    rows: rows.map((row) => [app.formatDate(row.date), row.number, row.customer, row.article, row.quantity, row.status]),
    summary: [
      { label: 'Remitos listados', value: new Set(rows.map((row) => row.number)).size },
      { label: 'Items enviados', value: rows.reduce((acc, row) => acc + Number(row.quantity || 0), 0) },
      { label: 'Clientes', value: new Set(rows.map((row) => row.customer)).size },
      { label: 'Usuarios', value: new Set(rows.map((row) => row.user)).size }
    ]
  };
}

function buildAccountsReportResult(sectionId) {
  const filters = reportsUiState.filters[sectionId];
  let rows = reportsCustomers.map((customer) => {
    const customerSales = reportsSales.filter((sale) => String(sale.customer_id || '') === String(customer.id));
    const totalInvoiced = customerSales.reduce((acc, sale) => acc + Number(sale.total || 0), 0);
    const lastMovement = customerSales[0] ? customerSales[0].created_at : '';
    return {
      customer: customer.name || '-',
      customerId: customer.id,
      balance: totalInvoiced,
      rawLastMovement: lastMovement,
      lastMovement: lastMovement ? app.formatDate(lastMovement) : '-',
      totalInvoiced,
      totalCollected: 0,
      pending: totalInvoiced,
      seller: customer.seller || '-',
      zone: customer.zone || '-'
    };
  });

  rows = applyReportsDateFilter(rows, filters, (row) => row.rawLastMovement);
  if (filters.customer) rows = rows.filter((row) => String(row.customerId) === String(filters.customer));
  if (filters.seller) rows = rows.filter((row) => row.seller === filters.seller);
  rows = applyReportsSearch(rows, reportsUiState.search[sectionId], ['customer', 'seller', 'zone']);

  return {
    columns: ['Cliente', 'Saldo', 'Fecha ultimo movimiento', 'Total facturado', 'Total cobrado', 'Saldo pendiente'],
    rows: rows.map((row) => [row.customer, app.formatMoney(row.balance), row.lastMovement, app.formatMoney(row.totalInvoiced), app.formatMoney(row.totalCollected), app.formatMoney(row.pending)]),
    summary: [
      { label: 'Clientes con saldo', value: rows.filter((row) => row.pending > 0).length },
      { label: 'Total facturado', value: app.formatMoney(rows.reduce((acc, row) => acc + Number(row.totalInvoiced || 0), 0)) },
      { label: 'Total cobrado', value: app.formatMoney(rows.reduce((acc, row) => acc + Number(row.totalCollected || 0), 0)) },
      { label: 'Saldo pendiente', value: app.formatMoney(rows.reduce((acc, row) => acc + Number(row.pending || 0), 0)) }
    ]
  };
}

function buildRankingReportResult(sectionId) {
  const filters = reportsUiState.filters[sectionId];
  const type = reportsUiState.reportType[sectionId];
  const salesRows = applyReportsDateFilter(getSalesRows(), filters, (row) => row.date);
  const ranking = new Map();
  const keyGetter = type === 'Ranking por cliente' ? (row) => row.customerName : (type === 'Ranking por vendedor' ? (row) => row.seller : (row) => row.article);
  salesRows.forEach((row) => {
    const key = keyGetter(row) || '-';
    const current = ranking.get(key) || { quantity: 0, total: 0 };
    current.quantity += Number(row.quantity || 0);
    current.total += Number(row.total || 0);
    ranking.set(key, current);
  });

  const totalSold = [...ranking.values()].reduce((acc, row) => acc + row.total, 0);
  let rows = [...ranking.entries()]
    .map(([entity, values]) => ({ entity, quantity: values.quantity, total: values.total, share: totalSold > 0 ? (values.total / totalSold) * 100 : 0 }))
    .sort((a, b) => b.total - a.total);

  const top = Math.max(1, Number(filters.top || 10));
  rows = applyReportsSearch(rows, reportsUiState.search[sectionId], ['entity']).slice(0, top);

  return {
    columns: ['Posicion', 'Entidad', 'Cantidad vendida', 'Total vendido', 'Participacion %'],
    rows: rows.map((row, index) => [index + 1, row.entity, row.quantity, app.formatMoney(row.total), row.share.toFixed(2) + '%']),
    summary: [
      { label: 'Top mostrado', value: rows.length },
      { label: 'Total vendido', value: app.formatMoney(totalSold) },
      { label: 'Cantidad total', value: rows.reduce((acc, row) => acc + Number(row.quantity || 0), 0) },
      { label: 'Reporte', value: type.replace('Ranking ', '') }
    ]
  };
}

function buildCashReportResult(sectionId) {
  const filters = reportsUiState.filters[sectionId];
  const manualIncome = reportsLoadStore(REPORTS_CASH_STORAGE_KEYS.income).map((item) => ({ ...item, movementType: 'Ingreso', user: 'Caja', amount: Number(item.amount || 0) }));
  const manualExpenses = reportsLoadStore(REPORTS_CASH_STORAGE_KEYS.expenses).map((item) => ({ ...item, movementType: 'Gasto', user: 'Caja', amount: -Math.abs(Number(item.amount || 0)) }));
  const manualWithdrawals = reportsLoadStore(REPORTS_CASH_STORAGE_KEYS.withdrawals).map((item) => ({ ...item, movementType: 'Retiro', user: item.person || 'Caja', amount: -Math.abs(Number(item.amount || 0)) }));
  const cashSales = reportsSales
    .filter((sale) => String(sale.payment_method || 'cash').toLowerCase() === 'cash')
    .map((sale) => ({ date: sale.created_at, description: 'Venta en efectivo', person: sale.customer_name || 'Consumidor Final', movementType: 'Venta', user: sale.user_name || 'Caja', amount: Number(sale.total || 0) }));

  let rows = [...cashSales, ...manualIncome, ...manualExpenses, ...manualWithdrawals].map((row) => ({
    date: row.date,
    type: row.movementType,
    description: row.description || '-',
    user: row.user || '-',
    amount: Number(row.amount || 0)
  }));

  rows = applyReportsDateFilter(rows, filters, (row) => row.date);
  if (filters.cashType) rows = rows.filter((row) => reportsNormalizeText(row.type) === reportsNormalizeText(filters.cashType));
  rows = applyReportsSearch(rows, reportsUiState.search[sectionId], ['type', 'description', 'user']);

  const totalIncome = rows.filter((row) => row.amount >= 0).reduce((acc, row) => acc + row.amount, 0);
  const totalExpense = rows.filter((row) => row.amount < 0).reduce((acc, row) => acc + Math.abs(row.amount), 0);

  return {
    columns: ['Fecha', 'Tipo', 'Descripcion', 'Usuario', 'Importe'],
    rows: rows.map((row) => [app.formatDate(row.date), row.type, row.description, row.user, app.formatMoney(row.amount)]),
    summary: [
      { label: 'Total ingresos', value: app.formatMoney(totalIncome) },
      { label: 'Total egresos', value: app.formatMoney(totalExpense) },
      { label: 'Saldo', value: app.formatMoney(totalIncome - totalExpense) },
      { label: 'Movimientos', value: rows.length }
    ]
  };
}

function buildReportsResult(sectionId) {
  if (sectionId === 'articles') return buildArticleReportResult(sectionId);
  if (sectionId === 'sales') return buildSalesReportResult(sectionId);
  if (sectionId === 'purchases') return buildPurchasesReportResult(sectionId);
  if (sectionId === 'customers') return buildCustomersReportResult(sectionId);
  if (sectionId === 'deliveryNotes') return buildDeliveryNotesReportResult(sectionId);
  if (sectionId === 'accounts') return buildAccountsReportResult(sectionId);
  if (sectionId === 'ranking') return buildRankingReportResult(sectionId);
  if (sectionId === 'cash') return buildCashReportResult(sectionId);
  return { columns: [], rows: [], summary: [] };
}

function renderReportsSection() {
  const panel = document.getElementById('reports-admin-panel');
  if (!panel) return;

  const sectionId = reportsUiState.activeSection;
  ensureReportsState(sectionId);

  if (sectionId === 'excel') {
    panel.innerHTML = renderReportsExcelSection();
    return;
  }

  const result = buildReportsResult(sectionId);
  reportsUiState.lastResult = { sectionId, ...result };
  panel.innerHTML = renderReportsCategorySection(sectionId, result);
}

function updateReportsFilter(sectionId, field, value) {
  ensureReportsState(sectionId);
  reportsUiState.filters[sectionId][field] = value || '';
  reportsUiState.page[sectionId] = 1;
  renderReportsSection();
}

function updateReportsSearch(sectionId, value) {
  ensureReportsState(sectionId);
  reportsUiState.search[sectionId] = value || '';
  reportsUiState.page[sectionId] = 1;
  renderReportsSection();
}

function updateReportsType(sectionId, value) {
  ensureReportsState(sectionId);
  reportsUiState.reportType[sectionId] = value || '';
  reportsUiState.page[sectionId] = 1;
  renderReportsSection();
}

function changeReportsPage(sectionId, delta) {
  const totalRows = (reportsUiState.lastResult && reportsUiState.lastResult.rows ? reportsUiState.lastResult.rows.length : 0);
  const totalPages = Math.max(1, Math.ceil(totalRows / 10));
  reportsUiState.page[sectionId] = Math.max(1, Math.min(totalPages, (reportsUiState.page[sectionId] || 1) + delta));
  renderReportsSection();
}

function exportReportsExcel() {
  if (!reportsUiState.lastResult) return;
  const { sectionId, columns, rows } = reportsUiState.lastResult;
  const lines = [columns, ...rows].map((row) => row.map((cell) => `"${String(cell ?? '').replace(/"/g, '""')}"`).join(';')).join('\n');
  const blob = new Blob([lines], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `reportes-${sectionId}-${reportsFormatInputDate(new Date())}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function exportReportsPdf() {
  window.print();
}

function printReportsTable() {
  window.print();
}

function generateReportsExcelFromPanel() {
  reportsUiState.lastResult = {
    sectionId: 'excel',
    columns: ['Modulo', 'Tipo reporte', 'Fecha desde', 'Fecha hasta'],
    rows: [[
      document.getElementById('reports-excel-module').value || '-',
      document.getElementById('reports-excel-type').value || '-',
      document.getElementById('reports-excel-from').value || '-',
      document.getElementById('reports-excel-to').value || '-'
    ]]
  };
  exportReportsExcel();
}

function renderReportsSummary(summary) {
  if (!summary || summary.length === 0) return '';
  return `
    <div class="reports-summary-grid">
      ${summary.map((item) => `
        <article class="reports-summary-card">
          <span>${reportsEscapeHtml(item.label)}</span>
          <strong>${reportsEscapeHtml(item.value)}</strong>
        </article>
      `).join('')}
    </div>
  `;
}

function renderReportsCategorySection(sectionId, result) {
  const config = REPORT_SECTIONS[sectionId];
  const filters = reportsUiState.filters[sectionId];
  const totalPages = Math.max(1, Math.ceil(result.rows.length / 10));
  const currentPage = Math.max(1, Math.min(totalPages, reportsUiState.page[sectionId] || 1));
  reportsUiState.page[sectionId] = currentPage;
  const rows = result.rows.slice((currentPage - 1) * 10, currentPage * 10);
  const sellers = [...new Set(reportsCustomers.map((item) => item.seller).filter(Boolean))].sort((a, b) => a.localeCompare(b));
  const users = [...new Set(reportsSales.map((item) => item.user_name).filter(Boolean))].sort((a, b) => a.localeCompare(b));

  return `
    <div class="reports-module-head">
      <div>
        <p class="reports-module-kicker">${reportsEscapeHtml(config.kicker)}</p>
        <h2>${reportsEscapeHtml(config.title)}</h2>
        <p>${reportsEscapeHtml(config.subtitle)}</p>
      </div>
      <div class="form-group reports-type-picker">
        <label>Reporte</label>
        <select onchange="updateReportsType('${sectionId}', this.value)">${reportsBuildOptions(config.reportTypes, reportsUiState.reportType[sectionId], 'Seleccionar reporte')}</select>
      </div>
    </div>

    <div class="reports-filter-card">
      <div class="reports-filter-grid">
        <div class="form-group"><label>Fecha desde</label><input type="date" value="${reportsEscapeAttr(filters.from)}" onchange="updateReportsFilter('${sectionId}', 'from', this.value)"></div>
        <div class="form-group"><label>Fecha hasta</label><input type="date" value="${reportsEscapeAttr(filters.to)}" onchange="updateReportsFilter('${sectionId}', 'to', this.value)"></div>
        <div class="form-group"><label>Cliente</label><select onchange="updateReportsFilter('${sectionId}', 'customer', this.value)">${reportsBuildOptions(reportsCustomers.map((item) => ({ value: item.id, label: item.name })), filters.customer, 'Todos')}</select></div>
        <div class="form-group"><label>Vendedor</label><select onchange="updateReportsFilter('${sectionId}', 'seller', this.value)">${reportsBuildOptions(sellers, filters.seller, 'Todos')}</select></div>
        <div class="form-group"><label>Proveedor</label><select onchange="updateReportsFilter('${sectionId}', 'supplier', this.value)">${reportsBuildOptions(reportsSuppliers.map((item) => item.name), filters.supplier, 'Todos')}</select></div>
        <div class="form-group"><label>Categoria</label><select onchange="updateReportsFilter('${sectionId}', 'category', this.value)">${reportsBuildOptions(reportsCategories.map((item) => ({ value: item.id, label: item.name })), filters.category, 'Todas')}</select></div>
        <div class="form-group"><label>Usuario</label><select onchange="updateReportsFilter('${sectionId}', 'user', this.value)">${reportsBuildOptions(users, filters.user, 'Todos')}</select></div>
        <div class="form-group"><label>Tipo comprobante</label><select onchange="updateReportsFilter('${sectionId}', 'type', this.value)">${reportsBuildOptions(['A', 'B', 'C', 'X', 'PRESUPUESTO', 'TICKET'], filters.type, 'Todos')}</select></div>
        ${sectionId === 'ranking' ? `<div class="form-group"><label>Top resultados</label><input type="number" min="1" max="50" value="${reportsEscapeAttr(filters.top || '10')}" onchange="updateReportsFilter('${sectionId}', 'top', this.value)"></div>` : ''}
        ${sectionId === 'cash' ? `<div class="form-group"><label>Tipo movimiento</label><select onchange="updateReportsFilter('${sectionId}', 'cashType', this.value)">${reportsBuildOptions(['Venta', 'Ingreso', 'Gasto', 'Retiro'], filters.cashType, 'Todos')}</select></div>` : ''}
      </div>
      <div class="reports-toolbar-actions">
        <button class="btn btn-primary" type="button" onclick="renderReportsSection()">Buscar</button>
        <button class="btn btn-success" type="button" onclick="exportReportsExcel()">Exportar Excel</button>
        <button class="btn btn-secondary" type="button" onclick="exportReportsPdf()">Exportar PDF</button>
        <button class="btn btn-secondary" type="button" onclick="printReportsTable()">Imprimir</button>
      </div>
    </div>

    ${renderReportsSummary(result.summary)}

    <div class="reports-table-card">
      <div class="reports-table-toolbar">
        <div class="search-box reports-search-box">
          <input type="text" value="${reportsEscapeAttr(reportsUiState.search[sectionId])}" placeholder="${reportsEscapeAttr(config.searchPlaceholder)}" oninput="updateReportsSearch('${sectionId}', this.value)">
        </div>
      </div>
      <div class="sales-lines-table-wrap">
        <table class="sales-lines-table">
          <thead><tr>${result.columns.map((column) => `<th>${reportsEscapeHtml(column)}</th>`).join('')}</tr></thead>
          <tbody>
            ${rows.length === 0 ? `<tr><td colspan="${result.columns.length}" class="sales-empty-row">No hay resultados para los filtros seleccionados.</td></tr>` : rows.map((row) => `<tr>${row.map((cell) => `<td>${reportsEscapeHtml(cell)}</td>`).join('')}</tr>`).join('')}
          </tbody>
        </table>
      </div>
      <div class="sales-pagination">
        <span>Pagina ${reportsEscapeHtml(currentPage)} de ${reportsEscapeHtml(totalPages)}</span>
        <div class="btn-group">
          <button class="btn btn-sm btn-secondary" type="button" onclick="changeReportsPage('${sectionId}', -1)" ${currentPage <= 1 ? 'disabled' : ''}>Anterior</button>
          <button class="btn btn-sm btn-secondary" type="button" onclick="changeReportsPage('${sectionId}', 1)" ${currentPage >= totalPages ? 'disabled' : ''}>Siguiente</button>
        </div>
      </div>
    </div>
  `;
}

function renderReportsExcelSection() {
  return `
    <div class="reports-module-head">
      <div>
        <p class="reports-module-kicker">Reportes</p>
        <h2>Reportes a Excel</h2>
        <p>Generador de exportaciones personalizadas con filtros simples y salida rapida.</p>
      </div>
    </div>
    <div class="reports-excel-card">
      <div class="reports-filter-grid">
        <div class="form-group"><label>Modulo</label><select id="reports-excel-module">${reportsBuildOptions(['Articulos', 'Ventas', 'Compras', 'Clientes', 'Remitos', 'Cuentas Corrientes', 'Ranking de Ventas', 'Caja'], '', 'Seleccionar modulo')}</select></div>
        <div class="form-group"><label>Tipo reporte</label><input id="reports-excel-type" type="text" placeholder="Ej. Ventas entre fechas"></div>
        <div class="form-group"><label>Fecha desde</label><input id="reports-excel-from" type="date" value="${reportsEscapeAttr(reportsFormatInputDate(new Date()))}"></div>
        <div class="form-group"><label>Fecha hasta</label><input id="reports-excel-to" type="date" value="${reportsEscapeAttr(reportsFormatInputDate(new Date()))}"></div>
      </div>
      <div class="reports-toolbar-actions">
        <button class="btn btn-success" type="button" onclick="generateReportsExcelFromPanel()">Generar Excel</button>
      </div>
    </div>
  `;
}

window.renderReports = renderReports;
window.renderReportsSection = renderReportsSection;
window.updateReportsFilter = updateReportsFilter;
window.updateReportsSearch = updateReportsSearch;
window.updateReportsType = updateReportsType;
window.changeReportsPage = changeReportsPage;
window.exportReportsExcel = exportReportsExcel;
window.exportReportsPdf = exportReportsPdf;
window.printReportsTable = printReportsTable;
window.generateReportsExcelFromPanel = generateReportsExcelFromPanel;
