const express = require('express');
const { authenticate } = require('../auth');
const { getDatabaseAccessForRequest } = require('../services/runtime-db');

const router = express.Router();

function toNullableString(value) {
  if (value === undefined || value === null || value === '') return null;
  return String(value).trim();
}

function toNumber(value, fallback = 0) {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
}

function buildDashboardStats(record) {
  const data = record && typeof record === 'object' ? record : {};
  return {
    todaySales: toNumber(data.todaySales),
    todayTransactions: toNumber(data.todayTransactions),
    totalProducts: toNumber(data.totalProducts),
    totalCustomers: toNumber(data.totalCustomers),
    lowStockProducts: toNumber(data.lowStockProducts),
    activeRepairs: toNumber(data.activeRepairs),
    readyForPickup: toNumber(data.readyForPickup)
  };
}

function sanitizeLowStockProduct(record) {
  const data = record && typeof record === 'object' ? record : {};
  return {
    ...data,
    id: toNumber(data.id),
    name: String(data.name || ''),
    sku: toNullableString(data.sku),
    stock: toNumber(data.stock),
    min_stock: toNumber(data.min_stock),
    category_name: toNullableString(data.category_name)
  };
}

function sanitizeReadyRepair(record) {
  const data = record && typeof record === 'object' ? record : {};
  return {
    ...data,
    id: toNumber(data.id),
    customer_name: toNullableString(data.customer_name),
    customer_phone: toNullableString(data.customer_phone),
    brand: toNullableString(data.brand),
    model: toNullableString(data.model)
  };
}

function sanitizeActivity(record, type) {
  const data = record && typeof record === 'object' ? record : {};
  return {
    ...data,
    id: toNumber(data.id),
    type,
    created_at: String(data.created_at || ''),
    customer_name: toNullableString(data.customer_name),
    total: data.total === undefined || data.total === null ? undefined : toNumber(data.total),
    user_name: toNullableString(data.user_name),
    brand: toNullableString(data.brand),
    model: toNullableString(data.model),
    channel: toNullableString(data.channel)
  };
}

router.get('/stats', authenticate, async (req, res) => {
  const db = getDatabaseAccessForRequest(req);
  const today = new Date().toISOString().split('T')[0];

  const todaySales = await db.get(`
    SELECT COALESCE(SUM(total), 0) as total, COUNT(*) as count
    FROM sales WHERE date(created_at) = ?
  `, [today]);

  const totalProducts = await db.get('SELECT COUNT(*) as count FROM products');
  const totalCustomers = await db.get('SELECT COUNT(*) as count FROM customers');
  const lowStockProducts = await db.get('SELECT COUNT(*) as count FROM products WHERE stock <= min_stock');
  const activeRepairs = await db.get("SELECT COUNT(*) as count FROM repairs WHERE status NOT IN ('delivered')");
  const readyForPickup = await db.get("SELECT COUNT(*) as count FROM repairs WHERE status = 'ready'");

  const stats = buildDashboardStats({
    todaySales: todaySales ? todaySales.total : 0,
    todayTransactions: todaySales ? todaySales.count : 0,
    totalProducts: totalProducts ? totalProducts.count : 0,
    totalCustomers: totalCustomers ? totalCustomers.count : 0,
    lowStockProducts: lowStockProducts ? lowStockProducts.count : 0,
    activeRepairs: activeRepairs ? activeRepairs.count : 0,
    readyForPickup: readyForPickup ? readyForPickup.count : 0
  });

  res.json(stats);
});

router.get('/alerts', authenticate, async (req, res) => {
  const db = getDatabaseAccessForRequest(req);
  const lowStock = (await db.all(`
    SELECT p.*, c.name as category_name
    FROM products p
    LEFT JOIN categories c ON p.category_id = c.id
    WHERE p.stock <= p.min_stock
    ORDER BY p.stock ASC
    LIMIT 10
  `)).map(sanitizeLowStockProduct);

  const readyForPickup = (await db.all(`
    SELECT r.*, c.name as customer_name, c.phone as customer_phone
    FROM repairs r
    LEFT JOIN customers c ON r.customer_id = c.id
    WHERE r.status = 'ready'
    ORDER BY r.created_at DESC
    LIMIT 10
  `)).map(sanitizeReadyRepair);

  res.json({ lowStock, readyForPickup });
});

router.get('/recent-activity', authenticate, async (req, res) => {
  const db = getDatabaseAccessForRequest(req);
  const recentSales = (await db.all(`
    SELECT s.*, c.name as customer_name, u.name as user_name
    FROM sales s
    LEFT JOIN customers c ON s.customer_id = c.id
    LEFT JOIN users u ON s.user_id = u.id
    ORDER BY s.created_at DESC
    LIMIT 5
  `)).map((sale) => sanitizeActivity(sale, 'sale'));

  const recentRepairs = (await db.all(`
    SELECT r.*, c.name as customer_name
    FROM repairs r
    LEFT JOIN customers c ON r.customer_id = c.id
    ORDER BY r.created_at DESC
    LIMIT 5
  `)).map((repair) => sanitizeActivity(repair, 'repair'));

  const activities = [...recentSales, ...recentRepairs]
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
    .slice(0, 10);

  res.json(activities);
});

module.exports = router;
