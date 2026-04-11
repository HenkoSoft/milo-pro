import { buildApiPath, getPort } from './woocommerce-sync-utils';

type WooSyncConfigLike = {
  store_url?: string | null;
  consumer_key?: string | null;
  consumer_secret?: string | null;
  wp_username?: string | null;
  wp_app_password?: string | null;
  api_version?: string | null;
};

interface TransportLike {
  request: (options: RequestOptions, callback: (response: ResponseLike) => void) => RequestHandle;
}

interface RequestOptions {
  hostname: string;
  port: number;
  path: string;
  method: string;
  headers: Record<string, string | number>;
}

interface ResponseLike {
  statusCode?: number;
  on: (event: string, listener: (chunk?: string) => void) => void;
}

interface RequestHandle {
  setTimeout: (timeoutMs: number, listener: () => void) => void;
  on: (event: string, listener: (error: Error) => void) => void;
  write: (chunk: string | ArrayBufferLike) => void;
  end: () => void;
  destroy: (error?: Error) => void;
}

function encodeBasicAuth(username: string, password: string): string {
  if (typeof globalThis.btoa === 'function') {
    return globalThis.btoa(`${username}:${password}`);
  }
  return `${username}:${password}`;
}

export function woocommerceRequest(
  method: string,
  apiPath: string,
  data: unknown,
  config: WooSyncConfigLike | null,
  requestOptions: { timeout_ms?: number } | null,
  getActiveWooConfig: () => WooSyncConfigLike | Promise<WooSyncConfigLike | null | undefined> | null | undefined,
  transportResolver: (url: URL) => TransportLike
): Promise<unknown> {
  return Promise.resolve(config || getActiveWooConfig()).then((activeConfig) => new Promise((resolve, reject) => {
    if (!activeConfig || !activeConfig.store_url) {
      reject(new Error('WooCommerce not configured'));
      return;
    }

    const timeoutMs = Math.max(1000, Number(requestOptions?.timeout_ms || 15000));
    const url = new URL(String(activeConfig.store_url));
    const transport = transportResolver(url);
    const auth = encodeBasicAuth(String(activeConfig.consumer_key ?? ''), String(activeConfig.consumer_secret ?? ''));
    const options: RequestOptions = {
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
        body += String(chunk ?? '');
      });
      res.on('end', () => {
        if ((res.statusCode || 0) >= 200 && (res.statusCode || 0) < 300) {
          if (!body) {
            resolve(null);
            return;
          }
          try {
            resolve(JSON.parse(body));
          } catch {
            resolve(body);
          }
          return;
        }

        try {
          const parsed = JSON.parse(body) as { message?: string };
          reject(new Error(`WooCommerce API Error ${res.statusCode}: ${parsed.message || body}`));
        } catch {
          reject(new Error(`WooCommerce API Error ${res.statusCode}: ${body}`));
        }
      });
    });

    req.setTimeout(timeoutMs, () => {
      req.destroy(new Error('WooCommerce request timed out'));
    });

    req.on('error', reject);

    if (data !== undefined && data !== null) {
      req.write(JSON.stringify(data));
    }

    req.end();
  }));
}

export function wordpressRequest(
  method: string,
  apiPath: string,
  body: string | ArrayBufferLike | null,
  headers: Record<string, string | number>,
  config: WooSyncConfigLike | null,
  getActiveWooConfig: () => WooSyncConfigLike | Promise<WooSyncConfigLike | null | undefined> | null | undefined,
  transportResolver: (url: URL) => TransportLike
): Promise<unknown> {
  return Promise.resolve(config || getActiveWooConfig()).then((activeConfig) => new Promise((resolve, reject) => {
    if (!activeConfig || !activeConfig.store_url) {
      reject(new Error('WooCommerce not configured'));
      return;
    }
    if (!activeConfig.wp_username || !activeConfig.wp_app_password) {
      reject(new Error('Faltan credenciales profesionales de WordPress para subir imagenes.'));
      return;
    }

    const url = new URL(String(activeConfig.store_url));
    const transport = transportResolver(url);
    const auth = encodeBasicAuth(String(activeConfig.wp_username), String(activeConfig.wp_app_password));
    const basePath = url.pathname && url.pathname !== '/' ? url.pathname.replace(/\/$/, '') : '';
    const normalizedApiPath = apiPath.startsWith('/') ? apiPath : `/${apiPath}`;
    const options: RequestOptions = {
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
        responseBody += String(chunk ?? '');
      });
      res.on('end', () => {
        if ((res.statusCode || 0) >= 200 && (res.statusCode || 0) < 300) {
          if (!responseBody) {
            resolve(null);
            return;
          }
          try {
            resolve(JSON.parse(responseBody));
          } catch {
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
  }));
}
