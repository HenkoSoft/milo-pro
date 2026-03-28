let toolsOfflineCatalog = [];
let toolsOfflineMeta = {};
let toolsNetworkListenersBound = false;

const TOOLS_STORAGE_KEYS = {
  catalog: 'milo_tools_offline_catalog',
  meta: 'milo_tools_offline_meta'
};

const TOOLS_SECTIONS = [
  { id: 'sync', route: 'tools', label: 'Sincronizar articulos', description: 'Descarga articulos para trabajar sin internet.' },
  { id: 'offline-prices', route: 'tools-offline-prices', label: 'Consultar precios offline', description: 'Busqueda rapida por codigo o descripcion.' },
  { id: 'sync-status', route: 'tools-sync-status', label: 'Estado de sincronizacion', description: 'Resumen del estado offline disponible.' }
];

const toolsUiState = {
  activeSection: 'sync',
  search: '',
  syncInProgress: false,
  syncFeedback: null
};

function toolsEscapeHtml(value) {
  return app.escapeHtml(value ?? '');
}

function toolsEscapeAttr(value) {
  return app.escapeAttr(value ?? '');
}

function toolsNormalizeText(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function loadToolsStore(key, fallback) {
  try {
    const value = JSON.parse(localStorage.getItem(key) || 'null');
    return value ?? fallback;
  } catch (error) {
    return fallback;
  }
}

function saveToolsStore(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

function getToolsRoute(sectionId) {
  return (TOOLS_SECTIONS.find((section) => section.id === sectionId) || TOOLS_SECTIONS[0]).route;
}

function buildToolsCatalogItem(product) {
  const primaryCode = String(product.sku || product.barcode || ('ART-' + product.id)).trim();
  const extraCode = String(product.barcode || '').trim();
  const name = String(product.name || '').trim();
  const detail = String(product.description || '').trim();
  const description = [name, detail].filter((value, index, items) => value && items.indexOf(value) === index).join(' - ') || 'Sin descripcion';

  return {
    id: product.id,
    code: primaryCode,
    barcode: extraCode,
    description,
    price: Number(product.sale_price || 0)
  };
}

function hydrateToolsCatalogItem(item) {
  const code = String(item.code || item.sku || item.barcode || '').trim();
  const barcode = String(item.barcode || '').trim();
  const description = String(item.description || item.name || '').trim() || 'Sin descripcion';

  return {
    id: item.id || null,
    code,
    barcode,
    description,
    price: Number(item.price || item.sale_price || 0),
    codeSearch: toolsNormalizeText(code),
    barcodeSearch: toolsNormalizeText(barcode),
    descriptionSearch: toolsNormalizeText(description)
  };
}

function hydrateToolsStore() {
  const storedCatalog = loadToolsStore(TOOLS_STORAGE_KEYS.catalog, []);
  const storedMeta = loadToolsStore(TOOLS_STORAGE_KEYS.meta, {});

  toolsOfflineCatalog = Array.isArray(storedCatalog)
    ? storedCatalog.map(hydrateToolsCatalogItem).filter((item) => item.code || item.description)
    : [];

  toolsOfflineMeta = {
    lastSyncAt: storedMeta.lastSyncAt || '',
    priceListName: storedMeta.priceListName || 'Precio de venta',
    itemCount: Number(storedMeta.itemCount || toolsOfflineCatalog.length || 0)
  };
}

function ensureToolsNetworkListeners() {
  if (toolsNetworkListenersBound) return;
  toolsNetworkListenersBound = true;

  const rerenderIfVisible = () => {
    if (document.getElementById('tools-panel')) {
      renderToolsSection();
    }
  };

  window.addEventListener('online', rerenderIfVisible);
  window.addEventListener('offline', rerenderIfVisible);
}

function toolsHasOfflineData() {
  return toolsOfflineCatalog.length > 0;
}

function toolsIsOnline() {
  return navigator.onLine;
}

function toolsFormatSyncDate() {
  return toolsOfflineMeta.lastSyncAt ? app.formatDateTime(toolsOfflineMeta.lastSyncAt) : 'Sin sincronizar';
}

function toolsStatusLabel() {
  return toolsIsOnline() ? 'Con internet' : 'Sin internet';
}

function renderToolsShell() {
  return `
    <section class="tools-content">
      <div class="tools-panel card" id="tools-panel"></div>
    </section>
  `;
}

async function renderTools(sectionId = 'sync') {
  const content = document.getElementById('page-content');
  toolsUiState.activeSection = TOOLS_SECTIONS.some((section) => section.id === sectionId) ? sectionId : 'sync';
  ensureToolsNetworkListeners();
  hydrateToolsStore();
  content.innerHTML = renderToolsShell();
  renderToolsSection();
}

function renderToolsSectionNav() {
  return `
    <div class="tools-switcher-card">
      <div class="tools-switcher-head">
        <span class="tools-switcher-kicker">Offline</span>
        <p>Consulta rapida y continuidad operativa sin duplicar barras laterales dentro del modulo.</p>
      </div>
      <div class="tools-switcher-grid">
        ${TOOLS_SECTIONS.map((section) => `
          <button class="tools-switcher-button ${toolsUiState.activeSection === section.id ? 'is-active' : ''}" type="button" onclick="selectToolsSection('${section.id}')">
            <strong>${toolsEscapeHtml(section.label)}</strong>
            <span>${toolsEscapeHtml(section.description)}</span>
          </button>
        `).join('')}
      </div>
    </div>
  `;
}

function renderToolsModuleHead() {
  return `
    <div class="tools-module-head">
      <div>
        <p class="tools-module-kicker">Herramientas</p>
        <h2>Offline</h2>
        <p>Modulo preparado para sincronizar articulos, consultar precios sin conexion y visualizar el estado del trabajo offline.</p>
      </div>
      <div class="tools-connection-indicator ${toolsIsOnline() ? 'is-online' : 'is-offline'}">
        <span class="tools-connection-dot"></span>
        ${toolsEscapeHtml(toolsStatusLabel())}
      </div>
    </div>
  `;
}

function renderToolsSyncFeedback() {
  if (!toolsUiState.syncFeedback && !toolsHasOfflineData()) {
    return `
      <div class="tools-feedback-card tools-feedback-card--neutral">
        <strong>Sin datos offline</strong>
        <p>Sincronice articulos para habilitar la consulta de precios en este navegador.</p>
      </div>
    `;
  }

  if (!toolsUiState.syncFeedback && toolsHasOfflineData()) {
    return `
      <div class="tools-feedback-card tools-feedback-card--success">
        <strong>Sincronizacion disponible</strong>
        <p>Hay datos guardados localmente para seguir consultando precios aun sin internet.</p>
        <div class="tools-feedback-meta">
          <span>${toolsEscapeHtml(String(toolsOfflineCatalog.length))} articulos descargados</span>
          <span>Ultima sincronizacion: ${toolsEscapeHtml(toolsFormatSyncDate())}</span>
        </div>
      </div>
    `;
  }

  if (toolsUiState.syncFeedback.type === 'success') {
    return `
      <div class="tools-feedback-card tools-feedback-card--success">
        <strong>Sincronizacion completada</strong>
        <p>Los articulos quedaron disponibles para consulta offline en este navegador.</p>
        <div class="tools-feedback-meta">
          <span>${toolsEscapeHtml(String(toolsUiState.syncFeedback.count || 0))} articulos descargados</span>
          <span>Ultima sincronizacion: ${toolsEscapeHtml(app.formatDateTime(toolsUiState.syncFeedback.syncedAt))}</span>
        </div>
      </div>
    `;
  }

  return `
    <div class="tools-feedback-card tools-feedback-card--danger">
      <strong>${toolsEscapeHtml(toolsUiState.syncFeedback.title || 'No se pudo sincronizar')}</strong>
      <p>${toolsEscapeHtml(toolsUiState.syncFeedback.message || 'Revise la conexion e intente nuevamente.')}</p>
    </div>
  `;
}

function renderToolsSyncSection() {
  return `
    <div class="tools-card">
      <div class="tools-card-head">
        <div>
          <h3>Sincronizar articulos</h3>
          <p>Permite descargar los articulos necesarios para consultar codigo, descripcion y precio de venta sin conexion a internet.</p>
        </div>
        <div class="tools-inline-status ${toolsIsOnline() ? 'is-online' : 'is-offline'}">${toolsEscapeHtml(toolsStatusLabel())}</div>
      </div>

      <div class="tools-primary-action">
        <button class="btn btn-primary" type="button" onclick="syncToolsArticles()" ${toolsUiState.syncInProgress || !toolsIsOnline() ? 'disabled' : ''}>
          ${toolsUiState.syncInProgress ? 'Sincronizando articulos...' : 'Sincronizar articulos'}
        </button>
        <span>Los datos se guardan en este navegador.</span>
      </div>
    </div>

    ${renderToolsSyncFeedback()}

    <div class="tools-summary-grid">
      <article class="tools-summary-card">
        <span>Ultima sincronizacion</span>
        <strong>${toolsEscapeHtml(toolsFormatSyncDate())}</strong>
      </article>
      <article class="tools-summary-card">
        <span>Articulos descargados</span>
        <strong>${toolsEscapeHtml(String(toolsOfflineCatalog.length))}</strong>
      </article>
      <article class="tools-summary-card">
        <span>Lista de precios</span>
        <strong>${toolsEscapeHtml(toolsOfflineMeta.priceListName || 'Precio de venta')}</strong>
      </article>
    </div>
  `;
}

function toolsMatchesPrefix(item, search) {
  if (!search) return true;
  if (item.codeSearch.startsWith(search) || item.barcodeSearch.startsWith(search)) return true;
  if (item.descriptionSearch.startsWith(search)) return true;
  return item.descriptionSearch.split(/\s+/).some((token) => token.startsWith(search));
}

function getToolsFilteredCatalog() {
  const search = toolsNormalizeText(toolsUiState.search);
  if (!search) return [];
  const items = [...toolsOfflineCatalog].sort((a, b) => a.description.localeCompare(b.description));
  return items.filter((item) => toolsMatchesPrefix(item, search)).slice(0, 150);
}

function renderToolsOfflinePricesSection() {
  const rows = getToolsFilteredCatalog();

  return `
    <div class="tools-card">
      <div class="tools-card-head">
        <div>
          <h3>Consultar precios offline</h3>
          <p>Busqueda rapida para mostrador, con resultados en tiempo real y sin necesidad de conexion activa.</p>
        </div>
        <div class="tools-table-badge">${toolsEscapeHtml(String(rows.length))} resultados</div>
      </div>

      <div class="form-group tools-search-group">
        <label>Buscar por codigo o descripcion</label>
        <input type="text" value="${toolsEscapeAttr(toolsUiState.search)}" placeholder="Escriba codigo o descripcion" oninput="updateToolsSearch(this.value)" autocomplete="off">
        <small>Busqueda por prefijo. Si todavia no sincronizo, no habra resultados.</small>
      </div>

      <div class="tools-table-wrap">
        <table class="tools-table">
          <thead>
            <tr>
              <th>Codigo</th>
              <th>Descripcion</th>
              <th>Precio</th>
            </tr>
          </thead>
          <tbody>
            ${rows.length === 0 ? `
              <tr>
                <td colspan="3" class="tools-empty-row">${!toolsHasOfflineData() ? 'Todavia no hay articulos sincronizados en este navegador.' : (!toolsUiState.search ? 'Ingrese codigo o descripcion para comenzar la busqueda.' : 'No hay coincidencias para la busqueda actual.')}</td>
              </tr>
            ` : rows.map((item) => `
              <tr>
                <td><strong>${toolsEscapeHtml(item.code || '-')}</strong></td>
                <td>${toolsEscapeHtml(item.description)}</td>
                <td>${toolsEscapeHtml(app.formatMoney(item.price || 0))}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

function renderToolsSyncStatusSection() {
  const available = toolsHasOfflineData();

  return `
    <div class="tools-summary-grid">
      <article class="tools-summary-card ${available ? 'is-available' : 'is-empty'}">
        <span>Ultima sincronizacion</span>
        <strong>${toolsEscapeHtml(toolsFormatSyncDate())}</strong>
      </article>
      <article class="tools-summary-card ${available ? 'is-available' : 'is-empty'}">
        <span>Cantidad de articulos descargados</span>
        <strong>${toolsEscapeHtml(String(toolsOfflineCatalog.length))}</strong>
      </article>
      <article class="tools-summary-card ${available ? 'is-available' : 'is-empty'}">
        <span>Lista de precios sincronizada</span>
        <strong>${toolsEscapeHtml(toolsOfflineMeta.priceListName || 'Precio de venta')}</strong>
      </article>
    </div>

    <div class="tools-status-banner ${available ? 'is-available' : 'is-empty'}">
      <div class="tools-status-pill ${available ? 'is-available' : 'is-empty'}"></div>
      <div>
        <strong>${available ? 'Consulta offline disponible en este navegador' : 'Sin datos offline en este navegador'}</strong>
        <p>${available ? 'El modo offline esta listo para consulta rapida de precios en mostrador.' : 'Sincronice articulos con internet para habilitar la consulta offline.'}</p>
      </div>
    </div>

    <div class="tools-card">
      <div class="tools-card-head">
        <div>
          <h3>Estado de sincronizacion</h3>
          <p>Resumen visual del material disponible localmente para continuar operando aun si la conexion se interrumpe.</p>
        </div>
        <div class="tools-inline-status ${available ? 'is-online' : 'is-offline'}">${available ? 'Disponible' : 'Sin datos'}</div>
      </div>

      <div class="tools-status-grid">
        <article class="tools-status-item">
          <span>Estado actual</span>
          <strong>${available ? 'Sincronizacion disponible' : 'Sin datos offline'}</strong>
        </article>
        <article class="tools-status-item">
          <span>Conexion actual</span>
          <strong>${toolsEscapeHtml(toolsStatusLabel())}</strong>
        </article>
        <article class="tools-status-item">
          <span>Almacenamiento</span>
          <strong>Este navegador</strong>
        </article>
      </div>
    </div>
  `;
}

function renderToolsActiveSection() {
  if (toolsUiState.activeSection === 'offline-prices') {
    return renderToolsOfflinePricesSection();
  }
  if (toolsUiState.activeSection === 'sync-status') {
    return renderToolsSyncStatusSection();
  }
  return renderToolsSyncSection();
}

function renderToolsSection() {
  hydrateToolsStore();
  const panel = document.getElementById('tools-panel');
  if (!panel) return;

  panel.innerHTML = `
    ${renderToolsModuleHead()}
    ${renderToolsSectionNav()}
    ${renderToolsActiveSection()}
  `;
}

function selectToolsSection(sectionId) {
  toolsUiState.activeSection = TOOLS_SECTIONS.some((section) => section.id === sectionId) ? sectionId : 'sync';
  window.location.hash = getToolsRoute(toolsUiState.activeSection);
}

function updateToolsSearch(value) {
  toolsUiState.search = value || '';
  renderToolsSection();
}

async function syncToolsArticles() {
  if (toolsUiState.syncInProgress) return;

  if (!toolsIsOnline()) {
    toolsUiState.syncFeedback = {
      type: 'danger',
      title: 'Sin internet',
      message: 'Necesita conexion activa para descargar los articulos.'
    };
    renderToolsSection();
    return;
  }

  toolsUiState.syncInProgress = true;
  toolsUiState.syncFeedback = null;
  renderToolsSection();

  try {
    const products = await api.products.getAll({});
    const catalog = Array.isArray(products)
      ? products.map(buildToolsCatalogItem).filter((item) => item.code || item.description)
      : [];
    const syncedAt = new Date().toISOString();

    saveToolsStore(TOOLS_STORAGE_KEYS.catalog, catalog);
    saveToolsStore(TOOLS_STORAGE_KEYS.meta, {
      lastSyncAt: syncedAt,
      priceListName: 'Precio de venta',
      itemCount: catalog.length
    });

    toolsUiState.syncFeedback = {
      type: 'success',
      count: catalog.length,
      syncedAt
    };
    toolsUiState.search = '';
  } catch (error) {
    toolsUiState.syncFeedback = {
      type: 'danger',
      title: 'No se pudo completar la sincronizacion',
      message: error.message || 'Ocurrio un error al descargar los articulos.'
    };
  } finally {
    toolsUiState.syncInProgress = false;
    hydrateToolsStore();
    renderToolsSection();
  }
}

window.renderTools = renderTools;
window.selectToolsSection = selectToolsSection;
window.updateToolsSearch = updateToolsSearch;
window.syncToolsArticles = syncToolsArticles;
