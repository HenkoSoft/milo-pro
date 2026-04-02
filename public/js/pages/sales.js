let cart = [];
let productsForSale = [];
let customersForSale = [];
let salesHistoryData = [];
let salesBusinessSettings = { business_name: 'Milo Pro' };
let nextInvoiceNumber = 1;
let printInProgress = false;
let lastSaleData = null;

const SALES_RECEIPT_TYPES = ['A', 'B', 'C', 'X', 'PRESUPUESTO', 'TICKET'];
const SALES_IVA_CONDITIONS = ['Consumidor Final', 'Responsable Inscripto', 'Monotributista', 'Exento'];
const SALES_PRICE_LISTS = ['Lista 1', 'Lista 2', 'Lista 3', 'Lista 4'];
const SALES_MODULES = [
  { id: 'invoices', label: 'Facturas' },
  { id: 'delivery-notes', label: 'Remitos' },
  { id: 'quotes', label: 'Presupuestos' },
  { id: 'orders', label: 'Pedidos' },
  { id: 'credit-notes', label: 'Notas de Credito' },
  { id: 'collections', label: 'Cobranzas' },
  { id: 'query-invoices', label: 'Consultar Facturas' },
  { id: 'query-delivery-notes', label: 'Consultar Remitos' },
  { id: 'query-credit-notes', label: 'Consultar Notas de Credito' },
  { id: 'query-quotes', label: 'Consultar Presupuestos' },
  { id: 'query-orders', label: 'Consultar Pedidos' }
];

function createDefaultSalesDraft() {
  return {
    receiptType: 'C',
    pointOfSale: '001',
    date: salesFormatDateInput(new Date()),
    priceList: 'Lista 1',
    seller: salesGetCurrentSellerName(),
    customerId: '',
    taxId: '',
    ivaCondition: 'Consumidor Final',
    address: '',
    observations: '',
    oc: '',
    remito: ''
  };
}

const salesUiState = {
  activeSection: 'invoices',
  querySearch: '',
  queryPage: 1,
  collectionsSearch: '',
  collectionsPage: 1,
  collectionsTab: 'customers',
  selectedCustomerId: null,
  invoiceDraft: createDefaultSalesDraft()
};

function salesEscapeHtml(value) {
  return app.escapeHtml(value ?? '');
}

function salesEscapeAttr(value) {
  return app.escapeAttr(value ?? '');
}

function salesBuildOptions(options, selectedValue, placeholder) {
  const current = String(selectedValue ?? '');
  let html = placeholder ? '<option value="">' + salesEscapeHtml(placeholder) + '</option>' : '';
  options.forEach((option) => {
    const value = typeof option === 'object' ? option.value : option;
    const label = typeof option === 'object' ? option.label : option;
    html += '<option value="' + salesEscapeAttr(value) + '"' + (current === String(value) ? ' selected' : '') + '>' + salesEscapeHtml(label) + '</option>';
  });
  return html;
}

function salesFormatInvoiceNumber(value) {
  return String(value || 1).padStart(8, '0');
}

function salesFormatDate(date = new Date()) {
  return new Intl.DateTimeFormat('es-AR').format(date);
}

function salesFormatDateInput(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function salesFormatDateTime(value, mode = 'date') {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  if (mode === 'time') {
    return new Intl.DateTimeFormat('es-AR', { hour: '2-digit', minute: '2-digit' }).format(date);
  }
  return new Intl.DateTimeFormat('es-AR').format(date);
}

function salesGetSelectedReceiptType() {
  const select = document.getElementById('sale-receipt-type');
  return select ? select.value : (salesUiState.invoiceDraft.receiptType || 'C');
}

function salesGetSelectedPointOfSale() {
  const input = document.getElementById('sale-point-of-sale');
  const source = input ? input.value : (salesUiState.invoiceDraft.pointOfSale || '001');
  const digits = String(source).replace(/\D/g, '');
  return (digits || '001').padStart(3, '0').slice(-3);
}

function salesGetCurrentSellerName() {
  if (typeof currentUser !== 'undefined' && currentUser && currentUser.name) return currentUser.name;
  if (window.auth && window.auth.currentUser && window.auth.currentUser.name) return window.auth.currentUser.name;
  return 'Caja principal';
}

function getSalesSellerOptions() {
  const customerSellers = customersForSale.map((customer) => customer.seller).filter(Boolean);
  return [...new Set([salesGetCurrentSellerName(), ...customerSellers])];
}

function getSelectedCustomer() {
  const customerSelect = document.getElementById('sale-customer');
  if (!customerSelect || !customerSelect.value) return null;
  return customersForSale.find((customer) => String(customer.id) === customerSelect.value) || null;
}

function getDraftSelectedCustomer() {
  const customerId = String(salesUiState.invoiceDraft.customerId || '');
  if (!customerId) return null;
  return customersForSale.find((customer) => String(customer.id) === customerId) || null;
}

function normalizeSaleCustomerIvaCondition(value) {
  const raw = String(value || '').trim();
  if (!raw) return 'Consumidor Final';
  const normalized = raw.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  if (normalized === 'consumidor-final') return 'Consumidor Final';
  if (normalized === 'responsable-inscripto') return 'Responsable Inscripto';
  if (normalized === 'monotributista' || normalized === 'monotributo') return 'Monotributista';
  if (normalized === 'exento') return 'Exento';
  return raw;
}

function buildSaleCustomerAddress(customer) {
  if (!customer) return '';
  return [customer.address, customer.city, customer.province, customer.country].map((part) => String(part || '').trim()).filter(Boolean).join(', ');
}

function getProductById(productId) {
  const targetId = String(productId);
  return productsForSale.find((product) => String(product.id) === targetId) || null;
}

function getEffectiveUnitPrice(item) {
  const price = Number(item.price) || 0;
  const discount = Math.max(0, Math.min(100, Number(item.discount) || 0));
  return Math.max(0, price * (1 - discount / 100));
}

function getCartItemSubtotal(item) {
  return getEffectiveUnitPrice(item) * item.quantity;
}

function calculateCartTotals() {
  let neto = 0;
  let descuento = 0;
  cart.forEach((item) => {
    const lineBase = (Number(item.price) || 0) * item.quantity;
    const lineTotal = getCartItemSubtotal(item);
    neto += lineBase;
    descuento += lineBase - lineTotal;
  });
  const subtotal = neto - descuento;
  const iva = 0;
  const total = subtotal + iva;
  return { neto, descuento, subtotal, iva, total };
}

function buildSalesNotes() {
  const obs = (document.getElementById('sale-observations') || {}).value || '';
  const oc = (document.getElementById('sale-oc') || {}).value || '';
  const rem = (document.getElementById('sale-remito') || {}).value || '';
  const notes = [];
  if (obs.trim()) notes.push(`Obs: ${obs.trim()}`);
  if (oc.trim()) notes.push(`O.C.: ${oc.trim()}`);
  if (rem.trim()) notes.push(`Rem.: ${rem.trim()}`);
  return notes.join(' | ');
}

function salesGetModuleTitle(sectionId) {
  const found = SALES_MODULES.find((item) => item.id === sectionId);
  return found ? found.label : 'Ventas';
}

function captureSalesInvoiceDraft() {
  const fields = {
    receiptType: document.getElementById('sale-receipt-type'),
    pointOfSale: document.getElementById('sale-point-of-sale'),
    date: document.getElementById('sale-date'),
    priceList: document.getElementById('sale-price-list'),
    seller: document.getElementById('sale-seller'),
    customerId: document.getElementById('sale-customer'),
    taxId: document.getElementById('sale-customer-tax-id'),
    ivaCondition: document.getElementById('sale-customer-iva-condition'),
    address: document.getElementById('sale-customer-address'),
    observations: document.getElementById('sale-observations'),
    oc: document.getElementById('sale-oc'),
    remito: document.getElementById('sale-remito')
  };
  Object.entries(fields).forEach(([key, element]) => {
    if (element) salesUiState.invoiceDraft[key] = element.value;
  });
}

function renderSalesShell() {
  return `
      <section class="sales-admin-content">
        <div class="sales-admin-panel card" id="sales-admin-panel"></div>
      </section>
  `;
}

function renderSalesSection() {
  const panel = document.getElementById('sales-admin-panel');
  if (!panel) return;

  if (salesUiState.activeSection === 'invoices') {
    panel.innerHTML = renderSalesInvoiceModule();
    setupSalesInvoiceInteractions();
    renderCart();
    handleSaleCustomerChange();
    syncSalesDatePreview();
    refreshSaleDocumentPreview();
    filterPosProducts();
    return;
  }

  if (salesUiState.activeSection === 'collections') {
    panel.innerHTML = renderSalesCollectionsModule();
    return;
  }

  if (String(salesUiState.activeSection).startsWith('query-')) {
    panel.innerHTML = renderSalesQueryModule(salesUiState.activeSection);
    return;
  }

  if (salesUiState.activeSection === 'delivery-notes') {
    panel.innerHTML = renderSalesDocumentStub({ kicker: 'Remitos', title: 'Remitos', subtitle: 'Misma logica visual que facturacion para entregar mercaderia con datos claros del cliente.', numberLabel: 'Remito Nro', receiptLabel: 'P.Venta', documentButtonLabel: 'Aceptar', exitButtonLabel: 'Salir', checkboxLabel: 'Descontar stock', searchPlaceholder: 'Codigo articulo (F5)', totalLabel: 'Total remito' });
    return;
  }

  if (salesUiState.activeSection === 'quotes') {
    panel.innerHTML = renderSalesDocumentStub({ kicker: 'Presupuestos', title: 'Presupuestos', subtitle: 'Preparado para carga rapida de propuestas comerciales con los mismos bloques del modulo principal.', numberLabel: 'Presupuesto Nro', receiptLabel: 'P.Venta', documentButtonLabel: 'Aceptar', exitButtonLabel: 'Salir', searchPlaceholder: 'Codigo articulo (F5)' });
    return;
  }

  if (salesUiState.activeSection === 'orders') {
    panel.innerHTML = renderSalesDocumentStub({ kicker: 'Pedidos', title: 'Pedidos', subtitle: 'Estructura alineada con remitos y presupuestos para simplificar entrenamiento y carga.', numberLabel: 'Pedido Nro', receiptLabel: 'Lista', documentButtonLabel: 'Aceptar', exitButtonLabel: 'Salir', showTotals: true, searchPlaceholder: 'Codigo articulo (F5)' });
    return;
  }

  if (salesUiState.activeSection === 'credit-notes') {
    panel.innerHTML = renderSalesDocumentStub({ kicker: 'Notas de Credito', title: 'Notas de Credito', subtitle: 'Pantalla visual consistente con facturacion para gestionar devoluciones y ajustes comerciales.', numberLabel: 'Nro Nota de Credito', receiptLabel: 'P.Venta', documentButtonLabel: 'Guardar nota de credito', extraFieldLabel: 'Factura asociada', extraFieldButton: 'Buscar', checkboxLabel: 'Devolver stock', showTotals: true, searchPlaceholder: 'Codigo articulo (F5)' });
  }
}

async function renderSales(sectionId = 'invoices') {
  const content = document.getElementById('page-content');
  content.innerHTML = '<div class="loading">Cargando...</div>';
  cart = [];
  lastSaleData = null;
  salesUiState.activeSection = sectionId;
  salesUiState.queryPage = 1;
  salesUiState.collectionsPage = 1;
  salesUiState.collectionsTab = 'customers';
  salesUiState.selectedCustomerId = null;
  salesUiState.invoiceDraft = createDefaultSalesDraft();

  try {
    const [products, customers, settings, salesHistory] = await Promise.all([
      api.products.getAll({}),
      api.customers.getAll({}),
      api.settings.get(),
      api.sales.getAll({}).catch(() => [])
    ]);
    productsForSale = products;
    customersForSale = customers;
    salesHistoryData = Array.isArray(salesHistory) ? salesHistory : [];
    salesBusinessSettings = settings || salesBusinessSettings;
    nextInvoiceNumber = 1;
    content.innerHTML = renderSalesShell();
    renderSalesSection();
  } catch (e) {
    content.innerHTML = '<div class="alert alert-warning">Error: ' + salesEscapeHtml(e.message) + '</div>';
  }
}

function selectSalesSection(sectionId) {
  captureSalesInvoiceDraft();
  const routeMap = {
    invoices: 'sales',
    'delivery-notes': 'sales-delivery-notes',
    quotes: 'sales-quotes',
    orders: 'sales-orders',
    'credit-notes': 'sales-credit-notes',
    collections: 'sales-collections',
    'query-invoices': 'sales-query-invoices',
    'query-delivery-notes': 'sales-query-delivery-notes',
    'query-credit-notes': 'sales-query-credit-notes',
    'query-quotes': 'sales-query-quotes',
    'query-orders': 'sales-query-orders'
  };
  window.location.hash = routeMap[sectionId] || 'sales';
}

function focusSaleCustomerSelector() {
  const element = document.getElementById('sale-customer');
  if (element) element.focus();
}

function focusSaleItemSearch() {
  const element = document.getElementById('sale-item-search');
  if (element) element.focus();
}

function syncSalesDatePreview() {
  const input = document.getElementById('sale-date');
  const label = document.getElementById('sale-date-label');
  if (!input || !label) return;
  const formatted = input.value ? salesFormatDate(new Date(input.value + 'T00:00:00')) : salesFormatDate(new Date());
  label.textContent = formatted;
  salesUiState.invoiceDraft.date = input.value || salesUiState.invoiceDraft.date;
}

function showSalesUiNotice(moduleName) {
  alert(moduleName + ': esta accion conserva la UI nueva pero aun no tiene una logica especifica conectada.');
}

function renderSalesInvoiceModule() {
  const draft = salesUiState.invoiceDraft;
  const customer = getDraftSelectedCustomer();
  const sellerOptions = getSalesSellerOptions();
  const customerSummary = customer ? customer.name + (buildSaleCustomerAddress(customer) ? ' - ' + buildSaleCustomerAddress(customer) : '') : 'Consumidor final';

  return `
    <div class="sales-invoice-layout">
      <div class="sales-form-card sales-invoice-compact-card">
        <div class="sales-section-head">
          <div></div>
        </div>
        <div class="sales-compact-grid">
          <div class="form-group"><label>Nro.</label><select><option>Principal</option></select></div>
          <div class="form-group"><label>P.Venta</label><input id="sale-point-of-sale" type="text" value="${salesEscapeAttr(draft.pointOfSale)}" maxlength="3" inputmode="numeric" onchange="refreshSaleDocumentPreview()" oninput="this.value=this.value.replace(/[^0-9]/g, '').slice(0,3)"></div>
          <div class="form-group"><label>Nro.</label><input id="sale-invoice-number" type="text" value="${salesEscapeAttr(salesFormatInvoiceNumber(nextInvoiceNumber))}" readonly></div>
          <div class="form-group"><label>Tipo</label><select id="sale-receipt-type" onchange="refreshSaleDocumentPreview()">${salesBuildOptions(SALES_RECEIPT_TYPES, draft.receiptType, '')}</select></div>
          <div class="form-group"><label>Fecha</label><input id="sale-date" type="date" value="${salesEscapeAttr(draft.date)}" onchange="syncSalesDatePreview()"></div>
          <div class="form-group"><label>Lista</label><select id="sale-price-list">${salesBuildOptions(SALES_PRICE_LISTS, draft.priceList, '')}</select></div>
          <div class="form-group"><label>Desc.</label><input id="sale-global-discount-input" type="number" value="0.00" readonly></div>
          <div class="form-group sales-field-span-2"><label>Vendedor</label><select id="sale-seller">${salesBuildOptions(sellerOptions, draft.seller, '')}</select></div>
          <div class="form-group"><label>Codigo Cliente</label><input id="sale-customer-code" type="text" value="${salesEscapeAttr(customer ? customer.id : '')}" placeholder="Automatico" readonly></div>
          <div class="form-group sales-field-span-3"><label>Nombre</label><select id="sale-customer" onchange="handleSaleCustomerChange()"><option value="">Consumidor final</option>${customersForSale.map((item) => '<option value="' + item.id + '"' + (String(draft.customerId) === String(item.id) ? ' selected' : '') + '>' + salesEscapeHtml(item.name) + '</option>').join('')}</select></div>
          <div class="form-group"><label>CUIT</label><input id="sale-customer-tax-id" type="text" value="${salesEscapeAttr(draft.taxId)}" placeholder="CUIT o DNI"></div>
          <div class="form-group"><label>Condicion IVA</label><select id="sale-customer-iva-condition">${salesBuildOptions(SALES_IVA_CONDITIONS, draft.ivaCondition, 'Seleccione...')}</select></div>
          <div class="form-group sales-field-span-4"><label>Direccion</label><input id="sale-customer-address" type="text" value="${salesEscapeAttr(draft.address)}" placeholder="Direccion del cliente"></div>
          <div class="form-group sales-field-span-2"><label>Obs:</label><input id="sale-observations" type="text" value="${salesEscapeAttr(draft.observations)}" placeholder="Observaciones del comprobante"></div>
          <div class="form-group"><label>O.C:</label><input id="sale-oc" type="text" value="${salesEscapeAttr(draft.oc)}" placeholder="Orden de compra"></div>
          <div class="form-group"><label>Rem:</label><input id="sale-remito" type="text" value="${salesEscapeAttr(draft.remito)}" placeholder="Referencia"></div>
        </div>
        <div class="sales-customer-summary" id="sale-customer-summary">${salesEscapeHtml(customerSummary)}</div>
        <div class="sales-live-metrics" hidden aria-hidden="true">
          <strong id="sale-strip-type">${salesEscapeHtml(draft.receiptType)}</strong>
          <strong id="sale-strip-pos">${salesEscapeHtml(draft.pointOfSale)}</strong>
          <strong id="sale-date-label">${salesEscapeHtml(salesFormatDate(new Date(draft.date + 'T00:00:00')))}</strong>
          <strong id="sale-strip-customer">${salesEscapeHtml(customer ? customer.name : 'Consumidor final')}</strong>
          <strong id="sale-global-discount">0%</strong>
        </div>
        <input id="sale-payment" type="hidden" value="cash">
      </div>

      <div class="sales-form-card sales-items-card">
        <div class="sales-section-head">
          <div></div>
        </div>
        <div class="sales-article-toolbar sales-article-toolbar--compact">
          <div class="form-group sales-article-search-group">
            <label>Codigo Articulo</label>
            <div class="sales-inline-combo">
              <input id="sale-item-search" type="text" placeholder="Buscar por codigo o descripcion" oninput="filterPosProducts()" onkeydown="if(event.key === 'Enter'){ event.preventDefault(); quickAddSaleProduct(); }">
              <button class="sales-addon-button sales-addon-button--wide" type="button" onclick="quickAddSaleProduct()">Buscar</button>
            </div>
          </div>
        </div>
        <div class="sales-search-meta" id="sales-search-meta">Escribe un codigo o descripcion y presiona Enter para agregar.</div>
        <div class="sales-search-results" id="sales-search-results" hidden></div>
        <div class="sales-lines-table-wrap">
          <table class="sales-lines-table">
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
            <tbody id="sales-lines-body"></tbody>
          </table>
        </div>
        <div class="sales-summary-inline">
          <div class="sales-summary-card sales-summary-card--full">
            <div id="sales-sync-banner"></div>
            <div class="sales-summary-row"><span>Neto</span><strong id="sales-neto">$ 0,00</strong></div>
            <div class="sales-summary-row"><span>Descuento</span><strong id="sales-descuento">$ 0,00</strong></div>
            <div class="sales-summary-row"><span>Subtotal</span><strong id="sales-subtotal">$ 0,00</strong></div>
            <div class="sales-summary-row"><span>IVA</span><strong id="sales-iva">$ 0,00</strong></div>
            <div class="sales-summary-total"><span>Total</span><strong id="cart-total">$ 0,00</strong></div>
          </div>
        </div>
        <div class="sales-primary-action">
          <button class="btn btn-success" type="button" onclick="processSale()">Facturar</button>
        </div>
      </div>
    </div>
  `;
}

function renderSalesDocumentStub(config) {
  const sellerOptions = getSalesSellerOptions();
  return `
    <div class="sales-module-head">
      <div>
        <p class="sales-module-kicker">${salesEscapeHtml(config.kicker)}</p>
        <h2>${salesEscapeHtml(config.title)}</h2>
        <p>${salesEscapeHtml(config.subtitle)}</p>
      </div>
    </div>
    <div class="sales-workspace">
      <div class="sales-panel-stack">
        <div class="sales-form-card">
          <div class="sales-section-head">
            <div><p class="sales-section-kicker">Encabezado</p><h3>Datos del comprobante</h3></div>
          </div>
          <div class="sales-form-grid sales-form-grid--document">
            <div class="form-group"><label>${salesEscapeHtml(config.receiptLabel || 'P.Venta')}</label><input type="text" value="001"></div>
            <div class="form-group"><label>${salesEscapeHtml(config.numberLabel)}</label><input type="text" value="00000001"></div>
            <div class="form-group"><label>Vendedor</label><select>${salesBuildOptions(sellerOptions, salesGetCurrentSellerName(), '')}</select></div>
            <div class="form-group"><label>Lista de precios</label><select>${salesBuildOptions(SALES_PRICE_LISTS, 'Lista 1', '')}</select></div>
            <div class="form-group"><label>Desc %</label><input type="number" value="0"></div>
            <div class="form-group"><label>Fecha</label><input type="date" value="${salesEscapeAttr(salesFormatDateInput(new Date()))}"></div>
            ${config.extraFieldLabel ? `<div class="form-group sales-field-span-2"><label>${salesEscapeHtml(config.extraFieldLabel)}</label><div class="sales-inline-combo"><input type="text" placeholder="${salesEscapeAttr(config.extraFieldLabel)}"><button class="sales-addon-button sales-addon-button--wide" type="button" onclick="showSalesUiNotice('${salesEscapeAttr(config.title)}')">${salesEscapeHtml(config.extraFieldButton || 'Buscar')}</button></div></div>` : ''}
          </div>
        </div>

        <div class="sales-form-card">
          <div class="sales-section-head">
            <div><p class="sales-section-kicker">Cliente</p><h3>Datos del cliente</h3></div>
            <div class="sales-shortcut-badge">F3</div>
          </div>
          <div class="sales-form-grid sales-form-grid--customer">
            <div class="form-group"><label>Codigo cliente</label><div class="sales-inline-combo"><input type="text" placeholder="Codigo"><button class="sales-addon-button sales-addon-button--wide" type="button" onclick="showSalesUiNotice('${salesEscapeAttr(config.title)}')">Buscar</button></div></div>
            <div class="form-group sales-field-span-2"><label>Nombre</label><select><option>Seleccionar cliente</option>${customersForSale.map((item) => '<option value="' + item.id + '">' + salesEscapeHtml(item.name) + '</option>').join('')}</select></div>
            <div class="form-group"><label>Direccion</label><input type="text" placeholder="Direccion"></div>
            <div class="form-group"><label>CUIT/DNI</label><input type="text" placeholder="CUIT o DNI"></div>
            <div class="form-group"><label>Condicion IVA</label><select>${salesBuildOptions(SALES_IVA_CONDITIONS, 'Consumidor Final', '')}</select></div>
            <div class="form-group sales-field-span-3"><label>Observaciones</label><input type="text" placeholder="Observaciones"></div>
          </div>
        </div>

        <div class="sales-form-card">
          <div class="sales-section-head">
            <div><p class="sales-section-kicker">Items</p><h3>Carga de articulos</h3></div>
            <div class="sales-shortcut-badge">F5</div>
          </div>
          <div class="form-group sales-article-search-group">
            <label>${salesEscapeHtml(config.searchPlaceholder || 'Codigo articulo (F5)')}</label>
            <div class="sales-inline-combo">
              <input type="text" placeholder="${salesEscapeAttr(config.searchPlaceholder || 'Codigo articulo')}">
              <button class="sales-addon-button sales-addon-button--wide" type="button" onclick="showSalesUiNotice('${salesEscapeAttr(config.title)}')">Buscar</button>
            </div>
          </div>
          <div class="sales-lines-table-wrap">
            <table class="sales-lines-table">
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
                <tr><td colspan="7" class="sales-empty-row">La estructura visual ya esta preparada para este comprobante sin alterar la logica actual.</td></tr>
              </tbody>
            </table>
          </div>
          ${config.checkboxLabel ? `<div class="sales-check-row"><label><input type="checkbox"> ${salesEscapeHtml(config.checkboxLabel)}</label></div>` : ''}
        </div>
      </div>

      <aside class="sales-side-stack">
        ${config.showTotals !== false ? `<div class="sales-summary-card"><div class="sales-summary-row"><span>Neto</span><strong>$ 0,00</strong></div><div class="sales-summary-row"><span>Descuento</span><strong>$ 0,00</strong></div><div class="sales-summary-row"><span>Subtotal</span><strong>$ 0,00</strong></div><div class="sales-summary-row"><span>IVA</span><strong>$ 0,00</strong></div><div class="sales-summary-total"><span>${salesEscapeHtml(config.totalLabel || 'Total')}</span><strong>$ 0,00</strong></div></div>` : ''}
        <div class="sales-shortcuts-card">
          <h3>Atajos visibles</h3>
          <div class="sales-shortcuts-list">${['F3', 'F5'].map((shortcut) => `<span class="sales-shortcut-chip">${salesEscapeHtml(shortcut)}</span>`).join('')}</div>
        </div>
        <div class="sales-footer-actions">
          ${config.exitButtonLabel ? `<button class="btn btn-secondary" type="button" onclick="selectSalesSection('invoices')">${salesEscapeHtml(config.exitButtonLabel)}</button>` : ''}
          <button class="btn btn-success" type="button" onclick="showSalesUiNotice('${salesEscapeAttr(config.title)}')">${salesEscapeHtml(config.documentButtonLabel)}</button>
        </div>
      </aside>
    </div>
  `;
}

function getSalesCustomersWithActivity() {
  const totalsByCustomer = new Map();
  salesHistoryData.forEach((sale) => {
    const customerId = sale.customer_id;
    if (!customerId) return;
    totalsByCustomer.set(customerId, (totalsByCustomer.get(customerId) || 0) + Number(sale.total || 0));
  });
  return customersForSale.map((customer) => ({ ...customer, balance: totalsByCustomer.get(customer.id) || 0 }));
}

function setSalesCollectionsSearch(value) {
  salesUiState.collectionsSearch = value || '';
  salesUiState.collectionsPage = 1;
  renderSalesSection();
}

function changeSalesCollectionsPage(delta) {
  const filtered = getSalesFilteredCustomers();
  const totalPages = Math.max(1, Math.ceil(filtered.length / 8));
  salesUiState.collectionsPage = Math.max(1, Math.min(totalPages, salesUiState.collectionsPage + delta));
  renderSalesSection();
}

function getSalesFilteredCustomers() {
  const search = String(salesUiState.collectionsSearch || '').trim().toLowerCase();
  return getSalesCustomersWithActivity().filter((customer) => {
    if (!search) return true;
    return [customer.id, customer.name, customer.tax_id, customer.zone].some((value) => String(value || '').toLowerCase().includes(search));
  });
}

function selectSalesCollectionsTab(tab) {
  salesUiState.collectionsTab = tab;
  renderSalesSection();
}

function openSalesCustomerAccount(customerId) {
  salesUiState.selectedCustomerId = customerId;
  salesUiState.collectionsTab = 'account';
  renderSalesSection();
}

function renderSalesCollectionsModule() {
  const activeCustomer = customersForSale.find((customer) => customer.id === salesUiState.selectedCustomerId) || null;
  const customersWithSales = getSalesCustomersWithActivity().filter((item) => item.balance > 0).length;
  const sellersWithCustomers = new Set(customersForSale.map((item) => item.seller).filter(Boolean)).size;
  const zonesWithCustomers = new Set(customersForSale.map((item) => item.zone).filter(Boolean)).size;

  return `
    <div class="sales-module-head">
      <div>
        <p class="sales-module-kicker">Cuenta corriente</p>
        <h2>Cobranzas</h2>
        <p>Vista dividida en tabs para navegar clientes y su cuenta corriente con la misma estetica del sistema.</p>
      </div>
    </div>
    <div class="sales-collections-layout">
      <div class="sales-panel-stack">
        <div class="sales-mini-tabs">
          <button class="sales-mini-tab ${salesUiState.collectionsTab === 'customers' ? 'is-active' : ''}" type="button" onclick="selectSalesCollectionsTab('customers')">Listado de clientes</button>
          <button class="sales-mini-tab ${salesUiState.collectionsTab === 'account' ? 'is-active' : ''}" type="button" onclick="selectSalesCollectionsTab('account')">Cuenta corriente del cliente</button>
        </div>
        ${salesUiState.collectionsTab === 'customers' ? renderSalesCollectionsListTab() : renderSalesCollectionsAccountTab(activeCustomer)}
      </div>
      <aside class="sales-stats-stack">
        <div class="sales-stat-card"><span>Deudores</span><strong>${salesEscapeHtml(customersWithSales)}</strong><small>Clientes con movimientos registrados.</small></div>
        <div class="sales-stat-card"><span>Deudores por vendedor</span><strong>${salesEscapeHtml(sellersWithCustomers || 0)}</strong><small>Vendedores asociados en fichas de clientes.</small></div>
        <div class="sales-stat-card"><span>Deudores por zona</span><strong>${salesEscapeHtml(zonesWithCustomers || 0)}</strong><small>Zonas identificadas para seguimiento comercial.</small></div>
      </aside>
    </div>
  `;
}

function renderSalesCollectionsListTab() {
  const filtered = getSalesFilteredCustomers();
  const pageSize = 8;
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.max(1, Math.min(totalPages, salesUiState.collectionsPage));
  const rows = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  return `
    <div class="sales-table-card">
      <div class="sales-table-toolbar">
        <div><h3>Clientes</h3><p>Buscador superior, tabla principal y acceso directo a la cuenta corriente.</p></div>
        <div class="search-box"><input type="text" value="${salesEscapeAttr(salesUiState.collectionsSearch)}" placeholder="Buscar cliente..." oninput="setSalesCollectionsSearch(this.value)"></div>
      </div>
      <div class="sales-lines-table-wrap">
        <table class="sales-lines-table">
          <thead><tr><th>Codigo</th><th>Nombre</th><th>CUIT</th><th>Saldo</th><th>Acciones</th></tr></thead>
          <tbody>
            ${rows.length === 0 ? `<tr><td colspan="5" class="sales-empty-row">No hay clientes para mostrar.</td></tr>` : rows.map((customer) => `<tr><td>${salesEscapeHtml(customer.id)}</td><td>${salesEscapeHtml(customer.name)}</td><td>${salesEscapeHtml(customer.tax_id || '-')}</td><td>${salesEscapeHtml(app.formatMoney(customer.balance || 0))}</td><td><button class="btn btn-sm btn-secondary" type="button" onclick="openSalesCustomerAccount(${customer.id})">Ver Cta Cte</button></td></tr>`).join('')}
          </tbody>
        </table>
      </div>
      <div class="sales-pagination">
        <span>Pagina ${salesEscapeHtml(currentPage)} de ${salesEscapeHtml(totalPages)}</span>
        <div class="btn-group">
          <button class="btn btn-sm btn-secondary" type="button" onclick="changeSalesCollectionsPage(-1)" ${currentPage <= 1 ? 'disabled' : ''}>Anterior</button>
          <button class="btn btn-sm btn-secondary" type="button" onclick="changeSalesCollectionsPage(1)" ${currentPage >= totalPages ? 'disabled' : ''}>Siguiente</button>
        </div>
      </div>
    </div>
  `;
}

function renderSalesCollectionsAccountTab(activeCustomer) {
  if (!activeCustomer) {
    return `<div class="sales-empty-block">Selecciona un cliente desde "Listado de clientes" para ver su cuenta corriente.</div>`;
  }

  const customerSales = salesHistoryData.filter((sale) => String(sale.customer_id) === String(activeCustomer.id));
  const total = customerSales.reduce((acc, sale) => acc + Number(sale.total || 0), 0);

  return `
    <div class="sales-table-card">
      <div class="sales-table-toolbar">
        <div><h3>${salesEscapeHtml(activeCustomer.name)}</h3><p>CUIT: ${salesEscapeHtml(activeCustomer.tax_id || '-')} | Direccion: ${salesEscapeHtml(buildSaleCustomerAddress(activeCustomer) || '-')}</p></div>
        <span class="sales-query-total">Saldo estimado: <strong>${salesEscapeHtml(app.formatMoney(total))}</strong></span>
      </div>
      <div class="sales-lines-table-wrap">
        <table class="sales-lines-table">
          <thead><tr><th>Fecha</th><th>Hora</th><th>Comprobante</th><th>Obs</th><th>Total</th></tr></thead>
          <tbody>
            ${customerSales.length === 0 ? `<tr><td colspan="5" class="sales-empty-row">No hay movimientos registrados para este cliente.</td></tr>` : customerSales.map((sale) => `<tr><td>${salesEscapeHtml(salesFormatDateTime(sale.created_at, 'date'))}</td><td>${salesEscapeHtml(salesFormatDateTime(sale.created_at, 'time'))}</td><td>${salesEscapeHtml(formatSalesReceiptCode(sale))}</td><td>${salesEscapeHtml(sale.notes || '-')}</td><td>${salesEscapeHtml(app.formatMoney(sale.total || 0))}</td></tr>`).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

function getSalesQueryConfig(sectionId) {
  const base = {
    'query-invoices': { title: 'Consultar Facturas', subtitle: 'Tabla estandar con buscador, paginacion y acciones rapidas.', columns: [{ label: 'Fecha', render: (sale) => salesFormatDateTime(sale.created_at, 'date') }, { label: 'Hora', render: (sale) => salesFormatDateTime(sale.created_at, 'time') }, { label: 'N fact.', render: (sale) => formatSalesReceiptCode(sale) }, { label: 'Cliente', render: (sale) => sale.customer_name || 'Consumidor final' }, { label: 'Total', render: (sale) => app.formatMoney(sale.total || 0) }] },
    'query-delivery-notes': { title: 'Consultar Remitos', subtitle: 'Misma estructura de consulta para mantener criterios visuales en Ventas.', columns: [{ label: 'Numero', render: (sale) => formatSalesReceiptCode(sale) }, { label: 'Fecha', render: (sale) => salesFormatDateTime(sale.created_at, 'date') }, { label: 'Hora', render: (sale) => salesFormatDateTime(sale.created_at, 'time') }, { label: 'Cliente', render: (sale) => sale.customer_name || 'Consumidor final' }, { label: 'Total', render: (sale) => app.formatMoney(sale.total || 0) }] },
    'query-credit-notes': { title: 'Consultar Notas de Credito', subtitle: 'Consulta visual uniforme para operaciones comerciales y revisiones rapidas.', columns: [{ label: 'Numero', render: (sale) => formatSalesReceiptCode(sale) }, { label: 'Fecha', render: (sale) => salesFormatDateTime(sale.created_at, 'date') }, { label: 'Hora', render: (sale) => salesFormatDateTime(sale.created_at, 'time') }, { label: 'Cliente', render: (sale) => sale.customer_name || 'Consumidor final' }, { label: 'Total', render: (sale) => app.formatMoney(sale.total || 0) }] },
    'query-quotes': { title: 'Consultar Presupuestos', subtitle: 'Tabla preparada para listar presupuestos con filtro, estado y acciones.', columns: [{ label: 'Numero', render: (sale) => formatSalesReceiptCode(sale) }, { label: 'Fecha', render: (sale) => salesFormatDateTime(sale.created_at, 'date') }, { label: 'Hora', render: (sale) => salesFormatDateTime(sale.created_at, 'time') }, { label: 'Cliente', render: (sale) => sale.customer_name || 'Consumidor final' }, { label: 'Estado', render: () => 'Emitido' }, { label: 'Total', render: (sale) => app.formatMoney(sale.total || 0) }] },
    'query-orders': { title: 'Consultar Pedidos', subtitle: 'Consulta administrativa alineada con el resto del sistema.', columns: [{ label: 'Numero', render: (sale) => formatSalesReceiptCode(sale) }, { label: 'Fecha', render: (sale) => salesFormatDateTime(sale.created_at, 'date') }, { label: 'Hora', render: (sale) => salesFormatDateTime(sale.created_at, 'time') }, { label: 'Cliente', render: (sale) => sale.customer_name || 'Consumidor final' }, { label: 'Vendedor', render: (sale) => sale.user_name || salesGetCurrentSellerName() }, { label: 'Estado', render: () => 'Abierto' }, { label: 'Total', render: (sale) => app.formatMoney(sale.total || 0) }] }
  };
  return base[sectionId];
}

function setSalesQuerySearch(value) {
  salesUiState.querySearch = value || '';
  salesUiState.queryPage = 1;
  renderSalesSection();
}

function changeSalesQueryPage(delta) {
  const filtered = getSalesFilteredQueryRows();
  const totalPages = Math.max(1, Math.ceil(filtered.length / 8));
  salesUiState.queryPage = Math.max(1, Math.min(totalPages, salesUiState.queryPage + delta));
  renderSalesSection();
}

function getSalesFilteredQueryRows() {
  const search = String(salesUiState.querySearch || '').trim().toLowerCase();
  return salesHistoryData.filter((sale) => {
    if (!search) return true;
    return [sale.customer_name, sale.user_name, sale.notes, formatSalesReceiptCode(sale), sale.id].some((value) => String(value || '').toLowerCase().includes(search));
  });
}

function formatSalesReceiptCode(sale) {
  const pos = String(sale.point_of_sale || '001').padStart(3, '0');
  const number = salesFormatInvoiceNumber(sale.receipt_number || sale.id || 1);
  return `${pos}-${number}`;
}

function renderSalesQueryModule(sectionId) {
  const config = getSalesQueryConfig(sectionId);
  const filtered = getSalesFilteredQueryRows();
  const pageSize = 8;
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.max(1, Math.min(totalPages, salesUiState.queryPage));
  const rows = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  return `
    <div class="sales-module-head">
      <div>
        <p class="sales-module-kicker">Consultas</p>
        <h2>${salesEscapeHtml(config.title)}</h2>
        <p>${salesEscapeHtml(config.subtitle)}</p>
      </div>
    </div>
    <div class="sales-table-card">
      <div class="sales-table-toolbar">
        <button class="btn btn-secondary" type="button" onclick="showSalesUiNotice('${salesEscapeAttr(config.title)}')">Borrar entre fechas</button>
        <div class="search-box sales-query-search"><input type="text" value="${salesEscapeAttr(salesUiState.querySearch)}" placeholder="Buscar..." oninput="setSalesQuerySearch(this.value)"></div>
      </div>
      <div class="sales-lines-table-wrap">
        <table class="sales-lines-table">
          <thead><tr>${config.columns.map((column) => `<th>${salesEscapeHtml(column.label)}</th>`).join('')}<th>Acciones</th></tr></thead>
          <tbody>
            ${rows.length === 0 ? `<tr><td colspan="${config.columns.length + 1}" class="sales-empty-row">No hay registros para mostrar.</td></tr>` : rows.map((sale) => `<tr>${config.columns.map((column) => `<td>${salesEscapeHtml(column.render(sale))}</td>`).join('')}<td><div class="btn-group"><button class="btn btn-sm btn-secondary" type="button" onclick="showSalesUiNotice('${salesEscapeAttr(config.title)}')">Ver</button></div></td></tr>`).join('')}
          </tbody>
        </table>
      </div>
      <div class="sales-pagination">
        <span>Pagina ${salesEscapeHtml(currentPage)} de ${salesEscapeHtml(totalPages)}</span>
        <div class="btn-group">
          <button class="btn btn-sm btn-secondary" type="button" onclick="changeSalesQueryPage(-1)" ${currentPage <= 1 ? 'disabled' : ''}>Anterior</button>
          <button class="btn btn-sm btn-secondary" type="button" onclick="changeSalesQueryPage(1)" ${currentPage >= totalPages ? 'disabled' : ''}>Siguiente</button>
        </div>
      </div>
    </div>
  `;
}

function filterPosProducts() {
  const search = (((document.getElementById('sale-item-search') || {}).value) || '').trim().toLowerCase();
  const filtered = productsForSale.filter((product) => {
    if (product.stock <= 0) return false;
    if (!search) return true;
    return [product.name, product.sku, product.barcode, String(product.id)].some((value) => String(value || '').toLowerCase().includes(search));
  });

  const meta = document.getElementById('sales-search-meta');
  const results = document.getElementById('sales-search-results');
  if (!meta || !results) return;

  if (!search) {
    meta.textContent = 'Escribe un codigo o descripcion y presiona Enter para agregar.';
    results.innerHTML = '';
    results.hidden = true;
    return;
  }

  if (filtered.length === 0) {
    meta.textContent = 'No hay coincidencias para "' + search + '".';
    results.innerHTML = '';
    results.hidden = true;
    return;
  }

  const first = filtered[0];
  results.innerHTML = filtered.slice(0, 8).map(renderSaleSearchResult).join('');
  results.hidden = false;
  meta.textContent = filtered.length + ' coincidencias. Primero: ' + (first.sku || ('ART-' + first.id)) + ' - ' + first.name;
}

function quickAddSaleProduct() {
  const searchInput = document.getElementById('sale-item-search');
  const value = ((searchInput || {}).value || '').trim().toLowerCase();
  if (!value) return;

  const product = productsForSale.find((item) => [item.sku, item.barcode, item.name, String(item.id)].some((field) => String(field || '').toLowerCase() === value))
    || productsForSale.find((item) => [item.sku, item.barcode, item.name, String(item.id)].some((field) => String(field || '').toLowerCase().includes(value)));

  if (!product) {
    alert('No se encontro un articulo con ese codigo o descripcion');
    return;
  }

  addSaleSearchProduct(product.id);
}

function renderSaleSearchResult(product) {
  const code = product.sku || ('ART-' + product.id);
  const price = app.formatMoney(Number(product.sale_price) || 0);
  const productIndex = productsForSale.findIndex((item) => String(item.id) === String(product.id));

  return '' +
    '<button class="sales-search-result" type="button" data-product-index="' + productIndex + '">' +
    '<span class="sales-search-result-main">' +
    '<span class="sales-search-result-code">' + salesEscapeHtml(code) + '</span>' +
    '<span class="sales-search-result-name">' + salesEscapeHtml(product.name) + '</span>' +
    '</span>' +
    '<span class="sales-search-result-side">' +
    '<span class="sales-search-result-price">' + salesEscapeHtml(price) + '</span>' +
    '<span class="sales-search-result-stock">Stock ' + salesEscapeHtml(product.stock) + '</span>' +
    '</span>' +
    '</button>';
}

function setupSalesInvoiceInteractions() {
  const results = document.getElementById('sales-search-results');
  if (!results || results.dataset.bound === 'true') return;

  results.addEventListener('click', (event) => {
    const trigger = event.target.closest('[data-product-index]');
    if (!trigger) return;
    event.preventDefault();
    addSaleSearchProductByIndex(trigger.getAttribute('data-product-index'));
  });

  results.dataset.bound = 'true';
}

function addSaleSearchProduct(productId) {
  const product = getProductById(productId);
  addProductToCart(product);
  const searchInput = document.getElementById('sale-item-search');
  if (searchInput) {
    searchInput.value = '';
    filterPosProducts();
    searchInput.focus();
  }
}

function addSaleSearchProductByIndex(productIndex) {
  const index = Number(productIndex);
  const product = Number.isInteger(index) ? productsForSale[index] : null;
  addProductToCart(product);
  const searchInput = document.getElementById('sale-item-search');
  if (searchInput) {
    searchInput.value = '';
    filterPosProducts();
    searchInput.focus();
  }
}

function addProductToCart(product) {
  if (!product) {
    alert('No se pudo resolver el articulo seleccionado');
    return;
  }
  if (Number(product.stock) <= 0) {
    alert('El articulo no tiene stock disponible');
    return;
  }

  const targetId = String(product.id);
  const existing = cart.find((item) => String(item.product_id) === targetId);
  if (existing) {
    if (existing.quantity < Number(product.stock)) existing.quantity += 1;
  } else {
    cart.push({ product_id: product.id, code: product.sku || ('ART-' + product.id), name: product.name, price: Number(product.sale_price) || 0, quantity: 1, discount: 0 });
  }
  renderCart();
}

function removeFromCart(productId) {
  const targetId = String(productId);
  cart = cart.filter((item) => String(item.product_id) !== targetId);
  renderCart();
}

function updateCartQty(productId, qty) {
  const targetId = String(productId);
  const item = cart.find((cartItem) => String(cartItem.product_id) === targetId);
  if (!item) return;
  if (qty <= 0) {
    removeFromCart(productId);
    return;
  }
  const product = getProductById(productId);
  if (!product || qty <= product.stock) item.quantity = qty;
  renderCart();
}

function updateCartPrice(productId, newPrice) {
  const targetId = String(productId);
  const item = cart.find((cartItem) => String(cartItem.product_id) === targetId);
  if (!item) return;
  const price = Number.parseFloat(newPrice);
  if (!Number.isFinite(price) || price <= 0) {
    alert('El precio debe ser un numero positivo');
    renderCart();
    return;
  }
  item.price = price;
  renderCart();
}

function updateCartDiscount(productId, newDiscount) {
  const targetId = String(productId);
  const item = cart.find((cartItem) => String(cartItem.product_id) === targetId);
  if (!item) return;
  const discount = Number.parseFloat(newDiscount);
  if (!Number.isFinite(discount) || discount < 0 || discount > 100) {
    alert('El descuento debe estar entre 0 y 100');
    renderCart();
    return;
  }
  item.discount = discount;
  renderCart();
}

function handleSaleCustomerChange() {
  const customer = getSelectedCustomer();
  const summary = document.getElementById('sale-customer-summary');
  const stripCustomer = document.getElementById('sale-strip-customer');
  const customerCode = document.getElementById('sale-customer-code');
  const customerTaxId = document.getElementById('sale-customer-tax-id');
  const customerIvaCondition = document.getElementById('sale-customer-iva-condition');
  const customerAddress = document.getElementById('sale-customer-address');

  if (customer) {
    const fullAddress = buildSaleCustomerAddress(customer);
    if (summary) summary.textContent = customer.name + (fullAddress ? ' - ' + fullAddress : '') + (customer.phone ? ' - ' + customer.phone : '');
    if (stripCustomer) stripCustomer.textContent = customer.name || 'Consumidor final';
    if (customerCode) customerCode.value = customer.id || '';
    if (customerTaxId) customerTaxId.value = customer.tax_id || '';
    if (customerAddress) customerAddress.value = buildSaleCustomerAddress(customer);
    if (customerIvaCondition) customerIvaCondition.value = normalizeSaleCustomerIvaCondition(customer.iva_condition);
    salesUiState.invoiceDraft.customerId = String(customer.id || '');
    salesUiState.invoiceDraft.taxId = customer.tax_id || '';
    salesUiState.invoiceDraft.address = buildSaleCustomerAddress(customer);
    salesUiState.invoiceDraft.ivaCondition = normalizeSaleCustomerIvaCondition(customer.iva_condition);
    return;
  }

  if (summary) summary.textContent = 'Consumidor final';
  if (stripCustomer) stripCustomer.textContent = 'Consumidor final';
  if (customerCode) customerCode.value = '';
  if (customerTaxId) customerTaxId.value = '';
  if (customerAddress) customerAddress.value = '';
  if (customerIvaCondition) customerIvaCondition.value = 'Consumidor Final';
  salesUiState.invoiceDraft.customerId = '';
  salesUiState.invoiceDraft.taxId = '';
  salesUiState.invoiceDraft.address = '';
  salesUiState.invoiceDraft.ivaCondition = 'Consumidor Final';
}

async function refreshSaleDocumentPreview() {
  const stripType = document.getElementById('sale-strip-type');
  const stripPos = document.getElementById('sale-strip-pos');
  const stripNumber = document.getElementById('sale-strip-number');
  const invoiceNumberEl = document.getElementById('sale-invoice-number');
  const receiptType = salesGetSelectedReceiptType();
  const pointOfSale = salesGetSelectedPointOfSale();
  const pointOfSaleInput = document.getElementById('sale-point-of-sale');

  if (stripType) stripType.textContent = receiptType;
  if (stripPos) stripPos.textContent = pointOfSale;
  if (pointOfSaleInput) pointOfSaleInput.value = pointOfSale;

  salesUiState.invoiceDraft.receiptType = receiptType;
  salesUiState.invoiceDraft.pointOfSale = pointOfSale;

  try {
    const nextNumber = await api.sales.nextNumber({ receiptType, pointOfSale });
    nextInvoiceNumber = Number(nextNumber.receipt_number) || 1;
  } catch (error) {
    nextInvoiceNumber = nextInvoiceNumber || 1;
  }

  const formattedNumber = salesFormatInvoiceNumber(nextInvoiceNumber);
  if (stripNumber) stripNumber.textContent = formattedNumber;
  if (invoiceNumberEl) invoiceNumberEl.value = formattedNumber;
}

function renderCart() {
  const body = document.getElementById('sales-lines-body');
  if (!body) return;

  if (cart.length === 0) {
    body.innerHTML = '<tr><td colspan="7" class="sales-empty-row">Agrega articulos para comenzar la facturacion.</td></tr>';
  } else {
    body.innerHTML = cart.map((item) => {
      const subtotal = getCartItemSubtotal(item);
      return '' +
        '<tr>' +
        '<td><div class="sales-qty-control">' +
        '<button type="button" onclick="updateCartQty(' + item.product_id + ', ' + (item.quantity - 1) + ')">-</button>' +
        '<input class="sales-qty-input" type="text" inputmode="numeric" value="' + item.quantity + '" onfocus="this.select()" oninput="app.sanitizeNumericInput(this, { decimals: 0 })" onkeydown="if(event.key === \'Enter\'){ this.blur(); }" onchange="updateCartQty(' + item.product_id + ', app.parseIntegerInputValue(this.value, 1))" onblur="this.value = String(Math.max(1, app.parseIntegerInputValue(this.value, 1)))">' +
        '<button type="button" onclick="updateCartQty(' + item.product_id + ', ' + (item.quantity + 1) + ')">+</button>' +
        '</div></td>' +
        '<td class="sales-line-code">' + salesEscapeHtml(item.code) + '</td>' +
        '<td><div class="sales-line-name">' + salesEscapeHtml(item.name) + '</div></td>' +
        '<td><input class="sales-line-input sales-line-input--price" type="text" inputmode="decimal" value="' + app.formatDecimalInputValue(item.price, 2) + '" onfocus="this.select()" oninput="app.sanitizeNumericInput(this, { decimals: 2 })" onkeydown="if(event.key === \'Enter\'){ this.blur(); }" onchange="updateCartPrice(' + item.product_id + ', this.value)" onblur="this.value = app.formatDecimalInputValue(Math.max(0.01, app.parseLocaleNumber(this.value, 0.01)), 2)"></td>' +
        '<td><input class="sales-line-input sales-line-input--discount" type="text" inputmode="decimal" value="' + app.formatDecimalInputValue(item.discount || 0, 2) + '" onfocus="this.select()" oninput="app.sanitizeNumericInput(this, { decimals: 2 })" onkeydown="if(event.key === \'Enter\'){ this.blur(); }" onchange="updateCartDiscount(' + item.product_id + ', this.value)" onblur="this.value = app.formatDecimalInputValue(Math.min(100, Math.max(0, app.parseLocaleNumber(this.value, 0))), 2)"></td>' +
        '<td class="sales-line-total">' + app.formatMoney(subtotal) + '</td>' +
        '<td><button class="btn btn-sm btn-danger" type="button" onclick="removeFromCart(' + item.product_id + ')">Quitar</button></td>' +
        '</tr>';
    }).join('');
  }

  const totals = calculateCartTotals();
  const totalEl = document.getElementById('cart-total');
  const netoEl = document.getElementById('sales-neto');
  const descuentoEl = document.getElementById('sales-descuento');
  const subtotalEl = document.getElementById('sales-subtotal');
  const ivaEl = document.getElementById('sales-iva');
  const globalDiscountEl = document.getElementById('sale-global-discount');
  const globalDiscountInput = document.getElementById('sale-global-discount-input');

  if (totalEl) totalEl.textContent = app.formatMoney(totals.total);
  if (netoEl) netoEl.textContent = app.formatMoney(totals.neto);
  if (descuentoEl) descuentoEl.textContent = app.formatMoney(totals.descuento);
  if (subtotalEl) subtotalEl.textContent = app.formatMoney(totals.subtotal);
  if (ivaEl) ivaEl.textContent = app.formatMoney(totals.iva);

  const discountPercent = totals.neto > 0 ? ((totals.descuento / totals.neto) * 100).toFixed(2) : '0.00';
  if (globalDiscountEl) globalDiscountEl.textContent = discountPercent + '%';
  if (globalDiscountInput) globalDiscountInput.value = discountPercent;
}

function cancelSale(clearBanner = true) {
  if (cart.length > 0 && !confirm('Seguro que desea limpiar el comprobante actual?')) return;

  cart = [];
  salesUiState.invoiceDraft = createDefaultSalesDraft();

  const customerSelect = document.getElementById('sale-customer');
  const paymentSelect = document.getElementById('sale-payment');
  const customerTaxId = document.getElementById('sale-customer-tax-id');
  const customerIvaCondition = document.getElementById('sale-customer-iva-condition');
  const customerAddress = document.getElementById('sale-customer-address');
  const observations = document.getElementById('sale-observations');
  const oc = document.getElementById('sale-oc');
  const rem = document.getElementById('sale-remito');
  const pointOfSale = document.getElementById('sale-point-of-sale');
  const receiptType = document.getElementById('sale-receipt-type');
  const saleDate = document.getElementById('sale-date');
  const syncBanner = document.getElementById('sales-sync-banner');

  if (customerSelect) customerSelect.value = '';
  if (paymentSelect) paymentSelect.value = 'cash';
  if (customerTaxId) customerTaxId.value = '';
  if (customerIvaCondition) customerIvaCondition.value = 'Consumidor Final';
  if (customerAddress) customerAddress.value = '';
  if (observations) observations.value = '';
  if (oc) oc.value = '';
  if (rem) rem.value = '';
  if (pointOfSale) pointOfSale.value = '001';
  if (receiptType) receiptType.value = 'C';
  if (saleDate) saleDate.value = salesUiState.invoiceDraft.date;

  if (syncBanner && clearBanner) {
    syncBanner.innerHTML = '';
    syncBanner.className = '';
  }

  handleSaleCustomerChange();
  renderCart();
  syncSalesDatePreview();
  refreshSaleDocumentPreview();
}

async function processSale() {
  if (cart.length === 0) {
    alert('Debes agregar al menos un articulo');
    return;
  }

  const customer = getSelectedCustomer();
  const paymentMethod = (document.getElementById('sale-payment') || {}).value || 'cash';
  const notes = buildSalesNotes();
  const items = cart.map((item) => ({ product_id: item.product_id, quantity: item.quantity, unit_price: Number(getEffectiveUnitPrice(item).toFixed(2)) }));

  try {
    const response = await api.sales.create({
      customer_id: customer ? customer.id : null,
      items,
      payment_method: paymentMethod,
      notes,
      receipt_type: salesGetSelectedReceiptType(),
      point_of_sale: salesGetSelectedPointOfSale()
    });

    const syncStatus = response.syncResults ? checkSyncStatus(response.syncResults) : null;
    showSyncBanner(syncStatus);
    showReceipt(response.sale || response, cart, paymentMethod, response.sale?.id || response.id, syncStatus, customer);

    lastSaleData = {
      saleId: response.sale?.id || response.id,
      receiptType: response.sale?.receipt_type || salesGetSelectedReceiptType(),
      pointOfSale: response.sale?.point_of_sale || salesGetSelectedPointOfSale(),
      receiptNumber: response.sale?.receipt_number || nextInvoiceNumber,
      cart: cart.map((item) => ({ ...item })),
      paymentMethod,
      customerName: customer ? customer.name : 'Consumidor final',
      notes
    };

    cart = [];
    cancelSale(false);
    await refreshSaleDocumentPreview();
  } catch (e) {
    showSyncBanner({ success: false, message: e.message || 'No se pudo completar la venta' });
    alert('Error: ' + e.message);
  }
}

function checkSyncStatus(syncResults) {
  const failed = syncResults.filter((result) => !result.success);
  if (failed.length === 0) return { success: true, message: 'Stock sincronizado con WooCommerce correctamente.' };

  const failedProducts = failed.map((item) => item.productId || item.product_id || '?').join(', ');
  return { success: false, message: 'La venta se registro, pero hubo problemas de sincronizacion en los productos: ' + failedProducts };
}

function showSyncBanner(syncStatus) {
  const banner = document.getElementById('sales-sync-banner');
  if (!banner || !syncStatus) return;
  banner.className = syncStatus.success ? 'sales-sync-banner sales-sync-banner--success' : 'sales-sync-banner sales-sync-banner--error';
  banner.textContent = syncStatus.message;
}

function showReceipt(sale, cartData, paymentMethod, saleId, syncStatus, customer) {
  const totals = cartData.reduce((acc, item) => acc + getCartItemSubtotal(item), 0);
  const receiptType = sale.receipt_type || salesGetSelectedReceiptType();
  const pointOfSale = sale.point_of_sale || salesGetSelectedPointOfSale();
  const receiptNumber = sale.receipt_number || nextInvoiceNumber;
  let receiptHtml = '<input type="hidden" id="sale-id-hidden" value="' + saleId + '">';
  receiptHtml += '<div class="modal-overlay" onclick="if(event.target === this) closeReceipt()">';
  receiptHtml += '<div class="modal sales-receipt-modal">';

  if (syncStatus) {
    receiptHtml += '<div class="' + (syncStatus.success ? 'sales-sync-banner sales-sync-banner--success' : 'sales-sync-banner sales-sync-banner--error') + '" style="margin:20px 20px 0;">' + salesEscapeHtml(syncStatus.message) + '</div>';
  }

  receiptHtml += '<div class="modal-header"><h3>Comprobante emitido</h3><button class="btn-close" type="button" onclick="closeReceipt()">&times;</button></div>';
  receiptHtml += '<div class="modal-body">';
  receiptHtml += '<div class="sales-receipt-ticket">';
  receiptHtml += '<h2>' + salesEscapeHtml(salesBusinessSettings.business_name || 'Milo Pro') + '</h2>';
  receiptHtml += '<p>Fecha: ' + salesEscapeHtml(new Date().toLocaleString('es-AR')) + '</p>';
  receiptHtml += '<p>Comprobante: ' + salesEscapeHtml(receiptType) + ' ' + salesEscapeHtml(pointOfSale) + '-' + salesEscapeHtml(salesFormatInvoiceNumber(receiptNumber)) + '</p>';
  receiptHtml += '<p>Operacion #' + salesEscapeHtml(saleId) + '</p>';
  receiptHtml += '<p>Cliente: ' + salesEscapeHtml(customer ? customer.name : 'Consumidor final') + '</p>';
  receiptHtml += '<hr>';
  cartData.forEach((item) => {
    receiptHtml += '<div class="sales-receipt-line">';
    receiptHtml += '<span>' + salesEscapeHtml(item.name) + ' x' + item.quantity + '</span>';
    receiptHtml += '<strong>' + app.formatMoney(getCartItemSubtotal(item)) + '</strong>';
    receiptHtml += '</div>';
  });
  receiptHtml += '<hr>';
  receiptHtml += '<div class="sales-receipt-line sales-receipt-line--total"><span>Total</span><strong>' + app.formatMoney(totals) + '</strong></div>';
  receiptHtml += '<p>Pago: ' + salesEscapeHtml(paymentMethod === 'cash' ? 'Efectivo' : paymentMethod === 'card' ? 'Tarjeta' : 'Transferencia') + '</p>';
  receiptHtml += '</div>';
  receiptHtml += '</div>';
  receiptHtml += '<div class="modal-footer"><button class="btn btn-secondary" type="button" onclick="closeReceipt()">Cerrar</button><button class="btn btn-primary" type="button" onclick="printReceipt()">Imprimir</button></div>';
  receiptHtml += '</div>';
  receiptHtml += '</div>';
  document.getElementById('modal-container').innerHTML = receiptHtml;
}

function closeReceipt() {
  document.getElementById('modal-container').innerHTML = '';
}

function printReceipt() {
  if (printInProgress || !lastSaleData) return;

  printInProgress = true;
  const saleId = lastSaleData.saleId;
  const receiptType = lastSaleData.receiptType || 'C';
  const pointOfSale = lastSaleData.pointOfSale || '001';
  const receiptNumber = lastSaleData.receiptNumber || 1;
  const cartData = lastSaleData.cart;
  const paymentMethod = lastSaleData.paymentMethod;
  const customerName = lastSaleData.customerName;

  const businessName = window.businessName || 'Milo Pro';
  let receiptText = '               ' + businessName + '\n';
  receiptText += 'Fecha: ' + new Date().toLocaleString('es-AR') + '\n';
  receiptText += 'Comp.: ' + receiptType + ' ' + pointOfSale + '-' + salesFormatInvoiceNumber(receiptNumber) + '\n';
  receiptText += 'Operacion #' + saleId + '\n';
  receiptText += 'Cliente: ' + customerName + '\n';
  receiptText += '------------------------------------------\n';

  let total = 0;
  cartData.forEach((item) => {
    const subtotal = getCartItemSubtotal(item);
    total += subtotal;
    const name = item.name.length > 35 ? item.name.substring(0, 35) : item.name;
    const padding = ' '.repeat(Math.max(1, 35 - name.length + 3));
    receiptText += name + padding + item.quantity + ' x ' + app.formatMoney(getEffectiveUnitPrice(item)) + '\n';
    receiptText += ' '.repeat(35) + '   ' + app.formatMoney(subtotal) + '\n';
  });

  receiptText += '------------------------------------------\n';
  receiptText += 'TOTAL:' + ' '.repeat(35) + app.formatMoney(total) + '\n';
  receiptText += 'Pago: ' + (paymentMethod === 'cash' ? 'Efectivo' : paymentMethod === 'card' ? 'Tarjeta' : 'Transferencia') + '\n';
  if (lastSaleData.notes) receiptText += lastSaleData.notes + '\n';
  receiptText += '------------------------------------------\n';
  receiptText += '       Gracias por su compra!\n';
  receiptText += '            Vuelve pronto\n';
  receiptText += '\n\n\n\n\n';

  document.getElementById('modal-container').innerHTML = '';

  const printFrame = document.createElement('iframe');
  printFrame.style.display = 'none';
  document.body.appendChild(printFrame);

  const frameDoc = printFrame.contentWindow.document;
  frameDoc.open();
  frameDoc.write('<!DOCTYPE html><html><head><title>Recibo</title>');
  frameDoc.write('<style>@page { margin: 0; size: 80mm auto; } body { margin: 0; padding: 5px; font-family: monospace; font-size: 11px; width: 80mm; }</style>');
  frameDoc.write('</head><body><pre style="margin:0;white-space:pre-wrap;word-wrap:break-word;">' + salesEscapeHtml(receiptText) + '</pre></body></html>');
  frameDoc.close();

  printFrame.contentWindow.focus();
  printFrame.contentWindow.print();

  setTimeout(() => document.body.removeChild(printFrame), 1000);
  setTimeout(() => {
    printInProgress = false;
    lastSaleData = null;
  }, 2000);
}

console.log('Sales loaded');
