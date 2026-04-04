import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AuthProvider } from './features/auth/AuthContext';
import { AppLayout } from './layouts/AppLayout';

describe('App layout', () => {
  it('renders the shell frame with phase five navigation', () => {
    window.localStorage.removeItem('milo_react_token');

    render(
      <MemoryRouter>
        <AuthProvider>
          <AppLayout />
        </AuthProvider>
      </MemoryRouter>
    );

    expect(screen.getByText('Frontend React en migracion')).toBeInTheDocument();
    expect(screen.getByText('Dashboard')).toBeInTheDocument();
    expect(screen.getByText('Clientes')).toBeInTheDocument();
    expect(screen.getByText('Articulos')).toBeInTheDocument();
    expect(screen.getByText('Reparaciones')).toBeInTheDocument();
    expect(screen.getByText('Catalogo')).toBeInTheDocument();
    expect(screen.getByText('Ventas')).toBeInTheDocument();
    expect(screen.getByText('Pedidos web')).toBeInTheDocument();
    expect(screen.getByText('Settings')).toBeInTheDocument();
    expect(screen.getByText('Fase 5')).toBeInTheDocument();
  });
});
