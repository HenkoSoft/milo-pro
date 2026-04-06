"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.woocommerceRequest = woocommerceRequest;
exports.wordpressRequest = wordpressRequest;
const woocommerce_sync_utils_1 = require("./woocommerce-sync-utils");
function encodeBasicAuth(username, password) {
    if (typeof globalThis.btoa === 'function') {
        return globalThis.btoa(`${username}:${password}`);
    }
    return `${username}:${password}`;
}
function woocommerceRequest(method, apiPath, data, config, requestOptions, getActiveWooConfig, transportResolver) {
    return new Promise((resolve, reject) => {
        const activeConfig = config || getActiveWooConfig();
        if (!activeConfig || !activeConfig.store_url) {
            reject(new Error('WooCommerce not configured'));
            return;
        }
        const timeoutMs = Math.max(1000, Number(requestOptions?.timeout_ms || 15000));
        const url = new URL(String(activeConfig.store_url));
        const transport = transportResolver(url);
        const auth = encodeBasicAuth(String(activeConfig.consumer_key ?? ''), String(activeConfig.consumer_secret ?? ''));
        const options = {
            hostname: url.hostname,
            port: (0, woocommerce_sync_utils_1.getPort)(url),
            path: (0, woocommerce_sync_utils_1.buildApiPath)(url, apiPath, activeConfig),
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
                    }
                    catch {
                        resolve(body);
                    }
                    return;
                }
                try {
                    const parsed = JSON.parse(body);
                    reject(new Error(`WooCommerce API Error ${res.statusCode}: ${parsed.message || body}`));
                }
                catch {
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
    });
}
function wordpressRequest(method, apiPath, body, headers, config, getActiveWooConfig, transportResolver) {
    return new Promise((resolve, reject) => {
        const activeConfig = config || getActiveWooConfig();
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
        const options = {
            hostname: url.hostname,
            port: (0, woocommerce_sync_utils_1.getPort)(url),
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
                    }
                    catch {
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
        if (body)
            req.write(body);
        req.end();
    });
}
