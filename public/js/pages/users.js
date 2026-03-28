let usersData = [];

function renderPasswordInput(id, label) {
  return '' +
    '<div class="form-group">' +
    '<label>' + label + '</label>' +
    '<div style="position:relative;">' +
    '<input type="password" id="' + id + '" value="" autocomplete="new-password" style="padding-right:44px;">' +
    '<button type="button" onclick="togglePasswordVisibility(\'' + id + '\', this)" aria-label="Mostrar contrase' + '\u00f1' + 'a" style="position:absolute;right:10px;top:50%;transform:translateY(-50%);border:none;background:transparent;cursor:pointer;color:#64748b;font-size:16px;">&#128065;</button>' +
    '</div>' +
    '</div>';
}

async function renderUsers() {
  const content = document.getElementById('page-content');
  if (!auth.isAdmin()) {
    content.innerHTML = '<div class="alert alert-warning">Acceso denegado. Solo administradores.</div>';
    return;
  }

  content.innerHTML = '<div class="loading">Cargando...</div>';

  try {
    usersData = await api.auth.getUsers();

    content.innerHTML =
      '<div class="card">' +
      '<div class="card-header">' +
      '<h3 class="card-title">Gesti&oacute;n de Usuarios</h3>' +
      '<button class="btn btn-primary" onclick="showUserModal()">+ Nuevo Usuario</button>' +
      '</div>' +
      '<div class="table-container">' +
      '<table><thead><tr><th>Usuario</th><th>Nombre</th><th>Rol</th><th>Fecha</th><th>Acciones</th></tr></thead><tbody id="users-table">' +
      usersData.map(u => '<tr><td>' + u.username + '</td><td>' + u.name + '</td><td><span class="badge ' + (u.role === 'admin' ? 'badge-purple' : 'badge-blue') + '">' + (u.role === 'admin' ? 'Admin' : 'T&eacute;cnico') + '</span></td><td>' + app.formatDate(u.created_at) + '</td><td><button class="btn btn-sm btn-danger" onclick="deleteUser(' + u.id + ')">Eliminar</button></td></tr>').join('') +
      '</tbody></table></div>' +
      '</div>' +
      '<div id="user-modal" style="display:none;">' +
      '<div class="modal">' +
      '<div class="modal-header"><h3>Nuevo Usuario</h3><button class="modal-close" onclick="closeUserModal()">x</button></div>' +
      '<div class="modal-body">' +
      '<div class="form-group"><label>Usuario</label><input type="text" id="user-username" value="" autocomplete="off"></div>' +
      '<div class="form-group"><label>Nombre</label><input type="text" id="user-name"></div>' +
      renderPasswordInput('user-password', 'Contrase&ntilde;a') +
      '<div class="form-group"><label>Rol</label><select id="user-role"><option value="technician">T&eacute;cnico</option><option value="admin">Administrador</option></select></div>' +
      '</div>' +
      '<div class="modal-footer"><button class="btn btn-secondary" onclick="closeUserModal()">Cancelar</button><button class="btn btn-primary" onclick="saveUser()">Guardar</button></div>' +
      '</div></div>';
  } catch (e) {
    content.innerHTML = '<div class="alert alert-warning">Error: ' + e.message + '</div>';
  }
}

function showUserModal() {
  document.getElementById('user-modal').style.display = 'block';
}

function closeUserModal() {
  document.getElementById('user-modal').style.display = 'none';
}

function togglePasswordVisibility(inputId, button) {
  const input = document.getElementById(inputId);
  if (!input) return;

  const showPassword = input.type === 'password';
  input.type = showPassword ? 'text' : 'password';
  button.setAttribute('aria-label', showPassword ? 'Ocultar contrase' + '\u00f1' + 'a' : 'Mostrar contrase' + '\u00f1' + 'a');
}

async function saveUser() {
  const data = {
    username: document.getElementById('user-username').value,
    name: document.getElementById('user-name').value,
    password: document.getElementById('user-password').value,
    role: document.getElementById('user-role').value
  };
  try {
    await api.auth.createUser(data);
    closeUserModal();
    renderUsers();
  } catch (e) { alert(e.message); }
}

async function deleteUser(id) {
  if (!confirm('Eliminar usuario?')) return;
  alert('Funci' + '\u00f3' + 'n no implementada en demo');
}

console.log('Users loaded');
