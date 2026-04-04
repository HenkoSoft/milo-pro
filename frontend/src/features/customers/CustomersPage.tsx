import { startTransition, useMemo, useState, type ChangeEvent, type FormEvent } from 'react';
import { SectionCard } from '../../components/ui/SectionCard';
import { CUSTOMER_COUNTRIES, CUSTOMER_IVA_CONDITIONS, CUSTOMER_PROVINCES, CUSTOMER_SELLERS, CUSTOMER_TRANSPORTS, CUSTOMER_ZONES } from './constants';
import { useCustomerMutations, useCustomers } from './useCustomers';
import type { Customer, CustomerPayload } from '../../types/customer';

const EMPTY_FORM: CustomerPayload = {
  name: '',
  phone: '',
  email: '',
  address: '',
  contact: '',
  city: '',
  province: '',
  country: 'Argentina',
  tax_id: '',
  iva_condition: 'Consumidor Final',
  instagram: '',
  transport: '',
  credit_limit: '',
  zone: '',
  discount_percent: '',
  seller: '',
  price_list: '1',
  billing_conditions: '',
  notes: ''
};

function toFormValues(customer: Customer | null): CustomerPayload {
  if (!customer) return { ...EMPTY_FORM };

  return {
    name: customer.name || '',
    phone: customer.phone || '',
    email: customer.email || '',
    address: customer.address || '',
    contact: customer.contact || '',
    city: customer.city || '',
    province: customer.province || '',
    country: customer.country || 'Argentina',
    tax_id: customer.tax_id || '',
    iva_condition: customer.iva_condition || 'Consumidor Final',
    instagram: customer.instagram || '',
    transport: customer.transport || '',
    credit_limit: customer.credit_limit != null ? String(customer.credit_limit) : '',
    zone: customer.zone || '',
    discount_percent: customer.discount_percent != null ? String(customer.discount_percent) : '',
    seller: customer.seller || '',
    price_list: customer.price_list || '1',
    billing_conditions: customer.billing_conditions || '',
    notes: customer.notes || ''
  };
}

export function CustomersPage() {
  const [search, setSearch] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [formValues, setFormValues] = useState<CustomerPayload>({ ...EMPTY_FORM });
  const [feedback, setFeedback] = useState('');
  const customersQuery = useCustomers(search);
  const { createMutation, updateMutation, deleteMutation } = useCustomerMutations();

  const isSaving = createMutation.isPending || updateMutation.isPending;
  const isDeleting = deleteMutation.isPending;
  const customers = customersQuery.data || [];

  const sortedCustomers = useMemo(
    () => customers.slice().sort((a, b) => String(a.name || '').localeCompare(String(b.name || ''))),
    [customers]
  );

  function handleEdit(customer: Customer) {
    startTransition(() => {
      setSelectedCustomer(customer);
      setFormValues(toFormValues(customer));
      setFeedback('');
    });
  }

  function handleCreateNew() {
    startTransition(() => {
      setSelectedCustomer(null);
      setFormValues({ ...EMPTY_FORM });
      setFeedback('');
    });
  }

  function handleChange(event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) {
    const { name, value } = event.target;
    setFormValues((current) => ({
      ...current,
      [name]: value
    }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFeedback('');

    if (!formValues.name.trim()) {
      setFeedback('La razon social es obligatoria.');
      return;
    }

    try {
      if (selectedCustomer) {
        await updateMutation.mutateAsync({ id: selectedCustomer.id, payload: formValues });
        setFeedback('Cliente actualizado correctamente.');
      } else {
        await createMutation.mutateAsync(formValues);
        setFeedback('Cliente creado correctamente.');
      }

      handleCreateNew();
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : 'No se pudo guardar el cliente.');
    }
  }

  async function handleDelete(customer: Customer) {
    const confirmed = window.confirm(`Eliminar cliente ${customer.name}?`);
    if (!confirmed) return;

    try {
      await deleteMutation.mutateAsync(customer.id);
      if (selectedCustomer?.id === customer.id) {
        handleCreateNew();
      }
      setFeedback('Cliente eliminado correctamente.');
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : 'No se pudo eliminar el cliente.');
    }
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
      <SectionCard title="Clientes" description="Listado y busqueda usando la API actual.">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row">
          <input
            className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20"
            placeholder="Buscar por nombre, telefono o email"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
          <button
            type="button"
            onClick={handleCreateNew}
            className="inline-flex shrink-0 items-center justify-center rounded-2xl bg-slate-900 px-4 py-3 text-sm font-medium text-white transition hover:bg-slate-800"
          >
            Nuevo cliente
          </button>
        </div>

        {customersQuery.isLoading ? (
          <Notice text="Cargando clientes..." />
        ) : customersQuery.isError ? (
          <ErrorNotice text={customersQuery.error instanceof Error ? customersQuery.error.message : 'No se pudo cargar clientes.'} />
        ) : sortedCustomers.length === 0 ? (
          <Notice text="No hay clientes para mostrar." />
        ) : (
          <div className="space-y-3">
            {sortedCustomers.map((customer) => (
              <article key={customer.id} className="rounded-2xl border border-slate-200 px-4 py-4">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <h3 className="font-medium text-slate-900">{customer.name}</h3>
                    <p className="mt-1 text-sm text-slate-500">
                      {[customer.phone, customer.email, customer.tax_id].filter(Boolean).join(' · ') || 'Sin datos complementarios'}
                    </p>
                    <p className="mt-1 text-sm text-slate-500">{customer.address || 'Sin direccion registrada'}</p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => handleEdit(customer)}
                      className="rounded-full border border-slate-300 px-3 py-2 text-xs font-medium text-slate-700 transition hover:bg-slate-50"
                    >
                      Editar
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleDelete(customer)}
                      disabled={isDeleting}
                      className="rounded-full border border-rose-300 px-3 py-2 text-xs font-medium text-rose-700 transition hover:bg-rose-50 disabled:opacity-50"
                    >
                      Eliminar
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </SectionCard>

      <SectionCard
        title={selectedCustomer ? 'Editar cliente' : 'Nuevo cliente'}
        description="Formulario modernizado conservando el payload actual del backend."
      >
        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Razon social" name="name" value={formValues.name} onChange={handleChange} required />
            <Field label="Contacto" name="contact" value={formValues.contact} onChange={handleChange} />
            <Field label="Telefono" name="phone" value={formValues.phone} onChange={handleChange} />
            <Field label="Email" name="email" type="email" value={formValues.email} onChange={handleChange} />
            <Field className="md:col-span-2" label="Direccion" name="address" value={formValues.address} onChange={handleChange} />
            <Field label="Ciudad" name="city" value={formValues.city} onChange={handleChange} />
            <SelectField label="Provincia" name="province" value={formValues.province} onChange={handleChange} options={CUSTOMER_PROVINCES} />
            <SelectField label="Pais" name="country" value={formValues.country} onChange={handleChange} options={CUSTOMER_COUNTRIES} />
            <Field label="DNI/CUIT" name="tax_id" value={formValues.tax_id} onChange={handleChange} />
            <SelectField label="Cond. IVA" name="iva_condition" value={formValues.iva_condition} onChange={handleChange} options={CUSTOMER_IVA_CONDITIONS} />
            <Field label="Instagram" name="instagram" value={formValues.instagram} onChange={handleChange} />
            <SelectField label="Transporte" name="transport" value={formValues.transport} onChange={handleChange} options={CUSTOMER_TRANSPORTS} />
            <Field label="Limite cta cte" name="credit_limit" type="number" value={formValues.credit_limit} onChange={handleChange} />
            <SelectField label="Zona" name="zone" value={formValues.zone} onChange={handleChange} options={CUSTOMER_ZONES} />
            <Field label="% Descuento" name="discount_percent" type="number" value={formValues.discount_percent} onChange={handleChange} />
            <SelectField label="Vendedor" name="seller" value={formValues.seller} onChange={handleChange} options={CUSTOMER_SELLERS} />
            <Field label="Lista de precios" name="price_list" value={formValues.price_list} onChange={handleChange} />
            <TextAreaField className="md:col-span-2" label="Condiciones" name="billing_conditions" value={formValues.billing_conditions} onChange={handleChange} rows={4} />
            <TextAreaField className="md:col-span-2" label="Observaciones" name="notes" value={formValues.notes} onChange={handleChange} rows={5} />
          </div>

          {feedback ? <InlineFeedback text={feedback} /> : null}

          <div className="flex gap-3">
            <button
              type="submit"
              disabled={isSaving}
              className="inline-flex items-center justify-center rounded-2xl bg-brand px-4 py-3 text-sm font-medium text-white transition hover:bg-teal-700 disabled:opacity-60"
            >
              {isSaving ? 'Guardando...' : selectedCustomer ? 'Guardar cambios' : 'Crear cliente'}
            </button>
            <button
              type="button"
              onClick={handleCreateNew}
              className="inline-flex items-center justify-center rounded-2xl border border-slate-300 px-4 py-3 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
            >
              Limpiar
            </button>
          </div>
        </form>
      </SectionCard>
    </div>
  );
}

function Field({ className = '', label, name, value, onChange, type = 'text', required = false }: FieldProps) {
  return (
    <label className={`block ${className}`.trim()}>
      <span className="mb-2 block text-sm font-medium text-slate-700">{label}</span>
      <input
        className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20"
        name={name}
        type={type}
        value={value}
        onChange={onChange}
        required={required}
      />
    </label>
  );
}

function SelectField({ label, name, value, onChange, options }: SelectFieldProps) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-medium text-slate-700">{label}</span>
      <select
        className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20"
        name={name}
        value={value}
        onChange={onChange}
      >
        <option value="">Seleccionar</option>
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </label>
  );
}

function TextAreaField({ className = '', label, name, value, onChange, rows }: TextAreaFieldProps) {
  return (
    <label className={`block ${className}`.trim()}>
      <span className="mb-2 block text-sm font-medium text-slate-700">{label}</span>
      <textarea
        className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20"
        name={name}
        value={value}
        onChange={onChange}
        rows={rows}
      />
    </label>
  );
}

function Notice({ text }: { text: string }) {
  return <div className="rounded-2xl border border-dashed border-slate-300 px-4 py-6 text-sm text-slate-500">{text}</div>;
}

function ErrorNotice({ text }: { text: string }) {
  return <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-6 text-sm text-rose-700">{text}</div>;
}

function InlineFeedback({ text }: { text: string }) {
  return <div className="rounded-2xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-700">{text}</div>;
}

interface FieldProps {
  className?: string;
  label: string;
  name: keyof CustomerPayload;
  value: string;
  onChange: (event: ChangeEvent<HTMLInputElement>) => void;
  type?: 'text' | 'email' | 'number';
  required?: boolean;
}

interface SelectFieldProps {
  label: string;
  name: keyof CustomerPayload;
  value: string;
  onChange: (event: ChangeEvent<HTMLSelectElement>) => void;
  options: readonly string[];
}

interface TextAreaFieldProps {
  className?: string;
  label: string;
  name: keyof CustomerPayload;
  value: string;
  onChange: (event: ChangeEvent<HTMLTextAreaElement>) => void;
  rows: number;
}
