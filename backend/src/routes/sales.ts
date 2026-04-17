import type { AuthenticatedRequestLike } from '../types/http';

const express = require('express');
const { runLegacyTransaction, getDatabaseAccessForRequest } = require('../services/runtime-db.js');
const { authenticate } = require('../config/auth.js');
const {
  syncProductSnapshotToWooCommerce,
  syncProductToWooCommerce
} = require('../services/woocommerce-sync.js');
const {
  normalizeInternalSaleStatus,
  updateSaleStatus
} = require('../services/woo-order-sync.js');
const {
  getAvailableVoucherTypes,
  getFiscalValidationMessage
} = require('../services/fiscal-vouchers.js');

type JsonResponse = {
  status: (code: number) => JsonResponse;
  json: (body: unknown) => void;
};

type RouteRequest<TBody = unknown> = AuthenticatedRequestLike<TBody> & {
  params: Record<string, string>;
  query: Record<string, string | string[] | undefined>;
};

type SaleRecord = Record<string, unknown>;
type SaleItemRecord = Record<string, unknown>;

type DatabaseAccess = {
  get: (sql: string, params?: unknown[]) => Promise<any>;
  all: (sql: string, params?: unknown[]) => Promise<any[]>;
  run: (sql: string, params?: unknown[]) => Promise<any>;
  save: () => Promise<void>;
  transaction: <T>(fn: (tx: DatabaseAccess) => Promise<T>) => Promise<T>;
};

const router = express.Router();
const ALLOWED_RECEIPT_TYPES = ['A', 'B', 'C', 'X', 'PRESUPUESTO', 'TICKET', 'REMITO', 'PEDIDO', 'NOTA_CREDITO'];

function getDatabaseAccess(req: RouteRequest): DatabaseAccess {
  return getDatabaseAccessForRequest(req, {
    transactionFallback: async (fn: (tx: DatabaseAccess) => Promise<unknown>) => runLegacyTransaction(fn)
  });
}

function toNullableString(value: unknown) {
  if (value === undefined || value === null || value === '') return null;
  return String(value).trim();
}

function toNumber(value: unknown, fallback = 0) {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
}

function getUniqueProductIds(items: Array<{ product_id: number }>) {
  return [...new Set(items.map((item) => item.product_id))];
}

function normalizeReceiptType(value: unknown) {
  const normalized = String(value || 'C').trim().toUpperCase();
  return ALLOWED_RECEIPT_TYPES.includes(normalized) ? normalized : 'C';
}

function normalizePointOfSale(value: unknown) {
  const digits = String(value || '001').replace(/\D/g, '');
  return (digits || '001').padStart(3, '0').slice(-3);
}

function normalizeSaleItemPayload(item: unknown) {
  const data = item && typeof item === 'object' ? item as Record<string, unknown> : {};
  return {
    product_id: Number(data.product_id),
    quantity: toNumber(data.quantity),
    unit_price: toNumber(data.unit_price)
  };
}

function normalizeSalePayload(body: unknown) {
  const data = body && typeof body === 'object' ? body as Record<string, unknown> : {};
  return {
    customer_id: data.customer_id ?? null,
    customer_tax_condition: toNullableString(data.customer_tax_condition),
    payment_method: String(data.payment_method || 'cash').trim() || 'cash',
    notes: String(data.notes || ''),
    receipt_type: normalizeReceiptType(data.receipt_type),
    point_of_sale: normalizePointOfSale(data.point_of_sale),
    affects_stock: data.affects_stock === false ? false : true,
    items: Array.isArray(data.items) ? data.items.map(normalizeSaleItemPayload) : []
  };
}

function normalizeSaleStatusUpdatePayload(body: unknown) {
  const data = body && typeof body === 'object' ? body as Record<string, unknown> : {};
  return {
    status: String(data.status || '').trim(),
    note: String(data.note || ''),
    sync_to_woo: data.sync_to_woo === false ? false : true
  };
}

function sanitizeSaleItem(record: SaleItemRecord) {
  return {
    ...record,
    id: record.id === undefined ? undefined : toNumber(record.id),
    sale_id: record.sale_id === undefined ? undefined : toNumber(record.sale_id),
    product_id: toNumber(record.product_id),
    product_name: toNullableString(record.product_name),
    sku: toNullableString(record.sku),
    quantity: toNumber(record.quantity),
    unit_price: toNumber(record.unit_price),
    subtotal: record.subtotal === undefined ? undefined : toNumber(record.subtotal)
  };
}

function sanitizeSale(record: SaleRecord | null, items: ReturnType<typeof sanitizeSaleItem>[] = []) {
  if (!record) return null;
  return {
    ...record,
    id: toNumber(record.id),
    customer_id: record.customer_id === undefined || record.customer_id === null ? null : toNumber(record.customer_id),
    customer_name: toNullableString(record.customer_name),
    customer_phone: toNullableString(record.customer_phone),
    user_name: toNullableString(record.user_name),
    receipt_type: toNullableString(record.receipt_type),
    point_of_sale: toNullableString(record.point_of_sale),
    receipt_number: record.receipt_number === undefined || record.receipt_number === null ? null : toNumber(record.receipt_number),
    total: toNumber(record.total),
    payment_method: toNullableString(record.payment_method),
    notes: toNullableString(record.notes),
    channel: toNullableString(record.channel),
    status: toNullableString(record.status),
    payment_status: toNullableString(record.payment_status),
    external_status: toNullableString(record.external_status),
    stock_applied_at: toNullableString(record.stock_applied_at),
    stock_applied_state: toNullableString(record.stock_applied_state),
    stock_reverted_at: toNullableString(record.stock_reverted_at),
    stock_reverted_state: toNullableString(record.stock_reverted_state),
    items
  };
}

async function getNextReceiptNumber(db: DatabaseAccess, receiptType: string, pointOfSale: string) {
  const next = await db.get(
    `
      SELECT COALESCE(MAX(receipt_number), 0) + 1 as next_number
      FROM sales
      WHERE receipt_type = ? AND point_of_sale = ?
    `,
    [receiptType, pointOfSale]
  );

  return next && next.next_number ? Number(next.next_number) : 1;
}

async function syncSnapshotsOrThrow(snapshots: Array<Record<string, unknown>>, action: string) {
  const rollbackSnapshots: Array<Record<string, unknown>> = [];
  const results = [];

  for (const snapshot of snapshots) {
    const result = await syncProductSnapshotToWooCommerce(snapshot, {
      action,
      persistChanges: false
    });

    if (!result.success) {
      const error = new Error(`No se pudo sincronizar ${snapshot.name}: ${result.error}`) as Error & { rollbackSnapshots?: Array<Record<string, unknown>> };
      error.rollbackSnapshots = rollbackSnapshots;
      throw error;
    }

    if (snapshot.previousState) {
      rollbackSnapshots.push(snapshot.previousState as Record<string, unknown>);
    }

    results.push(result);
  }

  return results;
}

async function rollbackWooSnapshots(previousSnapshots: Array<Record<string, unknown>>, action: string) {
  for (const snapshot of previousSnapshots) {
    const result = await syncProductSnapshotToWooCommerce(snapshot, {
      action,
      persistChanges: false,
      retries: 1
    });

    if (!result.success) {
      console.error('[SALES] No se pudo revertir WooCommerce para el producto', snapshot.id, result.error);
    }
  }
}

router.get('/', authenticate, async (req: RouteRequest, res: JsonResponse) => {
  const db = getDatabaseAccess(req);
  const startDate = String(req.query.startDate || '').trim();
  const endDate = String(req.query.endDate || '').trim();
  const customerId = String(req.query.customerId || '').trim();

  let query = `
    SELECT s.*, c.name as customer_name, u.name as user_name
    FROM sales s
    LEFT JOIN customers c ON s.customer_id = c.id
    LEFT JOIN users u ON s.user_id = u.id
    WHERE 1=1
  `;
  const params: string[] = [];

  if (startDate) {
    query += ' AND s.created_at >= ?';
    params.push(startDate);
  }

  if (endDate) {
    query += ' AND s.created_at <= ?';
    params.push(endDate);
  }

  if (customerId) {
    query += ' AND s.customer_id = ?';
    params.push(customerId);
  }

  query += ' ORDER BY s.created_at DESC';

  const sales = await db.all(query, params);
  const salesWithItems = [];

  for (const sale of sales) {
    const items = (await db.all(
      `
        SELECT si.*, p.name as product_name, p.sku
        FROM sale_items si
        JOIN products p ON si.product_id = p.id
        WHERE si.sale_id = ?
      `,
      [sale.id]
    )).map((item) => sanitizeSaleItem(item));

    salesWithItems.push(sanitizeSale(sale, items));
  }

  res.json(salesWithItems);
});

router.get('/today', authenticate, async (req: RouteRequest, res: JsonResponse) => {
  const db = getDatabaseAccess(req);
  const today = new Date().toISOString().split('T')[0];

  const sales = (await db.all(
    `
      SELECT s.*, c.name as customer_name, u.name as user_name
      FROM sales s
      LEFT JOIN customers c ON s.customer_id = c.id
      LEFT JOIN users u ON s.user_id = u.id
      WHERE date(s.created_at) = ?
      ORDER BY s.created_at DESC
    `,
    [today]
  )).map((sale) => sanitizeSale(sale));

  const totalRevenue = await db.get(
    `
      SELECT COALESCE(SUM(total), 0) as total
      FROM sales
      WHERE date(created_at) = ?
    `,
    [today]
  );

  const salesCount = await db.get(
    `
      SELECT COUNT(*) as count
      FROM sales
      WHERE date(created_at) = ?
    `,
    [today]
  );

  res.json({
    sales,
    totalRevenue: toNumber(totalRevenue ? totalRevenue.total : 0),
    salesCount: toNumber(salesCount ? salesCount.count : 0)
  });
});

router.get('/online-feed', authenticate, async (req: RouteRequest, res: JsonResponse) => {
  const db = getDatabaseAccess(req);
  const feed = (await db.all(
    `
      SELECT s.*, c.name as customer_name, u.name as user_name
      FROM sales s
      LEFT JOIN customers c ON s.customer_id = c.id
      LEFT JOIN users u ON s.user_id = u.id
      WHERE lower(COALESCE(s.channel, '')) IN ('woocommerce', 'web')
      ORDER BY s.id DESC
      LIMIT 20
    `
  )).map((sale) => sanitizeSale(sale));

  res.json(feed);
});

router.get('/next-number', authenticate, async (req: RouteRequest, res: JsonResponse) => {
  const db = getDatabaseAccess(req);
  const receiptType = normalizeReceiptType(req.query.receiptType);
  const pointOfSale = normalizePointOfSale(req.query.pointOfSale);
  const nextNumber = await getNextReceiptNumber(db, receiptType, pointOfSale);

  res.json({
    receipt_type: receiptType,
    point_of_sale: pointOfSale,
    receipt_number: nextNumber
  });
});

router.get('/:id', authenticate, async (req: RouteRequest, res: JsonResponse) => {
  const db = getDatabaseAccess(req);
  const sale = await db.get(
    `
      SELECT s.*, c.name as customer_name, c.phone as customer_phone, u.name as user_name
      FROM sales s
      LEFT JOIN customers c ON s.customer_id = c.id
      LEFT JOIN users u ON s.user_id = u.id
      WHERE s.id = ?
    `,
    [req.params.id]
  );

  if (!sale) {
    res.status(404).json({ error: 'Sale not found' });
    return;
  }

  const items = (await db.all(
    `
      SELECT si.*, p.name as product_name, p.sku
      FROM sale_items si
      JOIN products p ON si.product_id = p.id
      WHERE si.sale_id = ?
    `,
    [sale.id]
  )).map((item) => sanitizeSaleItem(item));

  res.json(sanitizeSale(sale, items));
});

router.post('/', authenticate, async (req: RouteRequest, res: JsonResponse) => {
  const db = getDatabaseAccess(req);
  const payload = normalizeSalePayload(req.body);
  const { customer_id, customer_tax_condition, items, payment_method, notes, receipt_type, point_of_sale, affects_stock } = payload;
  const normalizedReceiptType = normalizeReceiptType(receipt_type);
  const isQuote = normalizedReceiptType === 'PRESUPUESTO';
  const isDeliveryNote = normalizedReceiptType === 'REMITO';
  const isOrder = normalizedReceiptType === 'PEDIDO';
  const isCreditNote = normalizedReceiptType === 'NOTA_CREDITO';
  const applyStock = isQuote || isOrder ? false : ((isDeliveryNote || isCreditNote) ? affects_stock !== false : true);

  if (!items || items.length === 0) {
    res.status(400).json({ error: 'No items in sale' });
    return;
  }

  const total = items.reduce((sum, item) => sum + item.quantity * item.unit_price, 0);
  const customerVal = customer_id === undefined ? null : customer_id;
  const paymentVal = payment_method === undefined ? 'cash' : payment_method;
  const notesVal = notes === undefined || notes === '' ? null : notes;
  const receiptType = normalizedReceiptType;
  const pointOfSale = normalizePointOfSale(point_of_sale);
  const settings = await db.get('SELECT emitter_tax_condition FROM settings WHERE id = 1');
  const customer = customerVal ? await db.get('SELECT iva_condition FROM customers WHERE id = ?', [customerVal]) : null;
  const customerTaxCondition = customer_tax_condition || (customer ? customer.iva_condition : 'Consumidor Final');
  const fiscalValidationMessage = getFiscalValidationMessage(settings?.emitter_tax_condition, customerTaxCondition);
  const allowedVoucherTypes = getAvailableVoucherTypes(settings?.emitter_tax_condition, customerTaxCondition);

  if (!isQuote && !isDeliveryNote && !isOrder && !isCreditNote && fiscalValidationMessage) {
    res.status(400).json({ error: fiscalValidationMessage });
    return;
  }

  if (!isQuote && !isDeliveryNote && !isOrder && !isCreditNote && !allowedVoucherTypes.includes(receiptType)) {
    res.status(400).json({ error: 'El tipo de comprobante no es valido para la condicion fiscal actual.' });
    return;
  }

  try {
    const productSnapshotsBeforeSale = new Map<number, Record<string, unknown>>();
    const { sale, syncResults } = await db.transaction(async (tx) => {
      for (const item of items) {
        const product = await tx.get('SELECT id, name, stock FROM products WHERE id = ?', [item.product_id]) as Record<string, unknown> | null;
        if (!product) {
          throw new Error('Product not found');
        }

        if (!Number.isFinite(item.quantity) || item.quantity <= 0) {
          throw new Error('Invalid item quantity');
        }

        if (applyStock && Number(product.stock || 0) < item.quantity) {
          throw new Error(`Insufficient stock for ${product.name}`);
        }

        if (!productSnapshotsBeforeSale.has(item.product_id)) {
          productSnapshotsBeforeSale.set(
            item.product_id,
            await tx.get('SELECT * FROM products WHERE id = ?', [item.product_id]) as Record<string, unknown>
          );
        }
      }

      const receiptNumber = await getNextReceiptNumber(tx, receiptType, pointOfSale);

      const saleResult = await tx.run(
        `
          INSERT INTO sales (
            customer_id, user_id, receipt_type, point_of_sale, receipt_number, total, payment_method, notes,
            stock_applied_at, stock_applied_state
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
        [
          customerVal,
          req.user?.id,
          receiptType,
          pointOfSale,
          receiptNumber,
          total,
          paymentVal,
          notesVal,
          applyStock ? new Date().toISOString() : null,
          applyStock ? 'applied' : 'not_applied'
        ]
      ) as { lastInsertRowid?: number | null };

      const saleId = saleResult.lastInsertRowid;

      for (const item of items) {
        await tx.run(
          `
            INSERT INTO sale_items (sale_id, product_id, quantity, unit_price, subtotal)
            VALUES (?, ?, ?, ?, ?)
          `,
          [saleId, item.product_id, item.quantity, item.unit_price, item.quantity * item.unit_price]
        );

        if (applyStock) {
          const stockDelta = isCreditNote ? item.quantity : -item.quantity;
          await tx.run('UPDATE products SET stock = stock + ? WHERE id = ?', [stockDelta, item.product_id]);
        }
      }

      const snapshotsAfterSale = [];
      if (applyStock) {
        for (const productId of getUniqueProductIds(items)) {
          const currentSnapshot = await tx.get('SELECT * FROM products WHERE id = ?', [productId]);
          snapshotsAfterSale.push({
            ...currentSnapshot,
            previousState: productSnapshotsBeforeSale.get(productId)
          });
        }
      }

      const syncResults = snapshotsAfterSale.length > 0
        ? await syncSnapshotsOrThrow(snapshotsAfterSale, 'sale_sync')
        : [];
      const sale = await tx.get('SELECT * FROM sales WHERE id = ?', [saleId]);

      return { sale, syncResults };
    });

    await db.save();
    res.status(201).json({ sale: sanitizeSale(sale), syncResults });
  } catch (error) {
    const typedError = error as Error & { rollbackSnapshots?: Array<Record<string, unknown>> };
    if (typedError.rollbackSnapshots && typedError.rollbackSnapshots.length > 0) {
      await rollbackWooSnapshots(typedError.rollbackSnapshots, 'sale_sync_rollback');
      await db.save();
    }

    res.status(400).json({ error: typedError.message || 'Sale failed' });
  }
});

router.delete('/:id', authenticate, async (req: RouteRequest, res: JsonResponse) => {
  const db = getDatabaseAccess(req);
  try {
    const sale = await db.get('SELECT id, stock_applied_state FROM sales WHERE id = ?', [req.params.id]);
    if (!sale) {
      res.status(404).json({ error: 'Sale not found' });
      return;
    }
    const shouldRestoreStock = String(sale.stock_applied_state || '') === 'applied';

    const productSnapshotsBeforeDelete = new Map<number, Record<string, unknown>>();
    const { syncResults } = await db.transaction(async (tx) => {
      const items = await tx.all('SELECT product_id, quantity FROM sale_items WHERE sale_id = ?', [req.params.id]) as Array<{ product_id: number; quantity: number }>;

      if (shouldRestoreStock) {
        for (const item of items) {
          if (!productSnapshotsBeforeDelete.has(item.product_id)) {
            productSnapshotsBeforeDelete.set(
              item.product_id,
              await tx.get('SELECT * FROM products WHERE id = ?', [item.product_id]) as Record<string, unknown>
            );
          }
        }
      }

      if (shouldRestoreStock) {
        for (const item of items) {
          await tx.run('UPDATE products SET stock = stock + ? WHERE id = ?', [item.quantity, item.product_id]);
        }
      }

      await tx.run('DELETE FROM sale_items WHERE sale_id = ?', [req.params.id]);
      await tx.run('DELETE FROM sales WHERE id = ?', [req.params.id]);

      const snapshotsAfterDelete = [];
      if (shouldRestoreStock) {
        for (const productId of getUniqueProductIds(items)) {
          const currentSnapshot = await tx.get('SELECT * FROM products WHERE id = ?', [productId]);
          snapshotsAfterDelete.push({
            ...currentSnapshot,
            previousState: productSnapshotsBeforeDelete.get(productId)
          });
        }
      }

      const syncResults = snapshotsAfterDelete.length > 0
        ? await syncSnapshotsOrThrow(snapshotsAfterDelete, 'sale_delete_sync')
        : [];
      return { syncResults };
    });

    await db.save();
    res.json({ success: true, syncResults });
  } catch (error) {
    const typedError = error as Error & { rollbackSnapshots?: Array<Record<string, unknown>> };
    if (typedError.rollbackSnapshots && typedError.rollbackSnapshots.length > 0) {
      await rollbackWooSnapshots(typedError.rollbackSnapshots, 'sale_delete_sync_rollback');
      await db.save();
    }

    res.status(400).json({ error: typedError.message || 'Sale delete failed' });
  }
});

router.post('/test-sync/:id', authenticate, async (req: RouteRequest, res: JsonResponse) => {
  try {
    const result = await syncProductToWooCommerce(req.params.id, {
      action: 'manual_test_sync'
    });
    res.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown sync error';
    res.status(500).json({ error: message });
  }
});

router.put('/:id/status', authenticate, async (req: RouteRequest, res: JsonResponse) => {
  const payload = normalizeSaleStatusUpdatePayload(req.body || {});
  const normalizedStatus = normalizeInternalSaleStatus(payload.status);
  const allowedStatuses = ['pending_payment', 'paid', 'ready_for_delivery', 'completed', 'on_hold', 'cancelled', 'refunded', 'payment_failed'];

  if (!allowedStatuses.includes(normalizedStatus)) {
    res.status(400).json({ error: 'Invalid sale status' });
    return;
  }

  try {
    const result = await updateSaleStatus(req.params.id, normalizedStatus, {
      note: payload.note || '',
      syncToWoo: payload.sync_to_woo !== false
    });
    res.json({
      ...result,
      sale: result.sale ? sanitizeSale(result.sale) : result.sale
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Sale status update failed';
    res.status(400).json({ error: message || 'Sale status update failed' });
  }
});

export = router;
