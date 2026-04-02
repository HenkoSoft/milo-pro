let purchaseItems = [];
let suppliersList = [];
let productsList = [];

function merchandiseEscapeHtml(value) {
  return app.escapeHtml(value);
}

function getPurchaseIvaRate() {
  const invoiceType = document.getElementById('invoice-type')?.value || 'FA';
  return invoiceType === 'FX' ? 0 : 0.21;
}

function updatePurchaseIvaLabel() {
  const invoiceType = document.getElementById('invoice-type')?.value || 'FA';
  const ivaLabel = document.getElementById('purchase-iva-label');
  if (ivaLabel) {
    ivaLabel.textContent = invoiceType === 'FX' ? 'IVA (0%)' : 'IVA (21%)';
  }
}

async function renderMerchandiseEntry() {
  const content = document.getElementById('page-content');
  content.innerHTML = '<div class="loading">Cargando...</div>';
  
  try {
    [suppliersList, productsList] = await Promise.all([
      api.purchases.getSuppliers(),
      api.products.getAll()
    ]);

    productsList = [...productsList].sort((a, b) =>
      String(a.name || '').localeCompare(String(b.name || ''), 'es', { sensitivity: 'base' })
    );
    
    const today = new Date().toISOString().split('T')[0];
    
    content.innerHTML = `
      <div class="card">
        <h2 style="margin-bottom: 20px;">Ingreso de Mercadería</h2>
        <form id="purchase-form">
          <div class="purchase-header" style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 15px; margin-bottom: 20px;">
            <div class="form-group">
              <label>Tipo</label>
              <select id="invoice-type" class="form-control">
                <option value="FA">FACTURA A</option>
                <option value="FB">FACTURA B</option>
                <option value="FC">FACTURA C</option>
                <option value="ND">NOTA DE DÉBITO</option>
                <option value="NC">NOTA DE CRÉDITO</option>
              </select>
            </div>
            <div class="form-group">
              <label>Número de Comprobante</label>
              <div style="display: flex; gap: 5px;">
                <input type="text" id="invoice-serie" class="form-control" placeholder="0001" style="width: 80px;">
                <input type="text" id="invoice-number" class="form-control" placeholder="00000001" style="flex: 1;">
              </div>
            </div>
            <div class="form-group">
              <label>Fecha</label>
              <input type="date" id="invoice-date" class="form-control" value="${today}">
            </div>
            <div class="form-group">
              <label>Proveedor</label>
              <div style="display: flex; gap: 5px;">
                <select id="supplier-select" class="form-control" style="flex: 1;">
                  <option value="">Seleccionar proveedor...</option>
                  ${suppliersList.map(s => `<option value="${s.id}">${s.name}</option>`).join('')}
                </select>
                <button type="button" class="btn btn-secondary" onclick="showAddSupplierModal()">+</button>
              </div>
            </div>
          </div>
          
          <div id="supplier-info" class="supplier-info" style="display: none; background: #f8fafc; padding: 15px; border-radius: 8px; margin-bottom: 20px;">
            <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; font-size: 13px;">
              <div><strong>Dirección:</strong> <span id="supplier-address"></span></div>
              <div><strong>CUIT/DNI:</strong> <span id="supplier-tax-id"></span></div>
              <div><strong>Teléfono:</strong> <span id="supplier-phone"></span></div>
            </div>
          </div>
          
          <div class="card" style="margin-bottom: 20px;">
            <h4 style="margin-bottom: 15px;">Agregar Producto</h4>
            <div style="display: grid; grid-template-columns: 150px 1fr 100px 100px 100px auto; gap: 10px; align-items: end;">
              <div class="form-group">
                <label>Código</label>
                <input type="text" id="item-code" class="form-control" placeholder="Código">
              </div>
              <div class="form-group">
                <label>Producto</label>
                <input type="text" id="item-product-search" class="form-control" list="purchase-products-list" placeholder="Escriba nombre del producto..." autocomplete="off">
                <input type="hidden" id="item-product">
                <datalist id="purchase-products-list">
                  ${productsList.map(p => `<option value="${merchandiseEscapeHtml(p.name)}"></option>`).join('')}
                </datalist>
              </div>
              <div class="form-group">
                <label>Cantidad</label>
                <input type="number" id="item-quantity" class="form-control" value="1" min="1">
              </div>
              <div class="form-group">
                <label>Costo Unit.</label>
                <input type="number" id="item-cost" class="form-control" step="0.01" value="0">
              </div>
              <div class="form-group">
                <label>Subtotal</label>
                <input type="text" id="item-subtotal" class="form-control" readonly value="0.00">
              </div>
              <button type="button" class="btn btn-success" onclick="addPurchaseItem()">+ Agregar</button>
            </div>
          </div>
          
          <table class="products-table">
            <thead>
              <tr>
                <th>Código</th>
                <th>Descripción</th>
                <th>Cantidad</th>
                <th>Costo Unit.</th>
                <th>Subtotal</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody id="purchase-items-body">
              <tr id="empty-items-row">
                <td colspan="6" style="text-align: center; color: #64748b;">No hay productos agregados</td>
              </tr>
            </tbody>
          </table>
          
          <div class="purchase-totals" style="margin-top: 20px; text-align: right;">
            <div style="margin-bottom: 5px;">
              <strong>Subtotal:</strong> <span id="purchase-subtotal">$ 0.00</span>
            </div>
            <div style="margin-bottom: 5px;">
              <strong id="purchase-iva-label">IVA (21%):</strong> <span id="purchase-iva">$ 0.00</span>
            </div>
            <div style="font-size: 20px; margin-bottom: 20px;">
              <strong>Total:</strong> <span id="purchase-total" style="color: #2563eb;">$ 0.00</span>
            </div>
          </div>
          
          <div class="form-group" style="margin-bottom: 20px;">
            <label>Observaciones</label>
            <textarea id="purchase-notes" class="form-control" rows="2" placeholder="Observaciones..."></textarea>
          </div>
          
          <div style="display: flex; gap: 10px; justify-content: flex-end;">
            <button type="button" class="btn btn-secondary" onclick="clearPurchase()">Limpiar</button>
            <button type="submit" class="btn btn-primary">Guardar Compra</button>
          </div>
        </form>
      </div>
    `;
    
    const invoiceTypeSelect = document.getElementById('invoice-type');
    if (invoiceTypeSelect && !invoiceTypeSelect.querySelector('option[value="FX"]')) {
      const facturaXOption = document.createElement('option');
      facturaXOption.value = 'FX';
      facturaXOption.textContent = 'FACTURA X';
      invoiceTypeSelect.insertBefore(facturaXOption, invoiceTypeSelect.querySelector('option[value="ND"]'));
    }

    document.getElementById('supplier-select').addEventListener('change', updateSupplierInfo);
    document.getElementById('invoice-type').addEventListener('change', () => {
      updatePurchaseIvaLabel();
      updateTotals();
    });
    document.getElementById('item-product-search').addEventListener('input', updateItemFromProductSearch);
    document.getElementById('item-product-search').addEventListener('change', updateItemFromProductSearch);
    document.getElementById('item-quantity').addEventListener('input', calculateItemSubtotal);
    document.getElementById('item-cost').addEventListener('input', calculateItemSubtotal);
    document.getElementById('item-cost').addEventListener('focus', handleItemCostFocus);
    document.getElementById('item-cost').addEventListener('click', handleItemCostFocus);
    document.getElementById('item-cost').addEventListener('blur', handleItemCostBlur);
    document.getElementById('item-code').addEventListener('input', searchByCode);
    document.getElementById('purchase-form').addEventListener('keydown', handlePurchaseFormKeydown);
    document.getElementById('purchase-form').addEventListener('submit', savePurchase);
    updatePurchaseIvaLabel();
    updateTotals();
    
  } catch (e) {
    content.innerHTML = '<div class="alert alert-warning">Error: ' + e.message + '</div>';
  }
}

function updateSupplierInfo() {
  const supplierId = document.getElementById('supplier-select').value;
  const infoDiv = document.getElementById('supplier-info');
  
  if (!supplierId) {
    infoDiv.style.display = 'none';
    return;
  }
  
  const supplier = suppliersList.find(s => s.id == supplierId);
  if (supplier) {
    document.getElementById('supplier-address').textContent = supplier.address || '-';
    document.getElementById('supplier-tax-id').textContent = supplier.tax_id || '-';
    document.getElementById('supplier-phone').textContent = supplier.phone || '-';
    infoDiv.style.display = 'block';
  }
}

function findProductByName(name) {
  const normalizedName = String(name || '').trim().toLowerCase();
  if (!normalizedName) {
    return null;
  }

  return productsList.find((product) =>
    String(product.name || '').trim().toLowerCase() === normalizedName
  ) || null;
}

function updateItemFromProduct(product) {
  const selectedProduct = product || findProductByName(document.getElementById('item-product-search').value);
  const productIdInput = document.getElementById('item-product');

  if (!selectedProduct) {
    productIdInput.value = '';
    return;
  }

  productIdInput.value = selectedProduct.id;
  document.getElementById('item-product-search').value = selectedProduct.name || '';
  document.getElementById('item-code').value = selectedProduct.sku || selectedProduct.barcode || '';
  document.getElementById('item-cost').value = selectedProduct.purchase_price || '0';
  calculateItemSubtotal();
}

function updateItemFromProductSearch() {
  updateItemFromProduct();
}

function calculateItemSubtotal() {
  const qty = app.parseLocaleNumber(document.getElementById('item-quantity').value, 0);
  const cost = app.parseLocaleNumber(document.getElementById('item-cost').value, 0);
  document.getElementById('item-subtotal').value = app.formatDecimalInputValue(qty * cost, 2);
}

function handleItemCostFocus(event) {
  const input = event.target;
  if (input && (input.value === '0' || input.value === '0.00')) {
    input.select();
  }
}

function handleItemCostBlur(event) {
  const input = event.target;
  if (input && !input.value.trim()) {
    input.value = '0';
    calculateItemSubtotal();
  }
}

function handlePurchaseFormKeydown(event) {
  if (event.key !== 'Enter') {
    return;
  }

  const target = event.target;
  const tagName = target?.tagName || '';
  const isTextarea = tagName === 'TEXTAREA';
  const isSubmitButton = tagName === 'BUTTON' && target.type === 'submit';

  if (isTextarea || isSubmitButton) {
    return;
  }

  event.preventDefault();

  if (target && ['item-code', 'item-product-search', 'item-quantity', 'item-cost'].includes(target.id)) {
    addPurchaseItem();
  }
}

function searchByCode() {
  const code = document.getElementById('item-code').value.trim().toLowerCase();
  if (!code) return;
  
  const product = productsList.find(p => 
    (p.sku && p.sku.toLowerCase() === code) || 
    (p.barcode && p.barcode.toLowerCase() === code)
  );
  
  if (product) {
    updateItemFromProduct(product);
  }
}

function addPurchaseItem() {
  const productId = document.getElementById('item-product').value;
  const selectedProduct = productsList.find((product) => String(product.id) === String(productId));
  const productName = selectedProduct ? selectedProduct.name : document.getElementById('item-product-search').value.trim();
  const code = document.getElementById('item-code').value;
  const quantity = parseInt(document.getElementById('item-quantity').value) || 0;
  const unitCost = parseFloat(document.getElementById('item-cost').value) || 0;
  const subtotal = quantity * unitCost;
  
  if (!productId || !selectedProduct || quantity <= 0) {
    alert('Seleccione un producto y cantidad válida');
    return;
  }
  
  const existingIndex = purchaseItems.findIndex(item => item.product_id == productId);
  if (existingIndex >= 0) {
    purchaseItems[existingIndex].quantity += quantity;
    purchaseItems[existingIndex].subtotal = purchaseItems[existingIndex].quantity * purchaseItems[existingIndex].unit_cost;
  } else {
    purchaseItems.push({
      product_id: productId,
      product_name: productName,
      product_code: code,
      quantity: quantity,
      unit_cost: unitCost,
      subtotal: subtotal
    });
  }
  
  renderPurchaseItems();
  clearItemForm();
}

function removePurchaseItem(index) {
  purchaseItems.splice(index, 1);
  renderPurchaseItems();
}

function renderPurchaseItems() {
  const tbody = document.getElementById('purchase-items-body');
  const emptyRow = document.getElementById('empty-items-row');
  
  if (purchaseItems.length === 0) {
    tbody.innerHTML = '<tr id="empty-items-row"><td colspan="6" style="text-align: center; color: #64748b;">No hay productos agregados</td></tr>';
    updateTotals();
    return;
  }
  
  tbody.innerHTML = purchaseItems.map((item, index) => `
    <tr>
      <td>${item.product_code || '-'}</td>
      <td>${item.product_name}</td>
      <td>${item.quantity}</td>
      <td>${app.formatMoney(item.unit_cost)}</td>
      <td>${app.formatMoney(item.subtotal)}</td>
      <td>
        <button type="button" class="btn btn-danger btn-sm" onclick="removePurchaseItem(${index})">Eliminar</button>
      </td>
    </tr>
  `).join('');
  
  updateTotals();
}

function updateTotals() {
  const subtotal = purchaseItems.reduce((sum, item) => sum + item.subtotal, 0);
  const iva = subtotal * getPurchaseIvaRate();
  const total = subtotal + iva;
  
  document.getElementById('purchase-subtotal').textContent = app.formatMoney(subtotal);
  document.getElementById('purchase-iva').textContent = app.formatMoney(iva);
  document.getElementById('purchase-total').textContent = app.formatMoney(total);
}

function clearItemForm() {
  document.getElementById('item-product').value = '';
  document.getElementById('item-product-search').value = '';
  document.getElementById('item-code').value = '';
  document.getElementById('item-quantity').value = '1';
  document.getElementById('item-cost').value = '0';
  document.getElementById('item-subtotal').value = '0.00';
}

function clearPurchase() {
  if (purchaseItems.length > 0 && !confirm('¿Limpiar todos los productos?')) return;
  
  purchaseItems = [];
  renderPurchaseItems();
  document.getElementById('supplier-select').value = '';
  document.getElementById('supplier-info').style.display = 'none';
  document.getElementById('invoice-type').value = 'FA';
  document.getElementById('invoice-serie').value = '';
  document.getElementById('invoice-number').value = '';
  document.getElementById('purchase-notes').value = '';
  updatePurchaseIvaLabel();
  updateTotals();
}

async function savePurchase(e) {
  e.preventDefault();
  
  if (purchaseItems.length === 0) {
    alert('Debe agregar al menos un producto');
    return;
  }
  
  const supplierId = document.getElementById('supplier-select').value;
  const invoiceType = document.getElementById('invoice-type').value;
  const invoiceSerie = document.getElementById('invoice-serie').value;
  const invoiceNumber = document.getElementById('invoice-number').value;
  const invoiceDate = document.getElementById('invoice-date').value;
  const notes = document.getElementById('purchase-notes').value;
  
  const invoiceNumberFull = invoiceSerie ? `${invoiceSerie}-${invoiceNumber}` : invoiceNumber;
  
  try {
    await api.purchases.create({
      supplier_id: supplierId || null,
      invoice_type: invoiceType,
      invoice_number: invoiceNumberFull,
      invoice_date: invoiceDate,
      items: purchaseItems,
      notes: notes
    });
    
    alert('Compra guardada exitosamente');
    purchaseItems = [];
    renderPurchaseItems();
    document.getElementById('supplier-select').value = '';
    document.getElementById('supplier-info').style.display = 'none';
    document.getElementById('invoice-serie').value = '';
    document.getElementById('invoice-number').value = '';
    document.getElementById('purchase-notes').value = '';
    
  } catch (err) {
    alert('Error al guardar: ' + err.message);
  }
}

function showAddSupplierModal() {
  app.showModal(`
    <div class="modal">
      <div class="modal-header">
        <h3>Nuevo Proveedor</h3>
        <button type="button" class="btn-close" onclick="app.closeModal()">×</button>
      </div>
      <div class="modal-body">
        <div class="form-group">
          <label>Nombre *</label>
          <input type="text" id="new-supplier-name" class="form-control">
        </div>
        <div class="form-row">
          <div class="form-group">
            <label>Teléfono</label>
            <input type="text" id="new-supplier-phone" class="form-control">
          </div>
          <div class="form-group">
            <label>CUIT/DNI</label>
            <input type="text" id="new-supplier-tax-id" class="form-control">
          </div>
        </div>
        <div class="form-group">
          <label>Email</label>
          <input type="email" id="new-supplier-email" class="form-control">
        </div>
        <div class="form-group">
          <label>Dirección</label>
          <input type="text" id="new-supplier-address" class="form-control">
        </div>
      </div>
      <div class="modal-footer">
        <button type="button" class="btn btn-secondary" onclick="app.closeModal()">Cancelar</button>
        <button type="button" class="btn btn-primary" onclick="saveNewSupplier()">Guardar</button>
      </div>
    </div>
  `);
}

async function saveNewSupplier() {
  const name = document.getElementById('new-supplier-name').value.trim();
  
  if (!name) {
    alert('El nombre es requerido');
    return;
  }
  
  try {
    const supplier = await api.purchases.createSupplier({
      name: name,
      phone: document.getElementById('new-supplier-phone').value,
      tax_id: document.getElementById('new-supplier-tax-id').value,
      email: document.getElementById('new-supplier-email').value,
      address: document.getElementById('new-supplier-address').value
    });
    
    suppliersList.push(supplier);
    
    const select = document.getElementById('supplier-select');
    const option = document.createElement('option');
    option.value = supplier.id;
    option.textContent = supplier.name;
    select.appendChild(option);
    select.value = supplier.id;
    
    updateSupplierInfo();
    app.closeModal();
    
  } catch (err) {
    alert('Error al guardar proveedor: ' + err.message);
  }
}

console.log('Merchandise Entry loaded');
