let currentPage = 'dashboard';

function getPages() {
  const settingsRender = typeof renderSettings === 'function' ? renderSettings : () => { 
    document.getElementById('page-content').innerHTML = '<div class="alert alert-warning">Cargando configuración...</div>'; 
  };
  
  const dashboardRender = typeof renderDashboard === 'function' ? renderDashboard : () => {};
  const productsRender = typeof renderProducts === 'function' ? renderProducts : () => {};
  const customersRender = typeof renderCustomers === 'function' ? renderCustomers : () => {};
  const salesRender = typeof renderSales === 'function' ? renderSales : () => {};
  const repairsRender = typeof renderRepairs === 'function' ? renderRepairs : () => {};
  const reportsRender = typeof renderReports === 'function' ? renderReports : () => {};
  const usersRender = typeof renderUsers === 'function' ? renderUsers : () => {};
  const merchandiseRender = typeof renderMerchandiseEntry === 'function' ? renderMerchandiseEntry : () => {};
  const ncProveedorRender = typeof renderNcProveedor === 'function' ? renderNcProveedor : () => {};
  const purchaseQueryRender = typeof renderPurchaseQuery === 'function' ? renderPurchaseQuery : () => {};
  const ncQueryRender = typeof renderNcQuery === 'function' ? renderNcQuery : () => {};
  const suppliersRender = typeof window.renderSuppliers === 'function' ? window.renderSuppliers : null;
  const supplierPaymentsRender = typeof renderSupplierPayments === 'function' ? renderSupplierPayments : () => {};
  
  const pages = {
    dashboard: { title: 'Inicio', icon: '📊', render: dashboardRender },
    products: { title: 'Artículos', icon: '📦', render: productsRender },
    customers: { title: 'Clientes', icon: '👥', render: customersRender },
    'merchandise-entry': { title: 'Ingreso de Mercadería', icon: '📥', render: merchandiseRender },
    'nc-proveedor': { title: 'N/C Proveedor', icon: '📤', render: ncProveedorRender },
    'purchase-query': { title: 'Listado de Compras', icon: '🔍', render: purchaseQueryRender },
    'nc-query': { title: 'Consulta de N/C', icon: '🔍', render: ncQueryRender },
    'supplier-payments': { title: 'Pagos a Proveedores', icon: '💳', render: supplierPaymentsRender },
    sales: { title: 'Ventas', icon: '💰', render: salesRender },
    suppliers: { title: 'Proveedores', icon: '🚚', render: suppliersRender },
    sellers: { title: 'Vendedores', icon: '💼', render: () => renderPlaceholder('Vendedores') },
    cash: { title: 'Caja', icon: '💵', render: () => renderPlaceholder('Caja') },
    repairs: { title: 'Reparaciones', icon: '🔧', render: repairsRender },
    invoices: { title: 'Remitos', icon: '📋', render: () => renderPlaceholder('Remitos') },
    quotes: { title: 'Presupuestos', icon: '📝', render: () => renderPlaceholder('Presupuestos') },
    'sales-query': { title: 'Consulta Ventas', icon: '🔍', render: () => renderPlaceholder('Consulta Ventas') },
    reports: { title: 'Reportes', icon: '📈', render: reportsRender },
    admin: { title: 'Administración', icon: '⚙️', render: () => renderPlaceholder('Administración') },
    tools: { title: 'Herramientas', icon: '🔨', render: () => renderPlaceholder('Herramientas') },
    help: { title: 'Ayuda', icon: '❓', render: () => renderPlaceholder('Ayuda') },
    users: { title: 'Usuarios', icon: '👤', render: usersRender },
    settings: { title: 'Configuración', icon: '⚙️', render: settingsRender }
  };
  
  return pages;
}

function renderPlaceholder(title) {
  document.getElementById('page-content').innerHTML = `
    <div class="card">
      <h2>${title}</h2>
      <p class="empty-state">Esta sección está en desarrollo.</p>
    </div>
  `;
}

function navigate(page) {
  const pages = getPages();
  
  if (!pages || !pages[page]) page = 'dashboard';
  currentPage = page;
  
  document.querySelectorAll('.nav-item').forEach(el => {
    el.classList.toggle('active', el.dataset.page === page);
  });
  
  const childPages = ['merchandise-entry', 'nc-proveedor', 'purchase-query', 'nc-query', 'supplier-payments', 'suppliers'];
  if (childPages.includes(page)) {
    document.getElementById('compras-group')?.classList.add('open');
  }
  
  document.getElementById('page-title').innerHTML = '<span id="page-icon" style="margin-right: 8px;"></span>' + pages[page].title;
  document.getElementById('page-icon').textContent = pages[page].icon || '';
  
  // Special case for suppliers - always resolve from window at call time
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
  } else {
    document.getElementById('page-content').innerHTML = '<div class="alert alert-warning">Página no disponible</div>';
  }
}

function handleRoute() {
  const hash = window.location.hash.slice(1) || 'dashboard';
  navigate(hash);
}

window.addEventListener('hashchange', handleRoute);
window.router = { navigate, currentPage };
