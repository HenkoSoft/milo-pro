let suppliersAccountList = [];
let currentSupplierPage = 1;
let suppliersPerPage = 10;

async function renderSupplierPayments() {
  const content = document.getElementById('page-content');
  content.innerHTML = '<div class="loading">Cargando...</div>';
  
  try {
    suppliersAccountList = await api.purchases.getSupplierAccount();
    currentSupplierPage = 1;
    
    content.innerHTML = `
      <div class="card">
        <h2 style="margin-bottom: 20px;">Gestión de Pagos a Proveedores</h2>
        <div style="margin-bottom: 15px; padding: 10px; background: #f1f5f9; border-radius: 6px; border-left: 4px solid #2563eb;">
          <strong>ℹ️ Instrucciones:</strong> Los proveedores aparecen automáticamente al registrar compras o N/C. Aquí puede consultar saldos y registrar pagos.
        </div>
        <div class="toolbar">
          <div class="search-box">
            <input type="text" id="supplier-search" placeholder="Buscar..." onkeyup="filterSuppliers()">
          </div>
          <select id="supplier-per-page" class="form-control" style="width: 80px;" onchange="changeSuppliersPerPage()">
            <option value="10" selected>10</option>
            <option value="25">25</option>
            <option value="50">50</option>
            <option value="100">100</option>
          </select>
          <span style="margin-left: 10px;">Mostrar registros</span>
        </div>
        
        <h3 style="margin: 30px 0 20px;">Listado de Proveedores - Cta. Cte.</h3>
        
        <div id="suppliers-table-container"></div>
      </div>
    `;
    
    document.getElementById('suppliers-table-container').innerHTML = renderSuppliersTable();
    
  } catch (e) {
    content.innerHTML = '<div class="alert alert-warning">Error: ' + e.message + '</div>';
  }
}

function renderSuppliersTable() {
  const filtered = getFilteredSuppliers();
  const start = (currentSupplierPage - 1) * suppliersPerPage;
  const end = start + suppliersPerPage;
  const pageItems = filtered.slice(start, end);
  const totalPages = Math.ceil(filtered.length / suppliersPerPage) || 1;
  
  if (filtered.length === 0) {
    return `
      <table class="products-table">
        <thead>
          <tr>
            <th>Código</th>
            <th>Nombre</th>
            <th>Saldo</th>
            <th>Acciones</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td colspan="4" style="text-align: center; padding: 40px 20px; color: #64748b;">
              <div style="font-size: 48px; margin-bottom: 10px;">👤</div>
              <div style="font-size: 16px; font-weight: 600;">No hay proveedores para mostrar</div>
              <div style="font-size: 13px; margin-top: 5px;">Los proveedores se crean al registrar una compra o N/C</div>
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
          <th>Código</th>
          <th>Nombre</th>
          <th>Saldo</th>
          <th>Acciones</th>
        </tr>
      </thead>
      <tbody>
        ${pageItems.map(s => `
          <tr>
            <td>${s.tax_id || s.id}</td>
            <td>${s.name}</td>
            <td>
              <strong class="${(s.balance || 0) >= 0 ? 'text-danger' : 'text-success'}">
                ${app.formatMoney(Math.abs(s.balance || 0))}
                ${(s.balance || 0) >= 0 ? ' A DEBER' : ' A FAVOR'}
              </strong>
            </td>
            <td>
              <div class="btn-group">
                <button class="btn btn-primary btn-sm" onclick="showSupplierAccount(${s.id})" title="Ver Cta. Cte.">📊</button>
                <button class="btn btn-success btn-sm" onclick="showPaymentModal(${s.id}, '${s.name}', ${s.balance || 0})" title="Registrar Pago">💰</button>
              </div>
            </td>
          </tr>
        `).join('')}
      </tbody>
    </table>
    <div class="table-footer">
      <span>Mostrando registros del ${start + 1} al ${Math.min(end, filtered.length)} de un total de ${filtered.length} registros</span>
      <div class="pagination">
        <button class="btn btn-secondary btn-sm" onclick="changeSupplierPage(${currentSupplierPage - 1})" ${currentSupplierPage === 1 ? 'disabled' : ''}>Anterior</button>
        <span style="padding: 0 10px;">Página ${currentSupplierPage} de ${totalPages}</span>
        <button class="btn btn-secondary btn-sm" onclick="changeSupplierPage(${currentSupplierPage + 1})" ${currentSupplierPage >= totalPages ? 'disabled' : ''}>Siguiente</button>
      </div>
    </div>
  `;
}

function getFilteredSuppliers() {
  const searchInput = document.getElementById('supplier-search');
  const search = searchInput ? searchInput.value.toLowerCase() : '';
  
  return suppliersAccountList.filter(s => {
    return !search || 
      (s.name && s.name.toLowerCase().includes(search)) ||
      (s.tax_id && s.tax_id.toLowerCase().includes(search)) ||
      (s.id && s.id.toString().includes(search));
  });
}

function filterSuppliers() {
  currentSupplierPage = 1;
  const container = document.getElementById('suppliers-table-container');
  if (container) {
    container.innerHTML = renderSuppliersTable();
  }
}

function changeSupplierPage(page) {
  const filtered = getFilteredSuppliers();
  const totalPages = Math.ceil(filtered.length / suppliersPerPage) || 1;
  
  if (page < 1 || page > totalPages) return;
  
  currentSupplierPage = page;
  const container = document.getElementById('suppliers-table-container');
  if (container) {
    container.innerHTML = renderSuppliersTable();
  }
}

function changeSuppliersPerPage() {
  const perPageSelect = document.getElementById('supplier-per-page');
  if (perPageSelect) {
    suppliersPerPage = parseInt(perPageSelect.value);
  }
  currentSupplierPage = 1;
  const container = document.getElementById('suppliers-table-container');
  if (container) {
    container.innerHTML = renderSuppliersTable();
  }
}

async function showSupplierAccount(supplierId) {
  try {
    const data = await api.purchases.getSupplierAccountDetail(supplierId);
    const s = data.supplier;
    const movements = data.movements;
    
    app.showModal(`
      <div class="modal" style="max-width: 900px;">
        <div class="modal-header">
          <h3>Cta. Cte. - ${s.name}</h3>
          <button type="button" class="btn-close" onclick="app.closeModal()">×</button>
        </div>
        <div class="modal-body">
          <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 15px; margin-bottom: 20px;">
            <div class="stat-card">
              <div class="stat-label">Total Compras</div>
              <div class="stat-value" style="color: #2563eb;">${app.formatMoney(s.total_purchases || 0)}</div>
            </div>
            <div class="stat-card">
              <div class="stat-label">Total NC</div>
              <div class="stat-value" style="color: #8b5cf6;">${app.formatMoney(s.total_credits || 0)}</div>
            </div>
            <div class="stat-card">
              <div class="stat-label">Total Pagos</div>
              <div class="stat-value" style="color: #059669;">${app.formatMoney(s.total_payments || 0)}</div>
            </div>
            <div class="stat-card">
              <div class="stat-label">Saldo</div>
              <div class="stat-value" style="color: ${(s.balance || 0) >= 0 ? '#dc2626' : '#059669'};">
                ${app.formatMoney(Math.abs(s.balance || 0))}
                ${(s.balance || 0) >= 0 ? ' A DEBER' : ' A FAVOR'}
              </div>
            </div>
          </div>
          
          <h4 style="margin-bottom: 15px;">Movimientos</h4>
          <table class="products-table">
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Tipo</th>
                <th>Referencia</th>
                <th>Descripción</th>
                <th>Débito</th>
                <th>Crédito</th>
                <th>Saldo</th>
              </tr>
            </thead>
            <tbody>
              ${movements.length === 0 ? '<tr><td colspan="7" style="text-align: center;">Sin movimientos</td></tr>' : ''}
              ${movements.map(m => `
                <tr>
                  <td>${m.created_at ? app.formatDateTime(m.created_at) : '-'}</td>
                  <td>
                    <span class="badge ${m.type === 'purchase' ? 'badge-blue' : m.type === 'credit' ? 'badge-purple' : 'badge-green'}">
                      ${m.type === 'purchase' ? 'Compra' : m.type === 'credit' ? 'NC' : 'Pago'}
                    </span>
                  </td>
                  <td>${m.reference_number || '-'}</td>
                  <td>${m.description || '-'}</td>
                  <td>${m.debit ? app.formatMoney(m.debit) : '-'}</td>
                  <td>${m.credit ? app.formatMoney(m.credit) : '-'}</td>
                  <td><strong>${app.formatMoney(m.balance || 0)}</strong></td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
        <div class="modal-footer">
          <button type="button" class="btn btn-secondary" onclick="app.closeModal()">Cerrar</button>
          <button type="button" class="btn btn-success" onclick="app.closeModal(); showPaymentModal(${s.id}, '${s.name}', ${s.balance || 0})">Registrar Pago</button>
        </div>
      </div>
    `);
    
  } catch (e) {
    alert('Error al cargar: ' + e.message);
  }
}

function showPaymentModal(supplierId, supplierName, currentBalance) {
  const today = new Date().toISOString().split('T')[0];
  
  app.showModal(`
    <div class="modal">
      <div class="modal-header">
        <h3>Registrar Pago - ${supplierName}</h3>
        <button type="button" class="btn-close" onclick="app.closeModal()">×</button>
      </div>
      <div class="modal-body">
        ${currentBalance < 0 ? `
          <div class="alert alert-warning" style="margin-bottom: 15px;">
            <strong>Nota:</strong> Este proveedor tiene un saldo a favor de ${app.formatMoney(Math.abs(currentBalance))}. El pago registrado se descontará de este saldo.
          </div>
        ` : `
          <div class="alert alert-warning" style="margin-bottom: 15px;">
            <strong>Saldo actual:</strong> ${app.formatMoney(Math.abs(currentBalance))} ${currentBalance >= 0 ? 'A DEBER' : 'A FAVOR'}
          </div>
        `}
        
        <div class="form-group">
          <label>Monto a Pagar *</label>
          <input type="number" id="payment-amount" class="form-control" step="0.01" min="0.01" placeholder="0.00">
        </div>
        
        <div class="form-group">
          <label>Método de Pago</label>
          <select id="payment-method" class="form-control">
            <option value="cash">Efectivo</option>
            <option value="transfer">Transferencia Bancaria</option>
            <option value="check">Cheque</option>
            <option value="debit">Tarjeta de Débito</option>
            <option value="credit">Tarjeta de Crédito</option>
          </select>
        </div>
        
        <div class="form-group">
          <label>Referencia / Nro. Comprobante</label>
          <input type="text" id="payment-reference" class="form-control" placeholder="Nro. de comprobante o referencia">
        </div>
        
        <div class="form-group">
          <label>Observaciones</label>
          <textarea id="payment-notes" class="form-control" rows="2" placeholder="Observaciones..."></textarea>
        </div>
      </div>
      <div class="modal-footer">
        <button type="button" class="btn btn-secondary" onclick="app.closeModal()">Cancelar</button>
        <button type="button" class="btn btn-success" onclick="savePayment(${supplierId})">Guardar Pago</button>
      </div>
    </div>
  `);
}

async function savePayment(supplierId) {
  const amount = parseFloat(document.getElementById('payment-amount').value);
  const paymentMethod = document.getElementById('payment-method').value;
  const reference = document.getElementById('payment-reference').value;
  const notes = document.getElementById('payment-notes').value;
  
  if (!amount || amount <= 0) {
    alert('Ingrese un monto válido');
    return;
  }
  
  try {
    await api.purchases.createSupplierPayment({
      supplier_id: supplierId,
      amount: amount,
      payment_method: paymentMethod,
      reference: reference,
      notes: notes
    });
    
    app.closeModal();
    suppliersAccountList = await api.purchases.getSupplierAccount();
    document.getElementById('suppliers-table-container').innerHTML = renderSuppliersTable();
    alert('Pago registrado exitosamente');
    
  } catch (e) {
    alert('Error al registrar pago: ' + e.message);
  }
}

console.log('Supplier Payments loaded');
