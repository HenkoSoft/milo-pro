import { createBrowserRouter, Navigate } from 'react-router-dom';
import { App } from '../App';
import { ProtectedRoute } from '../features/auth/ProtectedRoute';
import { PublicOnlyRoute } from '../features/auth/PublicOnlyRoute';
import { CatalogPage } from '../features/catalog/CatalogPage';
import { CustomersPage } from '../features/customers/CustomersPage';
import { DashboardPage } from '../features/dashboard/DashboardPage';
import { ProductsPage } from '../features/products/ProductsPage';
import { RepairsPage } from '../features/repairs/RepairsPage';
import { SalesPage } from '../features/sales/SalesPage';
import { SettingsPage } from '../features/settings/SettingsPage';
import { WebOrdersPage } from '../features/web-orders/WebOrdersPage';
import { AppLayout } from '../layouts/AppLayout';
import { LegacyBridgePage } from '../pages/LegacyBridgePage';
import { LoginPage } from '../pages/LoginPage';

export const router = createBrowserRouter([
  {
    path: '/',
    element: <App />,
    children: [
      {
        element: <ProtectedRoute />,
        children: [
          {
            element: <AppLayout />,
            children: [
              {
                index: true,
                element: <Navigate to="/dashboard" replace />
              },
              {
                path: 'dashboard',
                element: <DashboardPage />
              },
              {
                path: 'customers',
                element: <CustomersPage />
              },
              {
                path: 'products',
                element: <ProductsPage />
              },
              {
                path: 'repairs',
                element: <RepairsPage />
              },
              {
                path: 'catalog',
                element: <CatalogPage />
              },
              {
                path: 'sales',
                element: <SalesPage />
              },
              {
                path: 'web-orders',
                element: <WebOrdersPage />
              },
              {
                path: 'settings',
                element: <SettingsPage />
              },
              {
                path: 'legacy',
                element: <LegacyBridgePage />
              }
            ]
          }
        ]
      },
      {
        element: <PublicOnlyRoute />,
        children: [
          {
            path: 'login',
            element: <LoginPage />
          }
        ]
      }
    ]
  }
]);
