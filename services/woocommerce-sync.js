const http = require('http');
const https = require('https');
const { get, run, saveDatabase } = require('../database');

function getActiveWooConfig() {
  return get('SELECT * FROM woocommerce_sync WHERE id = 1 AND active = 1');
}

function isWooExportEnabled(config = getActiveWooConfig()) {
  return Boolean(config && config.store_url && config.sync_direction !== 'import');
}

function getTransport(url) {
  return url.protocol === 'http:' ? http : https;
}

function getPort(url) {
  if (url.port) {
    return Number(url.port);
  }

  return url.protocol === 'http:' ? 80 : 443;
}

function buildApiPath(url, apiPath) {
  const basePath = url.pathname && url.pathname !== '/' ? url.pathname.replace(/\/$/, '') : '';
  const normalizedApiPath = apiPath.startsWith('/') ? apiPath : `/${apiPath}`;
  return `${basePath}/wp-json/wc/v3${normalizedApiPath}`;
}

function normalizeStock(value) {
  const stock = Number.parseInt(value, 10);
  return Number.isFinite(stock) ? stock : 0;
}

function normalizePrice(value) {
  const price = Number(value);
  return Number.isFinite(price) ? price.toString() : '0';
}

function buildWooProductPayload(product) {
  const sku = product.sku || `TF-${product.id}`;
  const stockQuantity = normalizeStock(product.stock);

  return {
    name: product.name || `Producto ${product.id}`,
    description: product.description || '',
    regular_price: normalizePrice(product.sale_price),
    stock_quantity: stockQuantity,
    manage_stock: true,
    stock_status: stockQuantity > 0 ? 'instock' : 'outofstock',
    sku,
    status: 'publish'
  };
}

function insertSyncLog(product, action, status, message) {
  run(
    'INSERT INTO product_sync_log (milo_id, woocommerce_id, action, status, message) VALUES (?, ?, ?, ?, ?)',
    [product?.id || null, product?.woocommerce_id || null, action, status, message]
  );
}

function woocommerceRequest(method, apiPath, data = null, config = null) {
  return new Promise((resolve, reject) => {
    const activeConfig = config || getActiveWooConfig();
    if (!activeConfig || !activeConfig.store_url) {
      return reject(new Error('WooCommerce not configured'));
    }

    const url = new URL(activeConfig.store_url);
    const transport = getTransport(url);
    const auth = Buffer.from(`${activeConfig.consumer_key}:${activeConfig.consumer_secret}`).toString('base64');
    const options = {
      hostname: url.hostname,
      port: getPort(url),
      path: buildApiPath(url, apiPath),
      method,
      headers: {
        Authorization: `Basic ${auth}`,
        'Content-Type': 'application/json'
      }
    };

    const req = transport.request(options, (res) => {
      let body = '';

      res.on('data', (chunk) => {
        body += chunk;
      });

      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          if (!body) {
            return resolve(null);
          }

          try {
            resolve(JSON.parse(body));
          } catch (error) {
            resolve(body);
          }
          return;
        }

        try {
          const parsed = JSON.parse(body);
          reject(new Error(`WooCommerce API Error ${res.statusCode}: ${parsed.message || body}`));
        } catch (error) {
          reject(new Error(`WooCommerce API Error ${res.statusCode}: ${body}`));
        }
      });
    });

    req.setTimeout(15000, () => {
      req.destroy(new Error('WooCommerce request timed out'));
    });

    req.on('error', reject);

    if (data) {
      req.write(JSON.stringify(data));
    }

    req.end();
  });
}

async function findWooProductBySku(config, sku) {
  if (!sku) {
    return null;
  }

  const result = await woocommerceRequest(
    'GET',
    `/products?sku=${encodeURIComponent(sku)}&per_page=1`,
    null,
    config
  );

  return Array.isArray(result) && result.length > 0 ? result[0] : null;
}

async function syncProductSnapshotToWooCommerce(productSnapshot, options = {}) {
  const {
    action = 'sale_sync',
    persistChanges = true,
    retries = 2
  } = options;

  if (!productSnapshot || !productSnapshot.id) {
    throw new Error('Producto inva;lido para sincronizar');
  }

  const config = getActiveWooConfig();
  if (!isWooExportEnabled(config)) {
    return {
      success: true,
      skipped: true,
      productId: productSnapshot.id
    };
  }

  let lastError = null;

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      const latestProduct = get('SELECT * FROM products WHERE id = ?', [productSnapshot.id]) || productSnapshot;
      const product = {
        ...latestProduct,
        ...productSnapshot
      };
      const payload = buildWooProductPayload(product);

      let wooProductId = product.woocommerce_id || null;
      if (!wooProductId) {
        const bySku = await findWooProductBySku(config, payload.sku);
        if (bySku && bySku.id) {
          wooProductId = bySku.id;
        }
      }

      const endpoint = wooProductId ? `/products/${wooProductId}` : '/products';
      const method = wooProductId ? 'PUT' : 'POST';
      const result = await woocommerceRequest(method, endpoint, payload, config);

      if (!result || !result.id) {
        throw new Error('WooCommerce no devolvio un ID de producto');
      }

      if (result.id !== product.woocommerce_id) {
        run('UPDATE products SET woocommerce_id = ? WHERE id = ?', [result.id, product.id]);
      }

      run('UPDATE woocommerce_sync SET last_sync = CURRENT_TIMESTAMP WHERE id = 1');
      insertSyncLog(
        { ...product, woocommerce_id: result.id },
        action,
        'success',
        `${method === 'POST' ? 'Creado' : 'Actualizado'} en WooCommerce`
      );

      if (persistChanges) {
        saveDatabase();
      }

      return {
        success: true,
        action: method === 'POST' ? 'created' : 'updated',
        productId: product.id,
        woocommerce_id: result.id
      };
    } catch (error) {
      lastError = error;
      if (attempt < retries) {
        await new Promise((resolve) => setTimeout(resolve, 300 * (attempt + 1)));
      }
    }
  }

  insertSyncLog(productSnapshot, action, 'error', lastError.message);
  if (persistChanges) {
    saveDatabase();
  }

  return {
    success: false,
    productId: productSnapshot.id,
    error: lastError.message
  };
}

async function syncProductToWooCommerce(productId, options = {}) {
  const product = get('SELECT * FROM products WHERE id = ?', [productId]);
  if (!product) {
    return {
      success: false,
      productId,
      error: 'Producto no encontrado'
    };
  }

  return syncProductSnapshotToWooCommerce(product, options);
}

module.exports = {
  buildWooProductPayload,
  getActiveWooConfig,
  isWooExportEnabled,
  syncProductSnapshotToWooCommerce,
  syncProductToWooCommerce,
  woocommerceRequest
};
