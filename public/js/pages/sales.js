let cart = [];
let productsForSale = [];
let customersForSale = [];

function salesEscapeHtml(value) {
  return app.escapeHtml(value);
}

function salesEscapeAttr(value) {
  return app.escapeAttr(value);
}

async function renderSales() {
  const content = document.getElementById('page-content');
  content.innerHTML = '<div class="loading">Cargando...</div>';
  cart = [];
  
  try {
    [productsForSale, customersForSale] = await Promise.all([
      api.products.getAll({}),
      api.customers.getAll({})
    ]);
    
    const customerOptions = customersForSale
      .map(c => '<option value="' + c.id + '">' + salesEscapeHtml(c.name) + '</option>')
      .join('');
    
    content.innerHTML = 
      '<div class="pos-container">' +
      '<div class="pos-products card">' +
      '<div class="card-header"><h3 class="card-title">Productos</h3></div>' +
      '<input type="text" id="pos-search" placeholder="Buscar producto..." oninput="filterPosProducts()" style="margin-bottom:15px;width:100%;padding:10px;">' +
      '<div class="product-grid" id="pos-products-grid"></div>' +
      '</div>' +
      '<div class="pos-cart">' +
      '<h3>Carrito de Venta</h3>' +
      '<div class="cart-items" id="cart-items"></div>' +
      '<div class="cart-total">Total: <span id="cart-total">$0.00</span></div>' +
      '<div class="form-group"><label>Cliente (opcional)</label><select id="sale-customer"><option value="">Sin cliente</option>' + customerOptions + '</select></div>' +
      '<div class="form-group"><label>Método de pago</label><select id="sale-payment"><option value="cash">Efectivo</option><option value="card">Tarjeta</option><option value="transfer">Transferencia</option></select></div>' +
      '<button class="btn btn-success btn-block" onclick="processSale()" style="margin-top:10px;">Completar Venta</button>' +
      '</div>' +
      '</div>';
    
    filterPosProducts();
  } catch (e) {
    content.innerHTML = '<div class="alert alert-warning">Error: ' + e.message + '</div>';
  }
}

function filterPosProducts() {
  const search = (document.getElementById('pos-search') || {}).value || '';
  const filtered = productsForSale.filter(p => p.name.toLowerCase().includes(search.toLowerCase()) && p.stock >= 0);
  
  const grid = document.getElementById('pos-products-grid');
  if (!grid) return;
  
  grid.innerHTML = filtered.map(p => {
    const imageUrl = app.safeImageUrl(p.image_url);
    const img = imageUrl ? '<img src="' + imageUrl + '" alt="' + salesEscapeAttr(p.name) + '" style="width:100%;height:80px;object-fit:contain;margin-bottom:8px;" onerror="this.style.display=\'none\'">' : '';
    return '<div class="product-card" onclick="addToCart(' + p.id + ')">' +
    img +
    '<div class="product-card-name">' + salesEscapeHtml(p.name) + '</div>' +
    '<div class="product-card-price">' + app.formatMoney(p.sale_price) + '</div>' +
    '<div class="product-card-stock">Stock: ' + p.stock + '</div>' +
    '</div>';
  }).join('');
}

function addToCart(productId) {
  const product = productsForSale.find(p => p.id === productId);
  if (!product || product.stock <= 0) return;
  
  const existing = cart.find(item => item.product_id === productId);
  if (existing) {
    if (existing.quantity < product.stock) {
      existing.quantity++;
    }
  } else {
    cart.push({ product_id: productId, name: product.name, price: product.sale_price, quantity: 1 });
  }
  renderCart();
}

function removeFromCart(productId) {
  cart = cart.filter(item => item.product_id !== productId);
  renderCart();
}

function updateCartQty(productId, qty) {
  const item = cart.find(i => i.product_id === productId);
  if (item && qty > 0) {
    const product = productsForSale.find(p => p.id === productId);
    if (qty <= product.stock) {
      item.quantity = qty;
    }
  }
  renderCart();
}

function renderCart() {
  const container = document.getElementById('cart-items');
  const totalEl = document.getElementById('cart-total');
  if (!container) return;
  
  let total = 0;
  container.innerHTML = cart.map(item => {
    const subtotal = item.price * item.quantity;
    total += subtotal;
    return '<div class="cart-item">' +
      '<div class="cart-item-info"><div class="cart-item-name">' + salesEscapeHtml(item.name) + '</div>' +
      '<div class="cart-item-price">' + app.formatMoney(item.price) + ' x ' + item.quantity + '</div></div>' +
      '<div class="cart-item-qty">' +
      '<button onclick="updateCartQty(' + item.product_id + ',' + (item.quantity-1) + ')">-</button>' +
      '<span>' + item.quantity + '</span>' +
      '<button onclick="updateCartQty(' + item.product_id + ',' + (item.quantity+1) + ')">+</button>' +
      '<button onclick="removeFromCart(' + item.product_id + ')">×</button>' +
      '</div></div>';
  }).join('');
  
  totalEl.textContent = app.formatMoney(total);
}

async function processSale() {
  if (cart.length === 0) {
    alert('El carrito está vacío');
    return;
  }
  
  const customerId = document.getElementById('sale-customer').value;
  const paymentMethod = document.getElementById('sale-payment').value;
  
  const items = cart.map(item => ({
    product_id: item.product_id,
    quantity: item.quantity,
    unit_price: item.price
  }));
  
  try {
    const customerEl = document.getElementById('sale-customer');
    const customerName = customerEl && customerEl.value ? customersForSale.find(c => c.id == customerEl.value)?.name : 'Mostrador';
    
    const sale = await api.sales.create({
      customer_id: customerId || null,
      items: items,
      payment_method: paymentMethod
    });
    
    showReceipt(sale, cart, paymentMethod, sale.id);
    lastSaleData = { saleId: sale.id, cart: [...cart], paymentMethod, customerName };
    cart = [];
    document.getElementById('cart-items').innerHTML = '';
    document.getElementById('cart-total').textContent = '$0,00';
  } catch (e) {
    alert('Error: ' + e.message);
  }
}

function showReceipt(sale, cart, paymentMethod, saleId) {
  const customerEl = document.getElementById('sale-customer');
  const customerName = customerEl && customerEl.value ? customersForSale.find(c => c.id == customerEl.value)?.name : 'Mostrador';
  
  let receiptHtml = '<input type="hidden" id="sale-id-hidden" value="' + saleId + '">';
  receiptHtml += '<div class="modal-overlay" style="display:flex;align-items:center;justify-content:center;position:fixed;inset:0;background:rgba(0,0,0,0.5);z-index:1000;" onclick="if(event.target === this) closeReceipt()">';
  receiptHtml += '<div style="background:white;border-radius:8px;padding:20px;max-width:350px;width:90%;max-height:90vh;overflow-y:auto;">';
  receiptHtml += '<div style="text-align:center;padding:10px;">';
  receiptHtml += '<div style="font-family:monospace;font-size:12px;width:280px;margin:0 auto;padding:10px;">';
  receiptHtml += '<h2 style="margin:0 0 10px;">' + (window.businessName || 'Milo Pro') + '</h2>';
  receiptHtml += '<p style="margin:0;">Fecha: ' + new Date().toLocaleString('es-AR') + '</p>';
  receiptHtml += '<p style="margin:0;">Ticket #' + saleId + '</p>';
  receiptHtml += '<p style="margin:5px 0;">Cliente: ' + salesEscapeHtml(customerName) + '</p>';
  receiptHtml += '<hr style="border:1px dashed #333;margin:10px 0;">';
  
  let total = 0;
  cart.forEach(item => {
    const subtotal = item.price * item.quantity;
    total += subtotal;
    receiptHtml += '<div style="display:flex;justify-content:space-between;margin:5px 0;">';
    receiptHtml += '<span>' + salesEscapeHtml(item.name) + ' x' + item.quantity + '</span>';
    receiptHtml += '<span>' + app.formatMoney(subtotal) + '</span>';
    receiptHtml += '</div>';
  });
  
  receiptHtml += '<hr style="border:1px dashed #333;margin:10px 0;">';
  receiptHtml += '<div style="display:flex;justify-content:space-between;font-weight:bold;font-size:16px;">';
  receiptHtml += '<span>TOTAL:</span><span>' + app.formatMoney(total) + '</span>';
  receiptHtml += '</div>';
  receiptHtml += '<p style="margin:5px 0;">Pago: ' + (paymentMethod === 'cash' ? 'Efectivo' : paymentMethod === 'card' ? 'Tarjeta' : 'Transferencia') + '</p>';
  receiptHtml += '<hr style="border:1px dashed #333;margin:10px 0;">';
  receiptHtml += '<p style="margin:10px 0;">Gracias por su compra!</p>';
  receiptHtml += '<p style="margin:0;font-size:10px;">Vuelva pronto</p>';
  receiptHtml += '</div>';
  receiptHtml += '</div>';
  receiptHtml += '<div style="margin-top:15px;text-align:center;"><button type="button" onclick="closeReceipt()" style="padding:8px 16px;margin-right:10px;cursor:pointer;">Cerrar</button><button type="button" onclick="printReceipt()" style="padding:8px 16px;background:#2563eb;color:white;border:none;border-radius:4px;cursor:pointer;">Imprimir</button></div>';
  receiptHtml += '</div>';
  receiptHtml += '</div>';
  
  document.getElementById('modal-container').innerHTML = receiptHtml;
}

function closeReceipt() {
  document.getElementById('modal-container').innerHTML = '';
}

let printInProgress = false;
let lastSaleData = null;

function printReceipt() {
  if (printInProgress || !lastSaleData) return;
  printInProgress = true;
  
  const saleId = lastSaleData.saleId;
  const cartData = lastSaleData.cart;
  const paymentMethod = lastSaleData.paymentMethod;
  const customerName = lastSaleData.customerName;
  
  const businessName = window.businessName || 'Milo Pro';
  let receiptText = '       ' + businessName + '\n';
  receiptText += 'Fecha: ' + new Date().toLocaleString('es-AR') + '\n';
  receiptText += 'Ticket #' + saleId + '\n';
  receiptText += 'Cliente: ' + customerName + '\n';
  receiptText += '----------------------------\n';
  
  let total = 0;
  cartData.forEach(item => {
    const subtotal = item.price * item.quantity;
    total += subtotal;
    const name = item.name.length > 20 ? item.name.substring(0, 20) : item.name;
    receiptText += name + ' x' + item.quantity + '\n';
    receiptText += '     ' + app.formatMoney(subtotal) + '\n';
  });
  
  receiptText += '----------------------------\n';
  receiptText += 'TOTAL:       ' + app.formatMoney(total) + '\n';
  receiptText += 'Pago: ' + (paymentMethod === 'cash' ? 'Efectivo' : paymentMethod === 'card' ? 'Tarjeta' : 'Transferencia') + '\n';
  receiptText += '----------------------------\n';
  receiptText += '    Gracias por su compra!\n';
  receiptText += '       Vuelve pronto\n';
  receiptText += '\n\n\n\n\n';
  
  document.getElementById('modal-container').innerHTML = '';
  
  const printFrame = document.createElement('iframe');
  printFrame.style.display = 'none';
  printFrame.name = 'printFrame';
  document.body.appendChild(printFrame);
  
  const frameDoc = printFrame.contentWindow.document;
  frameDoc.open();
  frameDoc.write('<!DOCTYPE html><html><head><title>Recibo</title>');
  frameDoc.write('<style>@page { margin: 0; } body { margin: 0; padding: 5px; font-family: monospace; font-size: 10px; }</style>');
  frameDoc.write('</head><body><pre style="margin:0;">' + salesEscapeHtml(receiptText) + '</pre></body></html>');
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
