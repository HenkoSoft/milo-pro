export function canImportFromWoo(config: Record<string, unknown> | null) {
  return Boolean(config && config.store_url && config.sync_direction !== 'export');
}

type PollingOptions = {
  pollingIntervalMs?: number;
  getConfig: () => Promise<Record<string, unknown> | null> | Record<string, unknown> | null;
  fetchWooProducts: () => Promise<unknown[]>;
  hydrateWooProduct: (wooProduct: Record<string, unknown>) => Promise<Record<string, unknown>>;
  upsertWooProduct: (wooProduct: Record<string, unknown>, action: string) => Promise<Record<string, unknown>>;
  markLastSync: () => Promise<void>;
  persist: () => Promise<void>;
  log?: { log: (...args: unknown[]) => void; error: (...args: unknown[]) => void };
};

export function createWooPollingManager(options: PollingOptions) {
  const {
    pollingIntervalMs = 30000,
    getConfig,
    fetchWooProducts,
    hydrateWooProduct,
    upsertWooProduct,
    markLastSync,
    persist,
    log = console
  } = options;

  let pollingInterval: any = null;
  let pollingInFlight = false;

  async function importWooProducts({ action }: { action: string }) {
    const config = await getConfig();
    if (!canImportFromWoo(config)) {
      return { imported: 0, updated: 0, unchanged: 0, total: 0 };
    }

    const wooProducts = await fetchWooProducts();
    if (!Array.isArray(wooProducts)) {
      throw new Error('No se pudieron obtener productos de WooCommerce');
    }

    let imported = 0;
    let updated = 0;
    let unchanged = 0;

    for (const wooProduct of wooProducts) {
      const hydratedProduct = await hydrateWooProduct(wooProduct as Record<string, unknown>);
      const result = await upsertWooProduct(hydratedProduct, action) as { imported?: boolean; updated?: boolean; unchanged?: boolean };
      imported += result.imported ? 1 : 0;
      updated += result.updated ? 1 : 0;
      unchanged += result.unchanged ? 1 : 0;
    }

    await markLastSync();
    if (imported > 0 || updated > 0) {
      await persist();
    }

    return {
      imported,
      updated,
      unchanged,
      total: wooProducts.length
    };
  }

  async function pollWooCommerce(action = 'polling_import') {
    if (pollingInFlight) {
      return;
    }

    pollingInFlight = true;
    try {
      const result = await importWooProducts({ action });
      if (result.imported > 0 || result.updated > 0) {
        log.log(`[WOO-POLLING] Imported ${result.imported}, updated ${result.updated}`);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      log.error('[WOO-POLLING] Error:', message);
    } finally {
      pollingInFlight = false;
    }
  }

  function stopWooPolling(reason = 'manual') {
    if (pollingInterval) {
      clearInterval(pollingInterval);
      pollingInterval = null;
      log.log(`[WOO-POLLING] Polling stopped (${reason})`);
    }
  }

  async function startWooPolling({ manual = false }: { manual?: boolean } = {}) {
    const config = await getConfig();
    if (!config || !config.store_url) {
      return { success: false, error: 'WooCommerce not configured' };
    }

    if (!canImportFromWoo(config)) {
      return { success: false, error: 'Polling disabled: sync direction is export only' };
    }

    if (pollingInterval) {
      return { success: true, alreadyRunning: true, interval_seconds: pollingIntervalMs / 1000 };
    }

    log.log('[WOO-POLLING] Starting polling interval...');
    void pollWooCommerce(manual ? 'manual_polling_import' : 'auto_polling_import');
    pollingInterval = setInterval(() => {
      void pollWooCommerce('polling_import');
    }, pollingIntervalMs);

    return { success: true, interval_seconds: pollingIntervalMs / 1000 };
  }

  async function initializeWooAutomation() {
    const config = await getConfig();
    if (config && canImportFromWoo(config)) {
      return startWooPolling({ manual: false });
    }

    stopWooPolling('startup_config');
    return { success: true, active: false };
  }

  function isPollingActive() {
    return pollingInterval !== null;
  }

  function getPollingIntervalSeconds() {
    return pollingIntervalMs / 1000;
  }

  return {
    canImportFromWoo,
    getPollingIntervalSeconds,
    importWooProducts,
    initializeWooAutomation,
    isPollingActive,
    pollWooCommerce,
    startWooPolling,
    stopWooPolling
  };
}
