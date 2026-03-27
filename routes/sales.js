const express = require('express');
const { get, run, all, transaction, saveDatabase } = require('../database');
const { authenticate } = require('../auth');
const {
  syncProductSnapshotToWooCommerce,
  syncProductToWooCommerce
} = require('../services/woocommerce-sync');

const router = express.Router();
const ALLOWED_RECEIPT_TYPES = ['A', 'B', 'C', 'X', 'PRESUPUESTO', 'TICKET'];

function getUniqueProductIds(items) {
  return [...new Set(items.map((item) => item.product_id))];
}

function normalizeReceiptType(value) {
  const normalized = String(value || 'C').trim().toUpperCase();
  return ALLOWED_RECEIPT_TYPES.includes(normalized) ? normalized : 'C';
}

function normalizePointOfSale(value) {
  const digits = String(value || '001').replace(/\D/g, '');
  return (digits || '001').padStart(3, '0').slice(-3);
}

function getNextReceiptNumber(receiptType, pointOfSale) {
  const next = get(
    `
      SELECT COALESCE(MAX(receipt_number), 0) + 1 as next_number
      FROM sales
      WHERE receipt_type = ? AND point_of_sale = ?
    `,
    [receiptType, pointOfSale]
  );

  return next && next.next_number ? Number(next.next_number) : 1;
}

async function syncSnapshotsOrThrow(snapshots, action) {
  const rollbackSnapshots = [];
  const results = [];

  for (const snapshot of snapshots) {
    const result = await syncProductSnapshotToWooCommerce(snapshot, {
      action,
      persistChanges: false
    });

    if (!result.success) {
      const error = new Error(`No se pudo sincronizar ${snapshot.name}: ${result.error}`);
      error.rollbackSnapshots = rollbackSnapshots;
      throw error;
    }

    if (snapshot.previousState) {
      rollbackSnapshots.push(snapshot.previousState);
    }

    results.push(result);
  }

  return results;
}

async function rollbackWooSnapshots(previousSnapshots, action) {
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

router.get('/', authenticate, (req, res) => {
  const { startDate, endDate, customerId } = req.query;

  let query = `
    SELECT s.*, c.name as customer_name, u.name as user_name
    FROM sales s
    LEFT JOIN customers c ON s.customer_id = c.id
    LEFT JOIN users u ON s.user_id = u.id
    WHERE 1=1
  `;
  const params = [];

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

  const sales = all(query, params);

  const salesWithItems = sales.map((sale) => {
    const items = all(
      `
        SELECT si.*, p.name as product_name, p.sku
        FROM sale_items si
        JOIN products p ON si.product_id = p.id
        WHERE si.sale_id = ?
      `,
      [sale.id]
    );

    return { ...sale, items };
  });

  res.json(salesWithItems);
});

router.get('/today', authenticate, (req, res) => {
  const today = new Date().toISOString().split('T')[0];

  const sales = all(
    `
      SELECT s.*, c.name as customer_name, u.name as user_name
      FROM sales s
      LEFT JOIN customers c ON s.customer_id = c.id
      LEFT JOIN users u ON s.user_id = u.id
      WHERE date(s.created_at) = ?
      ORDER BY s.created_at DESC
    `,
    [today]
  );

  const totalRevenue = get(
    `
      SELECT COALESCE(SUM(total), 0) as total
      FROM sales
      WHERE date(created_at) = ?
    `,
    [today]
  );

  const salesCount = get(
    `
      SELECT COUNT(*) as count
      FROM sales
      WHERE date(created_at) = ?
    `,
    [today]
  );

  res.json({
    sales,
    totalRevenue: totalRevenue.total,
    salesCount: salesCount.count
  });
});

router.get('/next-number', authenticate, (req, res) => {
  const receiptType = normalizeReceiptType(req.query.receiptType);
  const pointOfSale = normalizePointOfSale(req.query.pointOfSale);
  const nextNumber = getNextReceiptNumber(receiptType, pointOfSale);

  res.json({
    receipt_type: receiptType,
    point_of_sale: pointOfSale,
    receipt_number: nextNumber
  });
});

router.get('/:id', authenticate, (req, res) => {
  const sale = get(
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
    return res.status(404).json({ error: 'Sale not found' });
  }

  const items = all(
    `
      SELECT si.*, p.name as product_name, p.sku
      FROM sale_items si
      JOIN products p ON si.product_id = p.id
      WHERE si.sale_id = ?
    `,
    [sale.id]
  );

  res.json({ ...sale, items });
});

router.post('/', authenticate, async (req, res) => {
  const { customer_id, items, payment_method, notes, receipt_type, point_of_sale } = req.body;

  if (!items || items.length === 0) {
    return res.status(400).json({ error: 'No items in sale' });
  }

  const total = items.reduce((sum, item) => sum + item.quantity * item.unit_price, 0);
  const customerVal = customer_id === undefined ? null : customer_id;
  const paymentVal = payment_method === undefined ? 'cash' : payment_method;
  const notesVal = notes === undefined ? null : notes;
  const receiptType = normalizeReceiptType(receipt_type);
  const pointOfSale = normalizePointOfSale(point_of_sale);

  try {
    const productSnapshotsBeforeSale = new Map();
    const createSale = transaction(async () => {
      items.forEach((item) => {
        const product = get('SELECT id, name, stock FROM products WHERE id = ?', [item.product_id]);
        if (!product) {
          throw new Error('Product not found');
        }

        if (!Number.isFinite(item.quantity) || item.quantity <= 0) {
          throw new Error('Invalid item quantity');
        }

        if (product.stock < item.quantity) {
          throw new Error(`Insufficient stock for ${product.name}`);
        }

        if (!productSnapshotsBeforeSale.has(item.product_id)) {
          productSnapshotsBeforeSale.set(
            item.product_id,
            get('SELECT * FROM products WHERE id = ?', [item.product_id])
          );
        }
      });

      const receiptNumber = getNextReceiptNumber(receiptType, pointOfSale);

      const saleResult = run(
        `
          INSERT INTO sales (customer_id, user_id, receipt_type, point_of_sale, receipt_number, total, payment_method, notes)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `,
        [customerVal, req.user.id, receiptType, pointOfSale, receiptNumber, total, paymentVal, notesVal]
      );

      const saleId = saleResult.lastInsertRowid;

      items.forEach((item) => {
        run(
          `
            INSERT INTO sale_items (sale_id, product_id, quantity, unit_price, subtotal)
            VALUES (?, ?, ?, ?, ?)
          `,
          [saleId, item.product_id, item.quantity, item.unit_price, item.quantity * item.unit_price]
        );

        run('UPDATE products SET stock = stock - ? WHERE id = ?', [item.quantity, item.product_id]);
      });

      const snapshotsAfterSale = getUniqueProductIds(items).map((productId) => {
        const currentSnapshot = get('SELECT * FROM products WHERE id = ?', [productId]);
        return {
          ...currentSnapshot,
          previousState: productSnapshotsBeforeSale.get(productId)
        };
      });

      const syncResults = await syncSnapshotsOrThrow(snapshotsAfterSale, 'sale_sync');
      const sale = get('SELECT * FROM sales WHERE id = ?', [saleId]);

      return { sale, syncResults };
    });

    const { sale, syncResults } = await createSale();
    saveDatabase();

    res.status(201).json({ sale, syncResults });
  } catch (err) {
    if (err.rollbackSnapshots && err.rollbackSnapshots.length > 0) {
      await rollbackWooSnapshots(err.rollbackSnapshots, 'sale_sync_rollback');
      saveDatabase();
    }

    res.status(400).json({ error: err.message || 'Sale failed' });
  }
});

router.delete('/:id', authenticate, async (req, res) => {
  try {
    const sale = get('SELECT id FROM sales WHERE id = ?', [req.params.id]);
    if (!sale) {
      return res.status(404).json({ error: 'Sale not found' });
    }

    const productSnapshotsBeforeDelete = new Map();
    const deleteSale = transaction(async () => {
      const items = all('SELECT product_id, quantity FROM sale_items WHERE sale_id = ?', [req.params.id]);

      items.forEach((item) => {
        if (!productSnapshotsBeforeDelete.has(item.product_id)) {
          productSnapshotsBeforeDelete.set(
            item.product_id,
            get('SELECT * FROM products WHERE id = ?', [item.product_id])
          );
        }
      });

      items.forEach((item) => {
        run('UPDATE products SET stock = stock + ? WHERE id = ?', [item.quantity, item.product_id]);
      });

      run('DELETE FROM sale_items WHERE sale_id = ?', [req.params.id]);
      run('DELETE FROM sales WHERE id = ?', [req.params.id]);

      const snapshotsAfterDelete = getUniqueProductIds(items).map((productId) => {
        const currentSnapshot = get('SELECT * FROM products WHERE id = ?', [productId]);
        return {
          ...currentSnapshot,
          previousState: productSnapshotsBeforeDelete.get(productId)
        };
      });

      const syncResults = await syncSnapshotsOrThrow(snapshotsAfterDelete, 'sale_delete_sync');
      return { syncResults };
    });

    const { syncResults } = await deleteSale();
    saveDatabase();

    res.json({ success: true, syncResults });
  } catch (err) {
    if (err.rollbackSnapshots && err.rollbackSnapshots.length > 0) {
      await rollbackWooSnapshots(err.rollbackSnapshots, 'sale_delete_sync_rollback');
      saveDatabase();
    }

    res.status(400).json({ error: err.message || 'Sale delete failed' });
  }
});

router.post('/test-sync/:id', authenticate, async (req, res) => {
  try {
    const result = await syncProductToWooCommerce(req.params.id, {
      action: 'manual_test_sync'
    });
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
