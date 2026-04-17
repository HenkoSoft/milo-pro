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

type ConnectedSession = {
  id: string;
  username: string;
  ip?: string;
  loginDate?: string;
  lastActivity?: string;
  connectionStatus?: string;
};

type AdminConfigStore = {
  general?: Record<string, unknown>;
  documents?: Record<string, unknown>;
  mail?: Record<string, unknown>;
};

const router = express.Router();

const DEFAULT_ADMIN_CONFIG: AdminConfigStore = {
  general: {
    legal_name: '',
    tax_id: '',
    currency: 'ARS',
    date_format: 'dd/MM/yyyy',
    timezone: 'America/Argentina/Buenos_Aires',
    logo_name: '',
    logo_data_url: ''
  },
  documents: {
    numbering_format: 'PV-00000000',
    prefixes: '',
    control_stock: true,
    allow_negative_stock: false,
    control_min_price: false,
    decimals: 2
  },
  mail: {
    smtp_server: '',
    port: '587',
    username: '',
    password: '',
    encryption: 'tls',
    sender_email: ''
  }
};

function getDatabaseAccess(req: RouteRequest): DatabaseAccess {
  return getDatabaseAccessForRequest(req);
}

function isAdmin(req: RouteRequest) {
  return String(req.user?.role || '').toLowerCase() === 'admin';
}

function toNullableString(value: unknown) {
  if (value === undefined || value === null || String(value).trim() === '') return null;
  return String(value).trim();
}

function toNumber(value: unknown, fallback = 0) {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
}

function toBoolean(value: unknown, fallback = false) {
  if (typeof value === 'boolean') return value;
  if (value === 'true' || value === '1' || value === 1) return true;
  if (value === 'false' || value === '0' || value === 0) return false;
  return fallback;
}

function parseJsonObject(value: unknown) {
  if (!value) return {};
  try {
    const parsed = JSON.parse(String(value));
    return parsed && typeof parsed === 'object' ? parsed as Record<string, unknown> : {};
  } catch {
    return {};
  }
}

function withDefaultAdminConfig(record: Record<string, unknown> | null) {
  const general = parseJsonObject(record?.general_json);
  const documents = parseJsonObject(record?.documents_json);
  const mail = parseJsonObject(record?.mail_json);

  return {
    general: {
      ...DEFAULT_ADMIN_CONFIG.general,
      ...general
    },
    documents: {
      ...DEFAULT_ADMIN_CONFIG.documents,
      ...documents
    },
    mail: {
      ...DEFAULT_ADMIN_CONFIG.mail,
      ...mail
    }
  };
}

function sanitizeConnectedSession(record: Record<string, unknown> | null): ConnectedSession | null {
  if (!record) return null;
  return {
    id: String(record.id || ''),
    username: String(record.username || ''),
    ip: toNullableString(record.ip) || undefined,
    loginDate: toNullableString(record.login_date) || undefined,
    lastActivity: toNullableString(record.last_activity) || undefined,
    connectionStatus: toNullableString(record.connection_status) || undefined
  };
}

function sanitizeAuxRow(record: Record<string, unknown> | null) {
  if (!record) return null;
  return {
    id: String(record.id || ''),
    table_key: String(record.table_key || ''),
    description: String(record.description || ''),
    code: toNullableString(record.code),
    active: Boolean(toNumber(record.active, 1)),
    source: 'api'
  };
}

router.get('/config', authenticate, async (req: RouteRequest, res: JsonResponse) => {
  const db = getDatabaseAccess(req);
  const row = await db.get('SELECT * FROM admin_config_store WHERE id = 1');
  res.json(withDefaultAdminConfig(row));
});

router.put('/config', authenticate, async (req: RouteRequest, res: JsonResponse) => {
  if (!isAdmin(req)) {
    res.status(403).json({ error: 'Solo el administrador puede modificar configuraciones' });
    return;
  }

  const db = getDatabaseAccess(req);
  const body = req.body && typeof req.body === 'object' ? req.body as Record<string, unknown> : {};
  const config = {
    general: {
      ...DEFAULT_ADMIN_CONFIG.general,
      ...(body.general && typeof body.general === 'object' ? body.general as Record<string, unknown> : {})
    },
    documents: {
      ...DEFAULT_ADMIN_CONFIG.documents,
      ...(body.documents && typeof body.documents === 'object' ? body.documents as Record<string, unknown> : {})
    },
    mail: {
      ...DEFAULT_ADMIN_CONFIG.mail,
      ...(body.mail && typeof body.mail === 'object' ? body.mail as Record<string, unknown> : {})
    }
  };

  await db.run(
    `
      UPDATE admin_config_store
      SET general_json = ?, documents_json = ?, mail_json = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = 1
    `,
    [JSON.stringify(config.general), JSON.stringify(config.documents), JSON.stringify(config.mail)]
  );

  await db.save();
  const saved = await db.get('SELECT * FROM admin_config_store WHERE id = 1');
  res.json(withDefaultAdminConfig(saved));
});

router.get('/connected-users', authenticate, async (req: RouteRequest, res: JsonResponse) => {
  const db = getDatabaseAccess(req);
  const rows = await db.all('SELECT * FROM admin_connected_sessions ORDER BY COALESCE(last_activity, login_date) DESC, id ASC');
  res.json(rows.map((row) => sanitizeConnectedSession(row)));
});

router.delete('/connected-users/:id', authenticate, async (req: RouteRequest, res: JsonResponse) => {
  if (!isAdmin(req)) {
    res.status(403).json({ error: 'Solo el administrador puede cerrar sesiones.' });
    return;
  }

  const db = getDatabaseAccess(req);
  const id = String(req.params.id || '').trim();
  if (!id) {
    res.status(400).json({ error: 'El identificador es obligatorio.' });
    return;
  }

  await db.run('DELETE FROM admin_connected_sessions WHERE id = ?', [id]);
  await db.save();
  res.json({ ok: true });
});

router.get('/aux-tables', authenticate, async (req: RouteRequest, res: JsonResponse) => {
  const db = getDatabaseAccess(req);
  const tableKey = String(req.query.tableKey || '').trim();
  const params: string[] = [];
  let query = 'SELECT * FROM admin_aux_rows WHERE 1=1';

  if (tableKey) {
    query += ' AND table_key = ?';
    params.push(tableKey);
  }

  query += ' ORDER BY created_at DESC, id DESC';
  const rows = await db.all(query, params);
  res.json(rows.map((row) => sanitizeAuxRow(row)));
});

router.post('/aux-tables', authenticate, async (req: RouteRequest, res: JsonResponse) => {
  if (!isAdmin(req)) {
    res.status(403).json({ error: 'Solo el administrador puede modificar tablas auxiliares.' });
    return;
  }

  const db = getDatabaseAccess(req);
  const body = req.body && typeof req.body === 'object' ? req.body as Record<string, unknown> : {};
  const tableKey = String(body.table_key || '').trim();
  const description = String(body.description || '').trim();
  const code = toNullableString(body.code);
  const active = toBoolean(body.active, true) ? 1 : 0;

  if (!tableKey) {
    res.status(400).json({ error: 'La tabla es obligatoria.' });
    return;
  }

  if (!description) {
    res.status(400).json({ error: 'La descripcion es obligatoria.' });
    return;
  }

  const id = String(body.id || `${tableKey}-${Date.now()}`).trim();

  await db.run(
    `
      INSERT INTO admin_aux_rows (id, table_key, description, code, active)
      VALUES (?, ?, ?, ?, ?)
    `,
    [id, tableKey, description, code, active]
  );

  await db.save();
  const created = await db.get('SELECT * FROM admin_aux_rows WHERE id = ?', [id]);
  res.status(201).json(sanitizeAuxRow(created));
});

router.delete('/aux-tables/:id', authenticate, async (req: RouteRequest, res: JsonResponse) => {
  if (!isAdmin(req)) {
    res.status(403).json({ error: 'Solo el administrador puede modificar tablas auxiliares.' });
    return;
  }

  const db = getDatabaseAccess(req);
  const id = String(req.params.id || '').trim();
  if (!id) {
    res.status(400).json({ error: 'El identificador es obligatorio.' });
    return;
  }

  await db.run('DELETE FROM admin_aux_rows WHERE id = ?', [id]);
  await db.save();
  res.json({ ok: true });
});

router.post('/troubleshoot/cache', authenticate, async (req: RouteRequest, res: JsonResponse) => {
  if (!isAdmin(req)) {
    res.status(403).json({ error: 'Solo el administrador puede ejecutar acciones tecnicas.' });
    return;
  }

  const db = getDatabaseAccess(req);
  await db.run('DELETE FROM admin_connected_sessions');
  await db.save();
  res.json({ ok: true });
});

export = router;
