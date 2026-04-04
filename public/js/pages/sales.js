let cart = [];
let productsForSale = [];
let customersForSale = [];
let salesHistoryData = [];
let salesBusinessSettings = { business_name: 'Milo Pro' };
let nextInvoiceNumber = 1;
let printInProgress = false;
let lastSaleData = null;
const SALES_ORDER_STATUSES = ['pending_payment', 'paid', 'ready_for_delivery', 'completed', 'on_hold', 'cancelled', 'refunded', 'payment_failed'];
const SALES_STATUS_ALIASES = {
  pendiente: 'pending_payment',
  pending_payment: 'pending_payment',
  paid: 'paid',
  pago: 'paid',
  procesando: 'paid',
  processing: 'paid',
  ready_for_delivery: 'ready_for_delivery',
  listo_para_entrega: 'ready_for_delivery',
  listo_para_entregar: 'ready_for_delivery',
  completed: 'completed',
  completado: 'completed',
  on_hold: 'on_hold',
  on_hold_: 'on_hold',
  cancelado: 'cancelled',
  cancelled: 'cancelled',
  refunded: 'refunded',
  reintegrado: 'refunded',
  payment_failed: 'payment_failed',
  fallido: 'payment_failed',
  failed: 'payment_failed'
};
const SALES_STATUS_LABELS = {
  pending_payment: 'Pendiente de pago',
  paid: 'Pagado',
  ready_for_delivery: 'Listo para entregar',
  completed: 'Completado',
  on_hold: 'En espera',
  cancelled: 'Cancelado',
  refunded: 'Reintegrado',
  payment_failed: 'Pago fallido',
  pending: 'Pendiente',
  processing: 'Procesando',
  failed: 'Fallido'
};

const SALES_RECEIPT_TYPES = ['A', 'B', 'C', 'X', 'PRESUPUESTO', 'TICKET'];
const SALES_IVA_CONDITIONS = ['Consumidor Final', 'Responsable Inscripto', 'Monotributista', 'Exento'];
const SALES_PRICE_LISTS = ['Lista 1', 'Lista 2', 'Lista 3', 'Lista 4', 'Lista 5', 'Lista 6'];
const SALES_PAYMENT_METHODS = [
  { id: 'cash', label: 'Efectivo' },
  { id: 'digital', label: 'Pago Digital' },
  { id: 'check', label: 'Cheque' },
  { id: 'account', label: 'Cta. Cte.' },
  { id: 'transfer', label: 'Transferencia' }
];
const SALES_DIGITAL_PAYMENT_TYPES = ['Debito', 'Credito', 'Transferencia', 'QR', 'Otro'];
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
  { id: 'query-orders', label: 'Consultar Pedidos' },
  { id: 'web-orders', label: 'Pedidos Web' }
];

function createDefaultSalesDraft() {
  return {
    receiptType: 'C',
    pointOfSale: '001',
    date: salesFormatDateInput(new Date()),
    priceList: 'Lista 1',
    globalDiscount: '0.00',
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
  webOrdersStatus: '',
  collectionsSearch: '',
  collectionsPage: 1,
  collectionsTab: 'customers',
  selectedCustomerId: null,
  customerLookupSearch: '',
  customerLookupPage: 1,
  paymentModal: {
    isOpen: false,
    selectedMethod: '',
    registeredPayments: [],
    totalAmount: 0,
    cashReceived: '',
    digitalForm: {
      monto: '0,00',
      tipo: '',
      banco: '',
      ultimos4: '',
      recargo: '0,00'
    },
    checkForm: {
      monto: '0,00',
      banco: '',
      numeroCheque: '',
      fechaCobro: ''
    }
  },
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

function salesGetPaymentMethodLabel(methodId) {
  const found = SALES_PAYMENT_METHODS.find((item) => item.id === methodId);
  return found ? found.label : 'Forma de pago';
}

function createSalesDigitalPaymentForm(amount = 0) {
  return {
    monto: app.formatDecimalInputValue(Math.max(0, Number(amount || 0)), 2),
    tipo: '',
    banco: '',
    ultimos4: '',
    recargo: app.formatDecimalInputValue(0, 2)
  };
}

function createSalesCheckPaymentForm(amount = 0) {
  return {
    monto: app.formatDecimalInputValue(Math.max(0, Number(amount || 0)), 2),
    banco: '',
    numeroCheque: '',
    fechaCobro: ''
  };
}

function getSalesDigitalPaymentTotal(form = salesUiState.paymentModal.digitalForm) {
  const amount = Math.max(0, app.parseLocaleNumber((form || {}).monto || 0, 0));
  const surcharge = Math.max(0, app.parseLocaleNumber((form || {}).recargo || 0, 0));
  return amount + (amount * surcharge / 100);
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

function salesGetSelectedPriceList() {
  const select = document.getElementById('sale-price-list');
  return select ? String(select.value || 'Lista 1') : String(salesUiState.invoiceDraft.priceList || 'Lista 1');
}

function salesGetSelectedPriceListKey() {
  const selected = salesGetSelectedPriceList();
  const match = selected.match(/(\d+)/);
  return match ? match[1] : '1';
}

function salesGetProductPriceByList(product, listKey = salesGetSelectedPriceListKey()) {
  if (!product) return 0;
  const normalizedKey = String(listKey || '1');
  const directPrice = normalizedKey === '1'
    ? Number(product.sale_price || 0)
    : Number(product[`sale_price_${normalizedKey}`] || 0);
  if (directPrice > 0) return directPrice;
  return Number(product.sale_price || 0);
}

function salesBuildProductPriceMap(product) {
  if (!product) return {};
  return {
    '1': Number(product.sale_price || 0),
    '2': Number(product.sale_price_2 || 0),
    '3': Number(product.sale_price_3 || 0),
    '4': Number(product.sale_price_4 || 0),
    '5': Number(product.sale_price_5 || 0),
    '6': Number(product.sale_price_6 || 0)
  };
}

function salesBuildProductIncludesTaxMap(product) {
  if (!product) return {};
  return {
    '1': Number(product.sale_price_includes_tax ?? 1) === 1,
    '2': Number(product.sale_price_2_includes_tax || 0) === 1,
    '3': Number(product.sale_price_3_includes_tax || 0) === 1,
    '4': Number(product.sale_price_4_includes_tax || 0) === 1,
    '5': Number(product.sale_price_5_includes_tax || 0) === 1,
    '6': Number(product.sale_price_6_includes_tax || 0) === 1
  };
}

function salesGetMappedPriceByList(priceMap, listKey = salesGetSelectedPriceListKey()) {
  const normalizedKey = String(listKey || '1');
  const directPrice = Number((priceMap || {})[normalizedKey] || 0);
  if (directPrice > 0) return directPrice;
  return Number((priceMap || {})['1'] || 0);
}

function salesGetMappedIncludesTaxByList(includesTaxMap, listKey = salesGetSelectedPriceListKey()) {
  const normalizedKey = String(listKey || '1');
  if (Object.prototype.hasOwnProperty.call(includesTaxMap || {}, normalizedKey)) {
    return !!includesTaxMap[normalizedKey];
  }
  return !!((includesTaxMap || {})['1']);
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

function getSalesCustomerCodeLabel(customer) {
  if (!customer || customer.id === undefined || customer.id === null) return '';
  return String(customer.id);
}

function getSalesCustomerLookupFiltered() {
  const search = String(salesUiState.customerLookupSearch || '').trim().toLowerCase();
  if (!search) return [...customersForSale];
  return customersForSale.filter((customer) => {
    const haystack = [
      getSalesCustomerCodeLabel(customer),
      customer.name,
      buildSaleCustomerAddress(customer),
      customer.tax_id
    ].map((value) => String(value || '').toLowerCase());
    return haystack.some((value) => value.includes(search));
  });
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
  const lineDiscount = Math.max(0, Math.min(100, Number(item.discount) || 0));
  const globalDiscount = Math.max(0, Math.min(100, Number(salesUiState.invoiceDraft.globalDiscount) || 0));
  const discountedPrice = price * (1 - lineDiscount / 100) * (1 - globalDiscount / 100);
  return Math.max(0, discountedPrice);
}

function getCartItemSubtotal(item) {
  return getEffectiveUnitPrice(item) * item.quantity;
}

function salesGetIncludedIvaRate() {
  const receiptType = salesGetSelectedReceiptType();
  return ['A', 'B', 'C'].includes(String(receiptType || '').toUpperCase()) ? 21 : 0;
}

function calculateCartTotals() {
  let baseTotal = 0;
  let descuento = 0;
  let iva = 0;
  const ivaRate = salesGetIncludedIvaRate();
  cart.forEach((item) => {
    const lineBase = (Number(item.price) || 0) * item.quantity;
    const lineTotal = getCartItemSubtotal(item);
    baseTotal += lineBase;
    descuento += lineBase - lineTotal;
    if (ivaRate > 0 && item.price_includes_tax) {
      iva += lineTotal - (lineTotal / (1 + ivaRate / 100));
    }
  });
  const totalConIva = baseTotal - descuento;
  const subtotal = totalConIva - iva;
  const neto = subtotal;
  return { neto, descuento, subtotal, iva, total: totalConIva };
}

function getSalesPaymentModalTotals() {
  const total = Number(salesUiState.paymentModal.totalAmount || 0);
  const registeredTotal = (salesUiState.paymentModal.registeredPayments || []).reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
  const isCashSelected = salesUiState.paymentModal.selectedMethod === 'cash';
  const cashReceived = Math.max(0, app.parseLocaleNumber(salesUiState.paymentModal.cashReceived || 0, 0));
  const totalPaid = isCashSelected ? (cashReceived > 0 ? cashReceived : total) : registeredTotal;
  const change = isCashSelected && cashReceived > 0 ? Math.max(0, cashReceived - total) : 0;
  return { total, totalPaid, change, cashReceived };
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
    priceList: document.getElementById('sale-price-list'),
    globalDiscount: document.getElementById('sale-global-discount-input'),
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

  if (salesUiState.activeSection === 'web-orders') {
    panel.innerHTML = renderSalesWebOrdersModule();
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
    refreshWebOrdersMenuBadge();
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
    'query-orders': 'sales-query-orders',
    'web-orders': 'sales-web-orders'
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
        <div class="sales-invoice-sections">
          <section class="sales-invoice-block">
            <div class="sales-invoice-block-head">
              <h3>Datos de la factura</h3>
            </div>
            <div class="sales-compact-grid sales-compact-grid--invoice">
              <div class="form-group"><label>Nro.</label><select id="sale-book-number"><option value="1">1</option><option value="2">2</option></select></div>
              <div class="form-group"><label>P.Venta</label><input id="sale-point-of-sale" type="text" value="${salesEscapeAttr(draft.pointOfSale)}" maxlength="3" inputmode="numeric" onchange="refreshSaleDocumentPreview()" oninput="this.value=this.value.replace(/[^0-9]/g, '').slice(0,3)"></div>
              <div class="form-group"><label>Numero</label><input id="sale-invoice-number" type="text" value="${salesEscapeAttr(salesFormatInvoiceNumber(nextInvoiceNumber))}" readonly></div>
              <div class="form-group"><label>Tipo</label><select id="sale-receipt-type" onchange="refreshSaleDocumentPreview()">${salesBuildOptions(SALES_RECEIPT_TYPES, draft.receiptType, '')}</select></div>
              <div class="form-group"><label>Lista</label><select id="sale-price-list" onchange="handleSalePriceListChange()">${salesBuildOptions(SALES_PRICE_LISTS, draft.priceList, '')}</select></div>
              <div class="form-group"><label>Desc.</label><input id="sale-global-discount-input" type="text" inputmode="decimal" value="${salesEscapeAttr(app.formatDecimalInputValue(app.parseLocaleNumber(draft.globalDiscount || 0, 0), 2))}" onfocus="this.select()" oninput="app.sanitizeNumericInput(this, { decimals: 2 })" onkeydown="if(event.key === 'Enter'){ this.blur(); }" onchange="updateGlobalSaleDiscount(this.value)" onblur="this.value = app.formatDecimalInputValue(Math.min(100, Math.max(0, app.parseLocaleNumber(this.value, 0))), 2)"></div>
              <div class="form-group"><label>Vendedor</label><select id="sale-seller">${salesBuildOptions(sellerOptions, draft.seller, '')}</select></div>
            </div>
          </section>
          <section class="sales-invoice-block">
            <div class="sales-invoice-block-head">
              <h3>Datos del comprador</h3>
            </div>
            <div class="sales-compact-grid sales-compact-grid--buyer">
              <div class="form-group"><label>Codigo Cliente</label><div class="sales-inline-combo"><input id="sale-customer-code" type="text" value="${salesEscapeAttr(getSalesCustomerCodeLabel(customer))}" placeholder="Codigo cliente" onkeydown="if(event.key === 'Enter'){ event.preventDefault(); searchSaleCustomerByCode(); }"><button class="sales-addon-button sales-addon-button--wide" type="button" onclick="searchSaleCustomerByCode()">Buscar</button></div></div>
              <div class="form-group"><label>Nombre</label><select id="sale-customer" onchange="handleSaleCustomerChange()"><option value="">Consumidor final</option>${customersForSale.map((item) => '<option value="' + item.id + '"' + (String(draft.customerId) === String(item.id) ? ' selected' : '') + '>' + salesEscapeHtml(item.name) + '</option>').join('')}</select></div>
              <div class="form-group"><label>CUIT</label><input id="sale-customer-tax-id" type="text" value="${salesEscapeAttr(draft.taxId)}" placeholder="CUIT o DNI"></div>
              <div class="form-group"><label>Condicion IVA</label><select id="sale-customer-iva-condition">${salesBuildOptions(SALES_IVA_CONDITIONS, draft.ivaCondition, 'Seleccione...')}</select></div>
              <div class="form-group"><label>Direccion</label><input id="sale-customer-address" type="text" value="${salesEscapeAttr(draft.address)}" placeholder="Direccion del cliente"></div>
              <div class="form-group sales-field-span-2"><label>Obs:</label><input id="sale-observations" type="text" value="${salesEscapeAttr(draft.observations)}" placeholder="Observaciones del comprobante"></div>
              <div class="form-group"><label>O.C:</label><input id="sale-oc" type="text" value="${salesEscapeAttr(draft.oc)}" placeholder="Orden de compra"></div>
              <div class="form-group"><label>Rem:</label><input id="sale-remito" type="text" value="${salesEscapeAttr(draft.remito)}" placeholder="Referencia"></div>
            </div>
          </section>
        </div>
        <div class="sales-customer-summary" id="sale-customer-summary">${salesEscapeHtml(customerSummary)}</div>
        <div class="sales-live-metrics" hidden aria-hidden="true">
          <strong id="sale-strip-type">${salesEscapeHtml(draft.receiptType)}</strong>
          <strong id="sale-strip-pos">${salesEscapeHtml(draft.pointOfSale)}</strong>
          <strong id="sale-strip-customer">${salesEscapeHtml(customer ? customer.name : 'Consumidor final')}</strong>
          <strong id="sale-global-discount">0%</strong>
        </div>
        <input id="sale-payment" type="hidden" value="cash">
      </div>

      <div class="sales-form-card sales-items-card">
        <div class="sales-article-toolbar sales-article-toolbar--compact">
          <div class="form-group sales-article-search-group">
            <label>Buscar producto para facturar</label>
            <div class="sales-search-callout">Carga rapida por codigo, SKU o descripcion</div>
            <div class="sales-inline-combo">
              <input id="sale-item-search" type="text" placeholder="Ej. modulo a10, ART-000086 o codigo de barras" oninput="filterPosProducts()" onkeydown="if(event.key === 'Enter'){ event.preventDefault(); quickAddSaleProduct(); }">
              <button class="sales-addon-button sales-addon-button--wide" type="button" onclick="quickAddSaleProduct()">Agregar</button>
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
          <button class="btn btn-success" type="button" onclick="openSalesPaymentModal()">Facturar</button>
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
    'query-invoices': { title: 'Consultar Facturas', subtitle: 'Tabla estandar con buscador, paginacion y acciones rapidas.', columns: [{ label: 'Fecha', render: (sale) => salesFormatDateTime(sale.created_at, 'date') }, { label: 'Hora', render: (sale) => salesFormatDateTime(sale.created_at, 'time') }, { label: 'N fact.', render: (sale) => formatSalesReceiptCode(sale) }, { label: 'Cliente', render: (sale) => sale.customer_name || 'Consumidor final' }, { label: 'Canal', render: (sale) => renderSalesChannelBadge(sale), isHtml: true }, { label: 'Estado', render: (sale) => renderSalesStatusBadge(sale.status), isHtml: true }, { label: 'Total', render: (sale) => app.formatMoney(sale.total || 0) }] },
    'query-delivery-notes': { title: 'Consultar Remitos', subtitle: 'Misma estructura de consulta para mantener criterios visuales en Ventas.', columns: [{ label: 'Numero', render: (sale) => formatSalesReceiptCode(sale) }, { label: 'Fecha', render: (sale) => salesFormatDateTime(sale.created_at, 'date') }, { label: 'Hora', render: (sale) => salesFormatDateTime(sale.created_at, 'time') }, { label: 'Cliente', render: (sale) => sale.customer_name || 'Consumidor final' }, { label: 'Total', render: (sale) => app.formatMoney(sale.total || 0) }] },
    'query-credit-notes': { title: 'Consultar Notas de Credito', subtitle: 'Consulta visual uniforme para operaciones comerciales y revisiones rapidas.', columns: [{ label: 'Numero', render: (sale) => formatSalesReceiptCode(sale) }, { label: 'Fecha', render: (sale) => salesFormatDateTime(sale.created_at, 'date') }, { label: 'Hora', render: (sale) => salesFormatDateTime(sale.created_at, 'time') }, { label: 'Cliente', render: (sale) => sale.customer_name || 'Consumidor final' }, { label: 'Total', render: (sale) => app.formatMoney(sale.total || 0) }] },
    'query-quotes': { title: 'Consultar Presupuestos', subtitle: 'Tabla preparada para listar presupuestos con filtro, estado y acciones.', columns: [{ label: 'Numero', render: (sale) => formatSalesReceiptCode(sale) }, { label: 'Fecha', render: (sale) => salesFormatDateTime(sale.created_at, 'date') }, { label: 'Hora', render: (sale) => salesFormatDateTime(sale.created_at, 'time') }, { label: 'Cliente', render: (sale) => sale.customer_name || 'Consumidor final' }, { label: 'Estado', render: () => 'Emitido' }, { label: 'Total', render: (sale) => app.formatMoney(sale.total || 0) }] },
    'query-orders': { title: 'Consultar Pedidos', subtitle: 'Consulta administrativa alineada con el resto del sistema.', columns: [{ label: 'Numero', render: (sale) => formatSalesReceiptCode(sale) }, { label: 'Fecha', render: (sale) => salesFormatDateTime(sale.created_at, 'date') }, { label: 'Hora', render: (sale) => salesFormatDateTime(sale.created_at, 'time') }, { label: 'Cliente', render: (sale) => sale.customer_name || 'Consumidor final' }, { label: 'Vendedor', render: (sale) => sale.user_name || salesGetCurrentSellerName() }, { label: 'Estado', render: (sale) => renderSalesStatusBadge(sale.status), isHtml: true }, { label: 'Total', render: (sale) => app.formatMoney(sale.total || 0) }] }
  };
  return base[sectionId];
}

function salesGetChannelLabel(sale) {
  const channel = String(sale.channel || 'local').toLowerCase();
  if (channel === 'woocommerce' || channel === 'web') return 'WooCommerce';
  return 'Local';
}

function renderSalesChannelBadge(sale) {
  const isOnline = ['woocommerce', 'web'].includes(String(sale.channel || '').toLowerCase());
  return `<span class="sales-channel-badge ${isOnline ? 'is-online' : 'is-local'}">${salesEscapeHtml(salesGetChannelLabel(sale))}</span>`;
}

function salesGetStatusLabel(status) {
  const normalized = String(salesNormalizeStatus(status) || 'completed');
  return SALES_STATUS_LABELS[normalized] || normalized.replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase());
}

function salesNormalizeStatus(status) {
  const raw = String(status || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_')
    .replace(/-/g, '_');
  return SALES_STATUS_ALIASES[raw] || raw || 'completed';
}

function renderSalesStatusBadge(status) {
  const value = salesNormalizeStatus(status);
  let badgeClass = 'badge-blue';
  if (['completed', 'paid', 'ready_for_delivery'].includes(value)) badgeClass = 'badge-green';
  if (['cancelled', 'refunded', 'payment_failed'].includes(value)) badgeClass = 'badge-red';
  if (['pending_payment', 'on_hold'].includes(value)) badgeClass = 'badge-yellow';
  return `<span class="badge ${badgeClass}">${salesEscapeHtml(salesGetStatusLabel(value))}</span>`;
}

function renderWooExternalStatusBadge(status) {
  const raw = String(status || '').trim().toLowerCase();
  let badgeClass = 'badge-blue';
  if (['completed', 'processing'].includes(raw)) badgeClass = 'badge-green';
  if (['cancelled', 'refunded', 'failed'].includes(raw)) badgeClass = 'badge-red';
  if (['pending', 'on-hold'].includes(raw)) badgeClass = 'badge-yellow';
  const label = raw
    ? (SALES_STATUS_LABELS[raw.replace(/-/g, '_')] || raw.replace(/-/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase()))
    : '-';
  return `<span class="badge ${badgeClass}">${salesEscapeHtml(label)}</span>`;
}

function salesGetPriorityMeta(sale) {
  const status = salesNormalizeStatus(sale.status);
  if (['pending_payment', 'on_hold'].includes(status)) {
    return { label: 'Atencion', className: 'is-high' };
  }
  if (['ready_for_delivery'].includes(status)) {
    return { label: 'Listo para entregar', className: 'is-ready' };
  }
  if (['paid'].includes(status)) {
    return { label: 'Preparar', className: 'is-medium' };
  }
  if (['completed'].includes(status)) {
    return { label: 'Cerrado', className: 'is-low' };
  }
  if (['cancelled', 'refunded', 'payment_failed'].includes(status)) {
    return { label: 'Resolver', className: 'is-critical' };
  }
  return { label: 'Seguimiento', className: 'is-low' };
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

function getOnlineSalesRows() {
  return salesHistoryData
    .filter((sale) => ['woocommerce', 'web'].includes(String(sale.channel || '').toLowerCase()))
    .sort((a, b) => Number(b.id || 0) - Number(a.id || 0));
}

function getWebOrdersFilterCounts() {
  const rows = getOnlineSalesRows();
  return {
    all: rows.length,
    unmanaged: rows.filter((sale) => ['pending_payment', 'paid', 'on_hold', 'ready_for_delivery'].includes(salesNormalizeStatus(sale.status))).length,
    pending_payment: rows.filter((sale) => ['pending_payment', 'on_hold'].includes(salesNormalizeStatus(sale.status))).length,
    paid: rows.filter((sale) => salesNormalizeStatus(sale.status) === 'paid').length,
    ready_for_delivery: rows.filter((sale) => salesNormalizeStatus(sale.status) === 'ready_for_delivery').length,
    completed: rows.filter((sale) => salesNormalizeStatus(sale.status) === 'completed').length,
    refunded: rows.filter((sale) => ['refunded', 'cancelled', 'payment_failed'].includes(salesNormalizeStatus(sale.status))).length
  };
}

function setWebOrdersStatusFilter(value) {
  salesUiState.webOrdersStatus = value || '';
  salesUiState.queryPage = 1;
  renderSalesSection();
}

function getFilteredWebOrders() {
  const search = String(salesUiState.querySearch || '').trim().toLowerCase();
  const rawStatusFilter = String(salesUiState.webOrdersStatus || '').trim();
  const statusFilter = rawStatusFilter === 'unmanaged' ? 'unmanaged' : salesNormalizeStatus(rawStatusFilter);

  return getOnlineSalesRows().filter((sale) => {
    const normalizedStatus = salesNormalizeStatus(sale.status);
    if (statusFilter === 'unmanaged' && !['pending_payment', 'paid', 'on_hold', 'ready_for_delivery'].includes(normalizedStatus)) return false;
    if (statusFilter && statusFilter !== 'unmanaged' && normalizedStatus !== statusFilter) return false;
    if (!search) return true;
    return [
      sale.customer_name,
      sale.user_name,
      sale.notes,
      sale.external_reference,
      sale.external_status,
      formatSalesReceiptCode(sale),
      sale.id
    ].some((value) => String(value || '').toLowerCase().includes(search));
  });
}

function renderWebOrdersFilterButton(value, label, count, tone = 'neutral') {
  const current = String(salesUiState.webOrdersStatus || '').trim();
  const isActive = current === String(value || '');
  return `<button class="sales-web-filter-tab${isActive ? ' is-active' : ''} sales-web-filter-tab--${salesEscapeAttr(tone)}" type="button" onclick="setWebOrdersStatusFilter('${salesEscapeAttr(value)}')"><span>${salesEscapeHtml(label)}</span><strong>${salesEscapeHtml(count || 0)}</strong></button>`;
}

function getOnlineSaleAvailableActions(sale) {
  const status = salesNormalizeStatus(sale && sale.status);
  const actions = [
    { id: 'view', label: 'Ver', kind: 'ghost' }
  ];

  if (['pending_payment', 'paid', 'on_hold'].includes(status)) {
    actions.push({ id: 'ready_for_delivery', label: 'Listo', kind: 'ready' });
  }

  if (['pending_payment', 'paid', 'on_hold', 'ready_for_delivery'].includes(status)) {
    actions.push({ id: 'completed', label: 'Finalizar', kind: 'complete' });
  }

  if (!['completed', 'cancelled', 'refunded', 'payment_failed'].includes(status)) {
    actions.push({ id: 'refunded', label: 'Devolver', kind: 'danger' });
  }

  return actions;
}

function renderOnlineSaleActions(sale) {
  return getOnlineSaleAvailableActions(sale).map((action) => {
    if (action.id === 'view') {
      return `<button class="sales-web-action-btn sales-web-action-btn--${salesEscapeAttr(action.kind)}" type="button" onclick="openSaleDetailModal(${sale.id})">${salesEscapeHtml(action.label)}</button>`;
    }
    return `<button class="sales-web-action-btn sales-web-action-btn--${salesEscapeAttr(action.kind)}" type="button" onclick="quickOnlineSaleAction(${sale.id}, '${salesEscapeAttr(action.id)}')">${salesEscapeHtml(action.label)}</button>`;
  }).join('');
}

function getUnmanagedWebOrdersCount() {
  return getOnlineSalesRows().filter((sale) => {
    const status = salesNormalizeStatus(sale.status);
    return ['pending_payment', 'paid', 'on_hold', 'ready_for_delivery'].includes(status);
  }).length;
}

function getSalesFilteredQueryRows() {
  const search = String(salesUiState.querySearch || '').trim().toLowerCase();
  return salesHistoryData.filter((sale) => {
    if (!search) return true;
    return [sale.customer_name, sale.user_name, sale.notes, formatSalesReceiptCode(sale), sale.id, sale.channel, sale.status, sale.external_reference].some((value) => String(value || '').toLowerCase().includes(search));
  }).sort((a, b) => Number(b.id || 0) - Number(a.id || 0));
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
            ${rows.length === 0 ? `<tr><td colspan="${config.columns.length + 1}" class="sales-empty-row">No hay registros para mostrar.</td></tr>` : rows.map((sale) => `<tr class="${['woocommerce', 'web'].includes(String(sale.channel || '').toLowerCase()) ? 'sales-online-row' : ''}">${config.columns.map((column) => `<td>${column.isHtml ? column.render(sale) : salesEscapeHtml(column.render(sale))}</td>`).join('')}<td><div class="btn-group"><button class="btn btn-sm btn-secondary" type="button" onclick="openSaleDetailModal(${sale.id})">Ver</button>${['woocommerce', 'web'].includes(String(sale.channel || '').toLowerCase()) ? `<button class="btn btn-sm btn-primary" type="button" onclick="openSaleDetailModal(${sale.id})">Gestionar</button>` : ''}</div></td></tr>`).join('')}
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

function renderSalesWebOrdersModule() {
  const allRows = getOnlineSalesRows();
  const rows = getFilteredWebOrders();
  const filterCounts = getWebOrdersFilterCounts();
  const totalOrders = allRows.length;
  const pendingCount = allRows.filter((sale) => ['pending_payment', 'on_hold'].includes(salesNormalizeStatus(sale.status))).length;
  const inProgressCount = allRows.filter((sale) => ['paid', 'ready_for_delivery'].includes(salesNormalizeStatus(sale.status))).length;
  const closedCount = allRows.filter((sale) => ['completed', 'cancelled', 'refunded'].includes(salesNormalizeStatus(sale.status))).length;
  const totalAmount = allRows.reduce((sum, sale) => sum + Number(sale.total || 0), 0);
  const pageSize = 8;
  const totalPages = Math.max(1, Math.ceil(rows.length / pageSize));
  const currentPage = Math.max(1, Math.min(totalPages, salesUiState.queryPage));
  const visibleRows = rows.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const urgentRows = rows.filter((sale) => ['pending_payment', 'on_hold', 'refunded', 'cancelled', 'payment_failed'].includes(salesNormalizeStatus(sale.status))).slice(0, 3);
  const currentFilter = String(salesUiState.webOrdersStatus || '').trim() || 'all';
  const filterLabels = {
    all: 'Todos los pedidos',
    unmanaged: 'Sin gestionar',
    pending_payment: 'Pendientes',
    paid: 'Pagados',
    ready_for_delivery: 'Listos',
    completed: 'Completados',
    refunded: 'Devueltos o cerrados con incidencia'
  };

  return `
    <div class="sales-module-head">
      <div>
        <p class="sales-module-kicker">Operacion Web</p>
        <h2>Pedidos Web</h2>
        <p>Cola dedicada para gestionar ventas WooCommerce desde el sistema maestro.</p>
      </div>
    </div>

    <div class="reports-summary-grid">
      <article class="reports-summary-card"><span>Pedidos web</span><strong>${salesEscapeHtml(totalOrders)}</strong></article>
      <article class="reports-summary-card"><span>Pendientes</span><strong>${salesEscapeHtml(pendingCount)}</strong></article>
      <article class="reports-summary-card"><span>En gestion</span><strong>${salesEscapeHtml(inProgressCount)}</strong></article>
      <article class="reports-summary-card"><span>Cerrados</span><strong>${salesEscapeHtml(closedCount)}</strong></article>
      <article class="reports-summary-card"><span>Total</span><strong>${salesEscapeHtml(app.formatMoney(totalAmount))}</strong></article>
    </div>

    <div class="sales-web-priority-strip">
      ${urgentRows.length === 0
        ? '<div class="sales-web-priority-card is-low"><strong>Sin alertas</strong><p>No hay pedidos web urgentes ahora.</p></div>'
        : urgentRows.map((sale) => {
          const priority = salesGetPriorityMeta(sale);
          return `
            <button class="sales-web-priority-card ${priority.className}" type="button" onclick="openSaleDetailModal(${sale.id})">
              <span>${salesEscapeHtml(priority.label)}</span>
              <strong>${salesEscapeHtml(sale.customer_name || 'Cliente web')}</strong>
              <p>${salesEscapeHtml(formatSalesReceiptCode(sale))} · ${salesEscapeHtml(app.formatMoney(sale.total || 0))}</p>
            </button>
          `;
        }).join('')}
    </div>

    <div class="sales-table-card">
      <div class="sales-table-toolbar" style="justify-content: space-between; gap: 12px; flex-wrap: wrap;">
        <div class="sales-web-filter-tabs" role="tablist" aria-label="Filtros de pedidos web">
          ${renderWebOrdersFilterButton('', 'Todos', filterCounts.all, 'neutral')}
          ${renderWebOrdersFilterButton('unmanaged', 'Sin gestionar', filterCounts.unmanaged, 'warning')}
          ${renderWebOrdersFilterButton('pending_payment', 'Pendientes', filterCounts.pending_payment, 'warning')}
          ${renderWebOrdersFilterButton('paid', 'Pagados', filterCounts.paid, 'info')}
          ${renderWebOrdersFilterButton('ready_for_delivery', 'Listos', filterCounts.ready_for_delivery, 'success')}
          ${renderWebOrdersFilterButton('completed', 'Completados', filterCounts.completed, 'neutral')}
          ${renderWebOrdersFilterButton('refunded', 'Devueltos', filterCounts.refunded, 'danger')}
        </div>
        <div class="search-box sales-query-search">
          <input type="text" value="${salesEscapeAttr(salesUiState.querySearch)}" placeholder="Buscar pedido web..." oninput="setSalesQuerySearch(this.value)">
        </div>
      </div>
      <div class="sales-web-filter-summary">
        <strong>${salesEscapeHtml(filterLabels[currentFilter] || filterLabels.all)}</strong>
        <span>${salesEscapeHtml(rows.length)} pedidos en esta vista</span>
      </div>
      <div class="sales-lines-table-wrap">
        <table class="sales-lines-table">
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
            ${visibleRows.length === 0
              ? '<tr><td colspan="7" class="sales-empty-row">No hay pedidos web para los filtros seleccionados.</td></tr>'
              : visibleRows.map((sale) => `
                <tr class="sales-online-row">
                  <td>${salesEscapeHtml(salesFormatDateTime(sale.created_at, 'date'))}</td>
                  <td>
                    <div>${salesEscapeHtml(formatSalesReceiptCode(sale))}</div>
                    <small>${salesEscapeHtml(sale.external_reference || '-')}</small>
                  </td>
                  <td>${salesEscapeHtml(sale.customer_name || 'Cliente web')}</td>
                  <td><div style="display:flex; gap:8px; align-items:center; flex-wrap:wrap;">${renderSalesStatusBadge(sale.status)}<span class="sales-web-priority-pill ${salesGetPriorityMeta(sale).className}">${salesEscapeHtml(salesGetPriorityMeta(sale).label)}</span></div></td>
                  <td>${renderWooExternalStatusBadge(sale.external_status || '-')}</td>
                  <td>${salesEscapeHtml(app.formatMoney(sale.total || 0))}</td>
                  <td>
                    <div class="sales-web-actions">
                      ${renderOnlineSaleActions(sale)}
                    </div>
                  </td>
                </tr>
              `).join('')}
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

function getSaleById(saleId) {
  return salesHistoryData.find((sale) => String(sale.id) === String(saleId)) || null;
}

function buildSaleStatusOptions(selectedValue) {
  const normalizedSelected = salesNormalizeStatus(selectedValue);
  return SALES_ORDER_STATUSES.map((status) => `<option value="${salesEscapeAttr(status)}"${normalizedSelected === status ? ' selected' : ''}>${salesEscapeHtml(salesGetStatusLabel(status))}</option>`).join('');
}

function refreshWebOrdersMenuBadge() {
  const badge = document.getElementById('sales-web-orders-badge');
  if (!badge) return;
  const count = getUnmanagedWebOrdersCount();
  badge.textContent = count > 99 ? '99+' : String(count);
  badge.hidden = count <= 0;
}

function openSaleDetailModal(saleId) {
  const sale = getSaleById(saleId);
  if (!sale) {
    alert('No se encontro la venta');
    return;
  }

  const items = Array.isArray(sale.items) ? sale.items : [];
  const isOnline = ['woocommerce', 'web'].includes(String(sale.channel || '').toLowerCase());
  const availableActions = getOnlineSaleAvailableActions(sale).filter((action) => action.id !== 'view');

  app.showModal(`
    <div class="modal" style="max-width: 920px;">
      <div class="modal-header">
        <h3>Venta ${salesEscapeHtml(formatSalesReceiptCode(sale))}</h3>
        <button type="button" class="btn-close" onclick="app.closeModal()">&times;</button>
      </div>
      <div class="modal-body">
        <div class="sales-detail-grid">
          <article class="sales-detail-card">
            <span>Canal</span>
            <strong>${renderSalesChannelBadge(sale)}</strong>
          </article>
          <article class="sales-detail-card">
            <span>Estado</span>
            <strong>${renderSalesStatusBadge(sale.status)}</strong>
          </article>
          <article class="sales-detail-card">
            <span>Cliente</span>
            <strong>${salesEscapeHtml(sale.customer_name || 'Consumidor final')}</strong>
          </article>
          <article class="sales-detail-card">
            <span>Total</span>
            <strong>${salesEscapeHtml(app.formatMoney(sale.total || 0))}</strong>
          </article>
          <article class="sales-detail-card">
            <span>Pago</span>
            <strong>${salesEscapeHtml(sale.payment_method || '-')}</strong>
          </article>
          <article class="sales-detail-card">
            <span>Referencia externa</span>
            <strong>${salesEscapeHtml(sale.external_reference || '-')}</strong>
          </article>
        </div>

        <div class="sales-detail-items">
          <h4>Items</h4>
          <div class="sales-lines-table-wrap">
            <table class="sales-lines-table">
              <thead><tr><th>Articulo</th><th>SKU</th><th>Cantidad</th><th>Precio</th><th>Subtotal</th></tr></thead>
              <tbody>
                ${items.length === 0
                  ? '<tr><td colspan="5" class="sales-empty-row">No hay items para mostrar.</td></tr>'
                  : items.map((item) => `<tr><td>${salesEscapeHtml(item.product_name || '-')}</td><td>${salesEscapeHtml(item.sku || '-')}</td><td>${salesEscapeHtml(item.quantity || 0)}</td><td>${salesEscapeHtml(app.formatMoney(item.unit_price || 0))}</td><td>${salesEscapeHtml(app.formatMoney(item.subtotal || 0))}</td></tr>`).join('')}
              </tbody>
            </table>
          </div>
        </div>

        ${isOnline ? `
          <div class="sales-detail-status-actions">
            <h4>Gestion operativa WooCommerce</h4>
            <p class="sales-status-note">La app local decide el estado operativo final y sincroniza el cambio a WooCommerce.</p>
            <div class="form-row">
              <div class="form-group">
                <label>Nuevo estado</label>
                <select id="sale-status-next">${buildSaleStatusOptions(sale.status)}</select>
              </div>
            </div>
            <div class="form-group">
              <label>Nota operativa</label>
              <textarea id="sale-status-note" placeholder="Ej. Compra entregada, devolucion aprobada, cancelacion validada"></textarea>
            </div>
            <div class="btn-group">
              <button class="btn btn-primary" type="button" onclick="applyOnlineSaleStatusChange(${sale.id})">Aplicar estado</button>
              ${availableActions.map((action) => `<button class="btn ${action.kind === 'danger' ? 'btn-danger' : 'btn-secondary'}" type="button" onclick="quickOnlineSaleAction(${sale.id}, '${salesEscapeAttr(action.id)}')">${salesEscapeHtml(action.label === 'Listo' ? 'Marcar listo' : action.label === 'Finalizar' ? 'Finalizar compra' : 'Generar devolucion')}</button>`).join('')}
            </div>
          </div>
        ` : ''}
      </div>
      <div class="modal-footer">
        <button type="button" class="btn btn-secondary" onclick="app.closeModal()">Cerrar</button>
      </div>
    </div>
  `);
}

async function refreshSalesHistoryData() {
  const salesHistory = await api.sales.getAll({}).catch(() => []);
  salesHistoryData = Array.isArray(salesHistory) ? salesHistory : [];
  refreshWebOrdersMenuBadge();
}

async function handleIncomingOnlineSales(event) {
  const detail = event && event.detail ? event.detail : {};
  const newSales = Array.isArray(detail.newSales) ? detail.newSales : [];
  if (newSales.length === 0) return;

  await refreshSalesHistoryData();

  const panel = document.getElementById('sales-admin-panel');
  if (!panel) return;

  if (['web-orders', 'query-invoices', 'query-orders'].includes(String(salesUiState.activeSection || ''))) {
    renderSalesSection();
  }
}

window.removeEventListener('online-sales:new', handleIncomingOnlineSales);
window.addEventListener('online-sales:new', handleIncomingOnlineSales);

async function applyOnlineSaleStatusChange(saleId, forcedStatus = '') {
  const nextStatus = forcedStatus || ((document.getElementById('sale-status-next') || {}).value || '');
  const note = ((document.getElementById('sale-status-note') || {}).value || '').trim();

  if (!nextStatus) {
    alert('Selecciona un estado');
    return;
  }

  try {
    const response = await api.sales.updateStatus(saleId, {
      status: nextStatus,
      note,
      sync_to_woo: true
    });

    await refreshSalesHistoryData();
    renderSalesSection();
    app.showToast(`Venta actualizada a ${salesGetStatusLabel(nextStatus)}`, {
      title: 'Venta online actualizada',
      variant: 'success',
      actionLabel: 'Ver',
      onAction: () => {
        window.location.hash = 'sales-query-invoices';
      }
    });

    app.closeModal();

    if (response && response.remoteSync && response.remoteSync.success === false) {
      alert('El estado local se actualizo, pero fallo la sincronizacion con WooCommerce: ' + response.remoteSync.error);
    }
  } catch (error) {
    alert('No se pudo actualizar la venta: ' + error.message);
  }
}

function quickOnlineSaleAction(saleId, nextStatus) {
  applyOnlineSaleStatusChange(saleId, nextStatus);
}

function filterPosProducts() {
  const search = (((document.getElementById('sale-item-search') || {}).value) || '').trim().toLowerCase();
  const filtered = productsForSale.filter((product) => {
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
  const price = app.formatMoney(salesGetProductPriceByList(product));
  const productIndex = productsForSale.findIndex((item) => String(item.id) === String(product.id));
  const imageUrl = app.safeImageUrl(product.image_url);
  const hasStock = Number(product.stock) > 0;

  return '' +
    '<button class="sales-search-result' + (hasStock ? '' : ' is-out-of-stock') + '" type="button" data-product-index="' + productIndex + '">' +
    '<span class="sales-search-result-thumb">' +
    (imageUrl
      ? '<img src="' + imageUrl + '" alt="' + salesEscapeAttr(product.name || 'Articulo') + '">'
      : '<span class="sales-search-result-thumb-placeholder">Sin foto</span>') +
    '</span>' +
    '<span class="sales-search-result-main">' +
    '<span class="sales-search-result-name">' + salesEscapeHtml(product.name) + '</span>' +
    '<span class="sales-search-result-code">' + salesEscapeHtml(code) + '</span>' +
    '</span>' +
    '<span class="sales-search-result-side">' +
    '<span class="sales-search-result-price">' + salesEscapeHtml(price) + '</span>' +
    '<span class="sales-search-result-stock' + (hasStock ? '' : ' is-empty') + '">' + (hasStock ? 'Stock ' + salesEscapeHtml(product.stock) : 'Sin stock') + '</span>' +
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

function selectSaleCustomer(customerId) {
  const customerSelect = document.getElementById('sale-customer');
  if (customerSelect) customerSelect.value = customerId ? String(customerId) : '';
  handleSaleCustomerChange();
}

function renderSalesCustomerLookupModal() {
  const container = document.getElementById('modal-container');
  if (!container) return;

  const filtered = getSalesCustomerLookupFiltered();
  const pageSize = 10;
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.max(1, Math.min(totalPages, salesUiState.customerLookupPage));
  salesUiState.customerLookupPage = currentPage;
  const startIndex = (currentPage - 1) * pageSize;
  const pageItems = filtered.slice(startIndex, startIndex + pageSize);

  const rows = pageItems.length
    ? pageItems.map((customer) => '' +
      '<tr>' +
      '<td>' + salesEscapeHtml(getSalesCustomerCodeLabel(customer)) + '</td>' +
      '<td>' + salesEscapeHtml(customer.name || '-') + '</td>' +
      '<td>' + salesEscapeHtml(buildSaleCustomerAddress(customer) || '-') + '</td>' +
      '<td>' + salesEscapeHtml(customer.tax_id || '-') + '</td>' +
      '<td><button class="btn btn-sm btn-primary" type="button" onclick="selectSaleCustomerFromModal(\'' + salesEscapeAttr(customer.id) + '\')">Seleccionar</button></td>' +
      '</tr>').join('')
    : '<tr><td colspan="5" class="sales-empty-row">No se encontraron clientes para esta busqueda.</td></tr>';

  const pageButtons = Array.from({ length: totalPages }, (_, index) => {
    const page = index + 1;
    const activeClass = page === currentPage ? ' is-active' : '';
    return '<button class="sales-customer-lookup-page' + activeClass + '" type="button" onclick="changeSalesCustomerLookupPage(' + page + ')">' + page + '</button>';
  }).join('');

  container.innerHTML = '' +
    '<div class="modal-overlay" onclick="if(event.target === this) closeSalesCustomerLookup()">' +
    '<div class="modal sales-customer-lookup-modal">' +
    '<div class="modal-header sales-customer-lookup-header">' +
    '<div><h3>Buscar Cliente</h3></div>' +
    '<button type="button" class="modal-close" onclick="closeSalesCustomerLookup()">&times;</button>' +
    '</div>' +
    '<div class="modal-body sales-customer-lookup-body">' +
    '<div class="sales-customer-lookup-toolbar">' +
    '<div class="sales-customer-lookup-length"><span>Mostrar</span><strong>10</strong><span>registros</span></div>' +
    '<div class="sales-customer-lookup-search"><label for="sales-customer-lookup-input">Buscar:</label><input id="sales-customer-lookup-input" type="text" value="' + salesEscapeAttr(salesUiState.customerLookupSearch) + '" placeholder="Ejemplo busqueda..." oninput="updateSalesCustomerLookupSearch(this.value)"></div>' +
    '</div>' +
    '<div class="sales-lines-table-wrap sales-customer-lookup-table-wrap">' +
    '<table class="sales-lines-table sales-customer-lookup-table">' +
    '<thead><tr><th>Codigo</th><th>Nombre</th><th>Direccion</th><th>CUIT</th><th>Accion</th></tr></thead>' +
    '<tbody>' + rows + '</tbody>' +
    '</table>' +
    '</div>' +
    '<div class="sales-customer-lookup-footer">' +
    '<span>Mostrando ' + (filtered.length === 0 ? 0 : startIndex + 1) + ' a ' + Math.min(startIndex + pageSize, filtered.length) + ' de ' + filtered.length + ' registros</span>' +
    '<div class="sales-customer-lookup-pagination">' +
    '<button class="btn btn-secondary btn-sm" type="button" onclick="changeSalesCustomerLookupPage(' + (currentPage - 1) + ')"' + (currentPage === 1 ? ' disabled' : '') + '>Anterior</button>' +
    pageButtons +
    '<button class="btn btn-secondary btn-sm" type="button" onclick="changeSalesCustomerLookupPage(' + (currentPage + 1) + ')"' + (currentPage === totalPages ? ' disabled' : '') + '>Siguiente</button>' +
    '</div>' +
    '</div>' +
    '</div>' +
    '</div>' +
    '</div>';

  const input = document.getElementById('sales-customer-lookup-input');
  if (input) input.focus();
}

function openSalesCustomerLookup(initialSearch = '') {
  salesUiState.customerLookupSearch = String(initialSearch || '');
  salesUiState.customerLookupPage = 1;
  renderSalesCustomerLookupModal();
}

function closeSalesCustomerLookup() {
  const container = document.getElementById('modal-container');
  if (container) container.innerHTML = '';
}

function openSalesPaymentModal() {
  if (cart.length === 0) {
    alert('Debes agregar al menos un articulo');
    return;
  }

  const totals = calculateCartTotals();
  const currentPayment = (document.getElementById('sale-payment') || {}).value || 'cash';
  salesUiState.paymentModal = {
    isOpen: true,
    selectedMethod: currentPayment,
    registeredPayments: currentPayment === 'digital' || currentPayment === 'check'
      ? []
      : [{
        id: 'payment-main',
        method: currentPayment,
        label: salesGetPaymentMethodLabel(currentPayment),
        amount: Number(totals.total || 0)
      }],
    totalAmount: Number(totals.total || 0),
    cashReceived: currentPayment === 'cash' ? app.formatDecimalInputValue(0, 2) : '',
    digitalForm: createSalesDigitalPaymentForm(Number(totals.total || 0)),
    checkForm: createSalesCheckPaymentForm(Number(totals.total || 0))
  };
  renderSalesPaymentModal();
}

function closeSalesPaymentModal() {
  salesUiState.paymentModal.isOpen = false;
  const container = document.getElementById('modal-container');
  if (container) container.innerHTML = '';
}

function selectSalesPaymentMethod(methodId) {
  const total = Number(salesUiState.paymentModal.totalAmount || 0);
  salesUiState.paymentModal.selectedMethod = methodId;
  salesUiState.paymentModal.registeredPayments = methodId === 'digital' || methodId === 'check'
    ? []
    : [{
      id: 'payment-main',
      method: methodId,
      label: salesGetPaymentMethodLabel(methodId),
      amount: total
    }];
  salesUiState.paymentModal.cashReceived = methodId === 'cash' ? app.formatDecimalInputValue(0, 2) : '';
  salesUiState.paymentModal.digitalForm = createSalesDigitalPaymentForm(total);
  salesUiState.paymentModal.checkForm = createSalesCheckPaymentForm(total);
  renderSalesPaymentModal();
}

function updateSalesCashReceived(value) {
  salesUiState.paymentModal.cashReceived = value;
  syncSalesPaymentCashPreview();
}

function syncSalesPaymentCashPreview() {
  const totals = getSalesPaymentModalTotals();
  const totalPaidEl = document.getElementById('sales-payment-total-paid');
  const changeEl = document.getElementById('sales-payment-change');
  const cashRowAmountEl = document.getElementById('sales-payment-cash-row-amount');

  if (totalPaidEl) totalPaidEl.textContent = app.formatMoney(totals.totalPaid);
  if (changeEl) changeEl.textContent = app.formatMoney(totals.change);
  if (cashRowAmountEl) cashRowAmountEl.textContent = app.formatMoney(totals.cashReceived > 0 ? totals.cashReceived : 0);
}

function updateSalesDigitalPaymentField(field, value) {
  if (!salesUiState.paymentModal.digitalForm) {
    salesUiState.paymentModal.digitalForm = createSalesDigitalPaymentForm(salesUiState.paymentModal.totalAmount || 0);
  }
  if (field === 'ultimos4') {
    salesUiState.paymentModal.digitalForm[field] = String(value || '').replace(/\D/g, '').slice(0, 4);
  } else {
    salesUiState.paymentModal.digitalForm[field] = value;
  }
  syncSalesDigitalPaymentPreview();
}

function syncSalesDigitalPaymentPreview() {
  const total = getSalesDigitalPaymentTotal();
  const previewEl = document.getElementById('sales-digital-total');
  if (previewEl) previewEl.textContent = app.formatMoney(total);
}

function addSalesDigitalPayment() {
  const form = salesUiState.paymentModal.digitalForm || createSalesDigitalPaymentForm(salesUiState.paymentModal.totalAmount || 0);
  const amount = Math.max(0, app.parseLocaleNumber(form.monto || 0, 0));
  const surcharge = Math.max(0, app.parseLocaleNumber(form.recargo || 0, 0));
  const totalWithSurcharge = amount + (amount * surcharge / 100);

  if (amount <= 0) {
    alert('El monto del pago digital debe ser mayor a cero');
    return;
  }

  salesUiState.paymentModal.registeredPayments.push({
    id: 'payment-' + Date.now(),
    method: 'digital',
    label: 'Pago Digital',
    amount: Number(totalWithSurcharge.toFixed(2)),
    detail: {
      tipo: form.tipo || '',
      banco: String(form.banco || '').trim(),
      ultimos4: String(form.ultimos4 || '').trim(),
      recargo: Number(surcharge.toFixed(2)),
      montoBase: Number(amount.toFixed(2))
    }
  });

  const { total, totalPaid } = getSalesPaymentModalTotals();
  const pending = Math.max(0, total - totalPaid);
  salesUiState.paymentModal.digitalForm = createSalesDigitalPaymentForm(pending);
  renderSalesPaymentModal();
}

function updateSalesCheckPaymentField(field, value) {
  if (!salesUiState.paymentModal.checkForm) {
    salesUiState.paymentModal.checkForm = createSalesCheckPaymentForm(salesUiState.paymentModal.totalAmount || 0);
  }
  salesUiState.paymentModal.checkForm[field] = value;
}

function addSalesCheckPayment() {
  const form = salesUiState.paymentModal.checkForm || createSalesCheckPaymentForm(salesUiState.paymentModal.totalAmount || 0);
  const amount = Math.max(0, app.parseLocaleNumber(form.monto || 0, 0));

  if (amount <= 0) {
    alert('El monto del cheque debe ser mayor a cero');
    return;
  }

  salesUiState.paymentModal.registeredPayments.push({
    id: 'payment-' + Date.now(),
    method: 'check',
    label: 'Cheque',
    amount: Number(amount.toFixed(2)),
    detail: {
      banco: String(form.banco || '').trim(),
      numeroCheque: String(form.numeroCheque || '').trim(),
      fechaCobro: String(form.fechaCobro || '').trim()
    }
  });

  const { total, totalPaid } = getSalesPaymentModalTotals();
  salesUiState.paymentModal.checkForm = createSalesCheckPaymentForm(Math.max(0, total - totalPaid));
  renderSalesPaymentModal();
}

function removeSalesRegisteredPayment(paymentId) {
  const removedPayment = (salesUiState.paymentModal.registeredPayments || []).find((payment) => payment.id === paymentId);
  salesUiState.paymentModal.registeredPayments = (salesUiState.paymentModal.registeredPayments || []).filter((payment) => payment.id !== paymentId);
  if (salesUiState.paymentModal.registeredPayments.length === 0) {
    salesUiState.paymentModal.selectedMethod = removedPayment && ['digital', 'check'].includes(removedPayment.method) ? removedPayment.method : '';
  }
  if (salesUiState.paymentModal.selectedMethod === 'digital') {
    const { total, totalPaid } = getSalesPaymentModalTotals();
    salesUiState.paymentModal.digitalForm = createSalesDigitalPaymentForm(Math.max(0, total - totalPaid));
  }
  if (salesUiState.paymentModal.selectedMethod === 'check') {
    const { total, totalPaid } = getSalesPaymentModalTotals();
    salesUiState.paymentModal.checkForm = createSalesCheckPaymentForm(Math.max(0, total - totalPaid));
  }
  renderSalesPaymentModal();
}

function renderSalesPaymentModal() {
  const container = document.getElementById('modal-container');
  if (!container || !salesUiState.paymentModal.isOpen) return;

  const { total, totalPaid, change } = getSalesPaymentModalTotals();
  const registeredPayments = salesUiState.paymentModal.registeredPayments || [];
  const isCashSelected = salesUiState.paymentModal.selectedMethod === 'cash';
  const isDigitalSelected = salesUiState.paymentModal.selectedMethod === 'digital';
  const isCheckSelected = salesUiState.paymentModal.selectedMethod === 'check';
  const cashReceivedValue = salesUiState.paymentModal.cashReceived || '';
  const digitalForm = salesUiState.paymentModal.digitalForm || createSalesDigitalPaymentForm(total);
  const checkForm = salesUiState.paymentModal.checkForm || createSalesCheckPaymentForm(total);
  const digitalTotal = getSalesDigitalPaymentTotal(digitalForm);
  const paymentRows = registeredPayments.length
    ? registeredPayments.map((payment) => {
      const isCashPayment = payment.method === 'cash';
      const displayAmount = isCashPayment ? (getSalesPaymentModalTotals().cashReceived > 0 ? getSalesPaymentModalTotals().cashReceived : 0) : Number(payment.amount || 0);
      let paymentDetail = '';
      if (payment.method === 'digital' && payment.detail) {
        paymentDetail = '<small>' +
          [
            payment.detail.tipo || 'Sin tipo',
            payment.detail.banco || 'Sin banco',
            payment.detail.ultimos4 ? '**** ' + payment.detail.ultimos4 : ''
          ].filter(Boolean).join(' - ') +
          '</small>';
      }
      if (payment.method === 'check' && payment.detail) {
        paymentDetail = '<small>' +
          [
            payment.detail.banco || 'Sin banco',
            payment.detail.numeroCheque ? 'Cheque ' + payment.detail.numeroCheque : '',
            payment.detail.fechaCobro || ''
          ].filter(Boolean).join(' - ') +
          '</small>';
      }
      return '' +
      '<div class="sales-payment-row">' +
      '<div>' +
      '<strong>' + salesEscapeHtml(payment.label) + '</strong>' +
      paymentDetail +
      '<span' + (isCashPayment ? ' id="sales-payment-cash-row-amount"' : '') + '>' + app.formatMoney(displayAmount) + '</span>' +
      '</div>' +
      '<button class="btn btn-sm btn-secondary" type="button" onclick="removeSalesRegisteredPayment(\'' + salesEscapeAttr(payment.id) + '\')">Quitar</button>' +
      '</div>';
    }).join('')
    : '<div class="sales-payment-empty">Todavia no hay pagos registrados.</div>';

  container.innerHTML = '' +
    '<div class="modal-overlay" onclick="if(event.target === this) closeSalesPaymentModal()">' +
    '<div class="modal sales-payment-modal">' +
    '<div class="modal-header sales-payment-modal-header">' +
    '<h3>Forma de Pago</h3>' +
    '<button class="modal-close" type="button" onclick="closeSalesPaymentModal()">&times;</button>' +
    '</div>' +
    '<div class="modal-body sales-payment-modal-body">' +
    '<div class="sales-payment-total">Total a Pagar: <strong>' + app.formatMoney(total) + '</strong></div>' +
    '<div class="sales-payment-methods">' +
    SALES_PAYMENT_METHODS.map((method) => {
      const activeClass = salesUiState.paymentModal.selectedMethod === method.id ? ' is-active' : '';
      return '<button class="sales-payment-method' + activeClass + '" type="button" onclick="selectSalesPaymentMethod(\'' + salesEscapeAttr(method.id) + '\')">' + salesEscapeHtml(method.label) + '</button>';
    }).join('') +
    '</div>' +
    (isCashSelected
      ? '<div class="sales-payment-cash-box">' +
        '<label for="sales-cash-received">Importe recibido</label>' +
        '<input id="sales-cash-received" type="text" inputmode="decimal" value="' + salesEscapeAttr(cashReceivedValue) + '" placeholder="0,00" onfocus="this.select()" oninput="app.sanitizeNumericInput(this, { decimals: 2 }); updateSalesCashReceived(this.value)" onkeydown="if(event.key === \'Enter\'){ event.preventDefault(); this.blur(); }" onblur="this.value = app.formatDecimalInputValue(Math.max(0, app.parseLocaleNumber(this.value, 0)), 2); updateSalesCashReceived(this.value)">' +
        '<small>Ingresa el efectivo entregado por el cliente para calcular el vuelto.</small>' +
      '</div>'
      : '') +
    (isDigitalSelected
      ? '<div class="sales-payment-digital-box">' +
        '<h4>Datos del Pago Digital</h4>' +
        '<div class="sales-payment-digital-grid">' +
        '<div class="form-group"><label for="sales-digital-amount">Monto</label><input id="sales-digital-amount" type="text" inputmode="decimal" value="' + salesEscapeAttr(digitalForm.monto) + '" oninput="app.sanitizeNumericInput(this, { decimals: 2 }); updateSalesDigitalPaymentField(\'monto\', this.value)" onblur="this.value = app.formatDecimalInputValue(Math.max(0, app.parseLocaleNumber(this.value, 0)), 2); updateSalesDigitalPaymentField(\'monto\', this.value)"></div>' +
        '<div class="form-group"><label for="sales-digital-type">Tipo</label><select id="sales-digital-type" onchange="updateSalesDigitalPaymentField(\'tipo\', this.value)">' + salesBuildOptions(SALES_DIGITAL_PAYMENT_TYPES, digitalForm.tipo, 'Seleccione...') + '</select></div>' +
        '<div class="form-group"><label for="sales-digital-bank">Banco</label><input id="sales-digital-bank" type="text" value="' + salesEscapeAttr(digitalForm.banco) + '" placeholder="Ej: Banco Galicia" oninput="updateSalesDigitalPaymentField(\'banco\', this.value)"></div>' +
        '<div class="form-group"><label for="sales-digital-last4">Ultimos 4 digitos</label><input id="sales-digital-last4" type="text" inputmode="numeric" maxlength="4" value="' + salesEscapeAttr(digitalForm.ultimos4) + '" placeholder="1234" oninput="updateSalesDigitalPaymentField(\'ultimos4\', this.value)"></div>' +
        '<div class="form-group"><label for="sales-digital-surcharge">Recargo</label><input id="sales-digital-surcharge" type="text" inputmode="decimal" value="' + salesEscapeAttr(digitalForm.recargo) + '" oninput="app.sanitizeNumericInput(this, { decimals: 2 }); updateSalesDigitalPaymentField(\'recargo\', this.value)" onblur="this.value = app.formatDecimalInputValue(Math.max(0, app.parseLocaleNumber(this.value, 0)), 2); updateSalesDigitalPaymentField(\'recargo\', this.value)"></div>' +
        '<div class="form-group"><label>Total con recargo</label><div class="sales-payment-digital-total" id="sales-digital-total">' + app.formatMoney(digitalTotal) + '</div></div>' +
        '</div>' +
        '<div class="sales-payment-digital-actions"><button class="btn btn-primary" type="button" onclick="addSalesDigitalPayment()">Agregar Pago</button></div>' +
      '</div>'
      : '') +
    (isCheckSelected
      ? '<div class="sales-payment-digital-box">' +
        '<h4>Datos del Cheque</h4>' +
        '<div class="sales-payment-digital-grid">' +
        '<div class="form-group"><label for="sales-check-amount">Monto</label><input id="sales-check-amount" type="text" inputmode="decimal" value="' + salesEscapeAttr(checkForm.monto) + '" oninput="app.sanitizeNumericInput(this, { decimals: 2 }); updateSalesCheckPaymentField(\'monto\', this.value)" onblur="this.value = app.formatDecimalInputValue(Math.max(0, app.parseLocaleNumber(this.value, 0)), 2); updateSalesCheckPaymentField(\'monto\', this.value)"></div>' +
        '<div class="form-group"><label for="sales-check-bank">Banco</label><input id="sales-check-bank" type="text" value="' + salesEscapeAttr(checkForm.banco) + '" placeholder="Ej: Banco Frances" oninput="updateSalesCheckPaymentField(\'banco\', this.value)"></div>' +
        '<div class="form-group"><label for="sales-check-number">Numero de Cheque</label><input id="sales-check-number" type="text" value="' + salesEscapeAttr(checkForm.numeroCheque) + '" oninput="updateSalesCheckPaymentField(\'numeroCheque\', this.value)"></div>' +
        '<div class="form-group"><label for="sales-check-date">Fecha de Cobro</label><input id="sales-check-date" type="date" value="' + salesEscapeAttr(checkForm.fechaCobro) + '" onchange="updateSalesCheckPaymentField(\'fechaCobro\', this.value)"></div>' +
        '</div>' +
        '<div class="sales-payment-digital-actions"><button class="btn btn-primary" type="button" onclick="addSalesCheckPayment()">Agregar Pago</button></div>' +
      '</div>'
      : '') +
    '<div class="sales-payment-registered">' +
    '<h4>Pagos Registrados</h4>' +
    '<div class="sales-payment-rows">' + paymentRows + '</div>' +
    '</div>' +
    '<div class="sales-payment-summary">' +
    '<div class="sales-payment-summary-row"><span>Total Pagado</span><strong id="sales-payment-total-paid">' + app.formatMoney(totalPaid) + '</strong></div>' +
    '<div class="sales-payment-summary-row"><span>Vuelto</span><strong id="sales-payment-change">' + app.formatMoney(change) + '</strong></div>' +
    '</div>' +
    '</div>' +
    '<div class="modal-footer sales-payment-modal-footer">' +
    '<button class="btn btn-secondary" type="button" onclick="closeSalesPaymentModal()">Cancelar</button>' +
    '<button class="btn btn-success" type="button" onclick="confirmSaleFromPaymentModal()"' + (registeredPayments.length === 0 ? ' disabled' : '') + '>Confirmar Venta</button>' +
    '</div>' +
    '</div>' +
    '</div>';
}

function updateSalesCustomerLookupSearch(value) {
  salesUiState.customerLookupSearch = String(value || '');
  salesUiState.customerLookupPage = 1;
  renderSalesCustomerLookupModal();
}

function changeSalesCustomerLookupPage(page) {
  const filtered = getSalesCustomerLookupFiltered();
  const totalPages = Math.max(1, Math.ceil(filtered.length / 10));
  salesUiState.customerLookupPage = Math.max(1, Math.min(totalPages, Number(page) || 1));
  renderSalesCustomerLookupModal();
}

function selectSaleCustomerFromModal(customerId) {
  selectSaleCustomer(customerId);
  closeSalesCustomerLookup();
  focusSaleItemSearch();
}

function searchSaleCustomerByCode() {
  const input = document.getElementById('sale-customer-code');
  const rawValue = String((input && input.value) || '').trim();
  if (!rawValue) {
    openSalesCustomerLookup('');
    return;
  }

  const normalizedDigits = rawValue.replace(/\D/g, '');
  const exactMatch = customersForSale.find((customer) => {
    const code = getSalesCustomerCodeLabel(customer);
    return code === rawValue || (normalizedDigits && code === normalizedDigits);
  });

  if (exactMatch) {
    selectSaleCustomer(exactMatch.id);
    focusSaleItemSearch();
    return;
  }

  openSalesCustomerLookup(rawValue);
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
  const selectedPriceList = salesGetSelectedPriceList();
  const priceMap = salesBuildProductPriceMap(product);
  const includesTaxMap = salesBuildProductIncludesTaxMap(product);
  const selectedPrice = salesGetMappedPriceByList(priceMap);
  if (existing) {
    if (existing.quantity < Number(product.stock)) existing.quantity += 1;
  } else {
    cart.push({
      product_id: product.id,
      code: product.sku || ('ART-' + product.id),
      name: product.name,
      price: selectedPrice,
      quantity: 1,
      discount: 0,
      price_list: selectedPriceList,
      price_manual: false,
      price_by_list: priceMap,
      price_includes_tax_by_list: includesTaxMap,
      price_includes_tax: salesGetMappedIncludesTaxByList(includesTaxMap)
    });
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
  item.price_manual = true;
  renderCart();
}

function handleSalePriceListChange() {
  const selectedPriceList = salesGetSelectedPriceList();
  const selectedPriceListKey = salesGetSelectedPriceListKey();
  salesUiState.invoiceDraft.priceList = selectedPriceList;
  cart.forEach((item) => {
    if (item.price_manual) return;
    const product = getProductById(item.product_id);
    if (product) {
      item.price_by_list = salesBuildProductPriceMap(product);
      item.price_includes_tax_by_list = salesBuildProductIncludesTaxMap(product);
    }
    item.price = salesGetMappedPriceByList(item.price_by_list, selectedPriceListKey);
    item.price_includes_tax = salesGetMappedIncludesTaxByList(item.price_includes_tax_by_list, selectedPriceListKey);
    item.price_list = selectedPriceList;
  });
  filterPosProducts();
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

function updateGlobalSaleDiscount(newDiscount) {
  const discount = app.parseLocaleNumber(newDiscount, 0);
  if (!Number.isFinite(discount) || discount < 0 || discount > 100) {
    alert('El descuento debe estar entre 0 y 100');
    renderCart();
    return;
  }
  salesUiState.invoiceDraft.globalDiscount = discount.toFixed(2);
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
    const priceListSelect = document.getElementById('sale-price-list');
    const customerPriceList = customer.price_list ? `Lista ${customer.price_list}` : '';
    if (priceListSelect && customerPriceList && SALES_PRICE_LISTS.includes(customerPriceList)) {
      priceListSelect.value = customerPriceList;
    }
    salesUiState.invoiceDraft.customerId = String(customer.id || '');
    salesUiState.invoiceDraft.taxId = customer.tax_id || '';
    salesUiState.invoiceDraft.address = buildSaleCustomerAddress(customer);
    salesUiState.invoiceDraft.ivaCondition = normalizeSaleCustomerIvaCondition(customer.iva_condition);
    if (customerPriceList && SALES_PRICE_LISTS.includes(customerPriceList)) {
      salesUiState.invoiceDraft.priceList = customerPriceList;
      handleSalePriceListChange();
    }
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

  const globalDiscount = Math.max(0, Math.min(100, Number(salesUiState.invoiceDraft.globalDiscount) || 0));
  if (globalDiscountEl) globalDiscountEl.textContent = app.formatDecimalInputValue(globalDiscount, 2) + '%';
  if (globalDiscountInput && document.activeElement !== globalDiscountInput) {
    globalDiscountInput.value = app.formatDecimalInputValue(globalDiscount, 2);
  }
}

function cancelSale(clearBanner = true) {
  if (cart.length > 0 && !confirm('Seguro que desea limpiar el comprobante actual?')) return;

  cart = [];
  salesUiState.invoiceDraft = createDefaultSalesDraft();
  salesUiState.paymentModal = {
    isOpen: false,
    selectedMethod: '',
    registeredPayments: [],
    totalAmount: 0
  };

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

  if (syncBanner && clearBanner) {
    syncBanner.innerHTML = '';
    syncBanner.className = '';
  }

  handleSaleCustomerChange();
  renderCart();
  refreshSaleDocumentPreview();
}

async function confirmSaleFromPaymentModal() {
  const registeredPayments = salesUiState.paymentModal.registeredPayments || [];
  if (registeredPayments.length === 0) {
    alert('Debes registrar una forma de pago');
    return;
  }

  const paymentMethod = registeredPayments[0].method || salesUiState.paymentModal.selectedMethod || 'cash';
  const paymentInput = document.getElementById('sale-payment');
  if (paymentInput) paymentInput.value = paymentMethod;
  closeSalesPaymentModal();
  await processSale(paymentMethod, registeredPayments);
}

async function processSale(selectedPaymentMethod = null, registeredPayments = []) {
  if (cart.length === 0) {
    alert('Debes agregar al menos un articulo');
    return;
  }

  const customer = getSelectedCustomer();
  const paymentMethod = selectedPaymentMethod || (document.getElementById('sale-payment') || {}).value || 'cash';
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
      registeredPayments: registeredPayments.map((payment) => ({ ...payment })),
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
  receiptHtml += '<p>Pago: ' + salesEscapeHtml(salesGetPaymentMethodLabel(paymentMethod)) + '</p>';
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
  receiptText += 'Pago: ' + salesGetPaymentMethodLabel(paymentMethod) + '\n';
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
