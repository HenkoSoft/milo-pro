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
  diagnosing: 'Diagnóstico',
  waiting_parts: 'Esperando repuestos',
  repairing: 'En reparación',
  ready: 'Listo para recoger',
  delivered: 'Entregado'
};


function generateTicketNumber() {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
  return 'TF-' + year + month + '-' + random;
}

router.get('/', authenticate, (req, res) => {
  const { status, search } = req.query;
  
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
    params.push('%' + search + '%', '%' + search + '%', '%' + search + '%', '%' + search + '%');
  }
  
  query += ' ORDER BY r.created_at DESC';
  
  const repairs = all(query, params);
  res.json(repairs.map(r => ({ ...r, status_label: STATUS_LABELS[r.status] })));
});

router.get('/stats', authenticate, (req, res) => {
  const stats = {
    received: get("SELECT COUNT(*) as count FROM repairs WHERE status = 'received'").count,
    diagnosing: get("SELECT COUNT(*) as count FROM repairs WHERE status = 'diagnosing'").count,
    waiting_parts: get("SELECT COUNT(*) as count FROM repairs WHERE status = 'waiting_parts'").count,
    repairing: get("SELECT COUNT(*) as count FROM repairs WHERE status = 'repairing'").count,
    ready: get("SELECT COUNT(*) as count FROM repairs WHERE status = 'ready'").count,
    delivered: get("SELECT COUNT(*) as count FROM repairs WHERE status = 'delivered'").count
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
  `, [repair.id]);
  
  res.json({ ...repair, status_label: STATUS_LABELS[repair.status], logs });
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
  `, [req.params.id]);
  
  res.json({ ...repair, status_label: STATUS_LABELS[repair.status], logs });
});

router.post('/', authenticate, (req, res) => {
  const { customer_id, device_type, brand, model, serial_number, imei, password, pattern, problem_description, accessories, estimated_price } = req.body;
  
  if (!customer_id || !device_type || !problem_description) {
    return res.status(400).json({ error: 'Customer, device type and problem description are required' });
  }
  
  const ticket_number = generateTicketNumber();
  
  const brandVal = brand === undefined ? null : brand;
  const modelVal = model === undefined ? null : model;
  const serialVal = serial_number === undefined ? null : serial_number;
  const imeiVal = imei === undefined ? null : imei;
  const passwordVal = password === undefined ? null : password;
  const patternVal = pattern === undefined ? null : pattern;
  const accessoriesVal = accessories === undefined ? null : accessories;
  const priceVal = estimated_price === undefined ? null : estimated_price;
  
  const result = run(`
    INSERT INTO repairs (
      ticket_number, customer_id, device_type, brand, model, serial_number, imei,
      password, pattern, problem_description, accessories, estimated_price, status
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'received')
  `, [ticket_number, customer_id, device_type, brandVal, modelVal, serialVal, imeiVal, passwordVal, patternVal, problem_description, accessoriesVal, priceVal]);
  
  const repairId = result.lastInsertRowid;
  
  run(`
    INSERT INTO repair_logs (repair_id, status, notes)
    VALUES (?, 'received', 'Dispositivo recibido')
  `, [repairId]);
  
  const repair = get('SELECT * FROM repairs WHERE id = ?', [repairId]);
  saveDatabase();
  res.status(201).json({ ...repair, status_label: STATUS_LABELS[repair.status] });
});

router.put('/:id', authenticate, (req, res) => {
  const { device_type, brand, model, serial_number, imei, password, pattern, problem_description, accessories, estimated_price, final_price, technician_notes } = req.body;
  
  const deviceVal = device_type === undefined ? null : device_type;
  const brandVal = brand === undefined ? null : brand;
  const modelVal = model === undefined ? null : model;
  const serialVal = serial_number === undefined ? null : serial_number;
  const imeiVal = imei === undefined ? null : imei;
  const passwordVal = password === undefined ? null : password;
  const patternVal = pattern === undefined ? null : pattern;
  const problemVal = problem_description === undefined ? null : problem_description;
  const accessoriesVal = accessories === undefined ? null : accessories;
  const estimatedVal = estimated_price === undefined ? null : estimated_price;
  const finalVal = final_price === undefined ? null : final_price;
  const notesVal = technician_notes === undefined ? null : technician_notes;
  
  run(`
    UPDATE repairs 
    SET device_type = ?, brand = ?, model = ?, serial_number = ?, imei = ?,
        password = ?, pattern = ?,
        problem_description = ?, accessories = ?, estimated_price = ?, 
        final_price = ?, technician_notes = ?
    WHERE id = ?
  `, [deviceVal, brandVal, modelVal, serialVal, imeiVal, passwordVal, patternVal, problemVal, accessoriesVal, estimatedVal, finalVal, notesVal, req.params.id]);
  
  const repair = get('SELECT * FROM repairs WHERE id = ?', [req.params.id]);
  saveDatabase();
  res.json({ ...repair, status_label: STATUS_LABELS[repair.status] });
});

router.put('/:id/status', authenticate, (req, res) => {
  const { status, notes } = req.body;
  
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
  res.json({ ...updatedRepair, status_label: STATUS_LABELS[updatedRepair.status] });
});

router.delete('/:id', authenticate, (req, res) => {
  run('DELETE FROM repair_logs WHERE repair_id = ?', [req.params.id]);
  run('DELETE FROM repairs WHERE id = ?', [req.params.id]);
  saveDatabase();
  res.json({ success: true });
});

module.exports = router;
