let creditsList = [];
let ncQuerySuppliersList = [];
let currentCreditPage = 1;
let creditsPerPage = 10;

async function renderNcQuery() {
  const content = document.getElementById('page-content');
  content.innerHTML = '<div class="loading">Cargando...</div>';
  
  try {
    ncQuerySuppliersList = await api.purchases.getSuppliers();
    creditsList = await api.purchases.getCredits();
    currentCreditPage = 1;
    
    content.innerHTML = `
      <div class="card">
        <h2 style="margin-bottom: 20px;">Consulta de Notas de Crédito</h2>
        <div style="margin-bottom: 15px; padding: 10px; background: #f1f5f9; border-radius: 6px; border-left: 4px solid #2563eb;">
          <strong>ℹ️ Instrucciones:</strong> Las notas de crédito se crean desde <em>N/C Proveedor (Carga)</em>. Aquí puede consultar y buscar las NC registradas.
        </div>
        <h3 style="margin: 20px 0 15px;">Listado de Notas de Crédito</h3>
        <div class="toolbar">
          <div class="search-box">
            <input type="text" id="credit-search" placeholder="Buscar..." onkeyup="filterCredits()">
          </div>
          <select id="credit-filter-supplier" class="form-control" style="min-width: 200px;" onchange="filterCredits()">
            <option value="">Todos los proveedores</option>
            ${ncQuerySuppliersList.map(s => `<option value="${s.id}">${s.name}</option>`).join('')}
          </select>
          <select id="credit-per-page" class="form-control" style="width: 80px;" onchange="changeCreditsPerPage()">
            <option value="10" selected>10</option>
            <option value="25">25</option>
            <option value="50">50</option>
            <option value="100">100</option>
          </select>
          <span style="margin-left: 10px;">Mostrar registros</span>
        </div>
        
        <div id="credits-table-container"></div>
      </div>
    `;
    
    document.getElementById('credits-table-container').innerHTML = renderCreditsTable();
    
  } catch (e) {
    content.innerHTML = '<div class="alert alert-warning">Error: ' + e.message + '</div>';
  }
}

function renderCreditsTable() {
  const filtered = getFilteredCredits();
  const start = (currentCreditPage - 1) * creditsPerPage;
  const end = start + creditsPerPage;
  const pageItems = filtered.slice(start, end);
  const totalPages = Math.ceil(filtered.length / creditsPerPage) || 1;
  
  if (filtered.length === 0) {
    return `
      <table class="products-table">
        <thead>
          <tr>
            <th>ID</th>
            <th>Número</th>
            <th>Fecha</th>
            <th>Proveedor</th>
            <th>Total</th>
            <th>Acciones</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td colspan="6" style="text-align: center; padding: 40px 20px; color: #64748b;">
              <div style="font-size: 48px; margin-bottom: 10px;">📄</div>
              <div style="font-size: 16px; font-weight: 600;">No hay notas de crédito para mostrar</div>
              <div style="font-size: 13px; margin-top: 5px;">Las NC se crean desde <em>N/C Proveedor (Carga)</em></div>
            </td>
          </tr>
        </tbody>
      </table>
      <div class="table-footer">
        Mostrando registros del 0 al 0 de un total de 0 registros
      </div>
    `;
  }
  
  return `
    <table class="products-table">
      <thead>
        <tr>
          <th>ID</th>
          <th>Número</th>
          <th>Fecha</th>
          <th>Proveedor</th>
          <th>Total</th>
          <th>Acciones</th>
        </tr>
      </thead>
      <tbody>
        ${pageItems.map(c => `
          <tr>
            <td>${c.id}</td>
            <td><span class="badge badge-purple">${c.credit_note_number || '-'}</span></td>
            <td>${c.invoice_date ? app.formatDate(c.invoice_date) : '-'}</td>
            <td>${c.supplier_name || '-'}</td>
            <td><strong style="color: #059669;">${app.formatMoney(c.total || 0)}</strong></td>
            <td>
              <div class="btn-group">
                <button class="btn btn-action btn-view" onclick="viewCredit(${c.id})" title="Ver">👁️</button>
                <button class="btn btn-action btn-delete" onclick="deleteCredit(${c.id})" title="Eliminar">❌</button>
              </div>
            </td>
          </tr>
        `).join('')}
      </tbody>
    </table>
    <div class="table-footer">
      <span>Mostrando registros del ${start + 1} al ${Math.min(end, filtered.length)} de un total de ${filtered.length} registros</span>
      <div class="pagination">
        <button class="btn btn-secondary btn-sm" onclick="changeCreditPage(${currentCreditPage - 1})" ${currentCreditPage === 1 ? 'disabled' : ''}>Anterior</button>
        <span style="padding: 0 10px;">Página ${currentCreditPage} de ${totalPages}</span>
        <button class="btn btn-secondary btn-sm" onclick="changeCreditPage(${currentCreditPage + 1})" ${currentCreditPage >= totalPages ? 'disabled' : ''}>Siguiente</button>
      </div>
    </div>
  `;
}

function getFilteredCredits() {
  const searchInput = document.getElementById('credit-search');
  const supplierSelect = document.getElementById('credit-filter-supplier');
  
  const search = searchInput ? searchInput.value.toLowerCase() : '';
  const supplierId = supplierSelect ? supplierSelect.value : '';
  
  return creditsList.filter(c => {
    const matchSearch = !search || 
      (c.supplier_name && c.supplier_name.toLowerCase().includes(search)) ||
      (c.credit_note_number && c.credit_note_number.toLowerCase().includes(search)) ||
      (c.reference_invoice && c.reference_invoice.toLowerCase().includes(search)) ||
      (c.id && c.id.toString().includes(search));
    
    const matchSupplier = !supplierId || c.supplier_id == supplierId;
    
    return matchSearch && matchSupplier;
  });
}

function filterCredits() {
  currentCreditPage = 1;
  const container = document.getElementById('credits-table-container');
  if (container) {
    container.innerHTML = renderCreditsTable();
  }
}

function changeCreditPage(page) {
  const filtered = getFilteredCredits();
  const totalPages = Math.ceil(filtered.length / creditsPerPage) || 1;
  
  if (page < 1 || page > totalPages) return;
  
  currentCreditPage = page;
  const container = document.getElementById('credits-table-container');
  if (container) {
    container.innerHTML = renderCreditsTable();
  }
}

function changeCreditsPerPage() {
  const perPageSelect = document.getElementById('credit-per-page');
  if (perPageSelect) {
    creditsPerPage = parseInt(perPageSelect.value);
  }
  currentCreditPage = 1;
  const container = document.getElementById('credits-table-container');
  if (container) {
    container.innerHTML = renderCreditsTable();
  }
}

async function viewCredit(id) {
  try {
    const credit = await api.purchases.getCredit(id);
    
    app.showModal(`
      <div class="modal" style="max-width: 800px;">
        <div class="modal-header">
          <h3>Detalle de Nota de Crédito #${credit.id}</h3>
          <button type="button" class="btn-close" onclick="app.closeModal()">×</button>
        </div>
        <div class="modal-body">
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-bottom: 20px;">
            <div>
              <strong>Proveedor:</strong> ${credit.supplier_name || '-'}
            </div>
            <div>
              <strong>Fecha:</strong> ${credit.invoice_date ? app.formatDate(credit.invoice_date) : '-'}
            </div>
            <div>
              <strong>Número NC:</strong> ${credit.credit_note_number || '-'}
            </div>
            <div>
              <strong>Ref. Factura:</strong> ${credit.reference_invoice || '-'}
            </div>
          </div>
          
          <table class="products-table">
            <thead>
              <tr>
                <th>Código</th>
                <th>Producto</th>
                <th>Cantidad</th>
                <th>Precio</th>
                <th>Subtotal</th>
              </tr>
            </thead>
            <tbody>
              ${(credit.items || []).map(item => `
                <tr>
                  <td>${item.product_code || '-'}</td>
                  <td>${item.product_name || '-'}</td>
                  <td>${item.quantity || 0}</td>
                  <td>${app.formatMoney(item.unit_price || 0)}</td>
                  <td>${app.formatMoney(item.subtotal || 0)}</td>
                </tr>
              `).join('')}
            </tbody>
            <tfoot>
              <tr>
                <td colspan="4" style="text-align: right;"><strong>Subtotal:</strong></td>
                <td>${app.formatMoney(credit.subtotal || 0)}</td>
              </tr>
              <tr>
                <td colspan="4" style="text-align: right;"><strong>IVA (21%):</strong></td>
                <td>${app.formatMoney(credit.iva || 0)}</td>
              </tr>
              <tr>
                <td colspan="4" style="text-align: right;"><strong>TOTAL:</strong></td>
                <td><strong style="color: #059669;">${app.formatMoney(credit.total || 0)}</strong></td>
              </tr>
            </tfoot>
          </table>
          
          ${credit.notes ? `<div style="margin-top: 15px;"><strong>Observaciones:</strong><p>${credit.notes}</p></div>` : ''}
        </div>
        <div class="modal-footer">
          <button type="button" class="btn btn-secondary" onclick="app.closeModal()">Cerrar</button>
        </div>
      </div>
    `);
    
  } catch (e) {
    alert('Error al cargar: ' + e.message);
  }
}

async function deleteCredit(id) {
  if (!confirm('¿Está seguro de que desea ELIMINAR esta Nota de Crédito?\n\nEsta acción:\n- Eliminará la NC\n- Repondrá el stock de los productos\n\n¿Continuar?')) return;
  
  try {
    await api.purchases.deleteCredit(id);
    creditsList = await api.purchases.getCredits();
    const container = document.getElementById('credits-table-container');
    if (container) {
      container.innerHTML = renderCreditsTable();
    }
    alert('Nota de Crédito eliminada exitosamente');
  } catch (e) {
    alert('Error al eliminar: ' + e.message);
  }
}

console.log('NC Query loaded');
