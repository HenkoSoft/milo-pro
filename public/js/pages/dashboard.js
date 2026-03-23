async function renderDashboard() {
  const content = document.getElementById('page-content');
  content.innerHTML = '<div class="loading">Cargando...</div>';
  
  try {
    const stats = await api.dashboard.stats();
    
    content.innerHTML = 
      '<div class="stats-grid">' +
      '<div class="stat-card primary">' +
      '<div class="stat-icon">💰</div>' +
      '<div class="stat-value">' + app.formatMoney(stats.todaySales) + '</div>' +
      '<div class="stat-label">Ventas de Hoy</div>' +
      '</div>' +
      '<div class="stat-card">' +
      '<div class="stat-icon">📦</div>' +
      '<div class="stat-value">' + stats.totalProducts + '</div>' +
      '<div class="stat-label">Productos</div>' +
      '</div>' +
      '<div class="stat-card success">' +
      '<div class="stat-icon">🔧</div>' +
      '<div class="stat-value">' + stats.activeRepairs + '</div>' +
      '<div class="stat-label">Reparaciones Activas</div>' +
      '</div>' +
      '<div class="stat-card">' +
      '<div class="stat-icon">👥</div>' +
      '<div class="stat-value">' + stats.totalCustomers + '</div>' +
      '<div class="stat-label">Clientes</div>' +
      '</div>' +
      '</div>' +
      '<div class="card" style="margin-top: 20px;">' +
      '<div class="card-header"><h3 class="card-title">Accesos Rápidos</h3></div>' +
      '<div class="quick-links" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: 15px; padding: 15px 0;">' +
      '<a href="#products" class="quick-link" style="display: flex; flex-direction: column; align-items: center; padding: 20px; background: #f8fafc; border-radius: 8px; text-decoration: none; color: var(--text-primary); transition: all 0.2s;">' +
      '<span style="font-size: 24px; margin-bottom: 8px;">📦</span>' +
      '<span style="font-weight: 600;">F1</span>' +
      '<span>Artículos</span>' +
      '</a>' +
      '<a href="#customers" class="quick-link" style="display: flex; flex-direction: column; align-items: center; padding: 20px; background: #f8fafc; border-radius: 8px; text-decoration: none; color: var(--text-primary); transition: all 0.2s;">' +
      '<span style="font-size: 24px; margin-bottom: 8px;">👥</span>' +
      '<span style="font-weight: 600;">F2</span>' +
      '<span>Clientes</span>' +
      '</a>' +
      '<a href="#purchases" class="quick-link" style="display: flex; flex-direction: column; align-items: center; padding: 20px; background: #f8fafc; border-radius: 8px; text-decoration: none; color: var(--text-primary); transition: all 0.2s;">' +
      '<span style="font-size: 24px; margin-bottom: 8px;">🛒</span>' +
      '<span style="font-weight: 600;">F3</span>' +
      '<span>Compras</span>' +
      '</a>' +
      '<a href="#sales" class="quick-link" style="display: flex; flex-direction: column; align-items: center; padding: 20px; background: #f8fafc; border-radius: 8px; text-decoration: none; color: var(--text-primary); transition: all 0.2s;">' +
      '<span style="font-size: 24px; margin-bottom: 8px;">💰</span>' +
      '<span style="font-weight: 600;">F4</span>' +
      '<span>Ventas</span>' +
      '</a>' +
      '<a href="#invoices" class="quick-link" style="display: flex; flex-direction: column; align-items: center; padding: 20px; background: #f8fafc; border-radius: 8px; text-decoration: none; color: var(--text-primary); transition: all 0.2s;">' +
      '<span style="font-size: 24px; margin-bottom: 8px;">📋</span>' +
      '<span style="font-weight: 600;">F5</span>' +
      '<span>Remitos</span>' +
      '</a>' +
      '<a href="#quotes" class="quick-link" style="display: flex; flex-direction: column; align-items: center; padding: 20px; background: #f8fafc; border-radius: 8px; text-decoration: none; color: var(--text-primary); transition: all 0.2s;">' +
      '<span style="font-size: 24px; margin-bottom: 8px;">📝</span>' +
      '<span style="font-weight: 600;">F6</span>' +
      '<span>Presupuestos</span>' +
      '</a>' +
      '<a href="#sales-query" class="quick-link" style="display: flex; flex-direction: column; align-items: center; padding: 20px; background: #f8fafc; border-radius: 8px; text-decoration: none; color: var(--text-primary); transition: all 0.2s; grid-column: span 1;">' +
      '<span style="font-size: 24px; margin-bottom: 8px;">🔍</span>' +
      '<span style="font-weight: 600;">F7</span>' +
      '<span>Consulta Ventas</span>' +
      '</a>' +
      '</div>' +
      '</div>';
  } catch (e) {
    content.innerHTML = '<div class="alert alert-warning">Error: ' + e.message + '</div>';
  }
}
console.log('Dashboard loaded');