function dashboardEscapeHtml(value) {
  return app.escapeHtml(value ?? '');
}

function dashboardFormatDateTime(value) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return new Intl.DateTimeFormat('es-AR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  }).format(date);
}

function dashboardNormalizeStatus(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_')
    .replace(/-/g, '_');
}

function dashboardGetSaleStatusLabel(value) {
  const normalized = dashboardNormalizeStatus(value);
  const labels = {
    pending_payment: 'Pendiente de pago',
    paid: 'Pagado',
    ready_for_delivery: 'Listo para entregar',
    completed: 'Completado',
    on_hold: 'En espera',
    cancelled: 'Cancelado',
    refunded: 'Reintegrado',
    payment_failed: 'Pago fallido',
    processing: 'Procesando',
    pending: 'Pendiente',
    failed: 'Fallido'
  };
  return labels[normalized] || normalized.replace(/_/g, ' ');
}

function dashboardGetSaleStatusBadge(value) {
  const normalized = dashboardNormalizeStatus(value);
  let badgeClass = 'badge-blue';
  if (['completed', 'paid', 'ready_for_delivery', 'processing'].includes(normalized)) badgeClass = 'badge-green';
  if (['pending_payment', 'on_hold', 'pending'].includes(normalized)) badgeClass = 'badge-yellow';
  if (['cancelled', 'refunded', 'payment_failed', 'failed'].includes(normalized)) badgeClass = 'badge-red';
  return `<span class="badge ${badgeClass}">${dashboardEscapeHtml(dashboardGetSaleStatusLabel(value))}</span>`;
}

function dashboardIsOnlineSale(sale) {
  const channel = String((sale && sale.channel) || '').toLowerCase();
  return channel === 'woocommerce' || channel === 'web';
}

function dashboardGetOnlineUrgentSales(feed = []) {
  return (Array.isArray(feed) ? feed : []).filter((sale) => {
    const status = dashboardNormalizeStatus(sale.status);
    return ['pending_payment', 'paid', 'on_hold', 'ready_for_delivery', 'payment_failed', 'refunded'].includes(status);
  });
}

function dashboardRenderHero(stats, onlineFeed) {
  const urgentOnline = dashboardGetOnlineUrgentSales(onlineFeed);
  const onlinePending = urgentOnline.filter((sale) => ['pending_payment', 'on_hold'].includes(dashboardNormalizeStatus(sale.status))).length;
  const onlineReady = urgentOnline.filter((sale) => ['paid', 'ready_for_delivery'].includes(dashboardNormalizeStatus(sale.status))).length;

  return `
    <section class="dashboard-hero">
      <div class="dashboard-hero-main">
        <p class="dashboard-kicker">Operacion del dia</p>
        <h2>Inicio orientado a mostrador y ventas online</h2>
        <p class="dashboard-hero-copy">Todo lo importante para vender, preparar pedidos y resolver pendientes desde una sola vista.</p>
        <div class="dashboard-hero-metrics">
          <article class="dashboard-hero-pill">
            <span>Mostrador hoy</span>
            <strong>${dashboardEscapeHtml(app.formatMoney(stats.todaySales || 0))}</strong>
            <small>${dashboardEscapeHtml(stats.todayTransactions || 0)} comprobantes</small>
          </article>
          <article class="dashboard-hero-pill">
            <span>Pedidos online activos</span>
            <strong>${dashboardEscapeHtml(urgentOnline.length)}</strong>
            <small>${dashboardEscapeHtml(onlinePending)} pendientes, ${dashboardEscapeHtml(onlineReady)} en gestion</small>
          </article>
        </div>
      </div>
      <aside class="dashboard-hero-side">
        <div class="dashboard-hero-panel">
          <span class="dashboard-panel-label">Caja rapida</span>
          <strong>${dashboardEscapeHtml(app.formatMoney(stats.todaySales || 0))}</strong>
          <p>${dashboardEscapeHtml(stats.todayTransactions || 0)} ventas registradas hoy.</p>
          <a href="#sales" class="dashboard-action-link">Abrir mostrador</a>
        </div>
        <div class="dashboard-hero-panel is-accent">
          <span class="dashboard-panel-label">Cola web</span>
          <strong>${dashboardEscapeHtml(urgentOnline.length)}</strong>
          <p>Pedidos para revisar, preparar o cerrar desde WooCommerce.</p>
          <a href="#sales-web-orders" class="dashboard-action-link">Ir a pedidos web</a>
        </div>
      </aside>
    </section>
  `;
}

function dashboardRenderActionGrid() {
  const actions = [
    { href: '#sales', title: 'Facturar en mostrador', text: 'Abrir caja y registrar una venta local.', meta: 'Mostrador' },
    { href: '#sales-web-orders', title: 'Gestionar pedidos web', text: 'Revisar estados, preparar y finalizar ventas online.', meta: 'Online' },
    { href: '#sales-query-invoices', title: 'Consultar comprobantes', text: 'Buscar ventas, estados y datos del cliente.', meta: 'Control' },
    { href: '#cash-day', title: 'Caja del dia', text: 'Seguir ingresos, gastos y retiros en tiempo real.', meta: 'Caja' }
  ];

  return `
    <section class="dashboard-section">
      <div class="dashboard-section-head">
        <div>
          <p class="dashboard-kicker">Accesos clave</p>
          <h3>Lo que mas se usa durante la jornada</h3>
        </div>
      </div>
      <div class="dashboard-action-grid">
        ${actions.map((action) => `
          <a href="${dashboardEscapeHtml(action.href)}" class="dashboard-action-card">
            <span class="dashboard-action-meta">${dashboardEscapeHtml(action.meta)}</span>
            <strong>${dashboardEscapeHtml(action.title)}</strong>
            <p>${dashboardEscapeHtml(action.text)}</p>
          </a>
        `).join('')}
      </div>
    </section>
  `;
}

function dashboardRenderPulse(stats, alerts, onlineFeed) {
  const urgentOnline = dashboardGetOnlineUrgentSales(onlineFeed);
  const readyForPickup = Array.isArray(alerts.readyForPickup) ? alerts.readyForPickup.length : 0;
  const lowStock = Array.isArray(alerts.lowStock) ? alerts.lowStock.length : 0;

  return `
    <section class="dashboard-pulse-grid">
      <article class="dashboard-pulse-card">
        <span>Ventas del dia</span>
        <strong>${dashboardEscapeHtml(app.formatMoney(stats.todaySales || 0))}</strong>
        <small>${dashboardEscapeHtml(stats.todayTransactions || 0)} operaciones en mostrador y online.</small>
      </article>
      <article class="dashboard-pulse-card">
        <span>Cola online</span>
        <strong>${dashboardEscapeHtml(urgentOnline.length)}</strong>
        <small>Pedidos que necesitan seguimiento operativo.</small>
      </article>
      <article class="dashboard-pulse-card">
        <span>Stock sensible</span>
        <strong>${dashboardEscapeHtml(lowStock)}</strong>
        <small>Articulos en minimo para vigilar mientras se vende.</small>
      </article>
      <article class="dashboard-pulse-card">
        <span>Postventa</span>
        <strong>${dashboardEscapeHtml(readyForPickup)}</strong>
        <small>Reparaciones listas para retirar hoy.</small>
      </article>
    </section>
  `;
}

function dashboardRenderAttentionBoard(alerts, onlineFeed) {
  const urgentOnline = dashboardGetOnlineUrgentSales(onlineFeed).slice(0, 4);
  const lowStock = Array.isArray(alerts.lowStock) ? alerts.lowStock.slice(0, 4) : [];
  const readyForPickup = Array.isArray(alerts.readyForPickup) ? alerts.readyForPickup.slice(0, 4) : [];

  return `
    <section class="dashboard-section">
      <div class="dashboard-section-head">
        <div>
          <p class="dashboard-kicker">Atencion inmediata</p>
          <h3>Lo urgente del dia</h3>
        </div>
      </div>
      <div class="dashboard-board-grid">
        <article class="dashboard-board-card">
          <div class="dashboard-board-head">
            <h4>Pedidos web</h4>
            <a href="#sales-web-orders">Ver todos</a>
          </div>
          ${urgentOnline.length === 0
            ? '<div class="dashboard-empty-state">No hay pedidos online urgentes.</div>'
            : urgentOnline.map((sale) => `
              <button class="dashboard-list-item" type="button" onclick="window.location.hash='sales-web-orders'">
                <div>
                  <strong>${dashboardEscapeHtml(sale.customer_name || 'Cliente web')}</strong>
                  <p>${dashboardEscapeHtml(app.formatMoney(sale.total || 0))} · ${dashboardEscapeHtml(dashboardFormatDateTime(sale.created_at))}</p>
                </div>
                ${dashboardGetSaleStatusBadge(sale.status)}
              </button>
            `).join('')}
        </article>
        <article class="dashboard-board-card">
          <div class="dashboard-board-head">
            <h4>Stock minimo</h4>
            <a href="#products-stock-query">Revisar</a>
          </div>
          ${lowStock.length === 0
            ? '<div class="dashboard-empty-state">No hay alertas de stock.</div>'
            : lowStock.map((product) => `
              <div class="dashboard-list-item is-static">
                <div>
                  <strong>${dashboardEscapeHtml(product.name || 'Articulo')}</strong>
                  <p>${dashboardEscapeHtml(product.sku || 'Sin SKU')} · ${dashboardEscapeHtml(product.category_name || 'Sin rubro')}</p>
                </div>
                <span class="badge badge-red">Stock ${dashboardEscapeHtml(product.stock || 0)}</span>
              </div>
            `).join('')}
        </article>
        <article class="dashboard-board-card">
          <div class="dashboard-board-head">
            <h4>Entregas pendientes</h4>
            <a href="#repairs">Abrir reparaciones</a>
          </div>
          ${readyForPickup.length === 0
            ? '<div class="dashboard-empty-state">No hay equipos listos para retirar.</div>'
            : readyForPickup.map((repair) => `
              <div class="dashboard-list-item is-static">
                <div>
                  <strong>${dashboardEscapeHtml(repair.customer_name || 'Cliente')}</strong>
                  <p>${dashboardEscapeHtml(repair.brand || 'Equipo')} ${dashboardEscapeHtml(repair.model || '')}</p>
                </div>
                <span class="badge badge-green">Listo</span>
              </div>
            `).join('')}
        </article>
      </div>
    </section>
  `;
}

function dashboardRenderRecentActivity(activities) {
  const rows = Array.isArray(activities) ? activities.slice(0, 8) : [];

  return `
    <section class="dashboard-section">
      <div class="dashboard-section-head">
        <div>
          <p class="dashboard-kicker">Movimiento reciente</p>
          <h3>Ultimas operaciones registradas</h3>
        </div>
      </div>
      <div class="dashboard-feed-card">
        ${rows.length === 0
          ? '<div class="dashboard-empty-state">Todavia no hay actividad para mostrar.</div>'
          : rows.map((item) => {
            const isSale = item.type === 'sale';
            const isOnline = isSale && dashboardIsOnlineSale(item);
            const title = isSale
              ? (item.customer_name || 'Consumidor final')
              : (item.customer_name || 'Cliente');
            const subtitle = isSale
              ? `${app.formatMoney(item.total || 0)} · ${isOnline ? 'Venta online' : 'Mostrador'}`
              : `${item.brand || 'Equipo'} ${item.model || ''}`.trim();
            const badge = isSale
              ? (isOnline ? '<span class="badge badge-blue">Online</span>' : '<span class="badge badge-gray">Mostrador</span>')
              : '<span class="badge badge-purple">Reparacion</span>';
            return `
              <div class="dashboard-feed-item">
                <div class="dashboard-feed-main">
                  <strong>${dashboardEscapeHtml(title)}</strong>
                  <p>${dashboardEscapeHtml(subtitle)}</p>
                </div>
                <div class="dashboard-feed-side">
                  ${badge}
                  <small>${dashboardEscapeHtml(dashboardFormatDateTime(item.created_at))}</small>
                </div>
              </div>
            `;
          }).join('')}
      </div>
    </section>
  `;
}

async function renderDashboard() {
  const content = document.getElementById('page-content');
  content.innerHTML = '<div class="loading">Cargando...</div>';

  try {
    const [stats, alerts, recent, onlineFeed] = await Promise.all([
      api.dashboard.stats(),
      api.dashboard.alerts().catch(() => ({ lowStock: [], readyForPickup: [] })),
      api.dashboard.recent().catch(() => []),
      api.sales.onlineFeed().catch(() => [])
    ]);

    content.innerHTML = `
      <div class="dashboard-shell">
        ${dashboardRenderHero(stats || {}, onlineFeed || [])}
        ${dashboardRenderPulse(stats || {}, alerts || {}, onlineFeed || [])}
        ${dashboardRenderActionGrid()}
        ${dashboardRenderAttentionBoard(alerts || {}, onlineFeed || [])}
        ${dashboardRenderRecentActivity(recent || [])}
      </div>
    `;
  } catch (e) {
    content.innerHTML = '<div class="alert alert-warning">Error: ' + dashboardEscapeHtml(e.message) + '</div>';
  }
}

console.log('Dashboard loaded');
