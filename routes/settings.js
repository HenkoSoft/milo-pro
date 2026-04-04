const express = require('express');
const { get, run, saveDatabase } = require('../database');
const { authenticate } = require('../auth');

const router = express.Router();

function normalizeSettingsPayload(body) {
  const data = body && typeof body === 'object' ? body : {};
  return {
    business_name: String(data.business_name || 'Milo Pro').trim() || 'Milo Pro',
    business_address: data.business_address ? String(data.business_address).trim() : null,
    business_phone: data.business_phone ? String(data.business_phone).trim() : null,
    business_email: data.business_email ? String(data.business_email).trim() : null
  };
}

function withDefaultSettings(settings) {
  if (!settings) {
    return { business_name: 'Milo Pro' };
  }

  return {
    ...settings,
    business_name: settings.business_name || 'Milo Pro'
  };
}

router.get('/', authenticate, (req, res) => {
  const settings = get('SELECT * FROM settings WHERE id = 1');
  res.json(withDefaultSettings(settings));
});

router.put('/', authenticate, (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Solo el administrador puede modificar configuraciones' });
  }

  const payload = normalizeSettingsPayload(req.body);

  run(`
    UPDATE settings
    SET business_name = ?, business_address = ?, business_phone = ?, business_email = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = 1
  `, [payload.business_name, payload.business_address, payload.business_phone, payload.business_email]);

  saveDatabase();
  const settings = get('SELECT * FROM settings WHERE id = 1');
  res.json(withDefaultSettings(settings));
});

module.exports = router;
