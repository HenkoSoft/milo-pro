let currentPage = 'dashboard';

function normalizePageHeading(value) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function dedupePageContentHeading() {
  const pageTitle = document.getElementById('page-title');
  const content = document.getElementById('page-content');
  if (!pageTitle || !content) return;

  const titleText = normalizePageHeading(pageTitle.textContent);
  if (!titleText) return;

  const contentHead = content.querySelector('.products-module-head, .sales-module-head, .admin-module-head, .reports-module-head, .cash-module-head, .sellers-module-head, .tools-module-head, .help-module-head');
  if (!contentHead) return;

  const contentTitle = contentHead.querySelector('h2');
  const contentKicker = contentHead.querySelector('p');
  const contentTitleText = contentTitle ? normalizePageHeading(contentTitle.textContent) : '';
  const contentKickerText = contentKicker ? normalizePageHeading(contentKicker.textContent) : '';

  if (contentTitle) {
    contentTitle.hidden = contentTitleText === titleText;
  }

  if (contentKicker) {
    const kickerIsDuplicate = contentKickerText === titleText
      || (contentTitleText && (contentTitleText === contentKickerText || contentTitleText.startsWith(contentKickerText + ' ')));
    contentKicker.hidden = kickerIsDuplicate;
  }
}

function schedulePageHeadingDedupe() {
  dedupePageContentHeading();
  window.requestAnimationFrame(dedupePageContentHeading);
  window.setTimeout(dedupePageContentHeading, 120);
  window.setTimeout(dedupePageContentHeading, 400);
}

function getPages() {
  const settingsRender = typeof renderSettings === 'function' ? renderSettings : () => {
    document.getElementById('page-content').innerHTML = '<div class="alert alert-warning">Cargando configuracion...</div>';
  };

  const dashboardRender = typeof renderDashboard === 'function' ? renderDashboard : () => {};
  const customersRender = typeof renderCustomers === 'function' ? renderCustomers : () => {};
  const repairsRender = typeof renderRepairs === 'function' ? renderRepairs : () => {};
  const reportsRender = typeof renderReports === 'function' ? renderReports : () => {};
  const toolsRender = typeof renderTools === 'function' ? renderTools : () => {};
  const helpRender = typeof renderHelp === 'function' ? renderHelp : () => {};
  const usersRender = typeof renderUsers === 'function' ? renderUsers : () => {};
  const merchandiseRender = typeof renderMerchandiseEntry === 'function' ? renderMerchandiseEntry : () => {};
  const ncProveedorRender = typeof renderNcProveedor === 'function' ? renderNcProveedor : () => {};
  const purchaseQueryRender = typeof renderPurchaseQuery === 'function' ? renderPurchaseQuery : () => {};
  const ncQueryRender = typeof renderNcQuery === 'function' ? renderNcQuery : () => {};
  const suppliersRender = typeof window.renderSuppliers === 'function' ? window.renderSuppliers : null;
  const supplierPaymentsRender = typeof renderSupplierPayments === 'function' ? renderSupplierPayments : () => {};
  const productsSectionRender = (section) => () => {
    if (typeof renderProducts === 'function') {
      renderProducts(section);
    }
  };
  const salesSectionRender = (section) => () => {
    if (typeof renderSales === 'function') {
      renderSales(section);
    }
  };
  const sellersSectionRender = (section) => () => {
    if (typeof renderSellers === 'function') {
      renderSellers(section);
    }
  };
  const cashSectionRender = (section) => () => {
    if (typeof renderCash === 'function') {
      renderCash(section);
    }
  };
  const reportsSectionRender = (section) => () => {
    if (typeof renderReports === 'function') {
      renderReports(section);
    }
  };
  const adminSectionRender = (section) => () => {
    if (typeof renderAdmin === 'function') {
      renderAdmin(section);
    }
  };

  return {
    dashboard: { title: 'Inicio', icon: '📊', render: dashboardRender },
    products: { title: 'Planilla', icon: '📦', render: productsSectionRender('planilla') },
    'products-price-update': { title: 'Actualizacion de Precios', icon: '💲', render: productsSectionRender('price-update') },
    'products-stock-adjustment': { title: 'Ajuste de Stock', icon: '📦', render: productsSectionRender('stock-adjustment') },
    'products-stock-output': { title: 'Salida de Mercaderia', icon: '📤', render: productsSectionRender('stock-output') },
    'products-stock-query': { title: 'Consulta de Salidas', icon: '🔍', render: productsSectionRender('stock-query') },
    'products-labels': { title: 'Imprimir Etiquetas', icon: '🏷️', render: productsSectionRender('labels') },
    'products-barcodes': { title: 'Impresion de Codigos de Barra', icon: '📊', render: productsSectionRender('barcodes') },
    'products-qr': { title: 'Impresion de Codigos QR', icon: '🔲', render: productsSectionRender('qr') },
    customers: { title: 'Clientes', icon: '👥', render: customersRender },
    'merchandise-entry': { title: 'Ingreso de Mercaderia', icon: '📥', render: merchandiseRender },
    'nc-proveedor': { title: 'N/C Proveedor', icon: '📤', render: ncProveedorRender },
    'purchase-query': { title: 'Listado de Compras', icon: '🔍', render: purchaseQueryRender },
    'nc-query': { title: 'Consulta de N/C', icon: '🔍', render: ncQueryRender },
    'supplier-payments': { title: 'Pagos a Proveedores', icon: '💳', render: supplierPaymentsRender },
    sales: { title: 'Facturas', icon: '💰', render: salesSectionRender('invoices') },
    'sales-delivery-notes': { title: 'Remitos', icon: '📋', render: salesSectionRender('delivery-notes') },
    'sales-quotes': { title: 'Presupuestos', icon: '📝', render: salesSectionRender('quotes') },
    'sales-orders': { title: 'Pedidos', icon: '🧺', render: salesSectionRender('orders') },
    'sales-credit-notes': { title: 'Notas de Credito', icon: '💳', render: salesSectionRender('credit-notes') },
    'sales-collections': { title: 'Cobranzas', icon: '💵', render: salesSectionRender('collections') },
    'sales-query-invoices': { title: 'Consultar Facturas', icon: '🔍', render: salesSectionRender('query-invoices') },
    'sales-query-delivery-notes': { title: 'Consultar Remitos', icon: '🔍', render: salesSectionRender('query-delivery-notes') },
    'sales-query-credit-notes': { title: 'Consultar Notas de Credito', icon: '🔍', render: salesSectionRender('query-credit-notes') },
    'sales-query-quotes': { title: 'Consultar Presupuestos', icon: '🔍', render: salesSectionRender('query-quotes') },
    'sales-query-orders': { title: 'Consultar Pedidos', icon: '🔍', render: salesSectionRender('query-orders') },
    'sales-web-orders': { title: 'Pedidos Web', icon: '🌐', render: salesSectionRender('web-orders') },
    suppliers: { title: 'Proveedores', icon: '🚚', render: suppliersRender },
    sellers: { title: 'Planilla de Vendedores', icon: '💼', render: sellersSectionRender('planilla') },
    'sellers-commissions': { title: 'Comisiones', icon: '💸', render: sellersSectionRender('commissions') },
    'sellers-payments': { title: 'Consulta de Pagos', icon: '💳', render: sellersSectionRender('payments') },
    'sellers-sales-report': { title: 'Reporte de Ventas', icon: '📈', render: sellersSectionRender('sales-report') },
    cash: { title: 'Ingresos varios', icon: '💵', render: cashSectionRender('income') },
    'cash-expenses': { title: 'Gastos varios', icon: '💵', render: cashSectionRender('expenses') },
    'cash-withdrawals': { title: 'Retiros', icon: '💵', render: cashSectionRender('withdrawals') },
    'cash-day': { title: 'Caja del dia', icon: '💵', render: cashSectionRender('day') },
    repairs: { title: 'Reparaciones', icon: '🔧', render: repairsRender },
    reports: { title: 'Articulos', icon: '📈', render: reportsSectionRender('articles') },
    'reports-sales': { title: 'Ventas', icon: '📈', render: reportsSectionRender('sales') },
    'reports-purchases': { title: 'Compras', icon: '📈', render: reportsSectionRender('purchases') },
    'reports-customers': { title: 'Clientes', icon: '📈', render: reportsSectionRender('customers') },
    'reports-delivery-notes': { title: 'Remitos', icon: '📈', render: reportsSectionRender('deliveryNotes') },
    'reports-accounts': { title: 'Cuentas Corrientes', icon: '📈', render: reportsSectionRender('accounts') },
    'reports-ranking': { title: 'Ranking de Ventas', icon: '📈', render: reportsSectionRender('ranking') },
    'reports-cash': { title: 'Caja', icon: '📈', render: reportsSectionRender('cash') },
    'reports-excel': { title: 'Reportes a Excel', icon: '📈', render: reportsSectionRender('excel') },
    admin: { title: 'Modificar Usuarios', icon: '⚙️', render: adminSectionRender('users') },
    'admin-users': { title: 'Modificar Usuarios', icon: '⚙️', render: adminSectionRender('users') },
    'admin-users-connected': { title: 'Usuarios Conectados', icon: '⚙️', render: adminSectionRender('users-connected') },
    'admin-aux-tables': { title: 'Tablas Auxiliares', icon: '⚙️', render: adminSectionRender('aux-tables') },
    'admin-config-general': { title: 'Datos Generales', icon: '⚙️', render: adminSectionRender('config-general') },
    'admin-config-documents': { title: 'Configuracion de Comprobantes', icon: '⚙️', render: adminSectionRender('config-documents') },
    'admin-config-mail': { title: 'Mail', icon: '⚙️', render: adminSectionRender('config-mail') },
    'admin-integrations-woocommerce': { title: 'WooCommerce', icon: '⚙️', render: adminSectionRender('integrations-woocommerce') },
    'admin-reset-data': { title: 'Borrar datos iniciales', icon: '⚙️', render: adminSectionRender('reset-data') },
    'admin-troubleshoot': { title: 'Solucionar Problemas', icon: '⚙️', render: adminSectionRender('troubleshoot') },
    tools: { title: 'Herramientas', icon: '🔨', render: () => toolsRender('sync') },
    'tools-sync': { title: 'Sincronizar articulos', icon: '🔨', render: () => toolsRender('sync') },
    'tools-offline-prices': { title: 'Consultar precios offline', icon: '🔨', render: () => toolsRender('offline-prices') },
    'tools-sync-status': { title: 'Estado de sincronizacion', icon: '🔨', render: () => toolsRender('sync-status') },
    help: { title: 'Guia de uso', icon: '❓', render: () => helpRender('guide') },
    'help-guide': { title: 'Guia de uso', icon: '❓', render: () => helpRender('guide') },
    'help-buy': { title: 'Como comprar', icon: '❓', render: () => helpRender('buy') },
    'help-support': { title: 'Soporte tecnico', icon: '❓', render: () => helpRender('support') },
    users: { title: 'Usuarios', icon: '👤', render: usersRender },
    settings: { title: 'WooCommerce', icon: '⚙️', render: settingsRender }
  };
}

function renderPlaceholder(title) {
  document.getElementById('page-content').innerHTML = `
    <div class="card">
      <h2>${title}</h2>
      <p class="empty-state">Esta seccion esta en desarrollo.</p>
    </div>
  `;
}

function navigate(page) {
  const pages = getPages();
  if (!pages || !pages[page]) page = 'dashboard';
  currentPage = page;

  document.querySelectorAll('.nav-group').forEach((group) => {
    group.classList.remove('open');
  });

  document.querySelectorAll('.nav-item').forEach((el) => {
    el.classList.toggle('active', el.dataset.page === page);
  });

  const comprasChildPages = ['merchandise-entry', 'nc-proveedor', 'purchase-query', 'nc-query', 'supplier-payments', 'suppliers'];
  const articulosChildPages = ['products', 'products-price-update', 'products-stock-adjustment', 'products-stock-output', 'products-stock-query', 'products-labels', 'products-barcodes', 'products-qr'];
  const ventasChildPages = ['sales', 'sales-delivery-notes', 'sales-quotes', 'sales-orders', 'sales-credit-notes', 'sales-collections', 'sales-query-invoices', 'sales-query-delivery-notes', 'sales-query-credit-notes', 'sales-query-quotes', 'sales-query-orders', 'sales-web-orders'];
  const vendedoresChildPages = ['sellers', 'sellers-commissions', 'sellers-payments', 'sellers-sales-report'];
  const cajaChildPages = ['cash', 'cash-expenses', 'cash-withdrawals', 'cash-day'];
  const reportesChildPages = ['reports', 'reports-sales', 'reports-purchases', 'reports-customers', 'reports-delivery-notes', 'reports-accounts', 'reports-ranking', 'reports-cash', 'reports-excel'];
  const adminChildPages = ['admin', 'admin-users', 'admin-users-connected', 'admin-aux-tables', 'admin-config-general', 'admin-config-documents', 'admin-config-mail', 'admin-integrations-woocommerce', 'admin-reset-data', 'admin-troubleshoot'];
  const toolsChildPages = ['tools', 'tools-sync', 'tools-offline-prices', 'tools-sync-status'];
  const helpChildPages = ['help', 'help-guide', 'help-buy', 'help-support'];

  if (comprasChildPages.includes(page)) {
    document.getElementById('compras-group')?.classList.add('open');
  }
  if (ventasChildPages.includes(page)) {
    document.getElementById('ventas-group')?.classList.add('open');
  }
  if (vendedoresChildPages.includes(page)) {
    document.getElementById('vendedores-group')?.classList.add('open');
  }
  if (cajaChildPages.includes(page)) {
    document.getElementById('caja-group')?.classList.add('open');
  }
  if (reportesChildPages.includes(page)) {
    document.getElementById('reportes-group')?.classList.add('open');
  }
  if (adminChildPages.includes(page)) {
    document.getElementById('admin-group')?.classList.add('open');
  }
  if (page === 'admin-integrations-woocommerce') {
    document.getElementById('admin-integrations-group')?.classList.add('open');
  }

  if (toolsChildPages.includes(page)) {
    document.querySelector('.nav-item[data-page="tools"]')?.classList.add('active');
  }
  if (helpChildPages.includes(page)) {
    document.querySelector('.nav-item[data-page="help"]')?.classList.add('active');
  }

  document.getElementById('page-title').innerHTML = '<span id="page-icon" style="margin-right: 8px;"></span>' + pages[page].title;
  document.getElementById('page-icon').textContent = pages[page].icon || '';

  let renderFunc = pages[page].render;
  if (page === 'suppliers' && typeof window.renderSuppliers === 'function') {
    renderFunc = window.renderSuppliers;
  }

  if (page === 'suppliers' && typeof renderFunc !== 'function') {
    document.getElementById('page-content').innerHTML = '<div class="alert alert-warning">La pantalla de proveedores no esta disponible en este momento.</div>';
    return;
  }

  if (typeof renderFunc === 'function') {
    renderFunc();
    schedulePageHeadingDedupe();
  } else {
    document.getElementById('page-content').innerHTML = '<div class="alert alert-warning">Pagina no disponible</div>';
  }
}

function handleRoute() {
  const hash = window.location.hash.slice(1) || 'dashboard';
  navigate(hash);
}

window.addEventListener('hashchange', handleRoute);
window.router = { navigate, currentPage };
