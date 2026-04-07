import { useDashboardOverview } from './useDashboardOverview';
import type { DashboardActivityItem, DashboardAlerts, DashboardStats, OnlineSaleFeedItem } from '../../types/dashboard';

function formatMoney(value: number) {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    minimumFractionDigits: 2
  }).format(Number(value || 0));
}

function formatDateTime(value?: string) {
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

function normalizeStatus(value?: string | null) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_')
    .replace(/-/g, '_');
}

function getSaleStatusLabel(value?: string | null) {
  const normalized = normalizeStatus(value);
  const labels: Record<string, string> = {
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

function getSaleStatusBadgeClass(value?: string | null) {
  const normalized = normalizeStatus(value);
  if (['completed', 'paid', 'ready_for_delivery', 'processing'].includes(normalized)) return 'badge-green';
  if (['pending_payment', 'on_hold', 'pending'].includes(normalized)) return 'badge-yellow';
  if (['cancelled', 'refunded', 'payment_failed', 'failed'].includes(normalized)) return 'badge-red';
  return 'badge-blue';
}

function getOnlineUrgentSales(feed: OnlineSaleFeedItem[]) {
  return feed.filter((sale) => {
    const status = normalizeStatus(sale.status);
    return ['pending_payment', 'paid', 'on_hold', 'ready_for_delivery', 'payment_failed', 'refunded'].includes(status);
  });
}

function isOnlineSale(item: DashboardActivityItem) {
  const channel = String(item.channel || '').toLowerCase();
  return channel === 'woocommerce' || channel === 'web';
}

export function DashboardPage() {
  const dashboardQuery = useDashboardOverview();

  if (dashboardQuery.isLoading) {
    return <div className="card">Cargando...</div>;
  }

  if (dashboardQuery.isError || !dashboardQuery.data) {
    return (
      <div className="alert alert-warning">
        {dashboardQuery.error instanceof Error ? dashboardQuery.error.message : 'No se pudo cargar el dashboard.'}
      </div>
    );
  }

  const { stats, alerts, recentActivity, onlineFeed } = dashboardQuery.data;

  return (
    <div className="dashboard-shell">
      <DashboardHero stats={stats} onlineFeed={onlineFeed} />
      <DashboardPulse stats={stats} alerts={alerts} onlineFeed={onlineFeed} />
      <DashboardActionGrid />
      <DashboardAttentionBoard alerts={alerts} onlineFeed={onlineFeed} />
      <DashboardRecentActivity recentActivity={recentActivity} />
    </div>
  );
}

function DashboardHero({ stats, onlineFeed }: { stats: DashboardStats; onlineFeed: OnlineSaleFeedItem[] }) {
  const urgentOnline = getOnlineUrgentSales(onlineFeed);
  const onlinePending = urgentOnline.filter((sale) => ['pending_payment', 'on_hold'].includes(normalizeStatus(sale.status))).length;
  const onlineReady = urgentOnline.filter((sale) => ['paid', 'ready_for_delivery'].includes(normalizeStatus(sale.status))).length;

  return (
    <section className="dashboard-hero">
      <div className="dashboard-hero-main">
        <p className="dashboard-kicker">Operacion del dia</p>
        <h2>Inicio orientado a mostrador y ventas online</h2>
        <p className="dashboard-hero-copy">
          Todo lo importante para vender, preparar pedidos y resolver pendientes desde una sola vista.
        </p>
        <div className="dashboard-hero-metrics">
          <article className="dashboard-hero-pill">
            <span>Mostrador hoy</span>
            <strong>{formatMoney(stats.todaySales || 0)}</strong>
            <small>{stats.todayTransactions || 0} comprobantes</small>
          </article>
          <article className="dashboard-hero-pill">
            <span>Pedidos online activos</span>
            <strong>{urgentOnline.length}</strong>
            <small>{onlinePending} pendientes, {onlineReady} en gestion</small>
          </article>
        </div>
      </div>
      <aside className="dashboard-hero-side">
        <div className="dashboard-hero-panel">
          <span className="dashboard-panel-label">Caja rapida</span>
          <strong>{formatMoney(stats.todaySales || 0)}</strong>
          <p>{stats.todayTransactions || 0} ventas registradas hoy.</p>
          <a href="#sales" className="dashboard-action-link">Abrir mostrador</a>
        </div>
        <div className="dashboard-hero-panel is-accent">
          <span className="dashboard-panel-label">Cola web</span>
          <strong>{urgentOnline.length}</strong>
          <p>Pedidos para revisar, preparar o cerrar desde WooCommerce.</p>
          <a href="#sales-web-orders" className="dashboard-action-link">Ir a pedidos web</a>
        </div>
      </aside>
    </section>
  );
}

function DashboardPulse({ stats, alerts, onlineFeed }: { stats: DashboardStats; alerts: DashboardAlerts; onlineFeed: OnlineSaleFeedItem[] }) {
  const urgentOnline = getOnlineUrgentSales(onlineFeed);
  const readyForPickup = Array.isArray(alerts.readyForPickup) ? alerts.readyForPickup.length : 0;
  const lowStock = Array.isArray(alerts.lowStock) ? alerts.lowStock.length : 0;

  return (
    <section className="dashboard-pulse-grid">
      <article className="dashboard-pulse-card">
        <span>Ventas del dia</span>
        <strong>{formatMoney(stats.todaySales || 0)}</strong>
        <small>{stats.todayTransactions || 0} operaciones en mostrador y online.</small>
      </article>
      <article className="dashboard-pulse-card">
        <span>Cola online</span>
        <strong>{urgentOnline.length}</strong>
        <small>Pedidos que necesitan seguimiento operativo.</small>
      </article>
      <article className="dashboard-pulse-card">
        <span>Stock sensible</span>
        <strong>{lowStock}</strong>
        <small>Articulos en minimo para vigilar mientras se vende.</small>
      </article>
      <article className="dashboard-pulse-card">
        <span>Postventa</span>
        <strong>{readyForPickup}</strong>
        <small>Reparaciones listas para retirar hoy.</small>
      </article>
    </section>
  );
}

function DashboardActionGrid() {
  const actions = [
    { href: '#sales', title: 'Facturar en mostrador', text: 'Abrir caja y registrar una venta local.', meta: 'Mostrador' },
    { href: '#sales-web-orders', title: 'Gestionar pedidos web', text: 'Revisar estados, preparar y finalizar ventas online.', meta: 'Online' },
    { href: '#sales-query-invoices', title: 'Consultar comprobantes', text: 'Buscar ventas, estados y datos del cliente.', meta: 'Control' },
    { href: '#cash-day', title: 'Caja del dia', text: 'Seguir ingresos, gastos y retiros en tiempo real.', meta: 'Caja' }
  ];

  return (
    <section className="dashboard-section">
      <div className="dashboard-section-head">
        <div>
          <p className="dashboard-kicker">Accesos clave</p>
          <h3>Lo que mas se usa durante la jornada</h3>
        </div>
      </div>
      <div className="dashboard-action-grid">
        {actions.map((action) => (
          <a key={action.href} href={action.href} className="dashboard-action-card">
            <span className="dashboard-action-meta">{action.meta}</span>
            <strong>{action.title}</strong>
            <p>{action.text}</p>
          </a>
        ))}
      </div>
    </section>
  );
}

function DashboardAttentionBoard({ alerts, onlineFeed }: { alerts: DashboardAlerts; onlineFeed: OnlineSaleFeedItem[] }) {
  const urgentOnline = getOnlineUrgentSales(onlineFeed).slice(0, 4);
  const lowStock = alerts.lowStock.slice(0, 4);
  const readyForPickup = alerts.readyForPickup.slice(0, 4);

  return (
    <section className="dashboard-section">
      <div className="dashboard-section-head">
        <div>
          <p className="dashboard-kicker">Atencion inmediata</p>
          <h3>Lo urgente del dia</h3>
        </div>
      </div>
      <div className="dashboard-board-grid">
        <article className="dashboard-board-card">
          <div className="dashboard-board-head">
            <h4>Pedidos web</h4>
            <a href="#sales-web-orders">Ver todos</a>
          </div>
          {urgentOnline.length === 0 ? (
            <div className="dashboard-empty-state">No hay pedidos online urgentes.</div>
          ) : (
            urgentOnline.map((sale) => (
              <a key={sale.id} href="#sales-web-orders" className="dashboard-list-item">
                <div>
                  <strong>{sale.customer_name || 'Cliente web'}</strong>
                  <p>{formatMoney(Number(sale.total || 0))} · {formatDateTime(sale.created_at)}</p>
                </div>
                <span className={`badge ${getSaleStatusBadgeClass(sale.status)}`}>{getSaleStatusLabel(sale.status)}</span>
              </a>
            ))
          )}
        </article>
        <article className="dashboard-board-card">
          <div className="dashboard-board-head">
            <h4>Stock minimo</h4>
            <a href="#products-stock-query">Revisar</a>
          </div>
          {lowStock.length === 0 ? (
            <div className="dashboard-empty-state">No hay alertas de stock.</div>
          ) : (
            lowStock.map((product) => (
              <div key={product.id} className="dashboard-list-item is-static">
                <div>
                  <strong>{product.name || 'Articulo'}</strong>
                  <p>{product.sku || 'Sin SKU'} · {product.category_name || 'Sin rubro'}</p>
                </div>
                <span className="badge badge-red">Stock {product.stock || 0}</span>
              </div>
            ))
          )}
        </article>
        <article className="dashboard-board-card">
          <div className="dashboard-board-head">
            <h4>Entregas pendientes</h4>
            <a href="#repairs">Abrir reparaciones</a>
          </div>
          {readyForPickup.length === 0 ? (
            <div className="dashboard-empty-state">No hay equipos listos para retirar.</div>
          ) : (
            readyForPickup.map((repair) => (
              <div key={repair.id} className="dashboard-list-item is-static">
                <div>
                  <strong>{repair.customer_name || 'Cliente'}</strong>
                  <p>{`${repair.brand || 'Equipo'} ${repair.model || ''}`.trim()}</p>
                </div>
                <span className="badge badge-green">Listo</span>
              </div>
            ))
          )}
        </article>
      </div>
    </section>
  );
}

function DashboardRecentActivity({ recentActivity }: { recentActivity: DashboardActivityItem[] }) {
  const rows = recentActivity.slice(0, 8);

  return (
    <section className="dashboard-section">
      <div className="dashboard-section-head">
        <div>
          <p className="dashboard-kicker">Movimiento reciente</p>
          <h3>Ultimas operaciones registradas</h3>
        </div>
      </div>
      <div className="dashboard-feed-card">
        {rows.length === 0 ? (
          <div className="dashboard-empty-state">Todavia no hay actividad para mostrar.</div>
        ) : (
          rows.map((item) => {
            const sale = item.type === 'sale';
            const online = sale && isOnlineSale(item);
            const title = item.customer_name || (sale ? 'Consumidor final' : 'Cliente');
            const subtitle = sale
              ? `${formatMoney(Number(item.total || 0))} · ${online ? 'Venta online' : 'Mostrador'}`
              : `${item.brand || 'Equipo'} ${item.model || ''}`.trim();

            return (
              <div key={`${item.type}-${item.id}`} className="dashboard-feed-item">
                <div className="dashboard-feed-main">
                  <strong>{title}</strong>
                  <p>{subtitle}</p>
                </div>
                <div className="dashboard-feed-side">
                  {sale ? (
                    online ? <span className="badge badge-blue">Online</span> : <span className="badge badge-gray">Mostrador</span>
                  ) : (
                    <span className="badge badge-purple">Reparacion</span>
                  )}
                  <small>{formatDateTime(item.created_at)}</small>
                </div>
              </div>
            );
          })
        )}
      </div>
    </section>
  );
}
