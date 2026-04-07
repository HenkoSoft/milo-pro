import { useEffect, useState, type ChangeEvent, type FormEvent } from 'react';
import { SectionCard } from '../../components/ui/SectionCard';
import { useAuth } from '../auth/AuthContext';
import { useSettings, useUpdateSettings } from './useSettings';
import type { BusinessSettings } from '../../types/settings';

const EMPTY_SETTINGS: BusinessSettings = {
  business_name: 'Milo Pro',
  business_address: '',
  business_phone: '',
  business_email: ''
};

export function SettingsPage() {
  const { currentUser } = useAuth();
  const settingsQuery = useSettings();
  const updateMutation = useUpdateSettings();
  const [formValues, setFormValues] = useState<BusinessSettings>(EMPTY_SETTINGS);
  const [feedback, setFeedback] = useState('');

  useEffect(() => {
    if (settingsQuery.data) {
      setFormValues({
        business_name: settingsQuery.data.business_name || 'Milo Pro',
        business_address: settingsQuery.data.business_address || '',
        business_phone: settingsQuery.data.business_phone || '',
        business_email: settingsQuery.data.business_email || ''
      });
    }
  }, [settingsQuery.data]);

  function handleChange(event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) {
    const { name, value } = event.target;
    setFormValues((current) => ({
      ...current,
      [name]: value
    }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFeedback('');

    try {
      await updateMutation.mutateAsync(formValues);
      setFeedback('Configuracion guardada correctamente.');
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : 'No se pudo guardar la configuracion.');
    }
  }

  if (settingsQuery.isLoading) {
    return <div className="rounded-3xl border border-slate-200 bg-white p-6 text-sm text-slate-600 shadow-sm">Cargando configuracion...</div>;
  }

  if (settingsQuery.isError) {
    return <div className="rounded-3xl border border-rose-200 bg-rose-50 p-6 text-sm text-rose-700 shadow-sm">{settingsQuery.error instanceof Error ? settingsQuery.error.message : 'No se pudo cargar la configuracion.'}</div>;
  }

  const isAdmin = currentUser?.role === 'admin';

  return (
    <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
      <SectionCard title="Datos generales" description="Configuracion principal del negocio usando el endpoint actual de settings.">
        <form className="space-y-4" onSubmit={handleSubmit}>
          <Field label="Nombre comercial" name="business_name" value={formValues.business_name} onChange={handleChange} disabled={!isAdmin} />
          <TextAreaField label="Direccion" name="business_address" value={formValues.business_address || ''} onChange={handleChange} disabled={!isAdmin} rows={4} />
          <Field label="Telefono" name="business_phone" value={formValues.business_phone || ''} onChange={handleChange} disabled={!isAdmin} />
          <Field label="Email" name="business_email" value={formValues.business_email || ''} onChange={handleChange} disabled={!isAdmin} type="email" />

          {feedback ? <InlineFeedback text={feedback} tone={updateMutation.isError ? 'error' : 'info'} /> : null}

          <div className="flex gap-3">
            <button
              type="submit"
              disabled={!isAdmin || updateMutation.isPending}
              className="inline-flex items-center justify-center rounded-2xl bg-brand px-4 py-3 text-sm font-medium text-white transition hover:bg-teal-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {updateMutation.isPending ? 'Guardando...' : 'Guardar cambios'}
            </button>
            {!isAdmin ? <span className="self-center text-sm text-slate-500">Solo el administrador puede editar.</span> : null}
          </div>
        </form>
      </SectionCard>

      <SectionCard title="WooCommerce" description="La integracion se conserva y se administra por separado para no mezclar riesgos.">
        <div className="space-y-4 text-sm leading-7 text-slate-600">
          <p>
            Esta pantalla cubre solo datos generales. La configuracion de WooCommerce
            se administra desde su modulo especifico dentro de Administracion.
          </p>
          <p>
            Eso evita mezclar datos generales con una zona altamente acoplada del sistema.
          </p>
        </div>
      </SectionCard>
    </div>
  );
}

function Field({ label, name, value, onChange, disabled, type = 'text' }: FieldProps) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-medium text-slate-700">{label}</span>
      <input
        className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20 disabled:bg-slate-100"
        name={name}
        value={value}
        onChange={onChange}
        disabled={disabled}
        type={type}
      />
    </label>
  );
}

function TextAreaField({ label, name, value, onChange, disabled, rows }: TextAreaFieldProps) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-medium text-slate-700">{label}</span>
      <textarea
        className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20 disabled:bg-slate-100"
        name={name}
        value={value}
        onChange={onChange}
        disabled={disabled}
        rows={rows}
      />
    </label>
  );
}

function InlineFeedback({ text, tone }: { text: string; tone: 'info' | 'error' }) {
  return (
    <div className={`rounded-2xl px-4 py-3 text-sm ${tone === 'error' ? 'border border-rose-200 bg-rose-50 text-rose-700' : 'border border-sky-200 bg-sky-50 text-sky-700'}`}>
      {text}
    </div>
  );
}

interface FieldProps {
  label: string;
  name: keyof BusinessSettings;
  value: string;
  onChange: (event: ChangeEvent<HTMLInputElement>) => void;
  disabled: boolean;
  type?: 'text' | 'email';
}

interface TextAreaFieldProps {
  label: string;
  name: keyof BusinessSettings;
  value: string;
  onChange: (event: ChangeEvent<HTMLTextAreaElement>) => void;
  disabled: boolean;
  rows: number;
}
