let currentUser = null;
let businessSettings = { business_name: 'Milo Pro' };

async function loadSettings() {
  try {
    businessSettings = await api.settings.get();
    window.businessName = businessSettings.business_name;
    const sidebarName = document.getElementById('sidebar-business-name');
    if (sidebarName) {
      sidebarName.textContent = businessSettings.business_name || 'Milo Pro';
    }
  } catch (e) {
    console.log('Could not load settings');
  }
}

async function initAuth() {
  const token = localStorage.getItem('token');
  if (!token) return showLogin();
  
  try {
    currentUser = await api.auth.me();
    await loadSettings();
    showApp();
    handleRoute();
  } catch (e) {
    localStorage.removeItem('token');
    showLogin();
  }
}

async function login(username, password) {
  try {
    const data = await api.auth.login(username, password);
    localStorage.setItem('token', data.token);
    currentUser = data.user;
    await loadSettings();
    showApp();
    console.log('Login successful, calling handleRoute...');
    handleRoute();
  } catch (e) {
    throw e;
  }
}

async function logout() {
  try { await api.auth.logout(); } catch (e) {}
  localStorage.removeItem('token');
  currentUser = null;
  showLogin();
}

function showLogin() {
  document.getElementById('login-screen').style.display = 'flex';
  document.getElementById('app').style.display = 'none';
}

function showApp() {
  document.getElementById('login-screen').style.display = 'none';
  document.getElementById('app').style.display = 'flex';
  
  document.getElementById('user-role').textContent = currentUser.role === 'admin' ? 'Administrador' : 'Técnico';
  
  if (currentUser.role === 'admin') {
    const adminGroup = document.getElementById('admin-group');
    const adminNav = document.getElementById('admin-nav');
    if (adminGroup) adminGroup.style.display = 'block';
    if (adminNav) adminNav.style.display = 'flex';
  }
}

function isAdmin() {
  return currentUser && currentUser.role === 'admin';
}

window.auth = { initAuth, login, logout, currentUser, isAdmin };
console.log('Auth loaded');
