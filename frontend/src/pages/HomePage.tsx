import { Link } from 'react-router-dom';
import { SectionCard } from '../components/ui/SectionCard';
import { useAuth } from '../features/auth/AuthContext';

export function HomePage() {
  const { currentUser } = useAuth();

  return (
    <div className="grid gap-6 xl:grid-cols-[1.4fr_0.9fr]">
      <SectionCard
        title="Shell autenticado listo"
        description="La app nueva ya usa el JWT actual del backend y queda preparada para migrar modulos uno por uno."
      >
        <div className="space-y-4 text-sm leading-7 text-slate-600">
          <p>
            Sesion iniciada como <strong>{currentUser?.name}</strong> ({currentUser?.role}).
          </p>
          <p>
            El backend Express, la API REST, WooCommerce y SQLite siguen intactos en esta fase.
          </p>
        </div>
      </SectionCard>

      <SectionCard
        title="Siguientes modulos"
        description="Orden sugerido para seguir migrando con bajo riesgo."
      >
        <ul className="space-y-3 text-sm leading-6 text-slate-700">
          <li>Dashboard y reportes de solo lectura.</li>
          <li>Clientes y configuracion.</li>
          <li>Productos, catalogo y reparaciones.</li>
          <li>Ventas y pedidos web cuando el shell ya este estable.</li>
        </ul>

        <div className="mt-6">
          <Link
            to="/legacy"
            className="inline-flex rounded-full bg-brand px-4 py-2 text-sm font-medium text-white transition hover:bg-teal-700"
          >
            Ver convivencia con legacy
          </Link>
        </div>
      </SectionCard>
    </div>
  );
}
