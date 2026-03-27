document.addEventListener('DOMContentLoaded', async () => {
  const today = new Date();
  document.getElementById('current-date').textContent = today.toLocaleDateString('es-ES', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  
  document.getElementById('login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;
    const errorEl = document.getElementById('login-error');
    
    try {
      await auth.login(username, password);
      errorEl.textContent = '';
    } catch (err) {
      errorEl.textContent = err.message;
    }
  });
  
  // Only add event listener to existing logout button
  const logoutBtnSidebar = document.getElementById('logout-btn-sidebar');
  if (logoutBtnSidebar) {
    logoutBtnSidebar.addEventListener('click', (e) => {
      e.preventDefault();
      auth.logout();
    });
  }
  
  document.querySelectorAll('.nav-item').forEach(el => {
    el.addEventListener('click', (e) => {
      if (el.classList.contains('nav-group-toggle')) {
        e.preventDefault();
        el.closest('.nav-group').classList.toggle('open');
      } else {
        e.preventDefault();
        const page = el.dataset.page;
        if (page) {
          window.location.hash = page;
        }
      }
    });
  });
  
  console.log('App initializing...');
  await auth.initAuth();
  console.log('auth.initAuth done, currentUser:', auth.currentUser);
  if (auth.currentUser) {
    document.getElementById('page-content').innerHTML = '<div class="loading">Cargando...</div>';
    console.log('Calling handleRoute...');
    handleRoute();
  }
});

function showModal(content) {
  const container = document.getElementById('modal-container');
  container.innerHTML = '<div class="modal-overlay" onclick="if(event.target === this) this.remove()">' + content + '</div>';
}

function closeModal() {
  document.getElementById('modal-container').innerHTML = '';
}

function formatMoney(amount) {
  const num = parseFloat(amount) || 0;
  const parts = num.toFixed(2).split('.');
  parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return '$ ' + parts.join(',');
}

function formatDate(date) {
  return new Date(date).toLocaleDateString('es-ES');
}

function formatDateTime(date) {
  return new Date(date).toLocaleString('es-ES');
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function escapeAttr(value) {
  return escapeHtml(value).replace(/`/g, '&#96;');
}

function safeImageUrl(value) {
  const url = String(value ?? '').trim();
  if (!url) return '';
  if (url.startsWith('/') || /^https?:\/\//i.test(url)) return escapeAttr(url);
  return '';
}

window.app = { showModal, closeModal, formatMoney, formatDate, formatDateTime, escapeHtml, escapeAttr, safeImageUrl };
console.log('App loaded');

function toggleMenu(groupId) {
  const group = document.getElementById(groupId);
  group.classList.toggle('open');
}
