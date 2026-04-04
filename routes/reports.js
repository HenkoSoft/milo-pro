const express = require('express');
const { get, all } = require('../database');
const { authenticate } = require('../auth');

const router = express.Router();

function toNumber(value, fallback = 0) {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
}

function sanitizeRevenuePoint(record) {
  const data = record && typeof record === 'object' ? record : {};
  return {
    date: String(data.date || ''),
    revenue: toNumber(data.revenue),
    count: toNumber(data.count)
  };
}

router.get('/sales', authenticate, (req, res) => {
  const startDate = String(req.query.startDate || '').trim();
  const endDate = String(req.query.endDate || '').trim();

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

  const salesWithItems = sales.map((sale) => {
    const items = all(`
      SELECT si.*, p.name as product_name, p.sku
      FROM sale_items si
      JOIN products p ON si.product_id = p.id
      WHERE si.sale_id = ?
    `, [sale.id]);
    return { ...sale, items };
  });

  res.json({
    sales: salesWithItems,
    summary: {
      totalRevenue: toNumber(summary.totalRevenue),
      totalTransactions: toNumber(summary.totalTransactions),
      averageSale: toNumber(summary.averageSale)
    }
  });
});

router.get('/repairs', authenticate, (req, res) => {
  const byStatus = all(`
    SELECT status, COUNT(*) as count,
           COALESCE(SUM(final_price), 0) as totalRevenue
    FROM repairs
    GROUP BY status
  `).map((item) => ({
    ...item,
    count: toNumber(item.count),
    totalRevenue: toNumber(item.totalRevenue)
  }));

  const byDeviceType = all(`
    SELECT device_type, COUNT(*) as count,
           COALESCE(SUM(final_price), 0) as totalRevenue
    FROM repairs
    GROUP BY device_type
  `).map((item) => ({
    ...item,
    count: toNumber(item.count),
    totalRevenue: toNumber(item.totalRevenue)
  }));

  const summary = get(`
    SELECT
      COUNT(*) as totalRepairs,
      COALESCE(SUM(final_price), 0) as totalRevenue,
      COALESCE(AVG(final_price), 0) as averagePrice
    FROM repairs
  `);

  res.json({
    byStatus,
    byDeviceType,
    summary: {
      totalRepairs: toNumber(summary.totalRepairs),
      totalRevenue: toNumber(summary.totalRevenue),
      averagePrice: toNumber(summary.averagePrice)
    }
  });
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
  `).map((item) => ({
    ...item,
    id: toNumber(item.id),
    stock: toNumber(item.stock),
    sale_price: toNumber(item.sale_price),
    totalSold: toNumber(item.totalSold),
    totalRevenue: toNumber(item.totalRevenue)
  }));

  const lowStock = all(`
    SELECT p.*, c.name as category_name
    FROM products p
    LEFT JOIN categories c ON p.category_id = c.id
    WHERE p.stock <= p.min_stock
    ORDER BY p.stock ASC
  `).map((item) => ({
    ...item,
    id: toNumber(item.id),
    stock: toNumber(item.stock),
    min_stock: toNumber(item.min_stock),
    sale_price: toNumber(item.sale_price)
  }));

  const byCategory = all(`
    SELECT c.name as category,
           COUNT(p.id) as productCount,
           COALESCE(SUM(p.stock), 0) as totalStock,
           COALESCE(SUM(p.stock * p.sale_price), 0) as totalValue
    FROM categories c
    LEFT JOIN products p ON c.id = p.category_id
    GROUP BY c.id
    ORDER BY totalValue DESC
  `).map((item) => ({
    ...item,
    productCount: toNumber(item.productCount),
    totalStock: toNumber(item.totalStock),
    totalValue: toNumber(item.totalValue)
  }));

  res.json({ topSelling, lowStock, byCategory });
});

router.get('/revenue', authenticate, (req, res) => {
  const period = String(req.query.period || '').trim();

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
  `).map(sanitizeRevenuePoint);

  const safeSalesRevenue = toNumber(salesRevenue.revenue);
  const safeRepairsRevenue = toNumber(repairsRevenue.revenue);

  res.json({
    salesRevenue: safeSalesRevenue,
    salesCount: toNumber(salesRevenue.count),
    repairsRevenue: safeRepairsRevenue,
    repairsCount: toNumber(repairsRevenue.count),
    totalRevenue: safeSalesRevenue + safeRepairsRevenue,
    dailySales
  });
});

module.exports = router;
