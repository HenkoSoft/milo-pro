let productsData = [];
let categoriesData = [];
let viewMode = 'grid';
let editingProductId = null;

async function renderProducts() {
  const content = document.getElementById('page-content');
  content.innerHTML = '<div class="loading">Cargando...</div>';

  try {
    [productsData, categoriesData] = await Promise.all([
      api.products.getAll({}),
      api.categories.getAll()
    ]);

    const categoryOptions = categoriesData.map(c => '<option value="' + c.id + '">' + app.escapeHtml(c.name) + '</option>').join('');
    const totalProducts = productsData.length;
    const lowStockCount = productsData.filter(p => p.stock > 0 && p.stock <= p.min_stock).length;
    const outOfStockCount = productsData.filter(p => p.stock <= 0).length;
    const syncedCount = productsData.filter(p => p.woocommerce_id).length;

    content.innerHTML =
      '<div class="card">' +
      '<div class="card-header">' +
      '<h3 class="card-title">Gestion de Productos</h3>' +
      '<div class="btn-group">' +
      '<button class="btn btn-primary" onclick="showProductModal()">+ Nuevo</button>' +
      '<button class="btn btn-info" onclick="syncSingleProduct()" id="sync-single-btn" disabled>Sincronizar</button>' +
      '</div>' +
      '</div>' +
      '<div class="products-toolbar">' +
      '<div class="toolbar-row">' +
      '<div class="toolbar-left">' +
      '<div class="search-box"><input type="text" id="product-search" placeholder="Buscar por nombre, SKU o codigo..." oninput="filterProducts()"></div>' +
      '<select id="product-category-filter" onchange="filterProducts()"><option value="">Categoria</option>' + categoryOptions + '</select>' +
      '<select id="product-stock-filter" onchange="filterProducts()">' +
      '<option value="">Stock</option>' +
      '<option value="low">Stock bajo</option>' +
      '<option value="out">Sin stock</option>' +
      '<option value="available">Disponible</option>' +
      '</select>' +
      '</div>' +
      '<div class="toolbar-right">' +
      '<button class="btn btn-sm ' + (viewMode === 'grid' ? 'btn-primary' : 'btn-secondary') + '" onclick="setViewMode(\'grid\')" title="Vista cuadricula">[]</button>' +
      '<button class="btn btn-sm ' + (viewMode === 'table' ? 'btn-primary' : 'btn-secondary') + '" onclick="setViewMode(\'table\')" title="Vista tabla">=</button>' +
      '<button class="btn btn-sm btn-warning" onclick="renderProducts()" title="Actualizar">R</button>' +
      '</div>' +
      '</div>' +
      '<div class="stats-bar">' +
      '<span>Total: <span class="count">' + totalProducts + '</span></span>' +
      '<span>Stock bajo: <span class="count">' + lowStockCount + '</span></span>' +
      '<span>Sin stock: <span class="count">' + outOfStockCount + '</span></span>' +
      '<span>WooCommerce: <span class="count">' + syncedCount + '</span></span>' +
      '</div>' +
      '</div>' +
      '<div id="products-container"></div>' +
      '</div>' +
      getProductModalHtml(categoryOptions);

    renderProductsView(productsData);
  } catch (e) {
    content.innerHTML = '<div class="alert alert-warning">Error: ' + app.escapeHtml(e.message) + '</div>';
  }
}

function setViewMode(mode) {
  viewMode = mode;
  filterProducts();
}

function filterProducts() {
  const search = (document.getElementById('product-search') || {}).value || '';
  const category = (document.getElementById('product-category-filter') || {}).value || '';
  const stockFilter = (document.getElementById('product-stock-filter') || {}).value || '';
  const normalized = search.toLowerCase();

  const filtered = productsData.filter(p => {
    const matchSearch = p.name.toLowerCase().includes(normalized) ||
      (p.sku && p.sku.toLowerCase().includes(normalized)) ||
      (p.barcode && p.barcode.toLowerCase().includes(normalized));
    const matchCategory = !category || p.category_id == category;

    let matchStock = true;
    if (stockFilter === 'low') matchStock = p.stock > 0 && p.stock <= p.min_stock;
    else if (stockFilter === 'out') matchStock = p.stock <= 0;
    else if (stockFilter === 'available') matchStock = p.stock > 0;

    return matchSearch && matchCategory && matchStock;
  });

  renderProductsView(filtered);

  const filteredLowStock = filtered.filter(p => p.stock > 0 && p.stock <= p.min_stock).length;
  const filteredOutStock = filtered.filter(p => p.stock <= 0).length;

  const statsBar = document.querySelector('.stats-bar');
  if (statsBar) {
    statsBar.innerHTML =
      '<span>Mostrando: <span class="count">' + filtered.length + '</span> de ' + productsData.length + '</span>' +
      '<span>| Stock bajo: <span class="count">' + filteredLowStock + '</span></span>' +
      '<span>| Sin stock: <span class="count">' + filteredOutStock + '</span></span>';
  }
}

function renderProductsView(products) {
  const container = document.getElementById('products-container');
  if (!container) return;

  if (products.length === 0) {
    container.innerHTML = '<div class="empty-state"><p>No se encontraron productos</p></div>';
    return;
  }

  if (viewMode === 'grid') {
    container.className = 'products-grid';
    container.innerHTML = products.map(p => {
      const isLow = p.stock <= p.min_stock;
      const isOut = p.stock <= 0;
      const stockClass = isOut ? 'out-of-stock' : (isLow ? 'low-stock' : 'in-stock');
      const imageUrl = app.safeImageUrl(p.image_url);
      const img = imageUrl ? '<img src="' + imageUrl + '" style="width:100%;height:100px;object-fit:contain;" onerror="this.parentElement.textContent=\'[img]\';">' : '<div style="width:100%;height:100px;display:flex;align-items:center;justify-content:center;font-size:35px;">[img]</div>';
      const wooBadge = p.woocommerce_id ? '<span class="woo-badge" title="Sincronizado con WooCommerce">W</span>' : '';

      return '<div class="product-item">' +
        '<div class="product-select" onclick="event.stopPropagation();toggleProductSelect(' + p.id + ')">' +
        '<input type="checkbox" id="sel-' + p.id + '" onchange="toggleProductSelect(' + p.id + ')">' +
        '</div>' +
        '<div class="product-image" onclick="showProductDetail(' + p.id + ')">' + img + '</div>' +
        '<div class="product-info">' +
        '<div class="product-name" onclick="showProductDetail(' + p.id + ')">' + app.escapeHtml(p.name) + ' ' + wooBadge + '</div>' +
        '<div class="product-sku">' + app.escapeHtml(p.sku || '-') + '</div>' +
        '<div class="product-price" onclick="showProductDetail(' + p.id + ')">' + app.formatMoney(p.sale_price) + '</div>' +
        '<div class="product-stock ' + stockClass + '">' +
        (isOut ? 'Sin stock' : (isLow ? 'Stock bajo: ' + p.stock : 'Stock: ' + p.stock)) +
        '</div>' +
        '<div class="product-actions" onclick="event.stopPropagation()">' +
        '<button class="btn-action btn-edit" onclick="editProduct(' + p.id + ')" title="Editar">E</button>' +
        '<button class="btn-action btn-sync" onclick="syncProductToWoo(' + p.id + ')" title="Sincronizar">S</button>' +
        '<button class="btn-action btn-delete" onclick="deleteProduct(' + p.id + ')" title="Eliminar">X</button>' +
        '</div>' +
        '</div></div>';
    }).join('');
  } else {
    container.className = '';
    container.innerHTML = '<table class="products-table"><thead><tr>' +
      '<th style="width:40px;"></th>' +
      '<th style="width:60px;">Img</th>' +
      '<th>SKU</th><th>Nombre</th><th>Categoria</th><th>Precio</th><th>Stock</th><th>Woo</th><th>Acciones</th>' +
      '</tr></thead><tbody>' +
      products.map(p => {
        const isLow = p.stock <= p.min_stock;
        const isOut = p.stock <= 0;
        const imageUrl = app.safeImageUrl(p.image_url);
        const img = imageUrl ? '<img src="' + imageUrl + '" style="width:40px;height:40px;object-fit:cover;border-radius:4px;" onerror="this.style.display=\'none\'">' : '<div style="width:40px;height:40px;background:#eee;display:flex;align-items:center;justify-content:center;">[img]</div>';
        return '<tr>' +
          '<td><input type="checkbox" id="sel-' + p.id + '" onchange="toggleProductSelect(' + p.id + ')"></td>' +
          '<td>' + img + '</td>' +
          '<td>' + app.escapeHtml(p.sku || '-') + '</td>' +
          '<td>' + app.escapeHtml(p.name) + '</td>' +
          '<td>' + app.escapeHtml(p.category_name || '-') + '</td>' +
          '<td>' + app.formatMoney(p.sale_price) + '</td>' +
          '<td><span class="badge ' + (isOut ? 'badge-red' : (isLow ? 'badge-yellow' : 'badge-green')) + '">' + p.stock + '</span></td>' +
          '<td>' + (p.woocommerce_id ? 'W' : '-') + '</td>' +
          '<td><button class="btn btn-sm btn-secondary" onclick="editProduct(' + p.id + ')">E</button> ' +
          '<button class="btn btn-sm btn-info" onclick="syncProductToWoo(' + p.id + ')">S</button> ' +
          '<button class="btn btn-sm btn-danger" onclick="deleteProduct(' + p.id + ')">X</button></td>' +
          '</tr>';
      }).join('') + '</tbody></table>';
  }
}

let selectedProducts = [];

function toggleProductSelect(id) {
  const checkbox = document.getElementById('sel-' + id);
  if (checkbox.checked) {
    if (!selectedProducts.includes(id)) selectedProducts.push(id);
  } else {
    selectedProducts = selectedProducts.filter(p => p !== id);
  }
  updateSyncButton();
}

function updateSyncButton() {
  const btn = document.getElementById('sync-single-btn');
  if (btn) {
    btn.disabled = selectedProducts.length === 0;
    btn.textContent = selectedProducts.length > 0 ? 'Sincronizar (' + selectedProducts.length + ')' : 'Sincronizar Seleccionado';
  }
}

async function syncSingleProduct() {
  if (selectedProducts.length === 0) return;

  const btn = document.getElementById('sync-single-btn');
  btn.disabled = true;
  btn.textContent = 'Sincronizando...';

  let synced = 0;
  let errors = 0;

  for (const id of selectedProducts) {
    try {
      await api.woocommerce.syncProduct(id);
      synced++;
    } catch (e) {
      errors++;
      console.error('Error syncing product', id, e);
    }
  }

  btn.disabled = false;
  btn.textContent = selectedProducts.length > 0 ? 'Sincronizar (' + selectedProducts.length + ')' : 'Sincronizar Seleccionado';
  selectedProducts = [];

  alert('Sincronizacion completada: ' + synced + ' exitosos, ' + errors + ' errores');
  renderProducts();
}

async function syncProductToWoo(id) {
  try {
    const result = await api.woocommerce.syncProduct(id);
    alert('Producto sincronizado: ' + (result.action === 'created' ? 'Creado' : 'Actualizado') + ' en WooCommerce');
    renderProducts();
  } catch (e) {
    alert('Error: ' + e.message);
  }
}

function showProductDetail(id) {
  const product = productsData.find(p => p.id === id);
  if (!product) return;

  const container = document.getElementById('modal-container');
  const imageUrl = app.safeImageUrl(product.image_url);
  const img = imageUrl ?
    '<img src="' + imageUrl + '" style="max-width:100%;max-height:250px;object-fit:contain;border-radius:8px;">' :
    '<div style="width:100%;height:150px;background:#f1f5f9;display:flex;align-items:center;justify-content:center;font-size:50px;border-radius:8px;">[img]</div>';

  const isLow = product.stock > 0 && product.stock <= product.min_stock;
  const isOut = product.stock <= 0;
  const stockClass = isOut ? 'badge-red' : (isLow ? 'badge-yellow' : 'badge-green');
  const stockText = isOut ? 'Sin stock' : (isLow ? 'Stock bajo' : 'Disponible');

  container.innerHTML =
    '<div style="position:fixed;inset:0;background:rgba(0,0,0,0.6);display:flex;align-items:center;justify-content:center;" onclick="if(event.target === this) closeProductDetailModal()">' +
    '<div style="background:white;border-radius:12px;width:95%;max-width:650px;max-height:90vh;overflow-y:auto;box-shadow:0 25px 80px rgba(0,0,0,0.4);">' +
    '<div style="padding:20px;border-bottom:1px solid #e2e8f0;display:flex;justify-content:space-between;align-items:center;">' +
    '<h3 style="margin:0;font-size:18px;color:#1e293b;">Detalle del Producto</h3>' +
    '<button onclick="closeProductDetailModal()" style="background:none;border:none;font-size:24px;cursor:pointer;color:#64748b;padding:0;width:30px;height:30px;line-height:1;">x</button>' +
    '</div>' +
    '<div style="padding:20px;">' +
    '<div style="display:grid;grid-template-columns:180px 1fr;gap:20px;">' +
    '<div style="background:#f8fafc;padding:15px;border-radius:8px;text-align:center;">' + img + '</div>' +
    '<div>' +
    '<h2 style="margin:0 0 10px 0;font-size:20px;color:#1e293b;">' + app.escapeHtml(product.name) + '</h2>' +
    '<p style="margin:5px 0;color:#64748b;font-size:13px;">SKU: ' + app.escapeHtml(product.sku || '-') + '</p>' +
    '<p style="margin:8px 0;font-size:20px;color:#2563eb;font-weight:600;">' + app.formatMoney(product.sale_price) + '</p>' +
    '<p style="margin:8px 0;"><span class="badge ' + stockClass + '">' + product.stock + ' - ' + stockText + '</span></p>' +
    '<p style="margin:5px 0;color:#64748b;font-size:13px;">Categoria: ' + app.escapeHtml(product.category_name || '-') + '</p>' +
    '<p style="margin:5px 0;color:#64748b;font-size:13px;">Proveedor: ' + app.escapeHtml(product.supplier || '-') + '</p>' +
    '<p style="margin:5px 0;color:#64748b;font-size:13px;">WooCommerce: ' + (product.woocommerce_id ? 'Sincronizado (ID: ' + product.woocommerce_id + ')' : 'No sincronizado') + '</p>' +
    '</div></div>' +
    (product.description ? '<div style="margin-top:20px;padding-top:20px;border-top:1px solid #e2e8f0;"><p style="margin:0 0 10px 0;font-weight:500;color:#1e293b;">Descripcion:</p><p style="margin:0;color:#64748b;font-size:13px;line-height:1.6;">' + app.escapeHtml(product.description) + '</p></div>' : '') +
    '</div>' +
    '<div style="padding:20px;border-top:1px solid #e2e8f0;display:flex;gap:10px;justify-content:flex-end;">' +
    '<button class="btn btn-secondary" onclick="editProduct(' + product.id + ');closeProductDetailModal();">Editar</button>' +
    '<button class="btn btn-primary" onclick="closeProductDetailModal()">Cerrar</button>' +
    '</div></div></div>';
}

function closeProductDetailModal() {
  document.getElementById('modal-container').innerHTML = '';
}

function getProductDetailModal() {
  return '';
}

function renderProductsTable(products) {
  renderProductsView(products);
}

function getProductModalHtml(cats) {
  return '<div id="product-modal" style="display:none;position:fixed;inset:0;background:rgba(0,0,0,0.5);z-index:1000;overflow-y:auto;" onclick="if(event.target === this) closeProductModal()">' +
  '<div style="background:white;border-radius:12px;width:95%;max-width:600px;margin:40px auto;box-shadow:0 25px 80px rgba(0,0,0,0.3);">' +
  '<div style="padding:20px;border-bottom:1px solid #e2e8f0;display:flex;justify-content:space-between;align-items:center;">' +
  '<h3 id="product-modal-title" style="margin:0;font-size:18px;color:#1e293b;">Nuevo Producto</h3>' +
  '<button onclick="closeProductModal()" style="background:none;border:none;font-size:24px;cursor:pointer;color:#64748b;padding:0;width:30px;height:30px;line-height:1;">x</button>' +
  '</div>' +
  '<div style="padding:20px;">' +
  '<form id="product-form">' +
  '<input type="hidden" id="product-id">' +
  '<div class="form-row"><div class="form-group"><label>SKU</label><input type="text" id="product-sku"></div>' +
  '<div class="form-group"><label>Barcode</label><input type="text" id="product-barcode"></div></div>' +
  '<div class="form-group"><label>Nombre</label><input type="text" id="product-name" required></div>' +
  '<div class="form-group"><label>URL de Imagen</label><input type="url" id="product-image" placeholder="https://..." oninput="previewProductImage()"></div>' +
  '<div id="product-image-preview" style="margin-bottom:15px;"></div>' +
  '<div class="form-group"><label>Descripcion</label><textarea id="product-description" rows="3"></textarea></div>' +
  '<div class="form-row"><div class="form-group"><label>Categoria</label><select id="product-category">' + cats + '</select></div>' +
  '<div class="form-group"><label>Proveedor</label><input type="text" id="product-supplier"></div></div>' +
  '<div class="form-row-3"><div class="form-group"><label>Precio Compra</label><input type="number" step="0.01" id="product-purchase"></div>' +
  '<div class="form-group"><label>Precio Venta</label><input type="number" step="0.01" id="product-sale"></div>' +
  '<div class="form-group"><label>Stock</label><input type="number" id="product-stock"></div></div>' +
  '<div class="form-row"><div class="form-group"><label>Stock Minimo</label><input type="number" id="product-min-stock" value="2"></div></div>' +
  '</form></div>' +
  '<div style="padding:20px;border-top:1px solid #e2e8f0;display:flex;gap:10px;justify-content:flex-end;">' +
  '<button class="btn btn-secondary" onclick="closeProductModal()">Cancelar</button>' +
  '<button class="btn btn-primary" onclick="saveProduct()">Guardar</button>' +
  '</div></div></div>';
}

function showProductModal(product) {
  document.getElementById('product-modal').style.display = 'block';
  document.getElementById('product-modal-title').textContent = product ? 'Editar Producto' : 'Nuevo Producto';
  if (product) {
    document.getElementById('product-id').value = product.id;
    document.getElementById('product-sku').value = product.sku || '';
    document.getElementById('product-barcode').value = product.barcode || '';
    document.getElementById('product-name').value = product.name;
    document.getElementById('product-category').value = product.category_id || '';
    document.getElementById('product-supplier').value = product.supplier || '';
    document.getElementById('product-purchase').value = product.purchase_price;
    document.getElementById('product-sale').value = product.sale_price;
    document.getElementById('product-stock').value = product.stock;
    document.getElementById('product-min-stock').value = product.min_stock;
    document.getElementById('product-image').value = product.image_url || '';
    document.getElementById('product-description').value = product.description || '';
    previewProductImage();
  } else {
    document.getElementById('product-form').reset();
    document.getElementById('product-id').value = '';
    document.getElementById('product-image-preview').innerHTML = '';
    document.getElementById('product-min-stock').value = '2';
  }
}

function previewProductImage() {
  const preview = document.getElementById('product-image-preview');
  const imageUrl = app.safeImageUrl(document.getElementById('product-image').value);
  if (imageUrl) {
    preview.innerHTML = '<img src="' + imageUrl + '" style="max-width:150px;max-height:150px;border-radius:8px;" onerror="this.parentElement.textContent=\'Error al cargar imagen\';">';
  } else {
    preview.innerHTML = '';
  }
}

function closeProductModal() {
  document.getElementById('product-modal').style.display = 'none';
}

function editProduct(id) {
  const product = productsData.find(p => p.id === id);
  if (product) showProductModal(product);
}

async function saveProduct() {
  const id = document.getElementById('product-id').value;
  const data = {
    sku: document.getElementById('product-sku').value,
    barcode: document.getElementById('product-barcode').value,
    name: document.getElementById('product-name').value,
    description: document.getElementById('product-description').value,
    category_id: document.getElementById('product-category').value || null,
    supplier: document.getElementById('product-supplier').value,
    purchase_price: parseFloat(document.getElementById('product-purchase').value) || 0,
    sale_price: parseFloat(document.getElementById('product-sale').value) || 0,
    stock: parseInt(document.getElementById('product-stock').value, 10) || 0,
    min_stock: parseInt(document.getElementById('product-min-stock').value, 10) || 2,
    image_url: document.getElementById('product-image').value || null
  };

  if (!data.name) {
    alert('El nombre del producto es requerido');
    return;
  }

  try {
    if (id) await api.products.update(id, data);
    else await api.products.create(data);
    closeProductModal();
    renderProducts();
  } catch (e) {
    alert(e.message);
  }
}

async function deleteProduct(id) {
  const product = productsData.find(p => p.id === id);
  if (!confirm('Eliminar el producto "' + (product ? product.name : '') + '"?')) return;
  try {
    await api.products.delete(id);
    renderProducts();
  } catch (e) {
    alert(e.message);
  }
}

console.log('Products loaded');
