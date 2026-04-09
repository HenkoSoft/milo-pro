import { startTransition, useMemo, useState, type ChangeEvent, type FormEvent } from 'react';
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
  country: '',
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

type CustomerTab = 'datos' | 'facturacion' | 'observaciones';

function toFormValues(customer: Customer | null): CustomerPayload {
  if (!customer) {
    return { ...EMPTY_FORM };
  }

  return {
    name: customer.name || '',
    phone: customer.phone || '',
    email: customer.email || '',
    address: customer.address || '',
    contact: customer.contact || '',
    city: customer.city || '',
    province: customer.province || '',
    country: customer.country || '',
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

function getCustomerCode(customer: Customer | null) {
  if (!customer?.id) return 'Autogenerado';
  return `CL-${String(customer.id).padStart(4, '0')}`;
}

export function CustomersPage() {
  const [search, setSearch] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [formValues, setFormValues] = useState<CustomerPayload>({ ...EMPTY_FORM });
  const [feedback, setFeedback] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<CustomerTab>('datos');
  const customersQuery = useCustomers(search);
  const { createMutation, updateMutation, deleteMutation } = useCustomerMutations();

  const isSaving = createMutation.isPending || updateMutation.isPending;
  const customers = customersQuery.data || [];

  const sortedCustomers = useMemo(
    () => customers.slice().sort((a, b) => String(a.name || '').localeCompare(String(b.name || ''))),
    [customers]
  );

  function openNewCustomerModal() {
    startTransition(() => {
      setSelectedCustomer(null);
      setFormValues({ ...EMPTY_FORM });
      setFeedback('');
      setActiveTab('datos');
      setIsModalOpen(true);
    });
  }

  function openEditCustomerModal(customer: Customer) {
    startTransition(() => {
      setSelectedCustomer(customer);
      setFormValues(toFormValues(customer));
      setFeedback('');
      setActiveTab('datos');
      setIsModalOpen(true);
    });
  }

  function closeModal() {
    setIsModalOpen(false);
    setFeedback('');
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
      setActiveTab('datos');
      setFeedback('La razon social es obligatoria');
      return;
    }

    try {
      if (selectedCustomer) {
        await updateMutation.mutateAsync({ id: selectedCustomer.id, payload: formValues });
      } else {
        await createMutation.mutateAsync(formValues);
      }
      closeModal();
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : 'No se pudo guardar el cliente.');
    }
  }

  async function handleDelete(customer: Customer) {
    const confirmed = window.confirm('Eliminar cliente?');
    if (!confirmed) return;

    try {
      await deleteMutation.mutateAsync(customer.id);
      if (selectedCustomer?.id === customer.id) {
        closeModal();
      }
    } catch (error) {
      window.alert(error instanceof Error ? error.message : 'No se pudo eliminar el cliente.');
    }
  }

  return (
    <>
      <div className="card">
        <div className="card-header">
          <h3 className="card-title">Gestion de Clientes</h3>
          <button className="btn btn-primary" type="button" onClick={openNewCustomerModal}>
            + Nuevo Cliente
          </button>
        </div>

        <div className="toolbar">
          <div className="search-box">
            <input
              type="text"
              id="customer-search"
              placeholder="Buscar cliente..."
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>
          <button className="btn btn-warning" type="button" onClick={() => customersQuery.refetch()}>
            Actualizar
          </button>
        </div>

        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Telefono</th>
                <th>Email</th>
                <th>CUIT</th>
                <th>Direccion</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody id="customers-table">
              {customersQuery.isLoading ? (
                <tr>
                  <td colSpan={6}>Cargando...</td>
                </tr>
              ) : customersQuery.isError ? (
                <tr>
                  <td colSpan={6}>Error: {customersQuery.error instanceof Error ? customersQuery.error.message : 'No se pudo cargar clientes.'}</td>
                </tr>
              ) : sortedCustomers.length === 0 ? (
                <tr>
                  <td colSpan={6}>No hay clientes para mostrar.</td>
                </tr>
              ) : (
                sortedCustomers.map((customer) => (
                  <tr key={customer.id}>
                    <td>{customer.name}</td>
                    <td>{customer.phone || '-'}</td>
                    <td>{customer.email || '-'}</td>
                    <td>{customer.tax_id || '-'}</td>
                    <td>{customer.address || '-'}</td>
                    <td>
                      <div className="btn-group">
                        <button className="btn btn-sm btn-secondary" type="button" onClick={() => openEditCustomerModal(customer)}>
                          Editar
                        </button>
                        <button className="btn btn-sm btn-danger" type="button" onClick={() => void handleDelete(customer)}>
                          Eliminar
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {isModalOpen ? (
        <div className="modal-overlay">
          <div className="modal customer-modal">
            <div className="modal-header customer-modal-header">
              <div>
                <h3 id="customer-modal-title">{selectedCustomer ? 'Editar Cliente' : 'Nuevo Cliente'}</h3>
                <p className="customer-modal-subtitle">Completa los datos principales, comerciales y observaciones del cliente.</p>
              </div>
              <button type="button" className="modal-close" onClick={closeModal}>
                &times;
              </button>
            </div>

            <form id="customer-form" className="customer-form" onSubmit={handleSubmit}>
              <input type="hidden" id="customer-id" value={selectedCustomer?.id || ''} readOnly />

              <div className="customer-tabs" role="tablist" aria-label="Secciones del cliente">
                <button type="button" className={`customer-tab${activeTab === 'datos' ? ' is-active' : ''}`} data-tab="datos" aria-selected={activeTab === 'datos'} onClick={() => setActiveTab('datos')}>
                  Datos
                </button>
                <button type="button" className={`customer-tab${activeTab === 'facturacion' ? ' is-active' : ''}`} data-tab="facturacion" aria-selected={activeTab === 'facturacion'} onClick={() => setActiveTab('facturacion')}>
                  Datos de Facturacion
                </button>
                <button type="button" className={`customer-tab${activeTab === 'observaciones' ? ' is-active' : ''}`} data-tab="observaciones" aria-selected={activeTab === 'observaciones'} onClick={() => setActiveTab('observaciones')}>
                  Observaciones
                </button>
              </div>

              <div className="modal-body customer-modal-body">
                <section className={`customer-tab-panel${activeTab === 'datos' ? ' is-active' : ''}`} data-panel="datos">
                  <div className="customer-form-grid">
                    <div className="form-group">
                      <label htmlFor="customer-code">Codigo</label>
                      <input type="text" id="customer-code" value={getCustomerCode(selectedCustomer)} readOnly />
                    </div>
                    <div className="form-group">
                      <label htmlFor="customer-name">R. Social</label>
                      <input id="customer-name" name="name" type="text" value={formValues.name} onChange={handleChange} required />
                    </div>
                    <div className="form-group">
                      <label htmlFor="customer-contact">Contacto</label>
                      <input id="customer-contact" name="contact" type="text" value={formValues.contact} onChange={handleChange} placeholder="Nombre del contacto" />
                    </div>
                    <div className="form-group customer-field-span-2">
                      <label htmlFor="customer-address">Direccion</label>
                      <input id="customer-address" name="address" type="text" value={formValues.address} onChange={handleChange} placeholder="Calle, numero y referencia" />
                    </div>
                    <div className="form-group">
                      <label htmlFor="customer-city">Localidad</label>
                      <input id="customer-city" name="city" type="text" value={formValues.city} onChange={handleChange} />
                    </div>
                    <div className="form-group">
                      <label htmlFor="customer-province">Provincia</label>
                      <div className="customer-input-combo">
                        <select id="customer-province" name="province" value={formValues.province} onChange={handleChange}>
                          <option value="">Seleccionar provincia</option>
                          {CUSTOMER_PROVINCES.map((option) => (
                            <option key={option} value={option}>{option}</option>
                          ))}
                        </select>
                        <button type="button" className="customer-addon-button" onClick={() => window.alert('Esta opcion no esta disponible en este momento.')}>+</button>
                      </div>
                    </div>
                    <div className="form-group">
                      <label htmlFor="customer-country">Pais</label>
                      <div className="customer-input-combo">
                        <select id="customer-country" name="country" value={formValues.country} onChange={handleChange}>
                          <option value="">Seleccionar pais</option>
                          {CUSTOMER_COUNTRIES.map((option) => (
                            <option key={option} value={option}>{option}</option>
                          ))}
                        </select>
                        <button type="button" className="customer-addon-button" onClick={() => window.alert('Esta opcion no esta disponible en este momento.')}>+</button>
                      </div>
                    </div>
                    <div className="form-group">
                      <label htmlFor="customer-phone">Celular</label>
                      <input id="customer-phone" name="phone" type="text" value={formValues.phone} onChange={handleChange} placeholder="+54 9 11..." />
                    </div>
                    <div className="form-group">
                      <label htmlFor="customer-tax-id">DNI/CUIT</label>
                      <div className="customer-input-combo">
                        <input id="customer-tax-id" name="tax_id" type="text" value={formValues.tax_id} onChange={handleChange} placeholder="Documento o CUIT" />
                        <button type="button" className="customer-addon-button customer-addon-button--wide" onClick={() => window.alert('Esta opcion no esta disponible en este momento.')}>Buscar</button>
                      </div>
                    </div>
                    <div className="form-group">
                      <label htmlFor="customer-iva-condition">Cond. IVA</label>
                      <select id="customer-iva-condition" name="iva_condition" value={formValues.iva_condition} onChange={handleChange}>
                        {CUSTOMER_IVA_CONDITIONS.map((option) => (
                          <option key={option} value={option}>{option}</option>
                        ))}
                      </select>
                    </div>
                    <div className="form-group">
                      <label htmlFor="customer-email">Mail</label>
                      <input id="customer-email" name="email" type="email" value={formValues.email} onChange={handleChange} placeholder="cliente@email.com" />
                    </div>
                    <div className="form-group">
                      <label htmlFor="customer-instagram">Instagram</label>
                      <div className="customer-input-icon-wrap">
                        <input id="customer-instagram" name="instagram" type="text" value={formValues.instagram} onChange={handleChange} placeholder="@usuario" />
                        <span className="customer-input-icon" aria-hidden="true">@</span>
                      </div>
                    </div>
                  </div>
                </section>

                <section className={`customer-tab-panel${activeTab === 'facturacion' ? ' is-active' : ''}`} data-panel="facturacion">
                  <div className="customer-form-grid">
                    <div className="form-group">
                      <label htmlFor="customer-transport">Transporte</label>
                      <select id="customer-transport" name="transport" value={formValues.transport} onChange={handleChange}>
                        <option value="">Seleccionar transporte</option>
                        {CUSTOMER_TRANSPORTS.map((option) => (
                          <option key={option} value={option}>{option}</option>
                        ))}
                      </select>
                    </div>
                    <div className="form-group">
                      <label htmlFor="customer-credit-limit">Limite Cta Cte</label>
                      <input id="customer-credit-limit" name="credit_limit" type="number" min="0" step="0.01" value={formValues.credit_limit} onChange={handleChange} placeholder="0.00" />
                    </div>
                    <div className="form-group">
                      <label htmlFor="customer-zone">Zona</label>
                      <select id="customer-zone" name="zone" value={formValues.zone} onChange={handleChange}>
                        <option value="">Seleccionar zona</option>
                        {CUSTOMER_ZONES.map((option) => (
                          <option key={option} value={option}>{option}</option>
                        ))}
                      </select>
                    </div>
                    <div className="form-group">
                      <label htmlFor="customer-discount">% Descuento</label>
                      <input id="customer-discount" name="discount_percent" type="number" min="0" max="100" step="0.01" value={formValues.discount_percent} onChange={handleChange} placeholder="0.00" />
                    </div>
                    <div className="form-group">
                      <label htmlFor="customer-seller">Vendedor</label>
                      <select id="customer-seller" name="seller" value={formValues.seller} onChange={handleChange}>
                        <option value="">Seleccionar vendedor</option>
                        {CUSTOMER_SELLERS.map((option) => (
                          <option key={option} value={option}>{option}</option>
                        ))}
                      </select>
                    </div>
                    <fieldset className="customer-fieldset customer-field-span-2">
                      <legend>Lista de Precios</legend>
                      <div className="customer-radio-group">
                        {['1', '2', '3', '4', '5', '6'].map((value) => (
                          <label key={value} className="customer-radio-card">
                            <input type="radio" name="price_list" value={value} checked={formValues.price_list === value} onChange={handleChange} />
                            <span>Lista {value}</span>
                          </label>
                        ))}
                      </div>
                    </fieldset>
                    <div className="form-group customer-field-span-2">
                      <label htmlFor="customer-billing-conditions">Condiciones</label>
                      <textarea id="customer-billing-conditions" name="billing_conditions" rows={6} value={formValues.billing_conditions} onChange={handleChange} placeholder="Condiciones comerciales, plazos y observaciones de facturacion." />
                    </div>
                  </div>
                </section>

                <section className={`customer-tab-panel${activeTab === 'observaciones' ? ' is-active' : ''}`} data-panel="observaciones">
                  <div className="form-group customer-notes-group">
                    <label htmlFor="customer-notes">Observaciones</label>
                    <textarea id="customer-notes" name="notes" rows={12} value={formValues.notes} onChange={handleChange} placeholder="Notas internas, preferencias del cliente o informacion adicional." />
                  </div>
                </section>
              </div>

              <div className="modal-footer customer-modal-footer">
                {feedback ? <div className="alert alert-warning customer-modal-feedback">{feedback}</div> : null}
                <button className="btn btn-secondary" type="button" onClick={closeModal}>Cancelar</button>
                <button className="btn btn-success" type="submit" disabled={isSaving}>{isSaving ? 'Guardando...' : 'Guardar'}</button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </>
  );
}
