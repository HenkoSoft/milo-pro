import { useEffect, useMemo, useState, type ChangeEvent, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createUser, getUsers } from '../../api/auth';
import {
  createBrand,
  createCategory,
  createDeviceModel,
  createDeviceType,
  deleteBrand,
  deleteCategory,
  deleteDeviceModel,
  deleteDeviceType,
  getBrands,
  getCategories,
  getDeviceModels,
  getDeviceTypes
} from '../../api/catalog';
import { disconnectWoo, getWooPollingStatus, getWooStatus, startWooPolling, stopWooPolling, testWooConnection, updateWooConfig } from '../../api/woocommerce';
import type { CreateAuthUserPayload } from '../../types/auth';
import type { Brand, Category, DeviceModel, DeviceType } from '../../types/catalog';
import type { WooConfigPayload } from '../../types/woocommerce';

const ADMIN_MODULES = [
  { id: 'admin-users', label: 'Usuarios', title: 'Usuarios', subtitle: 'Administracion de usuarios con la misma lectura tabular del sistema.' },
  { id: 'admin-device-options', label: 'Tipos de equipos', title: 'Tipos de equipos', subtitle: 'ABM operativo de tipos, marcas y modelos.' },
  { id: 'admin-categories', label: 'Rubros', title: 'Rubros', subtitle: 'ABM de categorias conservando la estructura del modulo.' },
  { id: 'admin-integrations-woocommerce', label: 'WooCommerce', title: 'WooCommerce', subtitle: 'Configuracion administrativa de la integracion, conservando la API y el flujo actuales.' }
] as const;

const EMPTY_CONFIG: WooConfigPayload = {
  store_url: '',
  consumer_key: '',
  consumer_secret: '',
  wp_username: '',
  wp_app_password: '',
  api_version: 'wc/v3',
  sync_direction: 'bidirectional',
  sync_products: true,
  sync_customers: false,
  sync_orders: true,
  sync_stock: true,
  sync_prices: true,
  sync_mode: 'manual',
  sync_interval_minutes: '15',
  auto_sync: false,
  tax_mode: 'woocommerce',
  category_mode: 'sync',
  conflict_priority: 'local',
  webhook_secret: '',
  webhook_auth_token: '',
  webhook_signature_header: 'x-wc-webhook-signature',
  webhook_delivery_header: 'x-wc-webhook-delivery-id',
  order_sync_mode: 'webhook',
  order_sales_channel: 'woocommerce',
  customer_sync_strategy: 'match_or_create',
  generic_customer_name: 'Cliente web'
};

const EMPTY_USER_FORM: CreateAuthUserPayload = {
  username: '',
  password: '',
  role: 'technician',
  name: ''
};

function getModuleConfig(pageId: string) {
  return ADMIN_MODULES.find((module) => module.id === pageId) || ADMIN_MODULES[0];
}

function AdminModuleHeader({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="admin-module-head">
      <div>
        <p className="admin-module-kicker">Administracion</p>
        <h2>{title}</h2>
        <p>{subtitle}</p>
      </div>
    </div>
  );
}

function AdminTabs({ pageId }: { pageId: string }) {
  return (
    <div className="admin-section-tabs" role="tablist" aria-label="Modulos de administracion">
      {ADMIN_MODULES.map((module) => (
        <button
          key={module.id}
          type="button"
          className={`admin-tab-button${module.id === pageId ? ' active' : ''}`}
          onClick={() => {
            window.location.hash = module.id;
          }}
        >
          {module.label}
        </button>
      ))}
    </div>
  );
}

function UsersPanel({
  feedback,
  setFeedback
}: {
  feedback: string;
  setFeedback: (value: string) => void;
}) {
  const queryClient = useQueryClient();
  const [formValues, setFormValues] = useState<CreateAuthUserPayload>(EMPTY_USER_FORM);
  const usersQuery = useQuery({
    queryKey: ['auth', 'users'],
    queryFn: getUsers,
    staleTime: 30_000
  });
  const createUserMutation = useMutation({
    mutationFn: createUser,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['auth', 'users'] });
    }
  });

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    try {
      await createUserMutation.mutateAsync(formValues);
      setFormValues(EMPTY_USER_FORM);
      setFeedback('Usuario creado correctamente.');
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : 'No se pudo crear el usuario.');
    }
  }

  return (
    <div className="admin-grid">
      <div className="card admin-panel">
        <div className="admin-panel-head">
          <div>
            <p className="admin-panel-kicker">Usuarios</p>
            <h3>Alta de usuario</h3>
          </div>
        </div>
        <form className="admin-form-grid" onSubmit={handleSubmit}>
          <div className="form-group"><label>Nombre</label><input value={formValues.name} onChange={(event) => setFormValues((current) => ({ ...current, name: event.target.value }))} /></div>
          <div className="form-group"><label>Usuario</label><input value={formValues.username} onChange={(event) => setFormValues((current) => ({ ...current, username: event.target.value }))} /></div>
          <div className="form-group"><label>Password</label><input type="password" value={formValues.password} onChange={(event) => setFormValues((current) => ({ ...current, password: event.target.value }))} /></div>
          <div className="form-group"><label>Rol</label><select value={formValues.role} onChange={(event) => setFormValues((current) => ({ ...current, role: event.target.value }))}><option value="admin">admin</option><option value="technician">technician</option><option value="seller">seller</option></select></div>
          <div className="admin-form-actions"><button type="submit" className="btn btn-primary" disabled={createUserMutation.isPending}>{createUserMutation.isPending ? 'Guardando...' : 'Guardar usuario'}</button></div>
        </form>
      </div>

      <div className="card admin-panel admin-panel-full">
        <div className="admin-panel-head">
          <div>
            <p className="admin-panel-kicker">Usuarios</p>
            <h3>Listado</h3>
          </div>
        </div>
        <table className="products-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Nombre</th>
              <th>Usuario</th>
              <th>Rol</th>
              <th>Alta</th>
            </tr>
          </thead>
          <tbody>
            {(usersQuery.data || []).length === 0 ? (
              <tr><td colSpan={5} className="admin-empty-row">No hay usuarios para mostrar.</td></tr>
            ) : (
              (usersQuery.data || []).map((user) => (
                <tr key={user.id}>
                  <td>{user.id}</td>
                  <td>{user.name}</td>
                  <td>{user.username}</td>
                  <td>{user.role}</td>
                  <td>{user.created_at ? new Date(user.created_at).toLocaleDateString('es-AR') : '-'}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function CategoriesPanel({
  feedback,
  setFeedback
}: {
  feedback: string;
  setFeedback: (value: string) => void;
}) {
  const queryClient = useQueryClient();
  const [name, setName] = useState('');
  const [parentId, setParentId] = useState('');
  const categoriesQuery = useQuery({ queryKey: ['categories'], queryFn: getCategories, staleTime: 30_000 });
  const createMutation = useMutation({
    mutationFn: createCategory,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['categories'] });
    }
  });
  const deleteMutation = useMutation({
    mutationFn: deleteCategory,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['categories'] });
    }
  });

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    try {
      await createMutation.mutateAsync({
        name,
        parent_id: parentId ? Number(parentId) : null
      });
      setName('');
      setParentId('');
      setFeedback('Categoria creada correctamente.');
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : 'No se pudo crear la categoria.');
    }
  }

  async function handleDelete(category: Category) {
    if (!window.confirm(`Eliminar rubro ${category.name}?`)) return;
    try {
      await deleteMutation.mutateAsync(category.id);
      setFeedback('Categoria eliminada correctamente.');
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : 'No se pudo eliminar la categoria.');
    }
  }

  const categories = categoriesQuery.data || [];

  return (
    <div className="admin-grid">
      <div className="card admin-panel">
        <div className="admin-panel-head"><div><p className="admin-panel-kicker">Rubros</p><h3>Alta</h3></div></div>
        <form className="admin-form-grid" onSubmit={handleSubmit}>
          <div className="form-group"><label>Nombre</label><input value={name} onChange={(event) => setName(event.target.value)} /></div>
          <div className="form-group">
            <label>Categoria padre</label>
            <select value={parentId} onChange={(event) => setParentId(event.target.value)}>
              <option value="">Sin padre</option>
              {categories.map((category) => (
                <option key={category.id} value={String(category.id)}>{category.full_name || category.name}</option>
              ))}
            </select>
          </div>
          <div className="admin-form-actions"><button type="submit" className="btn btn-primary" disabled={createMutation.isPending}>{createMutation.isPending ? 'Guardando...' : 'Guardar rubro'}</button></div>
        </form>
      </div>
      <div className="card admin-panel admin-panel-full">
        <div className="admin-panel-head"><div><p className="admin-panel-kicker">Rubros</p><h3>Listado</h3></div></div>
        <table className="products-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Nombre</th>
              <th>Padre</th>
              <th>Productos</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {categories.length === 0 ? (
              <tr><td colSpan={5} className="admin-empty-row">No hay rubros para mostrar.</td></tr>
            ) : (
              categories.map((category) => (
                <tr key={category.id}>
                  <td>{category.id}</td>
                  <td>{category.full_name || category.name}</td>
                  <td>{category.parent_id || '-'}</td>
                  <td>{category.product_count || 0}</td>
                  <td><button className="btn btn-action btn-delete" type="button" onClick={() => void handleDelete(category)}>X</button></td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function DeviceOptionsPanel({
  feedback,
  setFeedback
}: {
  feedback: string;
  setFeedback: (value: string) => void;
}) {
  const queryClient = useQueryClient();
  const [deviceTypeName, setDeviceTypeName] = useState('');
  const [brandName, setBrandName] = useState('');
  const [modelName, setModelName] = useState('');
  const [brandId, setBrandId] = useState('');
  const typesQuery = useQuery({ queryKey: ['device-types'], queryFn: getDeviceTypes, staleTime: 30_000 });
  const brandsQuery = useQuery({ queryKey: ['brands'], queryFn: getBrands, staleTime: 30_000 });
  const modelsQuery = useQuery({ queryKey: ['device-models', brandId], queryFn: () => getDeviceModels(brandId), staleTime: 30_000 });

  const createTypeMutation = useMutation({ mutationFn: createDeviceType, onSuccess: async () => { await queryClient.invalidateQueries({ queryKey: ['device-types'] }); } });
  const deleteTypeMutation = useMutation({ mutationFn: deleteDeviceType, onSuccess: async () => { await queryClient.invalidateQueries({ queryKey: ['device-types'] }); } });
  const createBrandMutation = useMutation({ mutationFn: createBrand, onSuccess: async () => { await queryClient.invalidateQueries({ queryKey: ['brands'] }); } });
  const deleteBrandMutation = useMutation({ mutationFn: deleteBrand, onSuccess: async () => { await queryClient.invalidateQueries({ queryKey: ['brands'] }); } });
  const createModelMutation = useMutation({ mutationFn: createDeviceModel, onSuccess: async () => { await queryClient.invalidateQueries({ queryKey: ['device-models'] }); } });
  const deleteModelMutation = useMutation({ mutationFn: deleteDeviceModel, onSuccess: async () => { await queryClient.invalidateQueries({ queryKey: ['device-models'] }); } });

  async function submitType(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    try {
      await createTypeMutation.mutateAsync({ name: deviceTypeName });
      setDeviceTypeName('');
      setFeedback('Tipo de equipo creado correctamente.');
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : 'No se pudo crear el tipo.');
    }
  }

  async function submitBrand(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    try {
      await createBrandMutation.mutateAsync({ name: brandName });
      setBrandName('');
      setFeedback('Marca creada correctamente.');
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : 'No se pudo crear la marca.');
    }
  }

  async function submitModel(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    try {
      await createModelMutation.mutateAsync({ name: modelName, brand_id: brandId ? Number(brandId) : null });
      setModelName('');
      setFeedback('Modelo creado correctamente.');
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : 'No se pudo crear el modelo.');
    }
  }

  const deviceTypes = typesQuery.data || [];
  const brands = brandsQuery.data || [];
  const models = modelsQuery.data || [];

  return (
    <div className="admin-grid">
      <div className="card admin-panel">
        <div className="admin-panel-head"><div><p className="admin-panel-kicker">Tipos</p><h3>Tipos de equipo</h3></div></div>
        <form className="admin-form-grid" onSubmit={submitType}>
          <div className="form-group"><label>Nombre</label><input value={deviceTypeName} onChange={(event) => setDeviceTypeName(event.target.value)} /></div>
          <div className="admin-form-actions"><button type="submit" className="btn btn-primary">Guardar</button></div>
        </form>
        <table className="products-table">
          <tbody>
            {deviceTypes.map((item: DeviceType) => (
              <tr key={item.id}><td>{item.name}</td><td><button className="btn btn-action btn-delete" type="button" onClick={() => void deleteTypeMutation.mutateAsync(item.id)}>X</button></td></tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="card admin-panel">
        <div className="admin-panel-head"><div><p className="admin-panel-kicker">Marcas</p><h3>Marcas</h3></div></div>
        <form className="admin-form-grid" onSubmit={submitBrand}>
          <div className="form-group"><label>Nombre</label><input value={brandName} onChange={(event) => setBrandName(event.target.value)} /></div>
          <div className="admin-form-actions"><button type="submit" className="btn btn-primary">Guardar</button></div>
        </form>
        <table className="products-table">
          <tbody>
            {brands.map((item: Brand) => (
              <tr key={item.id}><td>{item.name}</td><td><button className="btn btn-action btn-delete" type="button" onClick={() => void deleteBrandMutation.mutateAsync(item.id)}>X</button></td></tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="card admin-panel admin-panel-full">
        <div className="admin-panel-head"><div><p className="admin-panel-kicker">Modelos</p><h3>Modelos por marca</h3></div></div>
        <form className="admin-form-grid" onSubmit={submitModel}>
          <div className="form-group">
            <label>Marca</label>
            <select value={brandId} onChange={(event) => setBrandId(event.target.value)}>
              <option value="">Todas</option>
              {brands.map((brand) => (
                <option key={brand.id} value={String(brand.id)}>{brand.name}</option>
              ))}
            </select>
          </div>
          <div className="form-group"><label>Modelo</label><input value={modelName} onChange={(event) => setModelName(event.target.value)} /></div>
          <div className="admin-form-actions"><button type="submit" className="btn btn-primary">Guardar</button></div>
        </form>
        <table className="products-table">
          <thead><tr><th>ID</th><th>Modelo</th><th>Marca</th><th>Acciones</th></tr></thead>
          <tbody>
            {models.length === 0 ? (
              <tr><td colSpan={4} className="admin-empty-row">No hay modelos para mostrar.</td></tr>
            ) : (
              models.map((model: DeviceModel) => (
                <tr key={model.id}>
                  <td>{model.id}</td>
                  <td>{model.name}</td>
                  <td>{brands.find((brand) => brand.id === model.brand_id)?.name || '-'}</td>
                  <td><button className="btn btn-action btn-delete" type="button" onClick={() => void deleteModelMutation.mutateAsync(model.id)}>X</button></td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function AdminPage({ pageId }: { pageId: string }) {
  const queryClient = useQueryClient();
  const moduleConfig = getModuleConfig(pageId);
  const [formValues, setFormValues] = useState<WooConfigPayload>({ ...EMPTY_CONFIG });
  const [feedback, setFeedback] = useState('');

  const statusQuery = useQuery({ queryKey: ['woocommerce', 'status'], queryFn: getWooStatus, staleTime: 15_000 });
  const pollingStatusQuery = useQuery({ queryKey: ['woocommerce', 'polling-status'], queryFn: getWooPollingStatus, staleTime: 10_000 });

  const testMutation = useMutation({ mutationFn: testWooConnection });
  const updateMutation = useMutation({ mutationFn: updateWooConfig, onSuccess: async () => { await queryClient.invalidateQueries({ queryKey: ['woocommerce'] }); } });
  const disconnectMutation = useMutation({ mutationFn: disconnectWoo, onSuccess: async () => { await queryClient.invalidateQueries({ queryKey: ['woocommerce'] }); } });
  const startPollingMutation = useMutation({ mutationFn: startWooPolling, onSuccess: async () => { await queryClient.invalidateQueries({ queryKey: ['woocommerce'] }); } });
  const stopPollingMutation = useMutation({ mutationFn: stopWooPolling, onSuccess: async () => { await queryClient.invalidateQueries({ queryKey: ['woocommerce'] }); } });

  useEffect(() => {
    if (!statusQuery.data) return;
    const data = statusQuery.data;
    setFormValues({
      store_url: data.store_url || '',
      consumer_key: '',
      consumer_secret: '',
      wp_username: '',
      wp_app_password: '',
      api_version: data.api_version || 'wc/v3',
      sync_direction: data.sync_direction || 'bidirectional',
      sync_products: true,
      sync_customers: false,
      sync_orders: Boolean(data.orderConfig?.enabled ?? true),
      sync_stock: true,
      sync_prices: true,
      sync_mode: data.sync_mode || 'manual',
      sync_interval_minutes: String(data.sync_interval_minutes || 15),
      auto_sync: Boolean(data.auto_sync),
      tax_mode: data.tax_mode || 'woocommerce',
      category_mode: data.category_mode || 'sync',
      conflict_priority: data.conflict_priority || 'local',
      webhook_secret: data.orderConfig?.webhook_secret || '',
      webhook_auth_token: data.orderConfig?.webhook_auth_token || '',
      webhook_signature_header: data.orderConfig?.webhook_signature_header || 'x-wc-webhook-signature',
      webhook_delivery_header: data.orderConfig?.webhook_delivery_header || 'x-wc-webhook-delivery-id',
      order_sync_mode: data.orderConfig?.sync_mode || 'webhook',
      order_sales_channel: data.orderConfig?.sales_channel || 'woocommerce',
      customer_sync_strategy: data.orderConfig?.customer_sync_strategy || 'match_or_create',
      generic_customer_name: data.orderConfig?.generic_customer_name || 'Cliente web'
    });
  }, [statusQuery.data]);

  function handleChange(event: ChangeEvent<HTMLInputElement | HTMLSelectElement>) {
    const target = event.target;
    const value = target.type === 'checkbox' ? (target as HTMLInputElement).checked : target.value;
    setFormValues((current) => ({
      ...current,
      [target.name]: value
    }));
  }

  async function handleTestConnection() {
    setFeedback('');
    try {
      const result = await testMutation.mutateAsync({
        store_url: formValues.store_url,
        consumer_key: formValues.consumer_key,
        consumer_secret: formValues.consumer_secret,
        api_version: formValues.api_version,
        wp_username: formValues.wp_username,
        wp_app_password: formValues.wp_app_password
      });
      setFeedback(result.success ? `Conexion correcta con ${result.store || formValues.store_url}.` : (result.error || 'No se pudo validar la conexion.'));
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : 'No se pudo validar la conexion.');
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFeedback('');

    try {
      await updateMutation.mutateAsync(formValues);
      setFeedback('Configuracion WooCommerce guardada correctamente.');
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : 'No se pudo guardar la configuracion.');
    }
  }

  const pollingActive = Boolean(pollingStatusQuery.data?.active ?? pollingStatusQuery.data?.polling_active ?? statusQuery.data?.polling_active);
  const logs = statusQuery.data?.logs || [];

  return (
    <div className="admin-module-shell">
      <AdminModuleHeader title={moduleConfig.title} subtitle={moduleConfig.subtitle} />
      <AdminTabs pageId={pageId} />
      {feedback ? <div className={`alert ${feedback.includes('No se pudo') ? 'alert-warning' : 'alert-info'}`}>{feedback}</div> : null}

      {pageId === 'admin-users' ? <UsersPanel feedback={feedback} setFeedback={setFeedback} /> : null}
      {pageId === 'admin-categories' ? <CategoriesPanel feedback={feedback} setFeedback={setFeedback} /> : null}
      {pageId === 'admin-device-options' ? <DeviceOptionsPanel feedback={feedback} setFeedback={setFeedback} /> : null}

      {pageId === 'admin-integrations-woocommerce' ? (
        <div className="admin-grid">
          <div className="card admin-panel">
            <div className="admin-panel-head">
              <div>
                <p className="admin-panel-kicker">Conexion</p>
                <h3>Estado actual</h3>
              </div>
            </div>
            <div className="admin-status-grid">
              <article className="admin-status-card"><span>Conectado</span><strong>{statusQuery.data?.connected || statusQuery.data?.active ? 'Si' : 'No'}</strong></article>
              <article className="admin-status-card"><span>Polling</span><strong>{pollingActive ? 'Activo' : 'Detenido'}</strong></article>
              <article className="admin-status-card"><span>Store</span><strong>{statusQuery.data?.store_url || '-'}</strong></article>
              <article className="admin-status-card"><span>Intervalo</span><strong>{statusQuery.data?.sync_interval_minutes || '-'} min</strong></article>
            </div>
            <div className="admin-actions-row">
              <button type="button" className="btn btn-secondary" onClick={handleTestConnection} disabled={testMutation.isPending}>Probar conexion</button>
              <button type="button" className="btn btn-primary" onClick={() => startPollingMutation.mutate()} disabled={startPollingMutation.isPending}>Iniciar polling</button>
              <button type="button" className="btn btn-secondary" onClick={() => stopPollingMutation.mutate()} disabled={stopPollingMutation.isPending}>Detener polling</button>
              <button type="button" className="btn btn-danger" onClick={() => disconnectMutation.mutate()} disabled={disconnectMutation.isPending}>Desconectar</button>
            </div>
          </div>

          <div className="card admin-panel">
            <div className="admin-panel-head">
              <div>
                <p className="admin-panel-kicker">Configuracion</p>
                <h3>Parametros WooCommerce</h3>
              </div>
            </div>
            <form className="admin-form-grid" onSubmit={handleSubmit}>
              <div className="form-group"><label>URL tienda</label><input name="store_url" value={formValues.store_url} onChange={handleChange} /></div>
              <div className="form-group"><label>Consumer Key</label><input name="consumer_key" value={formValues.consumer_key} onChange={handleChange} /></div>
              <div className="form-group"><label>Consumer Secret</label><input name="consumer_secret" value={formValues.consumer_secret} onChange={handleChange} /></div>
              <div className="form-group"><label>WP usuario</label><input name="wp_username" value={formValues.wp_username} onChange={handleChange} /></div>
              <div className="form-group"><label>WP app password</label><input name="wp_app_password" value={formValues.wp_app_password} onChange={handleChange} /></div>
              <div className="form-group"><label>API version</label><input name="api_version" value={formValues.api_version} onChange={handleChange} /></div>
              <div className="form-group"><label>Direccion sync</label><select name="sync_direction" value={formValues.sync_direction} onChange={handleChange}><option value="bidirectional">Bidirectional</option><option value="local_to_remote">Local a Woo</option><option value="remote_to_local">Woo a local</option></select></div>
              <div className="form-group"><label>Modo sync</label><select name="sync_mode" value={formValues.sync_mode} onChange={handleChange}><option value="manual">Manual</option><option value="scheduled">Programado</option></select></div>
              <div className="form-group"><label>Intervalo</label><input name="sync_interval_minutes" value={formValues.sync_interval_minutes} onChange={handleChange} /></div>
              <div className="form-group"><label>Tax mode</label><select name="tax_mode" value={formValues.tax_mode} onChange={handleChange}><option value="woocommerce">WooCommerce</option><option value="local">Local</option></select></div>
              <div className="form-group"><label>Category mode</label><select name="category_mode" value={formValues.category_mode} onChange={handleChange}><option value="sync">Sync</option><option value="local_only">Solo local</option></select></div>
              <div className="form-group"><label>Prioridad conflicto</label><select name="conflict_priority" value={formValues.conflict_priority} onChange={handleChange}><option value="local">Local</option><option value="remote">Woo</option></select></div>
              <div className="form-group"><label>Webhook secret</label><input name="webhook_secret" value={formValues.webhook_secret} onChange={handleChange} /></div>
              <div className="form-group"><label>Webhook token</label><input name="webhook_auth_token" value={formValues.webhook_auth_token} onChange={handleChange} /></div>
              <div className="form-group"><label>Header firma</label><input name="webhook_signature_header" value={formValues.webhook_signature_header} onChange={handleChange} /></div>
              <div className="form-group"><label>Header delivery</label><input name="webhook_delivery_header" value={formValues.webhook_delivery_header} onChange={handleChange} /></div>
              <div className="form-group"><label>Modo ordenes</label><select name="order_sync_mode" value={formValues.order_sync_mode} onChange={handleChange}><option value="webhook">Webhook</option><option value="polling">Polling</option></select></div>
              <div className="form-group"><label>Canal ventas</label><input name="order_sales_channel" value={formValues.order_sales_channel} onChange={handleChange} /></div>
              <div className="form-group"><label>Estrategia clientes</label><select name="customer_sync_strategy" value={formValues.customer_sync_strategy} onChange={handleChange}><option value="match_or_create">Match o crear</option><option value="generic_customer">Cliente generico</option></select></div>
              <div className="form-group"><label>Cliente generico</label><input name="generic_customer_name" value={formValues.generic_customer_name} onChange={handleChange} /></div>
              <label className="admin-checkbox"><input type="checkbox" name="auto_sync" checked={formValues.auto_sync} onChange={handleChange} /> Auto sync</label>
              <label className="admin-checkbox"><input type="checkbox" name="sync_products" checked={formValues.sync_products} onChange={handleChange} /> Sync productos</label>
              <label className="admin-checkbox"><input type="checkbox" name="sync_customers" checked={formValues.sync_customers} onChange={handleChange} /> Sync clientes</label>
              <label className="admin-checkbox"><input type="checkbox" name="sync_orders" checked={formValues.sync_orders} onChange={handleChange} /> Sync ordenes</label>
              <label className="admin-checkbox"><input type="checkbox" name="sync_stock" checked={formValues.sync_stock} onChange={handleChange} /> Sync stock</label>
              <label className="admin-checkbox"><input type="checkbox" name="sync_prices" checked={formValues.sync_prices} onChange={handleChange} /> Sync precios</label>
              <div className="admin-form-actions"><button type="submit" className="btn btn-primary" disabled={updateMutation.isPending}>{updateMutation.isPending ? 'Guardando...' : 'Guardar configuracion'}</button></div>
            </form>
          </div>

          <div className="card admin-panel admin-panel-full">
            <div className="admin-panel-head">
              <div>
                <p className="admin-panel-kicker">Sync</p>
                <h3>Logs recientes</h3>
              </div>
            </div>
            <table className="products-table">
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Producto</th>
                  <th>Accion</th>
                  <th>Estado</th>
                  <th>Mensaje</th>
                </tr>
              </thead>
              <tbody>
                {logs.length === 0 ? (
                  <tr><td colSpan={5} className="admin-empty-row">No hay logs para mostrar.</td></tr>
                ) : (
                  logs.slice(0, 25).map((log, index) => (
                    <tr key={log.id || index}>
                      <td>{log.synced_at ? new Date(log.synced_at).toLocaleString('es-AR') : '-'}</td>
                      <td>{log.product_id || '-'}</td>
                      <td>{log.action || '-'}</td>
                      <td>{log.status || '-'}</td>
                      <td>{log.message || '-'}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}
    </div>
  );
}
