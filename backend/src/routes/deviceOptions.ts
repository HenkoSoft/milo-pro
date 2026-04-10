import type { AuthenticatedRequestLike } from '../types/http';

const express = require('express');
const { authenticate } = require('../config/auth.js');
const { getDatabaseAccessForRequest } = require('../services/runtime-db.js');

type JsonResponse = {
  status: (code: number) => JsonResponse;
  json: (body: unknown) => void;
};

type RouteRequest<TBody = unknown> = AuthenticatedRequestLike<TBody> & {
  params: Record<string, string>;
  query: Record<string, string | string[] | undefined>;
};

type DatabaseAccess = {
  get: (sql: string, params?: unknown[]) => Promise<any>;
  all: (sql: string, params?: unknown[]) => Promise<any[]>;
  run: (sql: string, params?: unknown[]) => Promise<any>;
  save: () => Promise<void>;
};

const router = express.Router();

function getDatabaseAccess(req: RouteRequest): DatabaseAccess {
  return getDatabaseAccessForRequest(req);
}

function toNullableString(value: unknown) {
  if (value === undefined || value === null || value === '') return null;
  return String(value).trim();
}

function toNumberOrNull(value: unknown) {
  if (value === undefined || value === null || value === '') return null;
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

function slugify(value: unknown) {
  return String(value || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '-');
}

function buildDeviceTypePayload(body: unknown) {
  const data = body && typeof body === 'object' ? body as Record<string, unknown> : {};
  return { name: String(data.name || '').trim() };
}

function buildBrandPayload(body: unknown) {
  const data = body && typeof body === 'object' ? body as Record<string, unknown> : {};
  const name = String(data.name || '').trim();
  return {
    name,
    slug: String(data.slug || slugify(name)).trim() || slugify(name),
    active: data.active === false || data.active === 0 ? 0 : 1,
    woocommerce_brand_id: toNumberOrNull(data.woocommerce_brand_id)
  };
}

function buildDeviceModelPayload(body: unknown) {
  const data = body && typeof body === 'object' ? body as Record<string, unknown> : {};
  return {
    name: String(data.name || '').trim(),
    brand_id: toNumberOrNull(data.brand_id)
  };
}

function isAdmin(req: RouteRequest) {
  return req.user?.role === 'admin';
}

router.get('/device-types', authenticate, async (req: RouteRequest, res: JsonResponse) => {
  const db = getDatabaseAccess(req);
  const types = await db.all('SELECT * FROM device_types WHERE active = 1 ORDER BY name');
  res.json(types);
});

router.post('/device-types', authenticate, async (req: RouteRequest, res: JsonResponse) => {
  if (!isAdmin(req)) {
    res.status(403).json({ error: 'Admin only' });
    return;
  }
  const db = getDatabaseAccess(req);
  const payload = buildDeviceTypePayload(req.body);
  if (!payload.name) {
    res.status(400).json({ error: 'Name required' });
    return;
  }
  try {
    const result = await db.run('INSERT INTO device_types (name) VALUES (?)', [payload.name]);
    await db.save();
    res.json({ id: result.lastInsertRowid, name: payload.name });
  } catch (_err) {
    res.status(400).json({ error: 'Already exists' });
  }
});

router.delete('/device-types/:id', authenticate, async (req: RouteRequest, res: JsonResponse) => {
  if (!isAdmin(req)) {
    res.status(403).json({ error: 'Admin only' });
    return;
  }
  const db = getDatabaseAccess(req);
  await db.run('UPDATE device_types SET active = 0 WHERE id = ?', [req.params.id]);
  await db.save();
  res.json({ success: true });
});

router.get('/brands', authenticate, async (req: RouteRequest, res: JsonResponse) => {
  const db = getDatabaseAccess(req);
  const brands = await db.all('SELECT * FROM brands WHERE active = 1 ORDER BY name');
  res.json(brands);
});

router.post('/brands', authenticate, async (req: RouteRequest, res: JsonResponse) => {
  if (!isAdmin(req)) {
    res.status(403).json({ error: 'Admin only' });
    return;
  }
  const db = getDatabaseAccess(req);
  const payload = buildBrandPayload(req.body);
  if (!payload.name) {
    res.status(400).json({ error: 'Name required' });
    return;
  }
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

router.put('/brands/:id', authenticate, async (req: RouteRequest, res: JsonResponse) => {
  if (!isAdmin(req)) {
    res.status(403).json({ error: 'Admin only' });
    return;
  }
  const db = getDatabaseAccess(req);
  const payload = buildBrandPayload(req.body);
  if (!payload.name) {
    res.status(400).json({ error: 'Name required' });
    return;
  }
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

router.delete('/brands/:id', authenticate, async (req: RouteRequest, res: JsonResponse) => {
  if (!isAdmin(req)) {
    res.status(403).json({ error: 'Admin only' });
    return;
  }
  const db = getDatabaseAccess(req);
  await db.run('UPDATE brands SET active = 0 WHERE id = ?', [req.params.id]);
  await db.save();
  res.json({ success: true });
});

router.get('/models', authenticate, async (req: RouteRequest, res: JsonResponse) => {
  const db = getDatabaseAccess(req);
  const brandId = toNullableString(req.query.brand_id);
  let query = 'SELECT * FROM device_models WHERE active = 1';
  const params: string[] = [];
  if (brandId) {
    query += ' AND brand_id = ?';
    params.push(brandId);
  }
  query += ' ORDER BY name';
  const models = await db.all(query, params);
  res.json(models);
});

router.post('/models', authenticate, async (req: RouteRequest, res: JsonResponse) => {
  if (!isAdmin(req)) {
    res.status(403).json({ error: 'Admin only' });
    return;
  }
  const db = getDatabaseAccess(req);
  const payload = buildDeviceModelPayload(req.body);
  if (!payload.name) {
    res.status(400).json({ error: 'Name required' });
    return;
  }
  try {
    const result = await db.run('INSERT INTO device_models (name, brand_id) VALUES (?, ?)', [payload.name, payload.brand_id]);
    await db.save();
    res.json({ id: result.lastInsertRowid, name: payload.name, brand_id: payload.brand_id });
  } catch (_err) {
    res.status(400).json({ error: 'Already exists' });
  }
});

router.delete('/models/:id', authenticate, async (req: RouteRequest, res: JsonResponse) => {
  if (!isAdmin(req)) {
    res.status(403).json({ error: 'Admin only' });
    return;
  }
  const db = getDatabaseAccess(req);
  await db.run('UPDATE device_models SET active = 0 WHERE id = ?', [req.params.id]);
  await db.save();
  res.json({ success: true });
});

export = router;
