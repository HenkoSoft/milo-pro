const express = require('express');
const { get, run, all, saveDatabase, transaction } = require('../database');
const { authenticate } = require('../auth');

const router = express.Router();

function getErrorMessage(error, fallback) {
  if (!error) {
    return fallback;
  }
  if (typeof error === 'string') {
    return error;
  }
  if (error.message) {
    return error.message;
  }
  return fallback;
}

function toNullableString(value) {
  if (value === undefined || value === null || value === '') {
    return null;
  }
  return String(value).trim();
}

function toNumber(value, fallback = 0) {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
}

function toNumberOrNull(value) {
  if (value === undefined || value === null || value === '') {
    return null;
  }
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

function sanitizeSupplier(record) {
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

function normalizeSupplierPayload(body) {
  const data = body && typeof body === 'object' ? body : {};
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

function normalizePurchaseItem(item) {
  const data = item && typeof item === 'object' ? item : {};
  return {
    product_id: data.product_id ?? null,
    product_name: String(data.product_name || ''),
    product_code: String(data.product_code || ''),
    quantity: toNumber(data.quantity),
    unit_cost: toNumber(data.unit_cost),
    unit_price: toNumber(data.unit_price)
  };
}

function normalizePurchasePayload(body) {
  const data = body && typeof body === 'object' ? body : {};
  return {
    supplier_id: data.supplier_id ?? null,
    invoice_type: String(data.invoice_type || 'FA').trim() || 'FA',
    invoice_number: String(data.invoice_number || ''),
    invoice_date: String(data.invoice_date || ''),
    items: Array.isArray(data.items) ? data.items.map(normalizePurchaseItem) : [],
    notes: String(data.notes || '')
  };
}

function normalizeSupplierPaymentPayload(body) {
  const data = body && typeof body === 'object' ? body : {};
  return {
    supplier_id: String(data.supplier_id || '').trim(),
    amount: toNumber(data.amount),
    payment_method: String(data.payment_method || 'cash').trim() || 'cash',
    reference: String(data.reference || ''),
    notes: String(data.notes || '')
  };
}

function normalizeSupplierCreditPayload(body) {
  const data = body && typeof body === 'object' ? body : {};
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

function recalculateSupplierAccount(supplierId) {
  if (!supplierId) return;

  const purchases = get('SELECT COALESCE(SUM(total), 0) as total FROM purchases WHERE supplier_id = ?', [supplierId]).total;
  const credits = get('SELECT COALESCE(SUM(total), 0) as total FROM supplier_credits WHERE supplier_id = ?', [supplierId]).total;
  const payments = get('SELECT COALESCE(SUM(amount), 0) as total FROM supplier_payments WHERE supplier_id = ?', [supplierId]).total;
  const balance = purchases - credits - payments;

  const existing = get('SELECT id FROM supplier_account WHERE supplier_id = ?', [supplierId]);
  if (existing) {
    run(`
      UPDATE supplier_account
      SET total_purchases = ?, total_credits = ?, total_payments = ?, balance = ?, updated_at = CURRENT_TIMESTAMP
      WHERE supplier_id = ?
    `, [purchases, credits, payments, balance, supplierId]);
  } else {
    run(`
      INSERT INTO supplier_account (supplier_id, total_purchases, total_credits, total_payments, balance)
      VALUES (?, ?, ?, ?, ?)
    `, [supplierId, purchases, credits, payments, balance]);
  }
}

function getPurchaseIvaRate(invoiceType) {
  return invoiceType === 'FX' ? 0 : 0.21;
}

function normalizePurchaseTotals(purchase) {
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

router.get('/suppliers', authenticate, (req, res) => {
  const suppliers = all('SELECT * FROM suppliers ORDER BY name').map((supplier) => sanitizeSupplier(supplier));
  res.json(suppliers);
});

router.post('/suppliers', authenticate, (req, res) => {
  const payload = normalizeSupplierPayload(req.body);

  if (!payload.name) {
    return res.status(400).json({ error: 'El nombre es requerido' });
  }

  try {
    const result = run(`
      INSERT INTO suppliers (name, phone, email, address, city, tax_id, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [
      payload.name,
      toNullableString(payload.phone),
      toNullableString(payload.email),
      toNullableString(payload.address),
      toNullableString(payload.city),
      toNullableString(payload.tax_id),
      toNullableString(payload.notes)
    ]);

    saveDatabase();
    const supplier = get('SELECT * FROM suppliers WHERE id = ?', [result.lastInsertRowid]);
    res.status(201).json(sanitizeSupplier(supplier || { id: result.lastInsertRowid, ...payload }));
  } catch (err) {
    console.error('Create supplier failed:', err);
    res.status(400).json({ error: getErrorMessage(err, 'No se pudo crear el proveedor') });
  }
});

router.put('/suppliers/:id', authenticate, (req, res) => {
  const payload = normalizeSupplierPayload(req.body);

  if (!payload.name) {
    return res.status(400).json({ error: 'El nombre es requerido' });
  }

  try {
    run(`
      UPDATE suppliers SET name = ?, phone = ?, email = ?, address = ?, city = ?, tax_id = ?, notes = ?
      WHERE id = ?
    `, [
      payload.name,
      toNullableString(payload.phone),
      toNullableString(payload.email),
      toNullableString(payload.address),
      toNullableString(payload.city),
      toNullableString(payload.tax_id),
      toNullableString(payload.notes),
      req.params.id
    ]);

    saveDatabase();
    const supplier = get('SELECT * FROM suppliers WHERE id = ?', [req.params.id]);
    res.json(sanitizeSupplier(supplier));
  } catch (err) {
    console.error('Update supplier failed:', err);
    res.status(400).json({ error: getErrorMessage(err, 'No se pudo actualizar el proveedor') });
  }
});

router.delete('/suppliers/:id', authenticate, (req, res) => {
  try {
    const supplierId = Number(req.params.id);
    const purchaseCount = get('SELECT COUNT(*) as count FROM purchases WHERE supplier_id = ?', [supplierId]).count;
    const creditCount = get('SELECT COUNT(*) as count FROM supplier_credits WHERE supplier_id = ?', [supplierId]).count;
    const paymentCount = get('SELECT COUNT(*) as count FROM supplier_payments WHERE supplier_id = ?', [supplierId]).count;

    if (purchaseCount || creditCount || paymentCount) {
      return res.status(400).json({ error: 'No se puede eliminar un proveedor con movimientos asociados' });
    }

    run('DELETE FROM suppliers WHERE id = ?', [req.params.id]);
    run('DELETE FROM supplier_account WHERE supplier_id = ?', [req.params.id]);
    saveDatabase();
    res.json({ success: true });
  } catch (err) {
    console.error('Delete supplier failed:', err);
    res.status(400).json({ error: getErrorMessage(err, 'No se pudo eliminar el proveedor') });
  }
});

router.get('/suppliers/:id', authenticate, (req, res) => {
  const supplier = get('SELECT * FROM suppliers WHERE id = ?', [req.params.id]);
  if (!supplier) return res.status(404).json({ error: 'Proveedor no encontrado' });
  res.json(sanitizeSupplier(supplier));
});

router.get('/credits', authenticate, (req, res) => {
  const supplier = String(req.query.supplier || '').trim();
  const date_from = String(req.query.date_from || '').trim();
  const date_to = String(req.query.date_to || '').trim();

  let query = `
    SELECT c.*, s.name as supplier_name
    FROM supplier_credits c
    LEFT JOIN suppliers s ON c.supplier_id = s.id
    WHERE 1=1
  `;
  const params = [];

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

  const credits = all(query, params);
  res.json(credits);
});

router.get('/credits/:id', authenticate, (req, res) => {
  const credit = get(`
    SELECT c.*, s.name as supplier_name, s.phone as supplier_phone, s.address as supplier_address, s.tax_id as supplier_tax_id
    FROM supplier_credits c
    LEFT JOIN suppliers s ON c.supplier_id = s.id
    WHERE c.id = ?
  `, [req.params.id]);

  if (!credit) return res.status(404).json({ error: 'NC no encontrada' });

  const items = all('SELECT * FROM supplier_credit_items WHERE credit_id = ?', [req.params.id]);
  credit.items = items;

  res.json(credit);
});

router.post('/credits', authenticate, (req, res) => {
  const payload = normalizeSupplierCreditPayload(req.body);

  if (!payload.items || payload.items.length === 0) {
    return res.status(400).json({ error: 'Debe agregar al menos un producto' });
  }

  let subtotal = 0;
  payload.items.forEach((item) => {
    subtotal += item.quantity * item.unit_price;
  });

  const iva = subtotal * 0.21;
  const total = subtotal + iva;

  try {
    const result = run(`
      INSERT INTO supplier_credits (supplier_id, credit_note_number, reference_invoice, invoice_date, subtotal, iva, total, notes, user_id, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'completed')
    `, [
      payload.supplier_id,
      toNullableString(payload.credit_note_number),
      toNullableString(payload.reference_invoice),
      toNullableString(payload.invoice_date),
      subtotal,
      iva,
      total,
      toNullableString(payload.notes),
      req.user.id
    ]);

    const credit_id = result.lastInsertRowid;

    payload.items.forEach((item) => {
      run(`
        INSERT INTO supplier_credit_items (credit_id, product_id, product_name, product_code, quantity, unit_price, subtotal)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `, [credit_id, item.product_id || null, item.product_name, item.product_code, item.quantity, item.unit_price, item.quantity * item.unit_price]);

      if (payload.update_stock && item.product_id) {
        run('UPDATE products SET stock = stock - ? WHERE id = ?', [item.quantity, item.product_id]);
      }
    });

    if (payload.supplier_id) {
      let account = get('SELECT * FROM supplier_account WHERE supplier_id = ?', [payload.supplier_id]);

      if (account) {
        account.balance -= total;
        account.total_credits += total;
        run(`
          UPDATE supplier_account
          SET balance = ?, total_credits = ?, updated_at = CURRENT_TIMESTAMP
          WHERE supplier_id = ?
        `, [account.balance, account.total_credits, payload.supplier_id]);
      } else {
        account = { balance: -total, total_credits: total };
        run(`
          INSERT INTO supplier_account (supplier_id, balance, total_credits)
          VALUES (?, ?, ?)
        `, [payload.supplier_id, account.balance, account.total_credits]);
      }

      run(`
        INSERT INTO supplier_account_movements (supplier_id, type, reference_id, reference_number, description, credit, balance)
        VALUES (?, 'credit', ?, ?, ?, ?, ?)
      `, [payload.supplier_id, credit_id, payload.credit_note_number, `NC - ${payload.credit_note_number}`, total, account.balance]);
    }

    saveDatabase();

    const credit = get('SELECT * FROM supplier_credits WHERE id = ?', [credit_id]);
    res.status(201).json(credit);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.delete('/credits/:id', authenticate, (req, res) => {
  try {
    const credit = get('SELECT id, supplier_id FROM supplier_credits WHERE id = ?', [req.params.id]);
    if (!credit) {
      return res.status(404).json({ error: 'NC no encontrada' });
    }

    transaction(() => {
      const items = all('SELECT * FROM supplier_credit_items WHERE credit_id = ?', [req.params.id]);

      items.forEach(item => {
        if (item.product_id) {
          run('UPDATE products SET stock = stock + ? WHERE id = ?', [item.quantity, item.product_id]);
        }
      });

      run("DELETE FROM supplier_account_movements WHERE type = 'credit' AND reference_id = ?", [req.params.id]);
      run('DELETE FROM supplier_credit_items WHERE credit_id = ?', [req.params.id]);
      run('DELETE FROM supplier_credits WHERE id = ?', [req.params.id]);
      recalculateSupplierAccount(credit.supplier_id);
    })();

    saveDatabase();
    res.json({ success: true });
  } catch (err) {
    res.status(400).json({ error: err.message || 'No se pudo eliminar la NC' });
  }
});

router.get('/supplier-account', authenticate, (req, res) => {
  const suppliers = all(`
    SELECT s.*,
      COALESCE(acc.balance, 0) as balance,
      COALESCE(acc.total_purchases, 0) as total_purchases,
      COALESCE(acc.total_credits, 0) as total_credits,
      COALESCE(acc.total_payments, 0) as total_payments
    FROM suppliers s
    LEFT JOIN supplier_account acc ON s.id = acc.supplier_id
    ORDER BY s.name
  `).map((supplier) => sanitizeSupplier(supplier));
  res.json(suppliers);
});

router.get('/supplier-account/:id', authenticate, (req, res) => {
  const supplier = get(`
    SELECT s.*,
      COALESCE(acc.balance, 0) as balance,
      COALESCE(acc.total_purchases, 0) as total_purchases,
      COALESCE(acc.total_credits, 0) as total_credits,
      COALESCE(acc.total_payments, 0) as total_payments
    FROM suppliers s
    LEFT JOIN supplier_account acc ON s.id = acc.supplier_id
    WHERE s.id = ?
  `, [req.params.id]);

  if (!supplier) return res.status(404).json({ error: 'Proveedor no encontrado' });

  const movements = all(`
    SELECT * FROM supplier_account_movements
    WHERE supplier_id = ?
    ORDER BY created_at DESC
  `, [req.params.id]);

  res.json({ supplier: sanitizeSupplier(supplier), movements });
});

router.post('/supplier-payments', authenticate, (req, res) => {
  const payload = normalizeSupplierPaymentPayload(req.body);

  if (!payload.supplier_id || !payload.amount) {
    return res.status(400).json({ error: 'Proveedor y monto son requeridos' });
  }

  try {
    run(`
      INSERT INTO supplier_payments (supplier_id, amount, payment_method, reference, notes, user_id)
      VALUES (?, ?, ?, ?, ?, ?)
    `, [
      payload.supplier_id,
      payload.amount,
      payload.payment_method,
      toNullableString(payload.reference),
      toNullableString(payload.notes),
      req.user.id
    ]);

    let account = get('SELECT * FROM supplier_account WHERE supplier_id = ?', [payload.supplier_id]);

    if (account) {
      account.balance -= payload.amount;
      account.total_payments += payload.amount;
      run(`
        UPDATE supplier_account
        SET balance = ?, total_payments = ?, updated_at = CURRENT_TIMESTAMP
        WHERE supplier_id = ?
      `, [account.balance, account.total_payments, payload.supplier_id]);
    } else {
      account = { balance: -payload.amount, total_payments: payload.amount };
      run(`
        INSERT INTO supplier_account (supplier_id, balance, total_payments)
        VALUES (?, ?, ?)
      `, [payload.supplier_id, account.balance, account.total_payments]);
    }

    run(`
      INSERT INTO supplier_account_movements (supplier_id, type, reference_id, description, credit, balance)
      VALUES (?, 'payment', ?, ?, ?, ?)
    `, [payload.supplier_id, null, `Pago - ${payload.reference || ''}`, payload.amount, account.balance]);

    saveDatabase();

    res.status(201).json({ success: true, balance: account.balance });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.get('/payments', authenticate, (req, res) => {
  const supplier = String(req.query.supplier || '').trim();
  const date_from = String(req.query.date_from || '').trim();
  const date_to = String(req.query.date_to || '').trim();

  let query = `
    SELECT p.*, s.name as supplier_name
    FROM supplier_payments p
    LEFT JOIN suppliers s ON p.supplier_id = s.id
    WHERE 1=1
  `;
  const params = [];

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

  const payments = all(query, params);
  res.json(payments);
});

router.get('/', authenticate, (req, res) => {
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
  const params = [];

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

  const purchases = all(query, params).map(normalizePurchaseTotals);
  res.json(purchases);
});

router.post('/', authenticate, (req, res) => {
  const payload = normalizePurchasePayload(req.body);

  if (!payload.items || payload.items.length === 0) {
    return res.status(400).json({ error: 'Debe agregar al menos un producto' });
  }

  let subtotal = 0;
  payload.items.forEach((item) => {
    subtotal += item.quantity * item.unit_cost;
  });

  const normalizedInvoiceType = payload.invoice_type || 'FA';
  const iva = subtotal * getPurchaseIvaRate(normalizedInvoiceType);
  const total = subtotal + iva;

  try {
    const result = run(`
      INSERT INTO purchases (supplier_id, invoice_type, invoice_number, invoice_date, subtotal, iva, total, notes, user_id, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'completed')
    `, [
      payload.supplier_id,
      normalizedInvoiceType,
      toNullableString(payload.invoice_number),
      toNullableString(payload.invoice_date),
      subtotal,
      iva,
      total,
      toNullableString(payload.notes),
      req.user.id
    ]);

    const purchase_id = result.lastInsertRowid;

    payload.items.forEach((item) => {
      run(`
        INSERT INTO purchase_items (purchase_id, product_id, product_name, product_code, quantity, unit_cost, subtotal)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `, [purchase_id, item.product_id || null, item.product_name, item.product_code, item.quantity, item.unit_cost, item.quantity * item.unit_cost]);

      if (item.product_id) {
        const current = get('SELECT stock FROM products WHERE id = ?', [item.product_id]);
        if (current) {
          run('UPDATE products SET stock = stock + ? WHERE id = ?', [item.quantity, item.product_id]);
        }
      }
    });

    if (payload.supplier_id) {
      let account = get('SELECT * FROM supplier_account WHERE supplier_id = ?', [payload.supplier_id]);

      if (account) {
        account.balance += total;
        account.total_purchases += total;
        run(`
          UPDATE supplier_account
          SET balance = ?, total_purchases = ?, updated_at = CURRENT_TIMESTAMP
          WHERE supplier_id = ?
        `, [account.balance, account.total_purchases, payload.supplier_id]);
      } else {
        account = { balance: total, total_purchases: total };
        run(`
          INSERT INTO supplier_account (supplier_id, balance, total_purchases)
          VALUES (?, ?, ?)
        `, [payload.supplier_id, account.balance, account.total_purchases]);
      }

      run(`
        INSERT INTO supplier_account_movements (supplier_id, type, reference_id, reference_number, description, debit, balance)
        VALUES (?, 'purchase', ?, ?, ?, ?, ?)
      `, [payload.supplier_id, purchase_id, payload.invoice_number, `${normalizedInvoiceType} - ${payload.invoice_number || ''}`, total, account.balance]);
    }

    saveDatabase();

    const purchase = get('SELECT * FROM purchases WHERE id = ?', [purchase_id]);
    res.status(201).json(purchase);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.get('/:id', authenticate, (req, res) => {
  const purchase = normalizePurchaseTotals(get(`
    SELECT p.*, s.name as supplier_name, s.phone as supplier_phone, s.address as supplier_address, s.tax_id as supplier_tax_id
    FROM purchases p
    LEFT JOIN suppliers s ON p.supplier_id = s.id
    WHERE p.id = ?
  `, [req.params.id]));

  if (!purchase) return res.status(404).json({ error: 'Compra no encontrada' });

  const items = all('SELECT * FROM purchase_items WHERE purchase_id = ?', [req.params.id]);
  purchase.items = items;

  res.json(purchase);
});

router.delete('/:id', authenticate, (req, res) => {
  try {
    const purchase = get('SELECT id, supplier_id FROM purchases WHERE id = ?', [req.params.id]);
    if (!purchase) {
      return res.status(404).json({ error: 'Compra no encontrada' });
    }

    transaction(() => {
      const items = all('SELECT * FROM purchase_items WHERE purchase_id = ?', [req.params.id]);

      items.forEach(item => {
        if (item.product_id) {
          const product = get('SELECT id, name, stock FROM products WHERE id = ?', [item.product_id]);
          if (!product) {
            return;
          }
          if (product.stock < item.quantity) {
            throw new Error(`No hay stock suficiente para revertir ${product.name}`);
          }
          run('UPDATE products SET stock = stock - ? WHERE id = ?', [item.quantity, item.product_id]);
        }
      });

      run("DELETE FROM supplier_account_movements WHERE type = 'purchase' AND reference_id = ?", [req.params.id]);
      run('DELETE FROM purchase_items WHERE purchase_id = ?', [req.params.id]);
      run('DELETE FROM purchases WHERE id = ?', [req.params.id]);
      recalculateSupplierAccount(purchase.supplier_id);
    })();

    saveDatabase();
    res.json({ success: true });
  } catch (err) {
    res.status(400).json({ error: err.message || 'No se pudo eliminar la compra' });
  }
});

module.exports = router;
