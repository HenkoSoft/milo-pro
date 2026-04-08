import { useMemo, useState, type ChangeEvent, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  createPurchase,
  createSupplier,
  createSupplierCredit,
  createSupplierPayment,
  deletePurchase,
  deleteSupplier,
  deleteSupplierCredit,
  getPurchaseById,
  getPurchases,
  getSupplierAccount,
  getSupplierAccountDetail,
  getSupplierCredits,
  getSupplierPayments,
  getSuppliers,
  updateSupplier
} from '../../services/purchases';
import { getProducts } from '../../services/products';
import type { Product } from '../../types/product';
import type {
  Purchase,
  PurchaseItemPayload,
  Supplier,
  SupplierAccountDetail,
  SupplierCredit,
  SupplierCreditPayload,
  SupplierPayload,
  SupplierPayment
} from '../../types/purchase';

const PURCHASE_MODULES = [
  { id: 'merchandise-entry', label: 'Ingreso de Mercaderia', title: 'Ingreso de Mercaderia', subtitle: 'Carga de compras.' },
  { id: 'nc-proveedor', label: 'N/C Proveedor (Carga)', title: 'N/C Proveedor (Carga)', subtitle: 'Carga de notas de credito a proveedor.' },
  { id: 'purchase-query', label: 'Consulta de Compras', title: 'Consulta de Compras', subtitle: 'Listado y detalle de comprobantes.' },
  { id: 'nc-query', label: 'Consulta de N/C', title: 'Consulta de N/C', subtitle: 'Listado de notas de credito a proveedor.' },
  { id: 'supplier-payments', label: 'Pagos a Proveedores', title: 'Pagos a Proveedores', subtitle: 'Pagos y cuenta corriente.' }
] as const;

const INVOICE_TYPES = [
  { value: 'FA', label: 'FACTURA A' },
  { value: 'FB', label: 'FACTURA B' },
  { value: 'FC', label: 'FACTURA C' },
  { value: 'FX', label: 'FACTURA X' },
  { value: 'ND', label: 'NOTA DE DEBITO' },
  { value: 'NC', label: 'NOTA DE CREDITO' }
] as const;

const PAYMENT_METHODS = ['cash', 'transfer', 'card', 'check'] as const;

interface PurchaseLine {
  product_id: string;
  product_name: string;
  product_code: string;
  quantity: string;
  unit_cost: string;
}

interface SupplierFormValues extends SupplierPayload {}

const EMPTY_SUPPLIER_FORM: SupplierFormValues = {
  name: '',
  phone: '',
  email: '',
  address: '',
  city: '',
  tax_id: '',
  notes: ''
};

const EMPTY_PAYMENT_FORM = {
  supplier_id: '',
  amount: '',
  payment_method: 'cash',
  reference: '',
  notes: ''
};

function getModuleConfig(pageId: string) {
  return PURCHASE_MODULES.find((module) => module.id === pageId) || PURCHASE_MODULES[0];
}

function getTodayDate() {
  return new Date().toISOString().split('T')[0];
}

function formatMoney(value: number) {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    minimumFractionDigits: 2
  }).format(Number(value || 0));
}

function toNumber(value: string | number) {
  const parsed = Number.parseFloat(String(value || '0').replace(',', '.'));
  return Number.isFinite(parsed) ? parsed : 0;
}

function getPurchaseIvaRate(invoiceType: string) {
  return invoiceType === 'FX' ? 0 : 0.21;
}

function findProductBySearch(products: Product[], search: string) {
  const normalized = String(search || '').trim().toLowerCase();
  if (!normalized) return null;

  return products.find((product) => {
    const haystack = [product.name, product.sku, product.barcode]
      .map((value) => String(value || '').trim().toLowerCase());
    return haystack.some((value) => value === normalized);
  }) || null;
}

function mapPurchaseLineToPayload(item: PurchaseLine): PurchaseItemPayload {
  return {
    product_id: item.product_id || null,
    product_name: item.product_name,
    product_code: item.product_code,
    quantity: Number.parseInt(item.quantity || '0', 10) || 0,
    unit_cost: toNumber(item.unit_cost),
    unit_price: toNumber(item.unit_cost)
  };
}

function PurchaseTabs({ pageId }: { pageId: string }) {
  return (
    <div className="purchases-section-tabs" role="tablist" aria-label="Modulos de compras">
      {PURCHASE_MODULES.map((module) => (
        <button
          key={module.id}
          type="button"
          className={`purchases-tab-button${module.id === pageId ? ' active' : ''}`}
          onClick={() => {
            window.location.hash = module.id;
          }}
        >
          {module.label}
        </button>
      ))}
    </div>
  );
}

function PurchasesModuleHeader({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="purchases-module-head">
      <div>
        <p className="purchases-module-kicker">Compras</p>
        <h2>{title}</h2>
        <p>{subtitle}</p>
      </div>
    </div>
  );
}

function PurchaseQueryPanel({
  purchases,
  search,
  setSearch,
  selectedPurchaseId,
  setSelectedPurchaseId,
  purchaseDetail,
  onDelete
}: {
  purchases: Purchase[];
  search: string;
  setSearch: (value: string) => void;
  selectedPurchaseId: string;
  setSelectedPurchaseId: (value: string) => void;
  purchaseDetail: Purchase | null;
  onDelete: (purchase: Purchase) => Promise<void>;
}) {
  const filteredPurchases = useMemo(() => {
    const normalized = search.trim().toLowerCase();
    return purchases.filter((purchase) => {
      if (!normalized) return true;
      return [purchase.supplier_name, purchase.invoice_number, purchase.invoice_type, purchase.notes]
        .some((value) => String(value || '').toLowerCase().includes(normalized));
    });
  }, [purchases, search]);

  return (
    <div className="purchases-query-layout">
      <div className="card purchases-card">
        <div className="purchases-query-toolbar">
          <div>
            <h2 className="purchases-title">Consulta de Compras</h2>
            <p>Listado de comprobantes.</p>
          </div>
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Buscar proveedor, numero o notas..."
          />
        </div>
        <table className="products-table">
          <thead>
            <tr>
              <th>Proveedor</th>
              <th>Comprobante</th>
              <th>Fecha</th>
              <th>Total</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {filteredPurchases.length === 0 ? (
              <tr>
                <td colSpan={5} className="purchase-empty-row">No hay compras para mostrar.</td>
              </tr>
            ) : (
              filteredPurchases.map((purchase) => (
                <tr key={purchase.id} className={String(purchase.id) === selectedPurchaseId ? 'is-selected' : ''}>
                  <td>{purchase.supplier_name || '-'}</td>
                  <td>{[purchase.invoice_type, purchase.invoice_number].filter(Boolean).join(' - ') || '-'}</td>
                  <td>{purchase.invoice_date || '-'}</td>
                  <td>{formatMoney(Number(purchase.total || 0))}</td>
                  <td>
                    <div className="btn-group">
                      <button className="btn btn-action btn-edit" type="button" onClick={() => setSelectedPurchaseId(String(purchase.id))}>V</button>
                      <button className="btn btn-action btn-delete" type="button" onClick={() => void onDelete(purchase)}>X</button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="card purchases-card purchases-detail-card">
        <h3>Detalle del comprobante</h3>
        {!purchaseDetail ? (
          <div className="purchase-empty-row">Seleccione una compra para ver el detalle.</div>
        ) : (
          <>
            <div className="purchase-detail-grid">
              <div><strong>Proveedor:</strong> {purchaseDetail.supplier_name || '-'}</div>
              <div><strong>Comprobante:</strong> {[purchaseDetail.invoice_type, purchaseDetail.invoice_number].filter(Boolean).join(' - ') || '-'}</div>
              <div><strong>Fecha:</strong> {purchaseDetail.invoice_date || '-'}</div>
              <div><strong>Total:</strong> {formatMoney(Number(purchaseDetail.total || 0))}</div>
            </div>
            <table className="products-table">
              <thead>
                <tr>
                  <th>Codigo</th>
                  <th>Descripcion</th>
                  <th>Cantidad</th>
                  <th>Costo</th>
                </tr>
              </thead>
              <tbody>
                {(purchaseDetail.items || []).length === 0 ? (
                  <tr><td colSpan={4} className="purchase-empty-row">Sin items asociados.</td></tr>
                ) : (
                  (purchaseDetail.items || []).map((item, index) => (
                    <tr key={`${purchaseDetail.id}-${index}`}>
                      <td>{item.product_code || '-'}</td>
                      <td>{item.product_name}</td>
                      <td>{item.quantity}</td>
                      <td>{formatMoney(Number(item.unit_cost || item.unit_price || 0))}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
            {purchaseDetail.notes ? <div className="purchase-detail-notes"><strong>Observaciones:</strong> {purchaseDetail.notes}</div> : null}
          </>
        )}
      </div>
    </div>
  );
}

function SupplierCreditsPanel({
  suppliers,
  products,
  credits,
  onCreate,
  onDelete,
  feedback,
  setFeedback
}: {
  suppliers: Supplier[];
  products: Product[];
  credits: SupplierCredit[];
  onCreate: (payload: SupplierCreditPayload) => Promise<void>;
  onDelete: (credit: SupplierCredit) => Promise<void>;
  feedback: string;
  setFeedback: (value: string) => void;
}) {
  const [invoiceDate, setInvoiceDate] = useState(getTodayDate());
  const [supplierId, setSupplierId] = useState('');
  const [creditNoteNumber, setCreditNoteNumber] = useState('');
  const [referenceInvoice, setReferenceInvoice] = useState('');
  const [productSearch, setProductSearch] = useState('');
  const [itemCode, setItemCode] = useState('');
  const [itemQuantity, setItemQuantity] = useState('1');
  const [itemPrice, setItemPrice] = useState('0');
  const [notes, setNotes] = useState('');
  const [items, setItems] = useState<PurchaseLine[]>([]);
  const [updateStock, setUpdateStock] = useState(true);

  const filteredProducts = useMemo(() => {
    const normalized = productSearch.trim().toLowerCase();
    if (!normalized) return products.slice(0, 8);
    return products.filter((product) => [product.name, product.sku, product.barcode]
      .some((value) => String(value || '').toLowerCase().includes(normalized))).slice(0, 8);
  }, [productSearch, products]);

  const subtotal = items.reduce((sum, item) => sum + toNumber(item.quantity) * toNumber(item.unit_cost), 0);
  const iva = subtotal * 0.21;
  const total = subtotal + iva;

  function resetLine() {
    setProductSearch('');
    setItemCode('');
    setItemQuantity('1');
    setItemPrice('0');
  }

  function resetForm() {
    setInvoiceDate(getTodayDate());
    setSupplierId('');
    setCreditNoteNumber('');
    setReferenceInvoice('');
    setNotes('');
    setItems([]);
    setUpdateStock(true);
    resetLine();
  }

  function syncProduct(product: Product) {
    setProductSearch(product.name || '');
    setItemCode(product.sku || product.barcode || '');
    setItemPrice(String(product.purchase_price ?? 0));
  }

  function addItem(product: Product | null) {
    const selected = product || findProductBySearch(products, productSearch);
    if (!selected) {
      setFeedback('Selecciona un producto valido antes de agregarlo.');
      return;
    }
    const quantity = Math.max(0, Number.parseInt(itemQuantity || '0', 10) || 0);
    if (quantity <= 0) {
      setFeedback('La cantidad debe ser mayor a cero.');
      return;
    }

    setItems((current) => [
      ...current,
      {
        product_id: String(selected.id),
        product_name: selected.name,
        product_code: itemCode || selected.sku || selected.barcode || '',
        quantity: String(quantity),
        unit_cost: String(toNumber(itemPrice))
      }
    ]);
    setFeedback('');
    resetLine();
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (items.length === 0) {
      setFeedback('Debe agregar al menos un producto.');
      return;
    }

    try {
      await onCreate({
        supplier_id: supplierId || null,
        credit_note_number: creditNoteNumber,
        reference_invoice: referenceInvoice,
        invoice_date: invoiceDate,
        items: items.map(mapPurchaseLineToPayload),
        notes,
        update_stock: updateStock,
        update_cash: false
      });
      resetForm();
      setFeedback('Nota de credito guardada correctamente.');
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : 'No se pudo guardar la nota de credito.');
    }
  }

  return (
    <div className="purchases-query-layout">
      <div className="card purchases-card">
        <h2 className="purchases-title">N/C Proveedor (Carga)</h2>
        <form onSubmit={handleSubmit}>
          <div className="purchase-header-grid">
            <div className="form-group">
              <label>Proveedor</label>
              <select value={supplierId} onChange={(event) => setSupplierId(event.target.value)}>
                <option value="">Seleccionar proveedor...</option>
                {suppliers.map((supplier) => (
                  <option key={supplier.id} value={String(supplier.id)}>{supplier.name}</option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label>N/C Numero</label>
              <input value={creditNoteNumber} onChange={(event) => setCreditNoteNumber(event.target.value)} />
            </div>
            <div className="form-group">
              <label>Factura de Referencia</label>
              <input value={referenceInvoice} onChange={(event) => setReferenceInvoice(event.target.value)} />
            </div>
            <div className="form-group">
              <label>Fecha</label>
              <input type="date" value={invoiceDate} onChange={(event) => setInvoiceDate(event.target.value)} />
            </div>
          </div>

          <div className="card purchases-item-card">
            <h4>Agregar Producto</h4>
            <div className="purchase-item-grid">
              <div className="form-group">
                <label>Codigo</label>
                <input value={itemCode} onChange={(event) => setItemCode(event.target.value)} />
              </div>
              <div className="form-group">
                <label>Producto</label>
                <input
                  value={productSearch}
                  onChange={(event) => setProductSearch(event.target.value)}
                  onBlur={() => {
                    const match = findProductBySearch(products, productSearch) || filteredProducts[0] || null;
                    if (match) syncProduct(match);
                  }}
                  placeholder="Escriba nombre del producto..."
                />
              </div>
              <div className="form-group">
                <label>Cantidad</label>
                <input type="number" min="1" value={itemQuantity} onChange={(event) => setItemQuantity(event.target.value)} />
              </div>
              <div className="form-group">
                <label>Precio Unit.</label>
                <input type="number" min="0" step="0.01" value={itemPrice} onChange={(event) => setItemPrice(event.target.value)} />
              </div>
              <div className="form-group">
                <label>Subtotal</label>
                <input readOnly value={(toNumber(itemQuantity) * toNumber(itemPrice)).toFixed(2)} />
              </div>
              <button type="button" className="btn btn-success purchase-add-button" onClick={() => addItem(null)}>+ Agregar</button>
            </div>

            {productSearch.trim() ? (
              <div className="purchase-search-results">
                {filteredProducts.map((product) => (
                  <button key={product.id} type="button" className="purchase-search-result" onClick={() => addItem(product)}>
                    <strong>{product.name}</strong>
                    <span>{product.sku || product.barcode || `#${product.id}`} Â· Costo {formatMoney(Number(product.purchase_price || 0))}</span>
                  </button>
                ))}
              </div>
            ) : null}
          </div>

          <table className="products-table">
            <thead>
              <tr>
                <th>Codigo</th>
                <th>Descripcion</th>
                <th>Cantidad</th>
                <th>Precio</th>
              </tr>
            </thead>
            <tbody>
              {items.length === 0 ? (
                <tr><td colSpan={4} className="purchase-empty-row">No hay productos agregados</td></tr>
              ) : items.map((item, index) => (
                <tr key={`${item.product_id}-${index}`}>
                  <td>{item.product_code || '-'}</td>
                  <td>{item.product_name}</td>
                  <td>{item.quantity}</td>
                  <td>{formatMoney(toNumber(item.unit_cost))}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="purchase-totals">
            <div><strong>Subtotal:</strong> <span>{formatMoney(subtotal)}</span></div>
            <div><strong>IVA (21%):</strong> <span>{formatMoney(iva)}</span></div>
            <div className="purchase-totals-grand"><strong>Total:</strong> <span>{formatMoney(total)}</span></div>
          </div>

          <div className="form-group purchase-notes-group">
            <label>Observaciones</label>
            <textarea rows={2} value={notes} onChange={(event) => setNotes(event.target.value)} />
          </div>
          <label className="admin-checkbox"><input type="checkbox" checked={updateStock} onChange={(event) => setUpdateStock(event.target.checked)} /> Actualizar stock</label>

          <div className="purchase-actions">
            <button type="button" className="btn btn-secondary" onClick={resetForm}>Limpiar</button>
            <button type="submit" className="btn btn-primary">Guardar N/C</button>
          </div>
        </form>
      </div>

      <div className="card purchases-card purchases-detail-card">
        <h3>Notas de credito recientes</h3>
        <table className="products-table">
          <thead>
            <tr>
              <th>Proveedor</th>
              <th>N/C</th>
              <th>Fecha</th>
              <th>Total</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {credits.length === 0 ? (
              <tr><td colSpan={5} className="purchase-empty-row">No hay notas de credito registradas.</td></tr>
            ) : (
              credits.slice(0, 15).map((credit) => (
                <tr key={credit.id}>
                  <td>{credit.supplier_name || '-'}</td>
                  <td>{credit.credit_note_number || '-'}</td>
                  <td>{credit.invoice_date || '-'}</td>
                  <td>{formatMoney(Number(credit.total || 0))}</td>
                  <td><button className="btn btn-action btn-delete" type="button" onClick={() => void onDelete(credit)}>X</button></td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function CreditsQueryPanel({
  credits,
  search,
  setSearch,
  onDelete
}: {
  credits: SupplierCredit[];
  search: string;
  setSearch: (value: string) => void;
  onDelete: (credit: SupplierCredit) => Promise<void>;
}) {
  const filteredCredits = useMemo(() => {
    const normalized = search.trim().toLowerCase();
    return credits.filter((credit) => {
      if (!normalized) return true;
      return [credit.supplier_name, credit.credit_note_number, credit.reference_invoice, credit.notes]
        .some((value) => String(value || '').toLowerCase().includes(normalized));
    });
  }, [credits, search]);

  return (
    <div className="card purchases-card">
      <div className="purchases-query-toolbar">
          <div>
            <h2 className="purchases-title">Consulta de N/C</h2>
            <p>Listado administrativo de notas de credito.</p>
          </div>
        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Buscar proveedor, numero o referencia..."
        />
      </div>
      <table className="products-table">
        <thead>
          <tr>
            <th>Proveedor</th>
            <th>N/C</th>
            <th>Factura Ref.</th>
            <th>Fecha</th>
            <th>Total</th>
            <th>Acciones</th>
          </tr>
        </thead>
        <tbody>
          {filteredCredits.length === 0 ? (
            <tr><td colSpan={6} className="purchase-empty-row">No hay notas de credito para mostrar.</td></tr>
          ) : (
            filteredCredits.map((credit) => (
              <tr key={credit.id}>
                <td>{credit.supplier_name || '-'}</td>
                <td>{credit.credit_note_number || '-'}</td>
                <td>{credit.reference_invoice || '-'}</td>
                <td>{credit.invoice_date || '-'}</td>
                <td>{formatMoney(Number(credit.total || 0))}</td>
                <td><button className="btn btn-action btn-delete" type="button" onClick={() => void onDelete(credit)}>X</button></td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

function SupplierPaymentsPanel({
  suppliers,
  payments,
  supplierAccount,
  selectedAccount,
  onSelectAccount,
  onCreatePayment,
  paymentFeedback,
  setPaymentFeedback
}: {
  suppliers: Supplier[];
  payments: SupplierPayment[];
  supplierAccount: Supplier[];
  selectedAccount: SupplierAccountDetail | null;
  onSelectAccount: (supplierId: string) => void;
  onCreatePayment: (payload: { supplier_id: string; amount: number; payment_method: string; reference: string; notes: string }) => Promise<void>;
  paymentFeedback: string;
  setPaymentFeedback: (value: string) => void;
}) {
  const [formValues, setFormValues] = useState(EMPTY_PAYMENT_FORM);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!formValues.supplier_id || !toNumber(formValues.amount)) {
      setPaymentFeedback('Proveedor y monto son requeridos.');
      return;
    }

    try {
      await onCreatePayment({
        supplier_id: formValues.supplier_id,
        amount: toNumber(formValues.amount),
        payment_method: formValues.payment_method,
        reference: formValues.reference,
        notes: formValues.notes
      });
      setFormValues(EMPTY_PAYMENT_FORM);
      setPaymentFeedback('Pago registrado correctamente.');
    } catch (error) {
      setPaymentFeedback(error instanceof Error ? error.message : 'No se pudo registrar el pago.');
    }
  }

  return (
    <div className="purchases-query-layout">
      <div className="card purchases-card">
        <h2 className="purchases-title">Pagos a Proveedores</h2>
        <form onSubmit={handleSubmit}>
          <div className="purchase-header-grid">
            <div className="form-group">
              <label>Proveedor</label>
              <select value={formValues.supplier_id} onChange={(event) => {
                setFormValues((current) => ({ ...current, supplier_id: event.target.value }));
                onSelectAccount(event.target.value);
              }}>
                <option value="">Seleccionar proveedor...</option>
                {suppliers.map((supplier) => (
                  <option key={supplier.id} value={String(supplier.id)}>{supplier.name}</option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label>Monto</label>
              <input value={formValues.amount} onChange={(event) => setFormValues((current) => ({ ...current, amount: event.target.value }))} />
            </div>
            <div className="form-group">
              <label>Forma de pago</label>
              <select value={formValues.payment_method} onChange={(event) => setFormValues((current) => ({ ...current, payment_method: event.target.value }))}>
                {PAYMENT_METHODS.map((method) => (
                  <option key={method} value={method}>{method}</option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label>Referencia</label>
              <input value={formValues.reference} onChange={(event) => setFormValues((current) => ({ ...current, reference: event.target.value }))} />
            </div>
          </div>
          <div className="form-group purchase-notes-group">
            <label>Observaciones</label>
            <textarea rows={2} value={formValues.notes} onChange={(event) => setFormValues((current) => ({ ...current, notes: event.target.value }))} />
          </div>
          {paymentFeedback ? <div className={`alert ${paymentFeedback.includes('No se pudo') || paymentFeedback.includes('requeridos') ? 'alert-warning' : 'alert-info'}`}>{paymentFeedback}</div> : null}
          <div className="purchase-actions">
            <button type="submit" className="btn btn-primary">Registrar Pago</button>
          </div>
        </form>

        <div className="purchase-totals purchases-supplier-summary">
          <div><strong>Proveedores:</strong> <span>{supplierAccount.length}</span></div>
          <div><strong>Saldo total:</strong> <span>{formatMoney(supplierAccount.reduce((sum, supplier) => sum + Number(supplier.balance || 0), 0))}</span></div>
        </div>
      </div>

      <div className="card purchases-card purchases-detail-card">
        <h3>Cuenta corriente</h3>
        {!selectedAccount ? (
          <div className="purchase-empty-row">Selecciona un proveedor para ver su cuenta corriente.</div>
        ) : (
          <>
            <div className="purchase-detail-grid">
              <div><strong>Proveedor:</strong> {selectedAccount.supplier.name}</div>
              <div><strong>Saldo:</strong> {formatMoney(Number(selectedAccount.supplier.balance || 0))}</div>
              <div><strong>Compras:</strong> {formatMoney(Number(selectedAccount.supplier.total_purchases || 0))}</div>
              <div><strong>Pagos:</strong> {formatMoney(Number(selectedAccount.supplier.total_payments || 0))}</div>
            </div>
            <table className="products-table">
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Tipo</th>
                  <th>Descripcion</th>
                  <th>Debe</th>
                  <th>Haber</th>
                  <th>Saldo</th>
                </tr>
              </thead>
              <tbody>
                {selectedAccount.movements.length === 0 ? (
                  <tr><td colSpan={6} className="purchase-empty-row">Sin movimientos para mostrar.</td></tr>
                ) : (
                  selectedAccount.movements.map((movement) => (
                    <tr key={movement.id}>
                      <td>{movement.created_at ? new Date(movement.created_at).toLocaleString('es-AR') : '-'}</td>
                      <td>{movement.type}</td>
                      <td>{movement.description || '-'}</td>
                      <td>{formatMoney(Number(movement.debit || 0))}</td>
                      <td>{formatMoney(Number(movement.credit || 0))}</td>
                      <td>{formatMoney(Number(movement.balance || 0))}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </>
        )}
      </div>

      <div className="card purchases-card purchases-detail-card">
        <h3>Pagos recientes</h3>
        <table className="products-table">
          <thead>
            <tr>
              <th>Proveedor</th>
              <th>Fecha</th>
              <th>Metodo</th>
              <th>Referencia</th>
              <th>Monto</th>
            </tr>
          </thead>
          <tbody>
            {payments.length === 0 ? (
              <tr><td colSpan={5} className="purchase-empty-row">No hay pagos registrados.</td></tr>
            ) : (
              payments.slice(0, 15).map((payment) => (
                <tr key={payment.id}>
                  <td>{payment.supplier_name || '-'}</td>
                  <td>{payment.created_at ? new Date(payment.created_at).toLocaleString('es-AR') : '-'}</td>
                  <td>{payment.payment_method || '-'}</td>
                  <td>{payment.reference || '-'}</td>
                  <td>{formatMoney(Number(payment.amount || 0))}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function PurchasesPage({ pageId }: { pageId: string }) {
  const queryClient = useQueryClient();
  const moduleConfig = getModuleConfig(pageId);
  const [invoiceType, setInvoiceType] = useState('FA');
  const [invoiceSerie, setInvoiceSerie] = useState('');
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [invoiceDate, setInvoiceDate] = useState(getTodayDate());
  const [supplierId, setSupplierId] = useState('');
  const [productSearch, setProductSearch] = useState('');
  const [itemCode, setItemCode] = useState('');
  const [itemQuantity, setItemQuantity] = useState('1');
  const [itemCost, setItemCost] = useState('0');
  const [notes, setNotes] = useState('');
  const [items, setItems] = useState<PurchaseLine[]>([]);
  const [feedback, setFeedback] = useState('');
  const [querySearch, setQuerySearch] = useState('');
  const [creditsSearch, setCreditsSearch] = useState('');
  const [paymentFeedback, setPaymentFeedback] = useState('');
  const [selectedPurchaseId, setSelectedPurchaseId] = useState('');
  const [selectedSupplierAccountId, setSelectedSupplierAccountId] = useState('');
  const [isSupplierModalOpen, setIsSupplierModalOpen] = useState(false);
  const [supplierForm, setSupplierForm] = useState<SupplierFormValues>({ ...EMPTY_SUPPLIER_FORM });

  const suppliersQuery = useQuery({ queryKey: ['purchases', 'suppliers'], queryFn: getSuppliers, staleTime: 30_000 });
  const productsQuery = useQuery({ queryKey: ['products', 'purchase-composer'], queryFn: () => getProducts({}), staleTime: 30_000 });
  const purchasesQuery = useQuery({ queryKey: ['purchases', 'list'], queryFn: getPurchases, staleTime: 30_000 });
  const purchaseDetailQuery = useQuery({ queryKey: ['purchases', 'detail', selectedPurchaseId], queryFn: () => getPurchaseById(selectedPurchaseId), enabled: Boolean(selectedPurchaseId) });
  const creditsQuery = useQuery({ queryKey: ['purchases', 'credits'], queryFn: getSupplierCredits, staleTime: 30_000 });
  const paymentsQuery = useQuery({ queryKey: ['purchases', 'payments'], queryFn: getSupplierPayments, staleTime: 30_000 });
  const supplierAccountQuery = useQuery({ queryKey: ['purchases', 'supplier-account'], queryFn: getSupplierAccount, staleTime: 30_000 });
  const supplierAccountDetailQuery = useQuery({
    queryKey: ['purchases', 'supplier-account-detail', selectedSupplierAccountId],
    queryFn: () => getSupplierAccountDetail(selectedSupplierAccountId),
    enabled: Boolean(selectedSupplierAccountId)
  });

  const createPurchaseMutation = useMutation({
    mutationFn: createPurchase,
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['products'] }),
        queryClient.invalidateQueries({ queryKey: ['purchases'] })
      ]);
    }
  });
  const deletePurchaseMutation = useMutation({
    mutationFn: deletePurchase,
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['products'] }),
        queryClient.invalidateQueries({ queryKey: ['purchases'] })
      ]);
    }
  });
  const createSupplierMutation = useMutation({
    mutationFn: createSupplier,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['purchases', 'suppliers'] });
    }
  });
  const createSupplierCreditMutation = useMutation({
    mutationFn: createSupplierCredit,
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['products'] }),
        queryClient.invalidateQueries({ queryKey: ['purchases'] })
      ]);
    }
  });
  const deleteSupplierCreditMutation = useMutation({
    mutationFn: deleteSupplierCredit,
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['products'] }),
        queryClient.invalidateQueries({ queryKey: ['purchases'] })
      ]);
    }
  });
  const createSupplierPaymentMutation = useMutation({
    mutationFn: createSupplierPayment,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['purchases'] });
    }
  });

  const suppliers = suppliersQuery.data || [];
  const products = productsQuery.data || [];
  const purchases = purchasesQuery.data || [];
  const credits = creditsQuery.data || [];
  const payments = paymentsQuery.data || [];
  const supplierAccount = supplierAccountQuery.data || [];
  const selectedSupplier = suppliers.find((supplier) => String(supplier.id) === supplierId) || null;
  const filteredProducts = useMemo(() => {
    const normalized = productSearch.trim().toLowerCase();
    if (!normalized) return products.slice(0, 8);

    return products.filter((product) => {
      const haystack = [product.name, product.sku, product.barcode]
        .map((value) => String(value || '').toLowerCase());
      return haystack.some((value) => value.includes(normalized));
    }).slice(0, 8);
  }, [productSearch, products]);

  const subtotal = items.reduce((sum, item) => sum + toNumber(item.quantity) * toNumber(item.unit_cost), 0);
  const iva = subtotal * getPurchaseIvaRate(invoiceType);
  const total = subtotal + iva;

  function resetItemComposer() {
    setProductSearch('');
    setItemCode('');
    setItemQuantity('1');
    setItemCost('0');
  }

  function clearPurchaseForm() {
    setItems([]);
    setSupplierId('');
    setInvoiceType('FA');
    setInvoiceSerie('');
    setInvoiceNumber('');
    setInvoiceDate(getTodayDate());
    setNotes('');
    setFeedback('');
    resetItemComposer();
  }

  function syncProductSelection(product: Product) {
    setProductSearch(product.name || '');
    setItemCode(product.sku || product.barcode || '');
    setItemCost(String(product.purchase_price ?? 0));
  }

  function handleQuickProductSearch() {
    const match = findProductBySearch(products, productSearch) || filteredProducts[0] || null;
    if (match) {
      syncProductSelection(match);
    }
  }

  function handleAddItem(product: Product | null) {
    const selectedProduct = product || findProductBySearch(products, productSearch);
    if (!selectedProduct) {
      setFeedback('Selecciona un producto valido antes de agregarlo.');
      return;
    }

    const quantity = Math.max(0, Number.parseInt(itemQuantity || '0', 10) || 0);
    if (quantity <= 0) {
      setFeedback('La cantidad debe ser mayor a cero.');
      return;
    }

    const unitCost = toNumber(itemCost);
    setItems((current) => {
      const existingIndex = current.findIndex((item) => item.product_id === String(selectedProduct.id));
      if (existingIndex >= 0) {
        return current.map((item) => (
          item.product_id === String(selectedProduct.id)
            ? { ...item, quantity: String(Number.parseInt(item.quantity || '0', 10) + quantity), unit_cost: String(unitCost) }
            : item
        ));
      }

      return [
        ...current,
        {
          product_id: String(selectedProduct.id),
          product_name: selectedProduct.name,
          product_code: itemCode || selectedProduct.sku || selectedProduct.barcode || '',
          quantity: String(quantity),
          unit_cost: String(unitCost)
        }
      ];
    });
    setFeedback('');
    resetItemComposer();
  }

  function handleItemChange(productId: string, field: 'quantity' | 'unit_cost', value: string) {
    setItems((current) => current.map((item) => (
      item.product_id === productId ? { ...item, [field]: value } : item
    )));
  }

  function handleRemoveItem(productId: string) {
    setItems((current) => current.filter((item) => item.product_id !== productId));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFeedback('');

    if (items.length === 0) {
      setFeedback('Debe agregar al menos un producto.');
      return;
    }

    try {
      await createPurchaseMutation.mutateAsync({
        supplier_id: supplierId || null,
        invoice_type: invoiceType,
        invoice_number: invoiceSerie ? `${invoiceSerie}-${invoiceNumber}` : invoiceNumber,
        invoice_date: invoiceDate,
        items: items.map(mapPurchaseLineToPayload),
        notes
      });
      setFeedback('Compra guardada exitosamente.');
      clearPurchaseForm();
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : 'No se pudo guardar la compra.');
    }
  }

  async function handleSaveSupplier() {
    if (!supplierForm.name.trim()) {
      setFeedback('El nombre del proveedor es obligatorio.');
      return;
    }

    try {
      const supplier = await createSupplierMutation.mutateAsync(supplierForm);
      setSupplierId(String(supplier.id));
      setSupplierForm({ ...EMPTY_SUPPLIER_FORM });
      setIsSupplierModalOpen(false);
      setFeedback('Proveedor creado correctamente.');
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : 'No se pudo crear el proveedor.');
    }
  }

  async function handleDeletePurchase(purchase: Purchase) {
    const confirmed = window.confirm(`Eliminar compra ${purchase.invoice_number || purchase.id}?`);
    if (!confirmed) return;
    try {
      await deletePurchaseMutation.mutateAsync(purchase.id);
      setSelectedPurchaseId('');
      setFeedback('Compra eliminada correctamente.');
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : 'No se pudo eliminar la compra.');
    }
  }

  async function handleCreateCredit(payload: SupplierCreditPayload) {
    await createSupplierCreditMutation.mutateAsync(payload);
  }

  async function handleDeleteCredit(credit: SupplierCredit) {
    const confirmed = window.confirm(`Eliminar N/C ${credit.credit_note_number || credit.id}?`);
    if (!confirmed) return;
    await deleteSupplierCreditMutation.mutateAsync(credit.id);
    setFeedback('Nota de credito eliminada correctamente.');
  }

  async function handleCreatePayment(payload: { supplier_id: string; amount: number; payment_method: string; reference: string; notes: string }) {
    await createSupplierPaymentMutation.mutateAsync(payload);
  }

  const renderContent = () => {
    if (pageId === 'purchase-query') {
      return (
        <PurchaseQueryPanel
          purchases={purchases}
          search={querySearch}
          setSearch={setQuerySearch}
          selectedPurchaseId={selectedPurchaseId}
          setSelectedPurchaseId={setSelectedPurchaseId}
          purchaseDetail={purchaseDetailQuery.data || null}
          onDelete={handleDeletePurchase}
        />
      );
    }

    if (pageId === 'nc-proveedor') {
      return (
        <SupplierCreditsPanel
          suppliers={suppliers}
          products={products}
          credits={credits}
          onCreate={handleCreateCredit}
          onDelete={handleDeleteCredit}
          feedback={feedback}
          setFeedback={setFeedback}
        />
      );
    }

    if (pageId === 'nc-query') {
      return (
        <CreditsQueryPanel
          credits={credits}
          search={creditsSearch}
          setSearch={setCreditsSearch}
          onDelete={handleDeleteCredit}
        />
      );
    }

    if (pageId === 'supplier-payments') {
      return (
        <SupplierPaymentsPanel
          suppliers={suppliers}
          payments={payments}
          supplierAccount={supplierAccount}
          selectedAccount={supplierAccountDetailQuery.data || null}
          onSelectAccount={setSelectedSupplierAccountId}
          onCreatePayment={handleCreatePayment}
          paymentFeedback={paymentFeedback}
          setPaymentFeedback={setPaymentFeedback}
        />
      );
    }

    return (
      <div className="card purchases-card">
        <h2 className="purchases-title">Ingreso de Mercaderia</h2>
        <form onSubmit={handleSubmit}>
          <div className="purchase-header-grid">
            <div className="form-group">
              <label>Tipo</label>
              <select value={invoiceType} onChange={(event) => setInvoiceType(event.target.value)}>
                {INVOICE_TYPES.map((item) => (
                  <option key={item.value} value={item.value}>{item.label}</option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label>Numero de Comprobante</label>
              <div className="purchase-inline-grid">
                <input value={invoiceSerie} onChange={(event: ChangeEvent<HTMLInputElement>) => setInvoiceSerie(event.target.value)} placeholder="0001" />
                <input value={invoiceNumber} onChange={(event: ChangeEvent<HTMLInputElement>) => setInvoiceNumber(event.target.value)} placeholder="00000001" />
              </div>
            </div>
            <div className="form-group">
              <label>Fecha</label>
              <input type="date" value={invoiceDate} onChange={(event: ChangeEvent<HTMLInputElement>) => setInvoiceDate(event.target.value)} />
            </div>
            <div className="form-group">
              <label>Proveedor</label>
              <div className="purchase-inline-grid purchase-inline-grid--supplier">
                <select value={supplierId} onChange={(event) => setSupplierId(event.target.value)}>
                  <option value="">Seleccionar proveedor...</option>
                  {suppliers.map((supplier) => (
                    <option key={supplier.id} value={String(supplier.id)}>{supplier.name}</option>
                  ))}
                </select>
                <button type="button" className="btn btn-secondary" onClick={() => setIsSupplierModalOpen(true)}>+</button>
              </div>
            </div>
          </div>

          {selectedSupplier ? (
            <div className="supplier-info-card">
              <div><strong>Direccion:</strong> {selectedSupplier.address || '-'}</div>
              <div><strong>CUIT/DNI:</strong> {selectedSupplier.tax_id || '-'}</div>
              <div><strong>Telefono:</strong> {selectedSupplier.phone || '-'}</div>
            </div>
          ) : null}

          <div className="card purchases-item-card">
            <h4>Agregar Producto</h4>
            <div className="purchase-item-grid">
              <div className="form-group">
                <label>Codigo</label>
                <input value={itemCode} onChange={(event: ChangeEvent<HTMLInputElement>) => setItemCode(event.target.value)} placeholder="Codigo" />
              </div>
              <div className="form-group">
                <label>Producto</label>
                <input
                  value={productSearch}
                  onChange={(event: ChangeEvent<HTMLInputElement>) => setProductSearch(event.target.value)}
                  onBlur={handleQuickProductSearch}
                  placeholder="Escriba nombre del producto..."
                  list="purchase-products-list"
                />
                <datalist id="purchase-products-list">
                  {products.map((product) => (
                    <option key={product.id} value={product.name} />
                  ))}
                </datalist>
              </div>
              <div className="form-group">
                <label>Cantidad</label>
                <input type="number" value={itemQuantity} onChange={(event: ChangeEvent<HTMLInputElement>) => setItemQuantity(event.target.value)} min="1" />
              </div>
              <div className="form-group">
                <label>Costo Unit.</label>
                <input type="number" value={itemCost} onChange={(event: ChangeEvent<HTMLInputElement>) => setItemCost(event.target.value)} step="0.01" min="0" />
              </div>
              <div className="form-group">
                <label>Subtotal</label>
                <input readOnly value={(toNumber(itemQuantity) * toNumber(itemCost)).toFixed(2)} />
              </div>
              <button type="button" className="btn btn-success purchase-add-button" onClick={() => handleAddItem(null)}>+ Agregar</button>
            </div>

            {productSearch.trim() ? (
              <div className="purchase-search-results">
                {filteredProducts.length === 0 ? (
                  <div className="purchase-search-result is-empty">No se encontraron productos para la busqueda actual.</div>
                ) : (
                  filteredProducts.map((product) => (
                    <button key={product.id} type="button" className="purchase-search-result" onClick={() => handleAddItem(product)}>
                      <strong>{product.name}</strong>
                      <span>{product.sku || product.barcode || `#${product.id}`} Â· Costo {formatMoney(Number(product.purchase_price || 0))}</span>
                    </button>
                  ))
                )}
              </div>
            ) : null}
          </div>

          <table className="products-table">
            <thead>
              <tr>
                <th>Codigo</th>
                <th>Descripcion</th>
                <th>Cantidad</th>
                <th>Costo Unit.</th>
                <th>Subtotal</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {items.length === 0 ? (
                <tr>
                  <td colSpan={6} className="purchase-empty-row">No hay productos agregados</td>
                </tr>
              ) : (
                items.map((item) => {
                  const rowSubtotal = toNumber(item.quantity) * toNumber(item.unit_cost);
                  return (
                    <tr key={item.product_id}>
                      <td>{item.product_code || '-'}</td>
                      <td>{item.product_name}</td>
                      <td><input value={item.quantity} onChange={(event: ChangeEvent<HTMLInputElement>) => handleItemChange(item.product_id, 'quantity', event.target.value)} /></td>
                      <td><input value={item.unit_cost} onChange={(event: ChangeEvent<HTMLInputElement>) => handleItemChange(item.product_id, 'unit_cost', event.target.value)} /></td>
                      <td>{formatMoney(rowSubtotal)}</td>
                      <td><button type="button" className="btn btn-secondary btn-small" onClick={() => handleRemoveItem(item.product_id)}>Quitar</button></td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>

          <div className="purchase-totals">
            <div><strong>Subtotal:</strong> <span>{formatMoney(subtotal)}</span></div>
            <div><strong>{invoiceType === 'FX' ? 'IVA (0%)' : 'IVA (21%)'}:</strong> <span>{formatMoney(iva)}</span></div>
            <div className="purchase-totals-grand"><strong>Total:</strong> <span>{formatMoney(total)}</span></div>
          </div>

          <div className="form-group purchase-notes-group">
            <label>Observaciones</label>
            <textarea rows={2} value={notes} onChange={(event: ChangeEvent<HTMLTextAreaElement>) => setNotes(event.target.value)} placeholder="Observaciones..." />
          </div>

          {feedback ? (
            <div className={`alert ${feedback.includes('No se pudo') || feedback.includes('Debe ') || feedback.includes('obligatorio') || feedback.includes('Selecciona') ? 'alert-warning' : 'alert-info'}`}>
              {feedback}
            </div>
          ) : null}

          <div className="purchase-actions">
            <button type="button" className="btn btn-secondary" onClick={clearPurchaseForm}>Limpiar</button>
            <button type="submit" className="btn btn-primary" disabled={createPurchaseMutation.isPending}>
              {createPurchaseMutation.isPending ? 'Guardando...' : 'Guardar Compra'}
            </button>
          </div>
        </form>
      </div>
    );
  };

  return (
    <div className="purchases-module-shell">
      <PurchasesModuleHeader title={moduleConfig.title} subtitle={moduleConfig.subtitle} />
      <PurchaseTabs pageId={pageId} />
      {renderContent()}

      {isSupplierModalOpen ? (
        <div className="modal-overlay" role="presentation">
          <div className="modal purchase-supplier-modal" role="dialog" aria-modal="true" aria-labelledby="purchase-supplier-modal-title">
            <div className="modal-header">
              <h3 id="purchase-supplier-modal-title">Nuevo Proveedor</h3>
              <button type="button" className="btn-close" onClick={() => setIsSupplierModalOpen(false)}>Ã—</button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label>Nombre *</label>
                <input value={supplierForm.name} onChange={(event: ChangeEvent<HTMLInputElement>) => setSupplierForm((current) => ({ ...current, name: event.target.value }))} />
              </div>
              <div className="purchase-modal-grid">
                <div className="form-group">
                  <label>Telefono</label>
                  <input value={supplierForm.phone} onChange={(event: ChangeEvent<HTMLInputElement>) => setSupplierForm((current) => ({ ...current, phone: event.target.value }))} />
                </div>
                <div className="form-group">
                  <label>CUIT/DNI</label>
                  <input value={supplierForm.tax_id} onChange={(event: ChangeEvent<HTMLInputElement>) => setSupplierForm((current) => ({ ...current, tax_id: event.target.value }))} />
                </div>
              </div>
              <div className="form-group">
                <label>Email</label>
                <input value={supplierForm.email} onChange={(event: ChangeEvent<HTMLInputElement>) => setSupplierForm((current) => ({ ...current, email: event.target.value }))} />
              </div>
              <div className="form-group">
                <label>Direccion</label>
                <input value={supplierForm.address} onChange={(event: ChangeEvent<HTMLInputElement>) => setSupplierForm((current) => ({ ...current, address: event.target.value }))} />
              </div>
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-secondary" onClick={() => setIsSupplierModalOpen(false)}>Cancelar</button>
              <button type="button" className="btn btn-primary" onClick={handleSaveSupplier} disabled={createSupplierMutation.isPending}>
                {createSupplierMutation.isPending ? 'Guardando...' : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export function SuppliersPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [feedback, setFeedback] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
  const [formValues, setFormValues] = useState<SupplierFormValues>({ ...EMPTY_SUPPLIER_FORM });

  const suppliersQuery = useQuery({
    queryKey: ['purchases', 'suppliers'],
    queryFn: getSuppliers,
    staleTime: 30_000
  });

  const createSupplierMutation = useMutation({
    mutationFn: createSupplier,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['purchases', 'suppliers'] });
    }
  });

  const updateSupplierMutation = useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: SupplierPayload }) => updateSupplier(id, payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['purchases', 'suppliers'] });
    }
  });

  const deleteSupplierMutation = useMutation({
    mutationFn: (id: number) => deleteSupplier(id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['purchases', 'suppliers'] });
    }
  });

  const allSuppliers = suppliersQuery.data || [];
  const filteredSuppliers = useMemo(() => {
    const normalized = search.trim().toLowerCase();
    return allSuppliers.filter((supplier) => {
      const haystack = [supplier.name, supplier.phone, supplier.email, supplier.tax_id]
        .map((value) => String(value || '').toLowerCase());
      return !normalized || haystack.some((value) => value.includes(normalized));
    });
  }, [allSuppliers, search]);

  const perPage = 10;
  const totalPages = Math.max(1, Math.ceil(filteredSuppliers.length / perPage));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const start = filteredSuppliers.length === 0 ? 0 : (safeCurrentPage - 1) * perPage;
  const end = Math.min(start + perPage, filteredSuppliers.length);
  const pageItems = filteredSuppliers.slice(start, end);

  function openNewSupplierModal() {
    setEditingSupplier(null);
    setFormValues({ ...EMPTY_SUPPLIER_FORM });
    setFeedback('');
    setIsModalOpen(true);
  }

  function openEditSupplierModal(supplier: Supplier) {
    setEditingSupplier(supplier);
    setFormValues({
      name: supplier.name || '',
      phone: supplier.phone || '',
      email: supplier.email || '',
      address: supplier.address || '',
      city: supplier.city || '',
      tax_id: supplier.tax_id || '',
      notes: supplier.notes || ''
    });
    setFeedback('');
    setIsModalOpen(true);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFeedback('');

    if (!formValues.name.trim()) {
      setFeedback('La razon social es obligatoria.');
      return;
    }

    try {
      if (editingSupplier) {
        await updateSupplierMutation.mutateAsync({
          id: editingSupplier.id,
          payload: formValues
        });
        setFeedback('Proveedor actualizado correctamente.');
      } else {
        await createSupplierMutation.mutateAsync(formValues);
        setFeedback('Proveedor creado correctamente.');
      }
      setIsModalOpen(false);
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : 'No se pudo guardar el proveedor.');
    }
  }

  async function handleDeleteSupplier(supplier: Supplier) {
    const confirmed = window.confirm(`Eliminar proveedor ${supplier.name}?`);
    if (!confirmed) return;

    try {
      await deleteSupplierMutation.mutateAsync(supplier.id);
      setFeedback('Proveedor eliminado correctamente.');
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : 'No se pudo eliminar el proveedor.');
    }
  }

  return (
    <div className="suppliers-module-shell">
      <div className="card">
        <div className="suppliers-header-row">
          <h2>Listado de Proveedores</h2>
          <button className="btn btn-primary" type="button" onClick={openNewSupplierModal}>+ Nuevo Proveedor</button>
        </div>

        <div className="suppliers-toolbar">
          <input
            id="supplier-search"
            value={search}
            onChange={(event: ChangeEvent<HTMLInputElement>) => {
              setSearch(event.target.value);
              setCurrentPage(1);
            }}
            placeholder="Buscar por razon social, telefono, contacto o CUIT"
          />
        </div>

        {feedback ? (
          <div className={`alert ${feedback.includes('No se pudo') || feedback.includes('obligatoria') ? 'alert-warning' : 'alert-info'}`}>
            {feedback}
          </div>
        ) : null}

        <table className="products-table">
          <thead>
            <tr>
              <th>Codigo</th>
              <th>Razon Social</th>
              <th>Contacto</th>
              <th>Telefono</th>
              <th>CUIT</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {pageItems.length === 0 ? (
              <tr>
                <td colSpan={6} className="suppliers-empty-row">No hay proveedores para mostrar</td>
              </tr>
            ) : (
              pageItems.map((supplier) => (
                <tr key={supplier.id}>
                  <td>{supplier.id}</td>
                  <td>{supplier.name}</td>
                  <td>{supplier.email || ''}</td>
                  <td>{supplier.phone || ''}</td>
                  <td>{supplier.tax_id || ''}</td>
                  <td>
                    <div className="btn-group">
                      <button className="btn btn-action btn-edit" type="button" onClick={() => openEditSupplierModal(supplier)}>E</button>
                      <button className="btn btn-action btn-delete" type="button" onClick={() => handleDeleteSupplier(supplier)}>X</button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>

        <div className="suppliers-footer-row">
          <div className="table-footer">
            Mostrando {filteredSuppliers.length === 0 ? 0 : start + 1} a {end} de {filteredSuppliers.length} registros
          </div>
          <div className="suppliers-pagination">
            <button className="btn btn-secondary" type="button" onClick={() => setCurrentPage((page) => Math.max(1, page - 1))} disabled={safeCurrentPage === 1}>Anterior</button>
            <button className="btn btn-primary" type="button">{safeCurrentPage}</button>
            <button className="btn btn-secondary" type="button" onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))} disabled={safeCurrentPage >= totalPages}>Siguiente</button>
          </div>
        </div>
      </div>

      {isModalOpen ? (
        <div className="modal-overlay" role="presentation">
          <div className="modal purchase-supplier-modal" role="dialog" aria-modal="true" aria-labelledby="supplier-modal-title">
            <form onSubmit={handleSubmit}>
              <div className="modal-header">
                <h3 id="supplier-modal-title">{editingSupplier ? 'Editar Proveedor' : 'Nuevo Proveedor'}</h3>
                <button type="button" className="btn-close" onClick={() => setIsModalOpen(false)}>x</button>
              </div>
              <div className="modal-body">
                <div className="form-group">
                  <label>Razon Social *</label>
                  <input value={formValues.name} onChange={(event: ChangeEvent<HTMLInputElement>) => setFormValues((current) => ({ ...current, name: event.target.value }))} />
                </div>
                <div className="purchase-modal-grid">
                  <div className="form-group">
                    <label>Telefono</label>
                    <input value={formValues.phone} onChange={(event: ChangeEvent<HTMLInputElement>) => setFormValues((current) => ({ ...current, phone: event.target.value }))} />
                  </div>
                  <div className="form-group">
                    <label>Contacto</label>
                    <input type="email" value={formValues.email} onChange={(event: ChangeEvent<HTMLInputElement>) => setFormValues((current) => ({ ...current, email: event.target.value }))} />
                  </div>
                </div>
                <div className="form-group">
                  <label>CUIT</label>
                  <input value={formValues.tax_id} onChange={(event: ChangeEvent<HTMLInputElement>) => setFormValues((current) => ({ ...current, tax_id: event.target.value }))} />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setIsModalOpen(false)}>Cancelar</button>
                <button type="submit" className="btn btn-primary" disabled={createSupplierMutation.isPending || updateSupplierMutation.isPending}>
                  {createSupplierMutation.isPending || updateSupplierMutation.isPending ? 'Guardando...' : editingSupplier ? 'Guardar Cambios' : 'Guardar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}

