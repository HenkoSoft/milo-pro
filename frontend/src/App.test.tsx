import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AuthProvider } from './features/auth/AuthContext';
import { AppLayout } from './layouts/AppLayout';

describe('App layout', () => {
  it('renders the legacy shell frame with grouped navigation', () => {
    window.localStorage.removeItem('milo_react_token');
    window.location.hash = '#dashboard';

    const queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false
        }
      }
    });

    render(
      <MemoryRouter>
        <QueryClientProvider client={queryClient}>
          <AuthProvider>
            <AppLayout />
          </AuthProvider>
        </QueryClientProvider>
      </MemoryRouter>
    );

    expect(screen.getByRole('heading', { level: 1, name: 'Inicio' })).toBeInTheDocument();
    expect(screen.getAllByText('Articulos').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Compras').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Ventas').length).toBeGreaterThan(0);
    expect(screen.getByText('Proveedores')).toBeInTheDocument();
    expect(screen.getByText('Reparaciones')).toBeInTheDocument();
    expect(screen.getByText('Ayuda')).toBeInTheDocument();
    expect(screen.queryByText('Configuracion')).not.toBeInTheDocument();
  });
});
