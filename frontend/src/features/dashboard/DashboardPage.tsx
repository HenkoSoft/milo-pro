import { SectionCard } from '../../components/ui/SectionCard';
import { useDashboardOverview } from './useDashboardOverview';

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

export function DashboardPage() {
  const dashboardQuery = useDashboardOverview();

  if (dashboardQuery.isLoading) {
    return <div className="rounded-3xl border border-slate-200 bg-white p-6 text-sm text-slate-600 shadow-sm">Cargando dashboard...</div>;
  }

  if (dashboardQuery.isError || !dashboardQuery.data) {
    return <div className="rounded-3xl border border-rose-200 bg-rose-50 p-6 text-sm text-rose-700 shadow-sm">{dashboardQuery.error instanceof Error ? dashboardQuery.error.message : 'No se pudo cargar el dashboard.'}</div>;
  }

  const { stats, alerts, recentActivity, onlineFeed } = dashboardQuery.data;

  return (
    <div className="space-y-6">
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Ventas del dia" value={formatMoney(stats.todaySales)} hint={`${stats.todayTransactions} operaciones`} />
        <MetricCard label="Clientes" value={String(stats.totalCustomers)} hint="Base activa" />
        <MetricCard label="Stock sensible" value={String(stats.lowStockProducts)} hint="Productos en minimo" />
        <MetricCard label="Reparaciones activas" value={String(stats.activeRepairs)} hint={`${stats.readyForPickup} listas para retirar`} />
      </section>

      <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <SectionCard title="Actividad reciente" description="Ventas y reparaciones registradas en las ultimas operaciones.">
          <div className="space-y-3">
            {recentActivity.length === 0 ? (
              <EmptyState text="Todavia no hay actividad para mostrar." />
            ) : (
              recentActivity.map((item) => (
                <div key={`${item.type}-${item.id}`} className="flex items-center justify-between gap-4 rounded-2xl border border-slate-200 px-4 py-3">
                  <div>
                    <p className="font-medium text-slate-900">{item.customer_name || 'Cliente'}</p>
                    <p className="text-sm text-slate-500">
                      {item.type === 'sale'
                        ? `${formatMoney(Number(item.total || 0))} · ${item.channel || 'local'}`
                        : `${item.brand || 'Equipo'} ${item.model || ''}`.trim()}
                    </p>
                  </div>
                  <span className="text-xs text-slate-500">{formatDateTime(item.created_at)}</span>
                </div>
              ))
            )}
          </div>
        </SectionCard>

        <SectionCard title="Pedidos online" description="Feed operativo de ventas web activas.">
          <div className="space-y-3">
            {onlineFeed.length === 0 ? (
              <EmptyState text="No hay pedidos online activos." />
            ) : (
              onlineFeed.slice(0, 6).map((sale) => (
                <div key={sale.id} className="rounded-2xl border border-slate-200 px-4 py-3">
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-medium text-slate-900">{sale.customer_name || 'Cliente web'}</p>
                    <span className="rounded-full bg-slate-900 px-3 py-1 text-xs font-medium text-white">{sale.status || 'sin estado'}</span>
                  </div>
                  <p className="mt-1 text-sm text-slate-500">{formatMoney(Number(sale.total || 0))} · {formatDateTime(sale.created_at)}</p>
                </div>
              ))
            )}
          </div>
        </SectionCard>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <SectionCard title="Stock minimo" description="Articulos que requieren seguimiento cercano.">
          <div className="space-y-3">
            {alerts.lowStock.length === 0 ? (
              <EmptyState text="No hay alertas de stock minimo." />
            ) : (
              alerts.lowStock.map((product) => (
                <div key={product.id} className="flex items-center justify-between gap-4 rounded-2xl border border-slate-200 px-4 py-3">
                  <div>
                    <p className="font-medium text-slate-900">{product.name}</p>
                    <p className="text-sm text-slate-500">{product.sku || 'Sin SKU'} · {product.category_name || 'Sin categoria'}</p>
                  </div>
                  <span className="text-sm font-medium text-rose-600">{product.stock} / min {product.min_stock}</span>
                </div>
              ))
            )}
          </div>
        </SectionCard>

        <SectionCard title="Listo para retirar" description="Equipos que ya pueden salir del taller.">
          <div className="space-y-3">
            {alerts.readyForPickup.length === 0 ? (
              <EmptyState text="No hay reparaciones listas para retirar." />
            ) : (
              alerts.readyForPickup.map((repair) => (
                <div key={repair.id} className="rounded-2xl border border-slate-200 px-4 py-3">
                  <p className="font-medium text-slate-900">{repair.customer_name || 'Cliente'}</p>
                  <p className="text-sm text-slate-500">{`${repair.brand || 'Equipo'} ${repair.model || ''}`.trim()}</p>
                </div>
              ))
            )}
          </div>
        </SectionCard>
      </div>
    </div>
  );
}

function MetricCard({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <article className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand">{label}</p>
      <strong className="mt-3 block text-2xl font-semibold text-slate-900">{value}</strong>
      <p className="mt-2 text-sm text-slate-500">{hint}</p>
    </article>
  );
}

function EmptyState({ text }: { text: string }) {
  return <div className="rounded-2xl border border-dashed border-slate-300 px-4 py-6 text-sm text-slate-500">{text}</div>;
}
