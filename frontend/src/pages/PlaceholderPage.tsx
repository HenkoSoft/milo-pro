interface PlaceholderPageProps {
  title: string;
  description: string;
}

export function PlaceholderPage({ title, description }: PlaceholderPageProps) {
  return (
    <section className="grid gap-6 lg:grid-cols-[1.4fr_0.8fr]">
      <article className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
        <p className="mb-3 text-sm font-medium uppercase tracking-[0.2em] text-brand">
          Objetivo
        </p>
        <h2 className="mb-4 text-3xl font-semibold text-slate-900">{title}</h2>
        <p className="max-w-2xl text-base leading-7 text-slate-600">
          {description}
        </p>
      </article>

      <aside className="rounded-3xl border border-amber-200 bg-amber-50 p-8 shadow-sm">
        <p className="mb-3 text-sm font-medium uppercase tracking-[0.2em] text-amber-700">
          Estado
        </p>
        <ul className="space-y-3 text-sm leading-6 text-slate-700">
          <li>Backend Express intacto.</li>
          <li>API REST intacta.</li>
          <li>JWT, WooCommerce y SQLite sin cambios.</li>
          <li>Frontend legacy sigue siendo la interfaz principal.</li>
        </ul>
      </aside>
    </section>
  );
}
