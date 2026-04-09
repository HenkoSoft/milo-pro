import { useEffect, useMemo, useState, type ChangeEvent, type FormEvent } from 'react';
import { useAuth } from '../auth/AuthContext';
import { useOnlineFeed, useSaleComposerData, useSaleDetail, useSaleMutations, useSalesHistory } from './useSales';
import type { Customer } from '../../types/customer';
import type { Product } from '../../types/product';
import type { Category } from '../../types/catalog';
import { createSale } from '../../services/sales';
import type { Sale, SalePayloadItem } from '../../types/sale';

const SALES_MODULES = [
  { id: 'sales', label: 'Facturas', title: 'Facturas', subtitle: '' },
  { id: 'sales-delivery-notes', label: 'Remitos', title: 'Remitos', subtitle: 'Misma logica visual que facturacion para entregar mercaderia con datos claros del cliente.' },
  { id: 'sales-quotes', label: 'Presupuestos', title: 'Presupuestos', subtitle: 'Preparado para carga rapida de propuestas comerciales con los mismos bloques del modulo principal.' },
  { id: 'sales-orders', label: 'Pedidos', title: 'Pedidos', subtitle: 'Estructura alineada con remitos y presupuestos para simplificar entrenamiento y carga.' },
  { id: 'sales-credit-notes', label: 'Notas de Credito', title: 'Notas de Credito', subtitle: 'Pantalla visual consistente con facturacion para gestionar devoluciones y ajustes comerciales.' },
  { id: 'sales-collections', label: 'Cobranzas', title: 'Cobranzas', subtitle: 'Cuenta corriente de clientes.' },
  { id: 'sales-query-invoices', label: 'Consultar Facturas', title: 'Consultar Facturas', subtitle: 'Tabla estandar con buscador, paginacion y acciones rapidas.' },
  { id: 'sales-query-delivery-notes', label: 'Consultar Remitos', title: 'Consultar Remitos', subtitle: 'Misma estructura de consulta para mantener criterios visuales en Ventas.' },
  { id: 'sales-query-credit-notes', label: 'Consultar Notas de Credito', title: 'Consultar Notas de Credito', subtitle: 'Consulta visual uniforme para operaciones comerciales y revisiones rapidas.' },
  { id: 'sales-query-quotes', label: 'Consultar Presupuestos', title: 'Consultar Presupuestos', subtitle: 'Tabla preparada para listar presupuestos con filtro, estado y acciones.' },
  { id: 'sales-query-orders', label: 'Consultar Pedidos', title: 'Consultar Pedidos', subtitle: 'Consulta administrativa alineada con el resto del sistema.' },
  { id: 'sales-web-orders', label: 'Pedidos Web', title: 'Pedidos Web', subtitle: 'Seguimiento y actualizacion de pedidos web.' }
] as const;

const RECEIPT_TYPES = ['A', 'B', 'C', 'X', 'PRESUPUESTO', 'TICKET'] as const;
const PRICE_LISTS = ['Lista 1', 'Lista 2', 'Lista 3', 'Lista 4', 'Lista 5', 'Lista 6'] as const;
const IVA_CONDITIONS = ['Consumidor Final', 'Responsable Inscripto', 'Monotributista', 'Exento'] as const;

interface CartItem {
  product_id: string;
  name: string;
  sku: string;
  quantity: string;
  unit_price: string;
  stock: number;
}

interface SalesPageProps {
  pageId: string;
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

function buildReceiptNumber(sale: Sale) {
  return `${String(sale.point_of_sale || '001')}-${String(sale.receipt_number || sale.id).padStart(8, '0')}`;
}

function buildSaleItem(product: Product): CartItem {
  return {
    product_id: String(product.id),
    name: product.name,
    sku: product.sku || `#${product.id}`,
    quantity: '1',
    unit_price: String(Number(product.sale_price || 0)),
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
          <p>Cuenta corriente de clientes.</p>
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
                        <td>{sale.created_at ? new Date(sale.created_at).toLocaleDateString('es-AR') : '-'}</td>
                        <td>{sale.created_at ? new Date(sale.created_at).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' }) : '-'}</td>
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
          <p>Seguimiento y actualizacion de pedidos web.</p>
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
                    <th>Canal</th>
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
                        <td>{sale.created_at ? new Date(sale.created_at).toLocaleDateString('es-AR') : '-'}</td>
                        <td><div>{buildReceiptNumber(sale)}</div><small>{sale.id}</small></td>
                        <td>{sale.customer_name || 'Cliente web'}</td>
                        <td>
                          <div className="sales-web-state-cell">
                            <span className="badge badge-blue">{sale.status || 'pending_payment'}</span>
                            <span className="sales-web-priority-pill">{getPriorityLabel(sale.status)}</span>
                          </div>
                        </td>
                        <td>{sale.channel || 'woocommerce'}</td>
                        <td>{formatMoney(Number(sale.total || 0))}</td>
                        <td>
                          <button className="btn btn-sm btn-secondary" type="button" onClick={() => setSelectedSaleId(sale.id)}>
                            Ver detalle
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

function SalesQueryPanel({ title, subtitle }: { title: string; subtitle: string }) {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const salesHistoryQuery = useSalesHistory({});
  const salesHistory = salesHistoryQuery.data || [];

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

  const totalPages = Math.max(1, Math.ceil(rows.length / 10));
  const safePage = Math.max(1, Math.min(totalPages, page));
  const visibleRows = rows.slice((safePage - 1) * 10, safePage * 10);
  const totalAmount = rows.reduce((sum, sale) => sum + Number(sale.total || 0), 0);

  return (
    <div className="sales-module-shell">
      <div className="sales-module-head">
        <div>
          <p className="sales-module-kicker">Consultas</p>
          <h2>{title}</h2>
          <p>{subtitle}</p>
        </div>
      </div>

      <div className="sales-table-card">
        <div className="sales-table-toolbar">
          <div>
            <h3>{title}</h3>
            <p>Busqueda rapida por cliente, observaciones, estado, canal o comprobante.</p>
          </div>
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

        <div className="sales-table-toolbar sales-query-toolbar">
          <span className="sales-query-total">Registros: <strong>{rows.length}</strong></span>
          <span className="sales-query-total">Total: <strong>{formatMoney(totalAmount)}</strong></span>
        </div>

        <div className="sales-lines-table-wrap">
          <table className="sales-lines-table">
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Hora</th>
                <th>Comprobante</th>
                <th>Cliente</th>
                <th>Canal</th>
                <th>Estado</th>
                <th>Total</th>
              </tr>
            </thead>
            <tbody>
              {salesHistoryQuery.isLoading ? (
                <tr><td colSpan={7} className="sales-empty-row">Cargando...</td></tr>
              ) : visibleRows.length === 0 ? (
                <tr><td colSpan={7} className="sales-empty-row">No hay registros para mostrar.</td></tr>
              ) : (
                visibleRows.map((sale) => (
                  <tr key={sale.id}>
                    <td>{sale.created_at ? new Date(sale.created_at).toLocaleDateString('es-AR') : '-'}</td>
                    <td>{sale.created_at ? new Date(sale.created_at).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' }) : '-'}</td>
                    <td>{buildReceiptNumber(sale)}</td>
                    <td>{sale.customer_name || 'Consumidor final'}</td>
                    <td>{sale.channel || 'Mostrador'}</td>
                    <td>{sale.status || '-'}</td>
                    <td>{formatMoney(Number(sale.total || 0))}</td>
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

export function SalesPage({ pageId }: SalesPageProps) {
  const { currentUser } = useAuth();
  const [customerId, setCustomerId] = useState('');
  const [receiptType, setReceiptType] = useState<string>('C');
  const [pointOfSale, setPointOfSale] = useState('001');
  const [priceList, setPriceList] = useState<string>('Lista 1');
  const [globalDiscount, setGlobalDiscount] = useState('0.00');
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
  const normalizedPointOfSale = normalizePointOfSale(pointOfSale);
  const moduleConfig = getModuleConfig(pageId);
  const { productsQuery, customersQuery, nextNumberQuery } = useSaleComposerData(receiptType, normalizedPointOfSale);

  const products = useMemo(
    () => (productsQuery.data || []).filter((product) => Number(product.stock || 0) > 0),
    [productsQuery.data]
  );
  const customers = customersQuery.data || [];
  const selectedCustomer = customers.find((customer) => String(customer.id) === customerId) || null;
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

  useEffect(() => {
    if (!seller && currentUser?.name) {
      setSeller(currentUser.name);
    }
  }, [currentUser?.name, seller]);

  useEffect(() => {
    if (!selectedCustomer) {
      setTaxId('');
      setIvaCondition('Consumidor Final');
      setAddress('');
      return;
    }

    setTaxId(selectedCustomer.tax_id || '');
    setIvaCondition((selectedCustomer.iva_condition as string) || 'Consumidor Final');
    setAddress(buildCustomerAddress(selectedCustomer));
  }, [selectedCustomer]);

  const netTotal = cart.reduce((sum, item) => sum + Number(item.quantity || 0) * Number(item.unit_price || 0), 0);
  const discountPercent = Math.min(100, Math.max(0, Number.parseFloat(globalDiscount || '0') || 0));
  const discountAmount = netTotal * discountPercent / 100;
  const subtotal = netTotal - discountAmount;
  const ivaTotal = 0;
  const total = subtotal + ivaTotal;
  const customerSummary = selectedCustomer
    ? `${selectedCustomer.name}${buildCustomerAddress(selectedCustomer) ? ` - ${buildCustomerAddress(selectedCustomer)}` : ''}`
    : 'Consumidor final';
  const nextNumber = formatReceiptNumber(nextNumberQuery.data?.receipt_number);
  const isAdmin = currentUser?.role === 'admin';
  const mainDocumentPages = new Set(['sales', 'sales-delivery-notes', 'sales-quotes', 'sales-orders', 'sales-credit-notes']);
  const actionLabel = getSalesActionLabel(pageId);

  function addProduct(product: Product) {
    setFeedback('');
    setCart((current) => {
      const existing = current.find((item) => item.product_id === String(product.id));
      if (existing) {
        return current.map((item) => (
          item.product_id === String(product.id)
            ? { ...item, quantity: String(Number(item.quantity || 0) + 1) }
            : item
        ));
      }
      return [...current, buildSaleItem(product)];
    });
    setItemSearch('');
  }

  function handleCartChange(productId: string, field: 'quantity' | 'unit_price', value: string) {
    setCart((current) => current.map((item) => (
      item.product_id === productId ? { ...item, [field]: value } : item
    )));
  }

  function handleRemoveItem(productId: string) {
    setCart((current) => current.filter((item) => item.product_id !== productId));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFeedback('');

    if (!isAdmin) {
      setFeedback('Solo un usuario administrador puede facturar desde esta pantalla.');
      return;
    }

    if (cart.length === 0) {
      setFeedback('Debes agregar al menos un articulo a la factura.');
      return;
    }

    const invalidItem = cart.find((item) => Number(item.quantity || 0) <= 0 || Number(item.unit_price || 0) <= 0);
    if (invalidItem) {
      setFeedback('Revisa cantidades y precios antes de facturar.');
      return;
    }

    try {
      const response = await createSale({
        customer_id: customerId,
        payment_method: 'cash',
        notes: [observations, oc ? `O.C: ${oc}` : '', remito ? `Rem: ${remito}` : ''].filter(Boolean).join(' | '),
        receipt_type: receiptType,
        point_of_sale: normalizedPointOfSale,
        items: normalizeSaleItems(cart)
      });

      const warningCount = (response.syncResults || []).filter((item) => item.success === false).length;
      setFeedback(
        warningCount > 0
          ? `Factura ${response.sale.id} guardada con advertencias de sync Woo en ${warningCount} articulo(s).`
          : `Factura ${response.sale.id} guardada correctamente.`
      );
      setCart([]);
      setObservations('');
      setOc('');
      setRemito('');
      setGlobalDiscount('0.00');
      setItemSearch('');
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : 'No se pudo registrar la factura.');
    }
  }

  if (pageId === 'sales-collections') {
    return <SalesCollectionsPanel customers={customers} />;
  }

  if (pageId === 'sales-web-orders') {
    return <SalesWebOrdersPanel />;
  }

  if (
    pageId === 'sales-query-invoices'
    || pageId === 'sales-query-delivery-notes'
    || pageId === 'sales-query-credit-notes'
    || pageId === 'sales-query-quotes'
    || pageId === 'sales-query-orders'
  ) {
    return <SalesQueryPanel title={moduleConfig.title} subtitle={moduleConfig.subtitle} />;
  }

  return (
    <div className="sales-module-shell">
      <div className="sales-module-head">
        <div>
          <p className="sales-module-kicker">Ventas</p>
          <h2>{moduleConfig.title}</h2>
          {moduleConfig.subtitle ? <p>{moduleConfig.subtitle}</p> : null}
        </div>
      </div>

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
                      <div className="form-group"><label>Nro.</label><select value="1" onChange={() => undefined}><option value="1">1</option><option value="2">2</option></select></div>
                      <div className="form-group"><label>P.Venta</label><input value={pointOfSale} onChange={(event: ChangeEvent<HTMLInputElement>) => setPointOfSale(event.target.value.replace(/\D/g, '').slice(0, 3))} /></div>
                      <div className="form-group"><label>Numero</label><input value={nextNumber} readOnly /></div>
                      <div className="form-group"><label>Tipo</label><select value={receiptType} onChange={(event) => setReceiptType(event.target.value)}>{RECEIPT_TYPES.map((item) => <option key={item} value={item}>{item}</option>)}</select></div>
                      <div className="form-group"><label>Lista</label><select value={priceList} onChange={(event) => setPriceList(event.target.value)}>{PRICE_LISTS.map((item) => <option key={item} value={item}>{item}</option>)}</select></div>
                      <div className="form-group"><label>Desc.</label><input value={globalDiscount} onChange={(event: ChangeEvent<HTMLInputElement>) => setGlobalDiscount(event.target.value)} /></div>
                      <div className="form-group"><label>Vendedor</label><input value={seller} onChange={(event: ChangeEvent<HTMLInputElement>) => setSeller(event.target.value)} /></div>
                    </div>
                  </section>

                  <section className="sales-invoice-block">
                    <div className="sales-invoice-block-head">
                      <h3>Datos del comprador</h3>
                    </div>
                    <div className="sales-compact-grid sales-compact-grid--buyer">
                      <div className="form-group"><label>Codigo Cliente</label><input value={selectedCustomer ? String(selectedCustomer.id) : ''} readOnly placeholder="Codigo cliente" /></div>
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
                          if (filteredProducts[0]) {
                            addProduct(filteredProducts[0]);
                          }
                        }}
                      >
                        Agregar
                      </button>
                    </div>
                  </div>
                </div>
                <div className="sales-search-meta">Escribe un codigo o descripcion y presiona Enter para agregar.</div>
                {itemSearch.trim() ? (
                  <div className="sales-search-results">
                    {filteredProducts.length === 0 ? (
                      <div className="sales-search-result is-empty">No se encontraron articulos para la busqueda actual.</div>
                    ) : (
                      filteredProducts.map((product) => (
                        <button key={product.id} type="button" className="sales-search-result" onClick={() => addProduct(product)}>
                          <strong>{product.name}</strong>
                          <span>{product.sku || `#${product.id}`} - {getCategoryLabel(product)} - Stock {product.stock ?? 0}</span>
                        </button>
                      ))
                    )}
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
                          const lineTotal = Number(item.quantity || 0) * Number(item.unit_price || 0);
                          return (
                            <tr key={item.product_id}>
                              <td><input value={item.quantity} onChange={(event: ChangeEvent<HTMLInputElement>) => handleCartChange(item.product_id, 'quantity', event.target.value)} /></td>
                              <td>{item.sku}</td>
                              <td>{item.name}<div className="sales-line-meta">Stock local {item.stock}</div></td>
                              <td><input value={item.unit_price} onChange={(event: ChangeEvent<HTMLInputElement>) => handleCartChange(item.product_id, 'unit_price', event.target.value)} /></td>
                              <td>0,00</td>
                              <td>{formatMoney(lineTotal)}</td>
                              <td><button type="button" className="btn btn-secondary btn-small" onClick={() => handleRemoveItem(item.product_id)}>Quitar</button></td>
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
      </section>
    </div>
  );
}

