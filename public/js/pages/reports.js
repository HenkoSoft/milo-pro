async function renderReports() {
  const content = document.getElementById('page-content');
  content.innerHTML = '<div class="loading">Cargando...</div>';
  
  try {
    const [salesData, productsData, revenueData] = await Promise.all([
      api.reports.sales({}),
      api.reports.products(),
      api.reports.revenue('month')
    ]);
    
    content.innerHTML = 
      '<div class="stats-grid">' +
      '<div class="stat-card primary"><div class="stat-icon">💰</div><div class="stat-value">' + app.formatMoney(revenueData.salesRevenue) + '</div><div class="stat-label">Ventas del Mes</div></div>' +
      '<div class="stat-card success"><div class="stat-icon">🔧</div><div class="stat-value">' + app.formatMoney(revenueData.repairsRevenue) + '</div><div class="stat-label">Reparaciones del Mes</div></div>' +
      '<div class="stat-card"><div class="stat-icon">📦</div><div class="stat-value">' + revenueData.salesCount + '</div><div class="stat-label">Transacciones</div></div>' +
      '<div class="stat-card warning"><div class="stat-icon">⚠️</div><div class="stat-value">' + productsData.lowStock.length + '</div><div class="stat-label">Stock Bajo</div></div>' +
      '</div>' +
      
      '<div class="card" style="margin-top:20px;">' +
      '<div class="card-header"><h3 class="card-title">Productos Más Vendidos</h3></div>' +
      '<table><thead><tr><th>Producto</th><th>Vendidos</th><th>Ingresos</th></tr></thead><tbody>' +
      productsData.topSelling.slice(0,10).map(p => '<tr><td>' + p.name + '</td><td>' + p.totalSold + '</td><td>' + app.formatMoney(p.totalRevenue) + '</td></tr>').join('') +
      '</tbody></table></div>' +
      
      '<div class="card" style="margin-top:20px;">' +
      '<div class="card-header"><h3 class="card-title">Ventas Recientes</h3></div>' +
      '<table><thead><tr><th>ID</th><th>Cliente</th><th>Total</th><th>Fecha</th></tr></thead><tbody>' +
      salesData.sales.slice(0,10).map(s => '<tr><td>' + s.id + '</td><td>' + (s.customer_name || 'General') + '</td><td>' + app.formatMoney(s.total) + '</td><td>' + app.formatDateTime(s.created_at) + '</td></tr>').join('') +
      '</tbody></table></div>';
  } catch (e) {
    content.innerHTML = '<div class="alert alert-warning">Error: ' + e.message + '</div>';
  }
}

console.log('Reports loaded');