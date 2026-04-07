import { useState, type FormEvent } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../features/auth/AuthContext';

interface LocationState {
  from?: {
    pathname?: string;
  };
}

export function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { login } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setIsSubmitting(true);

    try {
      await login({ username, password });
      const state = location.state as LocationState | null;
      const redirectPath = state?.from?.pathname || '/';
      navigate(redirectPath, { replace: true });
    } catch (submitError) {
      setError(
        submitError instanceof Error ? submitError.message : 'No se pudo iniciar sesi\u00F3n'
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div id="login-screen" className="login-screen react-legacy-login">
      <div className="login-container">
        <div className="login-header">
          <h1>Milo Pro</h1>
          <p>{'Sistema de Gesti\u00F3n'}</p>
        </div>
        <form id="login-form" onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="username">Usuario</label>
            <input
              id="username"
              type="text"
              name="username"
              autoComplete="username"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              required
            />
          </div>
          <div className="form-group">
            <label htmlFor="password">{'Contrase\u00F1a'}</label>
            <input
              id="password"
              type="password"
              name="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
            />
          </div>
          <button type="submit" className="btn btn-primary btn-block" disabled={isSubmitting}>
            {'Iniciar Sesi\u00F3n'}
          </button>
          <div id="login-error" className="error-message">
            {error}
          </div>
        </form>
      </div>
    </div>
  );
}
