const express = require('express');
const crypto = require('crypto');
const https = require('https');
const { get, run, all, saveDatabase } = require('../database');
const { authenticate } = require('../auth');

const router = express.Router();

function woocommerceRequest(method, path, data = null) {
  return new Promise((resolve, reject) => {
    const config = get('SELECT * FROM woocommerce_sync WHERE id = 1 AND active = 1');
    if (!config || !config.store_url) {
      return reject(new Error('WooCommerce not configured'));
    }

    const url = new URL(config.store_url);
    const consumerKey = config.consumer_key;
    const consumerSecret = config.consumer_secret;
    
    const auth = Buffer.from(`${consumerKey}:${consumerSecret}`).toString('base64');
    
    const options = {
      hostname: url.hostname,
      port: 443,
      path: `/wp-json/wc/v3${path}`,
      method: method,
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/json'
      }
    };

    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(body));
        } catch {
          resolve(body);
        }
      });
    });

    req.on('error', reject);
    if (data) req.write(JSON.stringify(data));
    req.end();
  });
}

router.get('/status', authenticate, (req, res) => {
  const config = get('SELECT * FROM woocommerce_sync WHERE id = 1');
  if (!config || !config.store_url) {
    return res.json({ connected: false, message: 'WooCommerce not configured' });
  }
  
  res.json({
    connected: true,
    store_url: config.store_url,
    sync_direction: config.sync_direction,
    last_sync: config.last_sync,
    auto_sync: config.auto_sync
  });
});

router.get('/test', authenticate, async (req, res) => {
  try {
    const result = await woocommerceRequest('GET', '/system_status');
    if (result.environment) {
      res.json({ success: true, store: result.environment.site_url });
    } else {
      res.status(400).json({ success: false, error: 'Connection failed' });
    }
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

router.put('/config', authenticate, async (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Solo el administrador puede modificar configuraciones' });
  }

  const { store_url, consumer_key, consumer_secret, sync_direction, auto_sync } = req.body;

  const existing = get('SELECT * FROM woocommerce_sync WHERE id = 1');
  
  if (existing) {
    run(`UPDATE woocommerce_sync SET 
      store_url = ?, consumer_key = ?, consumer_secret = ?, 
      sync_direction = ?, auto_sync = ?, active = 1 
      WHERE id = 1`,
      [store_url, consumer_key, consumer_secret, sync_direction || 'both', auto_sync ? 1 : 0]);
  } else {
    run(`INSERT INTO woocommerce_sync (id, store_url, consumer_key, consumer_secret, sync_direction, auto_sync) 
      VALUES (1, ?, ?, ?, ?, ?)`,
      [store_url, consumer_key, consumer_secret, sync_direction || 'both', auto_sync ? 1 : 0]);
  }
  
  saveDatabase();
  res.json({ success: true });
});

router.post('/sync', authenticate, async (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Transfer-Encoding', 'chunked');
  
  const sendProgress = (data) => {
    res.write(JSON.stringify(data) + '\n');
  };
  
  try {
    const config = get('SELECT * FROM woocommerce_sync WHERE id = 1');
    if (!config || !config.store_url) {
      sendProgress({ error: 'WooCommerce not configured', done: true });
      return res.end();
    }

    const results = { imported: 0, exported: 0, updated: 0, errors: [], total: 0, processed: 0 };
    let totalProducts = 0;

    const isImport = config.sync_direction === 'both' || config.sync_direction === 'import';
    const isExport = config.sync_direction === 'both' || config.sync_direction === 'export';
    const syncLabel = isImport && isExport ? 'Sincronizando' : (isImport ? 'Importando' : 'Exportando');
    const syncAction = isImport && isExport ? 'Actualizando' : (isImport ? 'Importando' : 'Exportando');

    if (isImport) {
      sendProgress({ status: `${syncLabel} desde WooCommerce...`, progress: 0 });
      const wooProducts = await woocommerceRequest('GET', '/products?per_page=100');
      
      if (Array.isArray(wooProducts)) {
        totalProducts = wooProducts.length;
        results.total = totalProducts;
        
        for (let i = 0; i < wooProducts.length; i++) {
          const wooProduct = wooProducts[i];
          let existing = null;
          try {
            const imageUrl = wooProduct.images && wooProduct.images.length > 0 ? wooProduct.images[0].src : null;
            
            existing = get('SELECT id FROM products WHERE woocommerce_id = ?', [wooProduct.id]);
            if (!existing && wooProduct.sku) {
              existing = get('SELECT id FROM products WHERE sku = ?', [wooProduct.sku]);
            }
            if (!existing) {
              existing = get('SELECT id FROM products WHERE sku = ?', [`WOO-${wooProduct.id}`]);
            }
            
            if (existing) {
              run(`UPDATE products SET name = ?, description = ?, sale_price = ?, stock = ?, image_url = ?, woocommerce_id = ? WHERE id = ?`,
                [wooProduct.name, wooProduct.description, parseFloat(wooProduct.price), wooProduct.stock_quantity || 0, imageUrl, wooProduct.id, existing.id]);
              results.updated++;
            } else {
              run(`INSERT INTO products (sku, name, description, sale_price, stock, image_url, woocommerce_id) VALUES (?, ?, ?, ?, ?, ?, ?)`,
                [wooProduct.sku || `WOO-${wooProduct.id}`, wooProduct.name, wooProduct.description, parseFloat(wooProduct.price), wooProduct.stock_quantity || 0, imageUrl, wooProduct.id]);
              results.imported++;
            }
            
            run(`INSERT INTO product_sync_log (milo_id, woocommerce_id, action, status, message) VALUES (?, ?, ?, ?, ?)`,
              [existing?.id || null, wooProduct.id, 'import', 'success', 'Imported from WooCommerce']);
          } catch (err) {
            results.errors.push(`Product ${wooProduct.id}: ${err.message}`);
          }
          
          results.processed = i + 1;
          const progress = Math.round(((i + 1) / wooProducts.length) * 50);
          try {
            const importLabel = existing ? 'Actualizando' : 'Importando';
            sendProgress({ status: `${importLabel}: ${wooProduct.name}`, progress, results });
          } catch (e) {
            sendProgress({ status: `Procesando: ${wooProduct.name}`, progress, results });
          }
        }
      } else {
        sendProgress({ error: 'No se pudieron obtener productos de WooCommerce', done: true });
        return res.end();
      }
    }

    if (isExport) {
      const techProducts = all('SELECT * FROM products');
      totalProducts = techProducts.length;
      
      sendProgress({ status: `${syncLabel} hacia WooCommerce...`, progress: 50 });
      
      for (let i = 0; i < techProducts.length; i++) {
        const product = techProducts[i];
        try {
          const sku = product.sku || `TF-${product.id}`;
          
          if (product.woocommerce_id) {
            await woocommerceRequest('PUT', `/products/${product.woocommerce_id}`, {
              name: product.name,
              description: product.description,
              regular_price: product.sale_price.toString(),
              stock_quantity: product.stock
            });
            results.updated++;
          } else {
            const wooProduct = await woocommerceRequest('POST', '/products', {
              name: product.name,
              description: product.description,
              regular_price: product.sale_price.toString(),
              stock_quantity: product.stock,
              sku: sku,
              status: 'publish'
            });
            
            if (wooProduct && wooProduct.id) {
              run('UPDATE products SET woocommerce_id = ? WHERE id = ?', [wooProduct.id, product.id]);
            }
            results.exported++;
          }
          
          run(`INSERT INTO product_sync_log (milo_id, woocommerce_id, action, status, message) VALUES (?, ?, ?, ?, ?)`,
            [product.id, product.woocommerce_id, 'export', 'success', 'Exported to WooCommerce']);
        } catch (err) {
          results.errors.push(`Milo Product ${product.id}: ${err.message || 'Unknown error'}`);
        }
        
        results.processed = i + 1;
        const progress = 50 + Math.round(((i + 1) / techProducts.length) * 50);
        sendProgress({ status: `${syncAction}: ${product.name}`, progress, results });
      }
    }

    run('UPDATE woocommerce_sync SET last_sync = CURRENT_TIMESTAMP WHERE id = 1');
    saveDatabase();
    
    sendProgress({ status: 'Sincronización completada', progress: 100, results, done: true });
    res.end();
  } catch (err) {
    sendProgress({ error: err.message, done: true });
    res.end();
  }
});

router.post('/sync-product/:id', authenticate, async (req, res) => {
  try {
    const product = get('SELECT * FROM products WHERE id = ?', [req.params.id]);
    if (!product) return res.status(404).json({ error: 'Product not found' });

    const sku = product.sku || `TF-${product.id}`;
    
    if (product.woocommerce_id) {
      const result = await woocommerceRequest('PUT', `/products/${product.woocommerce_id}`, {
        name: product.name,
        description: product.description,
        regular_price: product.sale_price.toString(),
        stock_quantity: product.stock,
        manage_stock: true,
        stock_status: product.stock > 0 ? 'instock' : 'outofstock'
      });
      res.json({ success: true, action: 'updated', woocommerce_id: result.id });
    } else {
      const result = await woocommerceRequest('POST', '/products', {
        name: product.name,
        description: product.description,
        regular_price: product.sale_price.toString(),
        stock_quantity: product.stock,
        manage_stock: true,
        stock_status: product.stock > 0 ? 'instock' : 'outofstock',
        sku: sku,
        status: 'publish'
      });
      
      if (result && result.id) {
        run('UPDATE products SET woocommerce_id = ? WHERE id = ?', [result.id, product.id]);
        saveDatabase();
      }
      
      res.json({ success: true, action: 'created', woocommerce_id: result.id });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/logs', authenticate, (req, res) => {
  const logs = all('SELECT * FROM product_sync_log ORDER BY synced_at DESC LIMIT 50');
  res.json(logs);
});

router.delete('/disconnect', authenticate, (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Solo el administrador puede modificar configuraciones' });
  }
  
  run('DELETE FROM woocommerce_sync WHERE id = 1');
  saveDatabase();
  res.json({ success: true });
});

module.exports = router;
