import { useMemo, useState, type ChangeEvent, type FormEvent } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getCustomers } from '../../api/customers';
import { getSales } from '../../api/sales';
import type { Customer } from '../../types/customer';
import type { Sale } from '../../types/sale';

type CashPageId = 'cash' | 'cash-expenses' | 'cash-withdrawals' | 'cash-day';
type CashEntryType = 'income' | 'expenses' | 'withdrawals';

type CashEntry = {
  id: number;
  date: string;
  description: string;
  person: string;
  amount: number;
  notes: string;
};

type CashFormValues = {
  date: string;
  description: string;
  person: string;
  amount: string;
  notes: string;
};

const CASH_STORAGE_KEYS: Record<CashEntryType, string> = {
  income: 'milo_cash_income',
  expenses: 'milo_cash_expenses',
  withdrawals: 'milo_cash_withdrawals'
};

const CASH_MODULES = [
  { id: 'cash', label: 'Ingresos varios' },
  { id: 'cash-expenses', label: 'Gastos varios' },
  { id: 'cash-withdrawals', label: 'Retiros' },
  { id: 'cash-day', label: 'Caja del Dia' }
] as const;

function formatMoney(value: number) {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    minimumFractionDigits: 2
  }).format(Number(value || 0));
}

function formatDateInput(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function loadCashEntries(type: CashEntryType): CashEntry[] {
  try {
    return JSON.parse(window.localStorage.getItem(CASH_STORAGE_KEYS[type]) || '[]');
  } catch {
    return [];
  }
}

function saveCashEntries(type: CashEntryType, entries: CashEntry[]) {
  window.localStorage.setItem(CASH_STORAGE_KEYS[type], JSON.stringify(entries));
}

function getCashConfig(type: CashEntryType) {
  return {
    income: {
      title: 'Ingresos del dia',
      button: 'Nuevo Ingreso',
      personLabel: 'Cliente',
      modalTitle: 'Nuevo Ingreso',
      descriptionLabel: 'Descripcion',
      notesLabel: 'Observaciones'
    },
    expenses: {
      title: 'Gastos del dia',
      button: 'Nuevo Gasto',
      personLabel: 'Proveedor / Nombre',
      modalTitle: 'Nuevo Gasto',
      descriptionLabel: 'Descripcion',
      notesLabel: 'Observaciones'
    },
    withdrawals: {
      title: 'Retiros del dia',
      button: 'Nuevo Retiro',
      personLabel: 'Responsable',
      modalTitle: 'Nuevo Retiro',
      descriptionLabel: 'Descripcion',
      notesLabel: ''
    }
  }[type];
}

function getCashSectionType(pageId: CashPageId): CashEntryType | null {
  if (pageId === 'cash') return 'income';
  if (pageId === 'cash-expenses') return 'expenses';
  if (pageId === 'cash-withdrawals') return 'withdrawals';
  return null;
}

function CashModuleTabs({ currentPage }: { currentPage: CashPageId }) {
  return (
    <div className="cash-section-tabs" role="tablist" aria-label="Modulos de caja">
      {CASH_MODULES.map((module) => (
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

function CashTableSection({
  type,
  entries,
  customers,
  search,
  setSearch,
  currentPage,
  setCurrentPage,
  onCreate
}: {
  type: CashEntryType;
  entries: CashEntry[];
  customers: Customer[];
  search: string;
  setSearch: (value: string) => void;
  currentPage: number;
  setCurrentPage: (value: number) => void;
  onCreate: () => void;
}) {
  const config = getCashConfig(type);
  const filtered = useMemo(() => {
    const normalized = search.trim().toLowerCase();
    return entries.filter((entry) => {
      if (!normalized) return true;
      return [entry.date, entry.description, entry.person, entry.amount, entry.notes]
        .some((value) => String(value || '').toLowerCase().includes(normalized));
    });
  }, [entries, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / 8));
  const safePage = Math.max(1, Math.min(totalPages, currentPage));
  const rows = filtered.slice((safePage - 1) * 8, safePage * 8);
  const lastColumn = type === 'income' ? 'Cliente' : 'Nombre';

  return (
    <div className="card cash-admin-panel">
      <div className="cash-module-head">
        <div>
          <p className="cash-module-kicker">Caja</p>
          <h2>{config.title}</h2>
        </div>
        <button className="btn btn-primary" type="button" onClick={onCreate}>{config.button}</button>
      </div>

      <div className="cash-filter-card">
        <div className="search-box cash-search-box">
          <input value={search} placeholder="Buscar..." onChange={(event) => setSearch(event.target.value)} />
        </div>
      </div>

      <div className="cash-table-card">
        <div className="sales-lines-table-wrap">
          <table className="sales-lines-table">
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Descripcion</th>
                <th>{lastColumn}</th>
                <th>Importe</th>
                {type === 'withdrawals' ? null : <th>Observaciones</th>}
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr><td colSpan={type === 'withdrawals' ? 4 : 5} className="sales-empty-row">No hay movimientos para mostrar.</td></tr>
              ) : rows.map((entry) => (
                <tr key={entry.id}>
                  <td>{new Date(`${entry.date}T00:00:00`).toLocaleDateString('es-AR')}</td>
                  <td>{entry.description}</td>
                  <td>{entry.person || (type === 'income' ? customers.find((item) => item.name === entry.person)?.name : '-') || '-'}</td>
                  <td>{formatMoney(entry.amount || 0)}</td>
                  {type === 'withdrawals' ? null : <td>{entry.notes || '-'}</td>}
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

function CashDetailRow({ label, amount, onClick }: { label: string; amount: number; onClick?: () => void }) {
  return (
    <div className="cash-detail-row">
      <div>
        <strong>{label}</strong>
      </div>
      <div className="cash-detail-actions">
        <span>{formatMoney(amount)}</span>
        {onClick ? <button className="btn btn-sm btn-secondary" type="button" onClick={onClick}>Ver</button> : null}
      </div>
    </div>
  );
}

function CashDaySection({
  date,
  setDate,
  sales,
  income,
  expenses,
  withdrawals
}: {
  date: string;
  setDate: (value: string) => void;
  sales: Sale[];
  income: CashEntry[];
  expenses: CashEntry[];
  withdrawals: CashEntry[];
}) {
  function sumEntries(entries: CashEntry[]) {
    return entries.filter((entry) => entry.date === date).reduce((acc, entry) => acc + Number(entry.amount || 0), 0);
  }

  function sumSales(paymentMethod?: string) {
    return sales
      .filter((sale) => {
        if (!sale.created_at) return false;
        const saleDate = new Date(sale.created_at).toISOString().slice(0, 10);
        if (saleDate !== date) return false;
        if (!paymentMethod) return true;
        return String(sale.payment_method || 'cash') === paymentMethod;
      })
      .reduce((acc, sale) => acc + Number(sale.total || 0), 0);
  }

  const salesCash = sumSales('cash');
  const incomeManual = sumEntries(income);
  const expensesManual = sumEntries(expenses);
  const withdrawalsManual = sumEntries(withdrawals);
  const digitalIncome = sumSales('card') + sumSales('transfer');
  const cashInitial = 0;
  const totalIncomeCash = salesCash + incomeManual;
  const totalExpensesCash = expensesManual + withdrawalsManual;
  const cashFinal = cashInitial + totalIncomeCash - totalExpensesCash;

  return (
    <div className="card cash-admin-panel">
      <div className="cash-module-head">
        <div>
          <p className="cash-module-kicker">Resumen diario</p>
          <h2>Caja del dia</h2>
        </div>
        <div className="form-group cash-day-picker">
          <label>Fecha</label>
          <input type="date" value={date} onChange={(event) => setDate(event.target.value)} />
        </div>
      </div>

      <div className="cash-summary-grid">
        <div className="cash-summary-card cash-summary-card--neutral"><span>Caja inicial</span><strong>{formatMoney(cashInitial)}</strong></div>
        <div className="cash-summary-card cash-summary-card--income"><span>Total ingresos efectivo</span><strong>{formatMoney(totalIncomeCash)}</strong></div>
        <div className="cash-summary-card cash-summary-card--expense"><span>Total egresos efectivo</span><strong>{formatMoney(totalExpensesCash)}</strong></div>
        <div className="cash-summary-card cash-summary-card--balance"><span>Saldo final en caja</span><strong>{formatMoney(cashFinal)}</strong></div>
      </div>

      <div className="cash-dashboard-grid">
        <div className="cash-dashboard-panel">
          <h3>Detalle de ingresos efectivo</h3>
          <CashDetailRow label="Ventas en efectivo" amount={salesCash} />
          <CashDetailRow label="Cobranzas en efectivo" amount={0} />
          <CashDetailRow label="N/C proveedor" amount={0} />
          <CashDetailRow label="Otros ingresos" amount={incomeManual} onClick={() => { window.location.hash = 'cash'; }} />
        </div>
        <div className="cash-dashboard-panel">
          <h3>Detalle de egresos efectivo</h3>
          <CashDetailRow label="Compras en efectivo" amount={0} />
          <CashDetailRow label="Pagos a proveedores" amount={0} />
          <CashDetailRow label="N/C cliente" amount={0} />
          <CashDetailRow label="Otros gastos" amount={expensesManual} onClick={() => { window.location.hash = 'cash-expenses'; }} />
          <CashDetailRow label="Retiros" amount={withdrawalsManual} onClick={() => { window.location.hash = 'cash-withdrawals'; }} />
        </div>
        <div className="cash-dashboard-panel">
          <h3>Otros ingresos (no efectivo)</h3>
          <CashDetailRow label="Ingresos pago digital" amount={digitalIncome} />
          <CashDetailRow label="Ingresos cheque" amount={0} />
          <CashDetailRow label="Otros ingresos" amount={0} />
        </div>
        <div className="cash-dashboard-panel">
          <h3>Otras salidas (no efectivo)</h3>
          <CashDetailRow label="Salidas pago digital" amount={0} />
          <CashDetailRow label="Salidas cheque" amount={0} />
          <CashDetailRow label="Otros egresos" amount={0} />
        </div>
      </div>
    </div>
  );
}

export function CashPage({ pageId = 'cash' }: { pageId?: string }) {
  const normalizedPage = (CASH_MODULES.some((item) => item.id === pageId) ? pageId : 'cash') as CashPageId;
  const customersQuery = useQuery({
    queryKey: ['cash', 'customers'],
    queryFn: () => getCustomers(''),
    staleTime: 30_000
  });
  const salesQuery = useQuery({
    queryKey: ['cash', 'sales'],
    queryFn: () => getSales({}),
    staleTime: 30_000
  });

  const [search, setSearch] = useState<Record<CashEntryType, string>>({
    income: '',
    expenses: '',
    withdrawals: ''
  });
  const [pages, setPages] = useState<Record<CashEntryType, number>>({
    income: 1,
    expenses: 1,
    withdrawals: 1
  });
  const [dayDate, setDayDate] = useState(() => formatDateInput(new Date()));
  const [storedVersion, setStoredVersion] = useState(0);
  const [modalType, setModalType] = useState<CashEntryType>('income');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formValues, setFormValues] = useState<CashFormValues>({
    date: formatDateInput(new Date()),
    description: '',
    person: '',
    amount: '',
    notes: ''
  });

  const customers = customersQuery.data || [];
  const sales = salesQuery.data || [];
  const incomeEntries = useMemo(() => loadCashEntries('income'), [storedVersion]);
  const expenseEntries = useMemo(() => loadCashEntries('expenses'), [storedVersion]);
  const withdrawalEntries = useMemo(() => loadCashEntries('withdrawals'), [storedVersion]);

  function refreshEntries() {
    setStoredVersion((current) => current + 1);
  }

  function openModal(type: CashEntryType) {
    setModalType(type);
    setFormValues({
      date: formatDateInput(new Date()),
      description: '',
      person: '',
      amount: '',
      notes: ''
    });
    setIsModalOpen(true);
  }

  function closeModal() {
    setIsModalOpen(false);
  }

  function handleFormChange(event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) {
    const { name, value } = event.target;
    setFormValues((current) => ({ ...current, [name]: value }));
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const items = loadCashEntries(modalType);
    items.unshift({
      id: Date.now(),
      date: formValues.date,
      description: formValues.description.trim(),
      person: formValues.person.trim(),
      amount: Number(formValues.amount || 0),
      notes: formValues.notes.trim()
    });
    saveCashEntries(modalType, items);
    refreshEntries();
    closeModal();
  }

  if (customersQuery.isLoading || salesQuery.isLoading) {
    return (
      <section className="cash-admin-content">
        <CashModuleTabs currentPage={normalizedPage} />
        <div className="card cash-admin-panel">Cargando...</div>
      </section>
    );
  }

  if (customersQuery.isError || salesQuery.isError) {
    return (
      <section className="cash-admin-content">
        <CashModuleTabs currentPage={normalizedPage} />
        <div className="card cash-admin-panel">
          Error: {customersQuery.error instanceof Error ? customersQuery.error.message : salesQuery.error instanceof Error ? salesQuery.error.message : 'No se pudo cargar caja.'}
        </div>
      </section>
    );
  }

  const activeType = getCashSectionType(normalizedPage);

  return (
    <section className="cash-admin-content">
      <CashModuleTabs currentPage={normalizedPage} />

      {activeType === 'income' ? (
        <CashTableSection
          type="income"
          entries={incomeEntries}
          customers={customers}
          search={search.income}
          setSearch={(value) => {
            setSearch((current) => ({ ...current, income: value }));
            setPages((current) => ({ ...current, income: 1 }));
          }}
          currentPage={pages.income}
          setCurrentPage={(value) => setPages((current) => ({ ...current, income: value }))}
          onCreate={() => openModal('income')}
        />
      ) : null}

      {activeType === 'expenses' ? (
        <CashTableSection
          type="expenses"
          entries={expenseEntries}
          customers={customers}
          search={search.expenses}
          setSearch={(value) => {
            setSearch((current) => ({ ...current, expenses: value }));
            setPages((current) => ({ ...current, expenses: 1 }));
          }}
          currentPage={pages.expenses}
          setCurrentPage={(value) => setPages((current) => ({ ...current, expenses: value }))}
          onCreate={() => openModal('expenses')}
        />
      ) : null}

      {activeType === 'withdrawals' ? (
        <CashTableSection
          type="withdrawals"
          entries={withdrawalEntries}
          customers={customers}
          search={search.withdrawals}
          setSearch={(value) => {
            setSearch((current) => ({ ...current, withdrawals: value }));
            setPages((current) => ({ ...current, withdrawals: 1 }));
          }}
          currentPage={pages.withdrawals}
          setCurrentPage={(value) => setPages((current) => ({ ...current, withdrawals: value }))}
          onCreate={() => openModal('withdrawals')}
        />
      ) : null}

      {normalizedPage === 'cash-day' ? (
        <CashDaySection
          date={dayDate}
          setDate={setDayDate}
          sales={sales}
          income={incomeEntries}
          expenses={expenseEntries}
          withdrawals={withdrawalEntries}
        />
      ) : null}

      {isModalOpen ? (
        <div className="modal-overlay">
          <div className="modal cash-modal">
            <div className="modal-header cash-modal-header">
              <div>
                <h3>{getCashConfig(modalType).modalTitle}</h3>
                <p className="cash-modal-subtitle">Carga manual de movimientos de caja con la misma estetica del resto del sistema.</p>
              </div>
              <button type="button" className="modal-close" onClick={closeModal}>&times;</button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="modal-body cash-modal-body">
                <div className="cash-form-grid">
                  <div className="form-group">
                    <label htmlFor="cash-date">Fecha</label>
                    <input id="cash-date" name="date" type="date" value={formValues.date} onChange={handleFormChange} required />
                  </div>
                  <div className="form-group">
                    <label htmlFor="cash-description">{getCashConfig(modalType).descriptionLabel}</label>
                    <input id="cash-description" name="description" value={formValues.description} onChange={handleFormChange} required />
                  </div>
                  <div className="form-group">
                    <label htmlFor="cash-person">{getCashConfig(modalType).personLabel}</label>
                    {modalType === 'income' ? (
                      <select id="cash-person" name="person" value={formValues.person} onChange={handleFormChange}>
                        <option value="">Seleccionar cliente</option>
                        {customers.map((customer) => (
                          <option key={customer.id} value={customer.name}>{customer.name}</option>
                        ))}
                      </select>
                    ) : (
                      <input id="cash-person" name="person" value={formValues.person} onChange={handleFormChange} />
                    )}
                  </div>
                  <div className="form-group">
                    <label htmlFor="cash-amount">Importe</label>
                    <input id="cash-amount" name="amount" type="number" min="0" step="0.01" value={formValues.amount} onChange={handleFormChange} required />
                  </div>
                  {modalType === 'withdrawals' ? null : (
                    <div className="form-group cash-field-span-2">
                      <label htmlFor="cash-notes">{getCashConfig(modalType).notesLabel}</label>
                      <textarea id="cash-notes" name="notes" rows={4} value={formValues.notes} onChange={handleFormChange} />
                    </div>
                  )}
                </div>
              </div>
              <div className="modal-footer cash-modal-footer">
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
