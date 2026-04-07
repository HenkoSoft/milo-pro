import { SectionCard } from '../components/ui/SectionCard';

export function LegacyBridgePage() {
  return (
    <SectionCard
      title="Integracion disponible"
      description="Los mismos contratos del sistema siguen disponibles dentro del stack actual."
    >
      <div className="space-y-4 text-sm leading-6 text-slate-700">
        <ul className="space-y-3">
          <li>JWT y endpoints REST siguen siendo los mismos.</li>
          <li>El backend Express no cambia de contrato en esta fase.</li>
          <li>WooCommerce y SQLite quedan completamente preservados.</li>
          <li>La aplicacion mantiene compatibilidad operativa con los mismos modulos y accesos.</li>
        </ul>
      </div>
    </SectionCard>
  );
}
