function canImportFromWoo(config) {
  return Boolean(config && config.store_url && config.sync_direction !== 'export');
}

function createWooPollingManager(options) {
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

  let pollingInterval = null;
  let pollingInFlight = false;

  async function importWooProducts({ action }) {
    const config = getConfig();
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
      const hydratedProduct = await hydrateWooProduct(wooProduct);
      const result = await upsertWooProduct(hydratedProduct, action);
      imported += result.imported ? 1 : 0;
      updated += result.updated ? 1 : 0;
      unchanged += result.unchanged ? 1 : 0;
    }

    markLastSync();
    if (imported > 0 || updated > 0) {
      persist();
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
      log.error('[WOO-POLLING] Error:', error.message);
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

  function startWooPolling({ manual = false } = {}) {
    const config = getConfig();
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
    pollWooCommerce(manual ? 'manual_polling_import' : 'auto_polling_import');
    pollingInterval = setInterval(() => {
      pollWooCommerce('polling_import');
    }, pollingIntervalMs);

    return { success: true, interval_seconds: pollingIntervalMs / 1000 };
  }

  function initializeWooAutomation() {
    const config = getConfig();
    if (config && canImportFromWoo(config)) {
      startWooPolling({ manual: false });
    } else {
      stopWooPolling('startup_config');
    }
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

module.exports = {
  canImportFromWoo,
  createWooPollingManager
};
