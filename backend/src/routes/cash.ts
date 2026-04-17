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

type CashMovementRecord = Record<string, unknown>;

const router = express.Router();
const CASH_MOVEMENT_TYPES = ['income', 'expenses', 'withdrawals'] as const;

function getDatabaseAccess(req: RouteRequest): DatabaseAccess {
  return getDatabaseAccessForRequest(req);
}

function toNullableString(value: unknown) {
  if (value === undefined || value === null || value === '') return null;
  return String(value).trim();
}

function toNumber(value: unknown, fallback = 0) {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
}

function normalizeMovementType(value: unknown) {
  const normalized = String(value || '').trim().toLowerCase();
  return CASH_MOVEMENT_TYPES.includes(normalized as typeof CASH_MOVEMENT_TYPES[number])
    ? normalized
    : null;
}

function sanitizeCashMovement(record: CashMovementRecord | null) {
  if (!record) return null;
  return {
    id: toNumber(record.id),
    type: toNullableString(record.type),
    date: toNullableString(record.date),
    description: toNullableString(record.description),
    person: toNullableString(record.person),
    amount: toNumber(record.amount),
    notes: toNullableString(record.notes),
    created_at: toNullableString(record.created_at),
    updated_at: toNullableString(record.updated_at)
  };
}

router.get('/', authenticate, async (req: RouteRequest, res: JsonResponse) => {
  const db = getDatabaseAccess(req);
  const type = normalizeMovementType(req.query.type);
  const startDate = String(req.query.startDate || '').trim();
  const endDate = String(req.query.endDate || '').trim();

  let query = `
    SELECT *
    FROM cash_movements
    WHERE 1=1
  `;
  const params: string[] = [];

  if (type) {
    query += ' AND type = ?';
    params.push(type);
  }

  if (startDate) {
    query += ' AND date >= ?';
    params.push(startDate);
  }

  if (endDate) {
    query += ' AND date <= ?';
    params.push(endDate);
  }

  query += ' ORDER BY date DESC, id DESC';

  const rows = await db.all(query, params);
  res.json(rows.map((row) => sanitizeCashMovement(row)));
});

router.post('/', authenticate, async (req: RouteRequest, res: JsonResponse) => {
  const db = getDatabaseAccess(req);
  const body = req.body && typeof req.body === 'object' ? req.body as Record<string, unknown> : {};
  const type = normalizeMovementType(body.type);
  const date = String(body.date || '').trim();
  const description = String(body.description || '').trim();
  const person = String(body.person || '').trim();
  const amount = toNumber(body.amount);
  const notes = toNullableString(body.notes);

  if (!type) {
    res.status(400).json({ error: 'Tipo de movimiento invalido.' });
    return;
  }

  if (!date) {
    res.status(400).json({ error: 'La fecha es obligatoria.' });
    return;
  }

  if (!description) {
    res.status(400).json({ error: 'La descripcion es obligatoria.' });
    return;
  }

  if (amount <= 0) {
    res.status(400).json({ error: 'El importe debe ser mayor a cero.' });
    return;
  }

  const result = await db.run(
    `
      INSERT INTO cash_movements (type, date, description, person, amount, notes)
      VALUES (?, ?, ?, ?, ?, ?)
    `,
    [type, date, description, person || null, amount, notes]
  ) as { lastInsertRowid?: number | null };

  await db.save();
  const created = await db.get('SELECT * FROM cash_movements WHERE id = ?', [result.lastInsertRowid]);
  res.status(201).json(sanitizeCashMovement(created));
});

export = router;
