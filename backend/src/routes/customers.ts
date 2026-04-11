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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function toNullableString(value: unknown): string | null {
  if (value === undefined || value === null || value === '') return null;
  return String(value).trim();
}

function toNumberOrNull(value: unknown): number | null {
  if (value === undefined || value === null || value === '') return null;
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

function normalizeCustomerPayload(body: unknown) {
  const data = isRecord(body) ? body : {};
  return {
    name: String(data.name || '').trim(),
    phone: String(data.phone || ''),
    email: String(data.email || ''),
    address: String(data.address || ''),
    contact: String(data.contact || ''),
    city: String(data.city || ''),
    province: String(data.province || ''),
    country: String(data.country || ''),
    tax_id: String(data.tax_id || ''),
    iva_condition: String(data.iva_condition || 'Consumidor Final').trim() || 'Consumidor Final',
    instagram: String(data.instagram || ''),
    transport: String(data.transport || ''),
    credit_limit: String(data.credit_limit || ''),
    zone: String(data.zone || ''),
    discount_percent: String(data.discount_percent || ''),
    seller: String(data.seller || ''),
    price_list: String(data.price_list || '1').trim() || '1',
    billing_conditions: String(data.billing_conditions || ''),
    notes: String(data.notes || '')
  };
}

function buildCustomerParams(payload: ReturnType<typeof normalizeCustomerPayload>) {
  return [
    payload.name,
    toNullableString(payload.phone),
    toNullableString(payload.email),
    toNullableString(payload.address),
    toNullableString(payload.contact),
    toNullableString(payload.city),
    toNullableString(payload.province),
    toNullableString(payload.country),
    toNullableString(payload.tax_id),
    toNullableString(payload.iva_condition) || 'Consumidor Final',
    toNullableString(payload.instagram),
    toNullableString(payload.transport),
    toNumberOrNull(payload.credit_limit),
    toNullableString(payload.zone),
    toNumberOrNull(payload.discount_percent),
    toNullableString(payload.seller),
    toNullableString(payload.price_list) || '1',
    toNullableString(payload.billing_conditions),
    toNullableString(payload.notes)
  ];
}

function sanitizeCustomer(record: unknown) {
  const data = isRecord(record) ? record : {};
  return {
    id: Number(data.id || 0),
    name: String(data.name || ''),
    phone: toNullableString(data.phone),
    email: toNullableString(data.email),
    address: toNullableString(data.address),
    contact: toNullableString(data.contact),
    city: toNullableString(data.city),
    province: toNullableString(data.province),
    country: toNullableString(data.country),
    tax_id: toNullableString(data.tax_id),
    iva_condition: toNullableString(data.iva_condition),
    instagram: toNullableString(data.instagram),
    transport: toNullableString(data.transport),
    credit_limit: toNumberOrNull(data.credit_limit),
    zone: toNullableString(data.zone),
    discount_percent: toNumberOrNull(data.discount_percent),
    seller: toNullableString(data.seller),
    price_list: toNullableString(data.price_list),
    billing_conditions: toNullableString(data.billing_conditions),
    notes: toNullableString(data.notes),
    created_at: typeof data.created_at === 'string' ? data.created_at : undefined
  };
}

function sanitizeCustomerRelatedSale(record: unknown) {
  const data = isRecord(record) ? record : {};
  return {
    id: Number(data.id || 0),
    total: toNumberOrNull(data.total),
    created_at: typeof data.created_at === 'string' ? data.created_at : undefined,
    user_name: toNullableString(data.user_name)
  };
}

function sanitizeCustomerRelatedRepair(record: unknown) {
  const data = isRecord(record) ? record : {};
  return {
    id: Number(data.id || 0),
    ticket_number: toNullableString(data.ticket_number),
    brand: toNullableString(data.brand),
    model: toNullableString(data.model),
    device_type: toNullableString(data.device_type),
    status: toNullableString(data.status),
    created_at: typeof data.created_at === 'string' ? data.created_at : undefined
  };
}

function buildCustomerDetail(customer: unknown, sales: unknown[], repairs: unknown[]) {
  return {
    ...sanitizeCustomer(customer),
    sales: sales.map(sanitizeCustomerRelatedSale),
    repairs: repairs.map(sanitizeCustomerRelatedRepair)
  };
}

const router = express.Router();

router.get('/', authenticate, async (req: RouteRequest, res: JsonResponse) => {
  const db = getDatabaseAccessForRequest(req);
  const search = String(req.query.search || '').trim();

  let query = 'SELECT * FROM customers WHERE 1=1';
  const params: string[] = [];

  if (search) {
    query += ' AND (name LIKE ? OR phone LIKE ? OR email LIKE ?)';
    params.push(`%${search}%`, `%${search}%`, `%${search}%`);
  }

  query += ' ORDER BY created_at DESC';

  const customers = await db.all(query, params);
  res.json(customers.map(sanitizeCustomer));
});

router.get('/:id', authenticate, async (req: RouteRequest, res: JsonResponse) => {
  const db = getDatabaseAccessForRequest(req);
  const customer = await db.get('SELECT * FROM customers WHERE id = ?', [req.params.id]);

  if (!customer) {
    res.status(404).json({ error: 'Customer not found' });
    return;
  }

  const sales = await db.all(`
    SELECT s.*, u.name as user_name
    FROM sales s
    LEFT JOIN users u ON s.user_id = u.id
    WHERE s.customer_id = ?
    ORDER BY s.created_at DESC
    LIMIT 10
  `, [req.params.id]);

  const repairs = await db.all(`
    SELECT * FROM repairs
    WHERE customer_id = ?
    ORDER BY created_at DESC
    LIMIT 10
  `, [req.params.id]);

  res.json(buildCustomerDetail(customer, sales, repairs));
});

router.post('/', authenticate, async (req: RouteRequest, res: JsonResponse) => {
  const db = getDatabaseAccessForRequest(req);
  const payload = normalizeCustomerPayload(req.body);

  if (!payload.name) {
    res.status(400).json({ error: 'Name is required' });
    return;
  }

  const result = await db.run(`
    INSERT INTO customers (
      name, phone, email, address, contact, city, province, country, tax_id,
      iva_condition, instagram, transport, credit_limit, zone, discount_percent,
      seller, price_list, billing_conditions, notes
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, buildCustomerParams(payload)) as { lastInsertRowid?: number | null };

  const customer = await db.get('SELECT * FROM customers WHERE id = ?', [result.lastInsertRowid]);
  await db.save();
  res.status(201).json(sanitizeCustomer(customer));
});

router.put('/:id', authenticate, async (req: RouteRequest, res: JsonResponse) => {
  const db = getDatabaseAccessForRequest(req);
  const payload = normalizeCustomerPayload(req.body);

  await db.run(`
    UPDATE customers SET
      name = ?, phone = ?, email = ?, address = ?, contact = ?, city = ?, province = ?, country = ?,
      tax_id = ?, iva_condition = ?, instagram = ?, transport = ?, credit_limit = ?, zone = ?,
      discount_percent = ?, seller = ?, price_list = ?, billing_conditions = ?, notes = ?
    WHERE id = ?
  `, [
    ...buildCustomerParams(payload),
    req.params.id
  ]);

  const customer = await db.get('SELECT * FROM customers WHERE id = ?', [req.params.id]);
  await db.save();
  res.json(sanitizeCustomer(customer));
});

router.delete('/:id', authenticate, async (req: RouteRequest, res: JsonResponse) => {
  const db = getDatabaseAccessForRequest(req);
  await db.run('DELETE FROM customers WHERE id = ?', [req.params.id]);
  await db.save();
  res.json({ success: true });
});

export = router;
