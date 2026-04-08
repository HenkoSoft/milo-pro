const express = require('express');
const { authenticate } = require('../auth');
const { getDatabaseAccessForRequest } = require('../services/runtime-db');

const router = express.Router();

function toNull(value) {
  return value === undefined || value === null || value === '' ? null : String(value).trim();
}

function toNumberOrNull(value) {
  if (value === undefined || value === null || value === '') return null;
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

function normalizeCustomerPayload(body) {
  const data = body && typeof body === 'object' ? body : {};
  return {
    name: String(data.name || '').trim(),
    phone: String(data.phone || ''),
    email: String(data.email || ''),
    address: String(data.address || ''),
    contact: String(data.contact || ''),
    city: String(data.city || ''),
    province: String(data.province || ''),
    country: String(data.country || ''),
    tax_id: String(data.tax_id || ''),
    iva_condition: String(data.iva_condition || 'Consumidor Final').trim() || 'Consumidor Final',
    instagram: String(data.instagram || ''),
    transport: String(data.transport || ''),
    credit_limit: String(data.credit_limit || ''),
    zone: String(data.zone || ''),
    discount_percent: String(data.discount_percent || ''),
    seller: String(data.seller || ''),
    price_list: String(data.price_list || '1').trim() || '1',
    billing_conditions: String(data.billing_conditions || ''),
    notes: String(data.notes || '')
  };
}

function buildCustomerParams(payload, { allowEmptyName = false } = {}) {
  return [
    allowEmptyName ? toNull(payload.name) : payload.name,
    toNull(payload.phone),
    toNull(payload.email),
    toNull(payload.address),
    toNull(payload.contact),
    toNull(payload.city),
    toNull(payload.province),
    toNull(payload.country),
    toNull(payload.tax_id),
    toNull(payload.iva_condition) || 'Consumidor Final',
    toNull(payload.instagram),
    toNull(payload.transport),
    toNumberOrNull(payload.credit_limit),
    toNull(payload.zone),
    toNumberOrNull(payload.discount_percent),
    toNull(payload.seller),
    toNull(payload.price_list) || '1',
    toNull(payload.billing_conditions),
    toNull(payload.notes)
  ];
}

router.get('/', authenticate, async (req, res) => {
  const db = getDatabaseAccessForRequest(req);
  const search = String(req.query.search || '').trim();

  let query = 'SELECT * FROM customers WHERE 1=1';
  const params = [];

  if (search) {
    query += ' AND (name LIKE ? OR phone LIKE ? OR email LIKE ?)';
    params.push(`%${search}%`, `%${search}%`, `%${search}%`);
  }

  query += ' ORDER BY created_at DESC';

  const customers = await db.all(query, params);
  res.json(customers);
});

router.get('/:id', authenticate, async (req, res) => {
  const db = getDatabaseAccessForRequest(req);
  const customer = await db.get('SELECT * FROM customers WHERE id = ?', [req.params.id]);
  if (!customer) return res.status(404).json({ error: 'Customer not found' });

  const sales = await db.all(`
    SELECT s.*, u.name as user_name
    FROM sales s
    LEFT JOIN users u ON s.user_id = u.id
    WHERE s.customer_id = ?
    ORDER BY s.created_at DESC
    LIMIT 10
  `, [req.params.id]);

  const repairs = await db.all(`
    SELECT * FROM repairs
    WHERE customer_id = ?
    ORDER BY created_at DESC
    LIMIT 10
  `, [req.params.id]);

  res.json({ ...customer, sales, repairs });
});

router.post('/', authenticate, async (req, res) => {
  const db = getDatabaseAccessForRequest(req);
  const payload = normalizeCustomerPayload(req.body);

  if (!payload.name) return res.status(400).json({ error: 'Name is required' });

  const result = await db.run(`
    INSERT INTO customers (
      name, phone, email, address, contact, city, province, country, tax_id,
      iva_condition, instagram, transport, credit_limit, zone, discount_percent,
      seller, price_list, billing_conditions, notes
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, buildCustomerParams(payload));

  const customer = await db.get('SELECT * FROM customers WHERE id = ?', [result.lastInsertRowid]);
  await db.save();
  res.status(201).json(customer);
});

router.put('/:id', authenticate, async (req, res) => {
  const db = getDatabaseAccessForRequest(req);
  const payload = normalizeCustomerPayload(req.body);

  await db.run(`
    UPDATE customers SET
      name = ?, phone = ?, email = ?, address = ?, contact = ?, city = ?, province = ?, country = ?,
      tax_id = ?, iva_condition = ?, instagram = ?, transport = ?, credit_limit = ?, zone = ?,
      discount_percent = ?, seller = ?, price_list = ?, billing_conditions = ?, notes = ?
    WHERE id = ?
  `, [
    ...buildCustomerParams(payload, { allowEmptyName: true }),
    req.params.id
  ]);

  const customer = await db.get('SELECT * FROM customers WHERE id = ?', [req.params.id]);
  await db.save();
  res.json(customer);
});

router.delete('/:id', authenticate, async (req, res) => {
  const db = getDatabaseAccessForRequest(req);
  await db.run('DELETE FROM customers WHERE id = ?', [req.params.id]);
  await db.save();
  res.json({ success: true });
});

module.exports = router;
