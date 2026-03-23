const express = require('express');
const { get, run, all, saveDatabase } = require('../database');
const { authenticate } = require('../auth');

const router = express.Router();

router.get('/', authenticate, (req, res) => {
  const categories = all('SELECT * FROM categories ORDER BY name');
  res.json(categories);
});

router.get('/:id', authenticate, (req, res) => {
  const category = get('SELECT * FROM categories WHERE id = ?', [req.params.id]);
  if (!category) return res.status(404).json({ error: 'Category not found' });
  res.json(category);
});

router.post('/', authenticate, (req, res) => {
  const { name, description } = req.body;
  const result = run('INSERT INTO categories (name, description) VALUES (?, ?)', [name, description]);
  const category = get('SELECT * FROM categories WHERE id = ?', [result.lastInsertRowid]);
  saveDatabase();
  res.status(201).json(category);
});

router.put('/:id', authenticate, (req, res) => {
  const { name, description } = req.body;
  run('UPDATE categories SET name = ?, description = ? WHERE id = ?', [name, description, req.params.id]);
  const category = get('SELECT * FROM categories WHERE id = ?', [req.params.id]);
  saveDatabase();
  res.json(category);
});

router.delete('/:id', authenticate, (req, res) => {
  const productCount = get('SELECT COUNT(*) as count FROM products WHERE category_id = ?', [req.params.id]);
  if (productCount.count > 0) {
    return res.status(400).json({ error: 'Cannot delete category with products' });
  }
  run('DELETE FROM categories WHERE id = ?', [req.params.id]);
  saveDatabase();
  res.json({ success: true });
});

module.exports = router;
