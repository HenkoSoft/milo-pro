const {
  buildApiPath,
  getPort,
  getTransport
} = require('./woocommerce-sync-utils');

function woocommerceRequest(method, apiPath, data = null, config = null, requestOptions = null, getActiveWooConfig) {
  return new Promise((resolve, reject) => {
    const activeConfig = config || getActiveWooConfig();
    if (!activeConfig || !activeConfig.store_url) {
      return reject(new Error('WooCommerce not configured'));
    }

    const timeoutMs = Math.max(1000, Number((requestOptions && requestOptions.timeout_ms) || process.env.WOO_REQUEST_TIMEOUT_MS || 15000));
    const url = new URL(activeConfig.store_url);
    const transport = getTransport(url);
    const auth = Buffer.from(`${activeConfig.consumer_key}:${activeConfig.consumer_secret}`).toString('base64');
    const options = {
      hostname: url.hostname,
      port: getPort(url),
      path: buildApiPath(url, apiPath, activeConfig),
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
          if (!body) return resolve(null);
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

    req.setTimeout(timeoutMs, () => {
      req.destroy(new Error('WooCommerce request timed out'));
    });

    req.on('error', reject);

    if (data) {
      req.write(JSON.stringify(data));
    }

    req.end();
  });
}

function wordpressRequest(method, apiPath, body = null, headers = {}, config = null, getActiveWooConfig) {
  return new Promise((resolve, reject) => {
    const activeConfig = config || getActiveWooConfig();
    if (!activeConfig || !activeConfig.store_url) {
      return reject(new Error('WooCommerce not configured'));
    }
    if (!activeConfig.wp_username || !activeConfig.wp_app_password) {
      return reject(new Error('Faltan credenciales profesionales de WordPress para subir imagenes.'));
    }

    const url = new URL(activeConfig.store_url);
    const transport = getTransport(url);
    const auth = Buffer.from(`${activeConfig.wp_username}:${activeConfig.wp_app_password}`).toString('base64');
    const basePath = url.pathname && url.pathname !== '/' ? url.pathname.replace(/\/$/, '') : '';
    const normalizedApiPath = apiPath.startsWith('/') ? apiPath : `/${apiPath}`;
    const options = {
      hostname: url.hostname,
      port: getPort(url),
      path: `${basePath}${normalizedApiPath}`,
      method,
      headers: {
        Authorization: `Basic ${auth}`,
        ...headers
      }
    };

    const req = transport.request(options, (res) => {
      let responseBody = '';
      res.on('data', (chunk) => {
        responseBody += chunk;
      });
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          if (!responseBody) return resolve(null);
          try {
            resolve(JSON.parse(responseBody));
          } catch (error) {
            resolve(responseBody);
          }
          return;
        }
        reject(new Error(`WordPress API Error ${res.statusCode}: ${responseBody}`));
      });
    });

    req.setTimeout(20000, () => {
      req.destroy(new Error('WordPress request timed out'));
    });
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

module.exports = {
  woocommerceRequest,
  wordpressRequest
};
