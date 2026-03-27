let cashCustomers = [];
let cashSales = [];
let cashEntries = {
  income: [],
  expenses: [],
  withdrawals: []
};

const CASH_STORAGE_KEYS = {
  income: 'milo_cash_income',
  expenses: 'milo_cash_expenses',
  withdrawals: 'milo_cash_withdrawals'
};

const cashUiState = {
  activeSection: 'income',
  search: {
    income: '',
    expenses: '',
    withdrawals: ''
  },
  page: {
    income: 1,
    expenses: 1,
    withdrawals: 1
  },
  dayDate: '',
  modalType: 'income'
};

function cashEscapeHtml(value) {
  return app.escapeHtml(value ?? '');
}

function cashEscapeAttr(value) {
  return app.escapeAttr(value ?? '');
}

function cashFormatDateInput(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function loadCashEntries(type) {
  try {
    return JSON.parse(localStorage.getItem(CASH_STORAGE_KEYS[type]) || '[]');
  } catch (error) {
    return [];
  }
}

function saveCashEntries(type, items) {
  localStorage.setItem(CASH_STORAGE_KEYS[type], JSON.stringify(items));
}

async function renderCash(sectionId = 'income') {
  const content = document.getElementById('page-content');
  content.innerHTML = '<div class="loading">Cargando...</div>';
  cashUiState.activeSection = sectionId;
  if (!cashUiState.dayDate) cashUiState.dayDate = cashFormatDateInput(new Date());

  try {
    const [customers, sales] = await Promise.all([
      api.customers.getAll({}),
      api.sales.getAll({}).catch(() => [])
    ]);

    cashCustomers = customers;
    cashSales = Array.isArray(sales) ? sales : [];
    cashEntries.income = loadCashEntries('income');
    cashEntries.expenses = loadCashEntries('expenses');
    cashEntries.withdrawals = loadCashEntries('withdrawals');

    content.innerHTML = `
      <section class="cash-admin-content">
        <div class="cash-admin-panel card" id="cash-admin-panel"></div>
      </section>
    `;
    renderCashSection();
  } catch (error) {
    content.innerHTML = '<div class="alert alert-warning">Error: ' + cashEscapeHtml(error.message) + '</div>';
  }
}

function renderCashSection() {
  const panel = document.getElementById('cash-admin-panel');
  if (!panel) return;

  if (cashUiState.activeSection === 'income') {
    panel.innerHTML = renderCashTableSection('income');
    return;
  }
  if (cashUiState.activeSection === 'expenses') {
    panel.innerHTML = renderCashTableSection('expenses');
    return;
  }
  if (cashUiState.activeSection === 'withdrawals') {
    panel.innerHTML = renderCashTableSection('withdrawals');
    return;
  }
  panel.innerHTML = renderCashDaySection();
}

function selectCashSection(sectionId) {
  const routeMap = {
    income: 'cash',
    expenses: 'cash-expenses',
    withdrawals: 'cash-withdrawals',
    day: 'cash-day'
  };
  window.location.hash = routeMap[sectionId] || 'cash';
}

function getCashConfig(type) {
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

function getFilteredCashEntries(type) {
  const search = String(cashUiState.search[type] || '').trim().toLowerCase();
  return cashEntries[type].filter((entry) => {
    if (!search) return true;
    return [entry.date, entry.description, entry.person, entry.amount, entry.notes]
      .some((value) => String(value || '').toLowerCase().includes(search));
  });
}

function setCashSearch(type, value) {
  cashUiState.search[type] = value || '';
  cashUiState.page[type] = 1;
  renderCashSection();
}

function changeCashPage(type, delta) {
  const filtered = getFilteredCashEntries(type);
  const totalPages = Math.max(1, Math.ceil(filtered.length / 8));
  cashUiState.page[type] = Math.max(1, Math.min(totalPages, cashUiState.page[type] + delta));
  renderCashSection();
}

function renderCashTableSection(type) {
  const config = getCashConfig(type);
  const filtered = getFilteredCashEntries(type);
  const pageSize = 8;
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.max(1, Math.min(totalPages, cashUiState.page[type]));
  const rows = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const lastColumn = type === 'income' ? 'Cliente' : 'Nombre';

  return `
    <div class="cash-module-head">
      <div>
        <p class="cash-module-kicker">Caja</p>
        <h2>${cashEscapeHtml(config.title)}</h2>
      </div>
      <button class="btn btn-primary" type="button" onclick="showCashEntryModal('${type}')">${cashEscapeHtml(config.button)}</button>
    </div>

    <div class="cash-filter-card">
      <div class="search-box cash-search-box">
        <input type="text" value="${cashEscapeAttr(cashUiState.search[type])}" placeholder="Buscar..." oninput="setCashSearch('${type}', this.value)">
      </div>
    </div>

    <div class="cash-table-card">
      <div class="sales-lines-table-wrap">
        <table class="sales-lines-table">
          <thead>
            <tr>
              <th>Fecha</th>
              <th>Descripcion</th>
              <th>${lastColumn}</th>
              <th>Importe</th>
              ${type === 'withdrawals' ? '' : '<th>Observaciones</th>'}
            </tr>
          </thead>
          <tbody>
            ${rows.length === 0 ? `
              <tr><td colspan="${type === 'withdrawals' ? 4 : 5}" class="sales-empty-row">No hay movimientos para mostrar.</td></tr>
            ` : rows.map((entry) => `
              <tr>
                <td>${cashEscapeHtml(new Date(entry.date + 'T00:00:00').toLocaleDateString('es-AR'))}</td>
                <td>${cashEscapeHtml(entry.description)}</td>
                <td>${cashEscapeHtml(entry.person || '-')}</td>
                <td>${cashEscapeHtml(app.formatMoney(entry.amount || 0))}</td>
                ${type === 'withdrawals' ? '' : `<td>${cashEscapeHtml(entry.notes || '-')}</td>`}
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
      <div class="sales-pagination">
        <span>Pagina ${cashEscapeHtml(currentPage)} de ${cashEscapeHtml(totalPages)}</span>
        <div class="btn-group">
          <button class="btn btn-sm btn-secondary" type="button" onclick="changeCashPage('${type}', -1)" ${currentPage <= 1 ? 'disabled' : ''}>Anterior</button>
          <button class="btn btn-sm btn-secondary" type="button" onclick="changeCashPage('${type}', 1)" ${currentPage >= totalPages ? 'disabled' : ''}>Siguiente</button>
        </div>
      </div>
    </div>
  `;
}

function getCashModalHtml(type) {
  const config = getCashConfig(type);
  return `
    <div class="modal cash-modal">
      <div class="modal-header cash-modal-header">
        <div>
          <h3>${cashEscapeHtml(config.modalTitle)}</h3>
          <p class="cash-modal-subtitle">Carga manual de movimientos de caja con la misma estetica del resto del sistema.</p>
        </div>
        <button type="button" class="modal-close" onclick="closeCashEntryModal()">&times;</button>
      </div>
      <form id="cash-entry-form" onsubmit="event.preventDefault(); saveCashEntry()">
        <input type="hidden" id="cash-entry-type" value="${cashEscapeAttr(type)}">
        <div class="modal-body cash-modal-body">
          <div class="cash-form-grid">
            <div class="form-group">
              <label for="cash-date">Fecha</label>
              <input id="cash-date" type="date" value="${cashEscapeAttr(cashFormatDateInput(new Date()))}" required>
            </div>
            <div class="form-group">
              <label for="cash-description">${cashEscapeHtml(config.descriptionLabel)}</label>
              <input id="cash-description" type="text" required>
            </div>
            <div class="form-group">
              <label for="cash-person">${cashEscapeHtml(config.personLabel)}</label>
              ${type === 'income' ? `
                <select id="cash-person">
                  <option value="">Seleccionar cliente</option>
                  ${cashCustomers.map((customer) => '<option value="' + cashEscapeAttr(customer.name) + '">' + cashEscapeHtml(customer.name) + '</option>').join('')}
                </select>
              ` : `
                <input id="cash-person" type="text">
              `}
            </div>
            <div class="form-group">
              <label for="cash-amount">Importe</label>
              <input id="cash-amount" type="number" min="0" step="0.01" required>
            </div>
            ${type === 'withdrawals' ? '' : `
              <div class="form-group cash-field-span-2">
                <label for="cash-notes">${cashEscapeHtml(config.notesLabel)}</label>
                <textarea id="cash-notes" rows="4"></textarea>
              </div>
            `}
          </div>
        </div>
        <div class="modal-footer cash-modal-footer">
          <button class="btn btn-secondary" type="button" onclick="closeCashEntryModal()">Cancelar</button>
          <button class="btn btn-success" type="submit">Guardar</button>
        </div>
      </form>
    </div>
  `;
}

function showCashEntryModal(type) {
  cashUiState.modalType = type;
  document.getElementById('modal-container').innerHTML = `
    <div class="modal-overlay" onclick="if(event.target === this) closeCashEntryModal()">
      ${getCashModalHtml(type)}
    </div>
  `;
}

function closeCashEntryModal() {
  document.getElementById('modal-container').innerHTML = '';
}

function saveCashEntry() {
  const type = document.getElementById('cash-entry-type').value;
  const items = loadCashEntries(type);
  items.unshift({
    id: Date.now(),
    date: document.getElementById('cash-date').value,
    description: document.getElementById('cash-description').value.trim(),
    person: (document.getElementById('cash-person').value || '').trim(),
    amount: Number(document.getElementById('cash-amount').value || 0),
    notes: document.getElementById('cash-notes') ? document.getElementById('cash-notes').value.trim() : ''
  });
  saveCashEntries(type, items);
  cashEntries[type] = items;
  closeCashEntryModal();
  renderCashSection();
}

function setCashDayDate(value) {
  cashUiState.dayDate = value || cashFormatDateInput(new Date());
  renderCashSection();
}

function sumEntriesForDate(type, date) {
  return cashEntries[type]
    .filter((entry) => entry.date === date)
    .reduce((acc, entry) => acc + Number(entry.amount || 0), 0);
}

function sumSalesForDate(date, paymentMethod) {
  return cashSales
    .filter((sale) => {
      const saleDate = new Date(sale.created_at).toISOString().slice(0, 10);
      if (saleDate !== date) return false;
      if (!paymentMethod) return true;
      return String(sale.payment_method || 'cash') === paymentMethod;
    })
    .reduce((acc, sale) => acc + Number(sale.total || 0), 0);
}

function renderCashDetailRow(label, amount, onClickLabel) {
  return `
    <div class="cash-detail-row">
      <div>
        <strong>${cashEscapeHtml(label)}</strong>
      </div>
      <div class="cash-detail-actions">
        <span>${cashEscapeHtml(app.formatMoney(amount))}</span>
        <button class="btn btn-sm btn-secondary" type="button" onclick="${onClickLabel}">🔍</button>
      </div>
    </div>
  `;
}

function renderCashDaySection() {
  const date = cashUiState.dayDate || cashFormatDateInput(new Date());
  const salesCash = sumSalesForDate(date, 'cash');
  const incomeManual = sumEntriesForDate('income', date);
  const expensesManual = sumEntriesForDate('expenses', date);
  const withdrawalsManual = sumEntriesForDate('withdrawals', date);
  const digitalIncome = sumSalesForDate(date, 'card') + sumSalesForDate(date, 'transfer');
  const cashInitial = 0;
  const totalIncomeCash = salesCash + incomeManual;
  const totalExpensesCash = expensesManual + withdrawalsManual;
  const cashFinal = cashInitial + totalIncomeCash - totalExpensesCash;

  return `
    <div class="cash-module-head">
      <div>
        <p class="cash-module-kicker">Resumen diario</p>
        <h2>Caja del dia</h2>
      </div>
      <div class="form-group cash-day-picker">
        <label>Fecha</label>
        <input type="date" value="${cashEscapeAttr(date)}" onchange="setCashDayDate(this.value)">
      </div>
    </div>

    <div class="cash-summary-grid">
      <div class="cash-summary-card cash-summary-card--neutral"><span>Caja inicial</span><strong>${cashEscapeHtml(app.formatMoney(cashInitial))}</strong></div>
      <div class="cash-summary-card cash-summary-card--income"><span>Total ingresos efectivo</span><strong>${cashEscapeHtml(app.formatMoney(totalIncomeCash))}</strong></div>
      <div class="cash-summary-card cash-summary-card--expense"><span>Total egresos efectivo</span><strong>${cashEscapeHtml(app.formatMoney(totalExpensesCash))}</strong></div>
      <div class="cash-summary-card cash-summary-card--balance"><span>Saldo final en caja</span><strong>${cashEscapeHtml(app.formatMoney(cashFinal))}</strong></div>
    </div>

    <div class="cash-dashboard-grid">
      <div class="cash-dashboard-panel">
        <h3>Detalle de ingresos efectivo</h3>
        ${renderCashDetailRow('Ventas en efectivo', salesCash, "selectCashSection('day')")}
        ${renderCashDetailRow('Cobranzas en efectivo', 0, "selectCashSection('day')")}
        ${renderCashDetailRow('N/C proveedor', 0, "selectCashSection('day')")}
        ${renderCashDetailRow('Otros ingresos', incomeManual, "selectCashSection('income')")}
      </div>
      <div class="cash-dashboard-panel">
        <h3>Detalle de egresos efectivo</h3>
        ${renderCashDetailRow('Compras en efectivo', 0, "selectCashSection('day')")}
        ${renderCashDetailRow('Pagos a proveedores', 0, "selectCashSection('day')")}
        ${renderCashDetailRow('N/C cliente', 0, "selectCashSection('day')")}
        ${renderCashDetailRow('Otros gastos', expensesManual, "selectCashSection('expenses')")}
        ${renderCashDetailRow('Retiros', withdrawalsManual, "selectCashSection('withdrawals')")}
      </div>
      <div class="cash-dashboard-panel">
        <h3>Otros ingresos (no efectivo)</h3>
        ${renderCashDetailRow('Ingresos pago digital', digitalIncome, "selectCashSection('day')")}
        ${renderCashDetailRow('Ingresos cheque', 0, "selectCashSection('day')")}
        ${renderCashDetailRow('Otros ingresos', 0, "selectCashSection('day')")}
      </div>
      <div class="cash-dashboard-panel">
        <h3>Otras salidas (no efectivo)</h3>
        ${renderCashDetailRow('Salidas pago digital', 0, "selectCashSection('day')")}
        ${renderCashDetailRow('Salidas cheque', 0, "selectCashSection('day')")}
        ${renderCashDetailRow('Otros egresos', 0, "selectCashSection('day')")}
      </div>
    </div>
  `;
}
