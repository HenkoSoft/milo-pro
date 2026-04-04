import type { PropsWithChildren } from 'react';

interface SectionCardProps extends PropsWithChildren {
  title: string;
  description?: string;
}

export function SectionCard({
  title,
  description,
  children
}: SectionCardProps) {
  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
      <header className="mb-4">
        <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
        {description ? (
          <p className="mt-1 text-sm leading-6 text-slate-600">{description}</p>
        ) : null}
      </header>
      {children}
    </section>
  );
}
