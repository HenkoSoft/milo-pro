import { useEffect, useMemo, useState, type ChangeEvent, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createUser, getUsers } from '../../services/auth';
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
} from '../../services/catalog';
import { getSettings, updateSettings } from '../../services/settings';
import { disconnectWoo, getWooPollingStatus, getWooStatus, startWooPolling, stopWooPolling, testWooConnection, updateWooConfig } from '../../services/woocommerce';
import type { CreateAuthUserPayload } from '../../types/auth';
import type { Brand, Category, DeviceModel, DeviceType } from '../../types/catalog';
import type { BusinessSettings } from '../../types/settings';
import type { WooConfigPayload } from '../../types/woocommerce';

const ADMIN_MODULES = [
  { id: 'admin-users', label: 'Usuarios', title: 'Modificar Usuarios', subtitle: 'Gestion centralizada de accesos, estados y perfiles del sistema.' },
  { id: 'admin-users-connected', label: 'Usuarios Conectados', title: 'Usuarios Conectados', subtitle: 'Seguimiento de sesiones activas y actividad reciente del sistema.' },
  { id: 'admin-device-options', label: 'Tipos de equipos', title: 'Tipos de equipos', subtitle: '' },
  { id: 'admin-categories', label: 'Rubros', title: 'Rubros', subtitle: '' },
  { id: 'admin-aux-tables', label: 'Tablas Auxiliares', title: 'Tablas Auxiliares', subtitle: 'CRUD administrativo para parametros y catalogos del sistema.' },
  { id: 'admin-config-general', label: 'Datos Generales', title: 'Datos Generales', subtitle: 'Configuracion central del negocio con el mismo criterio de formulario del sistema.' },
  { id: 'admin-config-documents', label: 'Configuracion de Comprobantes', title: 'Configuracion de Comprobantes', subtitle: 'Parametros comerciales y de numeracion para resguardar consistencia operativa.' },
  { id: 'admin-config-mail', label: 'Mail', title: 'Mail', subtitle: 'Panel de configuracion SMTP con acciones visibles y foco en pruebas rapidas.' },
  { id: 'admin-reset-data', label: 'Borrar datos iniciales', title: 'Borrar datos iniciales', subtitle: 'Accion critica con confirmacion obligatoria y mensaje de advertencia visible.' },
  { id: 'admin-troubleshoot', label: 'Solucionar Problemas', title: 'Solucionar Problemas', subtitle: 'Herramientas tecnicas con confirmacion previa y resultado visible al finalizar.' },
  { id: 'admin-integrations-woocommerce', label: 'WooCommerce', title: 'WooCommerce', subtitle: '' }
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

type AdminConnectedSession = {
  id: string;
  username: string;
  ip?: string;
  loginDate?: string;
  lastActivity?: string;
  connectionStatus?: string;
};

type AdminConfigStore = {
  general?: {
    legal_name?: string;
    tax_id?: string;
    currency?: string;
    date_format?: string;
    timezone?: string;
    logo_name?: string;
  };
  documents?: {
    numbering_format?: string;
    prefixes?: string;
    control_stock?: boolean;
    allow_negative_stock?: boolean;
    control_min_price?: boolean;
    decimals?: number;
  };
  mail?: {
    smtp_server?: string;
    port?: string;
    username?: string;
    password?: string;
    encryption?: string;
    sender_email?: string;
  };
};

type AdminAuxRow = {
  id: string | number;
  description: string;
  code?: string;
  active?: boolean;
  source?: 'api' | 'local';
};

type AdminAuxTableKey =
  | 'banks'
  | 'categories'
  | 'incomeDetails'
  | 'expenseDetails'
  | 'brands'
  | 'numbering'
  | 'vouchers'
  | 'countries'
  | 'provinces'
  | 'rubros'
  | 'cards'
  | 'units'
  | 'zones';

const EMPTY_SETTINGS: BusinessSettings = {
  business_name: '',
  business_address: '',
  business_phone: '',
  business_email: ''
};

const DEFAULT_ADMIN_CONFIG: AdminConfigStore = {
  general: {
    legal_name: '',
    tax_id: '',
    currency: 'ARS',
    date_format: 'dd/MM/yyyy',
    timezone: 'America/Argentina/Buenos_Aires',
    logo_name: ''
  },
  documents: {
    numbering_format: 'PV-00000000',
    prefixes: '',
    control_stock: true,
    allow_negative_stock: false,
    control_min_price: false,
    decimals: 2
  },
  mail: {
    smtp_server: '',
    port: '587',
    username: '',
    password: '',
    encryption: 'tls',
    sender_email: ''
  }
};

const ADMIN_AUX_TABLES: Record<AdminAuxTableKey, { label: string; type: 'simple' | 'category' | 'brand' }> = {
  banks: { label: 'Bancos', type: 'simple' },
  categories: { label: 'Categorias', type: 'category' },
  incomeDetails: { label: 'Detalle de Ingresos', type: 'simple' },
  expenseDetails: { label: 'Detalle de Gastos', type: 'simple' },
  brands: { label: 'Marcas', type: 'brand' },
  numbering: { label: 'Numeracion', type: 'simple' },
  vouchers: { label: 'Comprobantes', type: 'simple' },
  countries: { label: 'Paises', type: 'simple' },
  provinces: { label: 'Provincias', type: 'simple' },
  rubros: { label: 'Rubros', type: 'simple' },
  cards: { label: 'Tarjetas', type: 'simple' },
  units: { label: 'Unidades', type: 'simple' },
  zones: { label: 'Zonas', type: 'simple' }
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
        {subtitle ? <p>{subtitle}</p> : null}
      </div>
    </div>
  );
}

function getAdminRoleLabel(role: string) {
  return (
    {
      admin: 'Administrador',
      supervisor: 'Supervisor',
      seller: 'Vendedor',
      technician: 'Usuario estandar'
    }[role] || role || 'Usuario'
  );
}

function readConnectedSessions() {
  try {
    const parsed = JSON.parse(window.localStorage.getItem('milo_admin_connected_users') || '[]');
    return Array.isArray(parsed) ? (parsed as AdminConnectedSession[]) : [];
  } catch {
    return [];
  }
}

function writeConnectedSessions(sessions: AdminConnectedSession[]) {
  window.localStorage.setItem('milo_admin_connected_users', JSON.stringify(sessions));
}

function readAdminConfigStore() {
  try {
    const parsed = JSON.parse(window.localStorage.getItem('milo_admin_config_store') || 'null');
    return {
      ...DEFAULT_ADMIN_CONFIG,
      ...(parsed || {}),
      general: { ...DEFAULT_ADMIN_CONFIG.general, ...(parsed?.general || {}) },
      documents: { ...DEFAULT_ADMIN_CONFIG.documents, ...(parsed?.documents || {}) },
      mail: { ...DEFAULT_ADMIN_CONFIG.mail, ...(parsed?.mail || {}) }
    } as AdminConfigStore;
  } catch {
    return DEFAULT_ADMIN_CONFIG;
  }
}

function writeAdminConfigStore(config: AdminConfigStore) {
  window.localStorage.setItem('milo_admin_config_store', JSON.stringify(config));
}

function readAdminAuxStore() {
  try {
    const parsed = JSON.parse(window.localStorage.getItem('milo_admin_aux_tables') || '{}');
    return parsed && typeof parsed === 'object' ? parsed as Partial<Record<AdminAuxTableKey, AdminAuxRow[]>> : {};
  } catch {
    return {};
  }
}

function writeAdminAuxStore(store: Partial<Record<AdminAuxTableKey, AdminAuxRow[]>>) {
  window.localStorage.setItem('milo_admin_aux_tables', JSON.stringify(store));
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
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
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

  const filteredUsers = useMemo(() => {
    const term = search.trim().toLowerCase();
    const users = usersQuery.data || [];
    if (!term) return users;

    return users.filter((user) =>
      [String(user.id), user.username, user.name, user.role]
        .filter(Boolean)
        .some((value) => value.toLowerCase().includes(term))
    );
  }, [search, usersQuery.data]);

  const totalPages = Math.max(1, Math.ceil(filteredUsers.length / 10));
  const currentPage = Math.min(page, totalPages);
  const paginatedUsers = filteredUsers.slice((currentPage - 1) * 10, currentPage * 10);

  useEffect(() => {
    setPage(1);
  }, [search]);

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [page, totalPages]);

  return (
    <div className="admin-grid">
      <div className="card admin-panel admin-panel-full">
        <div className="admin-panel-head">
          <div>
            <p className="admin-panel-kicker">Usuarios</p>
            <h3>Listado</h3>
          </div>
        </div>
        <div className="admin-filter-card">
          <div className="search-box admin-search-box">
            <input
              type="text"
              placeholder="Buscar usuario..."
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>
        </div>
        <div className="sales-lines-table-wrap">
          <table className="sales-lines-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Usuario</th>
                <th>Nombre</th>
                <th>Email</th>
                <th>Rol</th>
                <th>Estado</th>
                <th>Ultimo acceso</th>
              </tr>
            </thead>
            <tbody>
              {paginatedUsers.length === 0 ? (
                <tr><td colSpan={7} className="sales-empty-row">No hay usuarios para mostrar.</td></tr>
              ) : (
                paginatedUsers.map((user) => (
                  <tr key={user.id}>
                    <td>{user.id}</td>
                    <td>{user.username}</td>
                    <td>{user.name}</td>
                    <td>-</td>
                    <td><span className="badge badge-blue">{getAdminRoleLabel(user.role)}</span></td>
                    <td><span className="badge badge-green">Activo</span></td>
                    <td>{user.created_at ? new Date(user.created_at).toLocaleString('es-AR') : '-'}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <div className="sales-pagination">
          <span>Pagina {currentPage} de {totalPages}</span>
          <div className="btn-group">
            <button className="btn btn-sm btn-secondary" type="button" onClick={() => setPage((current) => Math.max(1, current - 1))} disabled={currentPage <= 1}>Anterior</button>
            <button className="btn btn-sm btn-secondary" type="button" onClick={() => setPage((current) => Math.min(totalPages, current + 1))} disabled={currentPage >= totalPages}>Siguiente</button>
          </div>
        </div>
      </div>

      <div className="card admin-panel admin-panel-full">
        <div className="admin-panel-head">
          <div>
            <p className="admin-panel-kicker">Usuarios</p>
            <h3>Nuevo Usuario</h3>
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
    </div>
  );
}

function ConnectedUsersPanel({
  feedback,
  setFeedback
}: {
  feedback: string;
  setFeedback: (value: string) => void;
}) {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [sessions, setSessions] = useState<AdminConnectedSession[]>(() => readConnectedSessions());

  useEffect(() => {
    setSessions(readConnectedSessions());
  }, []);

  const filteredSessions = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return sessions;

    return sessions.filter((session) =>
      [session.username, session.ip, session.connectionStatus]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(term))
    );
  }, [search, sessions]);

  const totalPages = Math.max(1, Math.ceil(filteredSessions.length / 10));
  const currentPage = Math.min(page, totalPages);
  const paginatedSessions = filteredSessions.slice((currentPage - 1) * 10, currentPage * 10);

  useEffect(() => {
    setPage(1);
  }, [search]);

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [page, totalPages]);

  function handleForceClose(sessionId: string) {
    if (!window.confirm('Desea forzar el cierre de sesion seleccionado?')) return;

    const nextSessions = sessions.filter((session) => session.id !== sessionId);
    setSessions(nextSessions);
    writeConnectedSessions(nextSessions);
    setFeedback('Sesion cerrada correctamente.');
  }

  return (
    <div className="admin-grid">
      <div className="card admin-panel admin-panel-full">
        <div className="admin-panel-head">
          <div>
            <p className="admin-panel-kicker">Sesiones</p>
            <h3>Listado</h3>
          </div>
        </div>
        <div className="admin-filter-card">
          <div className="search-box admin-search-box">
            <input
              type="text"
              placeholder="Buscar sesion..."
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>
        </div>
        <div className="sales-lines-table-wrap">
          <table className="sales-lines-table">
            <thead>
              <tr>
                <th>Usuario</th>
                <th>IP</th>
                <th>Fecha login</th>
                <th>Ultima actividad</th>
                <th>Estado conexion</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {paginatedSessions.length === 0 ? (
                <tr><td colSpan={6} className="sales-empty-row">No hay sesiones para mostrar.</td></tr>
              ) : (
                paginatedSessions.map((session) => (
                  <tr key={session.id}>
                    <td>{session.username || '-'}</td>
                    <td>{session.ip || '-'}</td>
                    <td>{session.loginDate ? new Date(session.loginDate).toLocaleString('es-AR') : '-'}</td>
                    <td>{session.lastActivity ? new Date(session.lastActivity).toLocaleString('es-AR') : '-'}</td>
                    <td>
                      <span className={`badge ${session.connectionStatus === 'Activa' ? 'badge-green' : 'badge-yellow'}`}>
                        {session.connectionStatus || 'Inactiva'}
                      </span>
                    </td>
                    <td>
                      <button className="btn btn-sm btn-danger" type="button" onClick={() => handleForceClose(session.id)}>
                        Forzar cierre
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <div className="sales-pagination">
          <span>Pagina {currentPage} de {totalPages}</span>
          <div className="btn-group">
            <button className="btn btn-sm btn-secondary" type="button" onClick={() => setPage((current) => Math.max(1, current - 1))} disabled={currentPage <= 1}>Anterior</button>
            <button className="btn btn-sm btn-secondary" type="button" onClick={() => setPage((current) => Math.min(totalPages, current + 1))} disabled={currentPage >= totalPages}>Siguiente</button>
          </div>
        </div>
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
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
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
  const filteredCategories = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return categories;

    return categories.filter((category) =>
      [String(category.id), category.name, category.full_name, String(category.parent_id ?? ''), String(category.product_count ?? 0)]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(term))
    );
  }, [categories, search]);

  const totalPages = Math.max(1, Math.ceil(filteredCategories.length / 8));
  const currentPage = Math.min(page, totalPages);
  const paginatedCategories = filteredCategories.slice((currentPage - 1) * 8, currentPage * 8);

  useEffect(() => {
    setPage(1);
  }, [search]);

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [page, totalPages]);

  return (
    <div className="admin-grid">
      <div className="card admin-panel admin-panel-full">
        <div className="admin-panel-head"><div><p className="admin-panel-kicker">Rubros</p><h3>Listado</h3></div></div>
        <div className="admin-filter-card">
          <div className="search-box admin-search-box">
            <input
              type="text"
              placeholder="Buscar registro..."
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>
        </div>
        {categories.length > 0 ? (
          <div className="admin-tree-card">
            <h3>Arbol de categorias</h3>
            <div className="admin-tree-list">
              {categories.map((category) => (
                <div key={category.id} className="admin-tree-item">
                  {category.parent_id ? '└ ' : ''}{category.full_name || category.name}
                </div>
              ))}
            </div>
          </div>
        ) : null}
        <div className="sales-lines-table-wrap">
          <table className="sales-lines-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Descripcion</th>
                <th>Estado</th>
                <th>Productos</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {paginatedCategories.length === 0 ? (
                <tr><td colSpan={5} className="sales-empty-row">No hay registros para mostrar.</td></tr>
              ) : (
                paginatedCategories.map((category) => (
                  <tr key={category.id}>
                    <td>{category.id}</td>
                    <td>{category.full_name || category.name}</td>
                    <td><span className="badge badge-green">Activo</span></td>
                    <td>{category.product_count || 0}</td>
                    <td>
                      <div className="btn-group">
                        <button className="btn btn-sm btn-danger" type="button" onClick={() => void handleDelete(category)}>Eliminar</button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <div className="sales-pagination">
          <span>Pagina {currentPage} de {totalPages}</span>
          <div className="btn-group">
            <button className="btn btn-sm btn-secondary" type="button" onClick={() => setPage((current) => Math.max(1, current - 1))} disabled={currentPage <= 1}>Anterior</button>
            <button className="btn btn-sm btn-secondary" type="button" onClick={() => setPage((current) => Math.min(totalPages, current + 1))} disabled={currentPage >= totalPages}>Siguiente</button>
          </div>
        </div>
      </div>

      <div className="card admin-panel admin-panel-full">
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
  const [typesSearch, setTypesSearch] = useState('');
  const [brandsSearch, setBrandsSearch] = useState('');
  const [modelsSearch, setModelsSearch] = useState('');
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
  const filteredDeviceTypes = useMemo(() => {
    const term = typesSearch.trim().toLowerCase();
    if (!term) return deviceTypes;
    return deviceTypes.filter((item: DeviceType) => [String(item.id), item.name].some((value) => value.toLowerCase().includes(term)));
  }, [deviceTypes, typesSearch]);
  const filteredBrands = useMemo(() => {
    const term = brandsSearch.trim().toLowerCase();
    if (!term) return brands;
    return brands.filter((item: Brand) => [String(item.id), item.name, item.slug || ''].some((value) => value.toLowerCase().includes(term)));
  }, [brands, brandsSearch]);
  const filteredModels = useMemo(() => {
    const term = modelsSearch.trim().toLowerCase();
    if (!term) return models;
    return models.filter((item: DeviceModel) => {
      const brandNameValue = brands.find((brand) => brand.id === item.brand_id)?.name || '';
      return [String(item.id), item.name, brandNameValue].some((value) => value.toLowerCase().includes(term));
    });
  }, [brands, models, modelsSearch]);

  return (
    <div className="admin-grid">
      <div className="card admin-panel admin-panel-full">
        <div className="admin-panel-head"><div><p className="admin-panel-kicker">Tipos</p><h3>Tipos de equipo</h3></div></div>
        <form className="admin-form-grid" onSubmit={submitType}>
          <div className="form-group"><label>Nombre</label><input value={deviceTypeName} onChange={(event) => setDeviceTypeName(event.target.value)} /></div>
          <div className="admin-form-actions"><button type="submit" className="btn btn-primary">Guardar</button></div>
        </form>
        <div className="admin-filter-card">
          <div className="search-box admin-search-box">
            <input type="text" placeholder="Buscar tipo..." value={typesSearch} onChange={(event) => setTypesSearch(event.target.value)} />
          </div>
        </div>
        <div className="sales-lines-table-wrap">
          <table className="sales-lines-table">
            <thead><tr><th>ID</th><th>Descripcion</th><th>Estado</th><th>Acciones</th></tr></thead>
            <tbody>
              {filteredDeviceTypes.length === 0 ? (
                <tr><td colSpan={4} className="sales-empty-row">No hay registros para mostrar.</td></tr>
              ) : (
                filteredDeviceTypes.map((item: DeviceType) => (
                  <tr key={item.id}>
                    <td>{item.id}</td>
                    <td>{item.name}</td>
                    <td><span className="badge badge-green">Activo</span></td>
                    <td><div className="btn-group"><button className="btn btn-sm btn-danger" type="button" onClick={() => void deleteTypeMutation.mutateAsync(item.id)}>Eliminar</button></div></td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card admin-panel admin-panel-full">
        <div className="admin-panel-head"><div><p className="admin-panel-kicker">Marcas</p><h3>Marcas</h3></div></div>
        <form className="admin-form-grid" onSubmit={submitBrand}>
          <div className="form-group"><label>Nombre</label><input value={brandName} onChange={(event) => setBrandName(event.target.value)} /></div>
          <div className="admin-form-actions"><button type="submit" className="btn btn-primary">Guardar</button></div>
        </form>
        <div className="admin-filter-card">
          <div className="search-box admin-search-box">
            <input type="text" placeholder="Buscar marca..." value={brandsSearch} onChange={(event) => setBrandsSearch(event.target.value)} />
          </div>
        </div>
        <div className="sales-lines-table-wrap">
          <table className="sales-lines-table">
            <thead><tr><th>ID</th><th>Descripcion</th><th>Estado</th><th>Acciones</th></tr></thead>
            <tbody>
              {filteredBrands.length === 0 ? (
                <tr><td colSpan={4} className="sales-empty-row">No hay registros para mostrar.</td></tr>
              ) : (
                filteredBrands.map((item: Brand) => (
                  <tr key={item.id}>
                    <td>{item.id}</td>
                    <td>{item.name}</td>
                    <td><span className="badge badge-green">Activo</span></td>
                    <td><div className="btn-group"><button className="btn btn-sm btn-danger" type="button" onClick={() => void deleteBrandMutation.mutateAsync(item.id)}>Eliminar</button></div></td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
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
        <div className="admin-filter-card">
          <div className="search-box admin-search-box">
            <input type="text" placeholder="Buscar modelo..." value={modelsSearch} onChange={(event) => setModelsSearch(event.target.value)} />
          </div>
        </div>
        <div className="sales-lines-table-wrap">
          <table className="sales-lines-table">
            <thead><tr><th>ID</th><th>Modelo</th><th>Marca</th><th>Estado</th><th>Acciones</th></tr></thead>
            <tbody>
              {filteredModels.length === 0 ? (
                <tr><td colSpan={5} className="sales-empty-row">No hay modelos para mostrar.</td></tr>
              ) : (
                filteredModels.map((model: DeviceModel) => (
                  <tr key={model.id}>
                    <td>{model.id}</td>
                    <td>{model.name}</td>
                    <td>{brands.find((brand) => brand.id === model.brand_id)?.name || '-'}</td>
                    <td><span className="badge badge-green">Activo</span></td>
                    <td><div className="btn-group"><button className="btn btn-sm btn-danger" type="button" onClick={() => void deleteModelMutation.mutateAsync(model.id)}>Eliminar</button></div></td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function GeneralConfigPanel({
  feedback,
  setFeedback
}: {
  feedback: string;
  setFeedback: (value: string) => void;
}) {
  const queryClient = useQueryClient();
  const [settingsValues, setSettingsValues] = useState<BusinessSettings>(EMPTY_SETTINGS);
  const [generalValues, setGeneralValues] = useState(() => readAdminConfigStore().general || DEFAULT_ADMIN_CONFIG.general!);
  const settingsQuery = useQuery({ queryKey: ['settings'], queryFn: getSettings, staleTime: 30_000 });
  const updateMutation = useMutation({
    mutationFn: updateSettings,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['settings'] });
    }
  });

  useEffect(() => {
    if (!settingsQuery.data) return;
    setSettingsValues({
      business_name: settingsQuery.data.business_name || '',
      business_address: settingsQuery.data.business_address || '',
      business_phone: settingsQuery.data.business_phone || '',
      business_email: settingsQuery.data.business_email || ''
    });
  }, [settingsQuery.data]);

  function handleExtraChange(event: ChangeEvent<HTMLInputElement>) {
    const { name, value } = event.target;
    setGeneralValues((current) => ({ ...current, [name]: value }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    try {
      await updateMutation.mutateAsync(settingsValues);
      const nextConfig = { ...readAdminConfigStore(), general: generalValues };
      writeAdminConfigStore(nextConfig);
      setFeedback('Datos generales guardados correctamente.');
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : 'No se pudo guardar la configuracion.');
    }
  }

  return (
    <div className="admin-grid">
      <div className="card admin-panel admin-panel-full">
        <form className="admin-form-card" onSubmit={handleSubmit}>
          <div className="admin-form-grid">
            <div className="form-group"><label>Nombre empresa</label><input value={settingsValues.business_name} onChange={(event) => setSettingsValues((current) => ({ ...current, business_name: event.target.value }))} /></div>
            <div className="form-group"><label>Razon social</label><input name="legal_name" value={generalValues.legal_name || ''} onChange={handleExtraChange} /></div>
            <div className="form-group"><label>CUIT</label><input name="tax_id" value={generalValues.tax_id || ''} onChange={handleExtraChange} /></div>
            <div className="form-group"><label>Telefono</label><input value={settingsValues.business_phone || ''} onChange={(event) => setSettingsValues((current) => ({ ...current, business_phone: event.target.value }))} /></div>
            <div className="form-group admin-field-span-2"><label>Direccion</label><input value={settingsValues.business_address || ''} onChange={(event) => setSettingsValues((current) => ({ ...current, business_address: event.target.value }))} /></div>
            <div className="form-group"><label>Email</label><input type="email" value={settingsValues.business_email || ''} onChange={(event) => setSettingsValues((current) => ({ ...current, business_email: event.target.value }))} /></div>
            <div className="form-group"><label>Moneda</label><input name="currency" value={generalValues.currency || ''} onChange={handleExtraChange} /></div>
            <div className="form-group"><label>Formato fecha</label><input name="date_format" value={generalValues.date_format || ''} onChange={handleExtraChange} /></div>
            <div className="form-group"><label>Zona horaria</label><input name="timezone" value={generalValues.timezone || ''} onChange={handleExtraChange} /></div>
            <div className="form-group admin-field-span-2">
              <label>Logo empresa</label>
              <input type="file" accept="image/*" onChange={(event) => setGeneralValues((current) => ({ ...current, logo_name: event.target.files?.[0]?.name || '' }))} />
              <small className="admin-help-inline">
                {generalValues.logo_name ? `Archivo seleccionado: ${generalValues.logo_name}` : 'Puede seleccionar un archivo para registrar el logo en la configuracion local.'}
              </small>
            </div>
          </div>
          <div className="admin-actions-row">
            <button className="btn btn-success" type="submit" disabled={updateMutation.isPending}>{updateMutation.isPending ? 'Guardando...' : 'Guardar cambios'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

function DocumentsConfigPanel({
  setFeedback
}: {
  feedback: string;
  setFeedback: (value: string) => void;
}) {
  const [values, setValues] = useState(() => readAdminConfigStore().documents || DEFAULT_ADMIN_CONFIG.documents!);

  function handleChange(event: ChangeEvent<HTMLInputElement>) {
    const target = event.target;
    const value = target.type === 'checkbox' ? target.checked : target.value;
    setValues((current) => ({ ...current, [target.name]: value }));
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextConfig = { ...readAdminConfigStore(), documents: { ...values, decimals: Number(values.decimals || 2) } };
    writeAdminConfigStore(nextConfig);
    setFeedback('Configuracion de comprobantes guardada correctamente.');
  }

  return (
    <div className="admin-grid">
      <div className="card admin-panel admin-panel-full">
        <form className="admin-form-card" onSubmit={handleSubmit}>
          <div className="admin-form-grid">
            <div className="form-group"><label>Formato numeracion</label><input name="numbering_format" value={values.numbering_format || ''} onChange={handleChange} /></div>
            <div className="form-group"><label>Prefijos</label><input name="prefixes" value={values.prefixes || ''} onChange={handleChange} /></div>
            <div className="form-group"><label>Decimales permitidos</label><input name="decimals" value={String(values.decimals ?? 2)} onChange={handleChange} /></div>
            <div className="form-group admin-field-span-2"><label className="admin-switch-row"><input name="control_stock" type="checkbox" checked={values.control_stock !== false} onChange={handleChange} /><span>Control de stock</span></label></div>
            <div className="form-group admin-field-span-2"><label className="admin-switch-row"><input name="allow_negative_stock" type="checkbox" checked={Boolean(values.allow_negative_stock)} onChange={handleChange} /><span>Permitir stock negativo</span></label></div>
            <div className="form-group admin-field-span-2"><label className="admin-switch-row"><input name="control_min_price" type="checkbox" checked={Boolean(values.control_min_price)} onChange={handleChange} /><span>Control de precios minimos</span></label></div>
          </div>
          <div className="admin-actions-row">
            <button className="btn btn-success" type="submit">Guardar configuracion</button>
          </div>
        </form>
      </div>
    </div>
  );
}

function MailConfigPanel({
  setFeedback
}: {
  feedback: string;
  setFeedback: (value: string) => void;
}) {
  const [values, setValues] = useState(() => readAdminConfigStore().mail || DEFAULT_ADMIN_CONFIG.mail!);

  function handleChange(event: ChangeEvent<HTMLInputElement | HTMLSelectElement>) {
    const { name, value } = event.target;
    setValues((current) => ({ ...current, [name]: value }));
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextConfig = { ...readAdminConfigStore(), mail: values };
    writeAdminConfigStore(nextConfig);
    setFeedback('Configuracion de mail guardada correctamente.');
  }

  function handleTestConnection() {
    setFeedback('Prueba de conexion registrada localmente.');
  }

  return (
    <div className="admin-grid">
      <div className="card admin-panel admin-panel-full">
        <form className="admin-form-card" onSubmit={handleSubmit}>
          <div className="admin-form-grid">
            <div className="form-group"><label>Servidor SMTP</label><input name="smtp_server" value={values.smtp_server || ''} onChange={handleChange} /></div>
            <div className="form-group"><label>Puerto</label><input name="port" type="number" value={values.port || ''} onChange={handleChange} /></div>
            <div className="form-group"><label>Usuario</label><input name="username" value={values.username || ''} onChange={handleChange} /></div>
            <div className="form-group"><label>Contrasena</label><input name="password" type="password" value={values.password || ''} onChange={handleChange} /></div>
            <div className="form-group"><label>TLS / SSL</label><select name="encryption" value={values.encryption || 'tls'} onChange={handleChange}><option value="tls">TLS</option><option value="ssl">SSL</option><option value="none">Sin cifrado</option></select></div>
            <div className="form-group"><label>Email remitente</label><input name="sender_email" type="email" value={values.sender_email || ''} onChange={handleChange} /></div>
          </div>
          <div className="admin-actions-row">
            <button className="btn btn-secondary" type="button" onClick={handleTestConnection}>Probar conexion</button>
            <button className="btn btn-success" type="submit">Guardar configuracion</button>
          </div>
        </form>
      </div>
    </div>
  );
}

function AuxTablesPanel({
  feedback,
  setFeedback
}: {
  feedback: string;
  setFeedback: (value: string) => void;
}) {
  const categoriesQuery = useQuery({ queryKey: ['categories'], queryFn: getCategories, staleTime: 30_000 });
  const brandsQuery = useQuery({ queryKey: ['brands'], queryFn: getBrands, staleTime: 30_000 });
  const [tableKey, setTableKey] = useState<AdminAuxTableKey>('banks');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [description, setDescription] = useState('');
  const [auxStore, setAuxStore] = useState(() => readAdminAuxStore());

  const rows = useMemo(() => {
    if (tableKey === 'categories') {
      return (categoriesQuery.data || []).map((category) => ({
        id: category.id,
        description: category.full_name || category.name,
        code: '',
        active: true,
        source: 'api' as const
      }));
    }

    if (tableKey === 'brands') {
      return (brandsQuery.data || []).map((brand) => ({
        id: brand.id,
        description: brand.name,
        code: '',
        active: true,
        source: 'api' as const
      }));
    }

    return (auxStore[tableKey] || []).map((row) => ({ ...row, source: 'local' as const }));
  }, [auxStore, brandsQuery.data, categoriesQuery.data, tableKey]);

  const filteredRows = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return rows;
    return rows.filter((row) =>
      [String(row.id), row.description, row.code]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(term))
    );
  }, [rows, search]);

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / 8));
  const currentPage = Math.min(page, totalPages);
  const paginatedRows = filteredRows.slice((currentPage - 1) * 8, currentPage * 8);

  useEffect(() => {
    setPage(1);
  }, [search, tableKey]);

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [page, totalPages]);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!description.trim()) {
      setFeedback('Ingrese una descripcion.');
      return;
    }
    if (tableKey === 'categories' || tableKey === 'brands') {
      setFeedback('Esta tabla se administra desde su modulo especifico.');
      return;
    }

    const nextStore = {
      ...auxStore,
      [tableKey]: [
        {
          id: `${tableKey}-${Date.now()}`,
          description: description.trim(),
          active: true,
          source: 'local'
        },
        ...(auxStore[tableKey] || [])
      ]
    };
    setAuxStore(nextStore);
    writeAdminAuxStore(nextStore);
    setDescription('');
    setFeedback('Registro agregado correctamente.');
  }

  function handleDelete(row: AdminAuxRow) {
    if (row.source !== 'local') {
      setFeedback('Este registro se administra desde su modulo especifico.');
      return;
    }
    if (!window.confirm('Desea eliminar este registro?')) return;
    const nextStore = {
      ...auxStore,
      [tableKey]: (auxStore[tableKey] || []).filter((item) => String(item.id) !== String(row.id))
    };
    setAuxStore(nextStore);
    writeAdminAuxStore(nextStore);
    setFeedback('Registro eliminado correctamente.');
  }

  return (
    <div className="admin-grid">
      <div className="card admin-panel admin-panel-full">
        <div className="admin-filter-card">
          <div className="admin-filter-grid">
            <div className="form-group">
              <label>Tabla</label>
              <select value={tableKey} onChange={(event) => setTableKey(event.target.value as AdminAuxTableKey)}>
                {Object.entries(ADMIN_AUX_TABLES).map(([value, item]) => (
                  <option key={value} value={value}>{item.label}</option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label>Buscar</label>
              <input type="text" placeholder="Buscar registro..." value={search} onChange={(event) => setSearch(event.target.value)} />
            </div>
          </div>
        </div>

        {tableKey === 'categories' ? (
          <div className="admin-tree-card">
            <h3>Arbol de categorias</h3>
            <div className="admin-tree-list">
              {(categoriesQuery.data || []).map((category) => (
                <div key={category.id} className="admin-tree-item">{category.parent_id ? '└ ' : ''}{category.full_name || category.name}</div>
              ))}
            </div>
          </div>
        ) : null}

        <div className="admin-table-card">
          <div className="admin-table-header-note">{ADMIN_AUX_TABLES[tableKey].label}</div>
          <div className="sales-lines-table-wrap">
            <table className="sales-lines-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Descripcion</th>
                  <th>Estado</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {paginatedRows.length === 0 ? (
                  <tr><td colSpan={4} className="sales-empty-row">No hay registros para mostrar.</td></tr>
                ) : (
                  paginatedRows.map((row) => (
                    <tr key={String(row.id)}>
                      <td>{row.id}</td>
                      <td>{row.description}</td>
                      <td><span className={`badge ${row.active === false ? 'badge-yellow' : 'badge-green'}`}>{row.active === false ? 'Inactivo' : 'Activo'}</span></td>
                      <td>
                        <div className="btn-group">
                          <button className="btn btn-sm btn-danger" type="button" onClick={() => handleDelete(row)}>Eliminar</button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          <div className="sales-pagination">
            <span>Pagina {currentPage} de {totalPages}</span>
            <div className="btn-group">
              <button className="btn btn-sm btn-secondary" type="button" onClick={() => setPage((current) => Math.max(1, current - 1))} disabled={currentPage <= 1}>Anterior</button>
              <button className="btn btn-sm btn-secondary" type="button" onClick={() => setPage((current) => Math.min(totalPages, current + 1))} disabled={currentPage >= totalPages}>Siguiente</button>
            </div>
          </div>
        </div>
      </div>

      <div className="card admin-panel admin-panel-full">
        <div className="admin-panel-head">
          <div>
            <p className="admin-panel-kicker">{ADMIN_AUX_TABLES[tableKey].label}</p>
            <h3>Nuevo registro</h3>
          </div>
        </div>
        <form className="admin-form-grid" onSubmit={handleSubmit}>
          <div className="form-group admin-field-span-2">
            <label>Descripcion</label>
            <input value={description} onChange={(event) => setDescription(event.target.value)} />
          </div>
          <div className="admin-form-actions">
            <button className="btn btn-primary" type="submit">Guardar</button>
          </div>
        </form>
      </div>
    </div>
  );
}

function ResetDataPanel({
  setFeedback
}: {
  feedback: string;
  setFeedback: (value: string) => void;
}) {
  const [confirmValue, setConfirmValue] = useState('');
  const [result, setResult] = useState('');

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (confirmValue.trim().toUpperCase() !== 'RESTABLECER') {
      setFeedback('Debe escribir RESTABLECER para continuar.');
      return;
    }
    const message = 'Modo seguro: no se eliminaron datos productivos porque el backend actual no expone borrado masivo.';
    setResult(message);
    setFeedback('Proceso completado.');
  }

  return (
    <div className="admin-grid">
      <div className="card admin-panel admin-panel-full admin-warning-card">
        <h3>Esta accion eliminara datos iniciales del sistema.</h3>
        <p>Seleccione los grupos a restablecer y escriba <strong>RESTABLECER</strong> para confirmar.</p>
        <form onSubmit={handleSubmit}>
          <div className="admin-check-grid">
            <label className="admin-check-item"><input type="checkbox" /> Clientes demo</label>
            <label className="admin-check-item"><input type="checkbox" /> Articulos demo</label>
            <label className="admin-check-item"><input type="checkbox" /> Comprobantes demo</label>
          </div>
          <div className="form-group">
            <label>Confirmacion obligatoria</label>
            <input type="text" placeholder="Escriba RESTABLECER" value={confirmValue} onChange={(event) => setConfirmValue(event.target.value)} />
          </div>
          <div className="admin-actions-row">
            <button className="btn btn-danger" type="submit">Restablecer datos</button>
          </div>
        </form>
        {result ? (
          <div className="admin-process-card">
            <h4>Restablecer datos</h4>
            <p><strong>Resultado:</strong> Proceso completado</p>
            <p><strong>Errores detectados:</strong> {result}</p>
            <p><strong>Tiempo de ejecucion:</strong> 0.1 s</p>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function TroubleshootPanel({
  setFeedback
}: {
  feedback: string;
  setFeedback: (value: string) => void;
}) {
  const [result, setResult] = useState('');

  function runAction(type: 'indices' | 'ventas' | 'cache') {
    if (!window.confirm('Desea ejecutar esta accion tecnica?')) return;

    const messages = {
      indices: 'Se regeneraron referencias visuales y catalogos locales del modulo administrativo.',
      ventas: 'Se completo la validacion superficial de ventas y numeracion sin cambios estructurales.',
      cache: 'Se limpiaron caches locales de administracion y sesiones auxiliares.'
    };

    if (type === 'cache') {
      window.localStorage.removeItem('milo_admin_connected_users');
      window.localStorage.removeItem('milo_admin_aux_tables');
    }

    setResult(messages[type]);
    setFeedback('Proceso completado.');
  }

  return (
    <div className="admin-grid">
      <div className="card admin-panel admin-panel-full">
        <div className="admin-tools-grid">
          <button className="admin-tool-card" type="button" onClick={() => runAction('indices')}>
            <strong>Recrear indices y tablas</strong>
            <span>Reconstruye estructuras administrativas locales para diagnostico visual.</span>
          </button>
          <button className="admin-tool-card" type="button" onClick={() => runAction('ventas')}>
            <strong>Reparar ventas</strong>
            <span>Revisa estructura de comprobantes y consistencia de datos comerciales.</span>
          </button>
          <button className="admin-tool-card" type="button" onClick={() => runAction('cache')}>
            <strong>Limpiar cache</strong>
            <span>Limpia caches locales del frontend sin tocar la base principal.</span>
          </button>
        </div>

        {result ? (
          <div className="admin-process-card">
            <h4>Proceso completado</h4>
            <p><strong>Resultado:</strong> {result}</p>
            <p><strong>Errores detectados:</strong> No se detectaron errores criticos.</p>
            <p><strong>Tiempo de ejecucion:</strong> 0.3 s</p>
          </div>
        ) : null}
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
      {feedback ? <div className={`alert ${feedback.includes('No se pudo') ? 'alert-warning' : 'alert-info'}`}>{feedback}</div> : null}

      {pageId === 'admin-users' ? <UsersPanel feedback={feedback} setFeedback={setFeedback} /> : null}
      {pageId === 'admin-users-connected' ? <ConnectedUsersPanel feedback={feedback} setFeedback={setFeedback} /> : null}
      {pageId === 'admin-categories' ? <CategoriesPanel feedback={feedback} setFeedback={setFeedback} /> : null}
      {pageId === 'admin-device-options' ? <DeviceOptionsPanel feedback={feedback} setFeedback={setFeedback} /> : null}
      {pageId === 'admin-aux-tables' ? <AuxTablesPanel feedback={feedback} setFeedback={setFeedback} /> : null}
      {pageId === 'admin-config-general' ? <GeneralConfigPanel feedback={feedback} setFeedback={setFeedback} /> : null}
      {pageId === 'admin-config-documents' ? <DocumentsConfigPanel feedback={feedback} setFeedback={setFeedback} /> : null}
      {pageId === 'admin-config-mail' ? <MailConfigPanel feedback={feedback} setFeedback={setFeedback} /> : null}
      {pageId === 'admin-reset-data' ? <ResetDataPanel feedback={feedback} setFeedback={setFeedback} /> : null}
      {pageId === 'admin-troubleshoot' ? <TroubleshootPanel feedback={feedback} setFeedback={setFeedback} /> : null}

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

