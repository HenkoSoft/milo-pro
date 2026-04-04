import { useMemo, useState, type ChangeEvent, type FormEvent } from 'react';
import { SectionCard } from '../../components/ui/SectionCard';
import { useAuth } from '../auth/AuthContext';
import { useSaleComposerData, useSaleMutations, useSalesHistory, useTodaySales } from './useSales';
import type { Product } from '../../types/product';
import type { Sale, SalePayloadItem } from '../../types/sale';

const RECEIPT_TYPES = ['A', 'B', 'C', 'X', 'PRESUPUESTO', 'TICKET'] as const;
const PAYMENT_METHODS = [
  { value: 'cash', label: 'Efectivo' },
  { value: 'digital', label: 'Pago digital' },
  { value: 'transfer', label: 'Transferencia' },
  { value: 'account', label: 'Cuenta corriente' },
  { value: 'check', label: 'Cheque' }
] as const;

interface CartItem {
  product_id: string;
  name: string;
  sku: string;
  quantity: string;
  unit_price: string;
  stock: number;
}

function formatMoney(value: number) {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    minimumFractionDigits: 2
  }).format(Number(value || 0));
}

function formatReceiptNumber(value: number | null | undefined) {
  return String(Number(value || 1)).padStart(8, '0');
}

function normalizePointOfSale(value: string) {
  const digits = String(value || '').replace(/\D/g, '');
  return (digits || '001').padStart(3, '0').slice(-3);
}

function getDefaultUnitPrice(product: Product | null) {
  return product ? String(Number(product.sale_price || 0)) : '0';
}

function buildSaleItem(product: Product, quantity: string): CartItem {
  return {
    product_id: String(product.id),
    name: product.name,
    sku: product.sku || `#${product.id}`,
    quantity,
    unit_price: getDefaultUnitPrice(product),
    stock: Number(product.stock || 0)
  };
}

function normalizeSaleItems(cart: CartItem[]): SalePayloadItem[] {
  return cart.map((item) => ({
    product_id: item.product_id,
    quantity: item.quantity,
    unit_price: item.unit_price
  }));
}

export function SalesPage() {
  const { currentUser } = useAuth();
  const [customerId, setCustomerId] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [receiptType, setReceiptType] = useState<string>('C');
  const [pointOfSale, setPointOfSale] = useState('001');
  const [notes, setNotes] = useState('');
  const [selectedProductId, setSelectedProductId] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [feedback, setFeedback] = useState('');
  const [historyCustomerId, setHistoryCustomerId] = useState('');
  const normalizedPointOfSale = normalizePointOfSale(pointOfSale);
  const { productsQuery, customersQuery, nextNumberQuery } = useSaleComposerData(receiptType, normalizedPointOfSale);
  const todayQuery = useTodaySales();
  const historyQuery = useSalesHistory({ customerId: historyCustomerId });
  const { createMutation } = useSaleMutations();

  const products = useMemo(
    () => (productsQuery.data || []).filter((product) => Number(product.stock || 0) > 0),
    [productsQuery.data]
  );
  const customers = customersQuery.data || [];
  const salesHistory = historyQuery.data || [];
  const selectedProduct = products.find((product) => String(product.id) === selectedProductId) || null;
  const cartTotal = cart.reduce((sum, item) => sum + Number(item.quantity || 0) * Number(item.unit_price || 0), 0);
  const nextReceiptLabel = `${receiptType} ${normalizedPointOfSale}-${formatReceiptNumber(nextNumberQuery.data?.receipt_number)}`;
  const isSaving = createMutation.isPending;
  const isAdmin = currentUser?.role === 'admin';

  function resetForm() {
    setCustomerId('');
    setPaymentMethod('cash');
    setReceiptType('C');
    setPointOfSale('001');
    setNotes('');
    setSelectedProductId('');
    setQuantity('1');
    setCart([]);
  }

  function handleAddItem() {
    setFeedback('');
    if (!selectedProduct) {
      setFeedback('Selecciona un articulo antes de agregarlo.');
      return;
    }

    const parsedQuantity = Number(quantity || 0);
    if (!Number.isFinite(parsedQuantity) || parsedQuantity <= 0) {
      setFeedback('La cantidad debe ser mayor a cero.');
      return;
    }

    setCart((current) => {
      const existing = current.find((item) => item.product_id === String(selectedProduct.id));
      if (existing) {
        return current.map((item) =>
          item.product_id === String(selectedProduct.id)
            ? { ...item, quantity: String(Number(item.quantity || 0) + parsedQuantity) }
            : item
        );
      }

      return [...current, buildSaleItem(selectedProduct, String(parsedQuantity))];
    });
    setSelectedProductId('');
    setQuantity('1');
  }

  function handleCartChange(productId: string, field: 'quantity' | 'unit_price', value: string) {
    setCart((current) =>
      current.map((item) =>
        item.product_id === productId
          ? { ...item, [field]: value }
          : item
      )
    );
  }

  function handleRemoveItem(productId: string) {
    setCart((current) => current.filter((item) => item.product_id !== productId));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFeedback('');

    if (cart.length === 0) {
      setFeedback('Debes agregar al menos un articulo a la venta.');
      return;
    }

    const invalidItem = cart.find((item) => Number(item.quantity || 0) <= 0 || Number(item.unit_price || 0) <= 0);
    if (invalidItem) {
      setFeedback('Revisa cantidades y precios antes de confirmar.');
      return;
    }

    try {
      const response = await createMutation.mutateAsync({
        customer_id: customerId,
        payment_method: paymentMethod,
        notes,
        receipt_type: receiptType,
        point_of_sale: normalizedPointOfSale,
        items: normalizeSaleItems(cart)
      });

      const failedSyncs = (response.syncResults || []).filter((item) => item.success === false);
      const syncMessage = failedSyncs.length > 0
        ? ` Venta guardada con advertencias de sync Woo en ${failedSyncs.length} articulo(s).`
        : '';

      setFeedback(`Venta ${response.sale.id} creada correctamente.${syncMessage}`);
      resetForm();
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : 'No se pudo registrar la venta.');
    }
  }

  return (
    <div className="space-y-6">
      <section className="grid gap-4 md:grid-cols-3">
        <MetricCard title="Ventas hoy" value={todayQuery.data ? String(todayQuery.data.salesCount) : '-'} />
        <MetricCard title="Facturacion hoy" value={todayQuery.data ? formatMoney(todayQuery.data.totalRevenue) : '-'} />
        <MetricCard title="Proximo comprobante" value={nextNumberQuery.isLoading ? '...' : nextReceiptLabel} />
      </section>

      <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <SectionCard title="Nueva venta" description="Alta local compatible con el endpoint actual de sales. El backend sigue resolviendo stock y sync Woo.">
          <form className="space-y-4" onSubmit={handleSubmit}>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <SelectField label="Cliente" value={customerId} onChange={setCustomerId} options={customers.map((customer) => ({ value: String(customer.id), label: customer.name }))} />
              <SelectField label="Pago" value={paymentMethod} onChange={setPaymentMethod} options={PAYMENT_METHODS.map((item) => ({ value: item.value, label: item.label }))} />
              <SelectField label="Comprobante" value={receiptType} onChange={setReceiptType} options={RECEIPT_TYPES.map((item) => ({ value: item, label: item }))} />
              <Field label="Punto de venta" value={pointOfSale} onChange={setPointOfSale} />
            </div>

            <TextAreaField label="Notas" value={notes} onChange={setNotes} rows={3} />

            <div className="rounded-3xl border border-slate-200 p-4">
              <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_120px_auto]">
                <SelectField
                  label="Articulo"
                  value={selectedProductId}
                  onChange={setSelectedProductId}
                  options={products.map((product) => ({
                    value: String(product.id),
                    label: `${product.name} � ${product.sku || '#'+product.id} � Stock ${product.stock ?? 0}`
                  }))}
                />
                <Field label="Cantidad" value={quantity} onChange={setQuantity} type="number" />
                <button
                  type="button"
                  onClick={handleAddItem}
                  className="mt-7 inline-flex items-center justify-center rounded-2xl bg-slate-900 px-4 py-3 text-sm font-medium text-white transition hover:bg-slate-800"
                >
                  Agregar
                </button>
              </div>

              <div className="mt-4 space-y-3">
                {cart.length === 0 ? (
                  <Notice text="Todavia no agregaste articulos al comprobante." />
                ) : (
                  cart.map((item) => (
                    <article key={item.product_id} className="rounded-2xl border border-slate-200 p-4">
                      <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_120px_140px_auto] md:items-end">
                        <div>
                          <h3 className="font-medium text-slate-900">{item.name}</h3>
                          <p className="text-sm text-slate-500">{item.sku} � Stock local {item.stock}</p>
                        </div>
                        <Field label="Cantidad" value={item.quantity} onChange={(value) => handleCartChange(item.product_id, 'quantity', value)} type="number" />
                        <Field label="Precio unitario" value={item.unit_price} onChange={(value) => handleCartChange(item.product_id, 'unit_price', value)} type="number" />
                        <button
                          type="button"
                          onClick={() => handleRemoveItem(item.product_id)}
                          className="inline-flex items-center justify-center rounded-2xl border border-rose-300 px-4 py-3 text-sm font-medium text-rose-700 transition hover:bg-rose-50"
                        >
                          Quitar
                        </button>
                      </div>
                    </article>
                  ))
                )}
              </div>
            </div>

            {feedback ? <InlineFeedback text={feedback} tone={feedback.includes('No ') || feedback.includes('Debes') || feedback.includes('Revisa') ? 'error' : 'info'} /> : null}

            <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-slate-50 px-4 py-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand">Total</p>
                <strong className="text-xl text-slate-900">{formatMoney(cartTotal)}</strong>
              </div>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={resetForm}
                  className="inline-flex items-center justify-center rounded-2xl border border-slate-300 px-4 py-3 text-sm font-medium text-slate-700 transition hover:bg-white"
                >
                  Limpiar
                </button>
                <button
                  type="submit"
                  disabled={isSaving || !isAdmin}
                  className="inline-flex items-center justify-center rounded-2xl bg-brand px-4 py-3 text-sm font-medium text-white transition hover:bg-teal-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isSaving ? 'Guardando...' : 'Registrar venta'}
                </button>
              </div>
            </div>
          </form>
        </SectionCard>

        <SectionCard title="Historial" description="Consulta de ventas usando la API actual, incluida la informacion de items. ">
          <SelectField label="Filtrar por cliente" value={historyCustomerId} onChange={setHistoryCustomerId} options={customers.map((customer) => ({ value: String(customer.id), label: customer.name }))} />

          <div className="mt-4 space-y-3">
            {historyQuery.isLoading ? (
              <Notice text="Cargando ventas..." />
            ) : historyQuery.isError ? (
              <ErrorNotice text={historyQuery.error instanceof Error ? historyQuery.error.message : 'No se pudo cargar el historial.'} />
            ) : salesHistory.length === 0 ? (
              <Notice text="No hay ventas para mostrar." />
            ) : (
              salesHistory.slice(0, 15).map((sale) => <SaleHistoryCard key={sale.id} sale={sale} />)
            )}
          </div>
        </SectionCard>
      </div>
    </div>
  );
}

function SaleHistoryCard({ sale }: { sale: Sale }) {
  return (
    <article className="rounded-2xl border border-slate-200 p-4">
      <div className="flex flex-col gap-2 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h3 className="font-medium text-slate-900">
            {sale.receipt_type || 'C'} {sale.point_of_sale || '001'}-{formatReceiptNumber(sale.receipt_number)}
          </h3>
          <p className="mt-1 text-sm text-slate-500">
            {[sale.customer_name || 'Consumidor final', sale.user_name, sale.payment_method].filter(Boolean).join(' � ')}
          </p>
          <p className="mt-1 text-sm text-slate-500">{sale.created_at ? new Date(sale.created_at).toLocaleString('es-AR') : '-'}</p>
          {sale.items && sale.items.length > 0 ? (
            <p className="mt-2 text-sm text-slate-600">{sale.items.map((item) => `${item.product_name || item.product_id} x${item.quantity}`).join(' � ')}</p>
          ) : null}
        </div>
        <strong className="text-lg text-slate-900">{formatMoney(sale.total)}</strong>
      </div>
    </article>
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

function Field({ label, value, onChange, type = 'text' }: { label: string; value: string; onChange: (value: string) => void; type?: 'text' | 'number' }) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-medium text-slate-700">{label}</span>
      <input
        className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20"
        type={type}
        value={value}
        onChange={(event: ChangeEvent<HTMLInputElement>) => onChange(event.target.value)}
      />
    </label>
  );
}

function SelectField({ label, value, onChange, options }: { label: string; value: string; onChange: (value: string) => void; options: Array<{ value: string; label: string }> }) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-medium text-slate-700">{label}</span>
      <select
        className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      >
        <option value="">Seleccionar</option>
        {options.map((option) => (
          <option key={`${label}-${option.value}`} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function TextAreaField({ label, value, onChange, rows }: { label: string; value: string; onChange: (value: string) => void; rows: number }) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-medium text-slate-700">{label}</span>
      <textarea
        className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        rows={rows}
      />
    </label>
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
