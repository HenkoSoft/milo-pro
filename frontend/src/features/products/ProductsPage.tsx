import { useMemo, useState, type ChangeEvent, type FormEvent } from 'react';
import { useAuth } from '../auth/AuthContext';
import { useProductFormData, useProductMutations, useProducts } from './useProducts';
import type { Product, ProductPayload } from '../../types/product';

const PRODUCT_MODULES = [
  { id: 'products', label: 'Planilla', title: 'Planilla de Articulos', subtitle: 'Consulta y mantenimiento de articulos.' },
  { id: 'products-price-update', label: 'Actualizacion de Precios', title: 'Actualizacion de Precios', subtitle: 'Calculo y consulta de listas de precios.' },
  { id: 'products-stock-adjustment', label: 'Ajuste de Stock', title: 'Ajuste de Stock', subtitle: 'Registro de ajustes de stock.' },
  { id: 'products-stock-output', label: 'Salida de Mercaderia', title: 'Salida de Mercaderia', subtitle: 'Registro de salidas de mercaderia.' },
  { id: 'products-stock-query', label: 'Consulta de Salidas', title: 'Consulta de Salidas', subtitle: 'Consulta de movimientos registrados.' },
  { id: 'products-labels', label: 'Imprimir Etiquetas', title: 'Imprimir Etiquetas', subtitle: 'Carga e impresion de etiquetas.' },
  { id: 'products-barcodes', label: 'Impresion de Codigos de Barra', title: 'Impresion de Codigos de Barra', subtitle: 'Carga e impresion de codigos de barra.' },
  { id: 'products-qr', label: 'Impresion de Codigos QR', title: 'Impresion de Codigos QR', subtitle: 'Carga e impresion de codigos QR.' }
] as const;

const EMPTY_PRODUCT_FORM: ProductPayload = {
  sku: '',
  barcode: '',
  name: '',
  description: '',
  short_description: '',
  color: '',
  category_id: '',
  category_primary_id: '',
  category_ids: [],
  brand_id: '',
  supplier: '',
  purchase_price: '0',
  sale_price: '0',
  sale_price_2: '0',
  sale_price_3: '0',
  sale_price_4: '0',
  sale_price_5: '0',
  sale_price_6: '0',
  sale_price_includes_tax: true,
  stock: '0',
  min_stock: '2',
  image_url: ''
};

const PRODUCT_UI_STORAGE_KEY = 'milo-pro-react-product-tools';

interface ProductUiMovement {
  id: string;
  type: 'adjustment' | 'output';
  date: string;
  code: string;
  description: string;
  quantity: number;
  reference: string;
}

function toProductFormValues(product: Product | null): ProductPayload {
  if (!product) return { ...EMPTY_PRODUCT_FORM };

  return {
    sku: product.sku || '',
    barcode: product.barcode || '',
    name: product.name || '',
    description: product.description || '',
    short_description: product.short_description || '',
    color: product.color || '',
    category_id: product.category_id != null ? String(product.category_id) : '',
    category_primary_id: product.category_primary_id != null ? String(product.category_primary_id) : '',
    category_ids: Array.isArray(product.category_ids) ? product.category_ids.map(String) : [],
    brand_id: product.brand_id != null ? String(product.brand_id) : '',
    supplier: product.supplier || '',
    purchase_price: String(product.purchase_price ?? 0),
    sale_price: String(product.sale_price ?? 0),
    sale_price_2: String(product.sale_price_2 ?? 0),
    sale_price_3: String(product.sale_price_3 ?? 0),
    sale_price_4: String(product.sale_price_4 ?? 0),
    sale_price_5: String(product.sale_price_5 ?? 0),
    sale_price_6: String(product.sale_price_6 ?? 0),
    sale_price_includes_tax: product.sale_price_includes_tax !== false && Number(product.sale_price_includes_tax ?? 1) === 1,
    stock: String(product.stock ?? 0),
    min_stock: String(product.min_stock ?? 2),
    image_url: product.image_url || ''
  };
}

function normalizeProductPayload(values: ProductPayload) {
  const categoryIds = [...new Set([values.category_primary_id || values.category_id, ...values.category_ids].filter(Boolean))];

  return {
    sku: values.sku.trim(),
    barcode: values.barcode.trim(),
    name: values.name.trim(),
    description: values.description.trim(),
    short_description: values.short_description.trim(),
    color: values.color.trim(),
    category_id: values.category_primary_id || values.category_id || null,
    category_primary_id: values.category_primary_id || values.category_id || null,
    category_ids: categoryIds,
    brand_id: values.brand_id || null,
    supplier: values.supplier.trim(),
    purchase_price: Number(values.purchase_price || 0),
    sale_price: Number(values.sale_price || 0),
    sale_price_2: Number(values.sale_price_2 || 0),
    sale_price_3: Number(values.sale_price_3 || 0),
    sale_price_4: Number(values.sale_price_4 || 0),
    sale_price_5: Number(values.sale_price_5 || 0),
    sale_price_6: Number(values.sale_price_6 || 0),
    sale_price_includes_tax: values.sale_price_includes_tax,
    stock: Number(values.stock || 0),
    min_stock: Number(values.min_stock || 0),
    image_url: values.image_url.trim(),
    images: values.image_url.trim() ? [{ url_remote: values.image_url.trim(), es_principal: true }] : []
  };
}

function formatMoney(value: number) {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    minimumFractionDigits: 2
  }).format(Number(value || 0));
}

function getSyncBadgeClass(value?: string | null) {
  if (value === 'error') return 'badge-red';
  if (value === 'synced') return 'badge-green';
  return 'badge-yellow';
}

function getStockBadgeClass(product: Product) {
  const stock = Number(product.stock || 0);
  const minStock = Number(product.min_stock || 0);
  if (stock <= 0) return 'badge-red';
  if (stock <= minStock) return 'badge-yellow';
  return 'badge-green';
}

function getProductModuleConfig(pageId: string) {
  return PRODUCT_MODULES.find((module) => module.id === pageId) || PRODUCT_MODULES[0];
}

function calculatePriceWithMargin(cost: number, marginPercent: number, includeTax: boolean) {
  const safeCost = Number.isFinite(cost) ? Math.max(0, cost) : 0;
  const safeMargin = Number.isFinite(marginPercent) ? Math.max(0, marginPercent) : 0;
  const base = safeCost * (1 + safeMargin / 100);
  return includeTax ? base * 1.21 : base;
}

function getProductLookupCode(product: Product) {
  return String(product.sku || product.barcode || `ART-${product.id}`);
}

function loadProductUiMovements() {
  if (typeof window === 'undefined') return [] as ProductUiMovement[];
  try {
    const raw = window.localStorage.getItem(PRODUCT_UI_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveProductUiMovements(movements: ProductUiMovement[]) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(PRODUCT_UI_STORAGE_KEY, JSON.stringify(movements));
}

function appendProductUiMovements(nextRows: ProductUiMovement[]) {
  const current = loadProductUiMovements();
  const merged = [...nextRows, ...current].slice(0, 300);
  saveProductUiMovements(merged);
}

function printProductRows(title: string, rows: Array<{ code: string; name: string; barcode: string; price: number; quantity: number }>) {
  const popup = window.open('', '_blank', 'width=900,height=700');
  if (!popup) {
    window.alert('No se pudo abrir la vista de impresion.');
    return;
  }

  const bodyRows = rows.map((row) => `
    <tr>
      <td>${row.code}</td>
      <td>${row.name}</td>
      <td>${row.barcode}</td>
      <td>${formatMoney(row.price)}</td>
      <td>${row.quantity}</td>
    </tr>
  `).join('');

  popup.document.write(`
    <html>
      <head>
        <title>${title}</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 24px; color: #111; }
          h1 { margin: 0 0 16px; font-size: 24px; }
          table { width: 100%; border-collapse: collapse; }
          th, td { border: 1px solid #ccc; padding: 8px; text-align: left; font-size: 12px; }
          th { background: #f3f4f6; }
        </style>
      </head>
      <body>
        <h1>${title}</h1>
        <table>
          <thead>
            <tr>
              <th>Codigo</th>
              <th>Descripcion</th>
              <th>Codigo de barras</th>
              <th>Precio</th>
              <th>Cantidad</th>
            </tr>
          </thead>
          <tbody>${bodyRows}</tbody>
        </table>
      </body>
    </html>
  `);
  popup.document.close();
  popup.focus();
  popup.print();
}

function ProductModuleTabs({ currentPage }: { currentPage: string }) {
  return (
    <div className="products-section-tabs" role="tablist" aria-label="Modulos de articulos">
      {PRODUCT_MODULES.map((module) => (
        <button
          key={module.id}
          type="button"
          className={`products-tab-button${module.id === currentPage ? ' active' : ''}`}
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

function ProductPrintPanel({
  pageId,
  products,
  title,
  summaryText
}: {
  pageId: 'products-labels' | 'products-barcodes' | 'products-qr';
  products: Product[];
  title: string;
  summaryText: string;
}) {
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState('');
  const [quantities, setQuantities] = useState<Record<string, string>>({});

  const filteredProducts = useMemo(() => {
    const normalized = search.trim().toLowerCase();
    if (!normalized) return products.slice(0, 12);
    return products.filter((product) => {
      const haystack = [product.name, product.sku, product.barcode, String(product.id)]
        .map((value) => String(value || '').toLowerCase());
      return haystack.some((value) => value.includes(normalized));
    }).slice(0, 12);
  }, [products, search]);

  const queuedRows = products
    .map((product) => {
      const quantity = Number(quantities[String(product.id)] || 0);
      if (!Number.isFinite(quantity) || quantity <= 0) return null;
      return {
        id: product.id,
        code: getProductLookupCode(product),
        name: product.name,
        barcode: product.barcode || '-',
        price: Number(product.sale_price || 0),
        quantity
      };
    })
    .filter(Boolean) as Array<{ id: number; code: string; name: string; barcode: string; price: number; quantity: number }>;

  const selectedProduct = products.find((product) => String(product.id) === selectedId) || null;

  function applySelectedProduct(product: Product) {
    setSelectedId(String(product.id));
    setSearch(getProductLookupCode(product));
    setQuantities((current) => ({
      ...current,
      [String(product.id)]: current[String(product.id)] || '1'
    }));
  }

  function setQuantity(productId: number, value: string) {
    setQuantities((current) => ({ ...current, [String(productId)]: value }));
  }

  function setQuantityInOne() {
    const nextValues: Record<string, string> = {};
    products.forEach((product) => {
      if (Number(quantities[String(product.id)] || 0) > 0) {
        nextValues[String(product.id)] = '1';
      }
    });
    setQuantities(nextValues);
  }

  function handlePrint() {
    if (queuedRows.length === 0) {
      window.alert('No hay articulos cargados para imprimir.');
      return;
    }
    printProductRows(title, queuedRows);
  }

  return (
    <div className="card products-price-card">
      <div className="products-module-head">
        <div>
          <p className="products-module-kicker">Articulos</p>
          <h2>{title}</h2>
          <p>Seleccion de articulos y carga de cantidades.</p>
        </div>
      </div>

      <div className="products-config-card">
        <div className="products-inline-grid">
          <div className="form-group products-output-search">
            <label>Codigo (Enter para agregar)</label>
            <div className="products-inline-action">
              <input value={search} onChange={(event: ChangeEvent<HTMLInputElement>) => setSearch(event.target.value)} placeholder="Codigo" />
              <button type="button" className="btn btn-secondary" onClick={() => selectedProduct && applySelectedProduct(selectedProduct)}>Buscar (F5)</button>
            </div>
          </div>
          {pageId === 'products-labels' ? (
            <div className="products-actions-inline">
              <button className="btn btn-secondary" type="button" onClick={setQuantityInOne}>Poner cantidad en 1</button>
            </div>
          ) : null}
          {pageId === 'products-barcodes' || pageId === 'products-qr' ? (
            <div className="products-actions-inline">
              <button className="btn btn-secondary" type="button" onClick={() => {
                setSelectedId('');
                setSearch('');
              }}>
                Limpiar seleccion
              </button>
            </div>
          ) : null}
        </div>
      </div>

      <div className="products-split-layout">
        <section className="products-split-panel">
          <div className="products-subtitle">Resultados de busqueda</div>
          <div className="products-price-search-results">
            {filteredProducts.length === 0 ? (
              <div className="products-price-search-empty">No hay articulos para la busqueda actual.</div>
            ) : (
              filteredProducts.map((product) => (
                <button
                  key={product.id}
                  type="button"
                  className={`products-price-search-item${selectedId === String(product.id) ? ' is-active' : ''}`}
                  onClick={() => applySelectedProduct(product)}
                >
                  <strong>{product.name}</strong>
                  <span>{getProductLookupCode(product)} · {product.barcode || 'Sin codigo de barras'}</span>
                </button>
              ))
            )}
          </div>
        </section>

        <section className="products-split-panel">
          <div className="products-subtitle">Articulo seleccionado</div>
          <div className="products-print-summary">
            <div className="products-print-summary-row"><span>Codigo</span><strong>{selectedProduct ? getProductLookupCode(selectedProduct) : '-'}</strong></div>
            <div className="products-print-summary-row"><span>Descripcion</span><strong>{selectedProduct?.name || 'Seleccione un articulo'}</strong></div>
            <div className="products-print-summary-row"><span>Precio</span><strong>{selectedProduct ? formatMoney(Number(selectedProduct.sale_price || 0)) : formatMoney(0)}</strong></div>
          </div>
          {selectedProduct ? (
            <div className="form-group">
              <label>Cantidad</label>
              <input
                className="products-inline-number"
                type="number"
                min="0"
                value={quantities[String(selectedProduct.id)] || '1'}
                onChange={(event: ChangeEvent<HTMLInputElement>) => setQuantity(selectedProduct.id, event.target.value)}
              />
            </div>
          ) : (
            <div className="products-help-line">Seleccione un articulo para cargar la cantidad a imprimir.</div>
          )}
        </section>
      </div>

      <div className="products-sheet-table-wrap">
        <table className="products-sheet-table">
          <thead>
            <tr>
              <th>Codigo</th>
              <th>Descripcion</th>
              <th>Codigo de barras</th>
              <th>Precio</th>
              <th>Cantidad</th>
            </tr>
          </thead>
          <tbody>
            {queuedRows.length === 0 ? (
              <tr><td colSpan={5} className="products-sheet-empty">No hay articulos cargados para imprimir.</td></tr>
            ) : (
              queuedRows.map((row) => (
                <tr key={row.id}>
                  <td>{row.code}</td>
                  <td>{row.name}</td>
                  <td>{row.barcode}</td>
                  <td>{formatMoney(row.price)}</td>
                  <td>
                    <input
                      className="products-inline-number"
                      type="number"
                      min="0"
                      value={String(row.quantity)}
                      onChange={(event: ChangeEvent<HTMLInputElement>) => setQuantity(row.id, event.target.value)}
                    />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="products-actions-right">
        <button className="btn btn-primary" type="button" onClick={handlePrint}>Imprimir</button>
        <button className="btn btn-secondary" type="button" onClick={() => setQuantities({})}>Limpiar planilla</button>
      </div>
      <div className="alert alert-info">
        {summaryText}
      </div>
    </div>
  );
}

function PriceUpdatePanel({ products }: { products: Product[] }) {
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState('');
  const [cost, setCost] = useState('0');
  const [margins, setMargins] = useState<Record<string, string>>({
    '1': '35',
    '2': '40',
    '3': '45',
    '4': '50',
    '5': '55',
    '6': '60'
  });
  const [includeTax, setIncludeTax] = useState<Record<string, boolean>>({
    '1': true,
    '2': true,
    '3': true,
    '4': true,
    '5': true,
    '6': true
  });

  const filteredProducts = useMemo(() => {
    const normalized = search.trim().toLowerCase();
    if (!normalized) return products.slice(0, 12);
    return products.filter((product) => {
      const haystack = [product.name, product.sku, product.barcode]
        .map((value) => String(value || '').toLowerCase());
      return haystack.some((value) => value.includes(normalized));
    }).slice(0, 12);
  }, [products, search]);

  const selectedProduct = products.find((product) => String(product.id) === selectedId) || null;

  function applySelectedProduct(product: Product) {
    setSelectedId(String(product.id));
    setCost(String(Number(product.purchase_price || 0)));
  }

  return (
    <div className="card products-price-card">
      <div className="products-module-head">
        <div>
          <p className="products-module-kicker">Articulos</p>
          <h2>Actualizacion de Precios</h2>
          <p>Calcular listas de precios con margen, IVA y referencia visual del articulo seleccionado.</p>
        </div>
      </div>

      <div className="products-price-search">
        <div className="form-group">
          <label>Buscar articulo</label>
          <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Codigo, descripcion o codigo de barras..." />
        </div>
        <div className="products-price-search-results">
          {filteredProducts.length === 0 ? (
            <div className="products-price-search-empty">No hay articulos para la busqueda actual.</div>
          ) : (
            filteredProducts.map((product) => (
              <button key={product.id} type="button" className={`products-price-search-item${selectedId === String(product.id) ? ' is-active' : ''}`} onClick={() => applySelectedProduct(product)}>
                <strong>{product.name}</strong>
                <span>{product.sku || product.barcode || `ART-${product.id}`} · Costo {formatMoney(Number(product.purchase_price || 0))}</span>
              </button>
            ))
          )}
        </div>
      </div>

      <div className="products-price-config-grid">
        <div className="form-group">
          <label>Articulo</label>
          <input value={selectedProduct ? selectedProduct.name : 'Seleccione un articulo'} readOnly />
        </div>
        <div className="form-group">
          <label>Costo</label>
          <input value={cost} onChange={(event: ChangeEvent<HTMLInputElement>) => setCost(event.target.value)} />
        </div>
        <div className="form-group">
          <label>Categoria</label>
          <input value={selectedProduct ? ((selectedProduct.category_names || []).join(', ') || selectedProduct.category_name || '-') : '-'} readOnly />
        </div>
      </div>

      <div className="products-price-summary">
        <div className="products-price-summary-card">
          <span>Costo base</span>
          <strong>{formatMoney(Number(cost || 0))}</strong>
        </div>
        <div className="products-price-summary-card">
          <span>Lista 1</span>
          <strong>{formatMoney(calculatePriceWithMargin(Number(cost || 0), Number(margins['1'] || 0), includeTax['1']))}</strong>
        </div>
        <div className="products-price-summary-card">
          <span>Lista 6</span>
          <strong>{formatMoney(calculatePriceWithMargin(Number(cost || 0), Number(margins['6'] || 0), includeTax['6']))}</strong>
        </div>
      </div>

      <div className="products-price-table-wrap">
        <table className="products-sheet-table products-price-table">
          <thead>
            <tr>
              <th>Lista</th>
              <th>Calcular</th>
              <th>Margen %</th>
              <th>Incluye IVA</th>
              <th>Precio sugerido</th>
            </tr>
          </thead>
          <tbody>
            {['1', '2', '3', '4', '5', '6'].map((listKey) => (
              <tr key={listKey}>
                <td>{`Lista ${listKey}`}</td>
                <td>Si</td>
                <td>
                  <input value={margins[listKey]} onChange={(event: ChangeEvent<HTMLInputElement>) => setMargins((current) => ({ ...current, [listKey]: event.target.value }))} />
                </td>
                <td>
                  <label className="products-price-check">
                    <input type="checkbox" checked={includeTax[listKey]} onChange={(event) => setIncludeTax((current) => ({ ...current, [listKey]: event.target.checked }))} />
                    {includeTax[listKey] ? 'Si' : 'No'}
                  </label>
                </td>
                <td>{formatMoney(calculatePriceWithMargin(Number(cost || 0), Number(margins[listKey] || 0), includeTax[listKey]))}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="alert alert-info">
        Esta pantalla replica el calculo visual del modulo para referencia operativa. La aplicacion masiva de precios sigue requiriendo control operativo antes de una actualizacion general.
      </div>
    </div>
  );
}

function StockAdjustmentPanel({ products }: { products: Product[] }) {
  const [search, setSearch] = useState('');
  const [draftValues, setDraftValues] = useState<Record<string, string>>({});
  const [feedback, setFeedback] = useState('');

  const filteredProducts = useMemo(() => {
    const normalized = search.trim().toLowerCase();
    if (!normalized) return products.slice(0, 12);
    return products.filter((product) => {
      const haystack = [product.name, product.sku, product.barcode]
        .map((value) => String(value || '').toLowerCase());
      return haystack.some((value) => value.includes(normalized));
    }).slice(0, 12);
  }, [products, search]);

  const pendingRows = filteredProducts
    .map((product) => {
      const nextValue = draftValues[String(product.id)];
      if (nextValue === undefined || nextValue === '' || Number(nextValue) === Number(product.stock || 0)) {
        return null;
      }
      return {
        id: product.id,
        sku: product.sku || `ART-${product.id}`,
        name: product.name,
        currentStock: Number(product.stock || 0),
        nextStock: Number(nextValue)
      };
    })
    .filter(Boolean) as Array<{ id: number; sku: string; name: string; currentStock: number; nextStock: number }>;

  function handleSaveAdjustments() {
    if (pendingRows.length === 0) {
      setFeedback('No hay ajustes preparados para guardar.');
      return;
    }

    appendProductUiMovements(
      pendingRows.map((row) => ({
        id: `adjustment-${row.id}-${Date.now()}`,
        type: 'adjustment',
        date: new Date().toISOString().slice(0, 10),
        code: row.sku,
        description: row.name,
        quantity: row.nextStock - row.currentStock,
        reference: `Stock nuevo ${row.nextStock}`
      }))
    );
    setFeedback('Ajustes registrados en el historial auxiliar del modulo.');
  }

  return (
    <div className="card products-price-card">
      <div className="products-module-head">
        <div>
          <p className="products-module-kicker">Articulos</p>
          <h2>Ajuste de Stock</h2>
          <p>Planilla visual para preparar cambios de stock sin salir del modulo de articulos.</p>
        </div>
      </div>

      <div className="products-split-layout">
        <section className="products-split-panel">
          <div className="form-group">
            <label>Buscar por codigo o descripcion (F1,F2)</label>
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar..." />
          </div>
          <div className="products-help-line">Ingrese la cantidad del nuevo stock y revise la lista de ajustes a realizar.</div>
          <div className="products-sheet-table-wrap">
            <table className="products-sheet-table">
              <thead>
                <tr>
                  <th>Codigo</th>
                  <th>Descripcion</th>
                  <th>Stock actual</th>
                  <th>Nuevo stock</th>
                </tr>
              </thead>
              <tbody>
                {filteredProducts.length === 0 ? (
                  <tr><td colSpan={4} className="products-sheet-empty">No hay articulos para mostrar.</td></tr>
                ) : (
                  filteredProducts.map((product) => (
                    <tr key={product.id}>
                      <td>{product.sku || `ART-${product.id}`}</td>
                      <td>{product.name}</td>
                      <td>{product.stock ?? 0}</td>
                      <td>
                        <input
                          className="products-inline-number"
                          type="number"
                          value={draftValues[String(product.id)] ?? String(product.stock ?? 0)}
                          onChange={(event: ChangeEvent<HTMLInputElement>) => {
                            setDraftValues((current) => ({ ...current, [String(product.id)]: event.target.value }));
                          }}
                        />
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section className="products-split-panel">
          <div className="products-subtitle">Ajustes a realizar</div>
          <div className="products-sheet-table-wrap">
            <table className="products-sheet-table">
              <thead>
                <tr>
                  <th>Codigo</th>
                  <th>Descripcion</th>
                  <th>Nuevo stock</th>
                  <th>Accion</th>
                </tr>
              </thead>
              <tbody>
                {pendingRows.length === 0 ? (
                  <tr><td colSpan={4} className="products-sheet-empty">No hay ajustes preparados.</td></tr>
                ) : (
                  pendingRows.map((row) => (
                    <tr key={row.id}>
                      <td>{row.sku}</td>
                      <td>{row.name}</td>
                      <td>{row.nextStock}</td>
                      <td>{row.nextStock > row.currentStock ? 'Ingreso' : row.nextStock < row.currentStock ? 'Salida' : 'Sin cambio'}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          <div className="products-actions-right">
            <button className="btn btn-primary" type="button" onClick={handleSaveAdjustments}>Guardar cambios</button>
            <button className="btn btn-secondary" type="button" onClick={() => setDraftValues({})}>Limpiar</button>
          </div>
          <div className="alert alert-info">
            Los ajustes quedan guardados en el historial auxiliar del modulo para mantener el mismo alcance operativo del frontend anterior.
          </div>
          {feedback ? <div className="alert alert-info">{feedback}</div> : null}
        </section>
      </div>
    </div>
  );
}

function StockOutputPanel({ products, currentUserName }: { products: Product[]; currentUserName: string }) {
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState('');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [quantity, setQuantity] = useState('1');
  const [reason, setReason] = useState('');
  const [feedback, setFeedback] = useState('');

  const filteredProducts = useMemo(() => {
    const normalized = search.trim().toLowerCase();
    if (!normalized) return products.slice(0, 8);
    return products.filter((product) => {
      const haystack = [product.name, product.sku, product.barcode]
        .map((value) => String(value || '').toLowerCase());
      return haystack.some((value) => value.includes(normalized));
    }).slice(0, 8);
  }, [products, search]);

  const selectedProduct = products.find((product) => String(product.id) === selectedId) || null;

  function selectProduct(product: Product) {
    setSelectedId(String(product.id));
    setSearch(product.sku || product.barcode || product.name);
  }

  function handleSaveOutput() {
    if (!selectedProduct) {
      setFeedback('Selecciona un articulo antes de registrar la salida.');
      return;
    }
    if (Number(quantity || 0) <= 0) {
      setFeedback('La cantidad debe ser mayor a cero.');
      return;
    }

    appendProductUiMovements([
      {
        id: `output-${selectedProduct.id}-${Date.now()}`,
        type: 'output',
        date,
        code: getProductLookupCode(selectedProduct),
        description: selectedProduct.name,
        quantity: Number(quantity),
        reference: reason || 'Salida registrada desde el modulo'
      }
    ]);
    setFeedback('Salida registrada en el historial auxiliar del modulo.');
    setQuantity('1');
    setReason('');
  }

  return (
    <div className="card products-price-card">
      <div className="products-module-head">
        <div>
          <p className="products-module-kicker">Articulos</p>
          <h2>Salida de Mercaderia</h2>
          <p>Preparar una salida con la misma estructura operativa visible del modulo.</p>
        </div>
      </div>

      <div className="products-config-card">
        <div className="products-inline-grid">
          <div className="form-group">
            <label>Usuario</label>
            <input value={currentUserName || 'Operador'} readOnly />
          </div>
          <div className="form-group">
            <label>Fecha</label>
            <input type="date" value={date} onChange={(event: ChangeEvent<HTMLInputElement>) => setDate(event.target.value)} />
          </div>
          <div className="form-group products-output-search">
            <label>Codigo de articulo</label>
            <div className="products-inline-action">
              <input value={search} onChange={(event: ChangeEvent<HTMLInputElement>) => setSearch(event.target.value)} placeholder="Codigo de articulo" />
              <button className="btn btn-secondary" type="button" onClick={() => {
                if (filteredProducts[0]) selectProduct(filteredProducts[0]);
              }}>Buscar (F5)</button>
            </div>
          </div>
        </div>
      </div>

      <div className="products-split-layout">
        <section className="products-split-panel">
          <div className="products-subtitle">Resultados</div>
          <div className="products-price-search-results">
            {filteredProducts.length === 0 ? (
              <div className="products-price-search-empty">No hay articulos para la busqueda actual.</div>
            ) : (
              filteredProducts.map((product) => (
                <button key={product.id} type="button" className={`products-price-search-item${selectedId === String(product.id) ? ' is-active' : ''}`} onClick={() => selectProduct(product)}>
                  <strong>{product.name}</strong>
                  <span>{product.sku || product.barcode || `ART-${product.id}`} · Stock {product.stock ?? 0}</span>
                </button>
              ))
            )}
          </div>
        </section>

        <section className="products-split-panel">
          <div className="products-subtitle">Salida a registrar</div>
          <div className="products-price-config-grid">
            <div className="form-group">
              <label>Articulo</label>
              <input value={selectedProduct ? selectedProduct.name : 'Seleccione un articulo'} readOnly />
            </div>
            <div className="form-group">
              <label>Stock actual</label>
              <input value={selectedProduct ? String(selectedProduct.stock ?? 0) : '0'} readOnly />
            </div>
            <div className="form-group">
              <label>Cantidad</label>
              <input type="number" value={quantity} onChange={(event: ChangeEvent<HTMLInputElement>) => setQuantity(event.target.value)} min="1" />
            </div>
            <div className="form-group products-field-span-3">
              <label>Motivo / referencia</label>
              <input value={reason} onChange={(event: ChangeEvent<HTMLInputElement>) => setReason(event.target.value)} placeholder="Ej. mercaderia para servicio tecnico, muestra o ajuste" />
            </div>
          </div>

          <div className="products-summary-strip">
            <span><strong>Articulo:</strong> {selectedProduct ? selectedProduct.sku || selectedProduct.name : '-'}</span>
            <span><strong>Cantidad:</strong> {quantity}</span>
            <span><strong>Fecha:</strong> {date}</span>
          </div>

          <div className="products-actions-right">
            <button className="btn btn-primary" type="button" onClick={handleSaveOutput}>Guardar salida</button>
            <button className="btn btn-secondary" type="button" onClick={() => {
              setSelectedId('');
              setSearch('');
              setQuantity('1');
              setReason('');
            }}>
              Limpiar
            </button>
          </div>
          <div className="alert alert-info">
            La salida queda registrada en el historial auxiliar del modulo, manteniendo el mismo alcance operativo visible del frontend anterior.
          </div>
          {feedback ? <div className="alert alert-info">{feedback}</div> : null}
        </section>
      </div>
    </div>
  );
}

function StockQueryPanel({ products }: { products: Product[] }) {
  const [search, setSearch] = useState('');
  const [dateFrom, setDateFrom] = useState(new Date().toISOString().slice(0, 10));
  const [dateTo, setDateTo] = useState(new Date().toISOString().slice(0, 10));
  const [feedback, setFeedback] = useState('');

  const sampleRows = useMemo(() => {
    const normalized = search.trim().toLowerCase();
    const rows = loadProductUiMovements().filter((row) => {
      const inDateRange = (!dateFrom || row.date >= dateFrom) && (!dateTo || row.date <= dateTo);
      const matchesSearch = !normalized || [row.code, row.description, row.reference]
        .some((value) => String(value || '').toLowerCase().includes(normalized));
      return inDateRange && matchesSearch;
    });
    return rows;
  }, [dateFrom, dateTo, search, products]);

  function clearDateRange() {
    const keptRows = loadProductUiMovements().filter((row) => row.date < dateFrom || row.date > dateTo);
    saveProductUiMovements(keptRows);
    setFeedback('Se eliminaron los registros auxiliares dentro del rango indicado.');
  }

  return (
    <div className="card products-price-card">
      <div className="products-module-head">
        <div>
          <p className="products-module-kicker">Articulos</p>
          <h2>Consulta de Salidas</h2>
          <p>Historial visual de salidas preparado para la misma lectura operativa del modulo.</p>
        </div>
      </div>

      <div className="products-config-card">
        <div className="products-inline-grid">
          <div className="form-group">
            <label>Desde</label>
            <input type="date" value={dateFrom} onChange={(event: ChangeEvent<HTMLInputElement>) => setDateFrom(event.target.value)} />
          </div>
          <div className="form-group">
            <label>Hasta</label>
            <input type="date" value={dateTo} onChange={(event: ChangeEvent<HTMLInputElement>) => setDateTo(event.target.value)} />
          </div>
          <div className="form-group products-output-search">
            <label>Buscar</label>
            <input value={search} onChange={(event: ChangeEvent<HTMLInputElement>) => setSearch(event.target.value)} placeholder="Buscar salida..." />
          </div>
        </div>
      </div>

      <div className="products-sheet-table-wrap">
        <table className="products-sheet-table">
          <thead>
            <tr>
              <th>Fecha</th>
              <th>Codigo</th>
              <th>Descripcion</th>
              <th>Cantidad</th>
              <th>Referencia</th>
            </tr>
          </thead>
          <tbody>
            {sampleRows.length === 0 ? (
              <tr><td colSpan={5} className="products-sheet-empty">No hay salidas para mostrar.</td></tr>
            ) : (
              sampleRows.map((row) => (
                <tr key={`${row.id}-${row.date}`}>
                  <td>{row.date}</td>
                  <td>{row.code}</td>
                  <td>{row.description}</td>
                  <td>{row.quantity}</td>
                  <td>{row.reference}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="products-actions-right">
        <button className="btn btn-danger" type="button" onClick={clearDateRange}>Borrar entre fechas</button>
        <button className="btn btn-secondary" type="button" onClick={() => setSearch('')}>Limpiar filtro</button>
      </div>
      <div className="alert alert-info">
        Consulta de movimientos registrados en el modulo.
      </div>
      {feedback ? <div className="alert alert-info">{feedback}</div> : null}
    </div>
  );
}

export function ProductsPage({ pageId = 'products' }: { pageId?: string }) {
  const { currentUser } = useAuth();
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [stockFilter, setStockFilter] = useState('');
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [formValues, setFormValues] = useState<ProductPayload>({ ...EMPTY_PRODUCT_FORM });
  const [feedback, setFeedback] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const productsQuery = useProducts({ search, category: categoryFilter, lowStock: stockFilter === 'low' });
  const { categoriesQuery, brandsQuery, nextSkuQuery } = useProductFormData();
  const { createMutation, updateMutation, deleteMutation } = useProductMutations();

  const categories = categoriesQuery.data || [];
  const brands = brandsQuery.data || [];
  const products = productsQuery.data || [];
  const isAdmin = currentUser?.role === 'admin';
  const isSaving = createMutation.isPending || updateMutation.isPending;
  const moduleConfig = getProductModuleConfig(pageId);
  const currentUserName = currentUser?.name || 'Operador';

  const filteredProducts = useMemo(() => {
    return products.filter((product) => {
      if (stockFilter === 'out') {
        return Number(product.stock || 0) <= 0;
      }
      if (stockFilter === 'available') {
        return Number(product.stock || 0) > 0;
      }
      return true;
    });
  }, [products, stockFilter]);

  const lowStockCount = filteredProducts.filter((item) => Number(item.stock) > 0 && Number(item.stock) <= Number(item.min_stock || 0)).length;
  const outOfStockCount = filteredProducts.filter((item) => Number(item.stock || 0) <= 0).length;

  function openNewProductModal() {
    setSelectedProduct(null);
    setFormValues({ ...EMPTY_PRODUCT_FORM, sku: nextSkuQuery.data?.sku || '' });
    setFeedback('');
    setIsModalOpen(true);
  }

  function openEditProductModal(product: Product) {
    setSelectedProduct(product);
    setFormValues(toProductFormValues(product));
    setFeedback('');
    setIsModalOpen(true);
  }

  function closeModal() {
    setIsModalOpen(false);
    setFeedback('');
  }

  function handleChange(event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) {
    const { name, value } = event.target;

    if (name === 'sale_price_includes_tax') {
      const target = event.target as HTMLInputElement;
      setFormValues((current) => ({ ...current, sale_price_includes_tax: target.checked }));
      return;
    }

    setFormValues((current) => ({ ...current, [name]: value }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFeedback('');

    if (!formValues.name.trim()) {
      setFeedback('La descripcion del articulo es obligatoria.');
      return;
    }

    if (!isAdmin) {
      setFeedback('Solo el administrador puede guardar articulos desde este modulo.');
      return;
    }

    const payload = normalizeProductPayload(formValues);

    try {
      const response = selectedProduct
        ? await updateMutation.mutateAsync({ id: selectedProduct.id, payload })
        : await createMutation.mutateAsync(payload);
      const warning = response.sync_warning ? ` El articulo se guardo, pero WooCommerce devolvio un aviso: ${response.sync_warning}` : '';
      setFeedback(`Articulo guardado correctamente.${warning}`);
      closeModal();
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : 'No se pudo guardar el articulo.');
    }
  }

  async function handleDelete(product: Product) {
    const confirmed = window.confirm(`Eliminar el articulo "${product.name}"?`);
    if (!confirmed) return;

    try {
      const result = await deleteMutation.mutateAsync(product.id);
      if (result.remote_delete_warning) {
        window.alert(`El producto se elimino en la app, pero WooCommerce no permitio borrarlo: ${result.remote_delete_warning}`);
      }
      if (selectedProduct?.id === product.id) {
        closeModal();
      }
    } catch (error) {
      window.alert(error instanceof Error ? error.message : 'No se pudo eliminar el articulo.');
    }
  }

  if (pageId === 'products-price-update') {
    return (
      <section className="products-admin-content">
        <ProductModuleTabs currentPage={pageId} />
        <PriceUpdatePanel products={products} />
      </section>
    );
  }

  if (pageId === 'products-stock-adjustment') {
    return (
      <section className="products-admin-content">
        <ProductModuleTabs currentPage={pageId} />
        <StockAdjustmentPanel products={products} />
      </section>
    );
  }

  if (pageId === 'products-stock-output') {
    return (
      <section className="products-admin-content">
        <ProductModuleTabs currentPage={pageId} />
        <StockOutputPanel products={products} currentUserName={currentUserName} />
      </section>
    );
  }

  if (pageId === 'products-stock-query') {
    return (
      <section className="products-admin-content">
        <ProductModuleTabs currentPage={pageId} />
        <StockQueryPanel products={products} />
      </section>
    );
  }

  if (pageId === 'products-labels') {
    return (
      <section className="products-admin-content">
        <ProductModuleTabs currentPage={pageId} />
        <ProductPrintPanel
          pageId="products-labels"
          products={products}
          title="Impresion de Etiquetas"
          summaryText="La carga y la impresion final ya ocurren dentro del modulo, manteniendo el mismo alcance operativo visible del submodulo."
        />
      </section>
    );
  }

  if (pageId === 'products-barcodes') {
    return (
      <section className="products-admin-content">
        <ProductModuleTabs currentPage={pageId} />
        <ProductPrintPanel
          pageId="products-barcodes"
          products={products}
          title="Impresion de Codigos de Barra"
          summaryText="La seleccion de articulos y la impresion final ya ocurren dentro del modulo."
        />
      </section>
    );
  }

  if (pageId === 'products-qr') {
    return (
      <section className="products-admin-content">
        <ProductModuleTabs currentPage={pageId} />
        <ProductPrintPanel
          pageId="products-qr"
          products={products}
          title="Impresion de Codigos QR"
          summaryText="La carga de articulos, cantidades y la impresion final ya quedan resueltas dentro del modulo."
        />
      </section>
    );
  }

  return (
    <section className="products-admin-content">
      <ProductModuleTabs currentPage={pageId} />
      <div className="products-admin-panel card">
        <div className="products-module-head">
          <div>
            <p className="products-module-kicker">Planilla</p>
            <h2>Planilla de Articulos</h2>
            <p>Consulta y mantenimiento de articulos.</p>
          </div>
          <div className="products-module-actions">
            <button className="btn btn-primary" type="button" onClick={openNewProductModal}>+ Nuevo Articulo</button>
            <button className="btn btn-secondary" type="button" onClick={() => productsQuery.refetch()}>Actualizar</button>
          </div>
        </div>

        <div className="products-sheet-toolbar">
          <div className="products-sheet-filters">
            <div className="form-group">
              <label>Buscar</label>
              <input type="text" value={search} placeholder="Codigo o descripcion..." onChange={(event) => setSearch(event.target.value)} />
            </div>
            <div className="form-group">
              <label>Categoria</label>
              <select value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)}>
                <option value="">Seleccionar categoria</option>
                {categories.map((category) => (
                  <option key={category.id} value={String(category.id)}>{category.full_name || category.name}</option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label>Stock</label>
              <select value={stockFilter} onChange={(event) => setStockFilter(event.target.value)}>
                <option value="">Todos</option>
                <option value="available">Disponible</option>
                <option value="low">Stock bajo</option>
                <option value="out">Sin stock</option>
              </select>
            </div>
          </div>
          <div className="products-sheet-stats">
            <span><strong>{filteredProducts.length}</strong> articulos</span>
            <span><strong>{lowStockCount}</strong> stock bajo</span>
            <span><strong>{outOfStockCount}</strong> sin stock</span>
          </div>
        </div>

        <div className="products-sheet-table-wrap">
          <table className="products-sheet-table">
            <thead>
              <tr>
                <th>Foto</th>
                <th>Codigo / SKU</th>
                <th>Descripcion</th>
                <th>Marca</th>
                <th>Proveedor</th>
                <th>Categoria</th>
                <th>Sync</th>
                <th>Woo ID</th>
                <th>Stock</th>
                <th>Costo</th>
                <th>Lista 1</th>
                <th>Lista 2</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {productsQuery.isLoading ? (
                <tr><td colSpan={13} className="products-sheet-empty">Cargando...</td></tr>
              ) : productsQuery.isError ? (
                <tr><td colSpan={13} className="products-sheet-empty">Error: {productsQuery.error instanceof Error ? productsQuery.error.message : 'No se pudieron cargar articulos.'}</td></tr>
              ) : filteredProducts.length === 0 ? (
                <tr><td colSpan={13} className="products-sheet-empty">No hay articulos para mostrar.</td></tr>
              ) : (
                filteredProducts.map((product) => (
                  <tr key={product.id}>
                    <td>
                      {product.image_url ? (
                        <img src={product.image_url} className="products-sheet-thumb" alt={product.name || 'Articulo'} />
                      ) : (
                        <div className="products-sheet-thumb products-sheet-thumb--empty">Sin foto</div>
                      )}
                    </td>
                    <td>{product.sku || `ART-${product.id}`}</td>
                    <td><strong>{product.name}</strong></td>
                    <td>{product.brand_name || '-'}</td>
                    <td>{product.supplier || '-'}</td>
                    <td>{(product.category_names || []).join(', ') || product.category_name || '-'}</td>
                    <td><span className={`badge ${getSyncBadgeClass(product.sync_status)}`}>{product.sync_status || 'pending'}</span></td>
                    <td>{product.woocommerce_product_id || product.woocommerce_id || '-'}</td>
                    <td><span className={`badge ${getStockBadgeClass(product)}`}>{product.stock ?? 0}</span></td>
                    <td>{formatMoney(Number(product.purchase_price || 0))}</td>
                    <td>{formatMoney(Number(product.sale_price || 0))}</td>
                    <td>{formatMoney(Number(product.sale_price_2 || 0))}</td>
                    <td>
                      <div className="btn-group">
                        <button className="btn btn-sm btn-secondary" type="button" onClick={() => openEditProductModal(product)}>Editar</button>
                        <button className="btn btn-sm btn-danger" type="button" onClick={() => void handleDelete(product)}>Eliminar</button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {isModalOpen ? (
        <div className="modal-overlay">
          <div className="modal modal-medium">
            <div className="modal-header">
              <div>
                <h3>{selectedProduct ? 'Editar Articulo' : 'Nuevo Articulo'}</h3>
              </div>
              <button type="button" className="modal-close" onClick={closeModal}>&times;</button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="modal-body">
                <div className="form-row">
                  <div className="form-group">
                    <label htmlFor="product-sku">SKU</label>
                    <input id="product-sku" name="sku" value={formValues.sku} onChange={handleChange} />
                  </div>
                  <div className="form-group">
                    <label htmlFor="product-barcode">Codigo de barras</label>
                    <input id="product-barcode" name="barcode" value={formValues.barcode} onChange={handleChange} />
                  </div>
                </div>
                <div className="form-group">
                  <label htmlFor="product-name">Descripcion</label>
                  <input id="product-name" name="name" value={formValues.name} onChange={handleChange} required />
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label htmlFor="product-category">Categoria principal</label>
                    <select id="product-category" name="category_primary_id" value={formValues.category_primary_id} onChange={handleChange}>
                      <option value="">Seleccionar categoria</option>
                      {categories.map((category) => (
                        <option key={category.id} value={String(category.id)}>{category.full_name || category.name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group">
                    <label htmlFor="product-brand">Marca</label>
                    <select id="product-brand" name="brand_id" value={formValues.brand_id} onChange={handleChange}>
                      <option value="">Seleccionar marca</option>
                      {brands.map((brand) => (
                        <option key={brand.id} value={String(brand.id)}>{brand.name}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label htmlFor="product-supplier">Proveedor</label>
                    <input id="product-supplier" name="supplier" value={formValues.supplier} onChange={handleChange} />
                  </div>
                  <div className="form-group">
                    <label htmlFor="product-color">Color</label>
                    <input id="product-color" name="color" value={formValues.color} onChange={handleChange} />
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label htmlFor="product-purchase-price">Costo</label>
                    <input id="product-purchase-price" name="purchase_price" type="number" value={formValues.purchase_price} onChange={handleChange} />
                  </div>
                  <div className="form-group">
                    <label htmlFor="product-sale-price">Lista 1</label>
                    <input id="product-sale-price" name="sale_price" type="number" value={formValues.sale_price} onChange={handleChange} />
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label htmlFor="product-stock">Stock</label>
                    <input id="product-stock" name="stock" type="number" value={formValues.stock} onChange={handleChange} />
                  </div>
                  <div className="form-group">
                    <label htmlFor="product-min-stock">Stock minimo</label>
                    <input id="product-min-stock" name="min_stock" type="number" value={formValues.min_stock} onChange={handleChange} />
                  </div>
                </div>
                <div className="form-group">
                  <label htmlFor="product-image-url">URL de imagen principal</label>
                  <input id="product-image-url" name="image_url" value={formValues.image_url} onChange={handleChange} />
                </div>
                {feedback ? <div className="alert alert-warning">{feedback}</div> : null}
              </div>
              <div className="modal-footer">
                <button className="btn btn-secondary" type="button" onClick={closeModal}>Cancelar</button>
                <button className="btn btn-success" type="submit" disabled={isSaving}>{isSaving ? 'Guardando...' : 'Guardar'}</button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </section>
  );
}
