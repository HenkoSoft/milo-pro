interface PlaceholderPageProps {
  title: string;
  description: string;
}

export function PlaceholderPage({ title, description }: PlaceholderPageProps) {
  return (
    <div className="card">
      <div className="card-header">
        <div>
          <h2>{title}</h2>
          <p className="page-placeholder-copy">{description}</p>
        </div>
      </div>
      <div className="alert alert-warning">
        Esta pantalla no tiene contenido operativo disponible en este momento.
      </div>
      <div className="page-placeholder-actions">
        <a href="#dashboard" className="btn btn-primary">
          Ir a inicio
        </a>
      </div>
    </div>
  );
}
