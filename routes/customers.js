const express = require('express');
const { get, run, all, saveDatabase } = require('../database');
const { authenticate } = require('../auth');

const router = express.Router();

router.get('/', authenticate, (req, res) => {
  const { search } = req.query;
  
  let query = 'SELECT * FROM customers WHERE 1=1';
  const params = [];
  
  if (search) {
    query += ' AND (name LIKE ? OR phone LIKE ? OR email LIKE ?)';
    params.push('%' + search + '%', '%' + search + '%', '%' + search + '%');
  }
  
  query += ' ORDER BY created_at DESC';
  
  const customers = all(query, params);
  res.json(customers);
});

router.get('/:id', authenticate, (req, res) => {
  const customer = get('SELECT * FROM customers WHERE id = ?', [req.params.id]);
  if (!customer) return res.status(404).json({ error: 'Customer not found' });
  
  const sales = all(`
    SELECT s.*, u.name as user_name 
    FROM sales s 
    LEFT JOIN users u ON s.user_id = u.id
    WHERE s.customer_id = ?
    ORDER BY s.created_at DESC
    LIMIT 10
  `, [req.params.id]);
  
  const repairs = all(`
    SELECT * FROM repairs 
    WHERE customer_id = ?
    ORDER BY created_at DESC
    LIMIT 10
  `, [req.params.id]);
  
  res.json({ ...customer, sales, repairs });
});

router.post('/', authenticate, (req, res) => {
  const { name, phone, email, address, notes } = req.body;
  
  if (!name) return res.status(400).json({ error: 'Name is required' });
  
  const phoneVal = phone === undefined ? null : phone;
  const emailVal = email === undefined ? null : email;
  const addressVal = address === undefined ? null : address;
  const notesVal = notes === undefined ? null : notes;
  
  const result = run(`
    INSERT INTO customers (name, phone, email, address, notes)
    VALUES (?, ?, ?, ?, ?)
  `, [name, phoneVal, emailVal, addressVal, notesVal]);
  
  const customer = get('SELECT * FROM customers WHERE id = ?', [result.lastInsertRowid]);
  saveDatabase();
  res.status(201).json(customer);
});

router.put('/:id', authenticate, (req, res) => {
  const { name, phone, email, address, notes } = req.body;
  
  run(`
    UPDATE customers SET name = ?, phone = ?, email = ?, address = ?, notes = ?
    WHERE id = ?
  `, [name || null, phone || null, email || null, address || null, notes || null, req.params.id]);
  
  const customer = get('SELECT * FROM customers WHERE id = ?', [req.params.id]);
  saveDatabase();
  res.json(customer);
});

router.delete('/:id', authenticate, (req, res) => {
  run('DELETE FROM customers WHERE id = ?', [req.params.id]);
  saveDatabase();
  res.json({ success: true });
});

module.exports = router;
