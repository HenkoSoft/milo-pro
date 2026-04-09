import { useMemo, useState, type ChangeEvent } from 'react';
import { useQueries, useQuery } from '@tanstack/react-query';
import { getCustomers } from '../../services/customers';
import { getPurchases } from '../../services/purchases';
import { getProductsReport, getRepairsReport, getRevenueReport, getSalesReport } from '../../services/reports';
import type { Customer } from '../../types/customer';
import type { PurchasesSummaryRow } from '../../types/report';

const REPORT_MODULES = [
  { id: 'reports', section: 'articles', label: 'Dashboard', title: 'Reportes de Articulos', subtitle: 'Filtros simples, tabla clara y exportacion directa para control de stock y catalogo.' },
  { id: 'reports-sales', section: 'sales', label: 'Ventas', title: 'Reportes de Ventas', subtitle: 'Pantalla unificada para consultas comerciales, margenes y seguimiento diario.' },
  { id: 'reports-purchases', section: 'purchases', label: 'Compras', title: 'Reportes de Compras', subtitle: 'Consultas de compras preparadas para filtrar rapidamente por proveedor y fechas.' },
  { id: 'reports-customers', section: 'customers', label: 'Clientes', title: 'Reportes de Clientes', subtitle: 'Seguimiento comercial por cliente, vendedor y comportamiento de compra.' },
  { id: 'reports-delivery-notes', section: 'deliveryNotes', label: 'Remitos', title: 'Reportes de Remitos', subtitle: 'Consulta operativa con la misma estetica de Ventas para revisar entregas y pendientes.' },
  { id: 'reports-accounts', section: 'accounts', label: 'Ctas Ctes', title: 'Reportes de Cuentas Corrientes', subtitle: 'Vista administrativa para deudores, cobranzas y saldo pendiente por cliente.' },
  { id: 'reports-ranking', section: 'ranking', label: 'Ranking de Productos', title: 'Ranking de Ventas', subtitle: 'Comparativos rapidos para detectar articulos, clientes y vendedores destacados.' },
  { id: 'reports-cash', section: 'cash', label: 'Caja', title: 'Reportes de Caja', subtitle: 'Resumen diario de ingresos y egresos para control financiero operativo.' },
  { id: 'reports-excel', section: 'excel', label: 'Excel', title: 'Reportes a Excel', subtitle: 'Generador simple para exportaciones rapidas sin salir del flujo administrativo.' }
] as const;

function formatMoney(value: number) {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    minimumFractionDigits: 2
  }).format(Number(value || 0));
}

function getModuleConfig(pageId: string) {
  return REPORT_MODULES.find((module) => module.id === pageId) || REPORT_MODULES[0];
}

function downloadCsv(filename: string, rows: string[][]) {
  const csv = rows.map((row) => row.map((cell) => `"${String(cell || '').replace(/"/g, '""')}"`).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export function ReportsPage({ pageId }: { pageId: string }) {
  const [salesSearch, setSalesSearch] = useState('');
  const [articlesSearch, setArticlesSearch] = useState('');
  const [customersSearch, setCustomersSearch] = useState('');
  const [purchasesSearch, setPurchasesSearch] = useState('');
  const moduleConfig = getModuleConfig(pageId);

  const [productsReportQuery, salesReportQuery, revenueReportQuery, customersQuery, purchasesQuery] = useQueries({
    queries: [
      { queryKey: ['reports', 'products'], queryFn: getProductsReport, staleTime: 30_000 },
      { queryKey: ['reports', 'sales'], queryFn: () => getSalesReport({}), staleTime: 30_000 },
      { queryKey: ['reports', 'revenue', 'month'], queryFn: () => getRevenueReport('month'), staleTime: 30_000 },
      { queryKey: ['reports', 'customers', 'source'], queryFn: () => getCustomers(''), staleTime: 30_000 },
      { queryKey: ['reports', 'purchases', 'source'], queryFn: getPurchases, staleTime: 30_000 }
    ]
  });

  const repairsReportQuery = useQuery({
    queryKey: ['reports', 'repairs'],
    queryFn: getRepairsReport,
    staleTime: 30_000
  });

  const productsReport = productsReportQuery.data;
  const salesReport = salesReportQuery.data;
  const revenueReport = revenueReportQuery.data;
  const customers = customersQuery.data || [];
  const purchases = purchasesQuery.data || [];
  const repairsReport = repairsReportQuery.data;

  const filteredTopSelling = useMemo(() => {
    const normalized = articlesSearch.trim().toLowerCase();
    const items = productsReport?.topSelling || [];
    if (!normalized) return items;
    return items.filter((item) => [item.name, item.sku].some((value) => String(value || '').toLowerCase().includes(normalized)));
  }, [articlesSearch, productsReport?.topSelling]);

  const filteredSales = useMemo(() => {
    const normalized = salesSearch.trim().toLowerCase();
    const items = salesReport?.sales || [];
    if (!normalized) return items;
    return items.filter((sale) =>
      [sale.customer_name, sale.user_name, sale.receipt_type, sale.notes]
        .some((value) => String(value || '').toLowerCase().includes(normalized))
    );
  }, [salesReport?.sales, salesSearch]);

  const customerRows = useMemo(() => {
    const sales = salesReport?.sales || [];
    const totals = new Map<number, { salesCount: number; totalSpent: number }>();

    sales.forEach((sale) => {
      const customerId = Number(sale.customer_id || 0);
      if (!customerId) return;
      const current = totals.get(customerId) || { salesCount: 0, totalSpent: 0 };
      current.salesCount += 1;
      current.totalSpent += Number(sale.total || 0);
      totals.set(customerId, current);
    });

    const normalized = customersSearch.trim().toLowerCase();
    return customers
      .map((customer: Customer) => ({
        ...customer,
        salesCount: totals.get(customer.id)?.salesCount || 0,
        totalSpent: totals.get(customer.id)?.totalSpent || 0
      }))
      .filter((customer) => {
        if (!normalized) return true;
        return [customer.name, customer.phone, customer.email, customer.tax_id]
          .some((value) => String(value || '').toLowerCase().includes(normalized));
      })
      .sort((a, b) => b.totalSpent - a.totalSpent);
  }, [customers, customersSearch, salesReport?.sales]);

  const purchaseRows = useMemo(() => {
    const normalized = purchasesSearch.trim().toLowerCase();
    return (purchases as PurchasesSummaryRow[])
      .filter((purchase) => {
        if (!normalized) return true;
        return [purchase.supplier_name, purchase.invoice_number, purchase.invoice_type, purchase.notes]
          .some((value) => String(value || '').toLowerCase().includes(normalized));
      })
      .slice(0, 40);
  }, [purchases, purchasesSearch]);

  const realSections = new Set([
    'reports',
    'reports-sales',
    'reports-purchases',
    'reports-customers',
    'reports-delivery-notes',
    'reports-accounts',
    'reports-ranking',
    'reports-cash',
    'reports-excel'
  ]);

  return (
    <div className="reports-module-shell">
      <div className="reports-module-head">
        <div>
          <p className="reports-module-kicker">Reportes</p>
          <h2>{moduleConfig.title}</h2>
          <p>{moduleConfig.subtitle}</p>
        </div>
      </div>

      {pageId === 'reports' ? (
        <div className="reports-grid">
          <article className="reports-summary-card">
            <span>Ventas del periodo</span>
            <strong>{formatMoney(revenueReport?.salesRevenue || 0)}</strong>
          </article>
          <article className="reports-summary-card">
            <span>Reparaciones entregadas</span>
            <strong>{formatMoney(revenueReport?.repairsRevenue || 0)}</strong>
          </article>
          <article className="reports-summary-card">
            <span>Facturacion total</span>
            <strong>{formatMoney(revenueReport?.totalRevenue || 0)}</strong>
          </article>
          <article className="reports-summary-card">
            <span>Promedio por venta</span>
            <strong>{formatMoney(salesReport?.summary.averageSale || 0)}</strong>
          </article>

          <div className="card reports-panel">
            <div className="reports-panel-head">
              <div>
                <p className="reports-panel-kicker">Articulos</p>
                <h3>Top vendidos</h3>
              </div>
              <input value={articlesSearch} onChange={(event: ChangeEvent<HTMLInputElement>) => setArticlesSearch(event.target.value)} placeholder="Buscar articulo..." />
            </div>
            <table className="products-table">
              <thead>
                <tr>
                  <th>Codigo</th>
                  <th>Descripcion</th>
                  <th>Vendidos</th>
                  <th>Stock</th>
                  <th>Ingresos</th>
                </tr>
              </thead>
              <tbody>
                {filteredTopSelling.length === 0 ? (
                  <tr><td colSpan={5} className="reports-empty-row">No hay articulos para mostrar.</td></tr>
                ) : (
                  filteredTopSelling.slice(0, 15).map((item) => (
                    <tr key={item.id}>
                      <td>{item.sku || `ART-${item.id}`}</td>
                      <td>{item.name}</td>
                      <td>{item.totalSold}</td>
                      <td>{item.stock}</td>
                      <td>{formatMoney(item.totalRevenue)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="card reports-panel">
            <div className="reports-panel-head">
              <div>
                <p className="reports-panel-kicker">Alertas</p>
                <h3>Stock critico</h3>
              </div>
            </div>
            <table className="products-table">
              <thead>
                <tr>
                  <th>Articulo</th>
                  <th>Rubro</th>
                  <th>Stock</th>
                  <th>Minimo</th>
                </tr>
              </thead>
              <tbody>
                {(productsReport?.lowStock || []).length === 0 ? (
                  <tr><td colSpan={4} className="reports-empty-row">No hay articulos con stock critico.</td></tr>
                ) : (
                  (productsReport?.lowStock || []).slice(0, 12).map((item) => (
                    <tr key={item.id}>
                      <td>{item.name || `Articulo ${item.id}`}</td>
                      <td>{item.category_name || '-'}</td>
                      <td>{item.stock}</td>
                      <td>{item.min_stock}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="card reports-panel">
            <div className="reports-panel-head">
              <div>
                <p className="reports-panel-kicker">Reparaciones</p>
                <h3>Resumen por estado</h3>
              </div>
            </div>
            <table className="products-table">
              <thead>
                <tr>
                  <th>Estado</th>
                  <th>Cantidad</th>
                  <th>Ingresos</th>
                </tr>
              </thead>
              <tbody>
                {(repairsReport?.byStatus || []).length === 0 ? (
                  <tr><td colSpan={3} className="reports-empty-row">No hay datos de reparaciones.</td></tr>
                ) : (
                  (repairsReport?.byStatus || []).map((item) => (
                    <tr key={String(item.status || 'unknown')}>
                      <td>{item.status || '-'}</td>
                      <td>{item.count}</td>
                      <td>{formatMoney(item.totalRevenue)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      {pageId === 'reports-sales' ? (
        <div className="card reports-panel">
          <div className="reports-panel-head">
            <div>
              <p className="reports-panel-kicker">Ventas</p>
                <h3>Ventas</h3>
            </div>
            <input value={salesSearch} onChange={(event: ChangeEvent<HTMLInputElement>) => setSalesSearch(event.target.value)} placeholder="Buscar comprobante, cliente o notas..." />
          </div>
          <div className="reports-sales-summary">
            <article className="reports-summary-card"><span>Total facturado</span><strong>{formatMoney(salesReport?.summary.totalRevenue || 0)}</strong></article>
            <article className="reports-summary-card"><span>Transacciones</span><strong>{salesReport?.summary.totalTransactions || 0}</strong></article>
            <article className="reports-summary-card"><span>Promedio</span><strong>{formatMoney(salesReport?.summary.averageSale || 0)}</strong></article>
          </div>
          <table className="products-table">
            <thead>
              <tr>
                <th>Comprobante</th>
                <th>Cliente</th>
                <th>Usuario</th>
                <th>Fecha</th>
                <th>Total</th>
              </tr>
            </thead>
            <tbody>
              {filteredSales.length === 0 ? (
                <tr><td colSpan={5} className="reports-empty-row">No hay ventas para mostrar.</td></tr>
              ) : (
                filteredSales.slice(0, 30).map((sale) => (
                  <tr key={sale.id}>
                    <td>{sale.receipt_type || 'C'} {sale.point_of_sale || '001'}-{String(Number(sale.receipt_number || sale.id || 0)).padStart(8, '0')}</td>
                    <td>{sale.customer_name || 'Consumidor Final'}</td>
                    <td>{sale.user_name || '-'}</td>
                    <td>{sale.created_at ? new Date(sale.created_at).toLocaleString('es-AR') : '-'}</td>
                    <td>{formatMoney(sale.total || 0)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      ) : null}

      {pageId === 'reports-purchases' ? (
        <div className="card reports-panel">
          <div className="reports-panel-head">
            <div>
              <p className="reports-panel-kicker">Compras</p>
                <h3>Compras</h3>
            </div>
            <input value={purchasesSearch} onChange={(event: ChangeEvent<HTMLInputElement>) => setPurchasesSearch(event.target.value)} placeholder="Buscar proveedor, numero o notas..." />
          </div>
          <table className="products-table">
            <thead>
              <tr>
                <th>Proveedor</th>
                <th>Comprobante</th>
                <th>Fecha</th>
                <th>Total</th>
                <th>Estado</th>
              </tr>
            </thead>
            <tbody>
              {purchaseRows.length === 0 ? (
                <tr><td colSpan={5} className="reports-empty-row">No hay compras para mostrar.</td></tr>
              ) : (
                purchaseRows.map((purchase) => (
                  <tr key={purchase.id}>
                    <td>{purchase.supplier_name || '-'}</td>
                    <td>{[purchase.invoice_type, purchase.invoice_number].filter(Boolean).join(' - ') || '-'}</td>
                    <td>{purchase.invoice_date || '-'}</td>
                    <td>{formatMoney(purchase.total || 0)}</td>
                    <td>{purchase.status || '-'}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      ) : null}

      {pageId === 'reports-customers' ? (
        <div className="card reports-panel">
          <div className="reports-panel-head">
            <div>
              <p className="reports-panel-kicker">Clientes</p>
                <h3>Clientes</h3>
            </div>
            <input value={customersSearch} onChange={(event: ChangeEvent<HTMLInputElement>) => setCustomersSearch(event.target.value)} placeholder="Buscar cliente, telefono, email o CUIT..." />
          </div>
          <table className="products-table">
            <thead>
              <tr>
                <th>Cliente</th>
                <th>Telefono</th>
                <th>Email</th>
                <th>Compras</th>
                <th>Total gastado</th>
              </tr>
            </thead>
            <tbody>
              {customerRows.length === 0 ? (
                <tr><td colSpan={5} className="reports-empty-row">No hay clientes para mostrar.</td></tr>
              ) : (
                customerRows.slice(0, 40).map((customer) => (
                  <tr key={customer.id}>
                    <td>{customer.name}</td>
                    <td>{customer.phone || '-'}</td>
                    <td>{customer.email || '-'}</td>
                    <td>{customer.salesCount}</td>
                    <td>{formatMoney(customer.totalSpent)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      ) : null}

      {pageId === 'reports-delivery-notes' ? (
        <div className="card reports-panel">
          <div className="reports-panel-head">
            <div>
              <p className="reports-panel-kicker">Remitos</p>
                <h3>Remitos</h3>
            </div>
            <input value={salesSearch} onChange={(event: ChangeEvent<HTMLInputElement>) => setSalesSearch(event.target.value)} placeholder="Buscar cliente, vendedor o notas..." />
          </div>
          <table className="products-table">
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Cliente</th>
                <th>Canal</th>
                <th>Estado</th>
                <th>Total</th>
              </tr>
            </thead>
            <tbody>
              {filteredSales.length === 0 ? (
                <tr><td colSpan={5} className="reports-empty-row">No hay remitos para mostrar.</td></tr>
              ) : (
                filteredSales.slice(0, 30).map((sale) => (
                  <tr key={sale.id}>
                    <td>{sale.created_at ? new Date(sale.created_at).toLocaleString('es-AR') : '-'}</td>
                    <td>{sale.customer_name || 'Consumidor Final'}</td>
                    <td>{sale.channel || '-'}</td>
                    <td>{sale.status || '-'}</td>
                    <td>{formatMoney(sale.total || 0)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      ) : null}

      {pageId === 'reports-accounts' ? (
        <div className="card reports-panel">
          <div className="reports-panel-head">
            <div>
              <p className="reports-panel-kicker">Cuentas corrientes</p>
                <h3>Cuentas corrientes</h3>
            </div>
            <input value={customersSearch} onChange={(event: ChangeEvent<HTMLInputElement>) => setCustomersSearch(event.target.value)} placeholder="Buscar cliente..." />
          </div>
          <table className="products-table">
            <thead>
              <tr>
                <th>Cliente</th>
                <th>Telefono</th>
                <th>Compras</th>
                <th>Saldo estimado</th>
              </tr>
            </thead>
            <tbody>
              {customerRows.length === 0 ? (
                <tr><td colSpan={4} className="reports-empty-row">No hay cuentas para mostrar.</td></tr>
              ) : (
                customerRows.filter((customer) => customer.totalSpent > 0).slice(0, 40).map((customer) => (
                  <tr key={customer.id}>
                    <td>{customer.name}</td>
                    <td>{customer.phone || '-'}</td>
                    <td>{customer.salesCount}</td>
                    <td>{formatMoney(customer.totalSpent)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      ) : null}

      {pageId === 'reports-ranking' ? (
        <div className="card reports-panel">
          <div className="reports-panel-head">
            <div>
              <p className="reports-panel-kicker">Ranking</p>
                <h3>Ranking de Ventas</h3>
            </div>
            <input value={articlesSearch} onChange={(event: ChangeEvent<HTMLInputElement>) => setArticlesSearch(event.target.value)} placeholder="Buscar articulo..." />
          </div>
          <table className="products-table">
            <thead>
              <tr>
                <th>Codigo</th>
                <th>Articulo</th>
                <th>Vendidos</th>
                <th>Stock</th>
                <th>Ingresos</th>
              </tr>
            </thead>
            <tbody>
              {filteredTopSelling.length === 0 ? (
                <tr><td colSpan={5} className="reports-empty-row">No hay articulos para mostrar.</td></tr>
              ) : (
                filteredTopSelling.map((item) => (
                  <tr key={item.id}>
                    <td>{item.sku || `ART-${item.id}`}</td>
                    <td>{item.name}</td>
                    <td>{item.totalSold}</td>
                    <td>{item.stock}</td>
                    <td>{formatMoney(item.totalRevenue)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      ) : null}

      {pageId === 'reports-cash' ? (
        <div className="reports-grid">
          <article className="reports-summary-card">
            <span>Ventas</span>
            <strong>{formatMoney(revenueReport?.salesRevenue || 0)}</strong>
          </article>
          <article className="reports-summary-card">
            <span>Reparaciones</span>
            <strong>{formatMoney(revenueReport?.repairsRevenue || 0)}</strong>
          </article>
          <article className="reports-summary-card">
            <span>Total del periodo</span>
            <strong>{formatMoney(revenueReport?.totalRevenue || 0)}</strong>
          </article>
          <div className="card reports-panel">
            <div className="reports-panel-head">
              <div>
                <p className="reports-panel-kicker">Caja</p>
                <h3>Caja</h3>
              </div>
            </div>
            <table className="products-table">
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Cliente</th>
                  <th>Usuario</th>
                  <th>Total</th>
                </tr>
              </thead>
              <tbody>
                {filteredSales.length === 0 ? (
                  <tr><td colSpan={4} className="reports-empty-row">No hay movimientos para mostrar.</td></tr>
                ) : (
                  filteredSales.slice(0, 20).map((sale) => (
                    <tr key={sale.id}>
                      <td>{sale.created_at ? new Date(sale.created_at).toLocaleString('es-AR') : '-'}</td>
                      <td>{sale.customer_name || 'Consumidor Final'}</td>
                      <td>{sale.user_name || '-'}</td>
                      <td>{formatMoney(sale.total || 0)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      {pageId === 'reports-excel' ? (
        <div className="card reports-panel">
          <div className="reports-panel-head">
            <div>
              <p className="reports-panel-kicker">Excel</p>
                <h3>Excel</h3>
            </div>
          </div>
          <div className="tools-actions-row">
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => downloadCsv('reporte-ventas.csv', [
                ['Comprobante', 'Cliente', 'Fecha', 'Total'],
                ...filteredSales.map((sale) => [
                  `${sale.receipt_type || 'C'} ${sale.point_of_sale || '001'}-${String(Number(sale.receipt_number || sale.id || 0)).padStart(8, '0')}`,
                  sale.customer_name || 'Consumidor Final',
                  sale.created_at || '',
                  String(sale.total || 0)
                ])
              ])}
            >
              Exportar ventas
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => downloadCsv('reporte-compras.csv', [
                ['Proveedor', 'Comprobante', 'Fecha', 'Total'],
                ...purchaseRows.map((purchase) => [
                  purchase.supplier_name || '-',
                  [purchase.invoice_type, purchase.invoice_number].filter(Boolean).join(' - '),
                  purchase.invoice_date || '',
                  String(purchase.total || 0)
                ])
              ])}
            >
              Exportar compras
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => downloadCsv('reporte-clientes.csv', [
                ['Cliente', 'Telefono', 'Email', 'Compras', 'Total'],
                ...customerRows.map((customer) => [
                  customer.name,
                  customer.phone || '',
                  customer.email || '',
                  String(customer.salesCount),
                  String(customer.totalSpent)
                ])
              ])}
            >
              Exportar clientes
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

