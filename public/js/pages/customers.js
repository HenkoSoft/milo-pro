let customersData = [];

const CUSTOMER_PROVINCES = [
  'Buenos Aires',
  'CABA',
  'Catamarca',
  'Chaco',
  'Chubut',
  'Cordoba',
  'Corrientes',
  'Entre Rios',
  'Jujuy',
  'La Pampa',
  'La Rioja',
  'Mendoza',
  'Misiones',
  'Neuquen',
  'Rio Negro',
  'Salta',
  'San Juan',
  'San Luis',
  'Santa Cruz',
  'Santa Fe',
  'Santiago del Estero',
  'Tierra del Fuego',
  'Tucuman'
];

const CUSTOMER_COUNTRIES = [
  'Argentina',
  'Brasil',
  'Chile',
  'Paraguay',
  'Uruguay'
];

const CUSTOMER_IVA_CONDITIONS = [
  'Consumidor Final',
  'Responsable Inscripto',
  'Monotributista',
  'Exento'
];

const CUSTOMER_TRANSPORTS = [
  'Retira en local',
  'Correo Argentino',
  'Andreani',
  'OCA',
  'Transporte propio'
];

const CUSTOMER_ZONES = [
  'Zona 1',
  'Zona 2',
  'Zona 3',
  'Interior',
  'Mayorista'
];

const CUSTOMER_SELLERS = [
  'Caja principal',
  'Vendedor 1',
  'Vendedor 2',
  'Online'
];

function customerEscapeHtml(value) {
  const safeValue = value === undefined || value === null || value === false ? '' : value;
  return app.escapeHtml(safeValue);
}

function customerEscapeAttr(value) {
  const safeValue = value === undefined || value === null || value === false ? '' : value;
  return app.escapeAttr(safeValue);
}

function renderCustomerOptions(options, selectedValue, placeholder) {
  const current = String(selectedValue || '');
  let html = '<option value="">' + customerEscapeHtml(placeholder) + '</option>';

  options.forEach((option) => {
    const selected = current === String(option) ? ' selected' : '';
    html += '<option value="' + customerEscapeAttr(option) + '"' + selected + '>' + customerEscapeHtml(option) + '</option>';
  });

  return html;
}

function renderCustomerPriceListOptions(selectedValue) {
  const current = String(selectedValue || '1');

  return ['1', '2', '3', '4'].map((value) => {
    const checked = current === value ? ' checked' : '';
    return '' +
      '<label class="customer-radio-card">' +
      '<input type="radio" name="customer-price-list" value="' + value + '"' + checked + '>' +
      '<span>Lista ' + value + '</span>' +
      '</label>';
  }).join('');
}

function getSelectedCustomerPriceList() {
  const selected = document.querySelector('input[name="customer-price-list"]:checked');
  return selected ? selected.value : '1';
}

async function renderCustomers() {
  const content = document.getElementById('page-content');
  content.innerHTML = '<div class="loading">Cargando...</div>';

  try {
    customersData = await api.customers.getAll({});
    renderCustomersTable(customersData);

    content.innerHTML =
      '<div class="card">' +
      '<div class="card-header">' +
      '<h3 class="card-title">Gestion de Clientes</h3>' +
      '<button class="btn btn-primary" type="button" onclick="showCustomerModal()">+ Nuevo Cliente</button>' +
      '</div>' +
      '<div class="toolbar">' +
      '<div class="search-box"><input type="text" id="customer-search" placeholder="Buscar cliente..." oninput="filterCustomers()"></div>' +
      '<button class="btn btn-warning" type="button" onclick="renderCustomers()">Actualizar</button>' +
      '</div>' +
      '<div class="table-container"><table><thead><tr><th>Nombre</th><th>Telefono</th><th>Email</th><th>CUIT</th><th>Direccion</th><th>Acciones</th></tr></thead><tbody id="customers-table"></tbody></table></div>' +
      '</div>';

    filterCustomers();
  } catch (e) {
    content.innerHTML = '<div class="alert alert-warning">Error: ' + e.message + '</div>';
  }
}

function renderCustomersTable(customers) {
  const tbody = document.getElementById('customers-table');
  if (!tbody) return;

  tbody.innerHTML = customers.map((customer) =>
    '<tr>' +
    '<td>' + customerEscapeHtml(customer.name) + '</td>' +
    '<td>' + customerEscapeHtml(customer.phone || '-') + '</td>' +
    '<td>' + customerEscapeHtml(customer.email || '-') + '</td>' +
    '<td>' + customerEscapeHtml(customer.tax_id || '-') + '</td>' +
    '<td>' + customerEscapeHtml(customer.address || '-') + '</td>' +
    '<td><div class="btn-group">' +
    '<button class="btn btn-sm btn-secondary" type="button" onclick="editCustomer(' + customer.id + ')">Editar</button>' +
    '<button class="btn btn-sm btn-danger" type="button" onclick="deleteCustomer(' + customer.id + ')">Eliminar</button>' +
    '</div></td></tr>'
  ).join('');
}

function getCustomerModalHtml(customer) {
  const isEditing = !!customer;
  const customerId = customer && customer.id ? String(customer.id) : '';
  const customerCode = customerId ? 'CL-' + customerId.padStart(4, '0') : 'Autogenerado';
  const ivaCondition = customer && customer.iva_condition ? customer.iva_condition : 'Consumidor Final';

  return '' +
    '<div class="modal customer-modal">' +
    '<div class="modal-header customer-modal-header">' +
    '<div>' +
    '<h3 id="customer-modal-title">' + (isEditing ? 'Editar Cliente' : 'Nuevo Cliente') + '</h3>' +
    '<p class="customer-modal-subtitle">Completa los datos principales, comerciales y observaciones del cliente.</p>' +
    '</div>' +
    '<button type="button" class="modal-close" onclick="closeCustomerModal()">&times;</button>' +
    '</div>' +
    '<form id="customer-form" class="customer-form" onsubmit="event.preventDefault(); saveCustomer()">' +
    '<input type="hidden" id="customer-id" value="' + customerEscapeAttr(customerId) + '">' +
    '<div class="customer-tabs" role="tablist" aria-label="Secciones del cliente">' +
    '<button type="button" class="customer-tab is-active" data-tab="datos" aria-selected="true" onclick="setCustomerTab(\'datos\')">Datos</button>' +
    '<button type="button" class="customer-tab" data-tab="facturacion" aria-selected="false" onclick="setCustomerTab(\'facturacion\')">Datos de Facturacion</button>' +
    '<button type="button" class="customer-tab" data-tab="observaciones" aria-selected="false" onclick="setCustomerTab(\'observaciones\')">Observaciones</button>' +
    '</div>' +
    '<div class="modal-body customer-modal-body">' +
    '<section class="customer-tab-panel is-active" data-panel="datos">' +
    '<div class="customer-form-grid">' +
    '<div class="form-group">' +
    '<label for="customer-code">Codigo</label>' +
    '<input type="text" id="customer-code" value="' + customerEscapeAttr(customerCode) + '" readonly>' +
    '</div>' +
    '<div class="form-group">' +
    '<label for="customer-name">R. Social</label>' +
    '<input type="text" id="customer-name" value="' + customerEscapeAttr(customer && customer.name) + '" required>' +
    '</div>' +
    '<div class="form-group">' +
    '<label for="customer-contact">Contacto</label>' +
    '<input type="text" id="customer-contact" value="' + customerEscapeAttr(customer && customer.contact) + '" placeholder="Nombre del contacto">' +
    '</div>' +
    '<div class="form-group customer-field-span-2">' +
    '<label for="customer-address">Direccion</label>' +
    '<input type="text" id="customer-address" value="' + customerEscapeAttr(customer && customer.address) + '" placeholder="Calle, numero y referencia">' +
    '</div>' +
    '<div class="form-group">' +
    '<label for="customer-city">Localidad</label>' +
    '<input type="text" id="customer-city" value="' + customerEscapeAttr(customer && customer.city) + '">' +
    '</div>' +
    '<div class="form-group">' +
    '<label for="customer-province">Provincia</label>' +
    '<div class="customer-input-combo">' +
    '<select id="customer-province">' +
    renderCustomerOptions(CUSTOMER_PROVINCES, customer && customer.province, 'Seleccionar provincia') +
    '</select>' +
    '<button type="button" class="customer-addon-button" onclick="showCustomerUiNotice(\'Alta de provincia\')">+</button>' +
    '</div>' +
    '</div>' +
    '<div class="form-group">' +
    '<label for="customer-country">Pais</label>' +
    '<div class="customer-input-combo">' +
    '<select id="customer-country">' +
    renderCustomerOptions(CUSTOMER_COUNTRIES, customer && customer.country, 'Seleccionar pais') +
    '</select>' +
    '<button type="button" class="customer-addon-button" onclick="showCustomerUiNotice(\'Alta de pais\')">+</button>' +
    '</div>' +
    '</div>' +
    '<div class="form-group">' +
    '<label for="customer-phone">Celular</label>' +
    '<input type="text" id="customer-phone" value="' + customerEscapeAttr(customer && customer.phone) + '" placeholder="+54 9 11...">' +
    '</div>' +
    '<div class="form-group">' +
    '<label for="customer-tax-id">DNI/CUIT</label>' +
    '<div class="customer-input-combo">' +
    '<input type="text" id="customer-tax-id" value="' + customerEscapeAttr(customer && customer.tax_id) + '" placeholder="Documento o CUIT">' +
    '<button type="button" class="customer-addon-button customer-addon-button--wide" onclick="showCustomerUiNotice(\'Busqueda de DNI/CUIT\')">Buscar</button>' +
    '</div>' +
    '</div>' +
    '<div class="form-group">' +
    '<label for="customer-iva-condition">Cond. IVA</label>' +
    '<select id="customer-iva-condition">' +
    renderCustomerOptions(CUSTOMER_IVA_CONDITIONS, ivaCondition, 'Seleccionar condicion') +
    '</select>' +
    '</div>' +
    '<div class="form-group">' +
    '<label for="customer-email">Mail</label>' +
    '<input type="email" id="customer-email" value="' + customerEscapeAttr(customer && customer.email) + '" placeholder="cliente@email.com">' +
    '</div>' +
    '<div class="form-group">' +
    '<label for="customer-instagram">Instagram</label>' +
    '<div class="customer-input-icon-wrap">' +
    '<input type="text" id="customer-instagram" value="' + customerEscapeAttr(customer && customer.instagram) + '" placeholder="@usuario">' +
    '<span class="customer-input-icon" aria-hidden="true">@</span>' +
    '</div>' +
    '</div>' +
    '</div>' +
    '</section>' +
    '<section class="customer-tab-panel" data-panel="facturacion">' +
    '<div class="customer-form-grid">' +
    '<div class="form-group">' +
    '<label for="customer-transport">Transporte</label>' +
    '<select id="customer-transport">' +
    renderCustomerOptions(CUSTOMER_TRANSPORTS, customer && customer.transport, 'Seleccionar transporte') +
    '</select>' +
    '</div>' +
    '<div class="form-group">' +
    '<label for="customer-credit-limit">Limite Cta Cte</label>' +
    '<input type="number" id="customer-credit-limit" min="0" step="0.01" value="' + customerEscapeAttr(customer && customer.credit_limit) + '" placeholder="0.00">' +
    '</div>' +
    '<div class="form-group">' +
    '<label for="customer-zone">Zona</label>' +
    '<select id="customer-zone">' +
    renderCustomerOptions(CUSTOMER_ZONES, customer && customer.zone, 'Seleccionar zona') +
    '</select>' +
    '</div>' +
    '<div class="form-group">' +
    '<label for="customer-discount"> % Descuento</label>' +
    '<input type="number" id="customer-discount" min="0" max="100" step="0.01" value="' + customerEscapeAttr(customer && customer.discount_percent) + '" placeholder="0.00">' +
    '</div>' +
    '<div class="form-group">' +
    '<label for="customer-seller">Vendedor</label>' +
    '<select id="customer-seller">' +
    renderCustomerOptions(CUSTOMER_SELLERS, customer && customer.seller, 'Seleccionar vendedor') +
    '</select>' +
    '</div>' +
    '<fieldset class="customer-fieldset customer-field-span-2">' +
    '<legend>Lista de Precios</legend>' +
    '<div class="customer-radio-group">' +
    renderCustomerPriceListOptions(customer && customer.price_list) +
    '</div>' +
    '</fieldset>' +
    '<div class="form-group customer-field-span-2">' +
    '<label for="customer-billing-conditions">Condiciones</label>' +
    '<textarea id="customer-billing-conditions" rows="6" placeholder="Condiciones comerciales, plazos y observaciones de facturacion.">' + customerEscapeHtml(customer && customer.billing_conditions) + '</textarea>' +
    '</div>' +
    '</div>' +
    '</section>' +
    '<section class="customer-tab-panel" data-panel="observaciones">' +
    '<div class="form-group customer-notes-group">' +
    '<label for="customer-notes">Observaciones</label>' +
    '<textarea id="customer-notes" rows="12" placeholder="Notas internas, preferencias del cliente o informacion adicional.">' + customerEscapeHtml(customer && customer.notes) + '</textarea>' +
    '</div>' +
    '</section>' +
    '</div>' +
    '<div class="modal-footer customer-modal-footer">' +
    '<button class="btn btn-secondary" type="button" onclick="closeCustomerModal()">Cancelar</button>' +
    '<button class="btn btn-success" type="submit">Guardar</button>' +
    '</div>' +
    '</form>' +
    '</div>';
}

function filterCustomers() {
  const search = (document.getElementById('customer-search') || {}).value || '';
  const normalized = search.toLowerCase();
  const filtered = customersData.filter((customer) =>
    customer.name.toLowerCase().includes(normalized) ||
    (customer.phone && customer.phone.includes(search)) ||
    (customer.email && customer.email.toLowerCase().includes(normalized)) ||
    (customer.tax_id && customer.tax_id.toLowerCase().includes(normalized))
  );

  renderCustomersTable(filtered);
}

function showCustomerModal(customer) {
  app.showModal(getCustomerModalHtml(customer));
  setCustomerTab('datos');

  const nameInput = document.getElementById('customer-name');
  if (nameInput) {
    nameInput.focus();
  }
}

function closeCustomerModal() {
  app.closeModal();
}

function setCustomerTab(tabName) {
  document.querySelectorAll('.customer-tab').forEach((tab) => {
    const isActive = tab.getAttribute('data-tab') === tabName;
    tab.classList.toggle('is-active', isActive);
    tab.setAttribute('aria-selected', isActive ? 'true' : 'false');
  });

  document.querySelectorAll('.customer-tab-panel').forEach((panel) => {
    panel.classList.toggle('is-active', panel.getAttribute('data-panel') === tabName);
  });
}

function showCustomerUiNotice(featureName) {
  alert(featureName + ' disponible proximamente. La logica actual del formulario no fue modificada.');
}

function editCustomer(id) {
  const customer = customersData.find((item) => item.id === id);
  if (customer) showCustomerModal(customer);
}

async function saveCustomer() {
  const id = document.getElementById('customer-id').value;
  const name = document.getElementById('customer-name').value.trim();

  if (!name) {
    alert('La razon social es obligatoria');
    setCustomerTab('datos');
    return;
  }

  const data = {
    name,
    contact: document.getElementById('customer-contact').value.trim(),
    city: document.getElementById('customer-city').value.trim(),
    province: document.getElementById('customer-province').value,
    country: document.getElementById('customer-country').value,
    phone: document.getElementById('customer-phone').value.trim(),
    tax_id: document.getElementById('customer-tax-id').value.trim(),
    iva_condition: document.getElementById('customer-iva-condition').value || 'Consumidor Final',
    email: document.getElementById('customer-email').value.trim(),
    instagram: document.getElementById('customer-instagram').value.trim(),
    address: document.getElementById('customer-address').value.trim(),
    transport: document.getElementById('customer-transport').value,
    credit_limit: document.getElementById('customer-credit-limit').value,
    zone: document.getElementById('customer-zone').value,
    discount_percent: document.getElementById('customer-discount').value,
    seller: document.getElementById('customer-seller').value,
    price_list: getSelectedCustomerPriceList(),
    billing_conditions: document.getElementById('customer-billing-conditions').value.trim(),
    notes: document.getElementById('customer-notes').value.trim()
  };

  try {
    if (id) await api.customers.update(id, data);
    else await api.customers.create(data);

    closeCustomerModal();
    renderCustomers();
  } catch (e) {
    alert(e.message);
  }
}

async function deleteCustomer(id) {
  if (!confirm('Eliminar cliente?')) return;

  try {
    await api.customers.delete(id);
    renderCustomers();
  } catch (e) {
    alert(e.message);
  }
}

console.log('Customers loaded');
