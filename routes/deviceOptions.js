const express = require('express');
const { get, run, all, saveDatabase } = require('../database');
const { authenticate } = require('../auth');

const router = express.Router();

router.get('/device-types', authenticate, (req, res) => {
  const types = all('SELECT * FROM device_types WHERE active = 1 ORDER BY name');
  res.json(types);
});

router.post('/device-types', authenticate, (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin only' });
  const { name } = req.body;
  if (!name) return res.status(400).json({ error: 'Name required' });
  try {
    const result = run('INSERT INTO device_types (name) VALUES (?)', [name]);
    saveDatabase();
    res.json({ id: result.lastInsertRowid, name });
  } catch (err) {
    res.status(400).json({ error: 'Already exists' });
  }
});

router.delete('/device-types/:id', authenticate, (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin only' });
  run('UPDATE device_types SET active = 0 WHERE id = ?', [req.params.id]);
  saveDatabase();
  res.json({ success: true });
});

router.get('/brands', authenticate, (req, res) => {
  const brands = all('SELECT * FROM brands WHERE active = 1 ORDER BY name');
  res.json(brands);
});

router.post('/brands', authenticate, (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin only' });
  const { name, slug, active, woocommerce_brand_id } = req.body || {};
  if (!name) return res.status(400).json({ error: 'Name required' });
  try {
    const result = run(
      'INSERT INTO brands (name, slug, active, woocommerce_brand_id) VALUES (?, ?, ?, ?)',
      [
        name,
        slug || String(name).trim().toLowerCase().replace(/[^a-z0-9]+/g, '-'),
        active === false || active === 0 ? 0 : 1,
        woocommerce_brand_id || null
      ]
    );
    saveDatabase();
    res.json(get('SELECT * FROM brands WHERE id = ?', [result.lastInsertRowid]));
  } catch (err) {
    res.status(400).json({ error: 'Already exists' });
  }
});

router.put('/brands/:id', authenticate, (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin only' });
  const { name, active, woocommerce_brand_id } = req.body || {};
  if (!name) return res.status(400).json({ error: 'Name required' });
  try {
    run(
      `UPDATE brands
       SET name = ?, slug = ?, active = ?, woocommerce_brand_id = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [
        name,
        String(name).trim().toLowerCase().replace(/[^a-z0-9]+/g, '-'),
        active === false || active === 0 ? 0 : 1,
        woocommerce_brand_id || null,
        req.params.id
      ]
    );
    saveDatabase();
    res.json(get('SELECT * FROM brands WHERE id = ?', [req.params.id]));
  } catch (err) {
    res.status(400).json({ error: 'Already exists' });
  }
});

router.delete('/brands/:id', authenticate, (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin only' });
  run('UPDATE brands SET active = 0 WHERE id = ?', [req.params.id]);
  saveDatabase();
  res.json({ success: true });
});

router.get('/models', authenticate, (req, res) => {
  const { brand_id } = req.query;
  let query = 'SELECT * FROM device_models WHERE active = 1';
  const params = [];
  if (brand_id) {
    query += ' AND brand_id = ?';
    params.push(brand_id);
  }
  query += ' ORDER BY name';
  const models = all(query, params);
  res.json(models);
});

router.post('/models', authenticate, (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin only' });
  const { name, brand_id } = req.body;
  if (!name) return res.status(400).json({ error: 'Name required' });
  try {
    const result = run('INSERT INTO device_models (name, brand_id) VALUES (?, ?)', [name, brand_id || null]);
    saveDatabase();
    res.json({ id: result.lastInsertRowid, name, brand_id });
  } catch (err) {
    res.status(400).json({ error: 'Already exists' });
  }
});

router.delete('/models/:id', authenticate, (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin only' });
  run('UPDATE device_models SET active = 0 WHERE id = ?', [req.params.id]);
  saveDatabase();
  res.json({ success: true });
});

module.exports = router;
