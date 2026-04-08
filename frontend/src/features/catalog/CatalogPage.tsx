import { SectionCard } from '../../components/ui/SectionCard';
import { useProductFormData } from '../products/useProducts';
import { useRepairFormData } from '../repairs/useRepairs';

export function CatalogPage() {
  const { categoriesQuery, brandsQuery } = useProductFormData();
  const { deviceTypesQuery, modelsQuery } = useRepairFormData();

  const categories = categoriesQuery.data || [];
  const brands = brandsQuery.data || [];
  const deviceTypes = deviceTypesQuery.data || [];
  const models = modelsQuery.data || [];

  return (
    <div className="grid gap-6 xl:grid-cols-2">
      <SectionCard title="Categorias y marcas" description="Consulta de categorias y marcas.">
        <div className="space-y-4">
          <CatalogBlock title="Categorias" items={categories.map((item) => item.full_name || item.name)} />
          <CatalogBlock title="Marcas" items={brands.map((item) => item.name)} />
        </div>
      </SectionCard>

      <SectionCard title="Tipos y modelos" description="Datos para reparaciones y articulos.">
        <div className="space-y-4">
          <CatalogBlock title="Tipos de dispositivo" items={deviceTypes.map((item) => item.name)} />
          <CatalogBlock title="Modelos" items={models.map((item) => item.name)} />
        </div>
      </SectionCard>
    </div>
  );
}

function CatalogBlock({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="rounded-2xl border border-slate-200 p-4">
      <h3 className="mb-3 text-sm font-semibold uppercase tracking-[0.2em] text-brand">{title}</h3>
      {items.length === 0 ? (
        <div className="text-sm text-slate-500">Sin datos disponibles.</div>
      ) : (
        <div className="flex flex-wrap gap-2">
          {items.slice(0, 40).map((item) => (
            <span key={`${title}-${item}`} className="rounded-full bg-slate-100 px-3 py-1 text-sm text-slate-700">
              {item}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
