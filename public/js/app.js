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
  container.innerHTML = '<div class="modal-overlay">' + content + '</div>';
}

function closeModal() {
  document.getElementById('modal-container').innerHTML = '';
}

function formatMoney(amount) {
  const num = Number.parseFloat(amount) || 0;
  return '$ ' + new Intl.NumberFormat('es-AR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(num);
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
  if (/^data:image\//i.test(url)) return escapeAttr(url);
  if (url.startsWith('/') || /^https?:\/\//i.test(url)) return escapeAttr(url);
  return '';
}

function parseLocaleNumber(value, fallback = 0) {
  const raw = String(value ?? '')
    .trim()
    .replace(/\s+/g, '');
  if (!raw) return fallback;

  const lastComma = raw.lastIndexOf(',');
  const lastDot = raw.lastIndexOf('.');
  let normalized = raw;

  if (lastComma >= 0 && lastDot >= 0) {
    if (lastComma > lastDot) {
      normalized = raw.replace(/\./g, '').replace(',', '.');
    } else {
      normalized = raw.replace(/,/g, '');
    }
  } else if (lastComma >= 0) {
    normalized = raw.replace(/\./g, '').replace(',', '.');
  } else {
    const dotMatches = raw.match(/\./g) || [];
    if (dotMatches.length > 1) {
      const parts = raw.split('.');
      const decimalPart = parts.pop();
      normalized = parts.join('') + '.' + decimalPart;
    }
  }

  const parsed = Number.parseFloat(normalized);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function parseIntegerInputValue(value, fallback = 0) {
  const normalized = String(value ?? '').replace(/[^\d-]/g, '');
  const parsed = Number.parseInt(normalized, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function sanitizeNumericInput(input, options = {}) {
  if (!input) return '';
  const decimals = Number.isFinite(Number(options.decimals)) ? Math.max(0, Number(options.decimals)) : 0;
  const allowNegative = !!options.allowNegative;
  const rawValue = String(input.value ?? '');
  const normalized = rawValue.replace(',', '.');
  let result = '';
  let hasDecimalSeparator = false;

  for (let index = 0; index < normalized.length; index += 1) {
    const char = normalized[index];
    if (char >= '0' && char <= '9') {
      result += char;
      continue;
    }
    if (char === '-' && allowNegative && result.length === 0) {
      result += char;
      continue;
    }
    if (char === '.' && decimals > 0 && !hasDecimalSeparator) {
      result += char;
      hasDecimalSeparator = true;
    }
  }

  if (hasDecimalSeparator) {
    const parts = result.split('.');
    const integerPart = parts.shift() || '';
    const decimalPart = parts.join('').slice(0, decimals);
    result = integerPart + '.' + decimalPart;
  }

  input.value = result;
  return result;
}

function formatDecimalInputValue(value, decimals = 2) {
  return new Intl.NumberFormat('es-AR', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  }).format(parseLocaleNumber(value, 0));
}

window.app = {
  showModal,
  closeModal,
  formatMoney,
  formatDate,
  formatDateTime,
  escapeHtml,
  escapeAttr,
  safeImageUrl,
  parseLocaleNumber,
  parseIntegerInputValue,
  sanitizeNumericInput,
  formatDecimalInputValue
};
console.log('App loaded');

function toggleMenu(groupId) {
  const group = document.getElementById(groupId);
  group.classList.toggle('open');
}
