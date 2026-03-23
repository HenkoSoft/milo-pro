let customersData = [];

async function renderCustomers() {
  const content = document.getElementById('page-content');
  content.innerHTML = '<div class="loading">Cargando...</div>';
  
  try {
    customersData = await api.customers.getAll({});
    renderCustomersTable(customersData);
    
    content.innerHTML = 
      '<div class="card">' +
      '<div class="card-header">' +
      '<h3 class="card-title">Gestión de Clientes</h3>' +
      '<button class="btn btn-primary" onclick="showCustomerModal()">+ Nuevo Cliente</button>' +
      '</div>' +
      '<div class="toolbar">' +
      '<div class="search-box"><input type="text" id="customer-search" placeholder="Buscar cliente..." oninput="filterCustomers()"></div>' +
      '<button class="btn btn-warning" onclick="renderCustomers()">Actualizar</button>' +
      '</div>' +
      '<div class="table-container"><table><thead><tr><th>Nombre</th><th>Teléfono</th><th>Email</th><th>Dirección</th><th>Acciones</th></tr></thead><tbody id="customers-table"></tbody></table></div>' +
      '</div>' +
      getCustomerModalHtml();
    
    filterCustomers();
  } catch (e) {
    content.innerHTML = '<div class="alert alert-warning">Error: ' + e.message + '</div>';
  }
}

function renderCustomersTable(customers) {
  const tbody = document.getElementById('customers-table');
  if (!tbody) return;
  tbody.innerHTML = customers.map(c => 
    '<tr>' +
    '<td>' + app.escapeHtml(c.name) + '</td>' +
    '<td>' + app.escapeHtml(c.phone || '-') + '</td>' +
    '<td>' + app.escapeHtml(c.email || '-') + '</td>' +
    '<td>' + app.escapeHtml(c.address || '-') + '</td>' +
    '<td><div class="btn-group">' +
    '<button class="btn btn-sm btn-secondary" onclick="editCustomer(' + c.id + ')">Editar</button>' +
    '<button class="btn btn-sm btn-danger" onclick="deleteCustomer(' + c.id + ')">Eliminar</button>' +
    '</div></td></tr>'
  ).join('');
}

function getCustomerModalHtml() {
  return '<div id="customer-modal" style="display:none;">' +
  '<div class="modal">' +
  '<div class="modal-header"><h3 id="customer-modal-title">Nuevo Cliente</h3><button class="modal-close" onclick="closeCustomerModal()">&times;</button></div>' +
  '<div class="modal-body">' +
  '<form id="customer-form">' +
  '<input type="hidden" id="customer-id">' +
  '<div class="form-group"><label>Nombre</label><input type="text" id="customer-name" required></div>' +
  '<div class="form-row"><div class="form-group"><label>Teléfono</label><input type="tel" id="customer-phone"></div>' +
  '<div class="form-group"><label>Email</label><input type="email" id="customer-email"></div></div>' +
  '<div class="form-group"><label>Dirección</label><input type="text" id="customer-address"></div>' +
  '<div class="form-group"><label>Notas</label><textarea id="customer-notes" rows="3"></textarea></div>' +
  '</form></div>' +
  '<div class="modal-footer"><button class="btn btn-secondary" onclick="closeCustomerModal()">Cancelar</button><button class="btn btn-primary" onclick="saveCustomer()">Guardar</button></div>' +
  '</div></div>';
}

function filterCustomers() {
  const search = (document.getElementById('customer-search') || {}).value || '';
  const filtered = customersData.filter(c => 
    c.name.toLowerCase().includes(search.toLowerCase()) || 
    (c.phone && c.phone.includes(search)) ||
    (c.email && c.email.toLowerCase().includes(search.toLowerCase()))
  );
  renderCustomersTable(filtered);
}

function showCustomerModal(customer) {
  document.getElementById('customer-modal').style.display = 'block';
  document.getElementById('customer-modal-title').textContent = customer ? 'Editar Cliente' : 'Nuevo Cliente';
  if (customer) {
    document.getElementById('customer-id').value = customer.id;
    document.getElementById('customer-name').value = customer.name;
    document.getElementById('customer-phone').value = customer.phone || '';
    document.getElementById('customer-email').value = customer.email || '';
    document.getElementById('customer-address').value = customer.address || '';
    document.getElementById('customer-notes').value = customer.notes || '';
  } else {
    document.getElementById('customer-form').reset();
    document.getElementById('customer-id').value = '';
  }
}

function closeCustomerModal() {
  document.getElementById('customer-modal').style.display = 'none';
}

function editCustomer(id) {
  const customer = customersData.find(c => c.id === id);
  if (customer) showCustomerModal(customer);
}

async function saveCustomer() {
  const id = document.getElementById('customer-id').value;
  const data = {
    name: document.getElementById('customer-name').value,
    phone: document.getElementById('customer-phone').value,
    email: document.getElementById('customer-email').value,
    address: document.getElementById('customer-address').value,
    notes: document.getElementById('customer-notes').value
  };
  try {
    if (id) await api.customers.update(id, data);
    else await api.customers.create(data);
    closeCustomerModal();
    renderCustomers();
  } catch (e) { alert(e.message); }
}

async function deleteCustomer(id) {
  if (!confirm('Eliminar cliente?')) return;
  try {
    await api.customers.delete(id);
    renderCustomers();
  } catch (e) { alert(e.message); }
}

console.log('Customers loaded');
