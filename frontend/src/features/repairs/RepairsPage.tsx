import { useEffect, useMemo, useState, type ChangeEvent, type FormEvent } from 'react';
import { useRepairDetail, useRepairFormData, useRepairMutations, useRepairs } from './useRepairs';
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

function getStatusBadgeClass(status: string) {
  return status === 'ready' || status === 'delivered' ? 'badge-green' : 'badge-blue';
}

export function RepairsPage() {
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<string>('all');
  const [selectedRepairId, setSelectedRepairId] = useState<number | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [createFormValues, setCreateFormValues] = useState<RepairPayload>({ ...EMPTY_REPAIR_FORM });
  const [detailFormValues, setDetailFormValues] = useState<RepairPayload>({ ...EMPTY_REPAIR_FORM });
  const [nextStatus, setNextStatus] = useState('received');
  const [statusNotes, setStatusNotes] = useState('');
  const [feedback, setFeedback] = useState('');
  const repairsQuery = useRepairs({ status, search });
  const repairDetailQuery = useRepairDetail(selectedRepairId);
  const { customersQuery, deviceTypesQuery, brandsQuery, modelsQuery } = useRepairFormData();
  const { createMutation, updateMutation, updateStatusMutation, deleteMutation } = useRepairMutations();

  const repairs = repairsQuery.data || [];
  const customers = customersQuery.data || [];
  const deviceTypes = deviceTypesQuery.data || [];
  const brands = brandsQuery.data || [];
  const models = modelsQuery.data || [];

  const filteredCreateModels = useMemo(() => {
    const selectedBrand = brands.find((brand) => brand.name === createFormValues.brand);
    if (!selectedBrand) return models;
    return models.filter((model) => Number(model.brand_id || 0) === Number(selectedBrand.id));
  }, [brands, createFormValues.brand, models]);

  const filteredDetailModels = useMemo(() => {
    const selectedBrand = brands.find((brand) => brand.name === detailFormValues.brand);
    if (!selectedBrand) return models;
    return models.filter((model) => Number(model.brand_id || 0) === Number(selectedBrand.id));
  }, [brands, detailFormValues.brand, models]);

  useEffect(() => {
    if (!repairDetailQuery.data) return;
    setDetailFormValues(toRepairFormValues(repairDetailQuery.data));
    setNextStatus(repairDetailQuery.data.status);
    setStatusNotes('');
  }, [repairDetailQuery.data]);

  function openCreateModal() {
    setCreateFormValues({ ...EMPTY_REPAIR_FORM });
    setFeedback('');
    setIsCreateModalOpen(true);
  }

  function closeCreateModal() {
    setIsCreateModalOpen(false);
  }

  function closeDetailModal() {
    setSelectedRepairId(null);
    setStatusNotes('');
    setFeedback('');
  }

  function handleCreateChange(event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) {
    const { name, value } = event.target;
    setCreateFormValues((current) => ({ ...current, [name]: value }));
  }

  function handleDetailChange(event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) {
    const { name, value } = event.target;
    setDetailFormValues((current) => ({ ...current, [name]: value }));
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
      closeCreateModal();
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : 'No se pudo crear la reparacion.');
    }
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

      closeDetailModal();
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : 'No se pudo actualizar la reparacion.');
    }
  }

  async function handleDeleteSelected() {
    if (!selectedRepairId) return;
    const confirmed = window.confirm('Esta seguro de eliminar esta reparacion?');
    if (!confirmed) return;

    try {
      await deleteMutation.mutateAsync(selectedRepairId);
      closeDetailModal();
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : 'No se pudo eliminar la reparacion.');
    }
  }

  return (
    <>
      <div className="card">
        <div className="card-header">
          <h3 className="card-title">Gestion de Reparaciones</h3>
          <button className="btn btn-primary" type="button" onClick={openCreateModal}>
            + Nueva Reparacion
          </button>
        </div>

        <div className="repair-status-flow">
          {REPAIR_STATUSES.map((item) => (
            <span
              key={item.key}
              className={`status-step${status === item.key ? ' active' : ''}`}
              onClick={() => setStatus(item.key)}
            >
              {item.label}
            </span>
          ))}
        </div>

        <div className="toolbar">
          <div className="search-box">
            <input
              type="text"
              id="repair-search"
              placeholder="Buscar por ticket o cliente..."
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>
          <button className="btn btn-warning" type="button" onClick={() => repairsQuery.refetch()}>
            Actualizar
          </button>
        </div>

        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Ticket</th>
                <th>Cliente</th>
                <th>Dispositivo</th>
                <th>Marca</th>
                <th>Estado</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody id="repairs-table">
              {repairsQuery.isLoading ? (
                <tr><td colSpan={6}>Cargando...</td></tr>
              ) : repairsQuery.isError ? (
                <tr><td colSpan={6}>Error: {repairsQuery.error instanceof Error ? repairsQuery.error.message : 'No se pudieron cargar reparaciones.'}</td></tr>
              ) : repairs.length === 0 ? (
                <tr><td colSpan={6}>No hay reparaciones para mostrar.</td></tr>
              ) : (
                repairs.map((repair) => (
                  <tr key={repair.id}>
                    <td><strong>{repair.ticket_number}</strong></td>
                    <td>{repair.customer_name}</td>
                    <td>{repair.device_type}</td>
                    <td>{repair.brand || ''}</td>
                    <td><span className={`badge ${getStatusBadgeClass(repair.status)}`}>{repair.status_label || repair.status}</span></td>
                    <td>
                      <button className="btn btn-sm btn-secondary" type="button" onClick={() => setSelectedRepairId(repair.id)}>
                        Ver
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {isCreateModalOpen ? (
        <div className="modal-overlay" onClick={(event) => { if (event.target === event.currentTarget) closeCreateModal(); }}>
          <div id="repair-modal" className="modal modal-narrow">
            <div className="modal-header modal-header-tight">
              <h3>Nueva Reparacion</h3>
              <button className="modal-close" type="button" onClick={closeCreateModal}>&times;</button>
            </div>
            <div className="modal-body">
              <form onSubmit={handleCreateSubmit}>
                <div className="form-group">
                  <label>Cliente</label>
                  <select name="customer_id" value={createFormValues.customer_id} onChange={handleCreateChange}>
                    <option value="">Seleccionar cliente...</option>
                    {customers.map((customer) => (
                      <option key={customer.id} value={String(customer.id)}>{customer.name}</option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label>Tipo de Dispositivo</label>
                  <select name="device_type" value={createFormValues.device_type} onChange={handleCreateChange}>
                    <option value="">Seleccionar tipo...</option>
                    {deviceTypes.map((type) => (
                      <option key={type.id ?? type.name} value={type.name}>{type.name}</option>
                    ))}
                  </select>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label>Marca</label>
                    <select name="brand" value={createFormValues.brand} onChange={handleCreateChange}>
                      <option value="">Seleccionar marca...</option>
                      {brands.map((brand) => (
                        <option key={brand.id} value={brand.name}>{brand.name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Modelo</label>
                    <select name="model" value={createFormValues.model} onChange={handleCreateChange}>
                      <option value="">Seleccionar modelo...</option>
                      {filteredCreateModels.map((model) => (
                        <option key={model.id} value={model.name}>{model.name}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label>Numero de Serie</label>
                    <input name="serial_number" value={createFormValues.serial_number} onChange={handleCreateChange} />
                  </div>
                  <div className="form-group">
                    <label>IMEI</label>
                    <input name="imei" value={createFormValues.imei} onChange={handleCreateChange} />
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label>Contrasena</label>
                    <input name="password" value={createFormValues.password} onChange={handleCreateChange} />
                  </div>
                  <div className="form-group">
                    <label>Patron</label>
                    <input name="pattern" value={createFormValues.pattern} onChange={handleCreateChange} />
                  </div>
                </div>
                <div className="form-group">
                  <label>Problema</label>
                  <textarea name="problem_description" rows={3} value={createFormValues.problem_description} onChange={handleCreateChange} />
                </div>
                <div className="form-group">
                  <label>Accesorios</label>
                  <input name="accessories" value={createFormValues.accessories} onChange={handleCreateChange} />
                </div>
                {feedback ? <div className="alert alert-warning">{feedback}</div> : null}
                <div className="modal-footer">
                  <button className="btn btn-secondary" type="button" onClick={closeCreateModal}>Cancelar</button>
                  <button className="btn btn-primary" type="submit" disabled={createMutation.isPending}>Guardar</button>
                </div>
              </form>
            </div>
          </div>
        </div>
      ) : null}

      {selectedRepairId ? (
        <div className="modal-overlay" onClick={(event) => { if (event.target === event.currentTarget) closeDetailModal(); }}>
          <div id="repair-detail-modal" className="modal modal-narrow">
            {repairDetailQuery.isLoading ? (
              <div className="modal-body">Cargando detalle...</div>
            ) : repairDetailQuery.isError || !repairDetailQuery.data ? (
              <div className="modal-body">{repairDetailQuery.error instanceof Error ? repairDetailQuery.error.message : 'No se pudo cargar el detalle.'}</div>
            ) : (
              <>
                <div className="modal-header modal-header-tight">
                  <h3>Detalle de Reparacion</h3>
                  <button className="modal-close" type="button" onClick={closeDetailModal}>&times;</button>
                </div>
                <div className="modal-body">
                  <div className="detail-section">
                    <div className="detail-row"><span className="detail-label">Ticket:</span><span className="detail-value"><strong>{repairDetailQuery.data.ticket_number}</strong></span></div>
                    <div className="detail-row"><span className="detail-label">Cliente:</span><span className="detail-value">{repairDetailQuery.data.customer_name}</span></div>
                    <div className="detail-row"><span className="detail-label">Telefono:</span><span className="detail-value">{repairDetailQuery.data.customer_phone || '-'}</span></div>
                  </div>
                  <form onSubmit={handleUpdateDetail}>
                    <h4>Informacion del Dispositivo</h4>
                    <div className="form-row">
                      <div className="form-group">
                        <label>Tipo</label>
                        <select name="device_type" value={detailFormValues.device_type} onChange={handleDetailChange}>
                          <option value="">Seleccionar tipo...</option>
                          {deviceTypes.map((type) => (
                            <option key={type.id ?? type.name} value={type.name}>{type.name}</option>
                          ))}
                        </select>
                      </div>
                      <div className="form-group">
                        <label>Marca</label>
                        <select name="brand" value={detailFormValues.brand} onChange={handleDetailChange}>
                          <option value="">Seleccionar marca...</option>
                          {brands.map((brand) => (
                            <option key={brand.id} value={brand.name}>{brand.name}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                    <div className="form-row">
                      <div className="form-group">
                        <label>Modelo</label>
                        <select name="model" value={detailFormValues.model} onChange={handleDetailChange}>
                          <option value="">Seleccionar modelo...</option>
                          {filteredDetailModels.map((model) => (
                            <option key={model.id} value={model.name}>{model.name}</option>
                          ))}
                        </select>
                      </div>
                      <div className="form-group">
                        <label>Numero de Serie</label>
                        <input name="serial_number" value={detailFormValues.serial_number} onChange={handleDetailChange} />
                      </div>
                    </div>
                    <div className="form-row">
                      <div className="form-group">
                        <label>IMEI</label>
                        <input name="imei" value={detailFormValues.imei} onChange={handleDetailChange} />
                      </div>
                      <div className="form-group">
                        <label>Contrasena</label>
                        <input name="password" value={detailFormValues.password} onChange={handleDetailChange} />
                      </div>
                    </div>
                    <div className="form-group">
                      <label>Patron</label>
                      <input name="pattern" value={detailFormValues.pattern} onChange={handleDetailChange} />
                    </div>
                    <div className="form-group">
                      <label>Problema Reportado</label>
                      <textarea name="problem_description" rows={2} value={detailFormValues.problem_description} onChange={handleDetailChange} />
                    </div>
                    <div className="form-group">
                      <label>Accesorios</label>
                      <input name="accessories" value={detailFormValues.accessories} onChange={handleDetailChange} />
                    </div>
                    <h4>Estado y Precios</h4>
                    <div className="form-row">
                      <div className="form-group">
                        <label>Estado</label>
                        <select value={nextStatus} onChange={(event) => setNextStatus(event.target.value)}>
                          {REPAIR_STATUSES.slice(1).map((item) => (
                            <option key={item.key} value={item.key}>{item.label}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                    <div className="form-row">
                      <div className="form-group">
                        <label>Precio Estimado</label>
                        <input name="estimated_price" type="number" value={detailFormValues.estimated_price} onChange={handleDetailChange} />
                      </div>
                      <div className="form-group">
                        <label>Precio Final</label>
                        <input name="final_price" type="number" value={detailFormValues.final_price} onChange={handleDetailChange} />
                      </div>
                    </div>
                    <div className="form-group">
                      <label>Notas del Tecnico</label>
                      <textarea name="technician_notes" rows={2} value={detailFormValues.technician_notes} onChange={handleDetailChange} />
                    </div>
                    {nextStatus !== 'delivered' ? (
                      <div id="status-notes-section" className="form-group">
                        <label>Notas del Cambio de Estado</label>
                        <input value={statusNotes} onChange={(event) => setStatusNotes(event.target.value)} placeholder="Agregar nota..." />
                      </div>
                    ) : null}
                    <h4>Historial</h4>
                    <div className="repair-logs">
                      {repairDetailQuery.data.logs && repairDetailQuery.data.logs.length > 0 ? (
                        repairDetailQuery.data.logs.map((log) => (
                          <div key={log.id} className="repair-log">
                            <span className="log-date">{new Date(log.created_at).toLocaleString('es-AR')}</span>
                            <span className="log-status">{log.status}</span>
                            <span className="log-notes">{log.notes || ''}</span>
                          </div>
                        ))
                      ) : (
                        <p>No hay historial</p>
                      )}
                    </div>
                    {feedback ? <div className="alert alert-warning repair-feedback-alert">{feedback}</div> : null}
                    <div className="modal-footer">
                      <button className="btn btn-secondary" type="button" onClick={closeDetailModal}>Cerrar</button>
                      <button className="btn btn-warning" type="button" onClick={() => void handleDeleteSelected()} disabled={deleteMutation.isPending}>Eliminar</button>
                      <button className="btn btn-primary" type="submit" disabled={updateMutation.isPending || updateStatusMutation.isPending}>Guardar</button>
                    </div>
                  </form>
                </div>
              </>
            )}
          </div>
        </div>
      ) : null}
    </>
  );
}
