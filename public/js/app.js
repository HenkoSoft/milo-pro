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
      startOnlineSalesMonitor();
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
  if (getAuthenticatedUser()) {
    startOnlineSalesMonitor();
    document.getElementById('page-content').innerHTML = '<div class="loading">Cargando...</div>';
    console.log('Calling handleRoute...');
    handleRoute();
  }
});

let onlineSalesMonitorId = null;
let lastOnlineSaleSeenId = null;
let appAudioContext = null;
const ONLINE_SALE_STATUS_LABELS = {
  pending_payment: 'pendiente de pago',
  paid: 'pagado',
  ready_for_delivery: 'listo para entregar',
  completed: 'completado',
  on_hold: 'en espera',
  cancelled: 'cancelado',
  refunded: 'reintegrado',
  payment_failed: 'pago fallido',
  pending: 'pendiente',
  processing: 'procesando',
  failed: 'fallido'
};

function getAuthenticatedUser() {
  if (window.auth && typeof window.auth.getCurrentUser === 'function') {
    return window.auth.getCurrentUser();
  }
  return (window.auth && window.auth.currentUser) || null;
}

function formatOnlineSaleStatusLabel(status) {
  const normalized = String(status || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_')
    .replace(/-/g, '_');
  return ONLINE_SALE_STATUS_LABELS[normalized] || normalized.replace(/_/g, ' ');
}

function ensureToastContainer() {
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    container.className = 'toast-container';
    document.body.appendChild(container);
  }
  return container;
}

function showToast(message, options = {}) {
  const container = ensureToastContainer();
  const toast = document.createElement('div');
  toast.className = 'app-toast' + (options.variant ? ` is-${options.variant}` : '');
  toast.innerHTML = `
    <div class="app-toast-body">
      <strong>${escapeHtml(options.title || 'Aviso')}</strong>
      <p>${escapeHtml(message)}</p>
    </div>
    <div class="app-toast-actions"></div>
  `;

  const actions = toast.querySelector('.app-toast-actions');
  if (options.actionLabel && typeof options.onAction === 'function') {
    const actionBtn = document.createElement('button');
    actionBtn.type = 'button';
    actionBtn.className = 'btn btn-sm btn-primary';
    actionBtn.textContent = options.actionLabel;
    actionBtn.addEventListener('click', () => {
      options.onAction();
      toast.remove();
    });
    actions.appendChild(actionBtn);
  }

  const closeBtn = document.createElement('button');
  closeBtn.type = 'button';
  closeBtn.className = 'btn btn-sm btn-secondary';
  closeBtn.textContent = 'Cerrar';
  closeBtn.addEventListener('click', () => toast.remove());
  actions.appendChild(closeBtn);

  container.appendChild(toast);
  window.setTimeout(() => {
    if (toast.isConnected) toast.remove();
  }, Number(options.durationMs || 9000));
}

function playOnlineSaleNotificationSound() {
  try {
    const AudioContextCtor = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextCtor) return;
    if (!appAudioContext) {
      appAudioContext = new AudioContextCtor();
    }
    if (appAudioContext.state === 'suspended') {
      appAudioContext.resume().catch(() => {});
    }

    const oscillator = appAudioContext.createOscillator();
    const gainNode = appAudioContext.createGain();
    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(880, appAudioContext.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(1320, appAudioContext.currentTime + 0.18);
    gainNode.gain.setValueAtTime(0.0001, appAudioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.06, appAudioContext.currentTime + 0.02);
    gainNode.gain.exponentialRampToValueAtTime(0.0001, appAudioContext.currentTime + 0.25);
    oscillator.connect(gainNode);
    gainNode.connect(appAudioContext.destination);
    oscillator.start();
    oscillator.stop(appAudioContext.currentTime + 0.26);
  } catch (error) {
    console.error('Notification sound error:', error.message);
  }
}

function isUrgentOnlineSale(sale) {
  const status = String(sale && sale.status || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_')
    .replace(/-/g, '_');
  return ['pending_payment', 'pending', 'on_hold', 'on_hold_', 'paid', 'ready_for_delivery', 'procesando', 'processing'].includes(status);
}

function updateWebOrdersNavBadge(feed = []) {
  const badge = document.getElementById('sales-web-orders-badge');
  if (!badge) return;
  const count = (Array.isArray(feed) ? feed : []).filter((sale) => isUrgentOnlineSale(sale)).length;
  badge.textContent = count > 99 ? '99+' : String(count);
  badge.hidden = count <= 0;
}

async function checkForNewOnlineSales({ silent = false } = {}) {
  if (!getAuthenticatedUser()) return;

  try {
    const feed = await api.sales.onlineFeed();
    const onlineSales = Array.isArray(feed) ? feed : [];
    updateWebOrdersNavBadge(onlineSales);
    if (onlineSales.length === 0) return;

    if (lastOnlineSaleSeenId === null) {
      lastOnlineSaleSeenId = Number(onlineSales[0].id || 0);
      return;
    }

    const newSales = onlineSales
      .filter((sale) => Number(sale.id || 0) > lastOnlineSaleSeenId)
      .sort((a, b) => Number(a.id || 0) - Number(b.id || 0));

    if (!silent) {
      newSales.forEach((sale) => {
        if (isUrgentOnlineSale(sale)) {
          playOnlineSaleNotificationSound();
        }
        const customerName = sale.customer_name || 'Cliente web';
        showToast(
          `${customerName} - ${formatMoney(sale.total || 0)} - estado ${formatOnlineSaleStatusLabel(sale.status)}`,
          {
            title: 'Nueva venta online',
            variant: 'success',
            actionLabel: 'Ver venta',
            onAction: () => {
              window.location.hash = 'sales-query-invoices';
            }
          }
        );
      });

      if (newSales.length > 0) {
        window.dispatchEvent(new CustomEvent('online-sales:new', {
          detail: {
            newSales,
            onlineSales
          }
        }));
      }
    }

    lastOnlineSaleSeenId = Math.max(lastOnlineSaleSeenId, ...onlineSales.map((sale) => Number(sale.id || 0)));
  } catch (error) {
    console.error('Online sales monitor error:', error.message);
  }
}

function startOnlineSalesMonitor() {
  if (onlineSalesMonitorId) return;
  checkForNewOnlineSales({ silent: true });
  onlineSalesMonitorId = window.setInterval(() => {
    checkForNewOnlineSales({ silent: false });
  }, 15000);
}

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
    } else if (dotMatches.length === 1) {
      const [integerPart, decimalPart = ''] = raw.split('.');
      if (/^\d{3}$/.test(decimalPart)) {
        normalized = `${integerPart}${decimalPart}`;
      }
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
  showToast,
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
