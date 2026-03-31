let productsData = [];
let categoriesData = [];
let suppliersData = [];
let brandsData = [];

const PRODUCT_SECTIONS = [
  { id: 'planilla', label: 'Planilla' },
  { id: 'price-update', label: 'Actualizacion de Precios' },
  { id: 'stock-adjustment', label: 'Ajuste de Stock' },
  { id: 'stock-output', label: 'Salida de Mercaderia' },
  { id: 'stock-query', label: 'Consulta de Salidas' },
  { id: 'labels', label: 'Imprimir Etiquetas' },
  { id: 'barcodes', label: 'Impresion de Codigos de Barra' },
  { id: 'qr', label: 'Impresion de Codigos QR' }
];

const PRODUCT_UNITS = ['Unidad', 'Pack', 'Caja', 'Metro', 'Kg', 'Litro', 'Servicio'];
const PRODUCT_IVA_OPTIONS = [0, 10.5, 21, 27];

const productsUiState = {
  activeSection: 'planilla',
  modalTab: 'data',
  planillaSearch: '',
  planillaCategory: '',
  planillaStock: '',
  modalImages: [],
  dragImageIndex: null,
  modalImageUrlsDraft: ''
};

function productsEscapeHtml(value) {
  return app.escapeHtml(value ?? '');
}

function productsEscapeAttr(value) {
  return app.escapeAttr(value ?? '');
}

function parseProductDecimal(value) {
  const normalized = String(value ?? '')
    .trim()
    .replace(/\s+/g, '')
    .replace(',', '.');
  const parsed = Number.parseFloat(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatProductDecimal(value, digits = 2) {
  return parseProductDecimal(value).toFixed(digits);
}

function roundProductSalePrice(value) {
  const amount = parseProductDecimal(value);
  if (amount <= 0) return 0;
  return Math.ceil(amount / 10) * 10;
}

function formatProductPercent(value) {
  const amount = parseProductDecimal(value);
  return Number.isInteger(amount) ? String(amount) : formatProductDecimal(amount);
}

function buildOptions(options, selectedValue, placeholder) {
  const current = String(selectedValue || '');
  let html = placeholder ? '<option value="">' + productsEscapeHtml(placeholder) + '</option>' : '';
  options.forEach((option) => {
    const value = typeof option === 'object' ? option.value : option;
    const label = typeof option === 'object' ? option.label : option;
    html += '<option value="' + productsEscapeAttr(value) + '"' + (current === String(value) ? ' selected' : '') + '>' + productsEscapeHtml(label) + '</option>';
  });
  return html;
}

function getSupplierNames() {
  const apiSuppliers = suppliersData.map((item) => item.name).filter(Boolean);
  const productSuppliers = productsData.map((item) => item.supplier).filter(Boolean);
  return [...new Set([...apiSuppliers, ...productSuppliers])].sort((a, b) => a.localeCompare(b));
}

function getCategoryOptions(selectedValue) {
  return buildOptions(
    categoriesData.map((item) => ({ value: item.id, label: item.full_name || item.name })),
    selectedValue,
    'Seleccionar categoria'
  );
}

function getBrandOptions(selectedValue) {
  return buildOptions(brandsData.map((item) => ({ value: item.id, label: item.name })), selectedValue, 'Seleccionar marca');
}

async function renderProducts(sectionId = 'planilla') {
  const content = document.getElementById('page-content');
  content.innerHTML = '<div class="loading">Cargando...</div>';
  productsUiState.activeSection = sectionId;

  try {
    const [products, categories, suppliers, brands] = await Promise.all([
      api.products.getAll({}),
      api.categories.getAll(),
      api.purchases && api.purchases.getSuppliers ? api.purchases.getSuppliers().catch(() => []) : Promise.resolve([]),
      api.deviceOptions && api.deviceOptions.getBrands ? api.deviceOptions.getBrands().catch(() => []) : Promise.resolve([])
    ]);

    productsData = products;
    categoriesData = categories;
    suppliersData = suppliers;
    brandsData = Array.isArray(brands) ? brands : [];

    content.innerHTML = renderProductsShell();
    renderProductsSection();
  } catch (error) {
    content.innerHTML = '<div class="alert alert-warning">Error: ' + productsEscapeHtml(error.message) + '</div>';
  }
}

function renderProductsShell() {
  return `
    <section class="products-admin-content">
      <div class="products-admin-panel card" id="products-admin-panel"></div>
    </section>
  `;
}

function selectProductSection(sectionId) {
  const routeMap = {
    planilla: 'products',
    'price-update': 'products-price-update',
    'stock-adjustment': 'products-stock-adjustment',
    'stock-output': 'products-stock-output',
    'stock-query': 'products-stock-query',
    labels: 'products-labels',
    barcodes: 'products-barcodes',
    qr: 'products-qr'
  };
  window.location.hash = routeMap[sectionId] || 'products';
}

function renderProductsSection() {
  const panel = document.getElementById('products-admin-panel');
  if (!panel) return;

  if (productsUiState.activeSection === 'planilla') {
    panel.innerHTML = renderProductsPlanilla();
    return;
  }

  panel.innerHTML = renderProductsModule(productsUiState.activeSection);
}

function getFilteredProducts() {
  const search = String(productsUiState.planillaSearch || '').trim().toLowerCase();
  const category = String(productsUiState.planillaCategory || '').trim();
  const stock = String(productsUiState.planillaStock || '').trim();

  return productsData.filter((product) => {
    const matchesSearch = !search || [product.sku, product.barcode, product.name, product.description, product.brand_name, product.color]
      .some((value) => String(value || '').toLowerCase().includes(search));
    const categoryIds = Array.isArray(product.category_ids) ? product.category_ids.map((item) => String(item)) : [String(product.category_id || '')];
    const matchesCategory = !category || categoryIds.includes(category);

    let matchesStock = true;
    if (stock === 'low') matchesStock = Number(product.stock) > 0 && Number(product.stock) <= Number(product.min_stock || 0);
    if (stock === 'out') matchesStock = Number(product.stock) <= 0;
    if (stock === 'available') matchesStock = Number(product.stock) > 0;

    return matchesSearch && matchesCategory && matchesStock;
  });
}

function renderProductsPlanilla() {
  const filtered = getFilteredProducts();
  const lowStock = filtered.filter((item) => Number(item.stock) > 0 && Number(item.stock) <= Number(item.min_stock || 0)).length;
  const outOfStock = filtered.filter((item) => Number(item.stock) <= 0).length;

  return `
    <div class="products-module-head">
      <div>
        <p class="products-module-kicker">Planilla</p>
        <h2>Planilla de Articulos</h2>
        <p>Vista principal con filtros, stock y acceso directo al alta de articulos.</p>
      </div>
      <div class="products-module-actions">
        <button class="btn btn-primary" type="button" onclick="showProductModal()">+ Nuevo Articulo</button>
        <button class="btn btn-secondary" type="button" onclick="renderProducts()">Actualizar</button>
      </div>
    </div>
    <div class="products-sheet-toolbar">
      <div class="products-sheet-filters">
        <div class="form-group">
          <label>Buscar</label>
          <input id="product-search" type="text" value="${productsEscapeAttr(productsUiState.planillaSearch)}" placeholder="Codigo o descripcion..." oninput="updateProductsPlanillaSearch(this.value)">
        </div>
        <div class="form-group">
          <label>Categoria</label>
          <select id="product-category-filter" onchange="updateProductsPlanillaCategory(this.value)">${getCategoryOptions(productsUiState.planillaCategory)}</select>
        </div>
        <div class="form-group">
          <label>Stock</label>
          <select id="product-stock-filter" onchange="updateProductsPlanillaStock(this.value)">
            ${buildOptions([
              { value: '', label: 'Todos' },
              { value: 'available', label: 'Disponible' },
              { value: 'low', label: 'Stock bajo' },
              { value: 'out', label: 'Sin stock' }
            ], productsUiState.planillaStock, '')}
          </select>
        </div>
      </div>
      <div class="products-sheet-stats">
        <span><strong>${filtered.length}</strong> articulos</span>
        <span><strong>${lowStock}</strong> stock bajo</span>
        <span><strong>${outOfStock}</strong> sin stock</span>
      </div>
    </div>
    <div class="products-sheet-table-wrap">
      <table class="products-sheet-table">
        <thead>
          <tr>
            <th>Foto</th>
            <th>Codigo</th>
            <th>Cod. Prov.</th>
            <th>Descripcion</th>
            <th>Marca</th>
            <th>Color</th>
            <th>Proveedor</th>
            <th>Categoria</th>
            <th>Sync</th>
            <th>Woo ID</th>
            <th>Stock</th>
            <th>Costo</th>
            <th>Lista 1</th>
            <th>Acciones</th>
          </tr>
        </thead>
        <tbody>
          ${filtered.length === 0 ? `
            <tr><td colspan="14" class="products-sheet-empty">No hay articulos para mostrar.</td></tr>
          ` : filtered.map((product) => `
            <tr>
              <td>
                ${app.safeImageUrl(product.image_url)
                  ? `<img src="${app.safeImageUrl(product.image_url)}" class="products-sheet-thumb" alt="${productsEscapeAttr(product.name || 'Articulo')}">`
                  : '<div class="products-sheet-thumb products-sheet-thumb--empty">Sin foto</div>'}
              </td>
              <td>${productsEscapeHtml(product.sku || 'ART-' + product.id)}</td>
              <td>${productsEscapeHtml(product.barcode || '-')}</td>
              <td><strong>${productsEscapeHtml(product.name)}</strong></td>
              <td>${productsEscapeHtml(product.brand_name || '-')}</td>
              <td>${productsEscapeHtml(product.color || '-')}</td>
              <td>${productsEscapeHtml(product.supplier || '-')}</td>
              <td>${productsEscapeHtml((product.category_names || []).join(', ') || product.category_name || (categoriesData.find((item) => String(item.id) === String(product.category_id)) || {}).name || '-')}</td>
              <td><span class="badge ${product.sync_status === 'error' ? 'badge-red' : (product.sync_status === 'synced' ? 'badge-green' : 'badge-yellow')}">${productsEscapeHtml(product.sync_status || 'pending')}</span></td>
              <td>${productsEscapeHtml(product.woocommerce_product_id || product.woocommerce_id || '-')}</td>
              <td><span class="badge ${Number(product.stock) <= 0 ? 'badge-red' : (Number(product.stock) <= Number(product.min_stock || 0) ? 'badge-yellow' : 'badge-green')}">${productsEscapeHtml(product.stock)}</span></td>
              <td>${productsEscapeHtml(app.formatMoney(product.purchase_price || 0))}</td>
              <td>${productsEscapeHtml(app.formatMoney(product.sale_price || 0))}</td>
              <td>
                <div class="btn-group">
                  <button class="btn btn-sm btn-secondary" type="button" onclick="showProductModal(${product.id})">Editar</button>
                  <button class="btn btn-sm btn-info" type="button" onclick="syncProductToWoo(${product.id})">Sync</button>
                  <button class="btn btn-sm btn-secondary" type="button" onclick="retryProductImagesToWoo(${product.id})">Img</button>
                  <button class="btn btn-sm btn-secondary" type="button" onclick="reconcileProductToWoo(${product.id})">SKU</button>
                  <button class="btn btn-sm btn-danger" type="button" onclick="deleteProduct(${product.id})">Eliminar</button>
                </div>
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;
}

function rerenderProductsPlanilla() {
  if (productsUiState.activeSection !== 'planilla') return;
  renderProductsSection();
}

function restoreProductsPlanillaSearchFocus(selectionStart, selectionEnd) {
  if (productsUiState.activeSection !== 'planilla') return;
  const input = document.getElementById('product-search');
  if (!input) return;
  input.focus();
  if (typeof selectionStart === 'number' && typeof selectionEnd === 'number') {
    input.setSelectionRange(selectionStart, selectionEnd);
  }
}

function updateProductsPlanillaSearch(value) {
  const activeInput = document.activeElement;
  const shouldRestoreFocus = activeInput && activeInput.id === 'product-search';
  const selectionStart = shouldRestoreFocus ? activeInput.selectionStart : null;
  const selectionEnd = shouldRestoreFocus ? activeInput.selectionEnd : null;
  productsUiState.planillaSearch = value || '';
  rerenderProductsPlanilla();
  if (shouldRestoreFocus) {
    restoreProductsPlanillaSearchFocus(selectionStart, selectionEnd);
  }
}

function updateProductsPlanillaCategory(value) {
  productsUiState.planillaCategory = value || '';
  rerenderProductsPlanilla();
}

function updateProductsPlanillaStock(value) {
  productsUiState.planillaStock = value || '';
  rerenderProductsPlanilla();
}

function renderProductsModule(sectionId) {
  const sampleRows = productsData.slice(0, 6).map((product) => `
    <tr>
      <td>${productsEscapeHtml(product.sku || 'ART-' + product.id)}</td>
      <td>${productsEscapeHtml(product.name)}</td>
      <td>${productsEscapeHtml(product.stock)}</td>
      <td><button class="btn btn-sm btn-secondary" type="button" onclick="showProductUiNotice('${PRODUCT_SECTIONS.find((item) => item.id === sectionId).label}')">Accion</button></td>
    </tr>
  `).join('');

  const titles = {
    'price-update': ['Actualizacion de Precios', 'Calcular Lista de Precios', `
      <div class="products-inline-grid">
        <div class="form-group"><label>Marca</label><select>${buildOptions([], '', 'Todas')}</select></div>
        <div class="form-group"><label>Rubro</label><select>${buildOptions([], '', 'Todos')}</select></div>
        <div class="form-group"><label>Proveedor</label><select>${buildOptions(getSupplierNames(), '', 'Todos')}</select></div>
        <div class="form-group"><label>Categoria</label><select>${getCategoryOptions('')}</select></div>
        <div class="form-group"><label>Lista a actualizar</label><select>${buildOptions(['Lista 1', 'Lista 2', 'Lista 3', 'Lista 4', 'Lista 5', 'Lista 6'], 'Lista 1', '')}</select></div>
        <div class="form-group"><label>Tomando como base</label><select>${buildOptions(['Costo', 'Lista 1', 'Lista 2', 'Lista 3', 'Lista 4', 'Lista 5', 'Lista 6'], 'Costo', '')}</select></div>
        <div class="form-group"><label>Valor</label><input type="number" value="0"></div>
        <div class="form-group"><label>Modo</label><div class="products-segmented"><label><input type="radio" checked> %</label><label><input type="radio"> $</label></div></div>
        <div class="form-group"><label>Redondear a</label><select>${buildOptions([0, 1, 5, 10, 50, 100].map((item) => ({ value: item, label: item === 0 ? 'Sin redondeo' : item })), '0', '')}</select></div>
      </div>
    `],
    'stock-adjustment': ['Ajuste de Stock', 'Planilla de Ajuste', `
      <div class="products-split-layout">
        <section class="products-split-panel">
          <div class="form-group"><label>Buscar por codigo o descripcion (F1,F2)</label><input type="text" placeholder="Buscar..."></div>
          <div class="products-help-line">Ingrese la cantidad del nuevo stock y pulse Enter.</div>
          <div class="products-sheet-table-wrap"><table class="products-sheet-table"><thead><tr><th>Codigo</th><th>Descripcion</th><th>Stock actual</th><th>Nuevo stock</th></tr></thead><tbody>${productsData.slice(0, 8).map((product) => `<tr><td>${productsEscapeHtml(product.sku || 'ART-' + product.id)}</td><td>${productsEscapeHtml(product.name)}</td><td>${productsEscapeHtml(product.stock)}</td><td><input class="products-inline-number" type="number" value="${productsEscapeAttr(product.stock)}"></td></tr>`).join('')}</tbody></table></div>
        </section>
        <section class="products-split-panel">
          <div class="products-subtitle">Ajustes a realizar</div>
          <div class="products-sheet-table-wrap"><table class="products-sheet-table"><thead><tr><th>Codigo</th><th>Descripcion</th><th>Nuevo stock</th><th>Accion</th></tr></thead><tbody><tr><td colspan="4" class="products-sheet-empty">Vista UI preparada para futura integracion.</td></tr></tbody></table></div>
          <div class="products-actions-right"><button class="btn btn-success" type="button" onclick="showProductUiNotice('Ajuste de Stock')">Guardar cambios</button></div>
        </section>
      </div>
    `],
    'stock-output': ['Salida de Mercaderia', 'Registrar Salida', `
      <div class="products-config-card">
        <div class="products-inline-grid">
          <div class="form-group"><label>Usuario</label><input type="text" value="${productsEscapeAttr((window.auth && window.auth.currentUser && window.auth.currentUser.name) || 'Operador')}" readonly></div>
          <div class="form-group"><label>Fecha</label><input type="date" value="${new Date().toISOString().slice(0, 10)}"></div>
          <div class="form-group products-output-search"><label>Codigo de articulo</label><div class="products-inline-action"><input type="text" placeholder="Codigo de articulo"><button class="btn btn-secondary" type="button" onclick="showProductUiNotice('Salida de Mercaderia')">Buscar (F5)</button></div></div>
        </div>
      </div>
    `],
    'stock-query': ['Consulta de Salidas', 'Historial de Salidas', `
      <div class="products-module-actions"><button class="btn btn-danger" type="button" onclick="showProductUiNotice('Consulta de Salidas')">Borrar entre fechas</button></div>
      <div class="products-query-search"><label>Buscar</label><input type="text" placeholder="Buscar salida..."></div>
    `],
    labels: ['Impresion de Etiquetas', 'Cargar articulos', `
      <div class="products-config-card"><div class="products-inline-grid"><div class="form-group products-output-search"><label>Codigo (Enter para agregar)</label><div class="products-inline-action"><input type="text" placeholder="Codigo"><button class="btn btn-secondary" type="button" onclick="showProductUiNotice('Imprimir Etiquetas')">Buscar (F5)</button></div></div><div class="products-actions-inline"><button class="btn btn-secondary" type="button" onclick="showProductUiNotice('Imprimir Etiquetas')">Poner cantidad en 1</button></div></div></div>
    `],
    barcodes: ['Impresion de Codigos de Barra', 'Cargar articulos', `
      <div class="products-config-card"><div class="products-inline-grid"><div class="form-group products-output-search"><label>Codigo (Enter para agregar)</label><div class="products-inline-action"><input type="text" placeholder="Codigo"><button class="btn btn-secondary" type="button" onclick="showProductUiNotice('Impresion de Codigos de Barra')">Buscar (F5)</button></div></div></div></div>
    `],
    qr: ['Impresion de Codigos QR', 'Cargar articulos', `
      <div class="products-config-card"><div class="products-inline-grid"><div class="form-group products-output-search"><label>Codigo (Enter para agregar)</label><div class="products-inline-action"><input type="text" placeholder="Codigo"><button class="btn btn-secondary" type="button" onclick="showProductUiNotice('Impresion de Codigos QR')">Buscar (F5)</button></div></div></div></div>
    `]
  };

  const config = titles[sectionId];
  const extraActions = sectionId === 'barcodes' || sectionId === 'qr'
    ? `<button class="btn btn-secondary" type="button" onclick="selectProductSection('planilla')">Salir</button>`
    : '';
  const primaryText = sectionId === 'stock-output' ? 'Guardar salida' : 'Aceptar';

  return `
    <div class="products-module-head">
      <div>
        <p class="products-module-kicker">${config[0]}</p>
        <h2>${config[1]}</h2>
        <p>Interfaz preparada con el mismo lenguaje visual que Clientes.</p>
      </div>
    </div>
    ${config[2]}
    <div class="products-sheet-table-wrap">
      <table class="products-sheet-table">
        <thead>
          <tr>
            <th>Codigo</th>
            <th>Descripcion</th>
            <th>Stock</th>
            <th>Accion</th>
          </tr>
        </thead>
        <tbody>
          ${sampleRows || '<tr><td colspan="4" class="products-sheet-empty">No hay datos para mostrar.</td></tr>'}
        </tbody>
      </table>
    </div>
    <div class="products-actions-right">
      ${extraActions}
      <button class="btn btn-success" type="button" onclick="showProductUiNotice('${config[0]}')">${primaryText}</button>
    </div>
  `;
}

function buildProductModalImageState(product) {
  const images = product && Array.isArray(product.images) && product.images.length > 0
    ? product.images
    : (product && product.image_url ? [{ url_publica: product.image_url, es_principal: 1, orden: 0, origen: 'url' }] : []);

  return images.map((item, index) => ({
    id: item.id || null,
    nombre_archivo: item.nombre_archivo || null,
    ruta_local: item.ruta_local || item.url_local || null,
    url_publica: item.url_publica || item.url_remote || item.url_local || null,
    url_local: item.url_local || item.ruta_local || null,
    url_remote: item.url_remote || null,
    woocommerce_media_id: item.woocommerce_media_id || null,
    es_principal: Number(item.es_principal || 0) === 1 || index === 0,
    orden: Number.isFinite(Number(item.orden)) ? Number(item.orden) : index,
    optimizada: !!item.optimizada,
    origen: item.origen || (item.ruta_local || (item.url_publica || '').startsWith('/productos/') ? 'local' : 'url'),
    upload_data: null,
    preview_url: item.url_publica || item.url_remote || item.url_local || ''
  }));
}

function renderProductImageManager() {
  const images = (productsUiState.modalImages || [])
    .slice()
    .sort((a, b) => Number(a.orden || 0) - Number(b.orden || 0));

  const manualUrlsText = productsUiState.modalImageUrlsDraft || images
    .filter((item) => item.origen === 'url' && !item.upload_data && /^https?:\/\//i.test(item.url_publica || item.url_remote || ''))
    .map((item) => item.url_publica || item.url_remote || '')
    .join('\n');

  return `
    <div class="products-image-manager">
      <input id="product-image-upload" type="file" accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp" multiple hidden onchange="handleProductImagePickerChange(event)">
      <div class="products-image-dropzone" ondragover="handleProductImageDragOver(event)" ondrop="handleProductImageDrop(event)">
        <strong>Subir imagenes</strong>
        <span>Arrastra archivos aqui o selecciona desde tu PC. Se optimizan automaticamente a WEBP 1200x1200.</span>
        <div class="products-image-dropzone-actions">
          <button class="btn btn-secondary" type="button" onclick="openProductImagePicker()">Seleccionar archivos</button>
        </div>
      </div>
      <div class="form-group">
        <label>URLs manuales opcionales</label>
        <textarea id="product-image-urls" rows="3" placeholder="Una URL por linea" oninput="updateProductImageUrlsDraft(this.value)">${productsEscapeHtml(manualUrlsText)}</textarea>
      </div>
      <div class="products-image-gallery">
        ${images.length === 0 ? '<div class="products-sheet-empty">Todavia no hay imagenes cargadas.</div>' : images.map((image, index) => `
          <article class="products-image-card${image.es_principal ? ' is-primary' : ''}" draggable="true" ondragstart="startProductImageReorder(${index})" ondragover="allowProductImageReorder(event)" ondrop="dropProductImageReorder(${index})">
            <div class="products-image-card-media">
              ${(image.preview_url && app.safeImageUrl(image.preview_url))
                ? `<img src="${app.safeImageUrl(image.preview_url)}" alt="Imagen ${index + 1}">`
                : '<div class="products-modal-photo-placeholder">Sin preview</div>'}
            </div>
            <div class="products-image-card-meta">
              <strong>${productsEscapeHtml(image.nombre_archivo || `Imagen ${index + 1}`)}</strong>
              <span>${productsEscapeHtml(image.optimizada || image.upload_data || image.origen === 'local' ? 'Optimizada automaticamente' : 'URL externa')}</span>
            </div>
            <div class="products-image-card-actions">
              <button class="btn btn-sm ${image.es_principal ? 'btn-success' : 'btn-secondary'}" type="button" onclick="setProductPrimaryImage(${index})">${image.es_principal ? 'Principal' : 'Hacer principal'}</button>
              <button class="btn btn-sm btn-secondary" type="button" onclick="moveProductImage(${index}, -1)" ${index === 0 ? 'disabled' : ''}>Subir</button>
              <button class="btn btn-sm btn-secondary" type="button" onclick="moveProductImage(${index}, 1)" ${index === images.length - 1 ? 'disabled' : ''}>Bajar</button>
              <button class="btn btn-sm btn-danger" type="button" onclick="removeProductImage(${index})">Eliminar</button>
            </div>
          </article>
        `).join('')}
      </div>
    </div>
  `;
}

function buildProductModalHtml(product) {
  const supplierOptions = buildOptions(getSupplierNames(), product ? product.supplier : '', 'Seleccionar proveedor');
  const categoryOptions = getCategoryOptions(product ? (product.category_primary_id || product.category_id) : '');
  const categoryIds = product && Array.isArray(product.category_ids) ? product.category_ids.map((item) => String(item)) : [];
  const brandOptions = getBrandOptions(product ? product.brand_id : '');
  const preview = product && app.safeImageUrl(product.image_url)
    ? '<img src="' + app.safeImageUrl(product.image_url) + '" class="products-modal-photo-img" alt="Foto">'
    : '<div class="products-modal-photo-placeholder">Sin imagen</div>';
  const defaultTax = 21;
  const baseCost = Number(product && product.purchase_price ? product.purchase_price : 0);
  const baseSale = Number(product && product.sale_price ? product.sale_price : 0);
  const inferredMargin = baseCost > 0
    ? Math.max(0, (((baseSale / (1 + defaultTax / 100)) / baseCost) - 1) * 100)
    : 35;

  return `
    <div class="modal products-modal">
      <div class="modal-header products-modal-header">
        <div>
          <h3>Nuevo Articulo</h3>
          <p>Formulario reorganizado en tabs con layout tipo sistema de gestion.</p>
        </div>
        <button type="button" class="modal-close" onclick="closeProductModal()">&times;</button>
      </div>
      <form id="product-form" novalidate onsubmit="event.preventDefault(); return false;">
        <input type="hidden" id="product-id" value="${productsEscapeAttr(product ? product.id : '')}">
        <input type="hidden" id="product-image" value="${productsEscapeAttr(product ? (product.image_url || '') : '')}">
        <div class="products-modal-tabs">
          <button type="button" class="products-modal-tab${productsUiState.modalTab === 'data' ? ' is-active' : ''}" data-tab="data" onclick="setProductModalTab('data')">Datos</button>
          <button type="button" class="products-modal-tab${productsUiState.modalTab === 'prices' ? ' is-active' : ''}" data-tab="prices" onclick="setProductModalTab('prices')">Listas de precios</button>
        </div>
        <div class="modal-body products-modal-body">
          <div id="product-form-feedback" class="products-form-feedback" hidden></div>
          <section class="products-modal-panel${productsUiState.modalTab === 'data' ? ' is-active' : ''}" data-panel="data">
            <div class="products-modal-data-layout">
              <div class="products-modal-data-grid">
                <div class="form-group"><label>Codigo</label><input id="product-sku" type="text" value="${productsEscapeAttr(product ? product.sku : '')}"></div>
                <div class="form-group"><label>Cod. Prov.</label><input id="product-barcode" type="text" value="${productsEscapeAttr(product ? product.barcode : '')}"></div>
                <div class="form-group products-field-span-2"><label>Descripcion</label><input id="product-name" type="text" value="${productsEscapeAttr(product ? product.name : '')}" required></div>
                <div class="form-group"><label>Rubro</label><div class="products-input-combo"><select>${buildOptions([], '', 'Seleccionar rubro')}</select><button type="button" class="products-addon-button" onclick="showProductUiNotice('Alta de rubro')">+</button></div></div>
                <div class="products-woo-attributes-card products-field-span-2">
                  <div class="products-woo-attributes-head">
                    <strong>Atributos WooCommerce</strong>
                    <span>Marca y Color ayudan a que el producto se publique completo y se encuentre mejor en WooCommerce.</span>
                  </div>
                  <div class="products-woo-attributes-grid">
                    <div class="form-group"><label>Marca</label><div class="products-input-combo"><select id="product-brand">${brandOptions}</select><button type="button" class="products-addon-button" onclick="showProductUiNotice('Alta de marca')">+</button></div></div>
                    <div class="form-group"><label>Color</label><input id="product-color" type="text" value="${productsEscapeAttr(product ? (product.color || '') : '')}" placeholder="Ej: Negro"></div>
                  </div>
                </div>
                <div class="form-group"><label>Ubicacion</label><input type="text"></div>
                <div class="form-group"><label>Unidad</label><div class="products-input-combo"><select>${buildOptions(PRODUCT_UNITS, 'Unidad', 'Seleccionar unidad')}</select><button type="button" class="products-addon-button" onclick="showProductUiNotice('Alta de unidad')">+</button></div></div>
                <div class="form-group"><label>Proveedor</label><select id="product-supplier">${supplierOptions}</select></div>
                <div class="form-group"><label>Categoria principal</label><select id="product-category">${categoryOptions}</select><div class="products-help-inline">Gestiona el arbol en Administracion -> Categorias</div></div>
                <div class="form-group products-field-span-2"><label>Categorias adicionales</label><select id="product-category-multi" multiple size="6">${categoriesData.map((item) => `<option value="${productsEscapeAttr(item.id)}"${categoryIds.includes(String(item.id)) ? ' selected' : ''}>${productsEscapeHtml(item.full_name || item.name)}</option>`).join('')}</select><div class="products-help-inline">Puede elegir varias categorias. La principal tambien queda dentro de esta relacion.</div></div>
                <div class="form-group products-field-span-2"><label>Descripcion corta</label><input id="product-short-description" type="text" value="${productsEscapeAttr(product ? (product.short_description || '') : '')}"></div>
                <div class="form-group"><label>Stock</label><input id="product-stock" type="number" value="${productsEscapeAttr(product ? product.stock : 0)}"></div>
                <div class="form-group"><label>Stock minimo</label><input id="product-min-stock" type="number" value="${productsEscapeAttr(product ? product.min_stock : 2)}"></div>
                <div class="form-group"><label>Estado sync</label><input type="text" value="${productsEscapeAttr(product ? (product.sync_status || 'pending') : 'pending')}" readonly></div>
                <div class="form-group"><label>ID WooCommerce</label><input type="text" value="${productsEscapeAttr(product ? (product.woocommerce_product_id || product.woocommerce_id || '') : '')}" readonly></div>
                <div class="products-check-row products-field-span-2"><label><input type="checkbox"> Promocion</label><label><input type="checkbox"> Servicio</label></div>
              </div>
              <aside class="products-modal-photo-card">
                <div class="products-modal-photo-title">Foto del producto</div>
                <div id="product-image-preview" class="products-modal-photo-frame">${preview}</div>
                <button class="btn btn-secondary" type="button" onclick="changeProductPhoto()">Cambiar foto</button>
                <div id="product-image-manager-slot" style="margin-top:12px;">${renderProductImageManager()}</div>
              </aside>
            </div>
          </section>
          <section class="products-modal-panel${productsUiState.modalTab === 'prices' ? ' is-active' : ''}" data-panel="prices">
            <div class="products-price-config-grid">
              <div class="form-group"><label>Costo</label><input id="product-purchase" type="text" inputmode="decimal" value="${productsEscapeAttr(formatProductDecimal(baseCost))}" onfocus="this.select()" oninput="updateProductPriceCalculation()" onblur="formatProductPriceField('product-purchase')"></div>
              <div class="form-group"><label>Utilidad %</label><input id="product-margin" type="text" inputmode="decimal" value="${productsEscapeAttr(formatProductPercent(inferredMargin))}" onfocus="this.select()" oninput="updateProductPriceCalculation()" onblur="formatProductPercentField('product-margin')"></div>
              <div class="form-group"><label>IVA</label><select id="product-tax" onchange="updateProductPriceCalculation()">${buildOptions(PRODUCT_IVA_OPTIONS.map((item) => ({ value: item, label: item + '%' })), String(defaultTax), '')}</select></div>
              <div class="form-group"><label>Impuesto interno (%)</label><input type="number" step="0.01" value="0"></div>
              <div class="products-check-row"><label><input type="checkbox"> Costo en dolares</label></div>
            </div>
            <div class="products-price-summary" id="product-price-summary"></div>
            <div class="products-sheet-table-wrap">
              <table class="products-sheet-table products-price-table">
                <thead><tr><th>Lista</th><th>Calculada</th><th>% Ganancia</th><th>Con IVA</th><th>En dolares</th><th>Valor</th></tr></thead>
                <tbody>
                  ${['1','2','3','4','5','6'].map((item, index) => `
                    <tr>
                      <td>Lista ${item}</td>
                      <td><input type="checkbox" ${index === 0 ? 'id="product-calc-enabled" checked onchange="toggleProductPriceMode()"' : ''}></td>
                      <td><input class="products-inline-number" type="text" inputmode="decimal" ${index === 0 ? `id="product-margin-table" value="${productsEscapeAttr(formatProductPercent(inferredMargin))}" onfocus="this.select()" oninput="syncProductMarginFromTable(this.value)" onblur="formatProductPercentField('product-margin-table')"` : 'value="0"'}></td>
                      <td><input type="checkbox" ${index === 0 ? 'id="product-include-tax" checked onchange="updateProductPriceCalculation()"' : 'checked'}></td>
                      <td><input type="checkbox"></td>
                      <td><input class="products-inline-number" type="text" inputmode="decimal" ${index === 0 ? `id="product-sale" value="${productsEscapeAttr(formatProductDecimal(baseSale))}" onfocus="selectProductSaleValue()" onblur="formatProductPriceField('product-sale')"` : 'value="0.00"'} ${index === 0 ? 'readonly' : ''}></td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
            <div class="products-help-line">La Lista 1 se calcula en vivo con costo, utilidad e IVA. Si desmarca "Calculada", puede editar el valor de venta manualmente.</div>
          </section>
        </div>
        <div class="modal-footer products-modal-footer">
          <button class="btn btn-secondary" type="button" onclick="closeProductModal()">Cancelar</button>
          <button class="btn btn-success" id="product-save-button" type="button" onclick="saveProduct()">Guardar</button>
        </div>
      </form>
    </div>
  `;
}

function setProductModalTab(tabId) {
  productsUiState.modalTab = tabId;
  document.querySelectorAll('.products-modal-tab').forEach((tab) => {
    tab.classList.toggle('is-active', tab.getAttribute('data-tab') === tabId);
  });
  document.querySelectorAll('.products-modal-panel').forEach((panel) => {
    panel.classList.toggle('is-active', panel.getAttribute('data-panel') === tabId);
  });
}

function showProductModal(id) {
  productsUiState.modalTab = 'data';
  const product = id ? productsData.find((item) => item.id === id) : null;
  productsUiState.modalImages = buildProductModalImageState(product || null);
  productsUiState.dragImageIndex = null;
  productsUiState.modalImageUrlsDraft = (product && Array.isArray(product.images) ? product.images : [])
    .map((item) => item.url_remote || '')
    .filter((item) => /^https?:\/\//i.test(item))
    .join('\n');
  app.showModal(buildProductModalHtml(product || null));
  initializeProductPriceCalculator();
  refreshProductImageUi();
}

function closeProductModal() {
  app.closeModal();
}

function sortModalImages() {
  const images = (productsUiState.modalImages || []).slice().sort((a, b) => Number(a.orden || 0) - Number(b.orden || 0));
  const primaryIndex = images.findIndex((item) => item.es_principal);
  productsUiState.modalImages = images.map((item, index) => ({
    ...item,
    orden: index,
    es_principal: primaryIndex >= 0 ? index === primaryIndex : index === 0
  }));
  if (productsUiState.modalImages.length > 0 && !productsUiState.modalImages.some((item) => item.es_principal)) {
    productsUiState.modalImages[0].es_principal = true;
  }
}

function refreshProductImageUi() {
  const urlsField = document.getElementById('product-image-urls');
  if (urlsField) {
    productsUiState.modalImageUrlsDraft = urlsField.value || '';
  }
  sortModalImages();
  const slot = document.getElementById('product-image-manager-slot');
  if (slot) {
    slot.innerHTML = renderProductImageManager();
  }

  const primaryImage = (productsUiState.modalImages || []).find((item) => item.es_principal) || (productsUiState.modalImages || [])[0] || null;
  const input = document.getElementById('product-image');
  if (input) {
    input.value = primaryImage ? (primaryImage.url_publica || primaryImage.url_remote || primaryImage.url_local || '') : '';
  }
  const preview = document.getElementById('product-image-preview');
  if (preview) {
    const imageUrl = primaryImage ? app.safeImageUrl(primaryImage.preview_url || primaryImage.url_publica || primaryImage.url_remote || primaryImage.url_local || '') : '';
    preview.innerHTML = imageUrl ? '<img src="' + imageUrl + '" class="products-modal-photo-img" alt="Foto">' : '<div class="products-modal-photo-placeholder">Sin imagen</div>';
  }
}

function updateProductImageUrlsDraft(value) {
  productsUiState.modalImageUrlsDraft = value || '';
}

function openProductImagePicker() {
  const input = document.getElementById('product-image-upload');
  if (input) input.click();
}

async function appendFilesToProductImages(files) {
  const list = Array.from(files || []);
  for (const file of list) {
    if (!/^image\/(jpeg|png|webp)$/i.test(file.type)) {
      setProductFormFeedback('Formato no permitido. Use JPG, PNG o WEBP.');
      continue;
    }
    if (file.size > 10 * 1024 * 1024) {
      setProductFormFeedback('La imagen "' + file.name + '" supera el maximo permitido de 10MB.');
      continue;
    }

    const dataUrl = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ''));
      reader.onerror = () => reject(new Error('No se pudo leer la imagen.'));
      reader.readAsDataURL(file);
    }).catch((error) => {
      setProductFormFeedback(error.message || 'No se pudo leer la imagen.');
      return '';
    });

    if (!dataUrl) continue;

    productsUiState.modalImages.push({
      id: null,
      nombre_archivo: file.name,
      ruta_local: null,
      url_publica: null,
      url_local: null,
      url_remote: null,
      woocommerce_media_id: null,
      es_principal: productsUiState.modalImages.length === 0,
      orden: productsUiState.modalImages.length,
      optimizada: true,
      origen: 'upload',
      upload_data: dataUrl,
      preview_url: dataUrl
    });
  }
  refreshProductImageUi();
}

function handleProductImagePickerChange(event) {
  appendFilesToProductImages(event && event.target ? event.target.files : []);
  if (event && event.target) event.target.value = '';
}

function handleProductImageDragOver(event) {
  event.preventDefault();
}

function handleProductImageDrop(event) {
  event.preventDefault();
  appendFilesToProductImages(event.dataTransfer ? event.dataTransfer.files : []);
}

function setProductPrimaryImage(index) {
  productsUiState.modalImages = (productsUiState.modalImages || []).map((item, itemIndex) => ({
    ...item,
    es_principal: itemIndex === index
  }));
  refreshProductImageUi();
}

function moveProductImage(index, delta) {
  const images = (productsUiState.modalImages || []).slice();
  const target = index + delta;
  if (target < 0 || target >= images.length) return;
  const temp = images[index];
  images[index] = images[target];
  images[target] = temp;
  productsUiState.modalImages = images.map((item, itemIndex) => ({ ...item, orden: itemIndex }));
  refreshProductImageUi();
}

function removeProductImage(index) {
  productsUiState.modalImages = (productsUiState.modalImages || []).filter((_, itemIndex) => itemIndex !== index);
  refreshProductImageUi();
}

function startProductImageReorder(index) {
  productsUiState.dragImageIndex = index;
}

function allowProductImageReorder(event) {
  event.preventDefault();
}

function dropProductImageReorder(targetIndex) {
  const sourceIndex = Number(productsUiState.dragImageIndex);
  if (!Number.isFinite(sourceIndex) || sourceIndex === targetIndex) return;
  const images = (productsUiState.modalImages || []).slice();
  const [moved] = images.splice(sourceIndex, 1);
  images.splice(targetIndex, 0, moved);
  productsUiState.modalImages = images.map((item, index) => ({ ...item, orden: index }));
  productsUiState.dragImageIndex = null;
  refreshProductImageUi();
}

function changeProductPhoto() {
  const input = document.getElementById('product-image');
  const textarea = document.getElementById('product-image-urls');
  const current = input ? input.value : '';
  const next = prompt('Ingresa la URL de la foto del producto', current || '');
  if (next === null || !input) return;
  const url = next.trim();
  input.value = url;
  if (url) {
    const existingIndex = (productsUiState.modalImages || []).findIndex((item) => (item.url_publica || item.url_remote || '') === url);
    if (existingIndex >= 0) {
      setProductPrimaryImage(existingIndex);
    } else {
      productsUiState.modalImages.unshift({
        id: null,
        nombre_archivo: null,
        ruta_local: null,
        url_publica: url,
        url_local: null,
        url_remote: url,
        woocommerce_media_id: null,
        es_principal: true,
        orden: 0,
        optimizada: false,
        origen: 'url',
        upload_data: null,
        preview_url: url
      });
      productsUiState.modalImages = productsUiState.modalImages.map((item, index) => ({
        ...item,
        es_principal: index === 0,
        orden: index
      }));
      refreshProductImageUi();
    }
  }
  if (textarea) {
    const manualUrls = (productsUiState.modalImages || [])
      .filter((item) => item.origen === 'url' && /^https?:\/\//i.test(item.url_publica || item.url_remote || ''))
      .map((item) => item.url_publica || item.url_remote || '');
    textarea.value = manualUrls.join('\n');
    productsUiState.modalImageUrlsDraft = textarea.value;
  }
}

function showProductUiNotice(featureName) {
  alert(featureName + ' disponible en esta version como redisenio UI, sin cambiar la logica actual.');
}

function formatProductPriceField(fieldId) {
  const input = document.getElementById(fieldId);
  if (!input) return;
  input.value = formatProductDecimal(input.value);
  if (fieldId !== 'product-sale') updateProductPriceCalculation();
}

function formatProductPercentField(fieldId) {
  const input = document.getElementById(fieldId);
  if (!input) return;
  input.value = formatProductPercent(input.value);
  updateProductPriceCalculation();
}

function selectProductSaleValue() {
  const saleInput = document.getElementById('product-sale');
  if (saleInput && !saleInput.readOnly) saleInput.select();
}

function syncProductMarginFromTable(value) {
  const marginInput = document.getElementById('product-margin');
  if (marginInput) marginInput.value = value;
  updateProductPriceCalculation();
}

function toggleProductPriceMode() {
  const calcEnabled = document.getElementById('product-calc-enabled');
  const saleInput = document.getElementById('product-sale');
  if (!calcEnabled || !saleInput) return;
  saleInput.readOnly = calcEnabled.checked;
  saleInput.classList.toggle('is-manual', !calcEnabled.checked);
  if (calcEnabled.checked) updateProductPriceCalculation();
}

function updateProductPriceCalculation() {
  const costInput = document.getElementById('product-purchase');
  const marginInput = document.getElementById('product-margin');
  const marginTableInput = document.getElementById('product-margin-table');
  const taxInput = document.getElementById('product-tax');
  const includeTaxInput = document.getElementById('product-include-tax');
  const calcEnabled = document.getElementById('product-calc-enabled');
  const saleInput = document.getElementById('product-sale');
  const summary = document.getElementById('product-price-summary');
  if (!costInput || !marginInput || !taxInput || !saleInput) return;

  const cost = parseProductDecimal(costInput.value);
  const margin = parseProductDecimal(marginInput.value);
  const tax = parseProductDecimal(taxInput.value);
  const includeTax = includeTaxInput ? includeTaxInput.checked : true;
  const netSale = cost * (1 + margin / 100);
  const rawFinalSale = includeTax ? netSale * (1 + tax / 100) : netSale;
  const finalSale = roundProductSalePrice(rawFinalSale);

  if (marginTableInput && marginTableInput !== document.activeElement) {
    marginTableInput.value = formatProductPercent(margin);
  }

  if (!calcEnabled || calcEnabled.checked) {
    saleInput.value = formatProductDecimal(finalSale);
  }

  if (summary) {
    summary.innerHTML = `
      <div class="products-price-summary-card">
        <span>Costo</span>
        <strong>${productsEscapeHtml(app.formatMoney(cost))}</strong>
      </div>
      <div class="products-price-summary-card">
        <span>Neto con utilidad</span>
        <strong>${productsEscapeHtml(app.formatMoney(netSale))}</strong>
      </div>
      <div class="products-price-summary-card">
        <span>IVA</span>
        <strong>${productsEscapeHtml(includeTax ? `${formatProductDecimal(tax)}%` : 'No incluido')}</strong>
      </div>
      <div class="products-price-summary-card">
        <span>Redondeo</span>
        <strong>${productsEscapeHtml(app.formatMoney(finalSale - rawFinalSale))}</strong>
      </div>
      <div class="products-price-summary-card products-price-summary-card--accent">
        <span>Venta sugerida</span>
        <strong>${productsEscapeHtml(app.formatMoney(finalSale))}</strong>
      </div>
    `;
  }
}

function initializeProductPriceCalculator() {
  toggleProductPriceMode();
  updateProductPriceCalculation();
}

function setProductFormFeedback(message, type = 'error') {
  const feedback = document.getElementById('product-form-feedback');
  if (!feedback) return;
  if (!message) {
    feedback.hidden = true;
    feedback.textContent = '';
    feedback.className = 'products-form-feedback';
    return;
  }
  feedback.hidden = false;
  feedback.textContent = message;
  feedback.className = 'products-form-feedback products-form-feedback--' + type;
}

function focusProductField(fieldId, tabId) {
  if (tabId && productsUiState.modalTab !== tabId) {
    setProductModalTab(tabId);
  }
  const field = document.getElementById(fieldId);
  if (field) {
    field.focus();
    if (typeof field.select === 'function' && field.tagName === 'INPUT') field.select();
  }
}

async function saveProduct() {
  const saveButton = document.getElementById('product-save-button');
  const id = (document.getElementById('product-id') || {}).value || '';
  const primaryCategoryId = ((document.getElementById('product-category') || {}).value || '') || null;
  const categoryMulti = document.getElementById('product-category-multi');
  const selectedExtraCategories = categoryMulti
    ? Array.from(categoryMulti.selectedOptions || []).map((option) => option.value)
    : [];
  const imageUrls = String((document.getElementById('product-image-urls') || {}).value || '')
    .split(/\r?\n/)
    .map((item) => item.trim())
    .filter(Boolean);
  const modalImages = (productsUiState.modalImages || []).map((item) => ({ ...item }));
  const existingUrls = new Set(modalImages.map((item) => item.url_publica || item.url_remote || item.preview_url || '').filter(Boolean));
  imageUrls.forEach((url) => {
    if (!existingUrls.has(url)) {
      modalImages.push({
        id: null,
        nombre_archivo: null,
        ruta_local: null,
        url_publica: url,
        url_local: null,
        url_remote: url,
        woocommerce_media_id: null,
        es_principal: modalImages.length === 0,
        orden: modalImages.length,
        optimizada: false,
        origen: 'url',
        upload_data: null,
        preview_url: url
      });
    }
  });
  const normalizedModalImages = modalImages.map((item, index) => ({
    ...item,
    es_principal: item.es_principal || index === 0,
    orden: index
  }));
  const primaryModalImage = normalizedModalImages.find((item) => item.es_principal) || normalizedModalImages[0] || null;
  const data = {
    sku: ((document.getElementById('product-sku') || {}).value || '').trim(),
    barcode: ((document.getElementById('product-barcode') || {}).value || '').trim(),
    name: ((document.getElementById('product-name') || {}).value || '').trim(),
    description: '',
    short_description: ((document.getElementById('product-short-description') || {}).value || '').trim(),
    color: ((document.getElementById('product-color') || {}).value || '').trim(),
    category_id: primaryCategoryId,
    category_primary_id: primaryCategoryId,
    category_ids: [...new Set([primaryCategoryId, ...selectedExtraCategories].filter(Boolean))],
    brand_id: ((document.getElementById('product-brand') || {}).value || '') || null,
    supplier: ((document.getElementById('product-supplier') || {}).value || '').trim(),
    purchase_price: parseProductDecimal((document.getElementById('product-purchase') || {}).value || 0),
    sale_price: parseProductDecimal((document.getElementById('product-sale') || {}).value || 0),
    stock: Number((document.getElementById('product-stock') || {}).value || 0),
    min_stock: Number((document.getElementById('product-min-stock') || {}).value || 2),
    image_url: ((document.getElementById('product-image') || {}).value || '').trim() || (primaryModalImage ? (primaryModalImage.url_publica || primaryModalImage.url_remote || primaryModalImage.preview_url || '') : '') || imageUrls[0] || null,
    images: normalizedModalImages.map((item, index) => ({
      id: item.id || null,
      nombre_archivo: item.nombre_archivo || null,
      ruta_local: item.ruta_local || null,
      url_publica: item.url_publica || null,
      url_local: item.url_local || null,
      url_remote: item.url_remote || null,
      woocommerce_media_id: item.woocommerce_media_id || null,
      es_principal: item.es_principal || index === 0,
      orden: index,
      upload_data: item.upload_data || null
    }))
  };

  setProductFormFeedback('');

  if (!data.name) {
    setProductFormFeedback('La descripcion del articulo es obligatoria.');
    focusProductField('product-name', 'data');
    return;
  }

  if (!data.brand_id) {
    setProductFormFeedback('La marca es obligatoria para publicar el articulo correctamente en WooCommerce.');
    focusProductField('product-brand', 'data');
    return;
  }

  if (!data.color) {
    setProductFormFeedback('El color es obligatorio para publicar el articulo correctamente en WooCommerce.');
    focusProductField('product-color', 'data');
    return;
  }

  if (data.purchase_price < 0) {
    setProductFormFeedback('El precio de costo no puede ser negativo.');
    focusProductField('product-purchase', 'prices');
    return;
  }

  if (data.sale_price <= 0) {
    setProductFormFeedback('El precio de venta debe ser mayor a cero.');
    focusProductField('product-sale', 'prices');
    return;
  }

  if (data.stock < 0) {
    setProductFormFeedback('El stock no puede ser negativo.');
    focusProductField('product-stock', 'data');
    return;
  }

  if (data.min_stock < 0) {
    setProductFormFeedback('El stock minimo no puede ser negativo.');
    focusProductField('product-min-stock', 'data');
    return;
  }

  try {
    if (saveButton) {
      saveButton.disabled = true;
      saveButton.textContent = 'Guardando...';
    }
    const response = id ? await api.products.update(id, data) : await api.products.create(data);
    const syncWarning = response && response.sync_warning ? String(response.sync_warning) : '';
    if (syncWarning) {
      const skuDuplicate = /sku/i.test(syncWarning) && /duplic|tabla de b[uú]squeda|search/i.test(syncWarning);
      setProductFormFeedback(
        skuDuplicate
          ? 'El articulo se guardo en la app, pero no se publico en WooCommerce porque el SKU ya existe. Cambia el SKU y vuelve a sincronizar.'
          : 'El articulo se guardo en la app, pero WooCommerce devolvio un problema: ' + syncWarning,
        'error'
      );
      await renderProducts();
      return;
    }
    if (normalizedModalImages.length > 0 && (!response || !Array.isArray(response.images) || response.images.length === 0)) {
      setProductFormFeedback('El articulo se guardo, pero las imagenes no quedaron asociadas. Reinicia la app y vuelve a intentar la carga.', 'error');
      await renderProducts();
      return;
    }
    setProductFormFeedback('Articulo guardado correctamente.', 'success');
    closeProductModal();
    renderProducts();
  } catch (error) {
    setProductFormFeedback(error.message || 'No se pudo guardar el articulo.');
  } finally {
    if (saveButton) {
      saveButton.disabled = false;
      saveButton.textContent = 'Guardar';
    }
  }
}

async function syncProductToWoo(id) {
  try {
    await api.woocommerce.syncProduct(id);
    alert('Articulo sincronizado correctamente');
    renderProducts();
  } catch (error) {
    alert('Error: ' + error.message);
  }
}

async function retryProductImagesToWoo(id) {
  try {
    await api.woocommerce.retryProductImages(id);
    alert('Se reintentaron las imagenes del articulo en WooCommerce');
    renderProducts();
  } catch (error) {
    alert('Error: ' + error.message);
  }
}

async function reconcileProductToWoo(id) {
  try {
    const result = await api.woocommerce.reconcileProduct(id);
    alert(result && result.reconciled_by_sku
      ? 'Articulo reconciliado por SKU y sincronizado en WooCommerce'
      : 'Articulo sincronizado en WooCommerce');
    renderProducts();
  } catch (error) {
    alert('Error: ' + error.message);
  }
}

async function deleteProduct(id) {
  const product = productsData.find((item) => item.id === id);
  if (!confirm('Eliminar el articulo "' + (product ? product.name : '') + '"?')) return;

  try {
    const result = await api.products.delete(id);
    if (result && result.remote_delete_warning) {
      alert('El producto se elimino en la app, pero WooCommerce no permitio borrarlo: ' + result.remote_delete_warning);
    }
    renderProducts();
  } catch (error) {
    alert(error.message);
  }
}

window.renderProducts = renderProducts;
window.selectProductSection = selectProductSection;
window.updateProductsPlanillaSearch = updateProductsPlanillaSearch;
window.updateProductsPlanillaCategory = updateProductsPlanillaCategory;
window.updateProductsPlanillaStock = updateProductsPlanillaStock;
window.showProductModal = showProductModal;
window.closeProductModal = closeProductModal;
window.changeProductPhoto = changeProductPhoto;
window.openProductImagePicker = openProductImagePicker;
window.handleProductImagePickerChange = handleProductImagePickerChange;
window.handleProductImageDragOver = handleProductImageDragOver;
window.handleProductImageDrop = handleProductImageDrop;
window.updateProductImageUrlsDraft = updateProductImageUrlsDraft;
window.setProductPrimaryImage = setProductPrimaryImage;
window.moveProductImage = moveProductImage;
window.removeProductImage = removeProductImage;
window.startProductImageReorder = startProductImageReorder;
window.allowProductImageReorder = allowProductImageReorder;
window.dropProductImageReorder = dropProductImageReorder;
window.setProductModalTab = setProductModalTab;
window.formatProductPriceField = formatProductPriceField;
window.formatProductPercentField = formatProductPercentField;
window.selectProductSaleValue = selectProductSaleValue;
window.syncProductMarginFromTable = syncProductMarginFromTable;
window.toggleProductPriceMode = toggleProductPriceMode;
window.updateProductPriceCalculation = updateProductPriceCalculation;
window.saveProduct = saveProduct;
window.syncProductToWoo = syncProductToWoo;
window.retryProductImagesToWoo = retryProductImagesToWoo;
window.reconcileProductToWoo = reconcileProductToWoo;
window.deleteProduct = deleteProduct;

console.log('Products loaded');
