const express = require('express');
const { authenticate } = require('../auth');
const { getDatabaseAccessForRequest } = require('../services/runtime-db');

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

router.get('/', authenticate, async (req, res) => {
  const db = getDatabaseAccessForRequest(req);
  const settings = await db.get('SELECT * FROM settings WHERE id = 1');
  res.json(withDefaultSettings(settings));
});

router.put('/', authenticate, async (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Solo el administrador puede modificar configuraciones' });
  }

  const db = getDatabaseAccessForRequest(req);
  const payload = normalizeSettingsPayload(req.body);

  await db.run(`
    UPDATE settings
    SET business_name = ?, business_address = ?, business_phone = ?, business_email = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = 1
  `, [payload.business_name, payload.business_address, payload.business_phone, payload.business_email]);

  await db.save();
  const settings = await db.get('SELECT * FROM settings WHERE id = 1');
  res.json(withDefaultSettings(settings));
});

module.exports = router;
