let sellersCatalog = [];
let sellersCustomers = [];
let sellersSales = [];
let sellersPayments = [];

const SELLERS_STORAGE_KEY = 'milo_sellers_catalog';
const SELLERS_PAYMENTS_STORAGE_KEY = 'milo_sellers_payments';

const sellersUiState = {
  activeSection: 'planilla',
  search: '',
  page: 1,
  paymentsSearch: '',
  paymentsPage: 1,
  commissionSellerId: '',
  commissionSelection: {},
  reportSellerId: '',
  reportFrom: '',
  reportTo: '',
  reportGenerated: false
};

function sellerEscapeHtml(value) {
  return app.escapeHtml(value ?? '');
}

function sellerEscapeAttr(value) {
  return app.escapeAttr(value ?? '');
}

function sellerNormalizeKey(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'seller';
}

function sellerBuildOptions(items, selectedValue, placeholder = 'Seleccionar') {
  const current = String(selectedValue || '');
  let html = '<option value="">' + sellerEscapeHtml(placeholder) + '</option>';
  items.forEach((item) => {
    const value = typeof item === 'object' ? item.value : item;
    const label = typeof item === 'object' ? item.label : item;
    html += '<option value="' + sellerEscapeAttr(value) + '"' + (current === String(value) ? ' selected' : '') + '>' + sellerEscapeHtml(label) + '</option>';
  });
  return html;
}

function loadSellerStore() {
  try {
    return JSON.parse(localStorage.getItem(SELLERS_STORAGE_KEY) || '[]');
  } catch (error) {
    return [];
  }
}

function saveSellerStore(store) {
  localStorage.setItem(SELLERS_STORAGE_KEY, JSON.stringify(store));
}

function loadSellerPaymentsStore() {
  try {
    return JSON.parse(localStorage.getItem(SELLERS_PAYMENTS_STORAGE_KEY) || '[]');
  } catch (error) {
    return [];
  }
}

function saveSellerPaymentsStore(store) {
  localStorage.setItem(SELLERS_PAYMENTS_STORAGE_KEY, JSON.stringify(store));
}

function getSellerNameForSale(sale) {
  const customer = sellersCustomers.find((item) => String(item.id) === String(sale.customer_id));
  return String(customer && customer.seller ? customer.seller : (sale.user_name || '')).trim();
}

function getSellerIdForSale(sale) {
  const sellerName = getSellerNameForSale(sale);
  return sellerName ? 'seller-' + sellerNormalizeKey(sellerName) : '';
}

function buildSellerCatalog() {
  const stored = loadSellerStore();
  const storedById = new Map(stored.map((item) => [item.id, item]));
  const names = new Set();

  sellersCustomers.forEach((customer) => {
    if (customer.seller) names.add(String(customer.seller).trim());
  });
  sellersSales.forEach((sale) => {
    const sellerName = getSellerNameForSale(sale);
    if (sellerName) names.add(sellerName);
  });

  const derived = [...names].map((name, index) => {
    const id = 'seller-' + sellerNormalizeKey(name);
    const storedData = storedById.get(id) || {};
    return {
      id,
      code: storedData.code || 'VEN-' + String(index + 1).padStart(3, '0'),
      name: storedData.name || name,
      address: storedData.address || '',
      phone: storedData.phone || '',
      cell: storedData.cell || '',
      commission_percent: Number(storedData.commission_percent ?? 5),
      archived: !!storedData.archived,
      source: 'derived'
    };
  });

  const manual = stored
    .filter((item) => !item.archived && !derived.some((seller) => seller.id === item.id))
    .map((item, index) => ({
      id: item.id,
      code: item.code || 'VEN-M' + String(index + 1).padStart(3, '0'),
      name: item.name || 'Vendedor',
      address: item.address || '',
      phone: item.phone || '',
      cell: item.cell || '',
      commission_percent: Number(item.commission_percent ?? 5),
      archived: false,
      source: 'manual'
    }));

  return [...derived.filter((item) => !item.archived), ...manual].sort((a, b) => a.name.localeCompare(b.name));
}

function getSellerById(id) {
  return sellersCatalog.find((item) => item.id === id) || null;
}

async function renderSellers(sectionId = 'planilla') {
  const content = document.getElementById('page-content');
  content.innerHTML = '<div class="loading">Cargando...</div>';
  sellersUiState.activeSection = sectionId;

  try {
    const [customers, sales] = await Promise.all([
      api.customers.getAll({}),
      api.sales.getAll({}).catch(() => [])
    ]);

    sellersCustomers = customers;
    sellersSales = Array.isArray(sales) ? sales : [];
    sellersPayments = loadSellerPaymentsStore();
    sellersCatalog = buildSellerCatalog();

    if (!sellersUiState.commissionSellerId && sellersCatalog[0]) {
      sellersUiState.commissionSellerId = sellersCatalog[0].id;
    }
    if (!sellersUiState.reportSellerId && sellersCatalog[0]) {
      sellersUiState.reportSellerId = sellersCatalog[0].id;
    }

    content.innerHTML = renderSellersShell();
    renderSellersSection();
  } catch (error) {
    content.innerHTML = '<div class="alert alert-warning">Error: ' + sellerEscapeHtml(error.message) + '</div>';
  }
}

function renderSellersShell() {
  return `
    <section class="sellers-admin-content">
      <div class="sellers-admin-panel card" id="sellers-admin-panel"></div>
    </section>
  `;
}

function renderSellersSection() {
  const panel = document.getElementById('sellers-admin-panel');
  if (!panel) return;

  if (sellersUiState.activeSection === 'planilla') {
    panel.innerHTML = renderSellersPlanilla();
    return;
  }

  if (sellersUiState.activeSection === 'commissions') {
    panel.innerHTML = renderSellersCommissions();
    return;
  }

  if (sellersUiState.activeSection === 'payments') {
    panel.innerHTML = renderSellersPayments();
    return;
  }

  panel.innerHTML = renderSellersSalesReport();
}

function selectSellerSection(sectionId) {
  const routeMap = {
    planilla: 'sellers',
    commissions: 'sellers-commissions',
    payments: 'sellers-payments',
    'sales-report': 'sellers-sales-report'
  };
  window.location.hash = routeMap[sectionId] || 'sellers';
}

function getFilteredSellers() {
  const search = String(sellersUiState.search || '').trim().toLowerCase();
  return sellersCatalog.filter((seller) => {
    if (!search) return true;
    return [seller.code, seller.name, seller.address, seller.phone, seller.cell]
      .some((value) => String(value || '').toLowerCase().includes(search));
  });
}

function setSellerSearch(value) {
  sellersUiState.search = value || '';
  sellersUiState.page = 1;
  renderSellersSection();
}

function changeSellerPage(delta) {
  const filtered = getFilteredSellers();
  const totalPages = Math.max(1, Math.ceil(filtered.length / 8));
  sellersUiState.page = Math.max(1, Math.min(totalPages, sellersUiState.page + delta));
  renderSellersSection();
}

function renderSellersPlanilla() {
  const filtered = getFilteredSellers();
  const pageSize = 8;
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.max(1, Math.min(totalPages, sellersUiState.page));
  const rows = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  return `
    <div class="sellers-module-head">
      <div>
        <p class="sellers-module-kicker">Planilla</p>
        <h2>Gestion de Vendedores</h2>
      </div>
      <button class="btn btn-primary" type="button" onclick="showSellerModal()">+ Nuevo Vendedor</button>
    </div>

    <div class="sellers-filter-card">
      <div class="search-box sellers-search-box">
        <input type="text" value="${sellerEscapeAttr(sellersUiState.search)}" placeholder="Buscar vendedor" oninput="setSellerSearch(this.value)">
      </div>
    </div>

    <div class="sellers-table-card">
      <div class="sales-lines-table-wrap">
        <table class="sales-lines-table">
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
            ${rows.length === 0 ? `
              <tr><td colspan="7" class="sales-empty-row">No hay vendedores para mostrar.</td></tr>
            ` : rows.map((seller) => `
              <tr>
                <td>${sellerEscapeHtml(seller.code)}</td>
                <td>${sellerEscapeHtml(seller.name)}</td>
                <td>${sellerEscapeHtml(seller.address || '-')}</td>
                <td>${sellerEscapeHtml(seller.phone || '-')}</td>
                <td>${sellerEscapeHtml(seller.cell || '-')}</td>
                <td>${sellerEscapeHtml(Number(seller.commission_percent || 0).toFixed(2))}%</td>
                <td>
                  <div class="btn-group">
                    <button class="btn btn-sm btn-secondary" type="button" onclick="showSellerModal('${seller.id}')" title="Editar">✎</button>
                    <button class="btn btn-sm btn-danger" type="button" onclick="deleteSeller('${seller.id}')" title="Eliminar">🗑</button>
                  </div>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
      <div class="sales-pagination">
        <span>Pagina ${sellerEscapeHtml(currentPage)} de ${sellerEscapeHtml(totalPages)}</span>
        <div class="btn-group">
          <button class="btn btn-sm btn-secondary" type="button" onclick="changeSellerPage(-1)" ${currentPage <= 1 ? 'disabled' : ''}>Anterior</button>
          <button class="btn btn-sm btn-secondary" type="button" onclick="changeSellerPage(1)" ${currentPage >= totalPages ? 'disabled' : ''}>Siguiente</button>
        </div>
      </div>
    </div>
  `;
}

function getSellerModalHtml(seller) {
  const isEditing = !!seller;
  return `
    <div class="modal seller-modal">
      <div class="modal-header seller-modal-header">
        <div>
          <h3>${isEditing ? 'Editar Vendedor' : 'Nuevo Vendedor'}</h3>
          <p class="seller-modal-subtitle">Completa los datos administrativos y comerciales del vendedor.</p>
        </div>
        <button type="button" class="modal-close" onclick="closeSellerModal()">&times;</button>
      </div>
      <form id="seller-form" onsubmit="event.preventDefault(); saveSeller()">
        <input type="hidden" id="seller-id" value="${sellerEscapeAttr(seller && seller.id)}">
        <div class="modal-body seller-modal-body">
          <div class="seller-form-grid">
            <div class="form-group">
              <label for="seller-code">Codigo</label>
              <input id="seller-code" type="text" value="${sellerEscapeAttr(seller && seller.code)}" placeholder="VEN-001" required>
            </div>
            <div class="form-group">
              <label for="seller-name">Nombre</label>
              <input id="seller-name" type="text" value="${sellerEscapeAttr(seller && seller.name)}" required>
            </div>
            <div class="form-group seller-field-span-2">
              <label for="seller-address">Direccion</label>
              <input id="seller-address" type="text" value="${sellerEscapeAttr(seller && seller.address)}">
            </div>
            <div class="form-group">
              <label for="seller-phone">Telefono</label>
              <input id="seller-phone" type="text" value="${sellerEscapeAttr(seller && seller.phone)}">
            </div>
            <div class="form-group">
              <label for="seller-cell">Celular</label>
              <input id="seller-cell" type="text" value="${sellerEscapeAttr(seller && seller.cell)}">
            </div>
            <div class="form-group">
              <label for="seller-commission">%</label>
              <input id="seller-commission" type="number" min="0" step="0.01" value="${sellerEscapeAttr(seller ? Number(seller.commission_percent || 0).toFixed(2) : '5.00')}">
            </div>
          </div>
        </div>
        <div class="modal-footer seller-modal-footer">
          <button class="btn btn-secondary" type="button" onclick="closeSellerModal()">Cancelar</button>
          <button class="btn btn-success" type="submit">Guardar</button>
        </div>
      </form>
    </div>
  `;
}

function showSellerModal(sellerId) {
  const modalContainer = document.getElementById('modal-container');
  const seller = sellerId ? getSellerById(sellerId) : null;
  modalContainer.innerHTML = `
    <div class="modal-overlay" onclick="if(event.target === this) closeSellerModal()">
      ${getSellerModalHtml(seller)}
    </div>
  `;
}

function closeSellerModal() {
  document.getElementById('modal-container').innerHTML = '';
}

function saveSeller() {
  const store = loadSellerStore();
  const id = document.getElementById('seller-id').value || ('seller-' + Date.now());
  const record = {
    id,
    code: document.getElementById('seller-code').value.trim(),
    name: document.getElementById('seller-name').value.trim(),
    address: document.getElementById('seller-address').value.trim(),
    phone: document.getElementById('seller-phone').value.trim(),
    cell: document.getElementById('seller-cell').value.trim(),
    commission_percent: Number(document.getElementById('seller-commission').value || 0),
    archived: false
  };

  const index = store.findIndex((item) => item.id === id);
  if (index >= 0) store[index] = { ...store[index], ...record };
  else store.push(record);

  saveSellerStore(store);
  sellersCatalog = buildSellerCatalog();
  closeSellerModal();
  renderSellersSection();
}

function deleteSeller(sellerId) {
  const seller = getSellerById(sellerId);
  if (!seller || !confirm('Seguro que deseas eliminar este vendedor?')) return;

  const store = loadSellerStore();
  const index = store.findIndex((item) => item.id === sellerId);
  if (index >= 0) {
    store[index] = { ...store[index], archived: true };
  } else {
    store.push({ id: sellerId, name: seller.name, archived: true });
  }
  saveSellerStore(store);
  sellersCatalog = buildSellerCatalog();
  renderSellersSection();
}

function getCommissionRows() {
  const seller = getSellerById(sellersUiState.commissionSellerId);
  if (!seller) return [];

  return sellersSales
    .filter((sale) => getSellerIdForSale(sale) === seller.id)
    .map((sale) => {
      const customer = sellersCustomers.find((item) => String(item.id) === String(sale.customer_id));
      const total = Number(sale.total || 0);
      const commissionPercent = Number(seller.commission_percent || 0);
      return {
        id: String(sale.id),
        sellerName: seller.name,
        date: sale.created_at,
        receiptNumber: String(sale.point_of_sale || '001') + '-' + String(sale.receipt_number || sale.id).padStart(8, '0'),
        customerName: customer ? customer.name : (sale.customer_name || 'Consumidor final'),
        total,
        balance: total,
        commissionPercent,
        commissionAmount: total * commissionPercent / 100
      };
    });
}

function setCommissionSeller(value) {
  sellersUiState.commissionSellerId = value;
}

function calculateSellerCommissions() {
  const rows = getCommissionRows();
  const nextSelection = {};
  rows.forEach((row) => {
    nextSelection[row.id] = sellersUiState.commissionSelection[row.id] !== undefined ? sellersUiState.commissionSelection[row.id] : true;
  });
  sellersUiState.commissionSelection = nextSelection;
  renderSellersSection();
}

function toggleCommissionRow(rowId) {
  sellersUiState.commissionSelection[rowId] = !sellersUiState.commissionSelection[rowId];
  renderSellersSection();
}

function getSelectedCommissionTotals(rows) {
  return rows.reduce((acc, row) => {
    if (sellersUiState.commissionSelection[row.id]) {
      acc.totalSales += row.total;
      acc.totalCommissions += row.commissionAmount;
    }
    return acc;
  }, { totalSales: 0, totalCommissions: 0 });
}

function paySellerCommissions() {
  const seller = getSellerById(sellersUiState.commissionSellerId);
  const rows = getCommissionRows().filter((row) => sellersUiState.commissionSelection[row.id]);
  if (!seller || rows.length === 0) {
    alert('Selecciona al menos una factura para registrar el pago.');
    return;
  }

  const totals = getSelectedCommissionTotals(rows);
  const payments = loadSellerPaymentsStore();
  payments.unshift({
    id: Date.now(),
    payment_date: new Date().toISOString(),
    seller_id: seller.id,
    seller_name: seller.name,
    total_paid: Number(totals.totalCommissions.toFixed(2)),
    total_sales: Number(totals.totalSales.toFixed(2)),
    sale_ids: rows.map((row) => row.id)
  });
  saveSellerPaymentsStore(payments);
  sellersPayments = payments;
  sellersUiState.commissionSelection = {};
  alert('Pago de comisiones registrado en la UI.');
  renderSellersSection();
}

function renderSellersCommissions() {
  const seller = getSellerById(sellersUiState.commissionSellerId);
  const rows = getCommissionRows();
  const totals = getSelectedCommissionTotals(rows);

  return `
    <div class="sellers-module-head">
      <div>
        <p class="sellers-module-kicker">Comisiones</p>
        <h2>Liquidacion de Comisiones por Vendedor</h2>
      </div>
    </div>

    <div class="sellers-filter-card">
      <div class="sellers-filter-grid">
        <div class="form-group">
          <label>Seleccione un vendedor</label>
          <select onchange="setCommissionSeller(this.value)">
            ${sellerBuildOptions(sellersCatalog.map((item) => ({ value: item.id, label: item.name })), sellersUiState.commissionSellerId, 'Seleccionar vendedor')}
          </select>
        </div>
        <div class="sellers-actions-inline">
          <button class="btn btn-primary" type="button" onclick="calculateSellerCommissions()">Calcular</button>
        </div>
      </div>
      <div class="sellers-info-banner">
        <strong>% comision:</strong> ${sellerEscapeHtml(seller ? Number(seller.commission_percent || 0).toFixed(2) : '0.00')}%
        <span>Calculada sobre el TOTAL</span>
      </div>
    </div>

    <div class="sellers-table-card">
      <div class="sales-lines-table-wrap">
        <table class="sales-lines-table">
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
            ${rows.length === 0 ? `
              <tr><td colspan="9" class="sales-empty-row">No hay ventas para calcular comisiones.</td></tr>
            ` : rows.map((row) => `
              <tr>
                <td><input type="checkbox" ${sellersUiState.commissionSelection[row.id] ? 'checked' : ''} onchange="toggleCommissionRow('${row.id}')"></td>
                <td>${sellerEscapeHtml(row.sellerName)}</td>
                <td>${sellerEscapeHtml(new Date(row.date).toLocaleDateString('es-AR'))}</td>
                <td>${sellerEscapeHtml(row.receiptNumber)}</td>
                <td>${sellerEscapeHtml(row.customerName)}</td>
                <td>${sellerEscapeHtml(app.formatMoney(row.total))}</td>
                <td>${sellerEscapeHtml(app.formatMoney(row.balance))}</td>
                <td>${sellerEscapeHtml(row.commissionPercent.toFixed(2))}%</td>
                <td>${sellerEscapeHtml(app.formatMoney(row.commissionAmount))}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>

      <div class="sellers-totals-panel">
        <div class="sales-summary-row"><span>Total ventas</span><strong>${sellerEscapeHtml(app.formatMoney(totals.totalSales))}</strong></div>
        <div class="sales-summary-total"><span>Total comisiones</span><strong>${sellerEscapeHtml(app.formatMoney(totals.totalCommissions))}</strong></div>
      </div>

      <div class="sellers-actions-row">
        <button class="btn btn-success" type="button" onclick="paySellerCommissions()">Pagar</button>
        <button class="btn btn-secondary" type="button" onclick="selectSellerSection('planilla')">Salir</button>
      </div>

      <div class="sellers-help-text">
        F3 cambia porcentaje de comision de una factura. Enter agrega o quita la factura del total. No se calculara la comision de los renglones amarillos.
      </div>
    </div>
  `;
}

function setSellerPaymentsSearch(value) {
  sellersUiState.paymentsSearch = value || '';
  sellersUiState.paymentsPage = 1;
  renderSellersSection();
}

function changeSellerPaymentsPage(delta) {
  const filtered = getFilteredSellerPayments();
  const totalPages = Math.max(1, Math.ceil(filtered.length / 8));
  sellersUiState.paymentsPage = Math.max(1, Math.min(totalPages, sellersUiState.paymentsPage + delta));
  renderSellersSection();
}

function getFilteredSellerPayments() {
  const search = String(sellersUiState.paymentsSearch || '').trim().toLowerCase();
  return sellersPayments.filter((payment) => {
    if (!search) return true;
    return [payment.id, payment.seller_name, payment.total_paid]
      .some((value) => String(value || '').toLowerCase().includes(search));
  });
}

function renderSellersPayments() {
  const filtered = getFilteredSellerPayments();
  const pageSize = 8;
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.max(1, Math.min(totalPages, sellersUiState.paymentsPage));
  const rows = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  return `
    <div class="sellers-module-head">
      <div>
        <p class="sellers-module-kicker">Pagos</p>
        <h2>Consulta de Pagos</h2>
      </div>
      <div class="search-box sellers-search-box">
        <input type="text" value="${sellerEscapeAttr(sellersUiState.paymentsSearch)}" placeholder="Buscar pago..." oninput="setSellerPaymentsSearch(this.value)">
      </div>
    </div>

    <div class="sellers-table-card">
      <div class="sales-lines-table-wrap">
        <table class="sales-lines-table">
          <thead>
            <tr>
              <th>ID Pago</th>
              <th>Fecha de Pago</th>
              <th>Vendedor</th>
              <th>Total Pagado</th>
            </tr>
          </thead>
          <tbody>
            ${rows.length === 0 ? `
              <tr><td colspan="4" class="sales-empty-row">No hay pagos registrados.</td></tr>
            ` : rows.map((payment) => `
              <tr>
                <td>${sellerEscapeHtml(payment.id)}</td>
                <td>${sellerEscapeHtml(new Date(payment.payment_date).toLocaleDateString('es-AR'))}</td>
                <td>${sellerEscapeHtml(payment.seller_name)}</td>
                <td>${sellerEscapeHtml(app.formatMoney(payment.total_paid || 0))}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
      <div class="sales-pagination">
        <span>Pagina ${sellerEscapeHtml(currentPage)} de ${sellerEscapeHtml(totalPages)}</span>
        <div class="btn-group">
          <button class="btn btn-sm btn-secondary" type="button" onclick="changeSellerPaymentsPage(-1)" ${currentPage <= 1 ? 'disabled' : ''}>Anterior</button>
          <button class="btn btn-sm btn-secondary" type="button" onclick="changeSellerPaymentsPage(1)" ${currentPage >= totalPages ? 'disabled' : ''}>Siguiente</button>
        </div>
      </div>
    </div>
  `;
}

function setSellerReportField(field, value) {
  sellersUiState[field] = value || '';
}

function generateSellerSalesReport() {
  sellersUiState.reportGenerated = true;
  renderSellersSection();
}

function getSellerReportRows() {
  const seller = getSellerById(sellersUiState.reportSellerId);
  if (!seller) return [];
  const from = sellersUiState.reportFrom ? new Date(sellersUiState.reportFrom + 'T00:00:00') : null;
  const to = sellersUiState.reportTo ? new Date(sellersUiState.reportTo + 'T23:59:59') : null;

  return sellersSales.filter((sale) => {
    if (getSellerIdForSale(sale) !== seller.id) return false;
    const saleDate = new Date(sale.created_at);
    if (from && saleDate < from) return false;
    if (to && saleDate > to) return false;
    return true;
  });
}

function renderSellersSalesReport() {
  const rows = sellersUiState.reportGenerated ? getSellerReportRows() : [];
  const total = rows.reduce((acc, sale) => acc + Number(sale.total || 0), 0);

  return `
    <div class="sellers-module-head">
      <div>
        <p class="sellers-module-kicker">Reporte</p>
        <h2>Reporte de Ventas por Vendedor</h2>
      </div>
    </div>

    <div class="sellers-filter-card">
      <div class="sellers-filter-grid">
        <div class="form-group">
          <label>Vendedor</label>
          <select onchange="setSellerReportField('reportSellerId', this.value)">
            ${sellerBuildOptions(sellersCatalog.map((item) => ({ value: item.id, label: item.name })), sellersUiState.reportSellerId, 'Seleccionar vendedor')}
          </select>
        </div>
        <div class="form-group">
          <label>Desde</label>
          <input type="date" value="${sellerEscapeAttr(sellersUiState.reportFrom)}" onchange="setSellerReportField('reportFrom', this.value)">
        </div>
        <div class="form-group">
          <label>Hasta</label>
          <input type="date" value="${sellerEscapeAttr(sellersUiState.reportTo)}" onchange="setSellerReportField('reportTo', this.value)">
        </div>
        <div class="sellers-actions-inline">
          <button class="btn btn-primary" type="button" onclick="generateSellerSalesReport()">Generar reporte</button>
        </div>
      </div>
    </div>

    ${sellersUiState.reportGenerated ? `
      <div class="sellers-table-card">
        <div class="sellers-report-summary">
          <span><strong>${sellerEscapeHtml(rows.length)}</strong> ventas</span>
          <span><strong>${sellerEscapeHtml(app.formatMoney(total))}</strong> total vendido</span>
        </div>
        <div class="sales-lines-table-wrap">
          <table class="sales-lines-table">
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Numero</th>
                <th>Cliente</th>
                <th>Total</th>
              </tr>
            </thead>
            <tbody>
              ${rows.length === 0 ? `
                <tr><td colspan="4" class="sales-empty-row">No hay ventas para el filtro seleccionado.</td></tr>
              ` : rows.map((sale) => `
                <tr>
                  <td>${sellerEscapeHtml(new Date(sale.created_at).toLocaleDateString('es-AR'))}</td>
                  <td>${sellerEscapeHtml(String(sale.point_of_sale || '001') + '-' + String(sale.receipt_number || sale.id).padStart(8, '0'))}</td>
                  <td>${sellerEscapeHtml(sale.customer_name || 'Consumidor final')}</td>
                  <td>${sellerEscapeHtml(app.formatMoney(sale.total || 0))}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    ` : ''}
  `;
}
