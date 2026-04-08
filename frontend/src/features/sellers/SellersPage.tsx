import { useMemo, useState, type ChangeEvent, type FormEvent } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getCustomers } from '../../services/customers';
import { getSales } from '../../services/sales';
import type { Customer } from '../../types/customer';
import type { Sale } from '../../types/sale';

type SellersPageId = 'sellers' | 'sellers-commissions' | 'sellers-payments' | 'sellers-sales-report';

type SellerRecord = {
  id: string;
  code: string;
  name: string;
  address: string;
  phone: string;
  cell: string;
  commission_percent: number;
  archived?: boolean;
  source?: 'derived' | 'manual';
};

type SellerPaymentRecord = {
  id: number;
  payment_date: string;
  seller_id: string;
  seller_name: string;
  total_paid: number;
  total_sales: number;
  sale_ids: string[];
};

type SellerFormValues = {
  code: string;
  name: string;
  address: string;
  phone: string;
  cell: string;
  commission_percent: string;
};

const SELLERS_STORAGE_KEY = 'milo_sellers_catalog';
const SELLERS_PAYMENTS_STORAGE_KEY = 'milo_sellers_payments';

const SELLER_MODULES = [
  { id: 'sellers', label: 'Planilla' },
  { id: 'sellers-commissions', label: 'Comisiones' },
  { id: 'sellers-payments', label: 'Consulta de Pagos' },
  { id: 'sellers-sales-report', label: 'Reporte de Ventas' }
] as const;

const EMPTY_FORM: SellerFormValues = {
  code: '',
  name: '',
  address: '',
  phone: '',
  cell: '',
  commission_percent: '5.00'
};

function formatMoney(value: number) {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    minimumFractionDigits: 2
  }).format(Number(value || 0));
}

function normalizeSellerKey(value: string) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'seller';
}

function loadSellerStore(): SellerRecord[] {
  try {
    return JSON.parse(window.localStorage.getItem(SELLERS_STORAGE_KEY) || '[]');
  } catch {
    return [];
  }
}

function saveSellerStore(store: SellerRecord[]) {
  window.localStorage.setItem(SELLERS_STORAGE_KEY, JSON.stringify(store));
}

function loadSellerPaymentsStore(): SellerPaymentRecord[] {
  try {
    return JSON.parse(window.localStorage.getItem(SELLERS_PAYMENTS_STORAGE_KEY) || '[]');
  } catch {
    return [];
  }
}

function saveSellerPaymentsStore(store: SellerPaymentRecord[]) {
  window.localStorage.setItem(SELLERS_PAYMENTS_STORAGE_KEY, JSON.stringify(store));
}

function getSellerNameForSale(sale: Sale, customers: Customer[]) {
  const customer = customers.find((item) => String(item.id) === String(sale.customer_id));
  return String(customer?.seller || sale.user_name || '').trim();
}

function getSellerIdForSale(sale: Sale, customers: Customer[]) {
  const sellerName = getSellerNameForSale(sale, customers);
  return sellerName ? `seller-${normalizeSellerKey(sellerName)}` : '';
}

function buildSellerCatalog(customers: Customer[], sales: Sale[]) {
  const stored = loadSellerStore();
  const storedById = new Map(stored.map((item) => [item.id, item]));
  const names = new Set<string>();

  customers.forEach((customer) => {
    if (customer.seller) {
      names.add(String(customer.seller).trim());
    }
  });

  sales.forEach((sale) => {
    const sellerName = getSellerNameForSale(sale, customers);
    if (sellerName) {
      names.add(sellerName);
    }
  });

  const derived = [...names].map((name, index) => {
    const id = `seller-${normalizeSellerKey(name)}`;
    const storedData = storedById.get(id);
    return {
      id,
      code: storedData?.code || `VEN-${String(index + 1).padStart(3, '0')}`,
      name: storedData?.name || name,
      address: storedData?.address || '',
      phone: storedData?.phone || '',
      cell: storedData?.cell || '',
      commission_percent: Number(storedData?.commission_percent ?? 5),
      archived: Boolean(storedData?.archived),
      source: 'derived' as const
    };
  });

  const manual = stored
    .filter((item) => !item.archived && !derived.some((seller) => seller.id === item.id))
    .map((item, index) => ({
      id: item.id,
      code: item.code || `VEN-M${String(index + 1).padStart(3, '0')}`,
      name: item.name || 'Vendedor',
      address: item.address || '',
      phone: item.phone || '',
      cell: item.cell || '',
      commission_percent: Number(item.commission_percent ?? 5),
      archived: false,
      source: 'manual' as const
    }));

  return [...derived.filter((item) => !item.archived), ...manual].sort((a, b) => a.name.localeCompare(b.name));
}

function buildReceiptNumber(sale: Sale) {
  return `${String(sale.point_of_sale || '001')}-${String(sale.receipt_number || sale.id).padStart(8, '0')}`;
}

function getModuleLabel(pageId: SellersPageId) {
  return SELLER_MODULES.find((item) => item.id === pageId)?.label || SELLER_MODULES[0].label;
}

function getSellerFormValues(seller: SellerRecord | null): SellerFormValues {
  if (!seller) return { ...EMPTY_FORM };
  return {
    code: seller.code || '',
    name: seller.name || '',
    address: seller.address || '',
    phone: seller.phone || '',
    cell: seller.cell || '',
    commission_percent: Number(seller.commission_percent ?? 5).toFixed(2)
  };
}

function SellerModuleTabs({ currentPage }: { currentPage: SellersPageId }) {
  return (
    <div className="sellers-section-tabs" role="tablist" aria-label="Modulos de vendedores">
      {SELLER_MODULES.map((module) => (
        <button
          key={module.id}
          type="button"
          className={`products-tab-button${module.id === currentPage ? ' active' : ''}`}
          onClick={() => {
            window.location.hash = module.id;
          }}
        >
          {module.label}
        </button>
      ))}
    </div>
  );
}

function SellersPlanilla({
  sellers,
  search,
  setSearch,
  currentPage,
  setCurrentPage,
  onCreate,
  onEdit,
  onDelete
}: {
  sellers: SellerRecord[];
  search: string;
  setSearch: (value: string) => void;
  currentPage: number;
  setCurrentPage: (value: number) => void;
  onCreate: () => void;
  onEdit: (seller: SellerRecord) => void;
  onDelete: (seller: SellerRecord) => void;
}) {
  const filtered = useMemo(() => {
    const normalized = search.trim().toLowerCase();
    return sellers.filter((seller) => {
      if (!normalized) return true;
      return [seller.code, seller.name, seller.address, seller.phone, seller.cell]
        .some((value) => String(value || '').toLowerCase().includes(normalized));
    });
  }, [search, sellers]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / 8));
  const safePage = Math.max(1, Math.min(totalPages, currentPage));
  const rows = filtered.slice((safePage - 1) * 8, safePage * 8);

  return (
    <div className="card sellers-admin-panel">
      <div className="sellers-module-head">
        <div>
          <p className="sellers-module-kicker">Planilla</p>
          <h2>Planilla de Vendedores</h2>
        </div>
        <button className="btn btn-primary" type="button" onClick={onCreate}>+ Nuevo Vendedor</button>
      </div>

      <div className="sellers-filter-card">
        <div className="search-box sellers-search-box">
          <input value={search} placeholder="Buscar vendedor" onChange={(event) => setSearch(event.target.value)} />
        </div>
      </div>

      <div className="sellers-table-card">
        <div className="sales-lines-table-wrap">
          <table className="sales-lines-table">
            <thead>
              <tr>
                <th>Codigo</th>
                <th>Nombre</th>
                <th>Direccion</th>
                <th>Telefono</th>
                <th>Celular</th>
                <th>% Comision</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr><td colSpan={7} className="sales-empty-row">No hay vendedores para mostrar.</td></tr>
              ) : rows.map((seller) => (
                <tr key={seller.id}>
                  <td>{seller.code}</td>
                  <td>{seller.name}</td>
                  <td>{seller.address || '-'}</td>
                  <td>{seller.phone || '-'}</td>
                  <td>{seller.cell || '-'}</td>
                  <td>{Number(seller.commission_percent || 0).toFixed(2)}%</td>
                  <td>
                    <div className="btn-group">
                      <button className="btn btn-sm btn-secondary" type="button" onClick={() => onEdit(seller)}>Editar</button>
                      <button className="btn btn-sm btn-danger" type="button" onClick={() => onDelete(seller)}>Eliminar</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="sales-pagination">
          <span>Pagina {safePage} de {totalPages}</span>
          <div className="btn-group">
            <button className="btn btn-sm btn-secondary" type="button" onClick={() => setCurrentPage(Math.max(1, safePage - 1))} disabled={safePage <= 1}>Anterior</button>
            <button className="btn btn-sm btn-secondary" type="button" onClick={() => setCurrentPage(Math.min(totalPages, safePage + 1))} disabled={safePage >= totalPages}>Siguiente</button>
          </div>
        </div>
      </div>
    </div>
  );
}

function SellersCommissions({
  sellers,
  sales,
  customers,
  selectedSellerId,
  setSelectedSellerId,
  selection,
  setSelection,
  onPay
}: {
  sellers: SellerRecord[];
  sales: Sale[];
  customers: Customer[];
  selectedSellerId: string;
  setSelectedSellerId: (value: string) => void;
  selection: Record<string, boolean>;
  setSelection: (value: Record<string, boolean>) => void;
  onPay: (seller: SellerRecord, rows: Array<{ id: string; total: number; commissionAmount: number }>) => void;
}) {
  const seller = sellers.find((item) => item.id === selectedSellerId) || null;
  const rows = useMemo(() => {
    if (!seller) return [];
    return sales
      .filter((sale) => getSellerIdForSale(sale, customers) === seller.id)
      .map((sale) => {
        const customer = customers.find((item) => String(item.id) === String(sale.customer_id));
        const total = Number(sale.total || 0);
        const commissionPercent = Number(seller.commission_percent || 0);
        return {
          id: String(sale.id),
          sellerName: seller.name,
          date: sale.created_at || '',
          receiptNumber: buildReceiptNumber(sale),
          customerName: customer?.name || sale.customer_name || 'Consumidor final',
          total,
          balance: total,
          commissionPercent,
          commissionAmount: total * commissionPercent / 100
        };
      });
  }, [customers, sales, seller]);

  const normalizedSelection = useMemo(() => {
    const next: Record<string, boolean> = {};
    rows.forEach((row) => {
      next[row.id] = selection[row.id] !== undefined ? selection[row.id] : true;
    });
    return next;
  }, [rows, selection]);

  const totals = rows.reduce((acc, row) => {
    if (normalizedSelection[row.id]) {
      acc.totalSales += row.total;
      acc.totalCommissions += row.commissionAmount;
    }
    return acc;
  }, { totalSales: 0, totalCommissions: 0 });

  return (
    <div className="card sellers-admin-panel">
      <div className="sellers-module-head">
        <div>
          <p className="sellers-module-kicker">Comisiones</p>
          <h2>Liquidacion de Comisiones por Vendedor</h2>
        </div>
      </div>

      <div className="sellers-filter-card">
        <div className="sellers-filter-grid">
          <div className="form-group">
            <label>Seleccione un vendedor</label>
            <select value={selectedSellerId} onChange={(event) => setSelectedSellerId(event.target.value)}>
              <option value="">Seleccionar vendedor</option>
              {sellers.map((item) => (
                <option key={item.id} value={item.id}>{item.name}</option>
              ))}
            </select>
          </div>
          <div className="sellers-actions-inline">
            <button className="btn btn-primary" type="button" onClick={() => setSelection(normalizedSelection)}>Calcular</button>
          </div>
        </div>
        <div className="sellers-info-banner">
          <strong>% comision:</strong> {seller ? Number(seller.commission_percent || 0).toFixed(2) : '0.00'}%
          <span>Calculada sobre el TOTAL</span>
        </div>
      </div>

      <div className="sellers-table-card">
        <div className="sales-lines-table-wrap">
          <table className="sales-lines-table">
            <thead>
              <tr>
                <th>Pagar</th>
                <th>Vendedor</th>
                <th>Fecha</th>
                <th>Numero comprobante</th>
                <th>Cliente</th>
                <th>Total</th>
                <th>Saldo</th>
                <th>% comision</th>
                <th>Comision</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr><td colSpan={9} className="sales-empty-row">No hay ventas para calcular comisiones.</td></tr>
              ) : rows.map((row) => (
                <tr key={row.id}>
                  <td><input type="checkbox" checked={normalizedSelection[row.id]} onChange={() => setSelection({ ...normalizedSelection, [row.id]: !normalizedSelection[row.id] })} /></td>
                  <td>{row.sellerName}</td>
                  <td>{row.date ? new Date(row.date).toLocaleDateString('es-AR') : '-'}</td>
                  <td>{row.receiptNumber}</td>
                  <td>{row.customerName}</td>
                  <td>{formatMoney(row.total)}</td>
                  <td>{formatMoney(row.balance)}</td>
                  <td>{row.commissionPercent.toFixed(2)}%</td>
                  <td>{formatMoney(row.commissionAmount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="sellers-totals-panel">
          <div className="sales-summary-row"><span>Total ventas</span><strong>{formatMoney(totals.totalSales)}</strong></div>
          <div className="sales-summary-total"><span>Total comisiones</span><strong>{formatMoney(totals.totalCommissions)}</strong></div>
        </div>

        <div className="sellers-actions-row">
          <button className="btn btn-success" type="button" disabled={!seller || rows.length === 0} onClick={() => seller && onPay(seller, rows.filter((row) => normalizedSelection[row.id]))}>Pagar</button>
          <button className="btn btn-secondary" type="button" onClick={() => { window.location.hash = 'sellers'; }}>Salir</button>
        </div>

        <div className="sellers-help-text">
          F3 cambia porcentaje de comision de una factura. Enter agrega o quita la factura del total. No se calculara la comision de los renglones amarillos.
        </div>
      </div>
    </div>
  );
}

function SellersPayments({
  payments,
  search,
  setSearch,
  currentPage,
  setCurrentPage
}: {
  payments: SellerPaymentRecord[];
  search: string;
  setSearch: (value: string) => void;
  currentPage: number;
  setCurrentPage: (value: number) => void;
}) {
  const filtered = useMemo(() => {
    const normalized = search.trim().toLowerCase();
    return payments.filter((payment) => {
      if (!normalized) return true;
      return [payment.id, payment.seller_name, payment.total_paid]
        .some((value) => String(value || '').toLowerCase().includes(normalized));
    });
  }, [payments, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / 8));
  const safePage = Math.max(1, Math.min(totalPages, currentPage));
  const rows = filtered.slice((safePage - 1) * 8, safePage * 8);

  return (
    <div className="card sellers-admin-panel">
      <div className="sellers-module-head">
        <div>
          <p className="sellers-module-kicker">Pagos</p>
          <h2>Consulta de Pagos</h2>
        </div>
        <div className="search-box sellers-search-box">
          <input value={search} placeholder="Buscar pago..." onChange={(event) => setSearch(event.target.value)} />
        </div>
      </div>

      <div className="sellers-table-card">
        <div className="sales-lines-table-wrap">
          <table className="sales-lines-table">
            <thead>
              <tr>
                <th>ID Pago</th>
                <th>Fecha de Pago</th>
                <th>Vendedor</th>
                <th>Total Pagado</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr><td colSpan={4} className="sales-empty-row">No hay pagos registrados.</td></tr>
              ) : rows.map((payment) => (
                <tr key={payment.id}>
                  <td>{payment.id}</td>
                  <td>{new Date(payment.payment_date).toLocaleDateString('es-AR')}</td>
                  <td>{payment.seller_name}</td>
                  <td>{formatMoney(payment.total_paid || 0)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="sales-pagination">
          <span>Pagina {safePage} de {totalPages}</span>
          <div className="btn-group">
            <button className="btn btn-sm btn-secondary" type="button" onClick={() => setCurrentPage(Math.max(1, safePage - 1))} disabled={safePage <= 1}>Anterior</button>
            <button className="btn btn-sm btn-secondary" type="button" onClick={() => setCurrentPage(Math.min(totalPages, safePage + 1))} disabled={safePage >= totalPages}>Siguiente</button>
          </div>
        </div>
      </div>
    </div>
  );
}

function SellersSalesReport({
  sellers,
  sales,
  customers
}: {
  sellers: SellerRecord[];
  sales: Sale[];
  customers: Customer[];
}) {
  const [sellerId, setSellerId] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [generated, setGenerated] = useState(false);

  const rows = useMemo(() => {
    if (!generated || !sellerId) return [];
    const from = dateFrom ? new Date(`${dateFrom}T00:00:00`) : null;
    const to = dateTo ? new Date(`${dateTo}T23:59:59`) : null;
    return sales.filter((sale) => {
      if (getSellerIdForSale(sale, customers) !== sellerId) return false;
      const saleDate = sale.created_at ? new Date(sale.created_at) : null;
      if (!saleDate) return false;
      if (from && saleDate < from) return false;
      if (to && saleDate > to) return false;
      return true;
    });
  }, [customers, dateFrom, dateTo, generated, sales, sellerId]);

  const total = rows.reduce((acc, sale) => acc + Number(sale.total || 0), 0);

  return (
    <div className="card sellers-admin-panel">
      <div className="sellers-module-head">
        <div>
          <p className="sellers-module-kicker">Reporte</p>
          <h2>Reporte de Ventas por Vendedor</h2>
        </div>
      </div>

      <div className="sellers-filter-card">
        <div className="sellers-filter-grid">
          <div className="form-group">
            <label>Vendedor</label>
            <select value={sellerId} onChange={(event) => setSellerId(event.target.value)}>
              <option value="">Seleccionar vendedor</option>
              {sellers.map((item) => (
                <option key={item.id} value={item.id}>{item.name}</option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label>Desde</label>
            <input type="date" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} />
          </div>
          <div className="form-group">
            <label>Hasta</label>
            <input type="date" value={dateTo} onChange={(event) => setDateTo(event.target.value)} />
          </div>
          <div className="sellers-actions-inline">
            <button className="btn btn-primary" type="button" onClick={() => setGenerated(true)}>Generar reporte</button>
          </div>
        </div>
      </div>

      <div className="sellers-table-card">
        <div className="sales-lines-table-wrap">
          <table className="sales-lines-table">
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Comprobante</th>
                <th>Cliente</th>
                <th>Canal</th>
                <th>Total</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr><td colSpan={5} className="sales-empty-row">No hay ventas para el reporte actual.</td></tr>
              ) : rows.map((sale) => {
                const customer = customers.find((item) => String(item.id) === String(sale.customer_id));
                return (
                  <tr key={sale.id}>
                    <td>{sale.created_at ? new Date(sale.created_at).toLocaleDateString('es-AR') : '-'}</td>
                    <td>{buildReceiptNumber(sale)}</td>
                    <td>{customer?.name || sale.customer_name || 'Consumidor final'}</td>
                    <td>{sale.channel || 'Mostrador'}</td>
                    <td>{formatMoney(Number(sale.total || 0))}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="sellers-totals-panel">
          <div className="sales-summary-total"><span>Total vendido</span><strong>{formatMoney(total)}</strong></div>
        </div>
      </div>
    </div>
  );
}

export function SellersPage({ pageId = 'sellers' }: { pageId?: string }) {
  const normalizedPage = (SELLER_MODULES.some((item) => item.id === pageId) ? pageId : 'sellers') as SellersPageId;
  const customersQuery = useQuery({
    queryKey: ['sellers', 'customers'],
    queryFn: () => getCustomers(''),
    staleTime: 30_000
  });
  const salesQuery = useQuery({
    queryKey: ['sellers', 'sales'],
    queryFn: () => getSales({}),
    staleTime: 30_000
  });

  const [planillaSearch, setPlanillaSearch] = useState('');
  const [planillaPage, setPlanillaPage] = useState(1);
  const [paymentsSearch, setPaymentsSearch] = useState('');
  const [paymentsPage, setPaymentsPage] = useState(1);
  const [selection, setSelection] = useState<Record<string, boolean>>({});
  const [storedVersion, setStoredVersion] = useState(0);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingSellerId, setEditingSellerId] = useState('');
  const [formValues, setFormValues] = useState<SellerFormValues>({ ...EMPTY_FORM });

  const customers = customersQuery.data || [];
  const sales = salesQuery.data || [];
  const sellers = useMemo(() => buildSellerCatalog(customers, sales), [customers, sales, storedVersion]);
  const payments = useMemo(() => loadSellerPaymentsStore(), [storedVersion]);
  const editingSeller = sellers.find((item) => item.id === editingSellerId) || null;
  const defaultSellerId = sellers[0]?.id || '';
  const [commissionSellerId, setCommissionSellerId] = useState('');

  const activeCommissionSellerId = commissionSellerId || defaultSellerId;

  function refreshLocalStores() {
    setStoredVersion((current) => current + 1);
  }

  function openCreateModal() {
    setEditingSellerId('');
    setFormValues({ ...EMPTY_FORM, code: `VEN-${String(sellers.length + 1).padStart(3, '0')}` });
    setIsModalOpen(true);
  }

  function openEditModal(seller: SellerRecord) {
    setEditingSellerId(seller.id);
    setFormValues(getSellerFormValues(seller));
    setIsModalOpen(true);
  }

  function closeModal() {
    setIsModalOpen(false);
    setEditingSellerId('');
  }

  function handleFormChange(event: ChangeEvent<HTMLInputElement>) {
    const { name, value } = event.target;
    setFormValues((current) => ({ ...current, [name]: value }));
  }

  function handleSaveSeller(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const store = loadSellerStore();
    const id = editingSeller?.id || `seller-${Date.now()}`;
    const record: SellerRecord = {
      id,
      code: formValues.code.trim(),
      name: formValues.name.trim(),
      address: formValues.address.trim(),
      phone: formValues.phone.trim(),
      cell: formValues.cell.trim(),
      commission_percent: Number(formValues.commission_percent || 0),
      archived: false
    };
    const index = store.findIndex((item) => item.id === id);
    if (index >= 0) store[index] = { ...store[index], ...record };
    else store.push(record);
    saveSellerStore(store);
    refreshLocalStores();
    closeModal();
  }

  function handleDeleteSeller(seller: SellerRecord) {
    if (!window.confirm('Seguro que deseas eliminar este vendedor?')) return;
    const store = loadSellerStore();
    const index = store.findIndex((item) => item.id === seller.id);
    if (index >= 0) {
      store[index] = { ...store[index], archived: true };
    } else {
      store.push({ id: seller.id, code: seller.code, name: seller.name, address: '', phone: '', cell: '', commission_percent: seller.commission_percent, archived: true });
    }
    saveSellerStore(store);
    refreshLocalStores();
  }

  function handlePayCommissions(seller: SellerRecord, rows: Array<{ id: string; total: number; commissionAmount: number }>) {
    if (rows.length === 0) {
      window.alert('Selecciona al menos una factura para registrar el pago.');
      return;
    }
    const totals = rows.reduce((acc, row) => {
      acc.totalSales += row.total;
      acc.totalCommissions += row.commissionAmount;
      return acc;
    }, { totalSales: 0, totalCommissions: 0 });
    const nextPayments = loadSellerPaymentsStore();
    nextPayments.unshift({
      id: Date.now(),
      payment_date: new Date().toISOString(),
      seller_id: seller.id,
      seller_name: seller.name,
      total_paid: Number(totals.totalCommissions.toFixed(2)),
      total_sales: Number(totals.totalSales.toFixed(2)),
      sale_ids: rows.map((row) => row.id)
    });
    saveSellerPaymentsStore(nextPayments);
    setSelection({});
    refreshLocalStores();
    window.alert('Pago de comisiones registrado en la UI.');
  }

  if (customersQuery.isLoading || salesQuery.isLoading) {
    return (
      <section className="sellers-admin-content">
        <SellerModuleTabs currentPage={normalizedPage} />
        <div className="card sellers-admin-panel">Cargando...</div>
      </section>
    );
  }

  if (customersQuery.isError || salesQuery.isError) {
    return (
      <section className="sellers-admin-content">
        <SellerModuleTabs currentPage={normalizedPage} />
        <div className="card sellers-admin-panel">
          Error: {customersQuery.error instanceof Error ? customersQuery.error.message : salesQuery.error instanceof Error ? salesQuery.error.message : 'No se pudo cargar vendedores.'}
        </div>
      </section>
    );
  }

  return (
    <section className="sellers-admin-content">
      <SellerModuleTabs currentPage={normalizedPage} />

      {normalizedPage === 'sellers' ? (
        <SellersPlanilla
          sellers={sellers}
          search={planillaSearch}
          setSearch={(value) => {
            setPlanillaSearch(value);
            setPlanillaPage(1);
          }}
          currentPage={planillaPage}
          setCurrentPage={setPlanillaPage}
          onCreate={openCreateModal}
          onEdit={openEditModal}
          onDelete={handleDeleteSeller}
        />
      ) : null}

      {normalizedPage === 'sellers-commissions' ? (
        <SellersCommissions
          sellers={sellers}
          sales={sales}
          customers={customers}
          selectedSellerId={activeCommissionSellerId}
          setSelectedSellerId={(value) => setCommissionSellerId(value)}
          selection={selection}
          setSelection={setSelection}
          onPay={handlePayCommissions}
        />
      ) : null}

      {normalizedPage === 'sellers-payments' ? (
        <SellersPayments
          payments={payments}
          search={paymentsSearch}
          setSearch={(value) => {
            setPaymentsSearch(value);
            setPaymentsPage(1);
          }}
          currentPage={paymentsPage}
          setCurrentPage={setPaymentsPage}
        />
      ) : null}

      {normalizedPage === 'sellers-sales-report' ? (
        <SellersSalesReport sellers={sellers} sales={sales} customers={customers} />
      ) : null}

      {isModalOpen ? (
        <div className="modal-overlay">
          <div className="modal seller-modal">
            <div className="modal-header seller-modal-header">
              <div>
                <h3>{editingSeller ? 'Editar Vendedor' : 'Nuevo Vendedor'}</h3>
                <p className="seller-modal-subtitle">Datos del vendedor.</p>
              </div>
              <button type="button" className="modal-close" onClick={closeModal}>&times;</button>
            </div>
            <form onSubmit={handleSaveSeller}>
              <div className="modal-body seller-modal-body">
                <div className="seller-form-grid">
                  <div className="form-group">
                    <label htmlFor="seller-code">Codigo</label>
                    <input id="seller-code" name="code" value={formValues.code} onChange={handleFormChange} placeholder="VEN-001" required />
                  </div>
                  <div className="form-group">
                    <label htmlFor="seller-name">Nombre</label>
                    <input id="seller-name" name="name" value={formValues.name} onChange={handleFormChange} required />
                  </div>
                  <div className="form-group seller-field-span-2">
                    <label htmlFor="seller-address">Direccion</label>
                    <input id="seller-address" name="address" value={formValues.address} onChange={handleFormChange} />
                  </div>
                  <div className="form-group">
                    <label htmlFor="seller-phone">Telefono</label>
                    <input id="seller-phone" name="phone" value={formValues.phone} onChange={handleFormChange} />
                  </div>
                  <div className="form-group">
                    <label htmlFor="seller-cell">Celular</label>
                    <input id="seller-cell" name="cell" value={formValues.cell} onChange={handleFormChange} />
                  </div>
                  <div className="form-group">
                    <label htmlFor="seller-commission">%</label>
                    <input id="seller-commission" name="commission_percent" type="number" min="0" step="0.01" value={formValues.commission_percent} onChange={handleFormChange} />
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button className="btn btn-secondary" type="button" onClick={closeModal}>Cancelar</button>
                <button className="btn btn-success" type="submit">Guardar</button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </section>
  );
}

