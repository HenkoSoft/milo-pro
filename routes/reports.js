const express = require('express');
const { get, all } = require('../database');
const { authenticate } = require('../auth');

const router = express.Router();

router.get('/sales', authenticate, (req, res) => {
  const { startDate, endDate } = req.query;
  
  let query = `
    SELECT s.*, c.name as customer_name, u.name as user_name
    FROM sales s
    LEFT JOIN customers c ON s.customer_id = c.id
    LEFT JOIN users u ON s.user_id = u.id
    WHERE 1=1
  `;
  const params = [];
  
  if (startDate) {
    query += ' AND s.created_at >= ?';
    params.push(startDate);
  }
  
  if (endDate) {
    query += ' AND s.created_at <= ?';
    params.push(endDate);
  }
  
  query += ' ORDER BY s.created_at DESC';
  
  const sales = all(query, params);
  
  const summary = get(`
    SELECT 
      COALESCE(SUM(total), 0) as totalRevenue,
      COUNT(*) as totalTransactions,
      COALESCE(AVG(total), 0) as averageSale
    FROM sales s
    WHERE 1=1
    ${startDate ? 'AND s.created_at >= ?' : ''}
    ${endDate ? 'AND s.created_at <= ?' : ''}
  `, params);
  
  const salesWithItems = sales.map(sale => {
    const items = all(`
      SELECT si.*, p.name as product_name, p.sku
      FROM sale_items si
      JOIN products p ON si.product_id = p.id
      WHERE si.sale_id = ?
    `, [sale.id]);
    return { ...sale, items };
  });
  
  res.json({ sales: salesWithItems, summary });
});

router.get('/repairs', authenticate, (req, res) => {
  const byStatus = all(`
    SELECT status, COUNT(*) as count, 
           COALESCE(SUM(final_price), 0) as totalRevenue
    FROM repairs
    GROUP BY status
  `);
  
  const byDeviceType = all(`
    SELECT device_type, COUNT(*) as count,
           COALESCE(SUM(final_price), 0) as totalRevenue
    FROM repairs
    GROUP BY device_type
  `);
  
  const summary = get(`
    SELECT 
      COUNT(*) as totalRepairs,
      COALESCE(SUM(final_price), 0) as totalRevenue,
      COALESCE(AVG(final_price), 0) as averagePrice
    FROM repairs
  `);
  
  res.json({ byStatus, byDeviceType, summary });
});

router.get('/products', authenticate, (req, res) => {
  const topSelling = all(`
    SELECT p.id, p.name, p.sku, p.stock, p.sale_price,
           COALESCE(SUM(si.quantity), 0) as totalSold,
           COALESCE(SUM(si.subtotal), 0) as totalRevenue
    FROM products p
    LEFT JOIN sale_items si ON p.id = si.product_id
    LEFT JOIN sales s ON si.sale_id = s.id
    GROUP BY p.id
    ORDER BY totalSold DESC
    LIMIT 20
  `);
  
  const lowStock = all(`
    SELECT p.*, c.name as category_name
    FROM products p
    LEFT JOIN categories c ON p.category_id = c.id
    WHERE p.stock <= p.min_stock
    ORDER BY p.stock ASC
  `);
  
  const byCategory = all(`
    SELECT c.name as category,
           COUNT(p.id) as productCount,
           COALESCE(SUM(p.stock), 0) as totalStock,
           COALESCE(SUM(p.stock * p.sale_price), 0) as totalValue
    FROM categories c
    LEFT JOIN products p ON c.id = p.category_id
    GROUP BY c.id
    ORDER BY totalValue DESC
  `);
  
  res.json({ topSelling, lowStock, byCategory });
});

router.get('/revenue', authenticate, (req, res) => {
  const { period } = req.query;
  
  let dateFilter = '';
  if (period === 'today') {
    dateFilter = " WHERE date(created_at) = date('now')";
  } else if (period === 'week') {
    dateFilter = " WHERE created_at >= date('now', '-7 days')";
  } else if (period === 'month') {
    dateFilter = " WHERE strftime('%Y-%m', created_at) = strftime('%Y-%m', 'now')";
  } else if (period === 'year') {
    dateFilter = " WHERE strftime('%Y', created_at) = strftime('%Y', 'now')";
  }
  
  const salesRevenue = get(`
    SELECT COALESCE(SUM(total), 0) as revenue, COUNT(*) as count
    FROM sales ${dateFilter || ''}
  `);
  
  const repairsRevenue = get(`
    SELECT COALESCE(SUM(final_price), 0) as revenue, COUNT(*) as count
    FROM repairs WHERE status = 'delivered'
  `);
  
  const dailySales = all(`
    SELECT date(created_at) as date, SUM(total) as revenue, COUNT(*) as count
    FROM sales
    WHERE created_at >= date('now', '-30 days')
    GROUP BY date(created_at)
    ORDER BY date
  `);
  
  res.json({
    salesRevenue: salesRevenue.revenue,
    salesCount: salesRevenue.count,
    repairsRevenue: repairsRevenue.revenue,
    repairsCount: repairsRevenue.count,
    totalRevenue: salesRevenue.revenue + repairsRevenue.revenue,
    dailySales
  });
});

module.exports = router;
