import { SectionCard } from '../components/ui/SectionCard';
import { useAuth } from '../features/auth/AuthContext';

export function HomePage() {
  const { currentUser } = useAuth();

  return (
    <div className="grid gap-6 xl:grid-cols-[1.4fr_0.9fr]">
      <SectionCard
        title="Shell autenticado listo"
        description="La aplicacion mantiene el mismo backend y los mismos contratos operativos."
      >
        <div className="space-y-4 text-sm leading-7 text-slate-600">
          <p>
            Sesion iniciada como <strong>{currentUser?.name}</strong> ({currentUser?.role}).
          </p>
          <p>
            El backend Express, la API REST, WooCommerce y SQLite siguen intactos.
          </p>
        </div>
      </SectionCard>

      <SectionCard
        title="Cobertura actual"
        description="Los modulos principales ya estan disponibles dentro de la shell actual."
      >
        <ul className="space-y-3 text-sm leading-6 text-slate-700">
          <li>Dashboard, clientes, articulos y reparaciones.</li>
          <li>Compras, proveedores, ventas y cobranzas.</li>
          <li>Reportes, administracion, herramientas y ayuda.</li>
          <li>WooCommerce conservado con los mismos endpoints.</li>
        </ul>
      </SectionCard>
    </div>
  );
}
