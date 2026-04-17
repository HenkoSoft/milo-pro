import { useMemo, useState, type ChangeEvent } from 'react';
import { useQueries } from '@tanstack/react-query';
import { getCashMovements } from '../../services/cash';
import { getCategories } from '../../services/catalog';
import { getCustomers } from '../../services/customers';
import { getPurchases, getSuppliers } from '../../services/purchases';
import { getProducts } from '../../services/products';
import { getSalesReport } from '../../services/reports';
import type { CashMovement } from '../../types/cash';
import type { Category } from '../../types/catalog';
import type { Customer } from '../../types/customer';
import type { Product } from '../../types/product';
import type { Purchase, Supplier } from '../../types/purchase';
import type { Sale } from '../../types/sale';

const REPORT_SECTIONS = {
  articles: { title: 'Reportes de Articulos', subtitle: 'Filtros simples, tabla clara y exportacion directa para control de stock y catalogo.', reportTypes: ['Listado de Articulos', 'Listado de Articulos por Rubro', 'Stock Valorizado', 'Listado de Stock Critico', 'Stock Inicial', 'Ajuste de Stock', 'Stock con Ubicacion', 'Salidas por Articulos'], search: 'Buscar articulo...' },
  sales: { title: 'Reportes de Ventas', subtitle: 'Pantalla unificada para consultas comerciales, margenes y seguimiento diario.', reportTypes: ['Resumen del dia', 'Resumen entre fechas', 'Ganancia entre fechas', 'Ganancia entre fechas (incluye NC)', 'Ventas del dia', 'Ventas entre fechas', 'Total de ventas por dia (incluye NC)', 'Ventas con medios de pago digital', 'Ventas con descuento', 'Total ventas mensuales', 'Ventas por articulo', 'Ventas por zona', 'Ventas por zona detallada', 'Ventas por usuario', 'Resumen de ventas por marca', 'Ventas de una marca', 'Ventas por rubro', 'Ventas por rubro detallado', 'Ventas de un rubro', 'IVA ventas', 'IVA ventas Excel', 'IVA ventas agrupado (Excel)', 'IVA ventas Excel por provincia', 'Facturas anuladas'], search: 'Buscar comprobante, cliente o articulo...' },
  purchases: { title: 'Reportes de Compras', subtitle: 'Consultas de compras preparadas para filtrar rapidamente por proveedor y fechas.', reportTypes: ['Compras del dia', 'Compras entre fechas', 'Compras por articulo', 'Compras por proveedor'], search: 'Buscar compra o proveedor...' },
  customers: { title: 'Reportes de Clientes', subtitle: 'Seguimiento comercial por cliente, vendedor y comportamiento de compra.', reportTypes: ['Listado por nombre', 'Listado de clientes a Excel', 'Cumpleanos del mes', 'Clientes activos', 'Clientes por vendedor / zona', 'Articulos comprados por un cliente', 'Ventas por cliente', 'Comprobantes por cliente', 'Ganancias por cliente', 'Ranking de articulos vendidos'], search: 'Buscar cliente...' },
  deliveryNotes: { title: 'Reportes de Remitos', subtitle: 'Consulta operativa con la misma estetica de Ventas para revisar entregas y pendientes.', reportTypes: ['Articulos enviados con remito', 'Remitos entre fechas', 'Remitos sin facturar', 'Remitos sin facturar por cliente', 'Remitos por vendedor', 'Remitos por vendedor detallado', 'Remitos por usuario'], search: 'Buscar remito o cliente...' },
  accounts: { title: 'Reportes de Cuentas Corrientes', subtitle: 'Vista administrativa para deudores, cobranzas y saldo pendiente por cliente.', reportTypes: ['Ventas a cuenta corriente', 'Cobranzas entre fechas', 'Deudores', 'Deudores por vendedor', 'Deudores por zona', 'Clientes con saldo a favor'], search: 'Buscar cliente o zona...' },
  ranking: { title: 'Ranking de Ventas', subtitle: 'Comparativos rapidos para detectar articulos, clientes y vendedores destacados.', reportTypes: ['Ranking por articulo', 'Ranking por cliente', 'Ranking por vendedor'], search: 'Buscar entidad del ranking...' },
  cash: { title: 'Reportes de Caja', subtitle: 'Resumen diario de ingresos y egresos para control financiero operativo.', reportTypes: ['Caja diaria', 'Ingresos varios diarios', 'Gastos varios diarios', 'Gastos por descripcion', 'Retiros diarios'], search: 'Buscar movimiento de caja...' },
  excel: { title: 'Reportes a Excel', subtitle: 'Generador simple para exportaciones rapidas sin salir del flujo administrativo.', reportTypes: [], search: '' }
} as const;

const PAGE_SECTION = {
  reports: 'articles',
  'reports-sales': 'sales',
  'reports-purchases': 'purchases',
  'reports-customers': 'customers',
  'reports-delivery-notes': 'deliveryNotes',
  'reports-accounts': 'accounts',
  'reports-ranking': 'ranking',
  'reports-cash': 'cash',
  'reports-excel': 'excel'
} as const;

const EXCEL_MODULE_SECTION: Record<string, SectionId> = {
  Articulos: 'articles',
  Ventas: 'sales',
  Compras: 'purchases',
  Clientes: 'customers',
  Remitos: 'deliveryNotes',
  'Cuentas Corrientes': 'accounts',
  'Ranking de Ventas': 'ranking',
  Caja: 'cash'
};

type SectionId = keyof typeof REPORT_SECTIONS;
type Cell = string | number;
type Filters = { from: string; to: string; customer: string; seller: string; supplier: string; category: string; user: string; type: string; top: string; cashType: string };
type Result = { columns: string[]; rows: Cell[][]; summary: Array<{ label: string; value: Cell }> };
type SaleRow = { sale: Sale; date: string; number: string; customer: string; seller: string; zone: string; user: string; type: string; article: string; code: string; qty: number; price: number; cost: number; total: number; gain: number };

const DEFAULT_FILTERS: Filters = { from: '', to: '', customer: '', seller: '', supplier: '', category: '', user: '', type: '', top: '10', cashType: '' };

function money(value: number) {
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', minimumFractionDigits: 2 }).format(Number(value || 0));
}

function dateText(value?: string | null) {
  if (!value) return '-';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? String(value).slice(0, 10) || '-' : date.toLocaleDateString('es-AR');
}

function inputDate(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function normalize(value: unknown) {
  return String(value || '').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function sectionFromPage(pageId: string): SectionId {
  return PAGE_SECTION[pageId as keyof typeof PAGE_SECTION] || 'articles';
}

function categoryName(id: number | string | null | undefined, categories: Category[]) {
  return categories.find((item) => String(item.id) === String(id))?.name || '-';
}

function between<T>(rows: T[], filters: Filters, getDate: (row: T) => string | undefined) {
  return rows.filter((row) => {
    const value = String(getDate(row) || '').slice(0, 10);
    if (filters.from && value < filters.from) return false;
    if (filters.to && value > filters.to) return false;
    return true;
  });
}

function searchRows<T>(rows: T[], search: string, getters: Array<(row: T) => unknown>) {
  const term = normalize(search);
  if (!term) return rows;
  return rows.filter((row) => getters.some((getter) => normalize(getter(row)).includes(term)));
}

function saleNumber(sale: Sale) {
  return `${String(sale.point_of_sale || '001').padStart(3, '0')}-${String(sale.receipt_number || sale.id || 0).padStart(8, '0')}`;
}

function receiptTypeOf(sale: Sale) {
  return String(sale.receipt_type || '').trim().toUpperCase();
}

function isInvoiceLikeSale(sale: Sale) {
  return !['REMITO', 'PRESUPUESTO', 'PEDIDO', 'NOTA_CREDITO'].includes(receiptTypeOf(sale));
}

function isDeliveryNoteSale(sale: Sale) {
  return receiptTypeOf(sale) === 'REMITO';
}

function isCreditNoteSale(sale: Sale) {
  return receiptTypeOf(sale) === 'NOTA_CREDITO';
}

function signedSaleTotal(sale: Sale) {
  const total = Number(sale.total || 0);
  return isCreditNoteSale(sale) ? -total : total;
}

function buildSaleRows(sales: Sale[], customers: Customer[], products: Product[]): SaleRow[] {
  return sales.flatMap((sale) => {
    const customer = customers.find((item) => String(item.id) === String(sale.customer_id));
    const multiplier = isCreditNoteSale(sale) ? -1 : 1;
    const base = {
      sale,
      date: sale.created_at || '',
      number: saleNumber(sale),
      customer: sale.customer_name || customer?.name || 'Consumidor Final',
      seller: customer?.seller || sale.user_name || '-',
      zone: customer?.zone || '-',
      user: sale.user_name || '-',
      type: sale.receipt_type || 'C'
    };
    if (!sale.items?.length) return [{ ...base, article: '-', code: '-', qty: 0, price: 0, cost: 0, total: Number(sale.total || 0) * multiplier, gain: Number(sale.total || 0) * multiplier }];
    return sale.items.map((item) => {
      const product = products.find((entry) => String(entry.id) === String(item.product_id));
      const qty = Number(item.quantity || 0);
      const price = Number(item.unit_price || 0);
      const total = Number(item.subtotal || qty * price || 0) * multiplier;
      const cost = Number(product?.purchase_price || 0);
      return { ...base, article: item.product_name || product?.name || '-', code: item.sku || product?.sku || product?.barcode || '-', qty: qty * multiplier, price, cost, total, gain: total - qty * cost * multiplier };
    });
  });
}

function buildResult(section: SectionId, data: { products: Product[]; categories: Category[]; customers: Customer[]; sales: Sale[]; purchases: Purchase[]; saleRows: SaleRow[]; cashMovements: CashMovement[] }, filters: Filters, reportType: string, search: string): Result {
  if (section === 'articles') {
    const sold = new Map<string, number>();
    data.saleRows.forEach((row) => row.code !== '-' && sold.set(row.code, (sold.get(row.code) || 0) + row.qty));
    let rows = data.products.map((product) => {
      const code = product.sku || product.barcode || `ART-${product.id}`;
      const stock = Number(product.stock || 0);
      const cost = Number(product.purchase_price || 0);
      return { code, description: product.name, rubro: '-', brand: product.brand_name || '-', stock, cost, price: Number(product.sale_price || 0), valueStock: stock * cost, location: '-', category: product.category_name || categoryName(product.category_id || product.category_primary_id, data.categories), supplier: product.supplier || '-', moved: sold.get(code) || 0, min: Number(product.min_stock || 0) };
    });
    if (filters.category) rows = rows.filter((row) => row.category === categoryName(filters.category, data.categories));
    if (filters.supplier) rows = rows.filter((row) => row.supplier === filters.supplier);
    if (reportType === 'Listado de Stock Critico') rows = rows.filter((row) => row.stock <= row.min);
    if (reportType === 'Salidas por Articulos') rows = rows.filter((row) => row.moved > 0);
    rows = searchRows(rows, search, [(row) => row.code, (row) => row.description, (row) => row.supplier, (row) => row.category]);
    return { columns: ['Codigo', 'Descripcion', 'Rubro', 'Marca', 'Stock', 'Costo', 'Precio', 'Valor stock', 'Ubicacion'], rows: rows.map((row) => [row.code, row.description, row.rubro, row.brand, row.stock, money(row.cost), money(row.price), money(row.valueStock), row.location]), summary: [{ label: 'Articulos listados', value: rows.length }, { label: 'Stock total', value: rows.reduce((acc, row) => acc + row.stock, 0) }, { label: 'Valor stock', value: money(rows.reduce((acc, row) => acc + row.valueStock, 0)) }, { label: 'Categorias', value: new Set(rows.map((row) => row.category).filter(Boolean)).size }] };
  }

  if (section === 'sales') {
    let rows = between(data.saleRows.filter((row) => isInvoiceLikeSale(row.sale) || isCreditNoteSale(row.sale)), filters, (row) => row.date);
    if (filters.customer) rows = rows.filter((row) => String(row.sale.customer_id || '') === String(filters.customer));
    if (filters.seller) rows = rows.filter((row) => row.seller === filters.seller);
    if (filters.type) rows = rows.filter((row) => row.type === filters.type);
    if (!reportType.includes('incluye NC')) rows = rows.filter((row) => !isCreditNoteSale(row.sale));
    if (reportType === 'Ventas con medios de pago digital') rows = rows.filter((row) => normalize(row.sale.payment_method) !== 'cash');
    rows = searchRows(rows, search, [(row) => row.number, (row) => row.customer, (row) => row.article, (row) => row.seller, (row) => row.zone]);
    return { columns: ['Fecha', 'Numero comprobante', 'Cliente', 'Articulo', 'Cantidad', 'Precio', 'Costo', 'Descuento', 'Total', 'Ganancia'], rows: rows.map((row) => [dateText(row.date), row.number, row.customer, row.article, row.qty, money(row.price), money(row.cost), '0%', money(row.total), money(row.gain)]), summary: [{ label: 'Total vendido', value: money(rows.reduce((acc, row) => acc + row.total, 0)) }, { label: 'Total costo', value: money(rows.reduce((acc, row) => acc + row.cost * row.qty, 0)) }, { label: 'Total ganancia', value: money(rows.reduce((acc, row) => acc + row.gain, 0)) }, { label: 'Comprobantes', value: new Set(rows.map((row) => row.number)).size }] };
  }

  if (section === 'purchases') {
    let rows = data.purchases.map((purchase) => ({ date: purchase.invoice_date || '', number: purchase.invoice_number || '-', supplier: purchase.supplier_name || '-', article: 'Compra general', qty: '-', cost: Number(purchase.subtotal || purchase.total || 0), total: Number(purchase.total || 0) }));
    rows = between(rows, filters, (row) => row.date);
    if (filters.supplier) rows = rows.filter((row) => row.supplier === filters.supplier);
    rows = searchRows(rows, search, [(row) => row.number, (row) => row.supplier, (row) => row.article]);
    return { columns: ['Fecha', 'Numero comprobante', 'Proveedor', 'Articulo', 'Cantidad', 'Costo unitario', 'Total'], rows: rows.map((row) => [dateText(row.date), row.number, row.supplier, row.article, row.qty, money(row.cost), money(row.total)]), summary: [{ label: 'Compras', value: rows.length }, { label: 'Proveedores', value: new Set(rows.map((row) => row.supplier)).size }, { label: 'Total invertido', value: money(rows.reduce((acc, row) => acc + row.total, 0)) }, { label: 'Promedio', value: money(rows.length ? rows.reduce((acc, row) => acc + row.total, 0) / rows.length : 0) }] };
  }

  if (section === 'customers' || section === 'accounts') {
    let rows = data.customers.map((customer) => {
      const sales = data.sales.filter((sale) => String(sale.customer_id || '') === String(customer.id) && (isInvoiceLikeSale(sale) || isCreditNoteSale(sale)));
      const total = sales.reduce((acc, sale) => acc + signedSaleTotal(sale), 0);
      const last = sales[0]?.created_at || '';
      return { code: customer.id, name: customer.name || '-', taxId: customer.tax_id || '-', phone: customer.phone || '-', zone: customer.zone || '-', count: sales.length, total, last, seller: customer.seller || '-' };
    });
    rows = between(rows, filters, (row) => row.last);
    if (filters.customer) rows = rows.filter((row) => String(row.code) === String(filters.customer));
    if (filters.seller) rows = rows.filter((row) => row.seller === filters.seller);
    rows = searchRows(rows, search, [(row) => row.name, (row) => row.taxId, (row) => row.phone, (row) => row.zone]);
    if (section === 'accounts') return { columns: ['Cliente', 'Saldo', 'Fecha ultimo movimiento', 'Total facturado', 'Total cobrado', 'Saldo pendiente'], rows: rows.map((row) => [row.name, money(row.total), dateText(row.last), money(row.total), money(0), money(row.total)]), summary: [{ label: 'Clientes con saldo', value: rows.filter((row) => row.total > 0).length }, { label: 'Total facturado', value: money(rows.reduce((acc, row) => acc + row.total, 0)) }, { label: 'Total cobrado', value: money(0) }, { label: 'Saldo pendiente', value: money(rows.reduce((acc, row) => acc + row.total, 0)) }] };
    return { columns: ['Codigo cliente', 'Nombre', 'CUIT', 'Telefono', 'Zona', 'Total compras', 'Total gastado', 'Ultima compra'], rows: rows.map((row) => [row.code, row.name, row.taxId, row.phone, row.zone, row.count, money(row.total), dateText(row.last)]), summary: [{ label: 'Clientes listados', value: rows.length }, { label: 'Clientes activos', value: rows.filter((row) => row.count > 0).length }, { label: 'Total gastado', value: money(rows.reduce((acc, row) => acc + row.total, 0)) }, { label: 'Zonas', value: new Set(rows.map((row) => row.zone).filter((value) => value && value !== '-')).size }] };
  }

  if (section === 'deliveryNotes') {
    let rows = between(data.saleRows.filter((row) => isDeliveryNoteSale(row.sale)), filters, (row) => row.date);
    if (filters.customer) rows = rows.filter((row) => String(row.sale.customer_id || '') === String(filters.customer));
    if (filters.seller) rows = rows.filter((row) => row.seller === filters.seller);
    if (filters.user) rows = rows.filter((row) => row.user === filters.user);
    rows = searchRows(rows, search, [(row) => row.number, (row) => row.customer, (row) => row.article, (row) => row.seller]);
    return { columns: ['Fecha', 'Numero remito', 'Cliente', 'Articulo', 'Cantidad', 'Estado stock'], rows: rows.map((row) => [dateText(row.date), row.number, row.customer, row.article, row.qty, row.sale.stock_applied_state === 'applied' ? 'Stock descontado' : 'Stock no descontado']), summary: [{ label: 'Remitos listados', value: new Set(rows.map((row) => row.number)).size }, { label: 'Items enviados', value: rows.reduce((acc, row) => acc + row.qty, 0) }, { label: 'Clientes', value: new Set(rows.map((row) => row.customer)).size }, { label: 'Usuarios', value: new Set(rows.map((row) => row.user)).size }] };
  }

  if (section === 'ranking') {
    const ranking = new Map<string, { qty: number; total: number }>();
    between(data.saleRows.filter((row) => isInvoiceLikeSale(row.sale) || isCreditNoteSale(row.sale)), filters, (row) => row.date).forEach((row) => {
      const key = reportType === 'Ranking por cliente' ? row.customer : reportType === 'Ranking por vendedor' ? row.seller : row.article;
      const current = ranking.get(key) || { qty: 0, total: 0 };
      current.qty += row.qty;
      current.total += row.total;
      ranking.set(key, current);
    });
    const totalSold = [...ranking.values()].reduce((acc, row) => acc + row.total, 0);
    let rows = [...ranking.entries()].map(([entity, values]) => ({ entity, ...values, share: totalSold > 0 ? values.total / totalSold * 100 : 0 })).sort((a, b) => b.total - a.total);
    rows = searchRows(rows, search, [(row) => row.entity]).slice(0, Math.max(1, Number(filters.top || 10)));
    return { columns: ['Posicion', 'Entidad', 'Cantidad vendida', 'Total vendido', 'Participacion %'], rows: rows.map((row, index) => [index + 1, row.entity, row.qty, money(row.total), `${row.share.toFixed(2)}%`]), summary: [{ label: 'Top mostrado', value: rows.length }, { label: 'Total vendido', value: money(totalSold) }, { label: 'Cantidad total', value: rows.reduce((acc, row) => acc + row.qty, 0) }, { label: 'Reporte', value: reportType.replace('Ranking ', '') }] };
  }

  if (section === 'cash') {
    const income = data.cashMovements.filter((item) => item.type === 'income').map((item) => ({ date: item.date || '', type: 'Ingreso', description: item.description || '-', user: 'Caja', amount: Number(item.amount || 0) }));
    const expenses = data.cashMovements.filter((item) => item.type === 'expenses').map((item) => ({ date: item.date || '', type: 'Gasto', description: item.description || '-', user: 'Caja', amount: -Math.abs(Number(item.amount || 0)) }));
    const withdrawals = data.cashMovements.filter((item) => item.type === 'withdrawals').map((item) => ({ date: item.date || '', type: 'Retiro', description: item.description || '-', user: item.person || 'Caja', amount: -Math.abs(Number(item.amount || 0)) }));
    const cashSales = data.sales.filter((sale) => normalize(sale.payment_method || 'cash') === 'cash').map((sale) => ({ date: sale.created_at || '', type: 'Venta', description: 'Venta en efectivo', user: sale.user_name || 'Caja', amount: Number(sale.total || 0) }));
    let rows = between([...cashSales, ...income, ...expenses, ...withdrawals], filters, (row) => row.date);
    if (filters.cashType) rows = rows.filter((row) => normalize(row.type) === normalize(filters.cashType));
    rows = searchRows(rows, search, [(row) => row.type, (row) => row.description, (row) => row.user]);
    const totalIncome = rows.filter((row) => row.amount >= 0).reduce((acc, row) => acc + row.amount, 0);
    const totalExpense = rows.filter((row) => row.amount < 0).reduce((acc, row) => acc + Math.abs(row.amount), 0);
    return { columns: ['Fecha', 'Tipo', 'Descripcion', 'Usuario', 'Importe'], rows: rows.map((row) => [dateText(row.date), row.type, row.description, row.user, money(row.amount)]), summary: [{ label: 'Total ingresos', value: money(totalIncome) }, { label: 'Total egresos', value: money(totalExpense) }, { label: 'Saldo', value: money(totalIncome - totalExpense) }, { label: 'Movimientos', value: rows.length }] };
  }

  return { columns: [], rows: [], summary: [] };
}

function excelSectionFromModule(moduleName: string): SectionId | null {
  return EXCEL_MODULE_SECTION[moduleName] || null;
}

function exportCsv(filename: string, columns: string[], rows: Cell[][]) {
  const csv = [columns, ...rows].map((row) => row.map((cell) => `"${String(cell ?? '').replace(/"/g, '""')}"`).join(';')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function printReportDocument(title: string, subtitle: string, summary: Array<{ label: string; value: Cell }>, columns: string[], rows: Cell[][]) {
  const popup = window.open('', '_blank', 'width=1200,height=800');
  if (!popup) {
    window.alert('No se pudo abrir la vista de impresion.');
    return;
  }

  const summaryHtml = summary
    .map((item) => `<div class="report-summary-card"><span>${String(item.label)}</span><strong>${String(item.value)}</strong></div>`)
    .join('');

  const headerHtml = columns.map((column) => `<th>${String(column)}</th>`).join('');
  const bodyHtml = rows.length === 0
    ? `<tr><td colspan="${Math.max(1, columns.length)}" class="report-empty-row">No hay resultados para los filtros seleccionados.</td></tr>`
    : rows
      .map((row) => `<tr>${row.map((cell) => `<td>${String(cell ?? '')}</td>`).join('')}</tr>`)
      .join('');

  popup.document.write(`
    <html>
      <head>
        <title>${title}</title>
        <style>
          body { font-family: Arial, sans-serif; color: #111; margin: 24px; }
          .report-head { margin-bottom: 20px; }
          .report-head h1 { margin: 0 0 8px; font-size: 24px; }
          .report-head p { margin: 0; color: #555; font-size: 14px; }
          .report-summary-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 12px; margin: 20px 0; }
          .report-summary-card { border: 1px solid #d1d5db; border-radius: 8px; padding: 12px; }
          .report-summary-card span { display: block; font-size: 12px; color: #6b7280; margin-bottom: 6px; }
          .report-summary-card strong { font-size: 16px; }
          table { width: 100%; border-collapse: collapse; }
          th, td { border: 1px solid #d1d5db; padding: 8px 10px; text-align: left; font-size: 12px; vertical-align: top; }
          th { background: #f3f4f6; font-weight: 700; }
          .report-empty-row { text-align: center; color: #6b7280; }
          @media print {
            body { margin: 12px; }
          }
        </style>
      </head>
      <body>
        <div class="report-head">
          <h1>${title}</h1>
          <p>${subtitle}</p>
        </div>
        ${summary.length ? `<div class="report-summary-grid">${summaryHtml}</div>` : ''}
        <table>
          <thead>
            <tr>${headerHtml}</tr>
          </thead>
          <tbody>
            ${bodyHtml}
          </tbody>
        </table>
      </body>
    </html>
  `);
  popup.document.close();
  popup.focus();
  popup.print();
}

export function ReportsPage({ pageId }: { pageId: string }) {
  const section = sectionFromPage(pageId);
  const [filtersBySection, setFiltersBySection] = useState<Record<string, Filters>>({});
  const [searchBySection, setSearchBySection] = useState<Record<string, string>>({});
  const [pageBySection, setPageBySection] = useState<Record<string, number>>({});
  const [typeBySection, setTypeBySection] = useState<Record<string, string>>({});
  const [excelModule, setExcelModule] = useState('');
  const [excelType, setExcelType] = useState('');
  const [excelFrom, setExcelFrom] = useState(() => inputDate(new Date()));
  const [excelTo, setExcelTo] = useState(() => inputDate(new Date()));

  const [productsQuery, categoriesQuery, customersQuery, salesQuery, purchasesQuery, suppliersQuery, cashMovementsQuery] = useQueries({
    queries: [
      { queryKey: ['reports', 'products-source'], queryFn: () => getProducts({}), staleTime: 30_000 },
      { queryKey: ['reports', 'categories-source'], queryFn: getCategories, staleTime: 30_000 },
      { queryKey: ['reports', 'customers-source'], queryFn: () => getCustomers(''), staleTime: 30_000 },
      { queryKey: ['reports', 'sales-source'], queryFn: () => getSalesReport({}), staleTime: 30_000 },
      { queryKey: ['reports', 'purchases-source'], queryFn: getPurchases, staleTime: 30_000 },
      { queryKey: ['reports', 'suppliers-source'], queryFn: getSuppliers, staleTime: 30_000 },
      { queryKey: ['reports', 'cash-source'], queryFn: () => getCashMovements({}), staleTime: 30_000 }
    ]
  });

  const queries = [productsQuery, categoriesQuery, customersQuery, salesQuery, purchasesQuery, suppliersQuery, cashMovementsQuery];
  const loading = queries.some((query) => query.isLoading);
  const error = queries.find((query) => query.isError)?.error;
  const products = productsQuery.data || [];
  const categories = categoriesQuery.data || [];
  const customers = customersQuery.data || [];
  const sales = salesQuery.data?.sales || [];
  const purchases = purchasesQuery.data || [];
  const suppliers = suppliersQuery.data || [];
  const cashMovements = cashMovementsQuery.data || [];
  const config = REPORT_SECTIONS[section];
  const filters = filtersBySection[section] || DEFAULT_FILTERS;
  const search = searchBySection[section] || '';
  const reportType = typeBySection[section] || config.reportTypes[0] || '';
  const currentPage = pageBySection[section] || 1;

  const sellers = useMemo(() => [...new Set(customers.map((item: Customer) => item.seller).filter(Boolean) as string[])].sort((a, b) => a.localeCompare(b)), [customers]);
  const users = useMemo(() => [...new Set(sales.map((item: Sale) => item.user_name).filter(Boolean) as string[])].sort((a, b) => a.localeCompare(b)), [sales]);
  const saleRows = useMemo(() => buildSaleRows(sales, customers, products), [customers, products, sales]);
  const result = useMemo(() => buildResult(section, { products, categories, customers, sales, purchases, saleRows, cashMovements }, filters, reportType, search), [cashMovements, categories, customers, filters, products, purchases, reportType, saleRows, sales, search, section]);
  const excelResult = useMemo(() => {
    const excelSection = excelSectionFromModule(excelModule);
    if (!excelSection) return null;
    const excelFilters: Filters = {
      ...DEFAULT_FILTERS,
      from: excelFrom,
      to: excelTo
    };
    const fallbackType = REPORT_SECTIONS[excelSection].reportTypes[0] || '';
    const normalizedType = excelType.trim() || fallbackType;
    return buildResult(
      excelSection,
      { products, categories, customers, sales, purchases, saleRows, cashMovements },
      excelFilters,
      normalizedType,
      ''
    );
  }, [cashMovements, categories, customers, excelFrom, excelModule, excelTo, excelType, products, purchases, saleRows, sales]);
  const totalPages = Math.max(1, Math.ceil(result.rows.length / 10));
  const safePage = Math.max(1, Math.min(totalPages, currentPage));
  const visibleRows = result.rows.slice((safePage - 1) * 10, safePage * 10);

  function updateFilter(field: keyof Filters, value: string) {
    setFiltersBySection((current) => ({ ...current, [section]: { ...(current[section] || DEFAULT_FILTERS), [field]: value } }));
    setPageBySection((current) => ({ ...current, [section]: 1 }));
  }

  function updateSearch(event: ChangeEvent<HTMLInputElement>) {
    setSearchBySection((current) => ({ ...current, [section]: event.target.value }));
    setPageBySection((current) => ({ ...current, [section]: 1 }));
  }

  function updateReportType(value: string) {
    setTypeBySection((current) => ({ ...current, [section]: value }));
    setPageBySection((current) => ({ ...current, [section]: 1 }));
  }

  if (loading) return <div className="loading">Cargando...</div>;
  if (error) return <div className="alert alert-warning">Error: {error instanceof Error ? error.message : 'No se pudo cargar reportes.'}</div>;

  if (section === 'excel') {
    return (
      <section className="reports-admin-content">
        <div className="reports-admin-panel card">
          <div className="reports-module-head">
            <div>
              <p className="reports-module-kicker">Reportes</p>
              <h2>Reportes a Excel</h2>
              <p>Generador de exportaciones personalizadas con filtros simples y salida rapida.</p>
            </div>
          </div>
          <div className="reports-excel-card">
            <div className="reports-filter-grid">
              <div className="form-group">
                <label>Modulo</label>
                <select value={excelModule} onChange={(event) => setExcelModule(event.target.value)}>
                  <option value="">Seleccionar modulo</option>
                  {['Articulos', 'Ventas', 'Compras', 'Clientes', 'Remitos', 'Cuentas Corrientes', 'Ranking de Ventas', 'Caja'].map((item) => <option key={item} value={item}>{item}</option>)}
                </select>
              </div>
              <div className="form-group"><label>Tipo reporte</label><input value={excelType} onChange={(event) => setExcelType(event.target.value)} placeholder="Ej. Ventas entre fechas" /></div>
              <div className="form-group"><label>Fecha desde</label><input type="date" value={excelFrom} onChange={(event) => setExcelFrom(event.target.value)} /></div>
              <div className="form-group"><label>Fecha hasta</label><input type="date" value={excelTo} onChange={(event) => setExcelTo(event.target.value)} /></div>
            </div>
            <div className="reports-toolbar-actions">
              <button
                className="btn btn-success"
                type="button"
                onClick={() => {
                  if (!excelModule || !excelResult) {
                    window.alert('Seleccione un modulo para generar el reporte.');
                    return;
                  }
                  exportCsv(
                    `reportes-excel-${normalize(excelModule)}-${inputDate(new Date())}.csv`,
                    excelResult.columns,
                    excelResult.rows
                  );
                }}
              >
                Generar Excel
              </button>
            </div>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="reports-admin-content">
      <div className="reports-admin-panel card">
        <div className="reports-module-head">
          <div>
            <p className="reports-module-kicker">Reportes</p>
            <h2>{config.title}</h2>
            <p>{config.subtitle}</p>
          </div>
          <div className="form-group reports-type-picker">
            <label>Reporte</label>
            <select value={reportType} onChange={(event) => updateReportType(event.target.value)}>
              <option value="">Seleccionar reporte</option>
              {config.reportTypes.map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
          </div>
        </div>

        <div className="reports-filter-card">
          <div className="reports-filter-grid">
            <div className="form-group"><label>Fecha desde</label><input type="date" value={filters.from} onChange={(event) => updateFilter('from', event.target.value)} /></div>
            <div className="form-group"><label>Fecha hasta</label><input type="date" value={filters.to} onChange={(event) => updateFilter('to', event.target.value)} /></div>
            <div className="form-group"><label>Cliente</label><select value={filters.customer} onChange={(event) => updateFilter('customer', event.target.value)}><option value="">Todos</option>{customers.map((item: Customer) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></div>
            <div className="form-group"><label>Vendedor</label><select value={filters.seller} onChange={(event) => updateFilter('seller', event.target.value)}><option value="">Todos</option>{sellers.map((item) => <option key={item} value={item}>{item}</option>)}</select></div>
            <div className="form-group"><label>Proveedor</label><select value={filters.supplier} onChange={(event) => updateFilter('supplier', event.target.value)}><option value="">Todos</option>{suppliers.map((item: Supplier) => <option key={item.id} value={item.name}>{item.name}</option>)}</select></div>
            <div className="form-group"><label>Categoria</label><select value={filters.category} onChange={(event) => updateFilter('category', event.target.value)}><option value="">Todas</option>{categories.map((item: Category) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></div>
            <div className="form-group"><label>Usuario</label><select value={filters.user} onChange={(event) => updateFilter('user', event.target.value)}><option value="">Todos</option>{users.map((item) => <option key={item} value={item}>{item}</option>)}</select></div>
            <div className="form-group"><label>Tipo comprobante</label><select value={filters.type} onChange={(event) => updateFilter('type', event.target.value)}><option value="">Todos</option>{['A', 'B', 'C', 'X', 'PRESUPUESTO', 'TICKET'].map((item) => <option key={item} value={item}>{item}</option>)}</select></div>
            {section === 'ranking' ? <div className="form-group"><label>Top resultados</label><input type="number" min="1" max="50" value={filters.top} onChange={(event) => updateFilter('top', event.target.value)} /></div> : null}
            {section === 'cash' ? <div className="form-group"><label>Tipo movimiento</label><select value={filters.cashType} onChange={(event) => updateFilter('cashType', event.target.value)}><option value="">Todos</option>{['Venta', 'Ingreso', 'Gasto', 'Retiro'].map((item) => <option key={item} value={item}>{item}</option>)}</select></div> : null}
          </div>
          <div className="reports-toolbar-actions">
            <button className="btn btn-primary" type="button" onClick={() => setPageBySection((current) => ({ ...current, [section]: 1 }))}>Buscar</button>
            <button className="btn btn-success" type="button" onClick={() => exportCsv(`reportes-${section}-${inputDate(new Date())}.csv`, result.columns, result.rows)}>Exportar Excel</button>
            <button className="btn btn-secondary" type="button" onClick={() => printReportDocument(config.title, config.subtitle, result.summary, result.columns, result.rows)}>Exportar PDF</button>
            <button className="btn btn-secondary" type="button" onClick={() => printReportDocument(config.title, config.subtitle, result.summary, result.columns, result.rows)}>Imprimir</button>
          </div>
        </div>

        <div className="reports-summary-grid">
          {result.summary.map((item) => <article className="reports-summary-card" key={item.label}><span>{item.label}</span><strong>{item.value}</strong></article>)}
        </div>

        <div className="reports-table-card">
          <div className="reports-table-toolbar">
            <div className="search-box reports-search-box">
              <input value={search} placeholder={config.search} onChange={updateSearch} />
            </div>
          </div>
          <div className="sales-lines-table-wrap">
            <table className="sales-lines-table">
              <thead><tr>{result.columns.map((column) => <th key={column}>{column}</th>)}</tr></thead>
              <tbody>
                {visibleRows.length === 0 ? <tr><td colSpan={result.columns.length} className="sales-empty-row">No hay resultados para los filtros seleccionados.</td></tr> : visibleRows.map((row, rowIndex) => <tr key={`${section}-${rowIndex}`}>{row.map((cell, cellIndex) => <td key={`${section}-${rowIndex}-${cellIndex}`}>{cell}</td>)}</tr>)}
              </tbody>
            </table>
          </div>
          <div className="sales-pagination">
            <span>Pagina {safePage} de {totalPages}</span>
            <div className="btn-group">
              <button className="btn btn-sm btn-secondary" type="button" onClick={() => setPageBySection((current) => ({ ...current, [section]: Math.max(1, safePage - 1) }))} disabled={safePage <= 1}>Anterior</button>
              <button className="btn btn-sm btn-secondary" type="button" onClick={() => setPageBySection((current) => ({ ...current, [section]: Math.min(totalPages, safePage + 1) }))} disabled={safePage >= totalPages}>Siguiente</button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
