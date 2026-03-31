let wooIntegrationState = {
  status: { connected: false },
  logs: [],
  syncResult: null,
  feedback: null,
  syncProgress: null,
  syncRunning: false
};

const WOO_DEFAULT_STATUS_MAP = {
  pending: 'pendiente',
  processing: 'procesando',
  completed: 'completado',
  cancelled: 'cancelado',
  refunded: 'reintegrado',
  failed: 'fallido'
};

function wooEscapeHtml(value) {
  return app.escapeHtml(value ?? '');
}

function wooEscapeAttr(value) {
  return app.escapeAttr(value ?? '');
}

function parseWooStatusMap(rawValue) {
  if (!rawValue) return { ...WOO_DEFAULT_STATUS_MAP };
  if (typeof rawValue === 'object') return { ...WOO_DEFAULT_STATUS_MAP, ...rawValue };
  try {
    return { ...WOO_DEFAULT_STATUS_MAP, ...JSON.parse(rawValue) };
  } catch (error) {
    return { ...WOO_DEFAULT_STATUS_MAP };
  }
}

async function loadWooIntegrationData() {
  const [status, logs] = await Promise.all([
    api.woocommerce.status().catch(() => ({ connected: false })),
    api.woocommerce.logs().catch(() => [])
  ]);
  wooIntegrationState.status = status || { connected: false };
  wooIntegrationState.logs = Array.isArray(logs) ? logs : [];
  return wooIntegrationState;
}

function getWooIntegrationFeedbackHtml() {
  if (!wooIntegrationState.feedback) return '';
  return `<div class="admin-woo-feedback admin-woo-feedback--${wooEscapeAttr(wooIntegrationState.feedback.type || 'info')}">${wooEscapeHtml(wooIntegrationState.feedback.message)}</div>`;
}

function getWooIntegrationProgressHtml() {
  const syncProgress = wooIntegrationState.syncProgress;
  if (!syncProgress) return '';
  return `
    <div class="admin-woo-progress-card">
      <p><strong>${wooEscapeHtml(syncProgress.status || 'Sincronizando...')}</strong></p>
      <div class="admin-woo-progress-bar">
        <div class="admin-woo-progress-fill" style="width:${wooEscapeAttr(syncProgress.progress || 0)}%;"></div>
      </div>
      <p>${wooEscapeHtml(syncProgress.progress || 0)}%</p>
    </div>
  `;
}

function getWooIntegrationSyncResultHtml() {
  const syncResult = wooIntegrationState.syncResult;
  if (!syncResult) return '';
  return `
    <div class="admin-process-card">
      <h4>Ultimo resultado</h4>
      <p><strong>Importados:</strong> ${wooEscapeHtml((syncResult.results || {}).imported || 0)}</p>
      <p><strong>Exportados:</strong> ${wooEscapeHtml((syncResult.results || {}).exported || 0)}</p>
      <p><strong>Actualizados:</strong> ${wooEscapeHtml((syncResult.results || {}).updated || 0)}</p>
      <p><strong>Errores:</strong> ${wooEscapeHtml(((syncResult.results || {}).errors || []).length)}</p>
    </div>
  `;
}

function getWooIntegrationStatsHtml() {
  const status = wooIntegrationState.status || {};
  const lastSync = status.last_sync ? app.formatDateTime(status.last_sync) : 'Nunca';
  const errorCount = ((status.logs_summary || {}).errors) || 0;
  return `
    <div class="admin-woo-stats-grid">
      <article class="admin-woo-stat-card">
        <span>Ultima sincronizacion</span>
        <strong>${wooEscapeHtml(lastSync)}</strong>
      </article>
      <article class="admin-woo-stat-card">
        <span>Errores recientes</span>
        <strong>${wooEscapeHtml(errorCount)}</strong>
      </article>
      <article class="admin-woo-stat-card">
        <span>Direccion</span>
        <strong>${wooEscapeHtml(status.sync_direction || 'export')}</strong>
      </article>
      <article class="admin-woo-stat-card admin-woo-stat-card--status ${status.connected ? 'is-online' : 'is-offline'}">
        <span>Estado</span>
        <strong>${status.connected ? 'Listo' : 'Pendiente'}</strong>
      </article>
    </div>
  `;
}

function getWooIntegrationRecentErrorsHtml() {
  const status = wooIntegrationState.status || {};
  const recentErrors = (((status.logs_summary || {}).recent_errors) || []).slice(0, 5);
  if (recentErrors.length === 0) {
    return '<div class="sales-empty-row">No hay errores recientes registrados.</div>';
  }
  return `
    <div class="admin-woo-log-list">
      ${recentErrors.map((item) => `
        <article class="admin-woo-log-item">
          <strong>${wooEscapeHtml(item.action || 'sync')}</strong>
          <span>${wooEscapeHtml(item.message || 'Sin detalle')}</span>
          <small>${wooEscapeHtml(app.formatDateTime(item.synced_at || ''))}</small>
        </article>
      `).join('')}
    </div>
  `;
}

function getWooIntegrationSyncButtonHtml() {
  const status = wooIntegrationState.status || {};
  const disabled = !status.connected || wooIntegrationState.syncRunning;
  const label = wooIntegrationState.syncRunning ? 'Sincronizando...' : 'Sincronizar ahora';
  return `<button class="btn btn-success" type="button" onclick="runAdminWooSyncNow()" ${disabled ? 'disabled' : ''}>${wooEscapeHtml(label)}</button>`;
}

function updateWooIntegrationLiveUi() {
  const feedbackSlot = document.getElementById('admin-woo-feedback-slot');
  if (feedbackSlot) feedbackSlot.innerHTML = getWooIntegrationFeedbackHtml();

  const progressSlot = document.getElementById('admin-woo-progress-slot');
  if (progressSlot) progressSlot.innerHTML = getWooIntegrationProgressHtml();

  const resultSlot = document.getElementById('admin-woo-result-slot');
  if (resultSlot) resultSlot.innerHTML = getWooIntegrationSyncResultHtml();

  const statsSlot = document.getElementById('admin-woo-stats-slot');
  if (statsSlot) statsSlot.innerHTML = getWooIntegrationStatsHtml();

  const errorsSlot = document.getElementById('admin-woo-errors-slot');
  if (errorsSlot) errorsSlot.innerHTML = getWooIntegrationRecentErrorsHtml();

  const syncButtonSlot = document.getElementById('admin-woo-sync-button-slot');
  if (syncButtonSlot) syncButtonSlot.innerHTML = getWooIntegrationSyncButtonHtml();
}

function renderWooIntegrationSummaryCards() {
  const status = wooIntegrationState.status || {};
  const recentErrors = (((status.logs_summary || {}).recent_errors) || []).slice(0, 5);
  const totalProcessed = ((status.logs_summary || {}).processed) || wooIntegrationState.logs.length;
  const totalErrors = ((status.logs_summary || {}).errors) || recentErrors.length;
  const lastSync = status.last_sync ? app.formatDateTime(status.last_sync) : 'Nunca';

  return `
    <div class="admin-woo-stats-grid">
      <article class="admin-woo-stat-card">
        <span>Ultima sincronizacion</span>
        <strong>${wooEscapeHtml(lastSync)}</strong>
      </article>
      <article class="admin-woo-stat-card">
        <span>Registros procesados</span>
        <strong>${wooEscapeHtml(totalProcessed)}</strong>
      </article>
      <article class="admin-woo-stat-card">
        <span>Errores recientes</span>
        <strong>${wooEscapeHtml(totalErrors)}</strong>
      </article>
      <article class="admin-woo-stat-card admin-woo-stat-card--status ${status.connected ? 'is-online' : 'is-offline'}">
        <span>Estado</span>
        <strong>${status.connected ? 'Conectado' : 'Pendiente'}</strong>
      </article>
    </div>
    <div class="admin-table-card">
      <div class="admin-table-header-note">Errores recientes de WooCommerce</div>
      ${recentErrors.length === 0 ? '<div class="sales-empty-row">No hay errores recientes registrados.</div>' : `
        <div class="admin-woo-log-list">
          ${recentErrors.map((item) => `
            <article class="admin-woo-log-item">
              <strong>${wooEscapeHtml(item.action || 'sync')}</strong>
              <span>${wooEscapeHtml(item.message || 'Sin detalle')}</span>
              <small>${wooEscapeHtml(app.formatDateTime(item.synced_at || ''))}</small>
            </article>
          `).join('')}
        </div>
      `}
    </div>
  `;
}

function renderWooIntegrationAdminSection() {
  const status = wooIntegrationState.status || {};
  const statusMap = parseWooStatusMap(status.order_status_map);
  const logs = wooIntegrationState.logs.slice(0, 10);
  return `
    <div class="admin-module-head">
      <div>
        <p class="admin-module-kicker">Administracion</p>
        <h2>WooCommerce</h2>
        <p>Conexion y sincronizacion directa con WooCommerce.</p>
      </div>
      <div class="tools-inline-status ${status.connected ? 'is-online' : 'is-offline'}">${status.connected ? 'Conectado' : 'Sin configurar'}</div>
    </div>

    <div id="admin-woo-feedback-slot">${getWooIntegrationFeedbackHtml()}</div>

    <div class="admin-form-card">
      <div class="admin-table-header-note">Conexion</div>
      <div class="admin-form-grid">
        <div class="form-group admin-field-span-2"><label>URL de la tienda</label><input id="admin-woo-url" type="url" value="${wooEscapeAttr(status.store_url || '')}" placeholder="https://mitienda.com"></div>
        <div class="form-group"><label>Consumer Key</label><input id="admin-woo-key" type="text" value="" placeholder="${status.has_consumer_key ? 'Configurada' : 'ck_xxxxx'}"></div>
        <div class="form-group"><label>Consumer Secret</label><input id="admin-woo-secret" type="password" value="" placeholder="${status.has_consumer_secret ? 'Guardado' : 'cs_xxxxx'}"></div>
        <div class="form-group"><label>WP usuario</label><input id="admin-woo-wp-user" type="text" value="" placeholder="${status.has_wp_username ? 'Configurado' : 'usuario-wordpress'}"></div>
        <div class="form-group"><label>WP App Password</label><input id="admin-woo-wp-password" type="password" value="" placeholder="${status.has_wp_app_password ? 'Guardada' : 'xxxx xxxx xxxx xxxx'}"></div>
        <div class="form-group"><label>Version API</label><input id="admin-woo-api-version" type="text" value="${wooEscapeAttr(status.api_version || 'wc/v3')}"></div>
        <div class="form-group"><label>Modo</label><select id="admin-woo-direction">${renderWooSelectOptions([
          { value: 'both', label: 'Bidireccional' },
          { value: 'import', label: 'Solo importar de WooCommerce' },
          { value: 'export', label: 'Solo exportar a WooCommerce' }
        ], status.sync_direction || 'export')}</select></div>
      </div>
      <div class="admin-actions-row">
        <button class="btn btn-secondary" type="button" onclick="testAdminWooConnection()">Probar conexion</button>
        <button class="btn btn-primary" type="button" onclick="saveAdminWooConfig()">Guardar configuracion</button>
        <button class="btn btn-danger" type="button" onclick="disconnectAdminWooCommerce()" ${status.connected ? '' : 'disabled'}>Desconectar</button>
      </div>
    </div>

    <div class="admin-form-card">
      <div class="admin-table-header-note">Sincronizacion</div>
      <div id="admin-woo-stats-slot">${getWooIntegrationStatsHtml()}</div>
      <div class="admin-form-grid">
        <div class="form-group">
          <label class="admin-switch-row">
            <input id="admin-woo-autosync" type="checkbox" ${status.auto_sync ? 'checked' : ''}>
            <span>Sincronizacion automatica</span>
          </label>
        </div>
      </div>
      <div id="admin-woo-progress-slot">${getWooIntegrationProgressHtml()}</div>
      <div id="admin-woo-result-slot">${getWooIntegrationSyncResultHtml()}</div>
      <div class="admin-actions-row" id="admin-woo-sync-button-slot">${getWooIntegrationSyncButtonHtml()}</div>
    </div>

    <div class="admin-table-card">
      <div class="admin-table-header-note">Errores recientes</div>
      <div id="admin-woo-errors-slot">${getWooIntegrationRecentErrorsHtml()}</div>
    </div>

    <details class="admin-form-card">
      <summary class="admin-woo-summary-toggle">Configuracion avanzada</summary>
      <div class="admin-woo-note">Estas opciones quedan disponibles, pero no son necesarias para el uso diario.</div>
      <div class="admin-check-grid">
        ${renderWooSwitch('admin-woo-sync-products', 'Productos', !!status.sync_products)}
        ${renderWooSwitch('admin-woo-sync-customers', 'Clientes', !!status.sync_customers)}
        ${renderWooSwitch('admin-woo-sync-orders', 'Pedidos', !!status.sync_orders)}
        ${renderWooSwitch('admin-woo-sync-stock', 'Stock', !!status.sync_stock)}
        ${renderWooSwitch('admin-woo-sync-prices', 'Precios', !!status.sync_prices)}
      </div>
      <div class="admin-form-grid">
        <div class="form-group"><label>Frecuencia</label><select id="admin-woo-sync-mode" onchange="toggleAdminWooFrequencyFields()">${renderWooSelectOptions([
          { value: 'manual', label: 'Manual' },
          { value: 'interval', label: 'Cada X minutos/horas' }
        ], status.sync_mode || 'manual')}</select></div>
        <div class="form-group"><label>Intervalo</label><input id="admin-woo-sync-interval" type="number" min="1" value="${wooEscapeAttr(status.sync_interval_minutes || 60)}" ${status.sync_mode === 'interval' ? '' : 'disabled'}></div>
        <div class="form-group"><label>Unidad</label><select id="admin-woo-sync-unit" ${status.sync_mode === 'interval' ? '' : 'disabled'}>${renderWooSelectOptions([
          { value: 'minutes', label: 'Minutos' },
          { value: 'hours', label: 'Horas' }
        ], Number(status.sync_interval_minutes || 60) % 60 === 0 && Number(status.sync_interval_minutes || 60) >= 60 ? 'hours' : 'minutes')}</select></div>
        <div class="form-group"><label>Pedidos Woo pending</label><input id="admin-woo-status-pending" type="text" value="${wooEscapeAttr(statusMap.pending)}"></div>
        <div class="form-group"><label>Woo processing</label><input id="admin-woo-status-processing" type="text" value="${wooEscapeAttr(statusMap.processing)}"></div>
        <div class="form-group"><label>Woo completed</label><input id="admin-woo-status-completed" type="text" value="${wooEscapeAttr(statusMap.completed)}"></div>
        <div class="form-group"><label>Woo cancelled</label><input id="admin-woo-status-cancelled" type="text" value="${wooEscapeAttr(statusMap.cancelled)}"></div>
        <div class="form-group"><label>Impuestos</label><select id="admin-woo-tax-mode">${renderWooSelectOptions([
          { value: 'woocommerce', label: 'Priorizar WooCommerce' },
          { value: 'milo', label: 'Priorizar Milo' }
        ], status.tax_mode || 'woocommerce')}</select></div>
        <div class="form-group"><label>Categorias</label><select id="admin-woo-category-mode">${renderWooSelectOptions([
          { value: 'woocommerce', label: 'Crear/usar categorias de WooCommerce' },
          { value: 'milo', label: 'Priorizar categorias internas' }
        ], status.category_mode || 'milo')}</select></div>
        <div class="form-group admin-field-span-2"><label>Prioridad en conflictos</label><select id="admin-woo-conflict-priority">${renderWooSelectOptions([
          { value: 'woocommerce', label: 'Gana WooCommerce' },
          { value: 'milo', label: 'Gana Milo' },
          { value: 'manual', label: 'Revision manual posterior' }
        ], status.conflict_priority || 'milo')}</select></div>
      </div>
    </details>
  `;
}

function renderWooSelectOptions(options, selectedValue) {
  return options.map((item) => `<option value="${wooEscapeAttr(item.value)}"${String(selectedValue) === String(item.value) ? ' selected' : ''}>${wooEscapeHtml(item.label)}</option>`).join('');
}

function renderWooSwitch(id, label, checked) {
  return `
    <label class="admin-check-item admin-woo-check-card">
      <input id="${id}" type="checkbox" ${checked ? 'checked' : ''}>
      <span>${wooEscapeHtml(label)}</span>
    </label>
  `;
}

function setWooIntegrationFeedback(type, message) {
  wooIntegrationState.feedback = message ? { type, message } : null;
  updateWooIntegrationLiveUi();
}

function getAdminWooFormData() {
  const unit = (document.getElementById('admin-woo-sync-unit') || {}).value || 'minutes';
  const rawInterval = Number((document.getElementById('admin-woo-sync-interval') || {}).value || 60);
  const syncIntervalMinutes = unit === 'hours' ? rawInterval * 60 : rawInterval;
  return {
    store_url: ((document.getElementById('admin-woo-url') || {}).value || '').trim(),
    consumer_key: ((document.getElementById('admin-woo-key') || {}).value || '').trim(),
    consumer_secret: ((document.getElementById('admin-woo-secret') || {}).value || '').trim(),
    wp_username: ((document.getElementById('admin-woo-wp-user') || {}).value || '').trim(),
    wp_app_password: ((document.getElementById('admin-woo-wp-password') || {}).value || '').trim(),
    api_version: ((document.getElementById('admin-woo-api-version') || {}).value || 'wc/v3').trim() || 'wc/v3',
    sync_direction: (document.getElementById('admin-woo-direction') || {}).value || 'export',
    sync_products: !!((document.getElementById('admin-woo-sync-products') || {}).checked),
    sync_customers: !!((document.getElementById('admin-woo-sync-customers') || {}).checked),
    sync_orders: !!((document.getElementById('admin-woo-sync-orders') || {}).checked),
    sync_stock: !!((document.getElementById('admin-woo-sync-stock') || {}).checked),
    sync_prices: !!((document.getElementById('admin-woo-sync-prices') || {}).checked),
    sync_mode: (document.getElementById('admin-woo-sync-mode') || {}).value || 'manual',
    sync_interval_minutes: syncIntervalMinutes,
    auto_sync: !!((document.getElementById('admin-woo-autosync') || {}).checked),
    tax_mode: (document.getElementById('admin-woo-tax-mode') || {}).value || 'woocommerce',
    category_mode: (document.getElementById('admin-woo-category-mode') || {}).value || 'milo',
    conflict_priority: (document.getElementById('admin-woo-conflict-priority') || {}).value || 'milo',
    order_status_map: {
      pending: ((document.getElementById('admin-woo-status-pending') || {}).value || '').trim() || 'pendiente',
      processing: ((document.getElementById('admin-woo-status-processing') || {}).value || '').trim() || 'procesando',
      completed: ((document.getElementById('admin-woo-status-completed') || {}).value || '').trim() || 'completado',
      cancelled: ((document.getElementById('admin-woo-status-cancelled') || {}).value || '').trim() || 'cancelado',
      refunded: 'reintegrado',
      failed: 'fallido'
    }
  };
}

function validateAdminWooForm(data, requireSecrets) {
  if (!data.store_url) return 'La URL de la tienda es obligatoria.';
  if (requireSecrets && !data.consumer_key) return 'La Consumer Key es obligatoria.';
  if (requireSecrets && !data.consumer_secret) return 'La Consumer Secret es obligatoria.';
  if ((data.wp_username && !data.wp_app_password) || (!data.wp_username && data.wp_app_password)) {
    return 'Para imagenes profesionales complete WP usuario y WP App Password juntos.';
  }
  if (data.sync_mode === 'interval' && (!Number.isFinite(data.sync_interval_minutes) || data.sync_interval_minutes <= 0)) {
    return 'El intervalo de sincronizacion debe ser mayor a cero.';
  }
  return '';
}

function toggleAdminWooFrequencyFields() {
  const mode = (document.getElementById('admin-woo-sync-mode') || {}).value || 'manual';
  const interval = document.getElementById('admin-woo-sync-interval');
  const unit = document.getElementById('admin-woo-sync-unit');
  if (interval) interval.disabled = mode !== 'interval';
  if (unit) unit.disabled = mode !== 'interval';
}

async function saveAdminWooConfig() {
  const currentStatus = wooIntegrationState.status || {};
  const data = getAdminWooFormData();
  const error = validateAdminWooForm(data, !currentStatus.has_consumer_key || !currentStatus.has_consumer_secret);
  if (error) {
    setWooIntegrationFeedback('error', error);
    if (window.renderAdmin) window.renderAdmin('integrations-woocommerce');
    return;
  }

  try {
    setWooIntegrationFeedback('info', 'Guardando configuracion de WooCommerce...');
    if (window.renderAdmin) window.renderAdmin('integrations-woocommerce');
    await api.woocommerce.config(data);
    await loadWooIntegrationData();
    setWooIntegrationFeedback('success', 'Configuracion guardada correctamente.');
    if (window.renderAdmin) window.renderAdmin('integrations-woocommerce');
  } catch (errorSave) {
    setWooIntegrationFeedback('error', errorSave.message || 'No se pudo guardar la configuracion.');
    if (window.renderAdmin) window.renderAdmin('integrations-woocommerce');
  }
}

async function testAdminWooConnection() {
  const currentStatus = wooIntegrationState.status || {};
  const data = getAdminWooFormData();
  const error = validateAdminWooForm(data, !currentStatus.has_consumer_key || !currentStatus.has_consumer_secret);
  if (error) {
    setWooIntegrationFeedback('error', error);
    if (window.renderAdmin) window.renderAdmin('integrations-woocommerce');
    return;
  }

  try {
    setWooIntegrationFeedback('info', 'Probando conexion con WooCommerce...');
    if (window.renderAdmin) window.renderAdmin('integrations-woocommerce');
    const result = await api.woocommerce.testConnection(data);
    setWooIntegrationFeedback('success', `Conexion exitosa con ${result.store || 'la tienda configurada'}.`);
    await loadWooIntegrationData();
    if (window.renderAdmin) window.renderAdmin('integrations-woocommerce');
  } catch (errorTest) {
    setWooIntegrationFeedback('error', errorTest.message || 'No se pudo validar la conexion.');
    if (window.renderAdmin) window.renderAdmin('integrations-woocommerce');
  }
}

async function disconnectAdminWooCommerce() {
  if (!confirm('Desea desconectar WooCommerce?')) return;
  try {
    await api.woocommerce.disconnect();
    wooIntegrationState.syncResult = null;
    await loadWooIntegrationData();
    setWooIntegrationFeedback('success', 'WooCommerce fue desconectado.');
    if (window.renderAdmin) window.renderAdmin('integrations-woocommerce');
  } catch (error) {
    setWooIntegrationFeedback('error', error.message || 'No se pudo desconectar WooCommerce.');
    if (window.renderAdmin) window.renderAdmin('integrations-woocommerce');
  }
}

async function runAdminWooSyncNow() {
  try {
    wooIntegrationState.syncRunning = true;
    wooIntegrationState.syncProgress = { status: 'Iniciando sincronizacion...', progress: 0 };
    setWooIntegrationFeedback('info', 'Ejecutando sincronizacion manual...');
    updateWooIntegrationLiveUi();
    const token = localStorage.getItem('token');
    const response = await fetch('/api/woocommerce/sync', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + token }
    });
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let finalPayload = null;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop();
      lines.forEach((line) => {
        if (!line.trim()) return;
        try {
          const data = JSON.parse(line);
          if (data.status || data.progress !== undefined) {
            wooIntegrationState.syncProgress = {
              status: data.status || 'Sincronizando...',
              progress: data.progress || 0
            };
            updateWooIntegrationLiveUi();
          }
          if (data.done) finalPayload = data;
        } catch (error) {}
      });
    }

    wooIntegrationState.syncResult = finalPayload || { results: {} };
    wooIntegrationState.syncProgress = null;
    wooIntegrationState.syncRunning = false;
    updateWooIntegrationLiveUi();
    await loadWooIntegrationData();
    updateWooIntegrationLiveUi();
    setWooIntegrationFeedback('success', 'Sincronizacion finalizada.');
  } catch (error) {
    wooIntegrationState.syncProgress = null;
    wooIntegrationState.syncRunning = false;
    updateWooIntegrationLiveUi();
    setWooIntegrationFeedback('error', error.message || 'No se pudo ejecutar la sincronizacion.');
  }
}

async function renderSettings() {
  if (window.location.hash !== '#admin-integrations-woocommerce') {
    window.location.hash = 'admin-integrations-woocommerce';
    return;
  }
  if (window.renderAdmin) {
    window.renderAdmin('integrations-woocommerce');
  }
}

window.loadWooIntegrationData = loadWooIntegrationData;
window.renderWooIntegrationAdminSection = renderWooIntegrationAdminSection;
window.toggleAdminWooFrequencyFields = toggleAdminWooFrequencyFields;
window.saveAdminWooConfig = saveAdminWooConfig;
window.testAdminWooConnection = testAdminWooConnection;
window.disconnectAdminWooCommerce = disconnectAdminWooCommerce;
window.runAdminWooSyncNow = runAdminWooSyncNow;
window.renderSettings = renderSettings;
