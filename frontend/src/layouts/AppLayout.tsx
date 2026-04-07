import { DashboardPage } from '../features/dashboard/DashboardPage';
import { HelpPage } from '../features/help/HelpPage';
import { AdminPage } from '../features/admin/AdminPage';
import { CashPage } from '../features/cash/CashPage';
import { CustomersPage } from '../features/customers/CustomersPage';
import { ProductsPage } from '../features/products/ProductsPage';
import { PurchasesPage, SuppliersPage } from '../features/purchases/PurchasesPage';
import { RepairsPage } from '../features/repairs/RepairsPage';
import { ReportsPage } from '../features/reports/ReportsPage';
import { SalesPage } from '../features/sales/SalesPage';
import { SellersPage } from '../features/sellers/SellersPage';
import { ToolsPage } from '../features/tools/ToolsPage';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useAuth } from '../features/auth/AuthContext';

type MenuItem = {
  id: string;
  label: string;
  icon: string;
  title: string;
  adminOnly?: boolean;
};

type MenuGroup = {
  id: string;
  label: string;
  icon: string;
  items: MenuItem[];
  adminOnly?: boolean;
};

type NavEntry =
  | {
      type: 'item';
      item: MenuItem;
    }
  | {
      type: 'group';
      group: MenuGroup;
    };

const navEntries: NavEntry[] = [
  {
    type: 'item',
    item: { id: 'dashboard', label: 'Inicio', icon: '&#128202;', title: 'Inicio' }
  },
  {
    type: 'group',
    group: {
      id: 'articulos-group',
      label: 'Articulos',
      icon: '&#128230;',
      items: [
        { id: 'products', label: 'Planilla', icon: '&#128203;', title: 'Planilla' },
        { id: 'products-price-update', label: 'Actualizacion de Precios', icon: '&#128178;', title: 'Actualizacion de Precios' },
        { id: 'products-stock-adjustment', label: 'Ajuste de Stock', icon: '&#128230;', title: 'Ajuste de Stock' },
        { id: 'products-stock-output', label: 'Salida de Mercaderia', icon: '&#128228;', title: 'Salida de Mercaderia' },
        { id: 'products-stock-query', label: 'Consulta de Salidas', icon: '&#128269;', title: 'Consulta de Salidas' },
        { id: 'products-labels', label: 'Imprimir Etiquetas', icon: '&#127991;', title: 'Imprimir Etiquetas' },
        { id: 'products-barcodes', label: 'Impresion de Codigos de Barra', icon: '&#128202;', title: 'Impresion de Codigos de Barra' },
        { id: 'products-qr', label: 'Impresion de Codigos QR', icon: '&#128306;', title: 'Impresion de Codigos QR' }
      ]
    }
  },
  {
    type: 'item',
    item: { id: 'customers', label: 'Clientes', icon: '&#128101;', title: 'Clientes' }
  },
  {
    type: 'group',
    group: {
      id: 'compras-group',
      label: 'Compras',
      icon: '&#128722;',
      items: [
        { id: 'merchandise-entry', label: 'Ingreso de Mercaderia', icon: '&#128229;', title: 'Ingreso de Mercaderia' },
        { id: 'nc-proveedor', label: 'N/C Proveedor (Carga)', icon: '&#128228;', title: 'N/C Proveedor (Carga)' },
        { id: 'purchase-query', label: 'Consulta de Compras', icon: '&#128269;', title: 'Consulta de Compras' },
        { id: 'nc-query', label: 'Consulta de N/C', icon: '&#128269;', title: 'Consulta de N/C' },
        { id: 'supplier-payments', label: 'Pagos a Proveedores', icon: '&#128179;', title: 'Pagos a Proveedores' }
      ]
    }
  },
  {
    type: 'group',
    group: {
      id: 'ventas-group',
      label: 'Ventas',
      icon: '&#128176;',
      items: [
        { id: 'sales', label: 'Facturas', icon: '&#129534;', title: 'Facturas' },
        { id: 'sales-delivery-notes', label: 'Remitos', icon: '&#128203;', title: 'Remitos' },
        { id: 'sales-quotes', label: 'Presupuestos', icon: '&#128221;', title: 'Presupuestos' },
        { id: 'sales-orders', label: 'Pedidos', icon: '&#129530;', title: 'Pedidos' },
        { id: 'sales-web-orders', label: 'Pedidos Web', icon: '&#127760;', title: 'Pedidos Web' },
        { id: 'sales-credit-notes', label: 'Notas de Credito', icon: '&#128179;', title: 'Notas de Credito' },
        { id: 'sales-collections', label: 'Cobranzas', icon: '&#128181;', title: 'Cobranzas' },
        { id: 'sales-query-invoices', label: 'Consultar Facturas', icon: '&#128269;', title: 'Consultar Facturas' },
        { id: 'sales-query-delivery-notes', label: 'Consultar Remitos', icon: '&#128269;', title: 'Consultar Remitos' },
        { id: 'sales-query-credit-notes', label: 'Consultar Notas de Credito', icon: '&#128269;', title: 'Consultar Notas de Credito' },
        { id: 'sales-query-quotes', label: 'Consultar Presupuestos', icon: '&#128269;', title: 'Consultar Presupuestos' },
        { id: 'sales-query-orders', label: 'Consultar Pedidos', icon: '&#128269;', title: 'Consultar Pedidos' }
      ]
    }
  },
  {
    type: 'item',
    item: { id: 'suppliers', label: 'Proveedores', icon: '&#128666;', title: 'Proveedores' }
  },
  {
    type: 'group',
    group: {
      id: 'vendedores-group',
      label: 'Vendedores',
      icon: '&#128188;',
      items: [
        { id: 'sellers', label: 'Planilla', icon: '&#128203;', title: 'Planilla de Vendedores' },
        { id: 'sellers-commissions', label: 'Comisiones', icon: '&#128184;', title: 'Comisiones' },
        { id: 'sellers-payments', label: 'Consulta de Pagos', icon: '&#128179;', title: 'Consulta de Pagos' },
        { id: 'sellers-sales-report', label: 'Reporte de Ventas', icon: '&#128200;', title: 'Reporte de Ventas' }
      ]
    }
  },
  {
    type: 'group',
    group: {
      id: 'caja-group',
      label: 'Caja',
      icon: '&#128181;',
      items: [
        { id: 'cash', label: 'Ingresos varios', icon: '&#10133;', title: 'Ingresos varios' },
        { id: 'cash-expenses', label: 'Gastos varios', icon: '&#10134;', title: 'Gastos varios' },
        { id: 'cash-withdrawals', label: 'Retiros', icon: '&#128228;', title: 'Retiros' },
        { id: 'cash-day', label: 'Caja del Dia', icon: '&#128197;', title: 'Caja del Dia' }
      ]
    }
  },
  {
    type: 'item',
    item: { id: 'repairs', label: 'Reparaciones', icon: '&#128295;', title: 'Reparaciones' }
  },
  {
    type: 'group',
    group: {
      id: 'reportes-group',
      label: 'Reportes',
      icon: '&#128200;',
      items: [
        { id: 'reports', label: 'Dashboard', icon: '&#128202;', title: 'Dashboard de Reportes' },
        { id: 'reports-sales', label: 'Ventas', icon: '&#128176;', title: 'Reporte de Ventas' },
        { id: 'reports-purchases', label: 'Compras', icon: '&#128722;', title: 'Reporte de Compras' },
        { id: 'reports-customers', label: 'Clientes', icon: '&#128101;', title: 'Reporte de Clientes' },
        { id: 'reports-delivery-notes', label: 'Remitos', icon: '&#128203;', title: 'Reporte de Remitos' },
        { id: 'reports-accounts', label: 'Ctas Ctes', icon: '&#128179;', title: 'Reporte de Cuentas Corrientes' },
        { id: 'reports-ranking', label: 'Ranking de Productos', icon: '&#127942;', title: 'Ranking de Productos' },
        { id: 'reports-cash', label: 'Caja', icon: '&#128181;', title: 'Reporte de Caja' },
        { id: 'reports-excel', label: 'Excel', icon: '&#128190;', title: 'Exportacion Excel' }
      ]
    }
  },
  {
    type: 'group',
    group: {
      id: 'admin-group',
      label: 'Administracion',
      icon: '&#9881;',
      adminOnly: true,
      items: [
        { id: 'admin-users', label: 'Usuarios', icon: '&#128101;', title: 'Usuarios', adminOnly: true },
        { id: 'admin-device-options', label: 'Tipos de equipos', icon: '&#128187;', title: 'Tipos de equipos', adminOnly: true },
        { id: 'admin-categories', label: 'Rubros', icon: '&#128193;', title: 'Rubros', adminOnly: true },
        { id: 'admin-integrations-woocommerce', label: 'WooCommerce', icon: '&#128722;', title: 'WooCommerce', adminOnly: true }
      ]
    }
  },
  {
    type: 'group',
    group: {
      id: 'tools-group',
      label: 'Herramientas',
      icon: '&#128736;',
      items: [
        { id: 'tools-import', label: 'Importar datos', icon: '&#128228;', title: 'Importar datos' },
        { id: 'tools-export', label: 'Exportar datos', icon: '&#128229;', title: 'Exportar datos' },
        { id: 'tools-backup', label: 'Backups', icon: '&#128190;', title: 'Backups' }
      ]
    }
  },
  {
    type: 'group',
    group: {
      id: 'help-group',
      label: 'Ayuda',
      icon: '&#10067;',
      items: [
        { id: 'help-center', label: 'Centro de ayuda', icon: '&#128214;', title: 'Centro de ayuda' },
        { id: 'help-shortcuts', label: 'Atajos', icon: '&#9000;', title: 'Atajos' }
      ]
    }
  }
];

const pageGroupMap = new Map<string, string>();
const pageTitleMap = new Map<string, string>();

for (const entry of navEntries) {
  if (entry.type === 'item') {
    pageTitleMap.set(entry.item.id, entry.item.title);
    continue;
  }

  for (const item of entry.group.items) {
    pageGroupMap.set(item.id, entry.group.id);
    pageTitleMap.set(item.id, item.title);
  }
}

function normalizePage(page: string) {
  if (page === 'settings') return 'admin-integrations-woocommerce';
  return page || 'dashboard';
}

function getCurrentHashPage() {
  const hash = window.location.hash.replace(/^#/, '').trim();
  return normalizePage(hash);
}

function formatCurrentDate() {
  return new Date().toLocaleDateString('es-ES', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
}

function PagePlaceholder({ pageId, title }: { pageId: string; title: string }) {
  return (
    <div className="card">
      <div className="card-header">
        <div>
          <h3>{title}</h3>
          <p style={{ color: 'var(--text-secondary)', margin: 0 }}>
            Esta vista todavia no fue reconstruida con paridad 1:1 en React.
          </p>
        </div>
      </div>
      <div className="alert alert-warning">
        Mientras termina la migracion visual, esta pantalla debe seguir usandose desde el frontend legacy.
      </div>
      <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
        <a href={`/legacy-app#${pageId}`} className="btn btn-primary">
          Abrir pantalla legacy
        </a>
        <a href="/legacy-app" className="btn btn-secondary">
          Abrir sistema legacy completo
        </a>
      </div>
    </div>
  );
}

function renderPage(pageId: string): ReactNode {
  if (pageId === 'dashboard') {
    return <DashboardPage />;
  }

  if (pageId.startsWith('admin-')) {
    return <AdminPage pageId={pageId} />;
  }

  if (pageId === 'customers') {
    return <CustomersPage />;
  }

  if (pageId === 'products' || pageId.startsWith('products-')) {
    return <ProductsPage pageId={pageId} />;
  }

  if (pageId === 'merchandise-entry' || pageId === 'nc-proveedor' || pageId === 'purchase-query' || pageId === 'nc-query' || pageId === 'supplier-payments') {
    return <PurchasesPage pageId={pageId} />;
  }

  if (pageId === 'suppliers') {
    return <SuppliersPage />;
  }

  if (pageId === 'repairs') {
    return <RepairsPage />;
  }

  if (pageId === 'reports' || pageId.startsWith('reports-')) {
    return <ReportsPage pageId={pageId} />;
  }

  if (pageId === 'sales' || pageId.startsWith('sales-')) {
    return <SalesPage pageId={pageId} />;
  }

  if (pageId === 'sellers' || pageId.startsWith('sellers-')) {
    return <SellersPage pageId={pageId} />;
  }

  if (pageId === 'cash' || pageId.startsWith('cash-')) {
    return <CashPage pageId={pageId} />;
  }

  if (pageId.startsWith('tools-')) {
    return <ToolsPage pageId={pageId} />;
  }

  if (pageId.startsWith('help-')) {
    return <HelpPage pageId={pageId} />;
  }

  const title = pageTitleMap.get(pageId) || 'Inicio';
  return <PagePlaceholder pageId={pageId} title={title} />;
}

function isAdminRole(role?: string) {
  return String(role || '').toLowerCase() === 'admin';
}

export function AppLayout() {
  const { currentUser, logout } = useAuth();
  const [currentPage, setCurrentPage] = useState<string>(() => getCurrentHashPage());
  const [currentDate, setCurrentDate] = useState<string>(() => formatCurrentDate());
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(() => {
    const initialPage = getCurrentHashPage();
    const groupId = pageGroupMap.get(initialPage);
    return groupId ? { [groupId]: true } : {};
  });

  useEffect(() => {
    if (!window.location.hash) {
      window.location.hash = 'dashboard';
    }

    const handleHashChange = () => {
      const nextPage = getCurrentHashPage();
      if (window.location.hash.replace(/^#/, '').trim() === 'settings') {
        window.location.hash = 'admin-integrations-woocommerce';
        return;
      }
      setCurrentPage(nextPage);
      const groupId = pageGroupMap.get(nextPage);
      if (groupId) {
        setOpenGroups((previous) => ({ ...previous, [groupId]: true }));
      }
    };

    const handleDateRefresh = () => {
      setCurrentDate(formatCurrentDate());
    };

    window.addEventListener('hashchange', handleHashChange);
    const timerId = window.setInterval(handleDateRefresh, 60000);

    return () => {
      window.removeEventListener('hashchange', handleHashChange);
      window.clearInterval(timerId);
    };
  }, []);

  const pageTitle = useMemo(() => pageTitleMap.get(currentPage) || 'Inicio', [currentPage]);
  const isAdmin = isAdminRole(currentUser?.role);

  function toggleGroup(groupId: string) {
    setOpenGroups((previous) => ({
      ...previous,
      [groupId]: !previous[groupId]
    }));
  }

  function navigateToPage(pageId: string) {
    window.location.hash = normalizePage(pageId);
  }

  return (
    <div id="app" className="app-container react-legacy-shell">
      <aside className="sidebar">
        <div className="sidebar-header">
          <h2 id="sidebar-business-name">Milo Pro</h2>
          <span id="user-role" className="user-role">{currentUser?.role || ''}</span>
        </div>
        <nav className="sidebar-nav">
          {navEntries.map((entry) => {
            if (entry.type === 'item') {
              if (entry.item.adminOnly && !isAdmin) {
                return null;
              }

              const isActive = currentPage === entry.item.id;

              return (
                <a
                  key={entry.item.id}
                  href={`#${entry.item.id}`}
                  className={`nav-item${isActive ? ' active' : ''}`}
                  data-page={entry.item.id}
                  onClick={(event) => {
                    event.preventDefault();
                    navigateToPage(entry.item.id);
                  }}
                >
                  <span className="nav-icon" dangerouslySetInnerHTML={{ __html: entry.item.icon }} />
                  <span>{entry.item.label}</span>
                </a>
              );
            }

            if (entry.group.adminOnly && !isAdmin) {
              return null;
            }

            const groupIsOpen = Boolean(openGroups[entry.group.id]);

            return (
              <div key={entry.group.id} className={`nav-group${groupIsOpen ? ' open' : ''}`} id={entry.group.id}>
                <div
                  className="nav-group-header"
                  role="button"
                  tabIndex={0}
                  onClick={() => toggleGroup(entry.group.id)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      toggleGroup(entry.group.id);
                    }
                  }}
                >
                  <span className="nav-icon" dangerouslySetInnerHTML={{ __html: entry.group.icon }} />
                  <span>{entry.group.label}</span>
                  <span className="nav-arrow">&#9654;</span>
                </div>
                <div className="nav-group-items">
                  {entry.group.items.map((item) => {
                    if (item.adminOnly && !isAdmin) {
                      return null;
                    }

                    const isActive = currentPage === item.id;
                    const showWebOrdersBadge = item.id === 'sales-web-orders';

                    return (
                      <a
                        key={item.id}
                        href={`#${item.id}`}
                        className={`nav-item nav-group-item${isActive ? ' active' : ''}`}
                        data-page={item.id}
                        onClick={(event) => {
                          event.preventDefault();
                          navigateToPage(item.id);
                        }}
                      >
                        <span dangerouslySetInnerHTML={{ __html: item.icon }} />
                        <span>{item.label}</span>
                        {showWebOrdersBadge ? (
                          <span id="sales-web-orders-badge" className="nav-counter-badge" hidden>
                            0
                          </span>
                        ) : null}
                      </a>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </nav>
        <div className="sidebar-footer">
          <button
            id="logout-btn-sidebar"
            type="button"
            className="btn btn-secondary btn-block"
            onClick={() => void logout()}
          >
            Salir
          </button>
        </div>
      </aside>

      <main className="main-content">
        <header className="top-bar">
          <h1 id="page-title">{pageTitle}</h1>
          <div className="header-actions">
            <span id="current-date">{currentDate}</span>
          </div>
        </header>

        <div id="page-content" className="page-content">
          {renderPage(currentPage)}
        </div>

        <div id="modal-container" />
      </main>
    </div>
  );
}

