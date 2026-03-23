let purchasesList = [];
let purchaseSuppliersList = [];
let currentPurchasePage = 1;
let purchasesPerPage = 10;

function getPurchaseIvaLabel(invoiceType) {
  return invoiceType === 'FX' ? 'IVA (0%)' : 'IVA (21%)';
}

function normalizePurchaseForDisplay(purchase) {
  if (!purchase) {
    return purchase;
  }

  if (purchase.invoice_type === 'FX') {
    const subtotal = Number(purchase.subtotal || 0);
    return {
      ...purchase,
      iva: 0,
      total: subtotal
    };
  }

  return purchase;
}

async function renderPurchaseQuery() {
  const content = document.getElementById('page-content');
  content.innerHTML = '<div class="loading">Cargando...</div>';
  
  try {
    purchaseSuppliersList = await api.purchases.getSuppliers();
    purchasesList = (await api.purchases.getAll()).map(normalizePurchaseForDisplay);
    currentPurchasePage = 1;
    
    content.innerHTML = `
      <div class="card">
        <h2 style="margin-bottom: 20px;">Listado de Compras</h2>
        <div style="margin-bottom: 15px; padding: 10px; background: #f1f5f9; border-radius: 6px; border-left: 4px solid #2563eb;">
          <strong>ℹ️ Instrucciones:</strong> Las compras se crean desde <em>Ingreso de Mercadería</em>. Aquí puede consultar y buscar las compras registradas.
        </div>
        <div class="toolbar">
          <div class="search-box">
            <input type="text" id="purchase-search" placeholder="Buscar..." onkeyup="filterPurchases()">
          </div>
          <select id="purchase-filter-supplier" class="form-control" style="min-width: 200px;" onchange="filterPurchases()">
            <option value="">Todos los proveedores</option>
            ${purchaseSuppliersList.map(s => `<option value="${s.id}">${s.name}</option>`).join('')}
          </select>
          <input type="date" id="purchase-filter-date-from" class="form-control" style="width: 150px;" onchange="filterPurchases()">
          <input type="date" id="purchase-filter-date-to" class="form-control" style="width: 150px;" onchange="filterPurchases()">
          <select id="purchase-per-page" class="form-control" style="width: 80px;" onchange="changePurchasesPerPage()">
            <option value="10" selected>10</option>
            <option value="25">25</option>
            <option value="50">50</option>
            <option value="100">100</option>
          </select>
          <span style="margin-left: 10px;">Mostrar registros</span>
        </div>
        
        <div id="purchases-table-container"></div>
      </div>
    `;
    
    document.getElementById('purchases-table-container').innerHTML = renderPurchasesTable();
    
  } catch (e) {
    content.innerHTML = '<div class="alert alert-warning">Error: ' + e.message + '</div>';
  }
}

function renderPurchasesTable() {
  const filtered = getFilteredPurchases();
  const start = (currentPurchasePage - 1) * purchasesPerPage;
  const end = start + purchasesPerPage;
  const pageItems = filtered.slice(start, end);
  const totalPages = Math.ceil(filtered.length / purchasesPerPage) || 1;
  
  if (filtered.length === 0) {
    return `
      <table class="products-table">
        <thead>
          <tr>
            <th>ID</th>
            <th>Fecha</th>
            <th>Proveedor</th>
            <th>Tipo</th>
            <th>Número</th>
            <th>Total</th>
            <th>Acciones</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td colspan="7" style="text-align: center; padding: 40px 20px; color: #64748b;">
              <div style="font-size: 48px; margin-bottom: 10px;">📦</div>
              <div style="font-size: 16px; font-weight: 600;">No hay compras para mostrar</div>
              <div style="font-size: 13px; margin-top: 5px;">Las compras se crean desde <em>Ingreso de Mercadería</em></div>
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
          <th>Fecha</th>
          <th>Proveedor</th>
          <th>Tipo</th>
          <th>Número</th>
          <th>Total</th>
          <th>Acciones</th>
        </tr>
      </thead>
      <tbody>
        ${pageItems.map(p => `
          <tr>
            <td>${p.id}</td>
            <td>${p.invoice_date ? app.formatDate(p.invoice_date) : '-'}</td>
            <td>${p.supplier_name || '-'}</td>
            <td><span class="badge badge-blue">${p.invoice_type || '-'}</span></td>
            <td>${p.invoice_number || '-'}</td>
            <td><strong>${app.formatMoney(p.total || 0)}</strong></td>
            <td>
              <div class="btn-group">
                <button class="btn btn-action btn-view" onclick="viewPurchase(${p.id})" title="Ver">👁️</button>
                <button class="btn btn-action btn-delete" onclick="deletePurchase(${p.id})" title="Anular">❌</button>
              </div>
            </td>
          </tr>
        `).join('')}
      </tbody>
    </table>
    <div class="table-footer">
      <span>Mostrando registros del ${start + 1} al ${Math.min(end, filtered.length)} de un total de ${filtered.length} registros</span>
      <div class="pagination">
        <button class="btn btn-secondary btn-sm" onclick="changePurchasePage(${currentPurchasePage - 1})" ${currentPurchasePage === 1 ? 'disabled' : ''}>Anterior</button>
        <span style="padding: 0 10px;">Página ${currentPurchasePage} de ${totalPages}</span>
        <button class="btn btn-secondary btn-sm" onclick="changePurchasePage(${currentPurchasePage + 1})" ${currentPurchasePage >= totalPages ? 'disabled' : ''}>Siguiente</button>
      </div>
    </div>
  `;
}

function getFilteredPurchases() {
  const searchInput = document.getElementById('purchase-search');
  const supplierSelect = document.getElementById('purchase-filter-supplier');
  
  const search = searchInput ? searchInput.value.toLowerCase() : '';
  const supplierId = supplierSelect ? supplierSelect.value : '';
  
  return purchasesList.filter(p => {
    const matchSearch = !search || 
      (p.supplier_name && p.supplier_name.toLowerCase().includes(search)) ||
      (p.invoice_number && p.invoice_number.toLowerCase().includes(search)) ||
      (p.invoice_type && p.invoice_type.toLowerCase().includes(search)) ||
      (p.id && p.id.toString().includes(search));
    
    const matchSupplier = !supplierId || p.supplier_id == supplierId;
    
    return matchSearch && matchSupplier;
  });
}

function filterPurchases() {
  currentPurchasePage = 1;
  const container = document.getElementById('purchases-table-container');
  if (container) {
    container.innerHTML = renderPurchasesTable();
  }
}

function changePurchasePage(page) {
  const filtered = getFilteredPurchases();
  const totalPages = Math.ceil(filtered.length / purchasesPerPage) || 1;
  
  if (page < 1 || page > totalPages) return;
  
  currentPurchasePage = page;
  const container = document.getElementById('purchases-table-container');
  if (container) {
    container.innerHTML = renderPurchasesTable();
  }
}

function changePurchasesPerPage() {
  const perPageSelect = document.getElementById('purchase-per-page');
  if (perPageSelect) {
    purchasesPerPage = parseInt(perPageSelect.value);
  }
  currentPurchasePage = 1;
  const container = document.getElementById('purchases-table-container');
  if (container) {
    container.innerHTML = renderPurchasesTable();
  }
}

async function viewPurchase(id) {
  try {
    const purchase = normalizePurchaseForDisplay(await api.purchases.getOne(id));
    
    app.showModal(`
      <div class="modal" style="max-width: 800px;">
        <div class="modal-header">
          <h3>Detalle de Compra #${purchase.id}</h3>
          <button type="button" class="btn-close" onclick="app.closeModal()">×</button>
        </div>
        <div class="modal-body">
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-bottom: 20px;">
            <div>
              <strong>Proveedor:</strong> ${purchase.supplier_name || '-'}
            </div>
            <div>
              <strong>Fecha:</strong> ${purchase.invoice_date ? app.formatDate(purchase.invoice_date) : '-'}
            </div>
            <div>
              <strong>Tipo:</strong> ${purchase.invoice_type || '-'}
            </div>
            <div>
              <strong>Número:</strong> ${purchase.invoice_number || '-'}
            </div>
          </div>
          
          <table class="products-table">
            <thead>
              <tr>
                <th>Código</th>
                <th>Producto</th>
                <th>Cantidad</th>
                <th>Costo</th>
                <th>Subtotal</th>
              </tr>
            </thead>
            <tbody>
              ${(purchase.items || []).map(item => `
                <tr>
                  <td>${item.product_code || '-'}</td>
                  <td>${item.product_name || '-'}</td>
                  <td>${item.quantity || 0}</td>
                  <td>${app.formatMoney(item.unit_cost || 0)}</td>
                  <td>${app.formatMoney(item.subtotal || 0)}</td>
                </tr>
              `).join('')}
            </tbody>
            <tfoot>
              <tr>
                <td colspan="4" style="text-align: right;"><strong>Subtotal:</strong></td>
                <td>${app.formatMoney(purchase.subtotal || 0)}</td>
              </tr>
              <tr>
                <td colspan="4" style="text-align: right;"><strong>${getPurchaseIvaLabel(purchase.invoice_type)}:</strong></td>
                <td>${app.formatMoney(purchase.iva || 0)}</td>
              </tr>
              <tr>
                <td colspan="4" style="text-align: right;"><strong>TOTAL:</strong></td>
                <td><strong>${app.formatMoney(purchase.total || 0)}</strong></td>
              </tr>
            </tfoot>
          </table>
          
          ${purchase.notes ? `<div style="margin-top: 15px;"><strong>Observaciones:</strong><p>${purchase.notes}</p></div>` : ''}
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

async function deletePurchase(id) {
  if (!confirm('¿Está seguro de que desea ANULAR esta compra?\n\nEsta acción:\n- Eliminará la compra\n- Restará el stock de los productos\n\n¿Continuar?')) return;
  
  try {
    await api.purchases.delete(id);
    purchasesList = (await api.purchases.getAll()).map(normalizePurchaseForDisplay);
    const container = document.getElementById('purchases-table-container');
    if (container) {
      container.innerHTML = renderPurchasesTable();
    }
    alert('Compra anulada exitosamente');
  } catch (e) {
    alert('Error al anular: ' + e.message);
  }
}

console.log('Purchase Query loaded');
