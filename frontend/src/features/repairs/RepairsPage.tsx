import { useMemo, useState, type ChangeEvent, type FormEvent } from 'react';
import { SectionCard } from '../../components/ui/SectionCard';
import { useRepairDetail, useRepairFormData, useRepairMutations, useRepairs, useRepairStats } from './useRepairs';
import type { Repair, RepairPayload } from '../../types/repair';

const REPAIR_STATUSES = [
  { key: 'all', label: 'Todas' },
  { key: 'received', label: 'Recibido' },
  { key: 'diagnosing', label: 'Diagnostico' },
  { key: 'waiting_parts', label: 'Esperando repuestos' },
  { key: 'repairing', label: 'En reparacion' },
  { key: 'ready', label: 'Listo' },
  { key: 'delivered', label: 'Entregado' }
] as const;

const EMPTY_REPAIR_FORM: RepairPayload = {
  customer_id: '',
  device_type: '',
  brand: '',
  model: '',
  serial_number: '',
  imei: '',
  password: '',
  pattern: '',
  problem_description: '',
  accessories: '',
  estimated_price: '',
  final_price: '',
  technician_notes: ''
};

function toRepairFormValues(repair: Repair | null): RepairPayload {
  if (!repair) return { ...EMPTY_REPAIR_FORM };

  return {
    customer_id: String(repair.customer_id || ''),
    device_type: repair.device_type || '',
    brand: repair.brand || '',
    model: repair.model || '',
    serial_number: repair.serial_number || '',
    imei: repair.imei || '',
    password: repair.password || '',
    pattern: repair.pattern || '',
    problem_description: repair.problem_description || '',
    accessories: repair.accessories || '',
    estimated_price: repair.estimated_price != null ? String(repair.estimated_price) : '',
    final_price: repair.final_price != null ? String(repair.final_price) : '',
    technician_notes: repair.technician_notes || ''
  };
}

export function RepairsPage() {
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<string>('all');
  const [selectedRepairId, setSelectedRepairId] = useState<number | null>(null);
  const [createFormValues, setCreateFormValues] = useState<RepairPayload>({ ...EMPTY_REPAIR_FORM });
  const [detailFormValues, setDetailFormValues] = useState<RepairPayload>({ ...EMPTY_REPAIR_FORM });
  const [nextStatus, setNextStatus] = useState('received');
  const [statusNotes, setStatusNotes] = useState('');
  const [feedback, setFeedback] = useState('');
  const repairsQuery = useRepairs({ status, search });
  const statsQuery = useRepairStats();
  const repairDetailQuery = useRepairDetail(selectedRepairId);
  const { customersQuery, deviceTypesQuery, brandsQuery, modelsQuery } = useRepairFormData();
  const { createMutation, updateMutation, updateStatusMutation, deleteMutation } = useRepairMutations();

  const repairs = repairsQuery.data || [];
  const stats = statsQuery.data;
  const customers = customersQuery.data || [];
  const deviceTypes = deviceTypesQuery.data || [];
  const brands = brandsQuery.data || [];
  const models = modelsQuery.data || [];

  const filteredModels = useMemo(() => {
    const selectedBrand = brands.find((brand) => brand.name === createFormValues.brand);
    if (!selectedBrand) return models;
    return models.filter((model) => Number(model.brand_id || 0) === Number(selectedBrand.id));
  }, [brands, createFormValues.brand, models]);

  const detailFilteredModels = useMemo(() => {
    const selectedBrand = brands.find((brand) => brand.name === detailFormValues.brand);
    if (!selectedBrand) return models;
    return models.filter((model) => Number(model.brand_id || 0) === Number(selectedBrand.id));
  }, [brands, detailFormValues.brand, models]);

  function handleCreateChange(event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) {
    const { name, value } = event.target;
    setCreateFormValues((current) => ({
      ...current,
      [name]: value
    }));
  }

  function handleDetailChange(event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) {
    const { name, value } = event.target;
    setDetailFormValues((current) => ({
      ...current,
      [name]: value
    }));
  }

  async function handleCreateSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFeedback('');

    if (!createFormValues.customer_id || !createFormValues.device_type || !createFormValues.problem_description.trim()) {
      setFeedback('Cliente, tipo de dispositivo y problema son obligatorios.');
      return;
    }

    try {
      await createMutation.mutateAsync({
        ...createFormValues,
        customer_id: Number(createFormValues.customer_id),
        estimated_price: createFormValues.estimated_price ? Number(createFormValues.estimated_price) : null
      });
      setCreateFormValues({ ...EMPTY_REPAIR_FORM });
      setFeedback('Reparacion creada correctamente.');
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : 'No se pudo crear la reparacion.');
    }
  }

  async function handleSelectRepair(repair: Repair) {
    setSelectedRepairId(repair.id);
    setFeedback('');
  }

  if (repairDetailQuery.data && detailFormValues.customer_id === '' && selectedRepairId === repairDetailQuery.data.id) {
    setDetailFormValues(toRepairFormValues(repairDetailQuery.data));
    setNextStatus(repairDetailQuery.data.status);
  }

  async function handleUpdateDetail(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedRepairId) return;
    setFeedback('');

    try {
      await updateMutation.mutateAsync({
        id: selectedRepairId,
        payload: {
          ...detailFormValues,
          estimated_price: detailFormValues.estimated_price ? Number(detailFormValues.estimated_price) : null,
          final_price: detailFormValues.final_price ? Number(detailFormValues.final_price) : null
        }
      });

      if (repairDetailQuery.data && repairDetailQuery.data.status !== nextStatus) {
        await updateStatusMutation.mutateAsync({
          id: selectedRepairId,
          status: nextStatus,
          notes: statusNotes
        });
      }

      setFeedback('Reparacion actualizada correctamente.');
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : 'No se pudo actualizar la reparacion.');
    }
  }

  async function handleDeleteSelected() {
    if (!selectedRepairId || !repairDetailQuery.data) return;
    const confirmed = window.confirm(`Eliminar reparacion ${repairDetailQuery.data.ticket_number}?`);
    if (!confirmed) return;

    try {
      await deleteMutation.mutateAsync(selectedRepairId);
      setSelectedRepairId(null);
      setDetailFormValues({ ...EMPTY_REPAIR_FORM });
      setFeedback('Reparacion eliminada correctamente.');
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : 'No se pudo eliminar la reparacion.');
    }
  }

  return (
    <div className="space-y-6">
      <section className="grid gap-4 md:grid-cols-3 xl:grid-cols-6">
        {REPAIR_STATUSES.slice(1).map((item) => (
          <article key={item.key} className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand">{item.label}</p>
            <strong className="mt-3 block text-2xl font-semibold text-slate-900">{stats ? String(stats[item.key as keyof typeof stats] || 0) : '-'}</strong>
          </article>
        ))}
      </section>

      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <SectionCard title="Reparaciones" description="Listado operativo con filtros por estado y busqueda.">
          <div className="mb-4 grid gap-3 md:grid-cols-[minmax(0,1fr)_220px]">
            <input
              className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20"
              placeholder="Buscar por ticket, cliente, marca o modelo"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
            <select
              className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20"
              value={status}
              onChange={(event) => setStatus(event.target.value)}
            >
              {REPAIR_STATUSES.map((item) => (
                <option key={item.key} value={item.key}>
                  {item.label}
                </option>
              ))}
            </select>
          </div>

          {repairsQuery.isLoading ? (
            <Notice text="Cargando reparaciones..." />
          ) : repairsQuery.isError ? (
            <ErrorNotice text={repairsQuery.error instanceof Error ? repairsQuery.error.message : 'No se pudieron cargar reparaciones.'} />
          ) : repairs.length === 0 ? (
            <Notice text="No hay reparaciones para mostrar." />
          ) : (
            <div className="space-y-3">
              {repairs.map((repair) => (
                <button
                  key={repair.id}
                  type="button"
                  onClick={() => void handleSelectRepair(repair)}
                  className={`w-full rounded-2xl border px-4 py-4 text-left transition ${selectedRepairId === repair.id ? 'border-brand bg-teal-50' : 'border-slate-200 bg-white hover:bg-slate-50'}`}
                >
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                      <h3 className="font-medium text-slate-900">{repair.ticket_number}</h3>
                      <p className="mt-1 text-sm text-slate-500">{repair.customer_name || 'Cliente'} · {repair.device_type}</p>
                      <p className="mt-1 text-sm text-slate-500">{`${repair.brand || 'Equipo'} ${repair.model || ''}`.trim()}</p>
                    </div>
                    <span className="rounded-full bg-slate-900 px-3 py-1 text-xs font-medium text-white">{repair.status_label || repair.status}</span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </SectionCard>

        <SectionCard title="Nueva reparacion" description="Alta inicial compatible con el formulario actual.">
          <form className="space-y-4" onSubmit={handleCreateSubmit}>
            <SelectField label="Cliente" name="customer_id" value={createFormValues.customer_id} onChange={handleCreateChange} options={customers.map((item) => ({ value: String(item.id), label: item.name }))} required />
            <SelectField label="Tipo de dispositivo" name="device_type" value={createFormValues.device_type} onChange={handleCreateChange} options={deviceTypes.map((item) => ({ value: item.name, label: item.name }))} required />
            <SelectField label="Marca" name="brand" value={createFormValues.brand} onChange={handleCreateChange} options={brands.map((item) => ({ value: item.name, label: item.name }))} />
            <SelectField label="Modelo" name="model" value={createFormValues.model} onChange={handleCreateChange} options={filteredModels.map((item) => ({ value: item.name, label: item.name }))} />
            <Field label="Serie" name="serial_number" value={createFormValues.serial_number} onChange={handleCreateChange} />
            <Field label="IMEI" name="imei" value={createFormValues.imei} onChange={handleCreateChange} />
            <Field label="Contrasena" name="password" value={createFormValues.password} onChange={handleCreateChange} />
            <Field label="Patron" name="pattern" value={createFormValues.pattern} onChange={handleCreateChange} />
            <TextAreaField label="Problema" name="problem_description" value={createFormValues.problem_description} onChange={handleCreateChange} rows={4} required />
            <Field label="Accesorios" name="accessories" value={createFormValues.accessories} onChange={handleCreateChange} />
            <Field label="Precio estimado" name="estimated_price" type="number" value={createFormValues.estimated_price} onChange={handleCreateChange} />

            {feedback ? <InlineFeedback text={feedback} tone={feedback.includes('No ') ? 'error' : 'info'} /> : null}

            <button
              type="submit"
              disabled={createMutation.isPending}
              className="inline-flex items-center justify-center rounded-2xl bg-brand px-4 py-3 text-sm font-medium text-white transition hover:bg-teal-700 disabled:opacity-60"
            >
              {createMutation.isPending ? 'Guardando...' : 'Crear reparacion'}
            </button>
          </form>
        </SectionCard>
      </div>

      <SectionCard title="Detalle de reparacion" description="Edicion y cambio de estado conservando la API actual.">
        {!selectedRepairId ? (
          <Notice text="Selecciona una reparacion para editar su detalle." />
        ) : repairDetailQuery.isLoading ? (
          <Notice text="Cargando detalle..." />
        ) : repairDetailQuery.isError || !repairDetailQuery.data ? (
          <ErrorNotice text={repairDetailQuery.error instanceof Error ? repairDetailQuery.error.message : 'No se pudo cargar el detalle.'} />
        ) : (
          <form className="space-y-4" onSubmit={handleUpdateDetail}>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              <Field label="Ticket" name="serial_number" value={repairDetailQuery.data.ticket_number} onChange={() => {}} readOnly />
              <Field label="Cliente" name="serial_number" value={repairDetailQuery.data.customer_name || ''} onChange={() => {}} readOnly />
              <SelectField label="Estado" name="detail-status" value={nextStatus} onChange={(event) => setNextStatus(event.target.value)} options={REPAIR_STATUSES.slice(1).map((item) => ({ value: item.key, label: item.label }))} />
              <SelectField label="Tipo" name="device_type" value={detailFormValues.device_type} onChange={handleDetailChange} options={deviceTypes.map((item) => ({ value: item.name, label: item.name }))} />
              <SelectField label="Marca" name="brand" value={detailFormValues.brand} onChange={handleDetailChange} options={brands.map((item) => ({ value: item.name, label: item.name }))} />
              <SelectField label="Modelo" name="model" value={detailFormValues.model} onChange={handleDetailChange} options={detailFilteredModels.map((item) => ({ value: item.name, label: item.name }))} />
              <Field label="Serie" name="serial_number" value={detailFormValues.serial_number} onChange={handleDetailChange} />
              <Field label="IMEI" name="imei" value={detailFormValues.imei} onChange={handleDetailChange} />
              <Field label="Contrasena" name="password" value={detailFormValues.password} onChange={handleDetailChange} />
              <Field label="Patron" name="pattern" value={detailFormValues.pattern} onChange={handleDetailChange} />
              <Field label="Precio estimado" name="estimated_price" type="number" value={detailFormValues.estimated_price} onChange={handleDetailChange} />
              <Field label="Precio final" name="final_price" type="number" value={detailFormValues.final_price} onChange={handleDetailChange} />
              <Field className="xl:col-span-3" label="Notas de cambio de estado" name="status_notes" value={statusNotes} onChange={(event) => setStatusNotes(event.target.value)} />
              <TextAreaField className="xl:col-span-3" label="Problema" name="problem_description" value={detailFormValues.problem_description} onChange={handleDetailChange} rows={4} />
              <Field className="xl:col-span-3" label="Accesorios" name="accessories" value={detailFormValues.accessories} onChange={handleDetailChange} />
              <TextAreaField className="xl:col-span-3" label="Notas del tecnico" name="technician_notes" value={detailFormValues.technician_notes} onChange={handleDetailChange} rows={4} />
            </div>

            {repairDetailQuery.data.logs && repairDetailQuery.data.logs.length > 0 ? (
              <div className="rounded-2xl border border-slate-200 p-4">
                <h3 className="mb-3 text-sm font-semibold uppercase tracking-[0.2em] text-brand">Historial</h3>
                <div className="space-y-2">
                  {repairDetailQuery.data.logs.map((log) => (
                    <div key={log.id} className="flex flex-col gap-1 rounded-2xl bg-slate-50 px-3 py-3 text-sm text-slate-600">
                      <strong className="text-slate-900">{log.status}</strong>
                      <span>{log.notes || 'Sin notas'}</span>
                      <span>{new Date(log.created_at).toLocaleString('es-AR')}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            {feedback ? <InlineFeedback text={feedback} tone={feedback.includes('No ') ? 'error' : 'info'} /> : null}

            <div className="flex gap-3">
              <button
                type="submit"
                disabled={updateMutation.isPending || updateStatusMutation.isPending}
                className="inline-flex items-center justify-center rounded-2xl bg-brand px-4 py-3 text-sm font-medium text-white transition hover:bg-teal-700 disabled:opacity-60"
              >
                Guardar cambios
              </button>
              <button
                type="button"
                onClick={() => void handleDeleteSelected()}
                disabled={deleteMutation.isPending}
                className="inline-flex items-center justify-center rounded-2xl border border-rose-300 px-4 py-3 text-sm font-medium text-rose-700 transition hover:bg-rose-50 disabled:opacity-60"
              >
                Eliminar
              </button>
            </div>
          </form>
        )}
      </SectionCard>
    </div>
  );
}

function Field({ className = '', label, name, value, onChange, type = 'text', required = false, readOnly = false }: FieldProps) {
  return (
    <label className={`block ${className}`.trim()}>
      <span className="mb-2 block text-sm font-medium text-slate-700">{label}</span>
      <input
        className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20 read-only:bg-slate-100"
        name={name}
        type={type}
        value={value}
        onChange={onChange}
        required={required}
        readOnly={readOnly}
      />
    </label>
  );
}

function SelectField({ label, name, value, onChange, options, required = false }: SelectFieldProps) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-medium text-slate-700">{label}</span>
      <select
        className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20"
        name={name}
        value={value}
        onChange={onChange}
        required={required}
      >
        <option value="">Seleccionar</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function TextAreaField({ className = '', label, name, value, onChange, rows, required = false }: TextAreaFieldProps) {
  return (
    <label className={`block ${className}`.trim()}>
      <span className="mb-2 block text-sm font-medium text-slate-700">{label}</span>
      <textarea
        className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20"
        name={name}
        value={value}
        onChange={onChange}
        rows={rows}
        required={required}
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

function InlineFeedback({ text, tone }: { text: string; tone: 'info' | 'error' }) {
  return (
    <div className={`rounded-2xl px-4 py-3 text-sm ${tone === 'error' ? 'border border-rose-200 bg-rose-50 text-rose-700' : 'border border-sky-200 bg-sky-50 text-sky-700'}`}>
      {text}
    </div>
  );
}

interface FieldProps {
  className?: string;
  label: string;
  name: string;
  value: string;
  onChange: (event: ChangeEvent<HTMLInputElement>) => void;
  type?: 'text' | 'number';
  required?: boolean;
  readOnly?: boolean;
}

interface SelectFieldProps {
  label: string;
  name: string;
  value: string;
  onChange: (event: ChangeEvent<HTMLSelectElement>) => void;
  options: Array<{ value: string; label: string }>;
  required?: boolean;
}

interface TextAreaFieldProps {
  className?: string;
  label: string;
  name: string;
  value: string;
  onChange: (event: ChangeEvent<HTMLTextAreaElement>) => void;
  rows: number;
  required?: boolean;
}
