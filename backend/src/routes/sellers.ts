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

type SellerRecord = Record<string, unknown>;
type SellerPaymentRecord = Record<string, unknown>;

const router = express.Router();

function getDatabaseAccess(req: RouteRequest): DatabaseAccess {
  return getDatabaseAccessForRequest(req);
}

function toNullableString(value: unknown) {
  if (value === undefined || value === null || String(value).trim() === '') return null;
  return String(value).trim();
}

function toNumber(value: unknown, fallback = 0) {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
}

function normalizeSellerKey(value: unknown) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'seller';
}

function buildSellerId(name: unknown) {
  return `seller-${normalizeSellerKey(name)}`;
}

function sanitizeSeller(record: SellerRecord | null) {
  if (!record) return null;
  return {
    id: toNullableString(record.id),
    code: toNullableString(record.code),
    name: toNullableString(record.name),
    address: toNullableString(record.address),
    phone: toNullableString(record.phone),
    cell: toNullableString(record.cell),
    commission_percent: toNumber(record.commission_percent, 5),
    archived: Boolean(toNumber(record.archived, 0)),
    source: toNullableString(record.source)
  };
}

function parseJsonArray(value: unknown) {
  if (!value) return [];
  try {
    const parsed = JSON.parse(String(value));
    return Array.isArray(parsed) ? parsed.map((item) => String(item)) : [];
  } catch {
    return [];
  }
}

function sanitizeSellerPayment(record: SellerPaymentRecord | null) {
  if (!record) return null;
  return {
    id: toNumber(record.id),
    payment_date: toNullableString(record.payment_date),
    seller_id: toNullableString(record.seller_id),
    seller_name: toNullableString(record.seller_name),
    total_paid: toNumber(record.total_paid),
    total_sales: toNumber(record.total_sales),
    sale_ids: parseJsonArray(record.sale_ids_json)
  };
}

async function buildSellerCatalog(db: DatabaseAccess) {
  const stored = await db.all('SELECT * FROM sellers ORDER BY LOWER(name) ASC, id ASC');
  const storedById = new Map<string, any>();

  stored.forEach((row) => {
    const normalized = sanitizeSeller({ ...row, source: row.source || 'manual' });
    if (normalized?.id) {
      storedById.set(normalized.id, normalized);
    }
  });

  const derivedRows = await db.all(`
    SELECT DISTINCT
      COALESCE(NULLIF(TRIM(c.seller), ''), NULLIF(TRIM(u.name), '')) AS seller_name
    FROM sales s
    LEFT JOIN customers c ON c.id = s.customer_id
    LEFT JOIN users u ON u.id = s.user_id
    WHERE COALESCE(NULLIF(TRIM(c.seller), ''), NULLIF(TRIM(u.name), '')) IS NOT NULL
    UNION
    SELECT DISTINCT NULLIF(TRIM(seller), '') AS seller_name
    FROM customers
    WHERE NULLIF(TRIM(seller), '') IS NOT NULL
  `);

  const names = [...new Set(
    derivedRows
      .map((row) => toNullableString(row.seller_name))
      .filter((value): value is string => Boolean(value))
  )].sort((a, b) => a.localeCompare(b));

  const derived = names.map((name, index) => {
    const id = buildSellerId(name);
    const storedData = storedById.get(id);
    return {
      id,
      code: storedData?.code || `VEN-${String(index + 1).padStart(3, '0')}`,
      name: storedData?.name || name,
      address: storedData?.address || '',
      phone: storedData?.phone || '',
      cell: storedData?.cell || '',
      commission_percent: toNumber(storedData?.commission_percent, 5),
      archived: Boolean(storedData?.archived),
      source: 'derived'
    };
  });

  const manual = stored
    .map((row) => sanitizeSeller({ ...row, source: row.source || 'manual' }))
    .filter((row): row is NonNullable<ReturnType<typeof sanitizeSeller>> => Boolean(row?.id))
    .filter((row) => !row.archived && !derived.some((seller) => seller.id === row.id))
    .map((row, index) => ({
      id: row.id,
      code: row.code || `VEN-M${String(index + 1).padStart(3, '0')}`,
      name: row.name || 'Vendedor',
      address: row.address || '',
      phone: row.phone || '',
      cell: row.cell || '',
      commission_percent: toNumber(row.commission_percent, 5),
      archived: false,
      source: row.source || 'manual'
    }));

  return [...derived.filter((row) => !row.archived), ...manual].sort((a, b) => String(a.name).localeCompare(String(b.name)));
}

router.get('/', authenticate, async (req: RouteRequest, res: JsonResponse) => {
  const db = getDatabaseAccess(req);
  const sellers = await buildSellerCatalog(db);
  res.json(sellers);
});

router.post('/', authenticate, async (req: RouteRequest, res: JsonResponse) => {
  const db = getDatabaseAccess(req);
  const body = req.body && typeof req.body === 'object' ? req.body as Record<string, unknown> : {};
  const name = String(body.name || '').trim();
  const code = String(body.code || '').trim();
  const commissionPercent = toNumber(body.commission_percent, 0);

  if (!name) {
    res.status(400).json({ error: 'El nombre es obligatorio.' });
    return;
  }

  if (!code) {
    res.status(400).json({ error: 'El codigo es obligatorio.' });
    return;
  }

  if (commissionPercent < 0) {
    res.status(400).json({ error: 'El porcentaje de comision no puede ser negativo.' });
    return;
  }

  const id = String(body.id || '').trim() || buildSellerId(name);
  const existing = await db.get('SELECT id FROM sellers WHERE id = ?', [id]);

  if (existing) {
    await db.run(
      `
        UPDATE sellers
        SET code = ?, name = ?, address = ?, phone = ?, cell = ?, commission_percent = ?, archived = 0, source = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `,
      [
        code,
        name,
        toNullableString(body.address),
        toNullableString(body.phone),
        toNullableString(body.cell),
        commissionPercent,
        toNullableString(body.source) || 'manual',
        id
      ]
    );
  } else {
    await db.run(
      `
        INSERT INTO sellers (id, code, name, address, phone, cell, commission_percent, archived, source)
        VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?)
      `,
      [
        id,
        code,
        name,
        toNullableString(body.address),
        toNullableString(body.phone),
        toNullableString(body.cell),
        commissionPercent,
        toNullableString(body.source) || 'manual'
      ]
    );
  }

  await db.save();
  const saved = await db.get('SELECT * FROM sellers WHERE id = ?', [id]);
  res.status(existing ? 200 : 201).json(sanitizeSeller(saved));
});

router.delete('/:id', authenticate, async (req: RouteRequest, res: JsonResponse) => {
  const db = getDatabaseAccess(req);
  const id = String(req.params.id || '').trim();

  if (!id) {
    res.status(400).json({ error: 'El identificador es obligatorio.' });
    return;
  }

  const existing = await db.get('SELECT * FROM sellers WHERE id = ?', [id]);
  if (existing) {
    await db.run('UPDATE sellers SET archived = 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [id]);
  } else {
    await db.run(
      `
        INSERT INTO sellers (id, code, name, address, phone, cell, commission_percent, archived, source)
        VALUES (?, ?, ?, ?, ?, ?, ?, 1, 'manual')
      `,
      [id, null, 'Vendedor', null, null, null, 5]
    );
  }

  await db.save();
  res.json({ ok: true });
});

router.get('/payments', authenticate, async (req: RouteRequest, res: JsonResponse) => {
  const db = getDatabaseAccess(req);
  const rows = await db.all('SELECT * FROM seller_commission_payments ORDER BY payment_date DESC, id DESC');
  res.json(rows.map((row) => sanitizeSellerPayment(row)));
});

router.post('/payments', authenticate, async (req: RouteRequest, res: JsonResponse) => {
  const db = getDatabaseAccess(req);
  const body = req.body && typeof req.body === 'object' ? req.body as Record<string, unknown> : {};
  const sellerId = String(body.seller_id || '').trim();
  const sellerName = String(body.seller_name || '').trim();
  const paymentDate = String(body.payment_date || '').trim();
  const totalPaid = toNumber(body.total_paid);
  const totalSales = toNumber(body.total_sales);
  const saleIds = Array.isArray(body.sale_ids) ? body.sale_ids.map((item) => String(item)) : [];

  if (!sellerId) {
    res.status(400).json({ error: 'El vendedor es obligatorio.' });
    return;
  }

  if (!sellerName) {
    res.status(400).json({ error: 'El nombre del vendedor es obligatorio.' });
    return;
  }

  if (!paymentDate) {
    res.status(400).json({ error: 'La fecha de pago es obligatoria.' });
    return;
  }

  if (totalPaid <= 0) {
    res.status(400).json({ error: 'El total pagado debe ser mayor a cero.' });
    return;
  }

  if (saleIds.length === 0) {
    res.status(400).json({ error: 'Debe indicar al menos una venta.' });
    return;
  }

  const result = await db.run(
    `
      INSERT INTO seller_commission_payments (payment_date, seller_id, seller_name, total_paid, total_sales, sale_ids_json)
      VALUES (?, ?, ?, ?, ?, ?)
    `,
    [paymentDate, sellerId, sellerName, totalPaid, totalSales, JSON.stringify(saleIds)]
  ) as { lastInsertRowid?: number | null };

  await db.save();
  const created = await db.get('SELECT * FROM seller_commission_payments WHERE id = ?', [result.lastInsertRowid]);
  res.status(201).json(sanitizeSellerPayment(created));
});

export = router;
