import { useEffect, useMemo, useState, type ChangeEvent } from 'react';
import { getProducts } from '../../services/products';
import type { Product } from '../../types/product';

const TOOLS_MODULES = [
  { id: 'tools-import', section: 'sync', label: 'Sincronizar articulos', title: 'Offline', description: 'Descarga articulos para trabajar sin internet.' },
  { id: 'tools-export', section: 'offline-prices', label: 'Consultar precios offline', title: 'Offline', description: 'Busqueda rapida por codigo o descripcion.' },
  { id: 'tools-backup', section: 'sync-status', label: 'Estado de sincronizacion', title: 'Offline', description: 'Resumen del estado offline disponible.' }
] as const;

const TOOLS_STORAGE_KEYS = {
  catalog: 'milo_tools_offline_catalog',
  meta: 'milo_tools_offline_meta'
};

interface OfflineCatalogItem {
  id: number;
  code: string;
  barcode: string;
  description: string;
  price: number;
}

function getModuleConfig(pageId: string) {
  return TOOLS_MODULES.find((module) => module.id === pageId) || TOOLS_MODULES[0];
}

function formatMoney(value: number) {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    minimumFractionDigits: 2
  }).format(Number(value || 0));
}

function normalizeText(value: string) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function buildCatalogItem(product: Product): OfflineCatalogItem {
  const code = String(product.sku || product.barcode || `ART-${product.id}`).trim();
  const barcode = String(product.barcode || '').trim();
  const detail = String(product.description || '').trim();
  const description = [product.name, detail].filter((value, index, items) => value && items.indexOf(value) === index).join(' - ') || 'Sin descripcion';

  return {
    id: product.id,
    code,
    barcode,
    description,
    price: Number(product.sale_price || 0)
  };
}

function loadOfflineCatalog() {
  try {
    const value = JSON.parse(window.localStorage.getItem(TOOLS_STORAGE_KEYS.catalog) || '[]') as OfflineCatalogItem[];
    return Array.isArray(value) ? value : [];
  } catch (_error) {
    return [];
  }
}

function loadOfflineMeta() {
  try {
    const value = JSON.parse(window.localStorage.getItem(TOOLS_STORAGE_KEYS.meta) || '{}') as { lastSyncAt?: string; itemCount?: number };
    return value || {};
  } catch (_error) {
    return {};
  }
}

function saveOfflineData(catalog: OfflineCatalogItem[]) {
  const meta = {
    lastSyncAt: new Date().toISOString(),
    itemCount: catalog.length
  };
  window.localStorage.setItem(TOOLS_STORAGE_KEYS.catalog, JSON.stringify(catalog));
  window.localStorage.setItem(TOOLS_STORAGE_KEYS.meta, JSON.stringify(meta));
  return meta;
}

export function ToolsPage({ pageId }: { pageId: string }) {
  const [catalog, setCatalog] = useState<OfflineCatalogItem[]>(() => loadOfflineCatalog());
  const [meta, setMeta] = useState<{ lastSyncAt?: string; itemCount?: number }>(() => loadOfflineMeta());
  const [search, setSearch] = useState('');
  const [feedback, setFeedback] = useState('');
  const [isSyncing, setIsSyncing] = useState(false);
  const [isOnline, setIsOnline] = useState<boolean>(() => navigator.onLine);
  const moduleConfig = getModuleConfig(pageId);

  useEffect(() => {
    const handleConnectionChange = () => {
      setIsOnline(navigator.onLine);
    };

    window.addEventListener('online', handleConnectionChange);
    window.addEventListener('offline', handleConnectionChange);
    return () => {
      window.removeEventListener('online', handleConnectionChange);
      window.removeEventListener('offline', handleConnectionChange);
    };
  }, []);

  const filteredCatalog = useMemo(() => {
    const normalized = normalizeText(search);
    if (!normalized) return [];
    return [...catalog]
      .sort((a, b) => a.description.localeCompare(b.description, 'es'))
      .filter((item) => {
        const haystack = [item.code, item.barcode, item.description].map((value) => normalizeText(value));
        return haystack.some((value) => value.includes(normalized));
      })
      .slice(0, 150);
  }, [catalog, search]);

  async function handleSync() {
    setFeedback('');
    setIsSyncing(true);

    try {
      const products = await getProducts({});
      const nextCatalog = products.map(buildCatalogItem);
      const nextMeta = saveOfflineData(nextCatalog);
      setCatalog(nextCatalog);
      setMeta(nextMeta);
      setFeedback(`Sincronizacion completada. ${nextCatalog.length} articulos actualizados.`);
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : 'No se pudo sincronizar articulos.');
    } finally {
      setIsSyncing(false);
    }
  }

  const section = moduleConfig.section;
  const offlineEmptyMessage = catalog.length === 0
    ? 'Todavia no hay articulos sincronizados en este navegador.'
    : search.trim()
      ? 'No hay coincidencias para la busqueda actual.'
      : 'Ingrese codigo o descripcion para comenzar la busqueda.';
  const lastSyncText = meta.lastSyncAt ? new Date(meta.lastSyncAt).toLocaleString('es-AR') : 'Sin sincronizar';

  return (
    <div className="tools-module-shell">
      <div className="tools-module-head">
        <div>
          <p className="tools-module-kicker">Herramientas</p>
          <h2>{moduleConfig.title}</h2>
          <p>Modulo preparado para sincronizar articulos, consultar precios sin conexion y visualizar el estado del trabajo offline.</p>
        </div>
        <div className={`tools-connection-indicator ${isOnline ? 'is-online' : 'is-offline'}`}>
          <span className="tools-connection-dot" />
          {isOnline ? 'Con internet' : 'Sin internet'}
        </div>
      </div>

      <div className="tools-switcher-card">
        <div className="tools-switcher-head">
          <span className="tools-switcher-kicker">Offline</span>
          <p>Seleccione la herramienta offline que desea utilizar.</p>
        </div>
        <div className="tools-switcher-grid" role="tablist" aria-label="Herramientas offline">
          {TOOLS_MODULES.map((module) => (
            <button
              key={module.id}
              type="button"
              className={`tools-switcher-button${module.id === pageId ? ' is-active' : ''}`}
              onClick={() => {
                window.location.hash = module.id;
              }}
            >
              <strong>{module.label}</strong>
              <span>{module.description}</span>
            </button>
          ))}
        </div>
      </div>

      {section === 'sync' ? (
        <>
          <div className="tools-card">
            <div className="tools-card-head">
              <div>
                <h3>Sincronizar articulos</h3>
                <p>Permite descargar los articulos necesarios para consultar codigo, descripcion y precio sin conexion.</p>
              </div>
              <div className={`tools-inline-status ${isOnline ? 'is-online' : 'is-offline'}`}>
                {isOnline ? 'Online' : 'Offline'}
              </div>
            </div>
            <div className="tools-primary-action">
              <button className="btn btn-primary" type="button" onClick={handleSync} disabled={!isOnline || isSyncing}>
                {isSyncing ? 'Sincronizando articulos...' : 'Sincronizar articulos'}
              </button>
              <span>Los datos se guardan en este navegador.</span>
            </div>
            {feedback ? <div className={`alert ${feedback.includes('No se pudo') ? 'alert-warning' : 'alert-info'}`}>{feedback}</div> : null}
          </div>

          <div className="tools-summary-grid">
            <article className="tools-summary-card"><span>Ultima sincronizacion</span><strong>{lastSyncText}</strong></article>
            <article className="tools-summary-card"><span>Articulos descargados</span><strong>{catalog.length}</strong></article>
            <article className="tools-summary-card"><span>Lista de precios</span><strong>Precio de venta</strong></article>
          </div>
        </>
      ) : null}

      {section === 'offline-prices' ? (
        <div className="tools-card">
          <div className="tools-card-head">
            <div>
              <h3>Consultar precios offline</h3>
              <p>Busqueda rapida por codigo, codigo de barras o descripcion sobre el catalogo sincronizado.</p>
            </div>
            <div className="tools-table-badge">{filteredCatalog.length} resultados</div>
          </div>
          <div className="form-group tools-search-group">
            <label>Buscar por codigo o descripcion</label>
            <input value={search} onChange={(event: ChangeEvent<HTMLInputElement>) => setSearch(event.target.value)} placeholder="Escriba codigo o descripcion" autoComplete="off" />
            <small>Busqueda por prefijo o contenido dentro del catalogo offline.</small>
          </div>
          <div className="tools-table-wrap">
            <table className="tools-table">
              <thead>
                <tr>
                  <th>Codigo</th>
                  <th>Descripcion</th>
                  <th>Precio</th>
                </tr>
              </thead>
              <tbody>
                {filteredCatalog.length === 0 ? (
                  <tr><td colSpan={3} className="tools-empty-row">{offlineEmptyMessage}</td></tr>
                ) : (
                  filteredCatalog.map((item) => (
                    <tr key={item.id}>
                      <td>{item.code}</td>
                      <td>{item.description}</td>
                      <td>{formatMoney(item.price)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      {section === 'sync-status' ? (
        <>
          <div className="tools-summary-grid">
            <article className="tools-summary-card"><span>Sincronizacion</span><strong>{catalog.length > 0 ? 'Disponible' : 'Pendiente'}</strong></article>
            <article className="tools-summary-card"><span>Articulos guardados</span><strong>{catalog.length}</strong></article>
            <article className="tools-summary-card"><span>Ultima sincronizacion</span><strong>{meta.lastSyncAt ? new Date(meta.lastSyncAt).toLocaleString('es-AR') : 'Sin registro'}</strong></article>
            <article className="tools-summary-card"><span>Navegador</span><strong>Este equipo</strong></article>
          </div>
          <div className={`tools-status-banner ${catalog.length > 0 ? 'is-available' : 'is-empty'}`}>
            <strong>{catalog.length > 0 ? 'Catalogo offline disponible' : 'Catalogo offline pendiente'}</strong>
            <span>{catalog.length > 0 ? 'Este navegador tiene datos para consulta sin conexion.' : 'Sincronice articulos para habilitar la consulta offline.'}</span>
          </div>
        </>
      ) : null}
    </div>
  );
}

