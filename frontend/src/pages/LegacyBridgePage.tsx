import { SectionCard } from '../components/ui/SectionCard';

export function LegacyBridgePage() {
  return (
    <SectionCard
      title="Convivencia con legacy"
      description="La SPA actual sigue siendo el respaldo operativo mientras migramos el frontend moderno."
    >
      <div className="space-y-4 text-sm leading-6 text-slate-700">
        <ul className="space-y-3">
          <li>JWT y endpoints REST siguen siendo los mismos.</li>
          <li>El backend Express no cambia de contrato en esta fase.</li>
          <li>WooCommerce y SQLite quedan completamente preservados.</li>
          <li>El frontend legacy sigue disponible en <code>/legacy-app</code> aunque React quede activo como principal.</li>
        </ul>

        <a
          href="/legacy-app"
          className="inline-flex items-center justify-center rounded-2xl border border-slate-300 px-4 py-3 font-medium text-slate-700 transition hover:bg-slate-50"
        >
          Abrir frontend legacy
        </a>
      </div>
    </SectionCard>
  );
}
