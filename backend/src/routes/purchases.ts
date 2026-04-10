import type { AuthenticatedRequestLike } from '../types/http';

const express = require('express');
const { runLegacyTransaction, getDatabaseAccessForRequest } = require('../services/runtime-db.js');
const { authenticate } = require('../config/auth.js');

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
  transaction: <T>(fn: (tx: DatabaseAccess) => Promise<T>) => Promise<T>;
};

type PurchaseItemPayload = {
  product_id: unknown;
  product_name: string;
  product_code: string;
  quantity: number;
  unit_cost: number;
  unit_price?: number;
};

type PurchasePayload = {
  supplier_id: unknown;
  invoice_type: string;
  invoice_number: string;
  invoice_date: string;
  items: PurchaseItemPayload[];
  notes: string;
};

type SupplierPaymentPayload = {
  supplier_id: string;
  amount: number;
  payment_method: string;
  reference: string;
  notes: string;
};

type SupplierCreditPayload = {
  supplier_id: unknown;
  credit_note_number: string;
  reference_invoice: string;
  invoice_date: string;
  items: PurchaseItemPayload[];
  notes: string;
  update_stock: boolean;
  update_cash: boolean;
};

const router = express.Router();

function getDatabaseAccess(req: RouteRequest): DatabaseAccess {
  return getDatabaseAccessForRequest(req, {
    transactionFallback: async (fn: (tx: DatabaseAccess) => Promise<unknown>) => runLegacyTransaction(fn)
  });
}

function getErrorMessage(error: unknown, fallback: string) {
  if (!error) {
    return fallback;
  }
  if (typeof error === 'string') {
    return error;
  }
  if (typeof error === 'object' && error !== null && 'message' in error && typeof (error as { message?: unknown }).message === 'string') {
    return (error as { message: string }).message;
  }
  return fallback;
}

function toNullableString(value: unknown) {
  if (value === undefined || value === null || value === '') {
    return null;
  }
  return String(value).trim();
}

function toNumber(value: unknown, fallback = 0) {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
}

function sanitizeSupplier(record: Record<string, unknown> | null) {
  if (!record) return null;
  return {
    ...record,
    id: Number(record.id || 0),
    name: String(record.name || ''),
    phone: toNullableString(record.phone),
    email: toNullableString(record.email),
    address: toNullableString(record.address),
    city: toNullableString(record.city),
    tax_id: toNullableString(record.tax_id),
    notes: toNullableString(record.notes),
    balance: record.balance === undefined ? undefined : toNumber(record.balance),
    total_purchases: record.total_purchases === undefined ? undefined : toNumber(record.total_purchases),
    total_credits: record.total_credits === undefined ? undefined : toNumber(record.total_credits),
    total_payments: record.total_payments === undefined ? undefined : toNumber(record.total_payments)
  };
}

function normalizeSupplierPayload(body: unknown) {
  const data = body && typeof body === 'object' ? body as Record<string, unknown> : {};
  return {
    name: String(data.name || '').trim(),
    phone: String(data.phone || ''),
    email: String(data.email || ''),
    address: String(data.address || ''),
    city: String(data.city || ''),
    tax_id: String(data.tax_id || ''),
    notes: String(data.notes || '')
  };
}

function normalizePurchaseItem(item: unknown): PurchaseItemPayload {
  const data = item && typeof item === 'object' ? item as Record<string, unknown> : {};
  return {
    product_id: data.product_id ?? null,
    product_name: String(data.product_name || ''),
    product_code: String(data.product_code || ''),
    quantity: toNumber(data.quantity),
    unit_cost: toNumber(data.unit_cost),
    unit_price: toNumber(data.unit_price)
  };
}

function normalizePurchasePayload(body: unknown): PurchasePayload {
  const data = body && typeof body === 'object' ? body as Record<string, unknown> : {};
  return {
    supplier_id: data.supplier_id ?? null,
    invoice_type: String(data.invoice_type || 'FA').trim() || 'FA',
    invoice_number: String(data.invoice_number || ''),
    invoice_date: String(data.invoice_date || ''),
    items: Array.isArray(data.items) ? data.items.map(normalizePurchaseItem) : [],
    notes: String(data.notes || '')
  };
}

function normalizeSupplierPaymentPayload(body: unknown): SupplierPaymentPayload {
  const data = body && typeof body === 'object' ? body as Record<string, unknown> : {};
  return {
    supplier_id: String(data.supplier_id || '').trim(),
    amount: toNumber(data.amount),
    payment_method: String(data.payment_method || 'cash').trim() || 'cash',
    reference: String(data.reference || ''),
    notes: String(data.notes || '')
  };
}

function normalizeSupplierCreditPayload(body: unknown): SupplierCreditPayload {
  const data = body && typeof body === 'object' ? body as Record<string, unknown> : {};
  return {
    supplier_id: data.supplier_id ?? null,
    credit_note_number: String(data.credit_note_number || ''),
    reference_invoice: String(data.reference_invoice || ''),
    invoice_date: String(data.invoice_date || ''),
    items: Array.isArray(data.items) ? data.items.map(normalizePurchaseItem) : [],
    notes: String(data.notes || ''),
    update_stock: Boolean(data.update_stock),
    update_cash: Boolean(data.update_cash)
  };
}

async function recalculateSupplierAccount(db: DatabaseAccess, supplierId: unknown) {
  if (!supplierId) return;

  const purchases = await db.get('SELECT COALESCE(SUM(total), 0) as total FROM purchases WHERE supplier_id = ?', [supplierId]);
  const credits = await db.get('SELECT COALESCE(SUM(total), 0) as total FROM supplier_credits WHERE supplier_id = ?', [supplierId]);
  const payments = await db.get('SELECT COALESCE(SUM(amount), 0) as total FROM supplier_payments WHERE supplier_id = ?', [supplierId]);
  const balance = Number((purchases && purchases.total) || 0) - Number((credits && credits.total) || 0) - Number((payments && payments.total) || 0);

  const existing = await db.get('SELECT id FROM supplier_account WHERE supplier_id = ?', [supplierId]);
  if (existing) {
    await db.run(
      `
      UPDATE supplier_account
      SET total_purchases = ?, total_credits = ?, total_payments = ?, balance = ?, updated_at = CURRENT_TIMESTAMP
      WHERE supplier_id = ?
    `,
      [Number((purchases && purchases.total) || 0), Number((credits && credits.total) || 0), Number((payments && payments.total) || 0), balance, supplierId]
    );
  } else {
    await db.run(
      `
      INSERT INTO supplier_account (supplier_id, total_purchases, total_credits, total_payments, balance)
      VALUES (?, ?, ?, ?, ?)
    `,
      [supplierId, Number((purchases && purchases.total) || 0), Number((credits && credits.total) || 0), Number((payments && payments.total) || 0), balance]
    );
  }
}

function getPurchaseIvaRate(invoiceType: unknown) {
  return invoiceType === 'FX' ? 0 : 0.21;
}

function normalizePurchaseTotals<T extends Record<string, unknown> | null>(purchase: T) {
  if (!purchase) {
    return purchase;
  }

  if (purchase.invoice_type === 'FX') {
    const subtotal = Number(purchase.subtotal || 0);
    return {
      ...purchase,
      iva: 0,
      total: subtotal
    };
  }

  return purchase;
}

router.get('/suppliers', authenticate, async (req: RouteRequest, res: JsonResponse) => {
  const db = getDatabaseAccess(req);
  const suppliers = (await db.all('SELECT * FROM suppliers ORDER BY name')).map((supplier) => sanitizeSupplier(supplier));
  res.json(suppliers);
});

router.post('/suppliers', authenticate, async (req: RouteRequest, res: JsonResponse) => {
  const db = getDatabaseAccess(req);
  const payload = normalizeSupplierPayload(req.body);

  if (!payload.name) {
    res.status(400).json({ error: 'El nombre es requerido' });
    return;
  }

  try {
    const result = await db.run(
      `
      INSERT INTO suppliers (name, phone, email, address, city, tax_id, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `,
      [
        payload.name,
        toNullableString(payload.phone),
        toNullableString(payload.email),
        toNullableString(payload.address),
        toNullableString(payload.city),
        toNullableString(payload.tax_id),
        toNullableString(payload.notes)
      ]
    );

    await db.save();
    const supplier = await db.get('SELECT * FROM suppliers WHERE id = ?', [result.lastInsertRowid]);
    res.status(201).json(sanitizeSupplier(supplier || { id: result.lastInsertRowid, ...payload }));
  } catch (err) {
    console.error('Create supplier failed:', err);
    res.status(400).json({ error: getErrorMessage(err, 'No se pudo crear el proveedor') });
  }
});

router.put('/suppliers/:id', authenticate, async (req: RouteRequest, res: JsonResponse) => {
  const db = getDatabaseAccess(req);
  const payload = normalizeSupplierPayload(req.body);

  if (!payload.name) {
    res.status(400).json({ error: 'El nombre es requerido' });
    return;
  }

  try {
    await db.run(
      `
      UPDATE suppliers SET name = ?, phone = ?, email = ?, address = ?, city = ?, tax_id = ?, notes = ?
      WHERE id = ?
    `,
      [
        payload.name,
        toNullableString(payload.phone),
        toNullableString(payload.email),
        toNullableString(payload.address),
        toNullableString(payload.city),
        toNullableString(payload.tax_id),
        toNullableString(payload.notes),
        req.params.id
      ]
    );

    await db.save();
    const supplier = await db.get('SELECT * FROM suppliers WHERE id = ?', [req.params.id]);
    res.json(sanitizeSupplier(supplier));
  } catch (err) {
    console.error('Update supplier failed:', err);
    res.status(400).json({ error: getErrorMessage(err, 'No se pudo actualizar el proveedor') });
  }
});

router.delete('/suppliers/:id', authenticate, async (req: RouteRequest, res: JsonResponse) => {
  const db = getDatabaseAccess(req);
  try {
    const supplierId = Number(req.params.id);
    const purchaseCount = await db.get('SELECT COUNT(*) as count FROM purchases WHERE supplier_id = ?', [supplierId]);
    const creditCount = await db.get('SELECT COUNT(*) as count FROM supplier_credits WHERE supplier_id = ?', [supplierId]);
    const paymentCount = await db.get('SELECT COUNT(*) as count FROM supplier_payments WHERE supplier_id = ?', [supplierId]);

    if ((purchaseCount && purchaseCount.count) || (creditCount && creditCount.count) || (paymentCount && paymentCount.count)) {
      res.status(400).json({ error: 'No se puede eliminar un proveedor con movimientos asociados' });
      return;
    }

    await db.run('DELETE FROM suppliers WHERE id = ?', [req.params.id]);
    await db.run('DELETE FROM supplier_account WHERE supplier_id = ?', [req.params.id]);
    await db.save();
    res.json({ success: true });
  } catch (err) {
    console.error('Delete supplier failed:', err);
    res.status(400).json({ error: getErrorMessage(err, 'No se pudo eliminar el proveedor') });
  }
});

router.get('/suppliers/:id', authenticate, async (req: RouteRequest, res: JsonResponse) => {
  const db = getDatabaseAccess(req);
  const supplier = await db.get('SELECT * FROM suppliers WHERE id = ?', [req.params.id]);
  if (!supplier) {
    res.status(404).json({ error: 'Proveedor no encontrado' });
    return;
  }
  res.json(sanitizeSupplier(supplier));
});

router.get('/credits', authenticate, async (req: RouteRequest, res: JsonResponse) => {
  const db = getDatabaseAccess(req);
  const supplier = String(req.query.supplier || '').trim();
  const date_from = String(req.query.date_from || '').trim();
  const date_to = String(req.query.date_to || '').trim();

  let query = `
    SELECT c.*, s.name as supplier_name
    FROM supplier_credits c
    LEFT JOIN suppliers s ON c.supplier_id = s.id
    WHERE 1=1
  `;
  const params: string[] = [];

  if (supplier) {
    query += ' AND c.supplier_id = ?';
    params.push(supplier);
  }

  if (date_from) {
    query += ' AND c.invoice_date >= ?';
    params.push(date_from);
  }

  if (date_to) {
    query += ' AND c.invoice_date <= ?';
    params.push(date_to);
  }

  query += ' ORDER BY c.created_at DESC';

  const credits = await db.all(query, params);
  res.json(credits);
});

router.get('/credits/:id', authenticate, async (req: RouteRequest, res: JsonResponse) => {
  const db = getDatabaseAccess(req);
  const credit = await db.get(
    `
    SELECT c.*, s.name as supplier_name, s.phone as supplier_phone, s.address as supplier_address, s.tax_id as supplier_tax_id
    FROM supplier_credits c
    LEFT JOIN suppliers s ON c.supplier_id = s.id
    WHERE c.id = ?
  `,
    [req.params.id]
  );

  if (!credit) {
    res.status(404).json({ error: 'NC no encontrada' });
    return;
  }

  const items = await db.all('SELECT * FROM supplier_credit_items WHERE credit_id = ?', [req.params.id]);
  credit.items = items;

  res.json(credit);
});

router.post('/credits', authenticate, async (req: RouteRequest, res: JsonResponse) => {
  const db = getDatabaseAccess(req);
  const payload = normalizeSupplierCreditPayload(req.body);

  if (!payload.items || payload.items.length === 0) {
    res.status(400).json({ error: 'Debe agregar al menos un producto' });
    return;
  }

  let subtotal = 0;
  payload.items.forEach((item) => {
    subtotal += item.quantity * toNumber(item.unit_price);
  });

  const iva = subtotal * 0.21;
  const total = subtotal + iva;

  try {
    const credit = await db.transaction(async (tx) => {
      const result = await tx.run(
        `
        INSERT INTO supplier_credits (supplier_id, credit_note_number, reference_invoice, invoice_date, subtotal, iva, total, notes, user_id, status)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'completed')
      `,
        [
          payload.supplier_id,
          toNullableString(payload.credit_note_number),
          toNullableString(payload.reference_invoice),
          toNullableString(payload.invoice_date),
          subtotal,
          iva,
          total,
          toNullableString(payload.notes),
          req.user?.id
        ]
      );

      const credit_id = result.lastInsertRowid;

      for (const item of payload.items) {
        await tx.run(
          `
          INSERT INTO supplier_credit_items (credit_id, product_id, product_name, product_code, quantity, unit_price, subtotal)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `,
          [credit_id, item.product_id || null, item.product_name, item.product_code, item.quantity, item.unit_price, item.quantity * toNumber(item.unit_price)]
        );

        if (payload.update_stock && item.product_id) {
          await tx.run('UPDATE products SET stock = stock - ? WHERE id = ?', [item.quantity, item.product_id]);
        }
      }

      if (payload.supplier_id) {
        let account = await tx.get('SELECT * FROM supplier_account WHERE supplier_id = ?', [payload.supplier_id]);

        if (account) {
          account.balance -= total;
          account.total_credits += total;
          await tx.run(
            `
            UPDATE supplier_account
            SET balance = ?, total_credits = ?, updated_at = CURRENT_TIMESTAMP
            WHERE supplier_id = ?
          `,
            [account.balance, account.total_credits, payload.supplier_id]
          );
        } else {
          account = { balance: -total, total_credits: total };
          await tx.run(
            `
            INSERT INTO supplier_account (supplier_id, balance, total_credits)
            VALUES (?, ?, ?)
          `,
            [payload.supplier_id, account.balance, account.total_credits]
          );
        }

        await tx.run(
          `
          INSERT INTO supplier_account_movements (supplier_id, type, reference_id, reference_number, description, credit, balance)
          VALUES (?, 'credit', ?, ?, ?, ?, ?)
        `,
          [payload.supplier_id, credit_id, payload.credit_note_number, `NC - ${payload.credit_note_number}`, total, account.balance]
        );
      }

      return tx.get('SELECT * FROM supplier_credits WHERE id = ?', [credit_id]);
    });

    await db.save();
    res.status(201).json(credit);
  } catch (err) {
    res.status(400).json({ error: getErrorMessage(err, 'No se pudo crear la nota de credito') });
  }
});

router.delete('/credits/:id', authenticate, async (req: RouteRequest, res: JsonResponse) => {
  const db = getDatabaseAccess(req);
  try {
    const credit = await db.get('SELECT id, supplier_id FROM supplier_credits WHERE id = ?', [req.params.id]);
    if (!credit) {
      res.status(404).json({ error: 'NC no encontrada' });
      return;
    }

    await db.transaction(async (tx) => {
      const items = await tx.all('SELECT * FROM supplier_credit_items WHERE credit_id = ?', [req.params.id]);

      for (const item of items) {
        if (item.product_id) {
          await tx.run('UPDATE products SET stock = stock + ? WHERE id = ?', [item.quantity, item.product_id]);
        }
      }

      await tx.run("DELETE FROM supplier_account_movements WHERE type = 'credit' AND reference_id = ?", [req.params.id]);
      await tx.run('DELETE FROM supplier_credit_items WHERE credit_id = ?', [req.params.id]);
      await tx.run('DELETE FROM supplier_credits WHERE id = ?', [req.params.id]);
      await recalculateSupplierAccount(tx, credit.supplier_id);
    });

    await db.save();
    res.json({ success: true });
  } catch (err) {
    res.status(400).json({ error: getErrorMessage(err, 'No se pudo eliminar la NC') });
  }
});

router.get('/supplier-account', authenticate, async (req: RouteRequest, res: JsonResponse) => {
  const db = getDatabaseAccess(req);
  const suppliers = (
    await db.all(
      `
    SELECT s.*,
      COALESCE(acc.balance, 0) as balance,
      COALESCE(acc.total_purchases, 0) as total_purchases,
      COALESCE(acc.total_credits, 0) as total_credits,
      COALESCE(acc.total_payments, 0) as total_payments
    FROM suppliers s
    LEFT JOIN supplier_account acc ON s.id = acc.supplier_id
    ORDER BY s.name
  `
    )
  ).map((supplier) => sanitizeSupplier(supplier));
  res.json(suppliers);
});

router.get('/supplier-account/:id', authenticate, async (req: RouteRequest, res: JsonResponse) => {
  const db = getDatabaseAccess(req);
  const supplier = await db.get(
    `
    SELECT s.*,
      COALESCE(acc.balance, 0) as balance,
      COALESCE(acc.total_purchases, 0) as total_purchases,
      COALESCE(acc.total_credits, 0) as total_credits,
      COALESCE(acc.total_payments, 0) as total_payments
    FROM suppliers s
    LEFT JOIN supplier_account acc ON s.id = acc.supplier_id
    WHERE s.id = ?
  `,
    [req.params.id]
  );

  if (!supplier) {
    res.status(404).json({ error: 'Proveedor no encontrado' });
    return;
  }

  const movements = await db.all(
    `
    SELECT * FROM supplier_account_movements
    WHERE supplier_id = ?
    ORDER BY created_at DESC
  `,
    [req.params.id]
  );

  res.json({ supplier: sanitizeSupplier(supplier), movements });
});

router.post('/supplier-payments', authenticate, async (req: RouteRequest, res: JsonResponse) => {
  const db = getDatabaseAccess(req);
  const payload = normalizeSupplierPaymentPayload(req.body);

  if (!payload.supplier_id || !payload.amount) {
    res.status(400).json({ error: 'Proveedor y monto son requeridos' });
    return;
  }

  try {
    const balance = await db.transaction(async (tx) => {
      await tx.run(
        `
        INSERT INTO supplier_payments (supplier_id, amount, payment_method, reference, notes, user_id)
        VALUES (?, ?, ?, ?, ?, ?)
      `,
        [
          payload.supplier_id,
          payload.amount,
          payload.payment_method,
          toNullableString(payload.reference),
          toNullableString(payload.notes),
          req.user?.id
        ]
      );

      let account = await tx.get('SELECT * FROM supplier_account WHERE supplier_id = ?', [payload.supplier_id]);

      if (account) {
        account.balance -= payload.amount;
        account.total_payments += payload.amount;
        await tx.run(
          `
          UPDATE supplier_account
          SET balance = ?, total_payments = ?, updated_at = CURRENT_TIMESTAMP
          WHERE supplier_id = ?
        `,
          [account.balance, account.total_payments, payload.supplier_id]
        );
      } else {
        account = { balance: -payload.amount, total_payments: payload.amount };
        await tx.run(
          `
          INSERT INTO supplier_account (supplier_id, balance, total_payments)
          VALUES (?, ?, ?)
        `,
          [payload.supplier_id, account.balance, account.total_payments]
        );
      }

      await tx.run(
        `
        INSERT INTO supplier_account_movements (supplier_id, type, reference_id, description, credit, balance)
        VALUES (?, 'payment', ?, ?, ?, ?)
      `,
        [payload.supplier_id, null, `Pago - ${payload.reference || ''}`, payload.amount, account.balance]
      );

      return account.balance;
    });

    await db.save();
    res.status(201).json({ success: true, balance });
  } catch (err) {
    res.status(400).json({ error: getErrorMessage(err, 'No se pudo registrar el pago') });
  }
});

router.get('/payments', authenticate, async (req: RouteRequest, res: JsonResponse) => {
  const db = getDatabaseAccess(req);
  const supplier = String(req.query.supplier || '').trim();
  const date_from = String(req.query.date_from || '').trim();
  const date_to = String(req.query.date_to || '').trim();

  let query = `
    SELECT p.*, s.name as supplier_name
    FROM supplier_payments p
    LEFT JOIN suppliers s ON p.supplier_id = s.id
    WHERE 1=1
  `;
  const params: string[] = [];

  if (supplier) {
    query += ' AND p.supplier_id = ?';
    params.push(supplier);
  }

  if (date_from) {
    query += ' AND DATE(p.created_at) >= ?';
    params.push(date_from);
  }

  if (date_to) {
    query += ' AND DATE(p.created_at) <= ?';
    params.push(date_to);
  }

  query += ' ORDER BY p.created_at DESC';

  const payments = await db.all(query, params);
  res.json(payments);
});

router.get('/', authenticate, async (req: RouteRequest, res: JsonResponse) => {
  const db = getDatabaseAccess(req);
  const supplier = String(req.query.supplier || '').trim();
  const date_from = String(req.query.date_from || '').trim();
  const date_to = String(req.query.date_to || '').trim();
  const status = String(req.query.status || '').trim();

  let query = `
    SELECT p.*, s.name as supplier_name
    FROM purchases p
    LEFT JOIN suppliers s ON p.supplier_id = s.id
    WHERE 1=1
  `;
  const params: string[] = [];

  if (supplier) {
    query += ' AND p.supplier_id = ?';
    params.push(supplier);
  }

  if (date_from) {
    query += ' AND p.invoice_date >= ?';
    params.push(date_from);
  }

  if (date_to) {
    query += ' AND p.invoice_date <= ?';
    params.push(date_to);
  }

  if (status) {
    query += ' AND p.status = ?';
    params.push(status);
  }

  query += ' ORDER BY p.created_at DESC';

  const purchases = (await db.all(query, params)).map((purchase) => normalizePurchaseTotals(purchase));
  res.json(purchases);
});

router.post('/', authenticate, async (req: RouteRequest, res: JsonResponse) => {
  const db = getDatabaseAccess(req);
  const payload = normalizePurchasePayload(req.body);

  if (!payload.items || payload.items.length === 0) {
    res.status(400).json({ error: 'Debe agregar al menos un producto' });
    return;
  }

  let subtotal = 0;
  payload.items.forEach((item) => {
    subtotal += item.quantity * item.unit_cost;
  });

  const normalizedInvoiceType = payload.invoice_type || 'FA';
  const iva = subtotal * getPurchaseIvaRate(normalizedInvoiceType);
  const total = subtotal + iva;

  try {
    const purchase = await db.transaction(async (tx) => {
      const result = await tx.run(
        `
        INSERT INTO purchases (supplier_id, invoice_type, invoice_number, invoice_date, subtotal, iva, total, notes, user_id, status)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'completed')
      `,
        [
          payload.supplier_id,
          normalizedInvoiceType,
          toNullableString(payload.invoice_number),
          toNullableString(payload.invoice_date),
          subtotal,
          iva,
          total,
          toNullableString(payload.notes),
          req.user?.id
        ]
      );

      const purchase_id = result.lastInsertRowid;

      for (const item of payload.items) {
        await tx.run(
          `
          INSERT INTO purchase_items (purchase_id, product_id, product_name, product_code, quantity, unit_cost, subtotal)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `,
          [purchase_id, item.product_id || null, item.product_name, item.product_code, item.quantity, item.unit_cost, item.quantity * item.unit_cost]
        );

        if (item.product_id) {
          const current = await tx.get('SELECT stock FROM products WHERE id = ?', [item.product_id]);
          if (current) {
            await tx.run('UPDATE products SET stock = stock + ? WHERE id = ?', [item.quantity, item.product_id]);
          }
        }
      }

      if (payload.supplier_id) {
        let account = await tx.get('SELECT * FROM supplier_account WHERE supplier_id = ?', [payload.supplier_id]);

        if (account) {
          account.balance += total;
          account.total_purchases += total;
          await tx.run(
            `
            UPDATE supplier_account
            SET balance = ?, total_purchases = ?, updated_at = CURRENT_TIMESTAMP
            WHERE supplier_id = ?
          `,
            [account.balance, account.total_purchases, payload.supplier_id]
          );
        } else {
          account = { balance: total, total_purchases: total };
          await tx.run(
            `
            INSERT INTO supplier_account (supplier_id, balance, total_purchases)
            VALUES (?, ?, ?)
          `,
            [payload.supplier_id, account.balance, account.total_purchases]
          );
        }

        await tx.run(
          `
          INSERT INTO supplier_account_movements (supplier_id, type, reference_id, reference_number, description, debit, balance)
          VALUES (?, 'purchase', ?, ?, ?, ?, ?)
        `,
          [payload.supplier_id, purchase_id, payload.invoice_number, `${normalizedInvoiceType} - ${payload.invoice_number || ''}`, total, account.balance]
        );
      }

      return tx.get('SELECT * FROM purchases WHERE id = ?', [purchase_id]);
    });

    await db.save();
    res.status(201).json(purchase);
  } catch (err) {
    res.status(400).json({ error: getErrorMessage(err, 'No se pudo registrar la compra') });
  }
});

router.get('/:id', authenticate, async (req: RouteRequest, res: JsonResponse) => {
  const db = getDatabaseAccess(req);
  const purchase = normalizePurchaseTotals(
    await db.get(
      `
    SELECT p.*, s.name as supplier_name, s.phone as supplier_phone, s.address as supplier_address, s.tax_id as supplier_tax_id
    FROM purchases p
    LEFT JOIN suppliers s ON p.supplier_id = s.id
    WHERE p.id = ?
  `,
      [req.params.id]
    )
  );

  if (!purchase) {
    res.status(404).json({ error: 'Compra no encontrada' });
    return;
  }

  const items = await db.all('SELECT * FROM purchase_items WHERE purchase_id = ?', [req.params.id]);
  purchase.items = items;

  res.json(purchase);
});

router.delete('/:id', authenticate, async (req: RouteRequest, res: JsonResponse) => {
  const db = getDatabaseAccess(req);
  try {
    const purchase = await db.get('SELECT id, supplier_id FROM purchases WHERE id = ?', [req.params.id]);
    if (!purchase) {
      res.status(404).json({ error: 'Compra no encontrada' });
      return;
    }

    await db.transaction(async (tx) => {
      const items = await tx.all('SELECT * FROM purchase_items WHERE purchase_id = ?', [req.params.id]);

      for (const item of items) {
        if (item.product_id) {
          const product = await tx.get('SELECT id, name, stock FROM products WHERE id = ?', [item.product_id]);
          if (!product) {
            continue;
          }
          if (product.stock < item.quantity) {
            throw new Error(`No hay stock suficiente para revertir ${product.name}`);
          }
          await tx.run('UPDATE products SET stock = stock - ? WHERE id = ?', [item.quantity, item.product_id]);
        }
      }

      await tx.run("DELETE FROM supplier_account_movements WHERE type = 'purchase' AND reference_id = ?", [req.params.id]);
      await tx.run('DELETE FROM purchase_items WHERE purchase_id = ?', [req.params.id]);
      await tx.run('DELETE FROM purchases WHERE id = ?', [req.params.id]);
      await recalculateSupplierAccount(tx, purchase.supplier_id);
    });

    await db.save();
    res.json({ success: true });
  } catch (err) {
    res.status(400).json({ error: getErrorMessage(err, 'No se pudo eliminar la compra') });
  }
});

export = router;
