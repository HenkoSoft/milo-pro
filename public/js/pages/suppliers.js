window.suppliersState = {
  all: [],
  currentPage: 1,
  perPage: 10
};

function suppliersEscapeHtml(value) {
  if (window.app && typeof window.app.escapeHtml === 'function') {
    return window.app.escapeHtml(value);
  }

  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function suppliersEscapeAttr(value) {
  if (window.app && typeof window.app.escapeAttr === 'function') {
    return window.app.escapeAttr(value);
  }

  return suppliersEscapeHtml(value).replace(/`/g, '&#96;');
}

window.getFilteredSuppliers = function getFilteredSuppliers() {
  const searchInput = document.getElementById('supplier-search');
  const search = (searchInput ? searchInput.value : '').trim().toLowerCase();

  return window.suppliersState.all.filter((supplier) => {
    const name = String(supplier.name || '').toLowerCase();
    const phone = String(supplier.phone || '').toLowerCase();
    const email = String(supplier.email || '').toLowerCase();
    const taxId = String(supplier.tax_id || '').toLowerCase();

    return !search ||
      name.includes(search) ||
      phone.includes(search) ||
      email.includes(search) ||
      taxId.includes(search);
  });
};

window.renderSuppliersTable = function renderSuppliersTable() {
  const filtered = window.getFilteredSuppliers();
  const totalRecords = filtered.length;
  const totalPages = Math.max(1, Math.ceil(totalRecords / window.suppliersState.perPage));

  if (window.suppliersState.currentPage > totalPages) {
    window.suppliersState.currentPage = totalPages;
  }

  const start = totalRecords === 0 ? 0 : (window.suppliersState.currentPage - 1) * window.suppliersState.perPage;
  const end = Math.min(start + window.suppliersState.perPage, totalRecords);
  const pageItems = filtered.slice(start, end);

  return `
    <table class="products-table">
      <thead>
        <tr>
          <th>Codigo</th>
          <th>Razon Social</th>
          <th>Contacto</th>
          <th>Telefono</th>
          <th>CUIT</th>
          <th>Acciones</th>
        </tr>
      </thead>
      <tbody>
        ${pageItems.length === 0 ? `
          <tr>
            <td colspan="6" style="text-align:center;padding:32px;color:#64748b;">No hay proveedores para mostrar</td>
          </tr>
        ` : pageItems.map((supplier) => `
          <tr>
            <td>${supplier.id}</td>
            <td>${suppliersEscapeHtml(supplier.name)}</td>
            <td>${suppliersEscapeHtml(supplier.email || '')}</td>
            <td>${suppliersEscapeHtml(supplier.phone || '')}</td>
            <td>${suppliersEscapeHtml(supplier.tax_id || '')}</td>
            <td>
              <div class="btn-group">
                <button class="btn btn-action btn-edit" type="button" onclick="editSupplier(${supplier.id})">E</button>
                <button class="btn btn-action btn-delete" type="button" onclick="deleteSupplier(${supplier.id})">X</button>
              </div>
            </td>
          </tr>
        `).join('')}
      </tbody>
    </table>
    <div style="display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap;margin-top:16px;">
      <div class="table-footer" style="margin:0;">
        Mostrando ${totalRecords === 0 ? 0 : start + 1} a ${end} de ${totalRecords} registros
      </div>
      <div style="display:flex;align-items:center;gap:8px;">
        <button class="btn btn-secondary" type="button" onclick="changeSupplierPage(-1)" ${window.suppliersState.currentPage === 1 ? 'disabled' : ''}>Anterior</button>
        <button class="btn btn-primary" type="button">${window.suppliersState.currentPage}</button>
        <button class="btn btn-secondary" type="button" onclick="changeSupplierPage(1)" ${window.suppliersState.currentPage >= totalPages ? 'disabled' : ''}>Siguiente</button>
      </div>
    </div>
  `;
};

window.filterSuppliers = function filterSuppliers() {
  window.suppliersState.currentPage = 1;
  const container = document.getElementById('suppliers-table-container');
  if (container) {
    container.innerHTML = window.renderSuppliersTable();
  }
};

window.changeSupplierPage = function changeSupplierPage(direction) {
  const filtered = window.getFilteredSuppliers();
  const totalPages = Math.max(1, Math.ceil(filtered.length / window.suppliersState.perPage));
  window.suppliersState.currentPage = Math.min(totalPages, Math.max(1, window.suppliersState.currentPage + direction));

  const container = document.getElementById('suppliers-table-container');
  if (container) {
    container.innerHTML = window.renderSuppliersTable();
  }
};

window.showAddSupplierModal = function showAddSupplierModal() {
  app.showModal(`
    <div class="modal" style="max-width: 600px;">
      <div class="modal-header">
        <h3>Nuevo Proveedor</h3>
        <button type="button" class="btn-close" onclick="app.closeModal()">x</button>
      </div>
      <div class="modal-body">
        <div class="form-group">
          <label for="supplier-name">Razon Social *</label>
          <input type="text" id="supplier-name" required>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label for="supplier-phone">Telefono</label>
            <input type="text" id="supplier-phone">
          </div>
          <div class="form-group">
            <label for="supplier-email">Contacto</label>
            <input type="email" id="supplier-email">
          </div>
        </div>
        <div class="form-group">
          <label for="supplier-tax-id">CUIT</label>
          <input type="text" id="supplier-tax-id" placeholder="XX-XXXXXXXX-X">
        </div>
      </div>
      <div class="modal-footer">
        <button type="button" class="btn btn-secondary" onclick="app.closeModal()">Cancelar</button>
        <button type="button" class="btn btn-primary" onclick="saveSupplier()">Guardar</button>
      </div>
    </div>
  `);
};

window.saveSupplier = async function saveSupplier() {
  const name = document.getElementById('supplier-name').value.trim();
  if (!name) {
    alert('La razon social es obligatoria');
    return;
  }

  try {
    await api.purchases.createSupplier({
      name,
      phone: document.getElementById('supplier-phone').value.trim(),
      email: document.getElementById('supplier-email').value.trim(),
      tax_id: document.getElementById('supplier-tax-id').value.trim()
    });

    window.suppliersState.all = await api.purchases.getSuppliers();
    window.filterSuppliers();
    app.closeModal();
  } catch (error) {
    alert('Error: ' + error.message);
  }
};

window.editSupplier = function editSupplier(id) {
  const supplier = window.suppliersState.all.find((item) => item.id === id);
  if (!supplier) {
    return;
  }

  app.showModal(`
    <div class="modal" style="max-width: 600px;">
      <div class="modal-header">
        <h3>Editar Proveedor</h3>
        <button type="button" class="btn-close" onclick="app.closeModal()">x</button>
      </div>
      <div class="modal-body">
        <input type="hidden" id="edit-id" value="${supplier.id}">
        <div class="form-group">
          <label for="edit-name">Razon Social *</label>
          <input type="text" id="edit-name" value="${suppliersEscapeAttr(supplier.name)}" required>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label for="edit-phone">Telefono</label>
            <input type="text" id="edit-phone" value="${suppliersEscapeAttr(supplier.phone || '')}">
          </div>
          <div class="form-group">
            <label for="edit-email">Contacto</label>
            <input type="email" id="edit-email" value="${suppliersEscapeAttr(supplier.email || '')}">
          </div>
        </div>
        <div class="form-group">
          <label for="edit-tax-id">CUIT</label>
          <input type="text" id="edit-tax-id" value="${suppliersEscapeAttr(supplier.tax_id || '')}">
        </div>
      </div>
      <div class="modal-footer">
        <button type="button" class="btn btn-secondary" onclick="app.closeModal()">Cancelar</button>
        <button type="button" class="btn btn-primary" onclick="updateSupplier()">Guardar Cambios</button>
      </div>
    </div>
  `);
};

window.updateSupplier = async function updateSupplier() {
  const id = document.getElementById('edit-id').value;
  const name = document.getElementById('edit-name').value.trim();
  if (!name) {
    alert('La razon social es obligatoria');
    return;
  }

  try {
    await api.purchases.updateSupplier(id, {
      name,
      phone: document.getElementById('edit-phone').value.trim(),
      email: document.getElementById('edit-email').value.trim(),
      tax_id: document.getElementById('edit-tax-id').value.trim()
    });

    window.suppliersState.all = await api.purchases.getSuppliers();
    window.filterSuppliers();
    app.closeModal();
  } catch (error) {
    alert('Error: ' + error.message);
  }
};

window.deleteSupplier = async function deleteSupplier(id) {
  if (!confirm('Eliminar proveedor?')) {
    return;
  }

  try {
    await api.purchases.deleteSupplier(id);
    window.suppliersState.all = await api.purchases.getSuppliers();
    window.filterSuppliers();
  } catch (error) {
    alert('Error: ' + error.message);
  }
};

window.renderSuppliers = async function renderSuppliers() {
  const content = document.getElementById('page-content');
  if (!content) {
    return;
  }

  content.innerHTML = '<div class="loading">Cargando proveedores...</div>';

  try {
    window.suppliersState.all = await api.purchases.getSuppliers();
    window.suppliersState.currentPage = 1;

    content.innerHTML = `
      <div class="card">
        <div style="display:flex;justify-content:space-between;align-items:center;gap:16px;flex-wrap:wrap;margin-bottom:20px;">
          <h2 style="margin:0;">Listado de Proveedores</h2>
          <button class="btn btn-primary" type="button" onclick="showAddSupplierModal()">+ Nuevo Proveedor</button>
        </div>
        <div style="margin-bottom:16px;">
          <label for="supplier-search" style="display:block;font-weight:600;margin-bottom:6px;">Buscar:</label>
          <input type="text" id="supplier-search" placeholder="Ejemplo busqueda..." onkeyup="filterSuppliers()" style="width:100%;max-width:360px;padding:10px 12px;border:1px solid #d1d5db;border-radius:8px;">
        </div>
        <div id="suppliers-table-container"></div>
      </div>
    `;

    const container = document.getElementById('suppliers-table-container');
    if (container) {
      container.innerHTML = window.renderSuppliersTable();
    }
  } catch (error) {
    content.innerHTML = '<div class="alert alert-warning">Error al cargar proveedores: ' + suppliersEscapeHtml(error.message) + '</div>';
  }
};
