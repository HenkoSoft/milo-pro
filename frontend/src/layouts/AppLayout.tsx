import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../features/auth/AuthContext';

const navItems = [
  { to: '/dashboard', label: 'Dashboard' },
  { to: '/customers', label: 'Clientes' },
  { to: '/products', label: 'Articulos' },
  { to: '/repairs', label: 'Reparaciones' },
  { to: '/catalog', label: 'Catalogo' },
  { to: '/sales', label: 'Ventas' },
  { to: '/web-orders', label: 'Pedidos web' },
  { to: '/settings', label: 'Settings' },
  { to: '/legacy', label: 'Convivencia' }
];

export function AppLayout() {
  const { currentUser, logout } = useAuth();

  return (
    <div className="min-h-screen">
      <header className="border-b border-slate-200 bg-white/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand">
              Milo Pro
            </p>
            <h1 className="text-xl font-semibold text-slate-900">
              Frontend React en migracion
            </h1>
          </div>
          <span className="rounded-full bg-slate-900 px-3 py-1 text-xs font-medium text-white">
            Fase 5
          </span>
        </div>
      </header>

      <div className="mx-auto grid max-w-6xl gap-6 px-6 py-10 lg:grid-cols-[240px_minmax(0,1fr)]">
        <aside className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="border-b border-slate-200 pb-4">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand">
              Sesion
            </p>
            <h2 className="mt-2 text-lg font-semibold text-slate-900">
              {currentUser?.name || 'Usuario'}
            </h2>
            <p className="text-sm text-slate-500">{currentUser?.role || '-'}</p>
          </div>

          <nav className="mt-4 space-y-2 text-sm">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === '/dashboard'}
                className={({ isActive }) =>
                  `block rounded-2xl px-4 py-3 transition ${
                    isActive
                      ? 'bg-slate-900 text-white'
                      : 'text-slate-700 hover:bg-slate-100'
                  }`
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>

          <button
            type="button"
            onClick={() => void logout()}
            className="mt-6 inline-flex w-full items-center justify-center rounded-2xl border border-slate-300 px-4 py-3 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
          >
            Cerrar sesion
          </button>
        </aside>

        <main>
          <Outlet />
        </main>
      </div>
    </div>
  );
}
