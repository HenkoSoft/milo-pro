import { useEffect, useMemo, useState, type ChangeEvent, type FormEvent } from 'react';
import { useAuth } from '../auth/AuthContext';
import { useSettings } from '../settings/useSettings';
import { useOnlineFeed, useSaleComposerData, useSaleDetail, useSaleMutations, useSalesHistory } from './useSales';
import { CUSTOMER_SELLERS } from '../customers/constants';
import type { Customer } from '../../types/customer';
import type { Product } from '../../types/product';
import type { Category } from '../../types/catalog';
import { createSale } from '../../services/sales';
import type { Sale, SalePayloadItem } from '../../types/sale';
import { getAvailableVoucherTypes, getDefaultVoucherType, getFiscalVoucherValidationMessage } from '../../utils/fiscalVouchers';
import { formatLocaleMoneyInput, parseLocaleNumber } from '../../utils/localeNumber';

const SALES_MODULES = [
  { id: 'sales', label: 'Facturas', title: 'Facturas', subtitle: '' },
  { id: 'sales-delivery-notes', label: 'Remitos', title: 'Remitos', subtitle: '' },
  { id: 'sales-quotes', label: 'Presupuestos', title: 'Presupuestos', subtitle: '' },
  { id: 'sales-orders', label: 'Pedidos', title: 'Pedidos', subtitle: '' },
  { id: 'sales-credit-notes', label: 'Notas de Credito', title: 'Notas de Credito', subtitle: '' },
  { id: 'sales-collections', label: 'Cobranzas', title: 'Cobranzas', subtitle: '' },
  { id: 'sales-query-invoices', label: 'Consultar Facturas', title: 'Consultar Facturas', subtitle: '' },
  { id: 'sales-query-delivery-notes', label: 'Consultar Remitos', title: 'Consultar Remitos', subtitle: '' },
  { id: 'sales-query-credit-notes', label: 'Consultar Notas de Credito', title: 'Consultar Notas de Credito', subtitle: '' },
  { id: 'sales-query-quotes', label: 'Consultar Presupuestos', title: 'Consultar Presupuestos', subtitle: '' },
  { id: 'sales-query-orders', label: 'Consultar Pedidos', title: 'Consultar Pedidos', subtitle: '' },
  { id: 'sales-web-orders', label: 'Pedidos Web', title: 'Pedidos Web', subtitle: '' }
] as const;

const PRICE_LISTS = ['Lista 1', 'Lista 2', 'Lista 3', 'Lista 4', 'Lista 5', 'Lista 6'] as const;
const IVA_CONDITIONS = ['Consumidor Final', 'Responsable Inscripto', 'Monotributista', 'Exento'] as const;

const DOCUMENT_STUB_CONFIG = {
  'sales-delivery-notes': {
    kicker: 'Remitos',
    title: 'Remitos',
    subtitle: 'Misma logica visual que facturacion para entregar mercaderia con datos claros del cliente.',
    numberLabel: 'Remito Nro',
    receiptLabel: 'P.Venta',
    documentButtonLabel: 'Aceptar',
    exitButtonLabel: 'Salir',
    checkboxLabel: 'Descontar stock',
    searchPlaceholder: 'Codigo articulo (F5)',
    totalLabel: 'Total remito'
  },
  'sales-quotes': {
    kicker: 'Presupuestos',
    title: 'Presupuestos',
    subtitle: 'Preparado para carga rapida de propuestas comerciales con los mismos bloques del modulo principal.',
    numberLabel: 'Presupuesto Nro',
    receiptLabel: 'P.Venta',
    documentButtonLabel: 'Aceptar',
    exitButtonLabel: 'Salir',
    searchPlaceholder: 'Codigo articulo (F5)'
  },
  'sales-orders': {
    kicker: 'Pedidos',
    title: 'Pedidos',
    subtitle: 'Estructura alineada con remitos y presupuestos para simplificar entrenamiento y carga.',
    numberLabel: 'Pedido Nro',
    receiptLabel: 'Lista',
    documentButtonLabel: 'Aceptar',
    exitButtonLabel: 'Salir',
    searchPlaceholder: 'Codigo articulo (F5)'
  },
  'sales-credit-notes': {
    kicker: 'Notas de Credito',
    title: 'Notas de Credito',
    subtitle: 'Pantalla visual consistente con facturacion para gestionar devoluciones y ajustes comerciales.',
    numberLabel: 'Nro Nota de Credito',
    receiptLabel: 'P.Venta',
    documentButtonLabel: 'Guardar nota de credito',
    exitButtonLabel: undefined,
    extraFieldLabel: 'Factura asociada',
    extraFieldButton: 'Buscar',
    checkboxLabel: 'Devolver stock',
    searchPlaceholder: 'Codigo articulo (F5)'
  }
} as const;

interface CartItem {
  product_id: string;
  name: string;
  sku: string;
  quantity: string;
  unit_price: string;
  stock: number;
  discount: string;
  manual_price?: boolean;
}

interface SalesPageProps {
  pageId: string;
}

interface DocumentStubConfig {
  kicker: string;
  title: string;
  subtitle: string;
  numberLabel: string;
  receiptLabel?: string;
  documentButtonLabel: string;
  exitButtonLabel?: string;
  checkboxLabel?: string;
  searchPlaceholder?: string;
  totalLabel?: string;
  extraFieldLabel?: string;
  extraFieldButton?: string;
}

interface SalePrintData {
  id: number;
  created_at?: string;
  receipt_type?: string | null;
  point_of_sale?: string | null;
  receipt_number?: number | null;
  business_name: string;
  customer_name: string;
  payment_method: string;
  seller: string;
  total: number;
  items: CartItem[];
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
  return (digits || '0001').padStart(4, '0').slice(-4);
}

function buildReceiptNumber(sale: Pick<Sale, 'id' | 'point_of_sale' | 'receipt_number'>) {
  return `${String(sale.point_of_sale || '001')}-${String(sale.receipt_number || sale.id).padStart(8, '0')}`;
}

function parseUtcDateString(value?: string | null) {
  const raw = String(value || '').trim();
  if (!raw) return null;
  const normalized = raw.includes('T') || /Z$|[+-]\d{2}:\d{2}$/.test(raw) ? raw : raw.replace(' ', 'T') + 'Z';
  const date = new Date(normalized);
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatSaleDate(value?: string | null) {
  const date = parseUtcDateString(value);
  return date ? date.toLocaleDateString('es-AR', { timeZone: 'America/Argentina/Buenos_Aires' }) : '-';
}

function formatSaleTime(value?: string | null) {
  const date = parseUtcDateString(value);
  return date
    ? date.toLocaleTimeString('es-AR', {
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'America/Argentina/Buenos_Aires'
    })
    : '-';
}

function printSalesTicket80mm(sale: SalePrintData) {
  const popup = window.open('', '_blank', 'width=420,height=720');
  if (!popup) return;

  const rows = sale.items.map((item) => {
    const qty = Number(item.quantity || 0);
    const price = parseLocaleNumber(item.unit_price);
    const lineTotal = getLineTotal(item, '0,00');
    return `
      <tr>
        <td>${qty}</td>
        <td>${item.name}</td>
        <td>${formatMoney(price)}</td>
        <td>${formatMoney(lineTotal)}</td>
      </tr>
    `;
  }).join('');

  popup.document.write(`
    <!doctype html>
    <html lang="es">
      <head>
        <meta charset="utf-8" />
        <title>Ticket ${sale.id}</title>
        <style>
          body { font-family: Arial, sans-serif; width: 80mm; margin: 0 auto; padding: 8px; color: #111; }
          .ticket-head, .ticket-total, .ticket-meta { text-align: center; }
          .ticket-head h1 { margin: 0 0 4px; font-size: 16px; }
          .ticket-head p, .ticket-meta p { margin: 2px 0; font-size: 11px; }
          table { width: 100%; border-collapse: collapse; margin-top: 8px; font-size: 11px; }
          th, td { padding: 4px 0; vertical-align: top; }
          th { border-bottom: 1px dashed #222; text-align: left; }
          td:last-child, th:last-child { text-align: right; }
          .ticket-total { margin-top: 10px; border-top: 1px dashed #222; padding-top: 8px; }
          .ticket-total strong { font-size: 16px; }
        </style>
      </head>
      <body>
        <div class="ticket-head">
          <h1>${sale.business_name}</h1>
          <p>${sale.receipt_type || 'C'} ${buildReceiptNumber(sale)}</p>
          <p>${formatSaleDate(sale.created_at)} ${formatSaleTime(sale.created_at)}</p>
        </div>
        <div class="ticket-meta">
          <p>Cliente: ${sale.customer_name}</p>
          <p>Vendedor: ${sale.seller || '-'}</p>
          <p>Pago: ${sale.payment_method || '-'}</p>
        </div>
        <table>
          <thead>
            <tr>
              <th>Cant</th>
              <th>Descripcion</th>
              <th>Precio</th>
              <th>Total</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
        <div class="ticket-total">
          <div>Total</div>
          <strong>${formatMoney(sale.total)}</strong>
        </div>
      </body>
    </html>
  `);
  popup.document.close();
  popup.focus();
  popup.print();
}

function buildSaleItem(product: Product): CartItem {
  return {
    product_id: String(product.id),
    name: product.name,
    sku: product.sku || `#${product.id}`,
    quantity: '1',
    unit_price: formatLocaleMoneyInput(product.sale_price || 0),
    stock: Number(product.stock || 0),
    discount: '0,00',
    manual_price: false
  };
}

function getPriceListKey(priceList: string) {
  const match = String(priceList || 'Lista 1').match(/(\d+)/);
  return match ? match[1] : '1';
}

function getProductPriceByList(product: Product, priceList: string) {
  const listKey = getPriceListKey(priceList);
  const directPrice = listKey === '1'
    ? Number(product.sale_price || 0)
    : Number((product as Product & Record<string, unknown>)[`sale_price_${listKey}`] || 0);
  return directPrice > 0 ? directPrice : Number(product.sale_price || 0);
}

function getLineTotal(item: CartItem, globalDiscount: string) {
  const quantity = Math.max(0, Number(item.quantity || 0));
  const price = Math.max(0, parseLocaleNumber(item.unit_price));
  const lineDiscount = Math.min(100, Math.max(0, parseLocaleNumber(item.discount)));
  const globalDiscountValue = Math.min(100, Math.max(0, parseLocaleNumber(globalDiscount)));
  return price * quantity * (1 - lineDiscount / 100) * (1 - globalDiscountValue / 100);
}

function safeImageUrl(value?: string | null) {
  const url = String(value ?? '').trim();
  if (!url) return '';
  if (/^data:image\//i.test(url)) return url;
  if (url.startsWith('/') || /^https?:\/\//i.test(url)) return url;
  return '';
}

function getProductImageUrl(product: Product) {
  return safeImageUrl(product.image_url || null);
}

function normalizeSaleItems(cart: CartItem[]): SalePayloadItem[] {
  return cart.map((item) => ({
    product_id: item.product_id,
    quantity: item.quantity,
    unit_price: String(parseLocaleNumber(item.unit_price))
  }));
}

function getModuleConfig(pageId: string) {
  return SALES_MODULES.find((module) => module.id === pageId) || SALES_MODULES[0];
}

function getSalesActionLabel(pageId: string) {
  switch (pageId) {
    case 'sales-delivery-notes':
      return 'Guardar Remito';
    case 'sales-quotes':
      return 'Guardar Presupuesto';
    case 'sales-orders':
      return 'Guardar Pedido';
    case 'sales-credit-notes':
      return 'Guardar N/C';
    default:
      return 'Facturar';
  }
}

function buildCustomerAddress(customer: Customer | null) {
  if (!customer) return '';
  return [customer.address, customer.city, customer.province].filter(Boolean).join(' - ');
}

function buildCustomerLookupCode(customer: Customer) {
  return `CL-${String(customer.id || '').padStart(4, '0')}`;
}

function getCategoryLabel(product: Product) {
  if (Array.isArray(product.categories) && product.categories.length > 0) {
    const category = product.categories[0] as Category;
    return category?.name || 'Sin categoria';
  }
  return product.category_name || 'Sin categoria';
}

function SalesCollectionsPanel({ customers }: { customers: Customer[] }) {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [tab, setTab] = useState<'customers' | 'account'>('customers');
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const salesHistoryQuery = useSalesHistory({});
  const salesHistory = salesHistoryQuery.data || [];

  const customersWithActivity = useMemo(() => {
    const totalsByCustomer = new Map<string, number>();
    salesHistory.forEach((sale) => {
      const customerId = String(sale.customer_id || '');
      if (!customerId) return;
      totalsByCustomer.set(customerId, (totalsByCustomer.get(customerId) || 0) + Number(sale.total || 0));
    });
    return customers.map((customer) => ({
      ...customer,
      balance: totalsByCustomer.get(String(customer.id)) || 0
    }));
  }, [customers, salesHistory]);

  const filteredCustomers = useMemo(() => {
    const normalized = search.trim().toLowerCase();
    return customersWithActivity.filter((customer) => {
      if (!normalized) return true;
      return [customer.id, customer.name, customer.tax_id, customer.zone]
        .some((value) => String(value || '').toLowerCase().includes(normalized));
    });
  }, [customersWithActivity, search]);

  const totalPages = Math.max(1, Math.ceil(filteredCustomers.length / 8));
  const safePage = Math.max(1, Math.min(totalPages, page));
  const visibleCustomers = filteredCustomers.slice((safePage - 1) * 8, safePage * 8);
  const activeCustomer = customers.find((customer) => String(customer.id) === selectedCustomerId) || null;
  const activeCustomerSales = salesHistory.filter((sale) => String(sale.customer_id || '') === String(activeCustomer?.id || ''));
  const activeCustomerTotal = activeCustomerSales.reduce((acc, sale) => acc + Number(sale.total || 0), 0);
  const debtorsCount = customersWithActivity.filter((item) => item.balance > 0).length;
  const sellersWithCustomers = new Set(customers.map((item) => item.seller).filter(Boolean)).size;
  const zonesWithCustomers = new Set(customers.map((item) => item.zone).filter(Boolean)).size;

  return (
    <div className="sales-module-shell">
      <div className="sales-module-head">
        <div>
          <p className="sales-module-kicker">Cuenta corriente</p>
          <h2>Cobranzas</h2>
        </div>
      </div>

      <div className="sales-collections-layout">
        <div className="sales-panel-stack">
          <div className="sales-mini-tabs">
            <button className={`sales-mini-tab${tab === 'customers' ? ' is-active' : ''}`} type="button" onClick={() => setTab('customers')}>Listado de clientes</button>
            <button className={`sales-mini-tab${tab === 'account' ? ' is-active' : ''}`} type="button" onClick={() => setTab('account')}>Cuenta corriente del cliente</button>
          </div>

          {tab === 'customers' ? (
            <div className="sales-table-card">
              <div className="sales-table-toolbar">
                <div><h3>Clientes</h3><p>Listado de clientes con saldo.</p></div>
                <div className="search-box">
                  <input
                    type="text"
                    value={search}
                    placeholder="Buscar cliente..."
                    onChange={(event) => {
                      setSearch(event.target.value);
                      setPage(1);
                    }}
                  />
                </div>
              </div>
              <div className="sales-lines-table-wrap">
                <table className="sales-lines-table">
                  <thead><tr><th>Codigo</th><th>Nombre</th><th>CUIT</th><th>Saldo</th><th>Acciones</th></tr></thead>
                  <tbody>
                    {salesHistoryQuery.isLoading ? (
                      <tr><td colSpan={5} className="sales-empty-row">Cargando...</td></tr>
                    ) : visibleCustomers.length === 0 ? (
                      <tr><td colSpan={5} className="sales-empty-row">No hay clientes para mostrar.</td></tr>
                    ) : visibleCustomers.map((customer) => (
                      <tr key={customer.id}>
                        <td>{customer.id}</td>
                        <td>{customer.name}</td>
                        <td>{customer.tax_id || '-'}</td>
                        <td>{formatMoney(Number(customer.balance || 0))}</td>
                        <td>
                          <button
                            className="btn btn-sm btn-secondary"
                            type="button"
                            onClick={() => {
                              setSelectedCustomerId(String(customer.id));
                              setTab('account');
                            }}
                          >
                            Ver Cta Cte
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="sales-pagination">
                <span>Pagina {safePage} de {totalPages}</span>
                <div className="btn-group">
                  <button className="btn btn-sm btn-secondary" type="button" onClick={() => setPage(Math.max(1, safePage - 1))} disabled={safePage <= 1}>Anterior</button>
                  <button className="btn btn-sm btn-secondary" type="button" onClick={() => setPage(Math.min(totalPages, safePage + 1))} disabled={safePage >= totalPages}>Siguiente</button>
                </div>
              </div>
            </div>
          ) : activeCustomer ? (
            <div className="sales-table-card">
              <div className="sales-table-toolbar">
                <div>
                  <h3>{activeCustomer.name}</h3>
                  <p>CUIT: {activeCustomer.tax_id || '-'} | Direccion: {buildCustomerAddress(activeCustomer) || '-'}</p>
                </div>
                <span className="sales-query-total">Saldo estimado: <strong>{formatMoney(activeCustomerTotal)}</strong></span>
              </div>
              <div className="sales-lines-table-wrap">
                <table className="sales-lines-table">
                  <thead><tr><th>Fecha</th><th>Hora</th><th>Comprobante</th><th>Obs</th><th>Total</th></tr></thead>
                  <tbody>
                    {activeCustomerSales.length === 0 ? (
                      <tr><td colSpan={5} className="sales-empty-row">No hay movimientos registrados para este cliente.</td></tr>
                    ) : activeCustomerSales.map((sale) => (
                      <tr key={sale.id}>
                        <td>{formatSaleDate(sale.created_at)}</td>
                        <td>{formatSaleTime(sale.created_at)}</td>
                        <td>{buildReceiptNumber(sale)}</td>
                        <td>{sale.notes || '-'}</td>
                        <td>{formatMoney(Number(sale.total || 0))}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="sales-empty-block">Selecciona un cliente desde "Listado de clientes" para ver su cuenta corriente.</div>
          )}
        </div>

        <aside className="sales-stats-stack">
          <div className="sales-stat-card"><span>Deudores</span><strong>{debtorsCount}</strong><small>Clientes con movimientos registrados.</small></div>
          <div className="sales-stat-card"><span>Deudores por vendedor</span><strong>{sellersWithCustomers || 0}</strong><small>Vendedores asociados en fichas de clientes.</small></div>
          <div className="sales-stat-card"><span>Deudores por zona</span><strong>{zonesWithCustomers || 0}</strong><small>Zonas identificadas para seguimiento comercial.</small></div>
        </aside>
      </div>
    </div>
  );
}

const WEB_ORDER_STATUSES = [
  { value: 'all', label: 'Todos' },
  { value: 'unmanaged', label: 'Sin gestionar' },
  { value: 'pending_payment', label: 'Pendientes' },
  { value: 'paid', label: 'Pagados' },
  { value: 'ready_for_delivery', label: 'Listos' },
  { value: 'completed', label: 'Completados' },
  { value: 'refunded', label: 'Devueltos' }
] as const;

function normalizeStatus(value?: string | null) {
  return String(value || '').trim().toLowerCase();
}

function getPriorityLabel(status?: string | null) {
  const normalized = normalizeStatus(status);
  if (['pending_payment', 'on_hold', 'payment_failed'].includes(normalized)) return 'Urgente';
  if (['paid', 'ready_for_delivery'].includes(normalized)) return 'En gestion';
  if (normalized === 'completed') return 'Cerrado';
  if (['refunded', 'cancelled'].includes(normalized)) return 'Incidencia';
  return 'Sin gestionar';
}

function filterWebOrders(sales: Sale[], filter: string, search: string) {
  const normalizedSearch = search.trim().toLowerCase();
  return sales.filter((sale) => {
    const status = normalizeStatus(sale.status);
    const matchesFilter =
      filter === 'all'
      || (filter === 'unmanaged' && !status)
      || status === filter
      || (filter === 'refunded' && ['refunded', 'cancelled'].includes(status));
    if (!matchesFilter) return false;
    if (!normalizedSearch) return true;
    return [sale.customer_name, sale.notes, sale.channel, sale.status, sale.receipt_type]
      .some((value) => String(value || '').toLowerCase().includes(normalizedSearch));
  });
}

function SalesWebOrdersPanel() {
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [selectedSaleId, setSelectedSaleId] = useState<number | null>(null);
  const [status, setStatus] = useState('pending_payment');
  const [note, setNote] = useState('');
  const [syncToWoo, setSyncToWoo] = useState(true);
  const [feedback, setFeedback] = useState('');
  const feedQuery = useOnlineFeed('');
  const detailQuery = useSaleDetail(selectedSaleId);
  const { updateStatusMutation } = useSaleMutations();
  const feed = feedQuery.data || [];

  useEffect(() => {
    const selectedSale = detailQuery.data;
    if (selectedSale) {
      setStatus(selectedSale.status || 'pending_payment');
      setNote('');
    }
  }, [detailQuery.data]);

  const filteredRows = useMemo(() => filterWebOrders(feed, filter, search), [feed, filter, search]);
  const counts = useMemo(() => ({
    all: feed.length,
    unmanaged: feed.filter((sale) => !normalizeStatus(sale.status)).length,
    pending_payment: feed.filter((sale) => normalizeStatus(sale.status) === 'pending_payment').length,
    paid: feed.filter((sale) => normalizeStatus(sale.status) === 'paid').length,
    ready_for_delivery: feed.filter((sale) => normalizeStatus(sale.status) === 'ready_for_delivery').length,
    completed: feed.filter((sale) => normalizeStatus(sale.status) === 'completed').length,
    refunded: feed.filter((sale) => ['refunded', 'cancelled'].includes(normalizeStatus(sale.status))).length
  }), [feed]);
  const totalPages = Math.max(1, Math.ceil(filteredRows.length / 8));
  const safePage = Math.max(1, Math.min(totalPages, page));
  const visibleRows = filteredRows.slice((safePage - 1) * 8, safePage * 8);
  const selectedSale = detailQuery.data || null;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
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
    <div className="sales-module-shell">
      <div className="sales-module-head">
        <div>
          <p className="sales-module-kicker">Operacion Web</p>
          <h2>Pedidos Web</h2>
        </div>
      </div>

      <div className="sales-web-summary-grid">
        <article className="sales-web-summary-card"><span>Pedidos web</span><strong>{counts.all}</strong></article>
        <article className="sales-web-summary-card"><span>Pendientes</span><strong>{counts.pending_payment}</strong></article>
        <article className="sales-web-summary-card"><span>En gestion</span><strong>{counts.paid + counts.ready_for_delivery}</strong></article>
        <article className="sales-web-summary-card"><span>Cerrados</span><strong>{counts.completed + counts.refunded}</strong></article>
        <article className="sales-web-summary-card"><span>Total</span><strong>{formatMoney(feed.reduce((sum, sale) => sum + Number(sale.total || 0), 0))}</strong></article>
      </div>

      <div className="sales-collections-layout">
        <div className="sales-panel-stack">
          <div className="sales-table-card">
            <div className="sales-table-toolbar sales-web-toolbar">
              <div className="sales-web-filter-tabs" role="tablist" aria-label="Filtros de pedidos web">
                {WEB_ORDER_STATUSES.map((item) => (
                  <button
                    key={item.value}
                    type="button"
                    className={`sales-mini-tab${filter === item.value ? ' is-active' : ''}`}
                    onClick={() => {
                      setFilter(item.value);
                      setPage(1);
                    }}
                  >
                    {item.label} ({counts[item.value as keyof typeof counts] || 0})
                  </button>
                ))}
              </div>
              <div className="search-box sales-query-search">
                <input
                  type="text"
                  value={search}
                  placeholder="Buscar pedido web..."
                  onChange={(event) => {
                    setSearch(event.target.value);
                    setPage(1);
                  }}
                />
              </div>
            </div>

            <div className="sales-web-filter-summary">
              <strong>{WEB_ORDER_STATUSES.find((item) => item.value === filter)?.label || 'Todos'}</strong>
              <span>{filteredRows.length} pedidos en esta vista</span>
            </div>

            <div className="sales-lines-table-wrap">
              <table className="sales-lines-table">
                <thead>
                  <tr>
                    <th>Fecha</th>
                    <th>Pedido</th>
                    <th>Cliente</th>
                    <th>Estado local</th>
                    <th>Estado Woo</th>
                    <th>Total</th>
                    <th>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {feedQuery.isLoading ? (
                    <tr><td colSpan={7} className="sales-empty-row">Cargando pedidos web...</td></tr>
                  ) : visibleRows.length === 0 ? (
                    <tr><td colSpan={7} className="sales-empty-row">No hay pedidos web para los filtros seleccionados.</td></tr>
                  ) : (
                    visibleRows.map((sale) => (
                      <tr key={sale.id} className="sales-online-row">
                        <td>{formatSaleDate(sale.created_at)}</td>
                        <td><div>{buildReceiptNumber(sale)}</div><small>{sale.id}</small></td>
                        <td>{sale.customer_name || 'Cliente web'}</td>
                        <td>
                          <div className="sales-web-state-cell">
                            <span className="badge badge-blue">{sale.status || 'pending_payment'}</span>
                            <span className="sales-web-priority-pill">{getPriorityLabel(sale.status)}</span>
                          </div>
                        </td>
                        <td>{sale.external_status || '-'}</td>
                        <td>{formatMoney(Number(sale.total || 0))}</td>
                        <td>
                          <button className="btn btn-sm btn-secondary" type="button" onClick={() => setSelectedSaleId(sale.id)}>
                            Ver
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <div className="sales-pagination">
              <span>Pagina {safePage} de {totalPages}</span>
              <div className="btn-group">
                <button className="btn btn-sm btn-secondary" type="button" onClick={() => setPage(Math.max(1, safePage - 1))} disabled={safePage <= 1}>Anterior</button>
                <button className="btn btn-sm btn-secondary" type="button" onClick={() => setPage(Math.min(totalPages, safePage + 1))} disabled={safePage >= totalPages}>Siguiente</button>
              </div>
            </div>
          </div>
        </div>

        <aside className="sales-stats-stack">
          <div className="sales-table-card sales-web-detail-card">
            {!selectedSaleId ? (
              <div className="sales-empty-block">Selecciona un pedido web para ver detalle y actualizar su estado.</div>
            ) : detailQuery.isLoading ? (
              <div className="sales-empty-block">Cargando detalle...</div>
            ) : !selectedSale ? (
              <div className="sales-empty-block">No se pudo cargar el pedido seleccionado.</div>
            ) : (
              <>
                <div className="sales-table-toolbar">
                  <div>
                    <h3>Pedido #{selectedSale.id}</h3>
                    <p>{[selectedSale.customer_name || 'Cliente web', selectedSale.customer_phone, selectedSale.channel].filter(Boolean).join(' - ')}</p>
                  </div>
                </div>

                <div className="sales-web-items">
                  {(selectedSale.items || []).length === 0 ? (
                    <div className="sales-empty-block">Sin articulos informados para este pedido.</div>
                  ) : (
                    selectedSale.items?.map((item) => (
                      <div key={`${selectedSale.id}-${item.product_id}-${item.id || item.sku || 'item'}`} className="sales-web-item-row">
                        <span>{item.product_name || `Producto ${item.product_id}`} x{item.quantity}</span>
                        <strong>{formatMoney(item.subtotal || item.unit_price * item.quantity)}</strong>
                      </div>
                    ))
                  )}
                </div>

                <form className="sales-web-status-form" onSubmit={handleSubmit}>
                  <div className="form-group">
                    <label>Nuevo estado</label>
                    <select value={status} onChange={(event) => setStatus(event.target.value)}>
                      {WEB_ORDER_STATUSES.filter((item) => item.value !== 'all' && item.value !== 'unmanaged').map((item) => (
                        <option key={item.value} value={item.value}>{item.label}</option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Nota operativa</label>
                    <textarea value={note} onChange={(event: ChangeEvent<HTMLTextAreaElement>) => setNote(event.target.value)} rows={4} />
                  </div>
                  <label className="sales-web-sync-check">
                    <input type="checkbox" checked={syncToWoo} onChange={(event) => setSyncToWoo(event.target.checked)} />
                    Sincronizar cambio a WooCommerce
                  </label>
                  {feedback ? <div className={`alert ${feedback.includes('No ') ? 'alert-warning' : 'alert-info'}`}>{feedback}</div> : null}
                  <button type="submit" className="btn btn-success" disabled={updateStatusMutation.isPending}>
                    {updateStatusMutation.isPending ? 'Actualizando...' : 'Guardar estado'}
                  </button>
                </form>
              </>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}

function getSalesQueryColumns(pageId: string, sellerName: string) {
  const dateCell = (sale: Sale) => formatSaleDate(sale.created_at);
  const timeCell = (sale: Sale) => formatSaleTime(sale.created_at);
  const totalCell = (sale: Sale) => formatMoney(Number(sale.total || 0));
  const statusCell = (sale: Sale) => sale.status || '-';

  if (pageId === 'sales-query-delivery-notes') {
    return [
      { label: 'Numero', render: buildReceiptNumber },
      { label: 'Fecha', render: dateCell },
      { label: 'Hora', render: timeCell },
      { label: 'Cliente', render: (sale: Sale) => sale.customer_name || 'Consumidor final' },
      { label: 'Total', render: totalCell }
    ];
  }

  if (pageId === 'sales-query-credit-notes') {
    return [
      { label: 'Numero', render: buildReceiptNumber },
      { label: 'Fecha', render: dateCell },
      { label: 'Hora', render: timeCell },
      { label: 'Cliente', render: (sale: Sale) => sale.customer_name || 'Consumidor final' },
      { label: 'Total', render: totalCell }
    ];
  }

  if (pageId === 'sales-query-quotes') {
    return [
      { label: 'Numero', render: buildReceiptNumber },
      { label: 'Fecha', render: dateCell },
      { label: 'Hora', render: timeCell },
      { label: 'Cliente', render: (sale: Sale) => sale.customer_name || 'Consumidor final' },
      { label: 'Estado', render: () => 'Emitido' },
      { label: 'Total', render: totalCell }
    ];
  }

  if (pageId === 'sales-query-orders') {
    return [
      { label: 'Numero', render: buildReceiptNumber },
      { label: 'Fecha', render: dateCell },
      { label: 'Hora', render: timeCell },
      { label: 'Cliente', render: (sale: Sale) => sale.customer_name || 'Consumidor final' },
      { label: 'Vendedor', render: (sale: Sale) => sale.user_name || sellerName },
      { label: 'Estado', render: statusCell },
      { label: 'Total', render: totalCell }
    ];
  }

  return [
    { label: 'Fecha', render: dateCell },
    { label: 'Hora', render: timeCell },
    { label: 'N fact.', render: buildReceiptNumber },
    { label: 'Cliente', render: (sale: Sale) => sale.customer_name || 'Consumidor final' },
    { label: 'Canal', render: (sale: Sale) => sale.channel || 'Local' },
    { label: 'Estado', render: statusCell },
    { label: 'Total', render: totalCell }
  ];
}

function SalesQueryPanel({ pageId, title, subtitle, sellerName }: { pageId: string; title: string; subtitle: string; sellerName: string }) {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const salesHistoryQuery = useSalesHistory({});
  const salesHistory = salesHistoryQuery.data || [];
  const columns = getSalesQueryColumns(pageId, sellerName);

  const rows = useMemo(() => {
    const normalized = search.trim().toLowerCase();
    if (!normalized) return salesHistory;
    return salesHistory.filter((sale) => {
      return [
        sale.customer_name,
        sale.notes,
        sale.channel,
        sale.status,
        sale.receipt_type,
        buildReceiptNumber(sale)
      ].some((value) => String(value || '').toLowerCase().includes(normalized));
    });
  }, [salesHistory, search]);

  const totalPages = Math.max(1, Math.ceil(rows.length / 8));
  const safePage = Math.max(1, Math.min(totalPages, page));
  const visibleRows = rows.slice((safePage - 1) * 8, safePage * 8);

  return (
    <div className="sales-module-shell">
      <div className="sales-module-head">
        <div>
          <p className="sales-module-kicker">Consultas</p>
          <h2>{title}</h2>
          {subtitle ? <p>{subtitle}</p> : null}
        </div>
      </div>

      <div className="sales-table-card">
        <div className="sales-table-toolbar">
          <button className="btn btn-secondary" type="button">Borrar entre fechas</button>
          <div className="search-box sales-query-search">
            <input
              type="text"
              value={search}
              placeholder="Buscar..."
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(1);
              }}
            />
          </div>
        </div>

        <div className="sales-lines-table-wrap">
          <table className="sales-lines-table">
            <thead>
              <tr>
                {columns.map((column) => <th key={column.label}>{column.label}</th>)}
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {salesHistoryQuery.isLoading ? (
                <tr><td colSpan={columns.length + 1} className="sales-empty-row">Cargando...</td></tr>
              ) : visibleRows.length === 0 ? (
                <tr><td colSpan={columns.length + 1} className="sales-empty-row">No hay registros para mostrar.</td></tr>
              ) : (
                visibleRows.map((sale) => (
                  <tr key={sale.id}>
                    {columns.map((column) => <td key={column.label}>{column.render(sale)}</td>)}
                    <td><div className="btn-group"><button className="btn btn-sm btn-secondary" type="button">Ver</button></div></td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="sales-pagination">
          <span>Pagina {safePage} de {totalPages}</span>
          <div className="btn-group">
            <button className="btn btn-sm btn-secondary" type="button" onClick={() => setPage(Math.max(1, safePage - 1))} disabled={safePage <= 1}>Anterior</button>
            <button className="btn btn-sm btn-secondary" type="button" onClick={() => setPage(Math.min(totalPages, safePage + 1))} disabled={safePage >= totalPages}>Siguiente</button>
          </div>
        </div>
      </div>
    </div>
  );
}

function SalesDocumentStub({ config, customers, sellerName }: { config: DocumentStubConfig; customers: Customer[]; sellerName: string }) {
  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="sales-module-shell">
      <div className="sales-module-head">
        <div>
          <p className="sales-module-kicker">{config.kicker}</p>
          <h2>{config.title}</h2>
          <p>{config.subtitle}</p>
        </div>
      </div>
      <div className="sales-workspace">
        <div className="sales-panel-stack">
          <div className="sales-form-card">
            <div className="sales-section-head">
              <div><p className="sales-section-kicker">Encabezado</p><h3>Datos del comprobante</h3></div>
            </div>
            <div className="sales-form-grid sales-form-grid--document">
              <div className="form-group"><label>{config.receiptLabel || 'P.Venta'}</label><input type="text" value="001" readOnly /></div>
              <div className="form-group"><label>{config.numberLabel}</label><input type="text" value="00000001" readOnly /></div>
              <div className="form-group"><label>Vendedor</label><select value={sellerName} onChange={() => undefined}><option value={sellerName}>{sellerName}</option></select></div>
              <div className="form-group"><label>Lista de precios</label><select value="Lista 1" onChange={() => undefined}>{PRICE_LISTS.map((item) => <option key={item} value={item}>{item}</option>)}</select></div>
              <div className="form-group"><label>Desc %</label><input type="number" value="0" readOnly /></div>
              <div className="form-group"><label>Fecha</label><input type="date" value={today} readOnly /></div>
              {config.extraFieldLabel ? (
                <div className="form-group sales-field-span-2">
                  <label>{config.extraFieldLabel}</label>
                  <div className="sales-inline-combo">
                    <input type="text" placeholder={config.extraFieldLabel} readOnly />
                    <button className="sales-addon-button sales-addon-button--wide" type="button">{config.extraFieldButton || 'Buscar'}</button>
                  </div>
                </div>
              ) : null}
            </div>
          </div>

          <div className="sales-form-card">
            <div className="sales-section-head">
              <div><p className="sales-section-kicker">Cliente</p><h3>Datos del cliente</h3></div>
              <div className="sales-shortcut-badge">F3</div>
            </div>
            <div className="sales-form-grid sales-form-grid--customer">
              <div className="form-group"><label>Codigo cliente</label><div className="sales-inline-combo"><input type="text" placeholder="Codigo" readOnly /><button className="sales-addon-button sales-addon-button--wide" type="button">Buscar</button></div></div>
              <div className="form-group sales-field-span-2"><label>Nombre</label><select value="" onChange={() => undefined}><option value="">Seleccionar cliente</option>{customers.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></div>
              <div className="form-group"><label>Direccion</label><input type="text" placeholder="Direccion" readOnly /></div>
              <div className="form-group"><label>CUIT/DNI</label><input type="text" placeholder="CUIT o DNI" readOnly /></div>
              <div className="form-group"><label>Condicion IVA</label><select value="Consumidor Final" onChange={() => undefined}>{IVA_CONDITIONS.map((item) => <option key={item} value={item}>{item}</option>)}</select></div>
              <div className="form-group sales-field-span-3"><label>Observaciones</label><input type="text" placeholder="Observaciones" readOnly /></div>
            </div>
          </div>

          <div className="sales-form-card">
            <div className="sales-section-head">
              <div><p className="sales-section-kicker">Items</p><h3>Carga de articulos</h3></div>
              <div className="sales-shortcut-badge">F5</div>
            </div>
            <div className="form-group sales-article-search-group">
              <label>{config.searchPlaceholder || 'Codigo articulo (F5)'}</label>
              <div className="sales-inline-combo">
                <input type="text" placeholder={config.searchPlaceholder || 'Codigo articulo'} readOnly />
                <button className="sales-addon-button sales-addon-button--wide" type="button">Buscar</button>
              </div>
            </div>
            <div className="sales-lines-table-wrap">
              <table className="sales-lines-table">
                <thead>
                  <tr>
                    <th>Cant.</th>
                    <th>Cod.</th>
                    <th>Descripcion</th>
                    <th>Precio unit.</th>
                    <th>Desc %</th>
                    <th>Total</th>
                    <th>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  <tr><td colSpan={7} className="sales-empty-row">La estructura visual ya esta preparada para este comprobante sin alterar la logica actual.</td></tr>
                </tbody>
              </table>
            </div>
            {config.checkboxLabel ? (
              <div className="sales-check-row"><label><input type="checkbox" readOnly /> {config.checkboxLabel}</label></div>
            ) : null}
          </div>
        </div>

        <aside className="sales-side-stack">
          <div className="sales-summary-card">
            <div className="sales-summary-row"><span>Neto</span><strong>$ 0,00</strong></div>
            <div className="sales-summary-row"><span>Descuento</span><strong>$ 0,00</strong></div>
            <div className="sales-summary-row"><span>Subtotal</span><strong>$ 0,00</strong></div>
            <div className="sales-summary-row"><span>IVA</span><strong>$ 0,00</strong></div>
            <div className="sales-summary-total"><span>{config.totalLabel || 'Total'}</span><strong>$ 0,00</strong></div>
          </div>
          <div className="sales-shortcuts-card">
            <h3>Atajos visibles</h3>
            <div className="sales-shortcuts-list">{['F3', 'F5'].map((shortcut) => <span className="sales-shortcut-chip" key={shortcut}>{shortcut}</span>)}</div>
          </div>
          <div className="sales-footer-actions">
            {config.exitButtonLabel ? <button className="btn btn-secondary" type="button">Salir</button> : null}
            <button className="btn btn-success" type="button">{config.documentButtonLabel}</button>
          </div>
        </aside>
      </div>
    </div>
  );
}

export function SalesPage({ pageId }: SalesPageProps) {
  const { currentUser } = useAuth();
  const settingsQuery = useSettings();
  const [customerId, setCustomerId] = useState('');
  const [customerCodeInput, setCustomerCodeInput] = useState('');
  const [customerSearchModalOpen, setCustomerSearchModalOpen] = useState(false);
  const [customerModalSearch, setCustomerModalSearch] = useState('');
  const [customerModalPage, setCustomerModalPage] = useState(1);
  const [customerModalPageSize, setCustomerModalPageSize] = useState(10);
  const [receiptType, setReceiptType] = useState<string>('C');
  const [receiptSlot, setReceiptSlot] = useState('1');
  const [pointOfSale, setPointOfSale] = useState('0001');
  const [priceList, setPriceList] = useState<string>('Lista 1');
  const [globalDiscount, setGlobalDiscount] = useState('0,00');
  const [seller, setSeller] = useState('');
  const [taxId, setTaxId] = useState('');
  const [ivaCondition, setIvaCondition] = useState<string>('Consumidor Final');
  const [address, setAddress] = useState('');
  const [observations, setObservations] = useState('');
  const [oc, setOc] = useState('');
  const [remito, setRemito] = useState('');
  const [itemSearch, setItemSearch] = useState('');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [feedback, setFeedback] = useState('');
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [ticketPromptSale, setTicketPromptSale] = useState<SalePrintData | null>(null);
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [cashReceived, setCashReceived] = useState('0.00');
  const normalizedPointOfSale = normalizePointOfSale(pointOfSale);
  const moduleConfig = getModuleConfig(pageId);
  const { productsQuery, customersQuery, nextNumberQuery } = useSaleComposerData(receiptType, normalizedPointOfSale);

  const products = useMemo(
    () => (productsQuery.data || []).filter((product) => Number(product.stock || 0) > 0),
    [productsQuery.data]
  );
  const customers = customersQuery.data || [];
  const selectedCustomer = customers.find((customer) => String(customer.id) === customerId) || null;
  const emitterTaxCondition = settingsQuery.data?.emitter_tax_condition || null;
  const customerTaxCondition = ivaCondition || 'Consumidor Final';
  const availableReceiptTypes = useMemo(
    () => getAvailableVoucherTypes(emitterTaxCondition, customerTaxCondition),
    [customerTaxCondition, emitterTaxCondition]
  );
  const defaultReceiptType = useMemo(
    () => getDefaultVoucherType(emitterTaxCondition, customerTaxCondition),
    [customerTaxCondition, emitterTaxCondition]
  );
  const fiscalValidationMessage = useMemo(
    () => getFiscalVoucherValidationMessage(emitterTaxCondition, customerTaxCondition),
    [customerTaxCondition, emitterTaxCondition]
  );
  const receiptTypeSelectValue = availableReceiptTypes.length > 0 ? receiptType : '';
  const isReceiptTypeLocked = availableReceiptTypes.length <= 1;
  const filteredProducts = useMemo(() => {
    const normalized = itemSearch.trim().toLowerCase();
    if (!normalized) {
      return products.slice(0, 8);
    }

    return products
      .filter((product) => {
        const haystack = [product.name, product.sku, product.brand_name, product.barcode]
          .map((value) => String(value || '').toLowerCase());
        return haystack.some((value) => value.includes(normalized));
      })
      .slice(0, 8);
  }, [itemSearch, products]);
  const filteredCustomers = useMemo(() => {
    const normalized = customerModalSearch.trim().toLowerCase();
    if (!normalized) return customers;
    const digits = normalized.replace(/\D/g, '');
    return customers.filter((customer) => {
      const code = buildCustomerLookupCode(customer).toLowerCase();
      const id = String(customer.id || '');
      const taxIdValue = String(customer.tax_id || '').replace(/\D/g, '');
      const name = String(customer.name || '').toLowerCase();
      return code.includes(normalized)
        || id.includes(digits || normalized)
        || taxIdValue.includes(digits)
        || name.includes(normalized);
    });
  }, [customerModalSearch, customers]);
  const customerModalTotalPages = Math.max(1, Math.ceil(filteredCustomers.length / customerModalPageSize));
  const safeCustomerModalPage = Math.min(customerModalPage, customerModalTotalPages);
  const customerModalRows = filteredCustomers.slice((safeCustomerModalPage - 1) * customerModalPageSize, safeCustomerModalPage * customerModalPageSize);
  const sellerOptions = useMemo(
    () => Array.from(new Set([
      currentUser?.name || '',
      seller,
      ...CUSTOMER_SELLERS,
      ...customers.map((customer) => String(customer.seller || '').trim())
    ].filter(Boolean))),
    [currentUser?.name, customers, seller]
  );

  useEffect(() => {
    if (!seller && currentUser?.name) {
      setSeller(currentUser.name);
    }
  }, [currentUser?.name, seller]);

  useEffect(() => {
    setPointOfSale(receiptSlot.padStart(4, '0'));
  }, [receiptSlot]);

  useEffect(() => {
    if (!selectedCustomer) {
      setCustomerCodeInput('');
      setTaxId('');
      setIvaCondition('Consumidor Final');
      setAddress('');
      return;
    }

    setCustomerCodeInput(String(selectedCustomer.id || ''));
    setTaxId(selectedCustomer.tax_id || '');
    setIvaCondition((selectedCustomer.iva_condition as string) || 'Consumidor Final');
    setAddress(buildCustomerAddress(selectedCustomer));
  }, [selectedCustomer]);

  useEffect(() => {
    if (availableReceiptTypes.length === 0) {
      if (receiptType !== '') {
        setReceiptType('');
      }
      return;
    }
    if (availableReceiptTypes.includes(receiptType as 'A' | 'B' | 'C')) return;
    if (defaultReceiptType) {
      setReceiptType(defaultReceiptType);
    }
  }, [availableReceiptTypes, defaultReceiptType, receiptType]);

  useEffect(() => {
    setCart((current) => current.map((item) => {
      if (item.manual_price) return item;
      const product = products.find((entry) => String(entry.id) === item.product_id);
      if (!product) return item;
      return {
        ...item,
        unit_price: formatLocaleMoneyInput(getProductPriceByList(product, priceList))
      };
    }));
  }, [priceList, products]);

  const netTotal = cart.reduce((sum, item) => sum + Number(item.quantity || 0) * parseLocaleNumber(item.unit_price), 0);
  const discountPercent = Math.min(100, Math.max(0, parseLocaleNumber(globalDiscount)));
  const lineDiscountAmount = cart.reduce((sum, item) => {
    const base = Math.max(0, Number(item.quantity || 0)) * Math.max(0, parseLocaleNumber(item.unit_price));
    return sum + (base * (Math.min(100, Math.max(0, parseLocaleNumber(item.discount))) / 100));
  }, 0);
  const subtotalBeforeGlobal = netTotal - lineDiscountAmount;
  const globalDiscountAmount = subtotalBeforeGlobal * discountPercent / 100;
  const discountAmount = lineDiscountAmount + globalDiscountAmount;
  const subtotal = subtotalBeforeGlobal - globalDiscountAmount;
  const ivaTotal = 0;
  const total = subtotal + ivaTotal;
  const customerSummary = selectedCustomer
    ? `${selectedCustomer.name}${buildCustomerAddress(selectedCustomer) ? ` - ${buildCustomerAddress(selectedCustomer)}` : ''}${selectedCustomer.phone ? ` - ${selectedCustomer.phone}` : ''}`
    : 'Consumidor final';
  const nextNumber = formatReceiptNumber(nextNumberQuery.data?.receipt_number);
  const isAdmin = currentUser?.role === 'admin';
  const actionLabel = getSalesActionLabel(pageId);
  const filteredProductsWithSearch = useMemo(() => {
    const normalized = itemSearch.trim().toLowerCase();
    if (!normalized) return [] as Product[];
    return products
      .filter((product) => {
        const haystack = [product.name, product.sku, product.brand_name, product.barcode, String(product.id)]
          .map((value) => String(value || '').toLowerCase());
        return haystack.some((value) => value.includes(normalized));
      })
      .slice(0, 8);
  }, [itemSearch, products]);
  const paymentTotalPaid = paymentMethod === 'cash'
    ? Math.max(0, parseLocaleNumber(cashReceived))
    : total;
  const paymentChange = paymentMethod === 'cash'
    ? Math.max(0, paymentTotalPaid - total)
    : 0;

  function addProduct(product: Product) {
    setFeedback('');
    if (Number(product.stock || 0) <= 0) {
      setFeedback('El articulo no tiene stock disponible.');
      return;
    }
    setCart((current) => {
      const existing = current.find((item) => item.product_id === String(product.id));
      if (existing) {
        return current.map((item) => (
          item.product_id === String(product.id)
            ? { ...item, quantity: String(Number(item.quantity || 0) + 1) }
            : item
        ));
      }
      return [...current, { ...buildSaleItem(product), unit_price: formatLocaleMoneyInput(getProductPriceByList(product, priceList)) }];
    });
    setItemSearch('');
  }

  function searchCustomerByCode() {
    const normalized = customerCodeInput.trim();
    if (!normalized) {
      setCustomerId('');
      return;
    }
    const normalizedDigits = normalized.replace(/\D/g, '');
    const normalizedText = normalized.toLowerCase();
    const found = customers.find((customer) => {
      const customerId = String(customer.id || '');
      const customerCode = buildCustomerLookupCode(customer).toLowerCase();
      const customerTaxId = String(customer.tax_id || '').replace(/\D/g, '');
      const customerName = String(customer.name || '').toLowerCase();

      return customerId === normalized
        || customerId === normalizedDigits
        || customerCode === normalizedText
        || customerTaxId === normalizedDigits
        || customerName.includes(normalizedText);
    });
    if (found) {
      setCustomerId(String(found.id));
      setCustomerCodeInput(buildCustomerLookupCode(found));
      setCustomerSearchModalOpen(false);
      setFeedback('');
      return;
    }
    setFeedback('No se encontro el cliente indicado.');
  }

  function selectCustomer(customer: Customer) {
    setCustomerId(String(customer.id));
    setCustomerCodeInput(buildCustomerLookupCode(customer));
    setCustomerSearchModalOpen(false);
    setFeedback('');
  }

  function clearSelectedCustomer() {
    setCustomerId('');
    setCustomerCodeInput('');
    setTaxId('');
    setIvaCondition('Consumidor Final');
    setAddress('');
    setFeedback('');
  }

  function handleCartChange(productId: string, field: 'quantity' | 'unit_price' | 'discount', value: string) {
    setCart((current) => current.map((item) => (
      item.product_id === productId ? { ...item, [field]: value, ...(field === 'unit_price' ? { manual_price: true } : {}) } : item
    )));
  }

  function updateCartQuantity(productId: string, nextQuantity: number) {
    setCart((current) => current.map((item) => {
      if (item.product_id !== productId) return item;
      return { ...item, quantity: String(Math.max(1, nextQuantity)) };
    }));
  }

  function handleRemoveItem(productId: string) {
    setCart((current) => current.filter((item) => item.product_id !== productId));
  }

  function openPaymentModal() {
    setFeedback('');
    if (fiscalValidationMessage) {
      setFeedback(fiscalValidationMessage);
      return;
    }
    if (availableReceiptTypes.length === 0 || !availableReceiptTypes.includes(receiptType as 'A' | 'B' | 'C')) {
      setFeedback('No hay un tipo de comprobante valido para la condicion fiscal actual.');
      return;
    }
    if (!isAdmin) {
      setFeedback('Solo un usuario administrador puede facturar desde esta pantalla.');
      return;
    }
    if (cart.length === 0) {
      setFeedback('Debes agregar al menos un articulo a la factura.');
      return;
    }
    setPaymentMethod('cash');
    setCashReceived('0.00');
    setPaymentModalOpen(true);
  }

  async function confirmSale() {
    setFeedback('');
    if (fiscalValidationMessage) {
      setFeedback(fiscalValidationMessage);
      return;
    }
    const invalidItem = cart.find((item) => Number(item.quantity || 0) <= 0 || parseLocaleNumber(item.unit_price) <= 0);
    if (invalidItem) {
      setFeedback('Revisa cantidades y precios antes de facturar.');
      return;
    }

    try {
      const response = await createSale({
        customer_id: customerId,
        customer_tax_condition: ivaCondition,
        payment_method: paymentMethod,
        notes: [observations, oc ? `O.C: ${oc}` : '', remito ? `Rem: ${remito}` : ''].filter(Boolean).join(' | '),
        receipt_type: receiptType,
        point_of_sale: normalizedPointOfSale,
        items: normalizeSaleItems(cart)
      });

      const warningCount = (response.syncResults || []).filter((item) => item.success === false).length;
      const saleForPrint: SalePrintData = {
        id: response.sale.id,
        created_at: response.sale.created_at,
        receipt_type: response.sale.receipt_type,
        point_of_sale: response.sale.point_of_sale,
        receipt_number: response.sale.receipt_number,
        business_name: settingsQuery.data?.business_name || 'Milo Pro',
        customer_name: selectedCustomer?.name || 'Consumidor final',
        payment_method: paymentMethod,
        seller,
        total,
        items: cart.map((item) => ({ ...item }))
      };
      setFeedback(
        warningCount > 0
          ? `Factura ${response.sale.id} guardada con advertencias de sync Woo en ${warningCount} articulo(s).`
          : `Factura ${response.sale.id} guardada correctamente.`
      );
      setPaymentModalOpen(false);
      setTicketPromptSale(saleForPrint);
      setCart([]);
      setObservations('');
      setOc('');
      setRemito('');
      setGlobalDiscount('0,00');
      setItemSearch('');
      setPaymentMethod('cash');
      setCashReceived('0.00');
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : 'No se pudo registrar la factura.');
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    openPaymentModal();
  }

  if (pageId === 'sales-collections') {
    return <SalesCollectionsPanel customers={customers} />;
  }

  if (pageId === 'sales-web-orders') {
    return <SalesWebOrdersPanel />;
  }

  if (pageId in DOCUMENT_STUB_CONFIG) {
    return (
      <SalesDocumentStub
        config={DOCUMENT_STUB_CONFIG[pageId as keyof typeof DOCUMENT_STUB_CONFIG]}
        customers={customers}
        sellerName={currentUser?.name || 'Operador'}
      />
    );
  }

  if (
    pageId === 'sales-query-invoices'
    || pageId === 'sales-query-delivery-notes'
    || pageId === 'sales-query-credit-notes'
    || pageId === 'sales-query-quotes'
    || pageId === 'sales-query-orders'
  ) {
    return <SalesQueryPanel pageId={pageId} title={moduleConfig.title} subtitle={moduleConfig.subtitle} sellerName={currentUser?.name || 'Operador'} />;
  }

  return (
    <section className="sales-admin-content">
      <div className="sales-admin-panel card">
        <form onSubmit={handleSubmit}>
          <div className="sales-invoice-layout">
            <div className="sales-form-card sales-invoice-compact-card">
              <div className="sales-invoice-sections">
                <section className="sales-invoice-block">
                  <div className="sales-invoice-block-head">
                    <h3>Datos de la factura</h3>
                  </div>
                  <div className="sales-compact-grid sales-compact-grid--invoice">
                    <div className="form-group"><label>Nro.</label><select value={receiptSlot} onChange={(event) => setReceiptSlot(event.target.value)}><option value="1">1</option><option value="2">2</option></select></div>
                    <div className="form-group"><label>P.Venta</label><input value={pointOfSale} readOnly /></div>
                    <div className="form-group"><label>Numero</label><input value={nextNumber} readOnly /></div>
                    <div className="form-group"><label>Tipo</label><select className={isReceiptTypeLocked && availableReceiptTypes.length === 1 ? 'sales-receipt-type-select is-fixed' : 'sales-receipt-type-select'} value={receiptTypeSelectValue} onChange={(event) => setReceiptType(event.target.value)} disabled={isReceiptTypeLocked}>{availableReceiptTypes.length === 0 ? <option value=""></option> : null}{availableReceiptTypes.map((item) => <option key={item} value={item}>{item}</option>)}</select></div>
                    <div className="form-group"><label>Lista</label><select value={priceList} onChange={(event) => setPriceList(event.target.value)}>{PRICE_LISTS.map((item) => <option key={item} value={item}>{item}</option>)}</select></div>
                    <div className="form-group"><label>Desc.</label><input type="text" inputMode="decimal" data-discount="true" value={globalDiscount} onChange={(event: ChangeEvent<HTMLInputElement>) => setGlobalDiscount(event.target.value)} placeholder="0,00" /></div>
                    <div className="form-group"><label>Vendedor</label><select value={seller} onChange={(event) => setSeller(event.target.value)}>{sellerOptions.map((item) => <option key={item} value={item}>{item}</option>)}</select></div>
                  </div>
                </section>

                <section className="sales-invoice-block">
                  <div className="sales-invoice-block-head">
                    <h3>Datos del comprador</h3>
                  </div>
                  <div className="sales-compact-grid sales-compact-grid--buyer">
                    <div className="form-group">
                      <label>Codigo Cliente</label>
                      <div className="sales-inline-combo">
                        <div className="sales-customer-code-field">
                          <input
                            value={customerCodeInput}
                            placeholder="Codigo cliente"
                            onChange={(event: ChangeEvent<HTMLInputElement>) => setCustomerCodeInput(event.target.value)}
                            onKeyDown={(event) => {
                              if (event.key === 'Enter') {
                                event.preventDefault();
                                searchCustomerByCode();
                              }
                            }}
                          />
                          {customerId ? (
                            <button className="sales-customer-clear-button" type="button" onClick={clearSelectedCustomer} aria-label="Quitar cliente seleccionado">
                              ×
                            </button>
                          ) : null}
                        </div>
                        <button className="sales-addon-button sales-addon-button--wide" type="button" onClick={() => {
                          setCustomerModalSearch(customerCodeInput);
                          setCustomerModalPage(1);
                          setCustomerModalPageSize(10);
                          setCustomerSearchModalOpen(true);
                        }}>Buscar</button>
                      </div>
                    </div>
                    <div className="form-group"><label>Nombre</label><select value={customerId} onChange={(event) => setCustomerId(event.target.value)}><option value="">Consumidor final</option>{customers.map((item) => <option key={item.id} value={String(item.id)}>{item.name}</option>)}</select></div>
                    <div className="form-group"><label>CUIT</label><input value={taxId} onChange={(event: ChangeEvent<HTMLInputElement>) => setTaxId(event.target.value)} placeholder="CUIT o DNI" /></div>
                    <div className="form-group"><label>Condicion IVA</label><select value={ivaCondition} onChange={(event) => setIvaCondition(event.target.value)}>{IVA_CONDITIONS.map((item) => <option key={item} value={item}>{item}</option>)}</select></div>
                    <div className="form-group"><label>Direccion</label><input value={address} onChange={(event: ChangeEvent<HTMLInputElement>) => setAddress(event.target.value)} placeholder="Direccion del cliente" /></div>
                    <div className="form-group sales-field-span-2"><label>Obs:</label><input value={observations} onChange={(event: ChangeEvent<HTMLInputElement>) => setObservations(event.target.value)} placeholder="Observaciones del comprobante" /></div>
                    <div className="form-group"><label>O.C:</label><input value={oc} onChange={(event: ChangeEvent<HTMLInputElement>) => setOc(event.target.value)} placeholder="Orden de compra" /></div>
                    <div className="form-group"><label>Rem:</label><input value={remito} onChange={(event: ChangeEvent<HTMLInputElement>) => setRemito(event.target.value)} placeholder="Referencia" /></div>
                  </div>
                </section>
              </div>

              <div className="sales-customer-summary">{customerSummary}</div>
              <div className="sales-live-metrics" hidden aria-hidden="true">
                <strong>{receiptType}</strong>
                <strong>{normalizedPointOfSale}</strong>
                <strong>{selectedCustomer ? selectedCustomer.name : 'Consumidor final'}</strong>
                <strong>{globalDiscount || '0.00'}%</strong>
              </div>
              <input type="hidden" value={paymentMethod} />
            </div>

            <div className="sales-form-card sales-items-card">
              <div className="sales-article-toolbar sales-article-toolbar--compact">
                <div className="form-group sales-article-search-group">
                  <label>Buscar producto para facturar</label>
                  <div className="sales-search-callout">Carga rapida por codigo, SKU o descripcion</div>
                  <div className="sales-inline-combo">
                    <input
                      value={itemSearch}
                      onChange={(event: ChangeEvent<HTMLInputElement>) => setItemSearch(event.target.value)}
                      placeholder="Ej. modulo a10, ART-000086 o codigo de barras"
                    />
                    <button
                      className="sales-addon-button sales-addon-button--wide"
                      type="button"
                      onClick={() => {
                        if (filteredProductsWithSearch[0]) {
                          addProduct(filteredProductsWithSearch[0]);
                        }
                      }}
                    >
                      Agregar
                    </button>
                  </div>
                </div>
              </div>
              <div className="sales-search-meta">
                {itemSearch.trim()
                  ? filteredProductsWithSearch.length === 0
                    ? `No hay coincidencias para "${itemSearch.trim().toLowerCase()}".`
                    : `${filteredProductsWithSearch.length} coincidencias. Primero: ${(filteredProductsWithSearch[0]?.sku || `ART-${filteredProductsWithSearch[0]?.id}`)} - ${filteredProductsWithSearch[0]?.name}`
                  : 'Escribe un codigo o descripcion y presiona Enter para agregar.'}
              </div>
              {itemSearch.trim() && filteredProductsWithSearch.length > 0 ? (
                <div className="sales-search-results">
                  {filteredProductsWithSearch.map((product) => (
                    <button key={product.id} type="button" className={`sales-search-result${Number(product.stock || 0) > 0 ? '' : ' is-out-of-stock'}`} onClick={() => addProduct(product)}>
                      <span className="sales-search-result-thumb">
                        {getProductImageUrl(product) ? (
                          <img src={getProductImageUrl(product)} alt={product.name || 'Articulo'} />
                        ) : (
                          <span className="sales-search-result-thumb-placeholder">Sin foto</span>
                        )}
                      </span>
                      <span className="sales-search-result-main">
                        <span className="sales-search-result-name">{product.name}</span>
                        <span className="sales-search-result-code">{product.sku || `ART-${product.id}`}</span>
                      </span>
                      <span className="sales-search-result-side">
                        <span className="sales-search-result-price">{formatMoney(getProductPriceByList(product, priceList))}</span>
                        <span className={`sales-search-result-stock${Number(product.stock || 0) > 0 ? '' : ' is-empty'}`}>{Number(product.stock || 0) > 0 ? `Stock ${product.stock ?? 0}` : 'Sin stock'}</span>
                      </span>
                    </button>
                  ))}
                </div>
              ) : null}

              <div className="sales-lines-table-wrap">
                <table className="sales-lines-table">
                  <thead>
                    <tr>
                      <th>Cant.</th>
                      <th>Codigo</th>
                      <th>Descripcion</th>
                      <th>Precio Unit.</th>
                      <th>Desc. %</th>
                      <th>Total</th>
                      <th>Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cart.length === 0 ? (
                      <tr><td colSpan={7} className="sales-empty-row">Agrega articulos para comenzar la facturacion.</td></tr>
                    ) : (
                      cart.map((item) => {
                        const lineTotal = getLineTotal(item, globalDiscount);
                        return (
                          <tr key={item.product_id}>
                            <td>
                              <div className="sales-qty-control">
                                <button type="button" onClick={() => updateCartQuantity(item.product_id, Number(item.quantity || 0) - 1)}>-</button>
                                <input value={item.quantity} onChange={(event: ChangeEvent<HTMLInputElement>) => handleCartChange(item.product_id, 'quantity', event.target.value)} />
                                <button type="button" onClick={() => updateCartQuantity(item.product_id, Number(item.quantity || 0) + 1)}>+</button>
                              </div>
                            </td>
                            <td>{item.sku}</td>
                            <td><div className="sales-line-name">{item.name}</div></td>
                            <td><input className="sales-line-input sales-line-input--price" data-money="true" inputMode="decimal" value={item.unit_price} onChange={(event: ChangeEvent<HTMLInputElement>) => handleCartChange(item.product_id, 'unit_price', event.target.value)} /></td>
                            <td><input className="sales-line-input sales-line-input--discount" type="text" inputMode="decimal" data-discount="true" value={item.discount} onChange={(event: ChangeEvent<HTMLInputElement>) => handleCartChange(item.product_id, 'discount', event.target.value)} placeholder="0,00" /></td>
                            <td>{formatMoney(lineTotal)}</td>
                            <td><button type="button" className="btn btn-danger btn-small" onClick={() => handleRemoveItem(item.product_id)}>Quitar</button></td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>

              <div className="sales-summary-inline">
                <div className="sales-summary-card sales-summary-card--full">
                  {feedback ? <div className={`alert ${feedback.includes('No se pudo') || feedback.includes('Debes') || feedback.includes('Revisa') || feedback.includes('Solo ') ? 'alert-warning' : 'alert-info'}`}>{feedback}</div> : null}
                  <div className="sales-summary-row"><span>Neto</span><strong>{formatMoney(netTotal)}</strong></div>
                  <div className="sales-summary-row"><span>Descuento</span><strong>{formatMoney(discountAmount)}</strong></div>
                  <div className="sales-summary-row"><span>Subtotal</span><strong>{formatMoney(subtotal)}</strong></div>
                  <div className="sales-summary-row"><span>IVA</span><strong>{formatMoney(ivaTotal)}</strong></div>
                  <div className="sales-summary-total"><span>Total</span><strong>{formatMoney(total)}</strong></div>
                </div>
              </div>
              <div className="sales-primary-action">
                <button className="btn btn-success" type="submit" disabled={!isAdmin}>{actionLabel}</button>
              </div>
            </div>
          </div>
        </form>
      </div>

      {paymentModalOpen ? (
        <div className="modal-overlay" onClick={(event) => {
          if (event.target === event.currentTarget) {
            setPaymentModalOpen(false);
          }
        }}>
          <div className="modal sales-payment-modal">
            <div className="modal-header sales-payment-modal-header">
              <h3>Forma de Pago</h3>
              <button className="modal-close" type="button" onClick={() => setPaymentModalOpen(false)}>&times;</button>
            </div>
            <div className="modal-body sales-payment-modal-body">
              <div className="sales-payment-total">Total a Pagar: <strong>{formatMoney(total)}</strong></div>
              <div className="sales-payment-methods">
                {[
                  { id: 'cash', label: 'Efectivo' },
                  { id: 'digital', label: 'Pago Digital' },
                  { id: 'check', label: 'Cheque' },
                  { id: 'account', label: 'Cta. Cte.' },
                  { id: 'transfer', label: 'Transferencia' }
                ].map((method) => (
                  <button
                    key={method.id}
                    className={`sales-payment-method${paymentMethod === method.id ? ' is-active' : ''}`}
                    type="button"
                    onClick={() => setPaymentMethod(method.id)}
                  >
                    {method.label}
                  </button>
                ))}
              </div>
              {paymentMethod === 'cash' ? (
                <div className="sales-payment-cash-box">
                  <label htmlFor="sales-cash-received">Importe recibido</label>
                  <input id="sales-cash-received" type="text" inputMode="decimal" data-money="true" value={cashReceived} placeholder="0,00" onChange={(event) => setCashReceived(event.target.value)} />
                  <small>Ingresa el efectivo entregado por el cliente para calcular el vuelto.</small>
                </div>
              ) : null}
              <div className="sales-payment-summary">
                <div className="sales-payment-summary-row"><span>Total Pagado</span><strong>{formatMoney(paymentMethod === 'cash' ? paymentTotalPaid : total)}</strong></div>
                <div className="sales-payment-summary-row"><span>Vuelto</span><strong>{formatMoney(paymentChange)}</strong></div>
              </div>
            </div>
            <div className="modal-footer sales-payment-modal-footer">
              <button className="btn btn-secondary" type="button" onClick={() => setPaymentModalOpen(false)}>Cancelar</button>
              <button className="btn btn-success" type="button" onClick={() => void confirmSale()}>Confirmar Venta</button>
            </div>
          </div>
        </div>
      ) : null}

      {ticketPromptSale ? (
        <div className="modal-overlay" onClick={(event) => {
          if (event.target === event.currentTarget) {
            setTicketPromptSale(null);
          }
        }}>
          <div className="modal sales-payment-modal">
            <div className="modal-header sales-payment-modal-header">
              <h3>Ticket 80mm</h3>
              <button className="modal-close" type="button" onClick={() => setTicketPromptSale(null)}>&times;</button>
            </div>
            <div className="modal-body sales-payment-modal-body">
              <div className="sales-payment-total">Factura {buildReceiptNumber(ticketPromptSale)}</div>
              <div className="sales-payment-summary">
                <div className="sales-payment-summary-row"><span>Cliente</span><strong>{ticketPromptSale.customer_name}</strong></div>
                <div className="sales-payment-summary-row"><span>Total</span><strong>{formatMoney(ticketPromptSale.total)}</strong></div>
              </div>
              <p>Desea imprimir el ticket de 80mm?</p>
            </div>
            <div className="modal-footer sales-payment-modal-footer">
              <button className="btn btn-secondary" type="button" onClick={() => setTicketPromptSale(null)}>No imprimir</button>
              <button className="btn btn-success" type="button" onClick={() => {
                printSalesTicket80mm(ticketPromptSale);
                setTicketPromptSale(null);
              }}>Imprimir</button>
            </div>
          </div>
        </div>
      ) : null}

      {customerSearchModalOpen ? (
        <div className="modal-overlay" onClick={(event) => {
          if (event.target === event.currentTarget) {
            setCustomerSearchModalOpen(false);
          }
        }}>
          <div className="modal sales-customer-modal">
            <div className="modal-header">
              <h3>Buscar Cliente</h3>
              <button className="modal-close" type="button" onClick={() => setCustomerSearchModalOpen(false)}>&times;</button>
            </div>
            <div className="modal-body">
              <div className="sales-customer-modal-toolbar">
                <div className="sales-customer-modal-toolbar-group">
                  <label className="sales-customer-modal-count">
                    Mostrar
                    <select value={String(customerModalPageSize)} onChange={(event) => {
                      setCustomerModalPageSize(Number(event.target.value) || 10);
                      setCustomerModalPage(1);
                    }}>
                      <option value="10">10</option>
                      <option value="20">20</option>
                      <option value="30">30</option>
                    </select>
                    registros
                  </label>
                </div>
                <div className="form-group">
                  <label>Buscar:</label>
                  <input
                    value={customerModalSearch}
                    onChange={(event: ChangeEvent<HTMLInputElement>) => {
                      setCustomerModalSearch(event.target.value);
                      setCustomerModalPage(1);
                    }}
                    placeholder="Ejemplo búsqueda..."
                  />
                </div>
              </div>
              <div className="sales-customer-modal-table-wrap">
                <table className="sales-customer-modal-table">
                  <thead>
                    <tr>
                      <th><span className="sales-customer-modal-sorthead">Codigo <span aria-hidden="true">↕</span></span></th>
                      <th><span className="sales-customer-modal-sorthead">Nombre <span aria-hidden="true">↕</span></span></th>
                      <th><span className="sales-customer-modal-sorthead">Direccion <span aria-hidden="true">↕</span></span></th>
                      <th><span className="sales-customer-modal-sorthead">CUIT <span aria-hidden="true">↕</span></span></th>
                      <th>Accion</th>
                    </tr>
                  </thead>
                  <tbody>
                    {customerModalRows.length === 0 ? (
                      <tr><td colSpan={5} className="sales-empty-row">No hay clientes para mostrar.</td></tr>
                    ) : customerModalRows.map((customer) => (
                      <tr key={customer.id} className={selectedCustomer?.id === customer.id ? 'is-selected' : ''} onClick={() => selectCustomer(customer)}>
                        <td>{String(customer.id || '').padStart(4, '0')}</td>
                        <td>{customer.name || '-'}</td>
                        <td>{customer.address || '-'}</td>
                        <td>{customer.tax_id || '-'}</td>
                        <td><button type="button" className="btn btn-success btn-sm" onClick={(event) => { event.stopPropagation(); selectCustomer(customer); }}>Seleccionar</button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            <div className="modal-footer sales-customer-modal-footer">
              <div className="sales-customer-modal-pagination-text">
                Mostrando {filteredCustomers.length === 0 ? 0 : ((safeCustomerModalPage - 1) * customerModalPageSize) + 1} a {Math.min(safeCustomerModalPage * customerModalPageSize, filteredCustomers.length)} de {filteredCustomers.length} registros
              </div>
              <div className="sales-pagination">
                <button className="btn btn-secondary" type="button" onClick={() => setCustomerModalPage((page) => Math.max(1, page - 1))} disabled={safeCustomerModalPage === 1}>Anterior</button>
                {Array.from({ length: customerModalTotalPages }, (_, index) => index + 1)
                  .slice(Math.max(0, safeCustomerModalPage - 2), Math.max(0, safeCustomerModalPage - 2) + 3)
                  .map((pageNumber) => (
                    <button
                      key={pageNumber}
                      className={`sales-pagination-page${pageNumber === safeCustomerModalPage ? ' is-active' : ''}`}
                      type="button"
                      onClick={() => setCustomerModalPage(pageNumber)}
                    >
                      {pageNumber}
                    </button>
                  ))}
                <button className="btn btn-secondary" type="button" onClick={() => setCustomerModalPage((page) => Math.min(customerModalTotalPages, page + 1))} disabled={safeCustomerModalPage >= customerModalTotalPages}>Siguiente</button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}

