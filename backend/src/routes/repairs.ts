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

const REPAIR_STATUSES = ['received', 'diagnosing', 'waiting_parts', 'repairing', 'ready', 'delivered'];

const STATUS_LABELS: Record<string, string> = {
  received: 'Recibido',
  diagnosing: 'Diagnostico',
  waiting_parts: 'Esperando repuestos',
  repairing: 'En reparacion',
  ready: 'Listo para recoger',
  delivered: 'Entregado'
};

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

function normalizeRepairPayload(body: unknown) {
  const data = body && typeof body === 'object' ? (body as Record<string, unknown>) : {};
  return {
    customer_id: String(data.customer_id || '').trim(),
    device_type: String(data.device_type || '').trim(),
    brand: String(data.brand || ''),
    model: String(data.model || ''),
    serial_number: String(data.serial_number || ''),
    imei: String(data.imei || ''),
    password: String(data.password || ''),
    pattern: String(data.pattern || ''),
    problem_description: String(data.problem_description || '').trim(),
    accessories: String(data.accessories || ''),
    estimated_price: data.estimated_price ?? null,
    final_price: data.final_price ?? null,
    technician_notes: String(data.technician_notes || '')
  };
}

function sanitizeRepairLog(record: Record<string, unknown>) {
  return {
    ...record,
    id: Number(record.id || 0),
    repair_id: Number(record.repair_id || 0),
    status: String(record.status || ''),
    notes: toNullableString(record.notes),
    created_at: String(record.created_at || '')
  };
}

function sanitizeRepair(record: Record<string, unknown> | null, logs: Array<Record<string, unknown>> = []) {
  if (!record) return null;
  const status = String(record.status || 'received');
  return {
    ...record,
    id: Number(record.id || 0),
    customer_id: Number(record.customer_id || 0),
    ticket_number: String(record.ticket_number || ''),
    customer_name: toNullableString(record.customer_name),
    customer_phone: toNullableString(record.customer_phone),
    customer_email: toNullableString(record.customer_email),
    customer_address: toNullableString(record.customer_address),
    device_type: String(record.device_type || ''),
    brand: toNullableString(record.brand),
    model: toNullableString(record.model),
    serial_number: toNullableString(record.serial_number),
    imei: toNullableString(record.imei),
    password: toNullableString(record.password),
    pattern: toNullableString(record.pattern),
    problem_description: String(record.problem_description || ''),
    accessories: toNullableString(record.accessories),
    status,
    status_label: STATUS_LABELS[status] || null,
    estimated_price: toNumberOrNull(record.estimated_price),
    final_price: toNumberOrNull(record.final_price),
    technician_notes: toNullableString(record.technician_notes),
    logs
  };
}

function generateTicketNumber() {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
  return 'TF-' + year + month + '-' + random;
}

router.get('/', authenticate, async (req: RouteRequest, res: JsonResponse) => {
  const db = getDatabaseAccess(req);
  const status = String(req.query.status || '').trim();
  const search = String(req.query.search || '').trim();

  let query = `
    SELECT r.*, c.name as customer_name, c.phone as customer_phone
    FROM repairs r
    LEFT JOIN customers c ON r.customer_id = c.id
    WHERE 1=1
  `;
  const params: string[] = [];

  if (status && status !== 'all') {
    query += ' AND r.status = ?';
    params.push(status);
  }

  if (search) {
    query += ' AND (r.ticket_number LIKE ? OR c.name LIKE ? OR r.brand LIKE ? OR r.model LIKE ?)';
    params.push(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`);
  }

  query += ' ORDER BY r.created_at DESC';

  const repairs = (await db.all(query, params)).map((repair) => sanitizeRepair(repair));
  res.json(repairs);
});

router.get('/stats', authenticate, async (req: RouteRequest, res: JsonResponse) => {
  const db = getDatabaseAccess(req);
  const received = await db.get("SELECT COUNT(*) as count FROM repairs WHERE status = 'received'");
  const diagnosing = await db.get("SELECT COUNT(*) as count FROM repairs WHERE status = 'diagnosing'");
  const waitingParts = await db.get("SELECT COUNT(*) as count FROM repairs WHERE status = 'waiting_parts'");
  const repairing = await db.get("SELECT COUNT(*) as count FROM repairs WHERE status = 'repairing'");
  const ready = await db.get("SELECT COUNT(*) as count FROM repairs WHERE status = 'ready'");
  const delivered = await db.get("SELECT COUNT(*) as count FROM repairs WHERE status = 'delivered'");

  res.json({
    received: Number((received && received.count) || 0),
    diagnosing: Number((diagnosing && diagnosing.count) || 0),
    waiting_parts: Number((waitingParts && waitingParts.count) || 0),
    repairing: Number((repairing && repairing.count) || 0),
    ready: Number((ready && ready.count) || 0),
    delivered: Number((delivered && delivered.count) || 0)
  });
});

router.get('/ticket/:ticketNumber', authenticate, async (req: RouteRequest, res: JsonResponse) => {
  const db = getDatabaseAccess(req);
  const repair = await db.get(
    `
    SELECT r.*, c.name as customer_name, c.phone as customer_phone, c.email as customer_email
    FROM repairs r
    LEFT JOIN customers c ON r.customer_id = c.id
    WHERE r.ticket_number = ?
  `,
    [req.params.ticketNumber]
  );

  if (!repair) {
    res.status(404).json({ error: 'Repair not found' });
    return;
  }

  const logs = (
    await db.all(
      `
    SELECT * FROM repair_logs WHERE repair_id = ? ORDER BY created_at ASC
  `,
      [repair.id]
    )
  ).map((log) => sanitizeRepairLog(log));

  res.json(sanitizeRepair(repair, logs));
});

router.get('/:id', authenticate, async (req: RouteRequest, res: JsonResponse) => {
  const db = getDatabaseAccess(req);
  const repair = await db.get(
    `
    SELECT r.*, c.name as customer_name, c.phone as customer_phone, c.email as customer_email, c.address as customer_address
    FROM repairs r
    LEFT JOIN customers c ON r.customer_id = c.id
    WHERE r.id = ?
  `,
    [req.params.id]
  );

  if (!repair) {
    res.status(404).json({ error: 'Repair not found' });
    return;
  }

  const logs = (
    await db.all(
      `
    SELECT * FROM repair_logs WHERE repair_id = ? ORDER BY created_at ASC
  `,
      [req.params.id]
    )
  ).map((log) => sanitizeRepairLog(log));

  res.json(sanitizeRepair(repair, logs));
});

router.post('/', authenticate, async (req: RouteRequest, res: JsonResponse) => {
  const db = getDatabaseAccess(req);
  const payload = normalizeRepairPayload(req.body);

  if (!payload.customer_id || !payload.device_type || !payload.problem_description) {
    res.status(400).json({ error: 'Customer, device type and problem description are required' });
    return;
  }

  const ticket_number = generateTicketNumber();

  const result = await db.run(
    `
    INSERT INTO repairs (
      ticket_number, customer_id, device_type, brand, model, serial_number, imei,
      password, pattern, problem_description, accessories, estimated_price, status
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'received')
  `,
    [
      ticket_number,
      payload.customer_id,
      payload.device_type,
      toNullableString(payload.brand),
      toNullableString(payload.model),
      toNullableString(payload.serial_number),
      toNullableString(payload.imei),
      toNullableString(payload.password),
      toNullableString(payload.pattern),
      payload.problem_description,
      toNullableString(payload.accessories),
      toNumberOrNull(payload.estimated_price)
    ]
  );

  const repairId = result.lastInsertRowid;

  await db.run(
    `
    INSERT INTO repair_logs (repair_id, status, notes)
    VALUES (?, 'received', 'Dispositivo recibido')
  `,
    [repairId]
  );

  const repair = await db.get('SELECT * FROM repairs WHERE id = ?', [repairId]);
  await db.save();
  res.status(201).json(sanitizeRepair(repair));
});

router.put('/:id', authenticate, async (req: RouteRequest, res: JsonResponse) => {
  const db = getDatabaseAccess(req);
  const payload = normalizeRepairPayload(req.body);

  await db.run(
    `
    UPDATE repairs
    SET device_type = ?, brand = ?, model = ?, serial_number = ?, imei = ?,
        password = ?, pattern = ?,
        problem_description = ?, accessories = ?, estimated_price = ?,
        final_price = ?, technician_notes = ?
    WHERE id = ?
  `,
    [
      toNullableString(payload.device_type),
      toNullableString(payload.brand),
      toNullableString(payload.model),
      toNullableString(payload.serial_number),
      toNullableString(payload.imei),
      toNullableString(payload.password),
      toNullableString(payload.pattern),
      toNullableString(payload.problem_description),
      toNullableString(payload.accessories),
      toNumberOrNull(payload.estimated_price),
      toNumberOrNull(payload.final_price),
      toNullableString(payload.technician_notes),
      req.params.id
    ]
  );

  const repair = await db.get('SELECT * FROM repairs WHERE id = ?', [req.params.id]);
  await db.save();
  res.json(sanitizeRepair(repair));
});

router.put('/:id/status', authenticate, async (req: RouteRequest, res: JsonResponse) => {
  const db = getDatabaseAccess(req);
  const body = req.body && typeof req.body === 'object' ? (req.body as Record<string, unknown>) : {};
  const status = String(body.status || '').trim();
  const notes = toNullableString(body.notes);

  if (!REPAIR_STATUSES.includes(status)) {
    res.status(400).json({ error: 'Invalid status' });
    return;
  }

  const repair = await db.get('SELECT * FROM repairs WHERE id = ?', [req.params.id]);
  if (!repair) {
    res.status(404).json({ error: 'Repair not found' });
    return;
  }

  const delivery_date = status === 'delivered' ? new Date().toISOString() : null;

  await db.run('UPDATE repairs SET status = ?, delivery_date = ? WHERE id = ?', [status, delivery_date, req.params.id]);

  await db.run(
    `
    INSERT INTO repair_logs (repair_id, status, notes)
    VALUES (?, ?, ?)
  `,
    [req.params.id, status, notes || STATUS_LABELS[status]]
  );

  const updatedRepair = await db.get('SELECT * FROM repairs WHERE id = ?', [req.params.id]);
  await db.save();
  res.json(sanitizeRepair(updatedRepair));
});

router.delete('/:id', authenticate, async (req: RouteRequest, res: JsonResponse) => {
  const db = getDatabaseAccess(req);
  await db.run('DELETE FROM repair_logs WHERE repair_id = ?', [req.params.id]);
  await db.run('DELETE FROM repairs WHERE id = ?', [req.params.id]);
  await db.save();
  res.json({ success: true });
});

export = router;
