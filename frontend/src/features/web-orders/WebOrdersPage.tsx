import { useEffect, useMemo, useState, type ChangeEvent, type FormEvent } from 'react';
import { SectionCard } from '../../components/ui/SectionCard';
import { useSaleDetail, useSaleMutations, useOnlineFeed } from '../sales/useSales';
import type { Sale } from '../../types/sale';

const ORDER_STATUSES = [
  { value: 'pending_payment', label: 'Pendiente de pago' },
  { value: 'paid', label: 'Pagado' },
  { value: 'ready_for_delivery', label: 'Listo para entregar' },
  { value: 'completed', label: 'Completado' },
  { value: 'on_hold', label: 'En espera' },
  { value: 'cancelled', label: 'Cancelado' },
  { value: 'refunded', label: 'Reintegrado' },
  { value: 'payment_failed', label: 'Pago fallido' }
] as const;

function formatMoney(value: number) {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    minimumFractionDigits: 2
  }).format(Number(value || 0));
}

export function WebOrdersPage() {
  const [search, setSearch] = useState('');
  const [selectedSaleId, setSelectedSaleId] = useState<number | null>(null);
  const [status, setStatus] = useState('pending_payment');
  const [note, setNote] = useState('');
  const [syncToWoo, setSyncToWoo] = useState(true);
  const [feedback, setFeedback] = useState('');
  const feedQuery = useOnlineFeed(search);
  const detailQuery = useSaleDetail(selectedSaleId);
  const { updateStatusMutation } = useSaleMutations();

  const feed = feedQuery.data || [];
  const selectedSale = detailQuery.data || null;

  useEffect(() => {
    if (selectedSale) {
      setStatus(selectedSale.status || 'pending_payment');
      setNote('');
    }
  }, [selectedSale]);

  const counters = useMemo(() => {
    return ORDER_STATUSES.reduce<Record<string, number>>((acc, item) => {
      acc[item.value] = feed.filter((sale) => sale.status === item.value).length;
      return acc;
    }, {});
  }, [feed]);

  async function handleStatusSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedSaleId) return;
    setFeedback('');

    try {
      await updateStatusMutation.mutateAsync({
        id: selectedSaleId,
        payload: {
          status,
          note,
          sync_to_woo: syncToWoo
        }
      });
      setFeedback('Estado actualizado correctamente.');
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : 'No se pudo actualizar el estado.');
    }
  }

  return (
    <div className="space-y-6">
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {ORDER_STATUSES.slice(0, 4).map((item) => (
          <MetricCard key={item.value} title={item.label} value={String(counters[item.value] || 0)} />
        ))}
      </section>

      <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
        <SectionCard title="Pedidos web" description="Feed online usando la API actual de sales y los estados internos sincronizados con WooCommerce.">
          <input
            className="mb-4 w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20"
            placeholder="Buscar por cliente, notas, canal o estado"
            value={search}
            onChange={(event: ChangeEvent<HTMLInputElement>) => setSearch(event.target.value)}
          />

          {feedQuery.isLoading ? (
            <Notice text="Cargando pedidos web..." />
          ) : feedQuery.isError ? (
            <ErrorNotice text={feedQuery.error instanceof Error ? feedQuery.error.message : 'No se pudo cargar el feed online.'} />
          ) : feed.length === 0 ? (
            <Notice text="No hay pedidos web para mostrar." />
          ) : (
            <div className="space-y-3">
              {feed.map((sale) => (
                <button
                  key={sale.id}
                  type="button"
                  onClick={() => setSelectedSaleId(sale.id)}
                  className={`w-full rounded-2xl border px-4 py-4 text-left transition ${selectedSaleId === sale.id ? 'border-brand bg-teal-50' : 'border-slate-200 bg-white hover:bg-slate-50'}`}
                >
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                      <h3 className="font-medium text-slate-900">Pedido #{sale.id}</h3>
                      <p className="mt-1 text-sm text-slate-500">{[sale.customer_name || 'Cliente web', sale.channel || 'woocommerce', sale.receipt_type].filter(Boolean).join(' · ')}</p>
                      <p className="mt-1 text-sm text-slate-500">{sale.created_at ? new Date(sale.created_at).toLocaleString('es-AR') : '-'}</p>
                    </div>
                    <div className="text-right">
                      <span className="rounded-full bg-slate-900 px-3 py-1 text-xs font-medium text-white">{sale.status || 'pending_payment'}</span>
                      <div className="mt-2 text-sm font-medium text-slate-900">{formatMoney(sale.total)}</div>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </SectionCard>

        <SectionCard title="Detalle y estado" description="Actualizacion controlada del estado usando el endpoint actual y opcionalmente sincronizando con WooCommerce.">
          {!selectedSaleId ? (
            <Notice text="Selecciona un pedido web para ver detalle y actualizar su estado." />
          ) : detailQuery.isLoading ? (
            <Notice text="Cargando detalle..." />
          ) : detailQuery.isError || !selectedSale ? (
            <ErrorNotice text={detailQuery.error instanceof Error ? detailQuery.error.message : 'No se pudo cargar el pedido.'} />
          ) : (
            <div className="space-y-4">
              <div className="rounded-2xl border border-slate-200 p-4">
                <h3 className="font-medium text-slate-900">Pedido #{selectedSale.id}</h3>
                <p className="mt-1 text-sm text-slate-500">{[selectedSale.customer_name || 'Cliente web', selectedSale.customer_phone, selectedSale.channel].filter(Boolean).join(' · ')}</p>
                <p className="mt-1 text-sm text-slate-500">{selectedSale.notes || 'Sin notas comerciales.'}</p>
              </div>

              {selectedSale.items && selectedSale.items.length > 0 ? (
                <div className="rounded-2xl border border-slate-200 p-4">
                  <h3 className="mb-3 text-sm font-semibold uppercase tracking-[0.2em] text-brand">Articulos</h3>
                  <div className="space-y-2">
                    {selectedSale.items.map((item) => (
                      <div key={`${selectedSale.id}-${item.product_id}-${item.id || item.sku || 'item'}`} className="flex items-center justify-between rounded-2xl bg-slate-50 px-3 py-3 text-sm text-slate-700">
                        <span>{item.product_name || `Producto ${item.product_id}`} x{item.quantity}</span>
                        <strong className="text-slate-900">{formatMoney(item.subtotal || item.unit_price * item.quantity)}</strong>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}

              <form className="space-y-4" onSubmit={handleStatusSubmit}>
                <label className="block">
                  <span className="mb-2 block text-sm font-medium text-slate-700">Nuevo estado</span>
                  <select
                    className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20"
                    value={status}
                    onChange={(event) => setStatus(event.target.value)}
                  >
                    {ORDER_STATUSES.map((item) => (
                      <option key={item.value} value={item.value}>{item.label}</option>
                    ))}
                  </select>
                </label>

                <label className="block">
                  <span className="mb-2 block text-sm font-medium text-slate-700">Nota interna</span>
                  <textarea
                    className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20"
                    value={note}
                    onChange={(event) => setNote(event.target.value)}
                    rows={4}
                  />
                </label>

                <label className="inline-flex items-center gap-2 rounded-2xl border border-slate-300 px-4 py-3 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    checked={syncToWoo}
                    onChange={(event) => setSyncToWoo(event.target.checked)}
                  />
                  Sincronizar cambio a WooCommerce
                </label>

                {feedback ? <InlineFeedback text={feedback} tone={feedback.includes('No ') ? 'error' : 'info'} /> : null}

                <button
                  type="submit"
                  disabled={updateStatusMutation.isPending}
                  className="inline-flex items-center justify-center rounded-2xl bg-brand px-4 py-3 text-sm font-medium text-white transition hover:bg-teal-700 disabled:opacity-60"
                >
                  {updateStatusMutation.isPending ? 'Actualizando...' : 'Guardar estado'}
                </button>
              </form>
            </div>
          )}
        </SectionCard>
      </div>
    </div>
  );
}

function MetricCard({ title, value }: { title: string; value: string }) {
  return (
    <article className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand">{title}</p>
      <strong className="mt-3 block text-2xl font-semibold text-slate-900">{value}</strong>
    </article>
  );
}

function Notice({ text }: { text: string }) {
  return <div className="rounded-2xl border border-dashed border-slate-300 px-4 py-6 text-sm text-slate-500">{text}</div>;
}

function ErrorNotice({ text }: { text: string }) {
  return <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-6 text-sm text-rose-700">{text}</div>;
}

function InlineFeedback({ text, tone }: { text: string; tone: 'info' | 'error' }) {
  return (
    <div className={`rounded-2xl px-4 py-3 text-sm ${tone === 'error' ? 'border border-rose-200 bg-rose-50 text-rose-700' : 'border border-sky-200 bg-sky-50 text-sky-700'}`}>
      {text}
    </div>
  );
}
