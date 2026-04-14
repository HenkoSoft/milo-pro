import React from 'react';
import ReactDOM from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider } from 'react-router-dom';
import { router } from './routes/router';
import { formatLocaleMoneyInput, formatLocalePercentInput, isDiscountField, isMoneyField } from './utils/localeNumber';
import './index.css';

const queryClient = new QueryClient();

if (typeof document !== 'undefined') {
  document.addEventListener('focusin', (event) => {
    const target = event.target;
    if (!(target instanceof HTMLInputElement)) return;
    if (target.disabled || target.readOnly) return;

    if (isDiscountField(target)) {
      const normalizedValue = target.value.trim();
      if (/^0([.,]0+)?$/.test(normalizedValue)) {
        requestAnimationFrame(() => {
          if (document.activeElement === target) {
            target.select();
          }
        });
      }
      return;
    }

    if (isMoneyField(target)) {
      const normalizedValue = target.value.trim();
      if (/^0([.,]0+)?$/.test(normalizedValue)) {
        requestAnimationFrame(() => {
          if (document.activeElement === target) {
            target.select();
          }
        });
      }
      return;
    }

    if (target.type !== 'number') return;

    requestAnimationFrame(() => {
      if (document.activeElement === target) {
        target.select();
      }
    });
  });

  document.addEventListener('focusout', (event) => {
    const target = event.target;
    if (!(target instanceof HTMLInputElement)) return;
    if (target.disabled || target.readOnly) return;

    if (isDiscountField(target)) {
      const rawValue = target.value.trim();
      if (!rawValue) return;

      const formattedValue = formatLocalePercentInput(rawValue);
      if (formattedValue === target.value) return;

      const descriptor = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value');
      descriptor?.set?.call(target, formattedValue);
      target.dispatchEvent(new Event('input', { bubbles: true }));
      return;
    }

    if (!isMoneyField(target)) return;

    const rawValue = target.value.trim();
    if (!rawValue) return;

    const formattedValue = formatLocaleMoneyInput(rawValue);
    if (formattedValue === target.value) return;

    const descriptor = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value');
    descriptor?.set?.call(target, formattedValue);
    target.dispatchEvent(new Event('input', { bubbles: true }));
  });
}

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  </React.StrictMode>
);
