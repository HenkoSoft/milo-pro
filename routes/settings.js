const express = require('express');
const { get, run, saveDatabase } = require('../database');
const { authenticate } = require('../auth');

const router = express.Router();

router.get('/', authenticate, (req, res) => {
  const settings = get('SELECT * FROM settings WHERE id = 1');
  res.json(settings || { business_name: 'Milo Pro' });
});

router.put('/', authenticate, (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Solo el administrador puede modificar configuraciones' });
  }
  
  const { business_name, business_address, business_phone, business_email } = req.body;
  
  run(`
    UPDATE settings 
    SET business_name = ?, business_address = ?, business_phone = ?, business_email = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = 1
  `, [business_name || 'Milo Pro', business_address || null, business_phone || null, business_email || null]);
  
  saveDatabase();
  const settings = get('SELECT * FROM settings WHERE id = 1');
  res.json(settings);
});

module.exports = router;
