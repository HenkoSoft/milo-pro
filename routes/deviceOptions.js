const express = require('express');
const { get, run, all, saveDatabase } = require('../database');
const { authenticate } = require('../auth');

const router = express.Router();

function getDatabaseAccess(req) {
  const runtimeDb = req && req.app && req.app.locals ? req.app.locals.database : null;
  return {
    get: runtimeDb && typeof runtimeDb.get === 'function'
      ? (sql, params = []) => runtimeDb.get(sql, params)
      : async (sql, params = []) => get(sql, params),
    all: runtimeDb && typeof runtimeDb.all === 'function'
      ? (sql, params = []) => runtimeDb.all(sql, params)
      : async (sql, params = []) => all(sql, params),
    run: runtimeDb && typeof runtimeDb.run === 'function'
      ? (sql, params = []) => runtimeDb.run(sql, params)
      : async (sql, params = []) => run(sql, params),
    save: runtimeDb && typeof runtimeDb.save === 'function'
      ? () => runtimeDb.save()
      : async () => saveDatabase()
  };
}

function toNullableString(value) {
  if (value === undefined || value === null || value === '') return null;
  return String(value).trim();
}

function toNumberOrNull(value) {
  if (value === undefined || value === null || value === '') return null;
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

function slugify(value) {
  return String(value || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '-');
}

function buildDeviceTypePayload(body) {
  const data = body && typeof body === 'object' ? body : {};
  return { name: String(data.name || '').trim() };
}

function buildBrandPayload(body) {
  const data = body && typeof body === 'object' ? body : {};
  const name = String(data.name || '').trim();
  return {
    name,
    slug: String(data.slug || slugify(name)).trim() || slugify(name),
    active: data.active === false || data.active === 0 ? 0 : 1,
    woocommerce_brand_id: toNumberOrNull(data.woocommerce_brand_id)
  };
}

function buildDeviceModelPayload(body) {
  const data = body && typeof body === 'object' ? body : {};
  return {
    name: String(data.name || '').trim(),
    brand_id: toNumberOrNull(data.brand_id)
  };
}

router.get('/device-types', authenticate, async (req, res) => {
  const db = getDatabaseAccess(req);
  const types = await db.all('SELECT * FROM device_types WHERE active = 1 ORDER BY name');
  res.json(types);
});

router.post('/device-types', authenticate, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin only' });
  const db = getDatabaseAccess(req);
  const payload = buildDeviceTypePayload(req.body);
  if (!payload.name) return res.status(400).json({ error: 'Name required' });
  try {
    const result = await db.run('INSERT INTO device_types (name) VALUES (?)', [payload.name]);
    await db.save();
    res.json({ id: result.lastInsertRowid, name: payload.name });
  } catch (_err) {
    res.status(400).json({ error: 'Already exists' });
  }
});

router.delete('/device-types/:id', authenticate, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin only' });
  const db = getDatabaseAccess(req);
  await db.run('UPDATE device_types SET active = 0 WHERE id = ?', [req.params.id]);
  await db.save();
  res.json({ success: true });
});

router.get('/brands', authenticate, async (req, res) => {
  const db = getDatabaseAccess(req);
  const brands = await db.all('SELECT * FROM brands WHERE active = 1 ORDER BY name');
  res.json(brands);
});

router.post('/brands', authenticate, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin only' });
  const db = getDatabaseAccess(req);
  const payload = buildBrandPayload(req.body);
  if (!payload.name) return res.status(400).json({ error: 'Name required' });
  try {
    const result = await db.run(
      'INSERT INTO brands (name, slug, active, woocommerce_brand_id) VALUES (?, ?, ?, ?)',
      [payload.name, payload.slug, payload.active, payload.woocommerce_brand_id]
    );
    await db.save();
    res.json(await db.get('SELECT * FROM brands WHERE id = ?', [result.lastInsertRowid]));
  } catch (_err) {
    res.status(400).json({ error: 'Already exists' });
  }
});

router.put('/brands/:id', authenticate, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin only' });
  const db = getDatabaseAccess(req);
  const payload = buildBrandPayload(req.body);
  if (!payload.name) return res.status(400).json({ error: 'Name required' });
  try {
    await db.run(
      `UPDATE brands
       SET name = ?, slug = ?, active = ?, woocommerce_brand_id = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [payload.name, payload.slug, payload.active, payload.woocommerce_brand_id, req.params.id]
    );
    await db.save();
    res.json(await db.get('SELECT * FROM brands WHERE id = ?', [req.params.id]));
  } catch (_err) {
    res.status(400).json({ error: 'Already exists' });
  }
});

router.delete('/brands/:id', authenticate, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin only' });
  const db = getDatabaseAccess(req);
  await db.run('UPDATE brands SET active = 0 WHERE id = ?', [req.params.id]);
  await db.save();
  res.json({ success: true });
});

router.get('/models', authenticate, async (req, res) => {
  const db = getDatabaseAccess(req);
  const brandId = toNullableString(req.query.brand_id);
  let query = 'SELECT * FROM device_models WHERE active = 1';
  const params = [];
  if (brandId) {
    query += ' AND brand_id = ?';
    params.push(brandId);
  }
  query += ' ORDER BY name';
  const models = await db.all(query, params);
  res.json(models);
});

router.post('/models', authenticate, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin only' });
  const db = getDatabaseAccess(req);
  const payload = buildDeviceModelPayload(req.body);
  if (!payload.name) return res.status(400).json({ error: 'Name required' });
  try {
    const result = await db.run('INSERT INTO device_models (name, brand_id) VALUES (?, ?)', [payload.name, payload.brand_id]);
    await db.save();
    res.json({ id: result.lastInsertRowid, name: payload.name, brand_id: payload.brand_id });
  } catch (_err) {
    res.status(400).json({ error: 'Already exists' });
  }
});

router.delete('/models/:id', authenticate, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin only' });
  const db = getDatabaseAccess(req);
  await db.run('UPDATE device_models SET active = 0 WHERE id = ?', [req.params.id]);
  await db.save();
  res.json({ success: true });
});

module.exports = router;
