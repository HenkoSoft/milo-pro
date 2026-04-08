import { useAuth } from '../features/auth/AuthContext';

export function HomePage() {
  const { currentUser } = useAuth();

  return (
    <div className="card">
      <div className="card-header">
        <div>
          <h2>Inicio</h2>
          <p className="page-placeholder-copy">
            Sesion iniciada como <strong>{currentUser?.name}</strong> ({currentUser?.role}).
          </p>
        </div>
      </div>
      <div className="alert alert-warning">
        Usa el menu lateral para ingresar a la seccion con la que queres trabajar.
      </div>
    </div>
  );
}
