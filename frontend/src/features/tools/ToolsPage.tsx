import { useEffect, useMemo, useState, type ChangeEvent } from 'react';
import { getProducts } from '../../api/products';
import type { Product } from '../../types/product';

const TOOLS_MODULES = [
  { id: 'tools-import', section: 'sync', label: 'Sincronizar articulos', title: 'Offline', subtitle: 'Sincronizacion de articulos y consulta offline.' },
  { id: 'tools-export', section: 'offline-prices', label: 'Consultar precios offline', title: 'Offline', subtitle: 'Busqueda por codigo o descripcion.' },
  { id: 'tools-backup', section: 'sync-status', label: 'Estado de sincronizacion', title: 'Offline', subtitle: 'Resumen de informacion guardada en este navegador.' }
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
    if (!normalized) return catalog;
    return catalog.filter((item) => {
      const haystack = [item.code, item.barcode, item.description].map((value) => normalizeText(value));
      return haystack.some((value) => value.includes(normalized));
    });
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
      setFeedback(`Sincronizacion completada. ${nextCatalog.length} articulos descargados.`);
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : 'No se pudo sincronizar articulos.');
    } finally {
      setIsSyncing(false);
    }
  }

  const section = moduleConfig.section;

  return (
    <div className="tools-module-shell">
      <div className="tools-module-head">
        <div>
          <p className="tools-module-kicker">Herramientas</p>
          <h2>{moduleConfig.title}</h2>
          <p>{moduleConfig.subtitle}</p>
        </div>
        <div className={`tools-connection-indicator ${isOnline ? 'is-online' : 'is-offline'}`}>
          <span className="tools-connection-dot" />
          {isOnline ? 'Con internet' : 'Sin internet'}
        </div>
      </div>

      <div className="tools-section-tabs" role="tablist" aria-label="Herramientas offline">
        {TOOLS_MODULES.map((module) => (
          <button
            key={module.id}
            type="button"
            className={`tools-tab-button${module.id === pageId ? ' active' : ''}`}
            onClick={() => {
              window.location.hash = module.id;
            }}
          >
            {module.label}
          </button>
        ))}
      </div>

      {section === 'sync' ? (
        <div className="tools-grid">
          <div className="card tools-panel">
            <div className="tools-panel-head">
              <div>
                <p className="tools-panel-kicker">Offline</p>
                <h3>Sincronizar articulos</h3>
              </div>
            </div>
            <p className="tools-panel-copy">Permite descargar articulos para consultar codigo, descripcion y precio sin conexion.</p>
            <div className="tools-actions-row">
              <button className="btn btn-primary" type="button" onClick={handleSync} disabled={!isOnline || isSyncing}>
                {isSyncing ? 'Sincronizando articulos...' : 'Sincronizar articulos'}
              </button>
              <span>Los datos se guardan en este navegador.</span>
            </div>
            {feedback ? <div className={`alert ${feedback.includes('No se pudo') ? 'alert-warning' : 'alert-info'}`}>{feedback}</div> : null}
          </div>

          <article className="tools-summary-card"><span>Ultima sincronizacion</span><strong>{meta.lastSyncAt ? new Date(meta.lastSyncAt).toLocaleString('es-AR') : 'Sin sincronizar'}</strong></article>
          <article className="tools-summary-card"><span>Articulos descargados</span><strong>{catalog.length}</strong></article>
          <article className="tools-summary-card"><span>Estado de red</span><strong>{isOnline ? 'Online' : 'Offline'}</strong></article>
        </div>
      ) : null}

      {section === 'offline-prices' ? (
        <div className="card tools-panel">
          <div className="tools-panel-head">
            <div>
              <p className="tools-panel-kicker">Offline</p>
              <h3>Consultar precios offline</h3>
            </div>
            <input value={search} onChange={(event: ChangeEvent<HTMLInputElement>) => setSearch(event.target.value)} placeholder="Buscar por codigo o descripcion..." />
          </div>
          <table className="products-table">
            <thead>
              <tr>
                <th>Codigo</th>
                <th>Codigo de barras</th>
                <th>Descripcion</th>
                <th>Precio</th>
              </tr>
            </thead>
            <tbody>
              {filteredCatalog.length === 0 ? (
                <tr><td colSpan={4} className="tools-empty-row">No hay articulos offline para mostrar.</td></tr>
              ) : (
                filteredCatalog.slice(0, 60).map((item) => (
                  <tr key={item.id}>
                    <td>{item.code}</td>
                    <td>{item.barcode || '-'}</td>
                    <td>{item.description}</td>
                    <td>{formatMoney(item.price)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      ) : null}

      {section === 'sync-status' ? (
        <div className="tools-grid">
          <article className="tools-summary-card"><span>Sincronizacion</span><strong>{catalog.length > 0 ? 'Disponible' : 'Pendiente'}</strong></article>
          <article className="tools-summary-card"><span>Articulos guardados</span><strong>{catalog.length}</strong></article>
          <article className="tools-summary-card"><span>Ultima sincronizacion</span><strong>{meta.lastSyncAt ? new Date(meta.lastSyncAt).toLocaleString('es-AR') : 'Sin registro'}</strong></article>
          <article className="tools-summary-card"><span>Navegador</span><strong>Este equipo</strong></article>
        </div>
      ) : null}
    </div>
  );
}
