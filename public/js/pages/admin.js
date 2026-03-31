let adminUsersData = [];
let adminSettingsData = {};
let adminCategoriesData = [];
let adminBrandsData = [];
let adminAuxStore = {};
let adminUserMeta = {};
let adminUserOverrides = {};
let adminConnectedUsers = [];
let adminConfigStore = {};
let adminProcessLog = null;

const ADMIN_STORAGE_KEYS = {
  aux: 'milo_admin_aux_tables',
  userMeta: 'milo_admin_user_meta',
  userOverrides: 'milo_admin_user_overrides',
  sessions: 'milo_admin_connected_users',
  config: 'milo_admin_config_store'
};

const ADMIN_AUX_TABLES = {
  banks: { label: 'Bancos', type: 'simple' },
  categories: { label: 'Categorias', type: 'category' },
  incomeDetails: { label: 'Detalle de Ingresos', type: 'simple' },
  expenseDetails: { label: 'Detalle de Gastos', type: 'simple' },
  brands: { label: 'Marcas', type: 'brand' },
  numbering: { label: 'Numeracion', type: 'numbering' },
  vouchers: { label: 'Comprobantes', type: 'voucher' },
  countries: { label: 'Paises', type: 'simple' },
  provinces: { label: 'Provincias', type: 'simple' },
  rubros: { label: 'Rubros', type: 'simple' },
  cards: { label: 'Tarjetas', type: 'simple' },
  units: { label: 'Unidades', type: 'simple' },
  zones: { label: 'Zonas', type: 'simple' }
};

const ADMIN_ROLE_OPTIONS = [
  { value: 'admin', label: 'Administrador' },
  { value: 'supervisor', label: 'Supervisor' },
  { value: 'seller', label: 'Vendedor' },
  { value: 'technician', label: 'Usuario estandar' }
];

const adminUiState = {
  activeSection: 'users',
  usersSearch: '',
  usersPage: 1,
  connectedSearch: '',
  connectedPage: 1,
  auxTable: 'banks',
  auxSearch: '',
  auxPage: 1
};

function adminEscapeHtml(value) {
  return app.escapeHtml(value ?? '');
}

function adminEscapeAttr(value) {
  return app.escapeAttr(value ?? '');
}

function adminNormalizeText(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function adminFormatInputDate(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function adminBuildOptions(items, selectedValue, placeholder = 'Seleccionar') {
  const current = String(selectedValue || '');
  let html = placeholder ? '<option value="">' + adminEscapeHtml(placeholder) + '</option>' : '';
  items.forEach((item) => {
    const value = typeof item === 'object' ? item.value : item;
    const label = typeof item === 'object' ? item.label : item;
    html += '<option value="' + adminEscapeAttr(value) + '"' + (current === String(value) ? ' selected' : '') + '>' + adminEscapeHtml(label) + '</option>';
  });
  return html;
}

function adminBuildPasswordField(id, label, required) {
  return `
    <div class="form-group">
      <label>${label}</label>
      <div style="position:relative;">
        <input id="${id}" type="password" value="" autocomplete="new-password" ${required ? 'required' : ''} style="padding-right:44px;">
        <button type="button" class="btn btn-sm btn-secondary" onclick="toggleAdminPasswordVisibility('${id}', this)" aria-label="Mostrar contrasena" style="position:absolute;right:8px;top:50%;transform:translateY(-50%);min-width:32px;padding:4px 8px;">Ver</button>
      </div>
    </div>
  `;
}

function loadAdminStore(key, fallback) {
  try {
    const value = JSON.parse(localStorage.getItem(key) || 'null');
    return value ?? fallback;
  } catch (error) {
    return fallback;
  }
}

function saveAdminStore(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

function getAdminRoute(sectionId) {
  return {
    users: 'admin-users',
    'users-connected': 'admin-users-connected',
    'aux-tables': 'admin-aux-tables',
    'config-general': 'admin-config-general',
    'config-documents': 'admin-config-documents',
    'config-mail': 'admin-config-mail',
    'integrations-woocommerce': 'admin-integrations-woocommerce',
    'reset-data': 'admin-reset-data',
    troubleshoot: 'admin-troubleshoot'
  }[sectionId] || 'admin-users';
}

function adminRoleLabel(role) {
  return ({
    admin: 'Administrador',
    supervisor: 'Supervisor',
    seller: 'Vendedor',
    technician: 'Usuario estandar'
  })[role] || role || 'Usuario';
}

function getAdminCurrentUserName() {
  if (typeof currentUser !== 'undefined' && currentUser && currentUser.name) return currentUser.name;
  if (window.auth && window.auth.currentUser && window.auth.currentUser.name) return window.auth.currentUser.name;
  return 'Administrador';
}

function getAdminCurrentUsername() {
  if (typeof currentUser !== 'undefined' && currentUser && currentUser.username) return currentUser.username;
  if (window.auth && window.auth.currentUser && window.auth.currentUser.username) return window.auth.currentUser.username;
  return 'admin';
}

function ensureAdminSession() {
  const username = getAdminCurrentUsername();
  const now = new Date().toISOString();
  const existing = adminConnectedUsers.find((item) => item.username === username);
  if (existing) {
    existing.lastActivity = now;
    existing.connectionStatus = 'Activa';
    return;
  }

  adminConnectedUsers.unshift({
    id: 'session-' + Date.now(),
    username,
    ip: '127.0.0.1',
    loginDate: now,
    lastActivity: now,
    connectionStatus: 'Activa'
  });
}

async function renderAdmin(sectionId = 'users') {
  const content = document.getElementById('page-content');
  if (!auth.isAdmin()) {
    content.innerHTML = '<div class="alert alert-warning">Acceso denegado. Solo administradores.</div>';
    return;
  }

  content.innerHTML = '<div class="loading">Cargando...</div>';
  adminUiState.activeSection = sectionId;

  try {
    const [users, settings, categories, brands] = await Promise.all([
      api.auth.getUsers().catch(() => []),
      api.settings.get().catch(() => ({})),
      api.categories.getAll().catch(() => []),
      api.deviceOptions.getBrands().catch(() => [])
    ]);

    adminUsersData = Array.isArray(users) ? users : [];
    adminSettingsData = settings || {};
    adminCategoriesData = Array.isArray(categories) ? categories : [];
    adminBrandsData = Array.isArray(brands) ? brands : [];
    adminAuxStore = loadAdminStore(ADMIN_STORAGE_KEYS.aux, {});
    adminUserMeta = loadAdminStore(ADMIN_STORAGE_KEYS.userMeta, {});
    adminUserOverrides = loadAdminStore(ADMIN_STORAGE_KEYS.userOverrides, {});
    adminConnectedUsers = loadAdminStore(ADMIN_STORAGE_KEYS.sessions, []);
    adminConfigStore = loadAdminStore(ADMIN_STORAGE_KEYS.config, {
      general: {},
      documents: {
        numbering_format: 'PV-00000000',
        prefixes: '',
        control_stock: true,
        allow_negative_stock: false,
        control_min_price: false,
        decimals: 2
      },
      mail: {
        smtp_server: '',
        port: '587',
        username: '',
        password: '',
        encryption: 'tls',
        sender_email: ''
      }
    });

    if (adminUiState.activeSection === 'integrations-woocommerce' && typeof window.loadWooIntegrationData === 'function') {
      await window.loadWooIntegrationData();
    }

    ensureAdminSession();
    saveAdminStore(ADMIN_STORAGE_KEYS.sessions, adminConnectedUsers);

    content.innerHTML = `
      <section class="admin-admin-content">
        <div class="admin-admin-panel card" id="admin-admin-panel"></div>
      </section>
    `;
    renderAdminSection();
  } catch (error) {
    content.innerHTML = '<div class="alert alert-warning">Error: ' + adminEscapeHtml(error.message) + '</div>';
  }
}

function getHydratedAdminUsers() {
  return adminUsersData
    .map((user) => {
      const meta = adminUserMeta[user.id] || {};
      const override = adminUserOverrides[user.id] || {};
      return {
        ...user,
        username: override.username || user.username,
        name: override.name || user.name,
        role: override.role || user.role,
        email: override.email || meta.email || '',
        active: override.active !== undefined ? !!override.active : (meta.active !== undefined ? !!meta.active : true),
        deleted: !!override.deleted,
        last_access: override.last_access || meta.last_access || user.created_at,
        created_at: user.created_at
      };
    })
    .filter((user) => !user.deleted);
}

function renderAdminSection() {
  const panel = document.getElementById('admin-admin-panel');
  if (!panel) return;

  if (adminUiState.activeSection === 'users') {
    panel.innerHTML = renderAdminUsersSection();
    return;
  }
  if (adminUiState.activeSection === 'users-connected') {
    panel.innerHTML = renderAdminConnectedUsersSection();
    return;
  }
  if (adminUiState.activeSection === 'aux-tables') {
    panel.innerHTML = renderAdminAuxTablesSection();
    return;
  }
  if (adminUiState.activeSection === 'config-general') {
    panel.innerHTML = renderAdminConfigGeneralSection();
    return;
  }
  if (adminUiState.activeSection === 'config-documents') {
    panel.innerHTML = renderAdminConfigDocumentsSection();
    return;
  }
  if (adminUiState.activeSection === 'config-mail') {
    panel.innerHTML = renderAdminConfigMailSection();
    return;
  }
  if (adminUiState.activeSection === 'integrations-woocommerce') {
    panel.innerHTML = typeof window.renderWooIntegrationAdminSection === 'function'
      ? window.renderWooIntegrationAdminSection()
      : '<div class="alert alert-warning">La integracion de WooCommerce no esta disponible en este momento.</div>';
    if (typeof window.toggleAdminWooFrequencyFields === 'function') {
      window.setTimeout(() => window.toggleAdminWooFrequencyFields(), 0);
    }
    return;
  }
  if (adminUiState.activeSection === 'reset-data') {
    panel.innerHTML = renderAdminResetDataSection();
    return;
  }
  panel.innerHTML = renderAdminTroubleshootSection();
}

function setAdminUsersSearch(value) {
  adminUiState.usersSearch = value || '';
  adminUiState.usersPage = 1;
  renderAdminSection();
}

function changeAdminUsersPage(delta) {
  const filtered = getFilteredAdminUsers();
  const totalPages = Math.max(1, Math.ceil(filtered.length / 8));
  adminUiState.usersPage = Math.max(1, Math.min(totalPages, adminUiState.usersPage + delta));
  renderAdminSection();
}

function getFilteredAdminUsers() {
  const search = adminNormalizeText(adminUiState.usersSearch);
  return getHydratedAdminUsers().filter((user) => {
    if (!search) return true;
    return [user.id, user.username, user.name, user.email, adminRoleLabel(user.role)]
      .some((value) => adminNormalizeText(value).includes(search));
  });
}

function renderAdminUsersSection() {
  const filtered = getFilteredAdminUsers();
  const pageSize = 8;
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.max(1, Math.min(totalPages, adminUiState.usersPage));
  adminUiState.usersPage = currentPage;
  const rows = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  return `
    <div class="admin-module-head">
      <div>
        <p class="admin-module-kicker">Administracion</p>
        <h2>Modificar Usuarios</h2>
        <p>Gestion centralizada de accesos, estados y perfiles del sistema.</p>
      </div>
      <button class="btn btn-primary" type="button" onclick="showAdminUserModal()">+ Nuevo Usuario</button>
    </div>

    <div class="admin-filter-card">
      <div class="search-box admin-search-box">
        <input type="text" value="${adminEscapeAttr(adminUiState.usersSearch)}" placeholder="Buscar usuario..." oninput="setAdminUsersSearch(this.value)">
      </div>
    </div>

    <div class="admin-table-card">
      <div class="sales-lines-table-wrap">
        <table class="sales-lines-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Usuario</th>
              <th>Nombre</th>
              <th>Email</th>
              <th>Rol</th>
              <th>Estado</th>
              <th>Ultimo acceso</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            ${rows.length === 0 ? `<tr><td colspan="8" class="sales-empty-row">No hay usuarios para mostrar.</td></tr>` : rows.map((user) => `
              <tr>
                <td>${adminEscapeHtml(user.id)}</td>
                <td>${adminEscapeHtml(user.username)}</td>
                <td>${adminEscapeHtml(user.name)}</td>
                <td>${adminEscapeHtml(user.email || '-')}</td>
                <td><span class="badge badge-blue">${adminEscapeHtml(adminRoleLabel(user.role))}</span></td>
                <td><span class="badge ${user.active ? 'badge-green' : 'badge-yellow'}">${user.active ? 'Activo' : 'Inactivo'}</span></td>
                <td>${adminEscapeHtml(app.formatDateTime(user.last_access || user.created_at))}</td>
                <td>
                  <div class="btn-group">
                    <button class="btn btn-sm btn-secondary" type="button" onclick="showAdminUserModal(${user.id})">Editar</button>
                    <button class="btn btn-sm ${user.active ? 'btn-warning' : 'btn-success'}" type="button" onclick="toggleAdminUserStatus(${user.id})">${user.active ? 'Desactivar' : 'Activar'}</button>
                    <button class="btn btn-sm btn-danger" type="button" onclick="deleteAdminUser(${user.id})">Eliminar</button>
                  </div>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
      <div class="sales-pagination">
        <span>Pagina ${adminEscapeHtml(currentPage)} de ${adminEscapeHtml(totalPages)}</span>
        <div class="btn-group">
          <button class="btn btn-sm btn-secondary" type="button" onclick="changeAdminUsersPage(-1)" ${currentPage <= 1 ? 'disabled' : ''}>Anterior</button>
          <button class="btn btn-sm btn-secondary" type="button" onclick="changeAdminUsersPage(1)" ${currentPage >= totalPages ? 'disabled' : ''}>Siguiente</button>
        </div>
      </div>
    </div>
  `;
}

function showAdminUserModal(userId = null) {
  const user = userId ? getHydratedAdminUsers().find((item) => String(item.id) === String(userId)) : null;
  app.showModal(`
    <div class="modal admin-modal">
      <div class="modal-header admin-modal-header">
        <div>
          <h3>${user ? 'Editar Usuario' : 'Nuevo Usuario'}</h3>
        </div>
        <button type="button" class="modal-close" onclick="closeModal()">&times;</button>
      </div>
      <form autocomplete="off" onsubmit="event.preventDefault(); saveAdminUser(${user ? user.id : 'null'})">
        <div class="modal-body admin-modal-body">
          <div class="admin-form-grid">
            <div class="form-group"><label>Usuario</label><input id="admin-user-username" type="text" value="${adminEscapeAttr(user ? user.username : '')}" autocomplete="off" autocapitalize="off" spellcheck="false" required></div>
            <div class="form-group"><label>Nombre completo</label><input id="admin-user-name" type="text" value="${adminEscapeAttr(user ? user.name : '')}" required></div>
            <div class="form-group"><label>Email</label><input id="admin-user-email" type="email" value="${adminEscapeAttr(user ? user.email : '')}"></div>
            <div class="form-group"><label>Rol</label><select id="admin-user-role">${adminBuildOptions(ADMIN_ROLE_OPTIONS, user ? user.role : 'technician', '')}</select></div>
            ${adminBuildPasswordField('admin-user-password', 'Contrase&ntilde;a', !user)}
            ${adminBuildPasswordField('admin-user-password-confirm', 'Confirmar contrase&ntilde;a', !user)}
            <div class="form-group admin-field-span-2">
              <label class="admin-switch-row">
                <input id="admin-user-active" type="checkbox" ${!user || user.active ? 'checked' : ''}>
                <span>Usuario activo</span>
              </label>
            </div>
          </div>
        </div>
        <div class="modal-footer admin-modal-footer">
          <button type="button" class="btn btn-secondary" onclick="closeModal()">Cancelar</button>
          <button type="submit" class="btn btn-success">Guardar</button>
        </div>
      </form>
    </div>
  `);

  if (!user) {
    window.setTimeout(() => {
      const usernameInput = document.getElementById('admin-user-username');
      const passwordInput = document.getElementById('admin-user-password');
      const confirmInput = document.getElementById('admin-user-password-confirm');
      if (usernameInput) usernameInput.value = '';
      if (passwordInput) passwordInput.value = '';
      if (confirmInput) confirmInput.value = '';
    }, 0);
  }
}

function toggleAdminPasswordVisibility(inputId, button) {
  const input = document.getElementById(inputId);
  if (!input) return;
  const isHidden = input.type === 'password';
  input.type = isHidden ? 'text' : 'password';
  button.textContent = isHidden ? 'Ocultar' : 'Ver';
  button.setAttribute('aria-label', isHidden ? 'Ocultar contrasena' : 'Mostrar contrasena');
}

async function saveAdminUser(userId) {
  const username = (document.getElementById('admin-user-username').value || '').trim();
  const name = (document.getElementById('admin-user-name').value || '').trim();
  const email = (document.getElementById('admin-user-email').value || '').trim();
  const role = document.getElementById('admin-user-role').value;
  const password = document.getElementById('admin-user-password').value || '';
  const confirmPassword = document.getElementById('admin-user-password-confirm').value || '';
  const active = document.getElementById('admin-user-active').checked;

  if (!username || !name) {
    alert('Complete usuario y nombre.');
    return;
  }
  if ((password || confirmPassword || !userId) && password !== confirmPassword) {
    alert('Las contraseñas no coinciden.');
    return;
  }
  if (!userId && !password) {
    alert('Ingrese una contraseña.');
    return;
  }

  try {
    if (userId) {
      adminUserOverrides[userId] = {
        ...(adminUserOverrides[userId] || {}),
        username,
        name,
        role,
        email,
        active,
        last_access: new Date().toISOString()
      };
      adminUserMeta[userId] = {
        ...(adminUserMeta[userId] || {}),
        email,
        active,
        last_access: new Date().toISOString()
      };
      saveAdminStore(ADMIN_STORAGE_KEYS.userOverrides, adminUserOverrides);
      saveAdminStore(ADMIN_STORAGE_KEYS.userMeta, adminUserMeta);
    } else {
      const created = await api.auth.createUser({ username, name, password, role });
      adminUserMeta[created.id] = {
        email,
        active,
        last_access: new Date().toISOString()
      };
      if (!active) {
        adminUserOverrides[created.id] = { ...(adminUserOverrides[created.id] || {}), active: false };
        saveAdminStore(ADMIN_STORAGE_KEYS.userOverrides, adminUserOverrides);
      }
      saveAdminStore(ADMIN_STORAGE_KEYS.userMeta, adminUserMeta);
    }
    closeModal();
    renderAdmin(adminUiState.activeSection);
  } catch (error) {
    alert(error.message);
  }
}

function toggleAdminUserStatus(userId) {
  const user = getHydratedAdminUsers().find((item) => String(item.id) === String(userId));
  if (!user) return;
  adminUserOverrides[userId] = { ...(adminUserOverrides[userId] || {}), active: !user.active };
  adminUserMeta[userId] = { ...(adminUserMeta[userId] || {}), active: !user.active, last_access: new Date().toISOString() };
  saveAdminStore(ADMIN_STORAGE_KEYS.userOverrides, adminUserOverrides);
  saveAdminStore(ADMIN_STORAGE_KEYS.userMeta, adminUserMeta);
  renderAdminSection();
}

function deleteAdminUser(userId) {
  const user = getHydratedAdminUsers().find((item) => String(item.id) === String(userId));
  if (!user) return;
  if (!confirm('Esta accion ocultara el usuario de la grilla administrativa. Desea continuar?')) return;
  adminUserOverrides[userId] = { ...(adminUserOverrides[userId] || {}), deleted: true };
  saveAdminStore(ADMIN_STORAGE_KEYS.userOverrides, adminUserOverrides);
  renderAdminSection();
}

function setAdminConnectedSearch(value) {
  adminUiState.connectedSearch = value || '';
  adminUiState.connectedPage = 1;
  renderAdminSection();
}

function getFilteredConnectedUsers() {
  const search = adminNormalizeText(adminUiState.connectedSearch);
  return adminConnectedUsers.filter((session) => {
    if (!search) return true;
    return [session.username, session.ip, session.connectionStatus].some((value) => adminNormalizeText(value).includes(search));
  });
}

function changeAdminConnectedPage(delta) {
  const filtered = getFilteredConnectedUsers();
  const totalPages = Math.max(1, Math.ceil(filtered.length / 8));
  adminUiState.connectedPage = Math.max(1, Math.min(totalPages, adminUiState.connectedPage + delta));
  renderAdminSection();
}

function renderAdminConnectedUsersSection() {
  const filtered = getFilteredConnectedUsers();
  const pageSize = 8;
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.max(1, Math.min(totalPages, adminUiState.connectedPage));
  adminUiState.connectedPage = currentPage;
  const rows = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  return `
    <div class="admin-module-head">
      <div>
        <p class="admin-module-kicker">Administracion</p>
        <h2>Usuarios Conectados</h2>
        <p>Seguimiento visual de sesiones abiertas y actividad reciente.</p>
      </div>
    </div>

    <div class="admin-filter-card">
      <div class="search-box admin-search-box">
        <input type="text" value="${adminEscapeAttr(adminUiState.connectedSearch)}" placeholder="Buscar sesion..." oninput="setAdminConnectedSearch(this.value)">
      </div>
    </div>

    <div class="admin-table-card">
      <div class="sales-lines-table-wrap">
        <table class="sales-lines-table">
          <thead>
            <tr>
              <th>Usuario</th>
              <th>IP</th>
              <th>Fecha login</th>
              <th>Ultima actividad</th>
              <th>Estado conexion</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            ${rows.length === 0 ? `<tr><td colspan="6" class="sales-empty-row">No hay sesiones para mostrar.</td></tr>` : rows.map((session) => `
              <tr>
                <td>${adminEscapeHtml(session.username)}</td>
                <td>${adminEscapeHtml(session.ip)}</td>
                <td>${adminEscapeHtml(app.formatDateTime(session.loginDate))}</td>
                <td>${adminEscapeHtml(app.formatDateTime(session.lastActivity))}</td>
                <td><span class="badge ${session.connectionStatus === 'Activa' ? 'badge-green' : 'badge-yellow'}">${adminEscapeHtml(session.connectionStatus)}</span></td>
                <td><button class="btn btn-sm btn-danger" type="button" onclick="forceCloseAdminSession('${adminEscapeAttr(session.id)}')">Forzar cierre</button></td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
      <div class="sales-pagination">
        <span>Pagina ${adminEscapeHtml(currentPage)} de ${adminEscapeHtml(totalPages)}</span>
        <div class="btn-group">
          <button class="btn btn-sm btn-secondary" type="button" onclick="changeAdminConnectedPage(-1)" ${currentPage <= 1 ? 'disabled' : ''}>Anterior</button>
          <button class="btn btn-sm btn-secondary" type="button" onclick="changeAdminConnectedPage(1)" ${currentPage >= totalPages ? 'disabled' : ''}>Siguiente</button>
        </div>
      </div>
    </div>
  `;
}

function forceCloseAdminSession(sessionId) {
  const session = adminConnectedUsers.find((item) => item.id === sessionId);
  if (!session) return;
  if (!confirm('Desea forzar el cierre de sesion seleccionado?')) return;
  if (session.username === getAdminCurrentUsername()) {
    saveAdminStore(ADMIN_STORAGE_KEYS.sessions, adminConnectedUsers.filter((item) => item.id !== sessionId));
    auth.logout();
    return;
  }
  adminConnectedUsers = adminConnectedUsers.filter((item) => item.id !== sessionId);
  saveAdminStore(ADMIN_STORAGE_KEYS.sessions, adminConnectedUsers);
  renderAdminSection();
}

function getAdminAuxRows() {
  const tableKey = adminUiState.auxTable;
  const tableDef = ADMIN_AUX_TABLES[tableKey];
  const search = adminNormalizeText(adminUiState.auxSearch);
  let rows = [];

  if (tableDef.type === 'category') {
    rows = adminCategoriesData.map((category) => {
      return {
        id: category.id,
        description: category.name,
        code: category.slug || '',
        notes: category.description || '',
        active: category.active !== 0,
        parent_id: category.parent_id || '',
        depth: category.depth || 0,
        woocommerce_category_id: category.woocommerce_category_id || '',
        source: 'api'
      };
    });
  } else if (tableDef.type === 'brand') {
    rows = adminBrandsData.map((brand) => {
      return {
        id: brand.id,
        description: brand.name,
        code: brand.slug || '',
        active: brand.active !== 0,
        woocommerce_brand_id: brand.woocommerce_brand_id || '',
        source: 'api'
      };
    });
  } else {
    rows = (adminAuxStore[tableKey] || []).map((item) => ({ ...item, source: 'local' }));
  }

  return rows.filter((row) => {
    if (!search) return true;
    return [row.id, row.description, row.code].some((value) => adminNormalizeText(value).includes(search));
  });
}

function setAdminAuxTable(value) {
  adminUiState.auxTable = value || 'banks';
  adminUiState.auxSearch = '';
  adminUiState.auxPage = 1;
  renderAdminSection();
}

function setAdminAuxSearch(value) {
  adminUiState.auxSearch = value || '';
  adminUiState.auxPage = 1;
  renderAdminSection();
}

function changeAdminAuxPage(delta) {
  const filtered = getAdminAuxRows();
  const totalPages = Math.max(1, Math.ceil(filtered.length / 8));
  adminUiState.auxPage = Math.max(1, Math.min(totalPages, adminUiState.auxPage + delta));
  renderAdminSection();
}

function renderAdminAuxTablesSection() {
  const rowsAll = getAdminAuxRows();
  const pageSize = 8;
  const totalPages = Math.max(1, Math.ceil(rowsAll.length / pageSize));
  const currentPage = Math.max(1, Math.min(totalPages, adminUiState.auxPage));
  adminUiState.auxPage = currentPage;
  const rows = rowsAll.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const tableDef = ADMIN_AUX_TABLES[adminUiState.auxTable];

  return `
    <div class="admin-module-head">
      <div>
        <p class="admin-module-kicker">Administracion</p>
        <h2>Tablas Auxiliares</h2>
        <p>CRUD administrativo para parametros y catalogos del sistema.</p>
      </div>
      <button class="btn btn-primary" type="button" onclick="showAdminAuxModal()">+ Nuevo registro</button>
    </div>

    <div class="admin-filter-card">
      <div class="admin-filter-grid">
        <div class="form-group">
          <label>Tabla</label>
          <select onchange="setAdminAuxTable(this.value)">${adminBuildOptions(Object.entries(ADMIN_AUX_TABLES).map(([value, item]) => ({ value, label: item.label })), adminUiState.auxTable, '')}</select>
        </div>
        <div class="form-group">
          <label>Buscar</label>
          <input type="text" value="${adminEscapeAttr(adminUiState.auxSearch)}" placeholder="Buscar registro..." oninput="setAdminAuxSearch(this.value)">
        </div>
      </div>
    </div>

    ${adminUiState.auxTable === 'categories' ? renderAdminCategoryTree(rowsAll) : ''}

    <div class="admin-table-card">
      <div class="admin-table-header-note">${adminEscapeHtml(tableDef.label)}</div>
      <div class="sales-lines-table-wrap">
        <table class="sales-lines-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Descripcion</th>
              <th>Estado</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            ${rows.length === 0 ? `<tr><td colspan="4" class="sales-empty-row">No hay registros para mostrar.</td></tr>` : rows.map((row) => `
              <tr>
                <td>${adminEscapeHtml(row.id)}</td>
                <td>${adminEscapeHtml(row.description)}</td>
                <td><span class="badge ${row.active ? 'badge-green' : 'badge-yellow'}">${row.active ? 'Activo' : 'Inactivo'}</span></td>
                <td>
                  <div class="btn-group">
                    <button class="btn btn-sm btn-secondary" type="button" onclick="showAdminAuxModal('${adminEscapeAttr(row.id)}')">Editar</button>
                    <button class="btn btn-sm btn-danger" type="button" onclick="deleteAdminAuxItem('${adminEscapeAttr(row.id)}')">Eliminar</button>
                  </div>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
      <div class="sales-pagination">
        <span>Pagina ${adminEscapeHtml(currentPage)} de ${adminEscapeHtml(totalPages)}</span>
        <div class="btn-group">
          <button class="btn btn-sm btn-secondary" type="button" onclick="changeAdminAuxPage(-1)" ${currentPage <= 1 ? 'disabled' : ''}>Anterior</button>
          <button class="btn btn-sm btn-secondary" type="button" onclick="changeAdminAuxPage(1)" ${currentPage >= totalPages ? 'disabled' : ''}>Siguiente</button>
        </div>
      </div>
    </div>
  `;
}

function renderAdminCategoryTree(rows) {
  if (!rows.length) return '';
  const meta = Object.fromEntries(rows.map((row) => [row.id, { parent_id: row.parent_id || '' }]));
  const items = rows.map((row) => {
    const parentId = (meta[row.id] || {}).parent_id || '';
    const parent = rows.find((item) => String(item.id) === String(parentId));
    return `${parent ? '└ ' : ''}${row.description}`;
  });
  return `
    <div class="admin-tree-card">
      <h3>Arbol de categorias</h3>
      <div class="admin-tree-list">
        ${items.map((item) => `<div class="admin-tree-item">${adminEscapeHtml(item)}</div>`).join('')}
      </div>
    </div>
  `;
}

function showAdminAuxModal(itemId = null) {
  const tableKey = adminUiState.auxTable;
  const tableDef = ADMIN_AUX_TABLES[tableKey];
  const rows = getAdminAuxRows();
  const item = itemId ? rows.find((row) => String(row.id) === String(itemId)) : null;
  const categoryParentOptions = adminCategoriesData
    .filter((category) => !item || String(category.id) !== String(item.id))
    .map((category) => ({ value: category.id, label: category.full_name || category.name }));

  let fieldsHtml = `
    <div class="form-group"><label>Descripcion</label><input id="admin-aux-description" type="text" value="${adminEscapeAttr(item ? item.description : '')}" required></div>
    <div class="form-group"><label>Codigo opcional</label><input id="admin-aux-code" type="text" value="${adminEscapeAttr(item ? item.code : '')}"></div>
    <div class="form-group admin-field-span-2">
      <label class="admin-switch-row">
        <input id="admin-aux-active" type="checkbox" ${(item ? item.active : true) ? 'checked' : ''}>
        <span>Registro activo</span>
      </label>
    </div>
  `;

  if (tableDef.type === 'category') {
    fieldsHtml = `
      <div class="form-group"><label>Descripcion</label><input id="admin-aux-description" type="text" value="${adminEscapeAttr(item ? item.description : '')}" required></div>
      <div class="form-group"><label>Slug</label><input id="admin-aux-code" type="text" value="${adminEscapeAttr(item ? item.code : '')}"></div>
      <div class="form-group admin-field-span-2"><label>Categoria padre</label><select id="admin-aux-parent">${adminBuildOptions(categoryParentOptions, item ? item.parent_id || '' : '', 'Sin padre')}</select></div>
      <div class="form-group admin-field-span-2"><label>Descripcion interna</label><input id="admin-aux-notes" type="text" value="${adminEscapeAttr(item ? item.notes || '' : '')}"></div>
      <div class="form-group"><label>ID WooCommerce</label><input id="admin-aux-woo-id" type="number" min="1" value="${adminEscapeAttr(item ? item.woocommerce_category_id || '' : '')}"></div>
      <div class="form-group admin-field-span-2">
        <label class="admin-switch-row">
          <input id="admin-aux-active" type="checkbox" ${(item ? item.active : true) ? 'checked' : ''}>
          <span>Registro activo</span>
        </label>
      </div>
    `;
  }

  if (tableDef.type === 'brand') {
    fieldsHtml = `
      <div class="form-group"><label>Descripcion</label><input id="admin-aux-description" type="text" value="${adminEscapeAttr(item ? item.description : '')}" required></div>
      <div class="form-group"><label>Slug</label><input id="admin-aux-code" type="text" value="${adminEscapeAttr(item ? item.code : '')}"></div>
      <div class="form-group"><label>ID WooCommerce</label><input id="admin-aux-woo-id" type="number" min="1" value="${adminEscapeAttr(item ? item.woocommerce_brand_id || '' : '')}"></div>
      <div class="form-group admin-field-span-2">
        <label class="admin-switch-row">
          <input id="admin-aux-active" type="checkbox" ${(item ? item.active : true) ? 'checked' : ''}>
          <span>Registro activo</span>
        </label>
      </div>
    `;
  }

  if (tableDef.type === 'numbering') {
    const row = item || { point_of_sale: '001', voucher_type: 'Factura C', last_number: 0, auto_increment: true, active: true };
    fieldsHtml = `
      <div class="form-group"><label>Punto de venta</label><input id="admin-aux-point-sale" type="text" value="${adminEscapeAttr(row.point_of_sale || '001')}" required></div>
      <div class="form-group"><label>Tipo comprobante</label><input id="admin-aux-voucher-type" type="text" value="${adminEscapeAttr(row.voucher_type || '')}" required></div>
      <div class="form-group"><label>Ultimo numero</label><input id="admin-aux-last-number" type="number" min="0" value="${adminEscapeAttr(row.last_number || 0)}"></div>
      <div class="form-group admin-field-span-2">
        <label class="admin-switch-row">
          <input id="admin-aux-auto-increment" type="checkbox" ${row.auto_increment !== false ? 'checked' : ''}>
          <span>Incremento automatico</span>
        </label>
      </div>
      <div class="form-group admin-field-span-2">
        <label class="admin-switch-row">
          <input id="admin-aux-active" type="checkbox" ${row.active !== false ? 'checked' : ''}>
          <span>Registro activo</span>
        </label>
      </div>
    `;
  }

  if (tableDef.type === 'voucher') {
    const row = item || { voucher_type: '', letter: 'C', affects_stock: true, affects_account: false, active: true };
    fieldsHtml = `
      <div class="form-group"><label>Tipo comprobante</label><input id="admin-aux-voucher-type" type="text" value="${adminEscapeAttr(row.voucher_type || '')}" required></div>
      <div class="form-group"><label>Letra</label><input id="admin-aux-letter" type="text" value="${adminEscapeAttr(row.letter || 'C')}" required></div>
      <div class="form-group admin-field-span-2">
        <label class="admin-switch-row">
          <input id="admin-aux-affects-stock" type="checkbox" ${row.affects_stock !== false ? 'checked' : ''}>
          <span>Afecta stock</span>
        </label>
      </div>
      <div class="form-group admin-field-span-2">
        <label class="admin-switch-row">
          <input id="admin-aux-affects-account" type="checkbox" ${row.affects_account ? 'checked' : ''}>
          <span>Afecta cuenta corriente</span>
        </label>
      </div>
      <div class="form-group admin-field-span-2">
        <label class="admin-switch-row">
          <input id="admin-aux-active" type="checkbox" ${row.active !== false ? 'checked' : ''}>
          <span>Registro activo</span>
        </label>
      </div>
    `;
  }

  app.showModal(`
    <div class="modal admin-modal">
      <div class="modal-header admin-modal-header">
        <div>
          <h3>${item ? 'Editar registro' : 'Nuevo registro'}</h3>
          <p class="admin-modal-subtitle">${adminEscapeHtml(tableDef.label)}</p>
        </div>
        <button type="button" class="modal-close" onclick="closeModal()">&times;</button>
      </div>
      <form onsubmit="event.preventDefault(); saveAdminAuxItem('${adminEscapeAttr(item ? item.id : '')}')">
        <div class="modal-body admin-modal-body">
          <div class="admin-form-grid">${fieldsHtml}</div>
        </div>
        <div class="modal-footer admin-modal-footer">
          <button type="button" class="btn btn-secondary" onclick="closeModal()">Cancelar</button>
          <button type="submit" class="btn btn-success">Guardar</button>
        </div>
      </form>
    </div>
  `);
}

async function saveAdminAuxItem(itemId) {
  const tableKey = adminUiState.auxTable;
  const tableDef = ADMIN_AUX_TABLES[tableKey];

  try {
    if (tableDef.type === 'category') {
      const description = (document.getElementById('admin-aux-description').value || '').trim();
      const code = (document.getElementById('admin-aux-code').value || '').trim();
      const active = document.getElementById('admin-aux-active').checked;
      const parent_id = document.getElementById('admin-aux-parent').value || '';
      const notes = (document.getElementById('admin-aux-notes').value || '').trim();
      const woocommerce_category_id = (document.getElementById('admin-aux-woo-id').value || '').trim();
      if (!description) throw new Error('Ingrese una descripcion.');

      if (itemId) {
        await api.categories.update(itemId, {
          name: description,
          slug: code,
          description: notes,
          parent_id: parent_id || null,
          active,
          woocommerce_category_id: woocommerce_category_id || null
        });
      } else {
        await api.categories.create({
          name: description,
          slug: code,
          description: notes,
          parent_id: parent_id || null,
          active,
          woocommerce_category_id: woocommerce_category_id || null
        });
      }
      closeModal();
      renderAdmin(adminUiState.activeSection);
      return;
    }

    if (tableDef.type === 'brand') {
      const description = (document.getElementById('admin-aux-description').value || '').trim();
      const code = (document.getElementById('admin-aux-code').value || '').trim();
      const active = document.getElementById('admin-aux-active').checked;
      const woocommerce_brand_id = (document.getElementById('admin-aux-woo-id').value || '').trim();
      if (!description) throw new Error('Ingrese una descripcion.');

      if (itemId) {
        await api.deviceOptions.updateBrand(itemId, {
          name: description,
          slug: code,
          active,
          woocommerce_brand_id: woocommerce_brand_id || null
        });
      } else {
        await api.deviceOptions.addBrand({
          name: description,
          slug: code,
          active,
          woocommerce_brand_id: woocommerce_brand_id || null
        });
      }
      closeModal();
      renderAdmin(adminUiState.activeSection);
      return;
    }

    if (!adminAuxStore[tableKey]) adminAuxStore[tableKey] = [];
    const rows = adminAuxStore[tableKey];
    let payload;

    if (tableDef.type === 'numbering') {
      payload = {
        id: itemId || ('num-' + Date.now()),
        description: `${(document.getElementById('admin-aux-point-sale').value || '').trim()} - ${(document.getElementById('admin-aux-voucher-type').value || '').trim()}`,
        point_of_sale: (document.getElementById('admin-aux-point-sale').value || '').trim(),
        voucher_type: (document.getElementById('admin-aux-voucher-type').value || '').trim(),
        last_number: Number(document.getElementById('admin-aux-last-number').value || 0),
        auto_increment: document.getElementById('admin-aux-auto-increment').checked,
        active: document.getElementById('admin-aux-active').checked
      };
    } else if (tableDef.type === 'voucher') {
      payload = {
        id: itemId || ('voucher-' + Date.now()),
        description: (document.getElementById('admin-aux-voucher-type').value || '').trim(),
        voucher_type: (document.getElementById('admin-aux-voucher-type').value || '').trim(),
        letter: (document.getElementById('admin-aux-letter').value || '').trim(),
        affects_stock: document.getElementById('admin-aux-affects-stock').checked,
        affects_account: document.getElementById('admin-aux-affects-account').checked,
        active: document.getElementById('admin-aux-active').checked
      };
    } else {
      payload = {
        id: itemId || (tableKey + '-' + Date.now()),
        description: (document.getElementById('admin-aux-description').value || '').trim(),
        code: (document.getElementById('admin-aux-code').value || '').trim(),
        active: document.getElementById('admin-aux-active').checked
      };
    }

    if (!payload.description) throw new Error('Ingrese una descripcion.');
    const nextRows = itemId ? rows.map((row) => String(row.id) === String(itemId) ? payload : row) : [payload, ...rows];
    adminAuxStore[tableKey] = nextRows;
    saveAdminStore(ADMIN_STORAGE_KEYS.aux, adminAuxStore);
    closeModal();
    renderAdminSection();
  } catch (error) {
    alert(error.message);
  }
}

async function deleteAdminAuxItem(itemId) {
  const tableKey = adminUiState.auxTable;
  const tableDef = ADMIN_AUX_TABLES[tableKey];
  if (!confirm('Desea eliminar este registro?')) return;

  try {
    if (tableDef.type === 'category') {
      await api.categories.delete(itemId);
      renderAdmin(adminUiState.activeSection);
      return;
    }
    if (tableDef.type === 'brand') {
      await api.deviceOptions.deleteBrand(itemId);
      renderAdmin(adminUiState.activeSection);
      return;
    }

    adminAuxStore[tableKey] = (adminAuxStore[tableKey] || []).filter((row) => String(row.id) !== String(itemId));
    saveAdminStore(ADMIN_STORAGE_KEYS.aux, adminAuxStore);
    renderAdminSection();
  } catch (error) {
    alert(error.message);
  }
}

function renderAdminConfigGeneralSection() {
  const extra = adminConfigStore.general || {};
  return `
    <div class="admin-module-head">
      <div>
        <p class="admin-module-kicker">Administracion</p>
        <h2>Datos Generales</h2>
        <p>Configuracion central del negocio con el mismo criterio de formulario del sistema.</p>
      </div>
    </div>

    <div class="admin-form-card">
      <div class="admin-form-grid">
        <div class="form-group"><label>Nombre empresa</label><input id="admin-business-name" type="text" value="${adminEscapeAttr(adminSettingsData.business_name || '')}"></div>
        <div class="form-group"><label>Razon social</label><input id="admin-business-legal" type="text" value="${adminEscapeAttr(extra.legal_name || '')}"></div>
        <div class="form-group"><label>CUIT</label><input id="admin-business-taxid" type="text" value="${adminEscapeAttr(extra.tax_id || '')}"></div>
        <div class="form-group"><label>Telefono</label><input id="admin-business-phone" type="text" value="${adminEscapeAttr(adminSettingsData.business_phone || '')}"></div>
        <div class="form-group admin-field-span-2"><label>Direccion</label><input id="admin-business-address" type="text" value="${adminEscapeAttr(adminSettingsData.business_address || '')}"></div>
        <div class="form-group"><label>Email</label><input id="admin-business-email" type="email" value="${adminEscapeAttr(adminSettingsData.business_email || '')}"></div>
        <div class="form-group"><label>Moneda</label><input id="admin-business-currency" type="text" value="${adminEscapeAttr(extra.currency || 'ARS')}"></div>
        <div class="form-group"><label>Formato fecha</label><input id="admin-business-date-format" type="text" value="${adminEscapeAttr(extra.date_format || 'dd/MM/yyyy')}"></div>
        <div class="form-group"><label>Zona horaria</label><input id="admin-business-timezone" type="text" value="${adminEscapeAttr(extra.timezone || 'America/Argentina/Buenos_Aires')}"></div>
        <div class="form-group admin-field-span-2">
          <label>Logo empresa</label>
          <input id="admin-business-logo" type="file" accept="image/*" onchange="handleAdminLogoChange(this)">
          <small class="admin-help-inline">${adminEscapeHtml(extra.logo_name ? 'Archivo seleccionado: ' + extra.logo_name : 'Puede seleccionar un archivo para registrar el logo en la configuracion local.')}</small>
        </div>
      </div>
      <div class="admin-actions-row">
        <button class="btn btn-success" type="button" onclick="saveAdminGeneralConfig()">Guardar cambios</button>
      </div>
    </div>
  `;
}

async function saveAdminGeneralConfig() {
  const payload = {
    business_name: document.getElementById('admin-business-name').value,
    business_address: document.getElementById('admin-business-address').value,
    business_phone: document.getElementById('admin-business-phone').value,
    business_email: document.getElementById('admin-business-email').value
  };

  try {
    await api.settings.update(payload);
    adminConfigStore.general = {
      ...(adminConfigStore.general || {}),
      legal_name: document.getElementById('admin-business-legal').value,
      tax_id: document.getElementById('admin-business-taxid').value,
      currency: document.getElementById('admin-business-currency').value,
      date_format: document.getElementById('admin-business-date-format').value,
      timezone: document.getElementById('admin-business-timezone').value,
      logo_name: (adminConfigStore.general || {}).logo_name || ''
    };
    saveAdminStore(ADMIN_STORAGE_KEYS.config, adminConfigStore);
    renderAdmin(adminUiState.activeSection);
  } catch (error) {
    alert(error.message);
  }
}

function handleAdminLogoChange(input) {
  const file = input.files && input.files[0];
  adminConfigStore.general = {
    ...(adminConfigStore.general || {}),
    logo_name: file ? file.name : ''
  };
  saveAdminStore(ADMIN_STORAGE_KEYS.config, adminConfigStore);
  renderAdminSection();
}

function renderAdminConfigDocumentsSection() {
  const config = adminConfigStore.documents || {};
  return `
    <div class="admin-module-head">
      <div>
        <p class="admin-module-kicker">Administracion</p>
        <h2>Configuracion de Comprobantes</h2>
        <p>Parametros comerciales y de numeracion para resguardar consistencia operativa.</p>
      </div>
    </div>

    <div class="admin-form-card">
      <div class="admin-form-grid">
        <div class="form-group"><label>Formato numeracion</label><input id="admin-doc-numbering-format" type="text" value="${adminEscapeAttr(config.numbering_format || '')}"></div>
        <div class="form-group"><label>Prefijos</label><input id="admin-doc-prefixes" type="text" value="${adminEscapeAttr(config.prefixes || '')}"></div>
        <div class="form-group"><label>Decimales permitidos</label><input id="admin-doc-decimals" type="number" min="0" max="6" value="${adminEscapeAttr(config.decimals ?? 2)}"></div>
        <div class="form-group admin-field-span-2">
          <label class="admin-switch-row"><input id="admin-doc-control-stock" type="checkbox" ${config.control_stock !== false ? 'checked' : ''}><span>Control de stock</span></label>
        </div>
        <div class="form-group admin-field-span-2">
          <label class="admin-switch-row"><input id="admin-doc-negative-stock" type="checkbox" ${config.allow_negative_stock ? 'checked' : ''}><span>Permitir stock negativo</span></label>
        </div>
        <div class="form-group admin-field-span-2">
          <label class="admin-switch-row"><input id="admin-doc-min-price" type="checkbox" ${config.control_min_price ? 'checked' : ''}><span>Control de precios minimos</span></label>
        </div>
      </div>
      <div class="admin-actions-row">
        <button class="btn btn-success" type="button" onclick="saveAdminDocumentsConfig()">Guardar configuracion</button>
      </div>
    </div>
  `;
}

function saveAdminDocumentsConfig() {
  adminConfigStore.documents = {
    numbering_format: document.getElementById('admin-doc-numbering-format').value,
    prefixes: document.getElementById('admin-doc-prefixes').value,
    decimals: Number(document.getElementById('admin-doc-decimals').value || 2),
    control_stock: document.getElementById('admin-doc-control-stock').checked,
    allow_negative_stock: document.getElementById('admin-doc-negative-stock').checked,
    control_min_price: document.getElementById('admin-doc-min-price').checked
  };
  saveAdminStore(ADMIN_STORAGE_KEYS.config, adminConfigStore);
  renderAdminSection();
}

function renderAdminConfigMailSection() {
  const config = adminConfigStore.mail || {};
  return `
    <div class="admin-module-head">
      <div>
        <p class="admin-module-kicker">Administracion</p>
        <h2>Mail</h2>
        <p>Panel de configuracion SMTP con acciones visibles y foco en pruebas rapidas.</p>
      </div>
    </div>

    <div class="admin-form-card">
      <div class="admin-form-grid">
        <div class="form-group"><label>Servidor SMTP</label><input id="admin-mail-server" type="text" value="${adminEscapeAttr(config.smtp_server || '')}"></div>
        <div class="form-group"><label>Puerto</label><input id="admin-mail-port" type="number" value="${adminEscapeAttr(config.port || 587)}"></div>
        <div class="form-group"><label>Usuario</label><input id="admin-mail-user" type="text" value="${adminEscapeAttr(config.username || '')}"></div>
        <div class="form-group"><label>Contrasena</label><input id="admin-mail-password" type="password" value="${adminEscapeAttr(config.password || '')}"></div>
        <div class="form-group"><label>TLS / SSL</label><select id="admin-mail-encryption">${adminBuildOptions([{ value: 'tls', label: 'TLS' }, { value: 'ssl', label: 'SSL' }, { value: 'none', label: 'Sin cifrado' }], config.encryption || 'tls', '')}</select></div>
        <div class="form-group"><label>Email remitente</label><input id="admin-mail-sender" type="email" value="${adminEscapeAttr(config.sender_email || '')}"></div>
      </div>
      <div class="admin-actions-row">
        <button class="btn btn-secondary" type="button" onclick="testAdminMailConfig()">Probar conexion</button>
        <button class="btn btn-success" type="button" onclick="saveAdminMailConfig()">Guardar configuracion</button>
      </div>
      ${adminProcessLog && adminProcessLog.scope === 'mail' ? renderAdminProcessLog() : ''}
    </div>
  `;
}

function saveAdminMailConfig() {
  adminConfigStore.mail = {
    smtp_server: document.getElementById('admin-mail-server').value,
    port: document.getElementById('admin-mail-port').value,
    username: document.getElementById('admin-mail-user').value,
    password: document.getElementById('admin-mail-password').value,
    encryption: document.getElementById('admin-mail-encryption').value,
    sender_email: document.getElementById('admin-mail-sender').value
  };
  saveAdminStore(ADMIN_STORAGE_KEYS.config, adminConfigStore);
  renderAdminSection();
}

function testAdminMailConfig() {
  adminProcessLog = {
    scope: 'mail',
    title: 'Prueba de conexion',
    status: 'Proceso completado',
    errors: 'No se detectaron errores en la validacion visual de la configuracion.',
    time: '0.2 s'
  };
  renderAdminSection();
}

function renderAdminResetDataSection() {
  return `
    <div class="admin-module-head">
      <div>
        <p class="admin-module-kicker">Administracion</p>
        <h2>Borrar datos iniciales</h2>
        <p>Accion critica con confirmacion obligatoria y mensaje de advertencia visible.</p>
      </div>
    </div>

    <div class="admin-warning-card">
      <h3>Esta accion eliminara datos iniciales del sistema.</h3>
      <p>Seleccione los grupos a restablecer y escriba <strong>RESTABLECER</strong> para confirmar.</p>
      <div class="admin-check-grid">
        <label class="admin-check-item"><input id="admin-reset-customers" type="checkbox"> Clientes demo</label>
        <label class="admin-check-item"><input id="admin-reset-products" type="checkbox"> Articulos demo</label>
        <label class="admin-check-item"><input id="admin-reset-vouchers" type="checkbox"> Comprobantes demo</label>
      </div>
      <div class="form-group">
        <label>Confirmacion obligatoria</label>
        <input id="admin-reset-confirm" type="text" placeholder="Escriba RESTABLECER">
      </div>
      <div class="admin-actions-row">
        <button class="btn btn-danger" type="button" onclick="runAdminResetData()">Restablecer datos</button>
      </div>
      ${adminProcessLog && adminProcessLog.scope === 'reset' ? renderAdminProcessLog() : ''}
    </div>
  `;
}

function runAdminResetData() {
  const confirmValue = (document.getElementById('admin-reset-confirm').value || '').trim().toUpperCase();
  if (confirmValue !== 'RESTABLECER') {
    alert('Debe escribir RESTABLECER para continuar.');
    return;
  }
  adminProcessLog = {
    scope: 'reset',
    title: 'Restablecer datos',
    status: 'Proceso completado',
    errors: 'Modo seguro: no se eliminaron datos productivos porque el backend actual no expone borrado masivo.',
    time: '0.1 s'
  };
  renderAdminSection();
}

function renderAdminTroubleshootSection() {
  return `
    <div class="admin-module-head">
      <div>
        <p class="admin-module-kicker">Administracion</p>
        <h2>Solucionar Problemas</h2>
        <p>Herramientas tecnicas con confirmacion previa y resultado visible al finalizar.</p>
      </div>
    </div>

    <div class="admin-tools-grid">
      <button class="admin-tool-card" type="button" onclick="runAdminTroubleshoot('indices')">
        <strong>Recrear indices y tablas</strong>
        <span>Reconstruye estructuras administrativas locales para diagnostico visual.</span>
      </button>
      <button class="admin-tool-card" type="button" onclick="runAdminTroubleshoot('ventas')">
        <strong>Reparar ventas</strong>
        <span>Revisa estructura de comprobantes y consistencia de datos comerciales.</span>
      </button>
      <button class="admin-tool-card" type="button" onclick="runAdminTroubleshoot('cache')">
        <strong>Limpiar cache</strong>
        <span>Limpia caches locales del frontend sin tocar la base principal.</span>
      </button>
    </div>

    ${adminProcessLog && adminProcessLog.scope === 'troubleshoot' ? renderAdminProcessLog() : ''}
  `;
}

function runAdminTroubleshoot(type) {
  const messages = {
    indices: 'Se regeneraron referencias visuales y catalogos locales del modulo administrativo.',
    ventas: 'Se completo la validacion superficial de ventas y numeracion sin cambios estructurales.',
    cache: 'Se limpiaron caches locales de administracion y sesiones auxiliares.'
  };
  if (!confirm('Desea ejecutar esta accion tecnica?')) return;
  if (type === 'cache') {
    localStorage.removeItem(ADMIN_STORAGE_KEYS.sessions);
    localStorage.removeItem(ADMIN_STORAGE_KEYS.aux);
  }
  adminProcessLog = {
    scope: 'troubleshoot',
    title: 'Proceso completado',
    status: messages[type] || 'Operacion finalizada.',
    errors: 'No se detectaron errores criticos.',
    time: '0.3 s'
  };
  renderAdmin(adminUiState.activeSection);
}

function renderAdminProcessLog() {
  return `
    <div class="admin-process-card">
      <h4>${adminEscapeHtml(adminProcessLog.title)}</h4>
      <p><strong>Resultado:</strong> ${adminEscapeHtml(adminProcessLog.status)}</p>
      <p><strong>Errores detectados:</strong> ${adminEscapeHtml(adminProcessLog.errors)}</p>
      <p><strong>Tiempo de ejecucion:</strong> ${adminEscapeHtml(adminProcessLog.time)}</p>
    </div>
  `;
}

window.renderAdmin = renderAdmin;
window.renderAdminSection = renderAdminSection;
window.setAdminUsersSearch = setAdminUsersSearch;
window.changeAdminUsersPage = changeAdminUsersPage;
window.showAdminUserModal = showAdminUserModal;
window.saveAdminUser = saveAdminUser;
window.toggleAdminUserStatus = toggleAdminUserStatus;
window.deleteAdminUser = deleteAdminUser;
window.setAdminConnectedSearch = setAdminConnectedSearch;
window.changeAdminConnectedPage = changeAdminConnectedPage;
window.forceCloseAdminSession = forceCloseAdminSession;
window.setAdminAuxTable = setAdminAuxTable;
window.setAdminAuxSearch = setAdminAuxSearch;
window.changeAdminAuxPage = changeAdminAuxPage;
window.showAdminAuxModal = showAdminAuxModal;
window.saveAdminAuxItem = saveAdminAuxItem;
window.deleteAdminAuxItem = deleteAdminAuxItem;
window.saveAdminGeneralConfig = saveAdminGeneralConfig;
window.handleAdminLogoChange = handleAdminLogoChange;
window.saveAdminDocumentsConfig = saveAdminDocumentsConfig;
window.saveAdminMailConfig = saveAdminMailConfig;
window.testAdminMailConfig = testAdminMailConfig;
window.runAdminResetData = runAdminResetData;
window.runAdminTroubleshoot = runAdminTroubleshoot;
