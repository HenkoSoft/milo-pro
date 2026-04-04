const express = require('express');
const { get, run, all, saveDatabase } = require('../database');
const { authenticate } = require('../auth');

const router = express.Router();

const REPAIR_STATUSES = [
  'received',
  'diagnosing',
  'waiting_parts',
  'repairing',
  'ready',
  'delivered'
];

const STATUS_LABELS = {
  received: 'Recibido',
  diagnosing: 'Diagnostico',
  waiting_parts: 'Esperando repuestos',
  repairing: 'En reparacion',
  ready: 'Listo para recoger',
  delivered: 'Entregado'
};

function toNullableString(value) {
  if (value === undefined || value === null || value === '') return null;
  return String(value).trim();
}

function toNumberOrNull(value) {
  if (value === undefined || value === null || value === '') return null;
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

function normalizeRepairPayload(body) {
  const data = body && typeof body === 'object' ? body : {};
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

function sanitizeRepairLog(record) {
  return {
    ...record,
    id: Number(record.id || 0),
    repair_id: Number(record.repair_id || 0),
    status: String(record.status || ''),
    notes: toNullableString(record.notes),
    created_at: String(record.created_at || '')
  };
}

function sanitizeRepair(record, logs = []) {
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

router.get('/', authenticate, (req, res) => {
  const status = String(req.query.status || '').trim();
  const search = String(req.query.search || '').trim();

  let query = `
    SELECT r.*, c.name as customer_name, c.phone as customer_phone
    FROM repairs r
    LEFT JOIN customers c ON r.customer_id = c.id
    WHERE 1=1
  `;
  const params = [];

  if (status && status !== 'all') {
    query += ' AND r.status = ?';
    params.push(status);
  }

  if (search) {
    query += ' AND (r.ticket_number LIKE ? OR c.name LIKE ? OR r.brand LIKE ? OR r.model LIKE ?)';
    params.push(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`);
  }

  query += ' ORDER BY r.created_at DESC';

  const repairs = all(query, params).map((repair) => sanitizeRepair(repair));
  res.json(repairs);
});

router.get('/stats', authenticate, (req, res) => {
  const stats = {
    received: Number(get("SELECT COUNT(*) as count FROM repairs WHERE status = 'received'").count || 0),
    diagnosing: Number(get("SELECT COUNT(*) as count FROM repairs WHERE status = 'diagnosing'").count || 0),
    waiting_parts: Number(get("SELECT COUNT(*) as count FROM repairs WHERE status = 'waiting_parts'").count || 0),
    repairing: Number(get("SELECT COUNT(*) as count FROM repairs WHERE status = 'repairing'").count || 0),
    ready: Number(get("SELECT COUNT(*) as count FROM repairs WHERE status = 'ready'").count || 0),
    delivered: Number(get("SELECT COUNT(*) as count FROM repairs WHERE status = 'delivered'").count || 0)
  };
  res.json(stats);
});

router.get('/ticket/:ticketNumber', authenticate, (req, res) => {
  const repair = get(`
    SELECT r.*, c.name as customer_name, c.phone as customer_phone, c.email as customer_email
    FROM repairs r
    LEFT JOIN customers c ON r.customer_id = c.id
    WHERE r.ticket_number = ?
  `, [req.params.ticketNumber]);

  if (!repair) return res.status(404).json({ error: 'Repair not found' });

  const logs = all(`
    SELECT * FROM repair_logs WHERE repair_id = ? ORDER BY created_at ASC
  `, [repair.id]).map((log) => sanitizeRepairLog(log));

  res.json(sanitizeRepair(repair, logs));
});

router.get('/:id', authenticate, (req, res) => {
  const repair = get(`
    SELECT r.*, c.name as customer_name, c.phone as customer_phone, c.email as customer_email, c.address as customer_address
    FROM repairs r
    LEFT JOIN customers c ON r.customer_id = c.id
    WHERE r.id = ?
  `, [req.params.id]);

  if (!repair) return res.status(404).json({ error: 'Repair not found' });

  const logs = all(`
    SELECT * FROM repair_logs WHERE repair_id = ? ORDER BY created_at ASC
  `, [req.params.id]).map((log) => sanitizeRepairLog(log));

  res.json(sanitizeRepair(repair, logs));
});

router.post('/', authenticate, (req, res) => {
  const payload = normalizeRepairPayload(req.body);

  if (!payload.customer_id || !payload.device_type || !payload.problem_description) {
    return res.status(400).json({ error: 'Customer, device type and problem description are required' });
  }

  const ticket_number = generateTicketNumber();

  const result = run(`
    INSERT INTO repairs (
      ticket_number, customer_id, device_type, brand, model, serial_number, imei,
      password, pattern, problem_description, accessories, estimated_price, status
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'received')
  `, [
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
  ]);

  const repairId = result.lastInsertRowid;

  run(`
    INSERT INTO repair_logs (repair_id, status, notes)
    VALUES (?, 'received', 'Dispositivo recibido')
  `, [repairId]);

  const repair = get('SELECT * FROM repairs WHERE id = ?', [repairId]);
  saveDatabase();
  res.status(201).json(sanitizeRepair(repair));
});

router.put('/:id', authenticate, (req, res) => {
  const payload = normalizeRepairPayload(req.body);

  run(`
    UPDATE repairs
    SET device_type = ?, brand = ?, model = ?, serial_number = ?, imei = ?,
        password = ?, pattern = ?,
        problem_description = ?, accessories = ?, estimated_price = ?,
        final_price = ?, technician_notes = ?
    WHERE id = ?
  `, [
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
  ]);

  const repair = get('SELECT * FROM repairs WHERE id = ?', [req.params.id]);
  saveDatabase();
  res.json(sanitizeRepair(repair));
});

router.put('/:id/status', authenticate, (req, res) => {
  const status = String((req.body || {}).status || '').trim();
  const notes = toNullableString((req.body || {}).notes);

  if (!REPAIR_STATUSES.includes(status)) {
    return res.status(400).json({ error: 'Invalid status' });
  }

  const repair = get('SELECT * FROM repairs WHERE id = ?', [req.params.id]);
  if (!repair) return res.status(404).json({ error: 'Repair not found' });

  const delivery_date = status === 'delivered' ? new Date().toISOString() : null;

  run(`
    UPDATE repairs SET status = ?, delivery_date = ? WHERE id = ?
  `, [status, delivery_date, req.params.id]);

  run(`
    INSERT INTO repair_logs (repair_id, status, notes)
    VALUES (?, ?, ?)
  `, [req.params.id, status, notes || STATUS_LABELS[status]]);

  const updatedRepair = get('SELECT * FROM repairs WHERE id = ?', [req.params.id]);
  saveDatabase();
  res.json(sanitizeRepair(updatedRepair));
});

router.delete('/:id', authenticate, (req, res) => {
  run('DELETE FROM repair_logs WHERE repair_id = ?', [req.params.id]);
  run('DELETE FROM repairs WHERE id = ?', [req.params.id]);
  saveDatabase();
  res.json({ success: true });
});

module.exports = router;
