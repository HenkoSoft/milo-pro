import { SectionCard } from '../components/ui/SectionCard';

export function LegacyBridgePage() {
  return (
    <SectionCard
      title="Integracion disponible"
      description="Los contratos del sistema siguen disponibles dentro de la aplicacion."
    >
      <div className="space-y-4 text-sm leading-6 text-slate-700">
        <ul className="space-y-3">
          <li>JWT y endpoints REST siguen disponibles.</li>
          <li>El backend Express no cambia de contrato.</li>
          <li>WooCommerce y PostgreSQL forman parte del stack actual.</li>
          <li>La aplicacion mantiene compatibilidad operativa con los modulos y accesos habituales.</li>
        </ul>
      </div>
    </SectionCard>
  );
}
