const express = require('express');
const { get, all } = require('../database');
const { authenticate } = require('../auth');

const router = express.Router();

router.get('/stats', authenticate, (req, res) => {
  const today = new Date().toISOString().split('T')[0];
  
  const todaySales = get(`
    SELECT COALESCE(SUM(total), 0) as total, COUNT(*) as count
    FROM sales WHERE date(created_at) = ?
  `, [today]);
  
  const totalProducts = get('SELECT COUNT(*) as count FROM products').count;
  const totalCustomers = get('SELECT COUNT(*) as count FROM customers').count;
  
  const lowStockProducts = get(`
    SELECT COUNT(*) as count FROM products WHERE stock <= min_stock
  `).count;
  
  const activeRepairs = get(`
    SELECT COUNT(*) as count FROM repairs WHERE status NOT IN ('delivered')
  `).count;
  
  const readyForPickup = get(`
    SELECT COUNT(*) as count FROM repairs WHERE status = 'ready'
  `).count;
  
  res.json({
    todaySales: todaySales.total,
    todayTransactions: todaySales.count,
    totalProducts,
    totalCustomers,
    lowStockProducts,
    activeRepairs,
    readyForPickup
  });
});

router.get('/alerts', authenticate, (req, res) => {
  const lowStock = all(`
    SELECT p.*, c.name as category_name
    FROM products p
    LEFT JOIN categories c ON p.category_id = c.id
    WHERE p.stock <= p.min_stock
    ORDER BY p.stock ASC
    LIMIT 10
  `);
  
  const readyForPickup = all(`
    SELECT r.*, c.name as customer_name, c.phone as customer_phone
    FROM repairs r
    LEFT JOIN customers c ON r.customer_id = c.id
    WHERE r.status = 'ready'
    ORDER BY r.created_at DESC
    LIMIT 10
  `);
  
  res.json({ lowStock, readyForPickup });
});

router.get('/recent-activity', authenticate, (req, res) => {
  const recentSales = all(`
    SELECT s.*, c.name as customer_name, u.name as user_name
    FROM sales s
    LEFT JOIN customers c ON s.customer_id = c.id
    LEFT JOIN users u ON s.user_id = u.id
    ORDER BY s.created_at DESC
    LIMIT 5
  `).map(s => ({ ...s, type: 'sale' }));
  
  const recentRepairs = all(`
    SELECT r.*, c.name as customer_name
    FROM repairs r
    LEFT JOIN customers c ON r.customer_id = c.id
    ORDER BY r.created_at DESC
    LIMIT 5
  `).map(r => ({ ...r, type: 'repair' }));
  
  const activities = [...recentSales, ...recentRepairs]
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
    .slice(0, 10);
  
  res.json(activities);
});

module.exports = router;
