let creditItems = [];
let creditSuppliersList = [];
let creditProductsList = [];

async function renderNcProveedor() {
  const content = document.getElementById('page-content');
  content.innerHTML = '<div class="loading">Cargando...</div>';
  
  try {
    [creditSuppliersList, creditProductsList] = await Promise.all([
      api.purchases.getSuppliers(),
      api.products.getAll()
    ]);
    
    const today = new Date().toISOString().split('T')[0];
    
    content.innerHTML = `
      <div class="card">
        <h2 style="margin-bottom: 20px;">Devoluciones a Proveedor / Nota de Crédito</h2>
        <form id="credit-form">
          <div class="credit-header" style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 15px; margin-bottom: 20px;">
            <div class="form-group">
              <label>Tipo</label>
              <select id="credit-type" class="form-control">
                <option value="NCA">N/C A</option>
                <option value="NCB">N/C B</option>
                <option value="NCC">N/C C</option>
              </select>
            </div>
            <div class="form-group">
              <label>Número de NC</label>
              <div style="display: flex; gap: 5px;">
                <input type="text" id="credit-serie" class="form-control" placeholder="0001" style="width: 80px;">
                <input type="text" id="credit-number" class="form-control" placeholder="00000001" style="flex: 1;">
              </div>
            </div>
            <div class="form-group">
              <label>Nro Fac. Original</label>
              <input type="text" id="reference-invoice" class="form-control" placeholder="Nro de factura">
            </div>
            <div class="form-group">
              <label>Fecha</label>
              <input type="date" id="credit-date" class="form-control" value="${today}">
            </div>
          </div>
          
          <div class="credit-header" style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 15px; margin-bottom: 20px;">
            <div class="form-group">
              <label>Cód. Proveedor</label>
              <input type="text" id="supplier-code" class="form-control" readonly>
            </div>
            <div class="form-group" style="grid-column: span 2;">
              <label>Proveedor</label>
              <div style="display: flex; gap: 5px;">
                <select id="credit-supplier-select" class="form-control" style="flex: 1;">
                  <option value="">Seleccionar proveedor...</option>
                  ${creditSuppliersList.map(s => `<option value="${s.id}" data-code="${s.tax_id || ''}" data-address="${s.address || ''}" data-tax-condition="Responsable Inscripto">${s.name}</option>`).join('')}
                </select>
              </div>
            </div>
            <div class="form-group">
              <label>Cond. IVA</label>
              <input type="text" id="supplier-tax-condition" class="form-control" value="Responsable Inscripto" readonly>
            </div>
          </div>
          
          <div id="supplier-credit-info" class="supplier-info" style="display: none; background: #f8fafc; padding: 15px; border-radius: 8px; margin-bottom: 20px;">
            <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; font-size: 13px;">
              <div><strong>CUIT/DNI:</strong> <span id="credit-supplier-tax-id"></span></div>
              <div><strong>Dirección:</strong> <span id="credit-supplier-address"></span></div>
              <div></div>
            </div>
          </div>
          
          <div class="card" style="margin-bottom: 20px;">
            <h4 style="margin-bottom: 15px;">Agregar Producto</h4>
            <div style="display: grid; grid-template-columns: 120px 1fr 100px 100px 100px auto; gap: 10px; align-items: end;">
              <div class="form-group">
                <label>Código</label>
                <input type="text" id="credit-item-code" class="form-control" placeholder="Código">
              </div>
              <div class="form-group">
                <label>Producto</label>
                <select id="credit-item-product" class="form-control">
                  <option value="">Seleccionar producto...</option>
                  ${creditProductsList.map(p => `<option value="${p.id}" data-code="${p.sku || ''}" data-price="${p.sale_price || 0}" data-brand="${p.category_name || ''}">${p.name}</option>`).join('')}
                </select>
              </div>
              <div class="form-group">
                <label>Cantidad</label>
                <input type="number" id="credit-item-quantity" class="form-control" value="1" min="1">
              </div>
              <div class="form-group">
                <label>Precio</label>
                <input type="number" id="credit-item-price" class="form-control" step="0.01" value="0">
              </div>
              <div class="form-group">
                <label>Subtotal</label>
                <input type="text" id="credit-item-subtotal" class="form-control" readonly value="0.00">
              </div>
              <button type="button" class="btn btn-success" onclick="addCreditItem()">+ Agregar</button>
            </div>
          </div>
          
          <table class="products-table">
            <thead>
              <tr>
                <th>Código</th>
                <th>Descripción</th>
                <th>Cantidad</th>
                <th>Precio</th>
                <th>Total</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody id="credit-items-body">
              <tr id="credit-empty-items-row">
                <td colspan="6" style="text-align: center; color: #64748b;">No hay productos agregados</td>
              </tr>
            </tbody>
          </table>
          
          <div class="purchase-totals" style="margin-top: 20px; text-align: right;">
            <div style="font-size: 20px; margin-bottom: 20px;">
              <strong>TOTAL:</strong> <span id="credit-total" style="color: #2563eb;">$ 0.00</span>
            </div>
          </div>
          
          <div class="form-group" style="margin-bottom: 20px;">
            <label>Observaciones</label>
            <textarea id="credit-notes" class="form-control" rows="2" placeholder="Observaciones..."></textarea>
          </div>
          
          <div style="display: flex; gap: 15px; align-items: center; margin-bottom: 20px; padding: 15px; background: #f8fafc; border-radius: 8px;">
            <label style="display: flex; align-items: center; gap: 8px; cursor: pointer;">
              <input type="checkbox" id="update-stock" checked>
              <span>Actualiza Stock</span>
            </label>
            <label style="display: flex; align-items: center; gap: 8px; cursor: pointer;">
              <input type="checkbox" id="update-cash" checked>
              <span>Actualiza Caja</span>
            </label>
          </div>
          
          <div style="display: flex; gap: 10px; justify-content: flex-end;">
            <button type="button" class="btn btn-secondary" onclick="clearCredit()">Limpiar</button>
            <button type="submit" class="btn btn-primary">Guardar NC</button>
          </div>
        </form>
      </div>
    `;
    
    document.getElementById('credit-supplier-select').addEventListener('change', updateCreditSupplierInfo);
    document.getElementById('credit-item-product').addEventListener('change', updateCreditItemFromProduct);
    document.getElementById('credit-item-quantity').addEventListener('input', calculateCreditItemSubtotal);
    document.getElementById('credit-item-price').addEventListener('input', calculateCreditItemSubtotal);
    document.getElementById('credit-item-code').addEventListener('input', searchCreditByCode);
    document.getElementById('credit-form').addEventListener('submit', saveCredit);
    
  } catch (e) {
    content.innerHTML = '<div class="alert alert-warning">Error: ' + e.message + '</div>';
  }
}

function updateCreditSupplierInfo() {
  const supplierId = document.getElementById('credit-supplier-select').value;
  const infoDiv = document.getElementById('supplier-credit-info');
  
  if (!supplierId) {
    infoDiv.style.display = 'none';
    return;
  }
  
  const supplier = creditSuppliersList.find(s => s.id == supplierId);
  if (supplier) {
    document.getElementById('supplier-code').value = supplier.tax_id || '';
    document.getElementById('credit-supplier-tax-id').textContent = supplier.tax_id || '-';
    document.getElementById('credit-supplier-address').textContent = supplier.address || '-';
    infoDiv.style.display = 'block';
  }
}

function updateCreditItemFromProduct() {
  const select = document.getElementById('credit-item-product');
  const option = select.options[select.selectedIndex];
  
  if (option.value) {
    document.getElementById('credit-item-code').value = option.dataset.code || '';
    document.getElementById('credit-item-price').value = option.dataset.price || 0;
    calculateCreditItemSubtotal();
  }
}

function calculateCreditItemSubtotal() {
  const qty = app.parseLocaleNumber(document.getElementById('credit-item-quantity').value, 0);
  const price = app.parseLocaleNumber(document.getElementById('credit-item-price').value, 0);
  document.getElementById('credit-item-subtotal').value = app.formatDecimalInputValue(qty * price, 2);
}

function searchCreditByCode() {
  const code = document.getElementById('credit-item-code').value.trim().toLowerCase();
  if (!code) return;
  
  const product = creditProductsList.find(p => 
    (p.sku && p.sku.toLowerCase() === code) || 
    (p.barcode && p.barcode.toLowerCase() === code)
  );
  
  if (product) {
    document.getElementById('credit-item-product').value = product.id;
    document.getElementById('credit-item-price').value = product.sale_price || 0;
    calculateCreditItemSubtotal();
  }
}

function addCreditItem() {
  const productSelect = document.getElementById('credit-item-product');
  const productId = productSelect.value;
  const productName = productSelect.options[productSelect.selectedIndex].text;
  const code = document.getElementById('credit-item-code').value;
  const quantity = parseInt(document.getElementById('credit-item-quantity').value) || 0;
  const unitPrice = parseFloat(document.getElementById('credit-item-price').value) || 0;
  const subtotal = quantity * unitPrice;
  
  if (!productId || quantity <= 0) {
    alert('Seleccione un producto y cantidad válida');
    return;
  }
  
  const existingIndex = creditItems.findIndex(item => item.product_id == productId);
  if (existingIndex >= 0) {
    creditItems[existingIndex].quantity += quantity;
    creditItems[existingIndex].subtotal = creditItems[existingIndex].quantity * creditItems[existingIndex].unit_price;
  } else {
    creditItems.push({
      product_id: productId,
      product_name: productName,
      product_code: code,
      quantity: quantity,
      unit_price: unitPrice,
      subtotal: subtotal
    });
  }
  
  renderCreditItems();
  clearCreditItemForm();
}

function removeCreditItem(index) {
  creditItems.splice(index, 1);
  renderCreditItems();
}

function renderCreditItems() {
  const tbody = document.getElementById('credit-items-body');
  
  if (creditItems.length === 0) {
    tbody.innerHTML = '<tr id="credit-empty-items-row"><td colspan="6" style="text-align: center; color: #64748b;">No hay productos agregados</td></tr>';
    updateCreditTotals();
    return;
  }
  
  tbody.innerHTML = creditItems.map((item, index) => `
    <tr>
      <td>${item.product_code || '-'}</td>
      <td>${item.product_name}</td>
      <td>${item.quantity}</td>
      <td>${app.formatMoney(item.unit_price)}</td>
      <td>${app.formatMoney(item.subtotal)}</td>
      <td>
        <button type="button" class="btn btn-danger btn-sm" onclick="removeCreditItem(${index})">Eliminar</button>
      </td>
    </tr>
  `).join('');
  
  updateCreditTotals();
}

function updateCreditTotals() {
  const total = creditItems.reduce((sum, item) => sum + item.subtotal, 0);
  document.getElementById('credit-total').textContent = app.formatMoney(total);
}

function clearCreditItemForm() {
  document.getElementById('credit-item-product').value = '';
  document.getElementById('credit-item-code').value = '';
  document.getElementById('credit-item-quantity').value = '1';
  document.getElementById('credit-item-price').value = '0';
  document.getElementById('credit-item-subtotal').value = '0.00';
}

function clearCredit() {
  if (creditItems.length > 0 && !confirm('¿Limpiar todos los productos?')) return;
  
  creditItems = [];
  renderCreditItems();
  document.getElementById('credit-supplier-select').value = '';
  document.getElementById('supplier-credit-info').style.display = 'none';
  document.getElementById('credit-serie').value = '';
  document.getElementById('credit-number').value = '';
  document.getElementById('reference-invoice').value = '';
  document.getElementById('credit-notes').value = '';
}

async function saveCredit(e) {
  e.preventDefault();
  
  if (creditItems.length === 0) {
    alert('Debe agregar al menos un producto');
    return;
  }
  
  const supplierId = document.getElementById('credit-supplier-select').value;
  const creditType = document.getElementById('credit-type').value;
  const creditSerie = document.getElementById('credit-serie').value;
  const creditNumber = document.getElementById('credit-number').value;
  const referenceInvoice = document.getElementById('reference-invoice').value;
  const creditDate = document.getElementById('credit-date').value;
  const notes = document.getElementById('credit-notes').value;
  const updateStock = document.getElementById('update-stock').checked;
  const updateCash = document.getElementById('update-cash').checked;
  
  const creditNoteNumber = creditSerie ? `${creditSerie}-${creditNumber}` : creditNumber;
  
  try {
    await api.purchases.createCredit({
      supplier_id: supplierId || null,
      credit_note_number: creditNoteNumber,
      reference_invoice: referenceInvoice,
      invoice_date: creditDate,
      items: creditItems,
      notes: notes,
      update_stock: updateStock,
      update_cash: updateCash
    });
    
    alert('Nota de Crédito guardada exitosamente');
    creditItems = [];
    renderCreditItems();
    document.getElementById('credit-supplier-select').value = '';
    document.getElementById('supplier-credit-info').style.display = 'none';
    document.getElementById('credit-serie').value = '';
    document.getElementById('credit-number').value = '';
    document.getElementById('reference-invoice').value = '';
    document.getElementById('credit-notes').value = '';
    
  } catch (err) {
    alert('Error al guardar: ' + err.message);
  }
}

console.log('NC Proveedor loaded');
