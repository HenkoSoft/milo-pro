const express = require('express');
const https = require('https');
const { get, run, all, saveDatabase } = require('../database');
const { authenticate } = require('../auth');

const router = express.Router();

async function syncToWooCommerce(product) {
  const config = get('SELECT * FROM woocommerce_sync WHERE id = 1 AND active = 1');
  
  console.log('[WOO] syncToWooCommerce called for:', product.name);
  console.log('[WOO] Config:', config ? { store_url: config.store_url, sync_direction: config.sync_direction, active: config.active } : 'NO CONFIG');
  
  if (!config || !config.store_url) {
    console.log('[WOO] WooCommerce no configurado - skipping sync');
    return { success: false, error: 'WooCommerce no configurado' };
  }
  
  if (config.sync_direction === 'import') {
    console.log('[WOO] Sync direction is import only - skipping export');
    return { success: false, error: 'Sincronización configurada solo como import' };
  }
  
  try {
    const url = new URL(config.store_url);
    const auth = Buffer.from(`${config.consumer_key}:${config.consumer_secret}`).toString('base64');
    
    const sku = product.sku || `TF-${product.id}`;
    
    let wooProductId = product.woocommerce_id;
    
    if (!wooProductId && sku) {
      try {
        const searchResult = await new Promise((resolve, reject) => {
          const searchOptions = {
            hostname: url.hostname,
            port: 443,
            path: `/wp-json/wc/v3/products?sku=${encodeURIComponent(sku)}&per_page=1`,
            method: 'GET',
            headers: { 'Authorization': `Basic ${auth}`, 'Content-Type': 'application/json' }
          };
          const req = https.request(searchOptions, (res) => {
            let body = '';
            res.on('data', chunk => body += chunk);
            res.on('end', () => {
              if (res.statusCode === 200) {
                try {
                  resolve(JSON.parse(body));
                } catch { resolve([]); }
              } else {
                resolve([]);
              }
            });
          });
          req.on('error', () => resolve([]));
          req.end();
        });
        
        if (searchResult && searchResult.length > 0) {
          wooProductId = searchResult[0].id;
          console.log('[WOO] Found existing product by SKU, WooCommerce ID:', wooProductId);
        }
      } catch (e) {
        console.log('[WOO] SKU search error:', e.message);
      }
    }
    
    const productData = {
      name: product.name,
      description: product.description || '',
      regular_price: product.sale_price?.toString() || '0',
      stock_quantity: product.stock || 0,
      manage_stock: true,
      stock_status: (product.stock || 0) > 0 ? 'instock' : 'outofstock',
      sku: sku,
      status: 'publish'
    };
    
    const wooPath = wooProductId 
      ? `/wp-json/wc/v3/products/${wooProductId}` 
      : '/wp-json/wc/v3/products';
    
    const method = wooProductId ? 'PUT' : 'POST';
    
    const options = {
      hostname: url.hostname,
      port: 443,
      path: wooPath,
      method: method,
      headers: { 'Authorization': `Basic ${auth}`, 'Content-Type': 'application/json' }
    };
    
    console.log('[WOO] Request options:', options);
    console.log('[WOO] Product data:', productData);
    
    const result = await new Promise((resolve, reject) => {
      const req = https.request(options, (res) => {
        let body = '';
        res.on('data', chunk => body += chunk);
        res.on('end', () => {
          console.log('[WOO] Response status:', res.statusCode);
          console.log('[WOO] Response body:', body.substring(0, 500));
          if (res.statusCode >= 200 && res.statusCode < 300) {
            try {
              resolve(JSON.parse(body));
            } catch {
              resolve(null);
            }
          } else {
            reject(new Error(`HTTP ${res.statusCode}: ${body}`));
          }
        });
      });
      req.on('error', (e) => {
        console.log('[WOO] Request error:', e.message);
        reject(e);
      });
      req.write(JSON.stringify(productData));
      req.end();
    });
    
    console.log('[WOO] Result:', result);
    
    if (result && result.id) {
      if (!product.woocommerce_id && wooProductId) {
        run('UPDATE products SET woocommerce_id = ? WHERE id = ?', [wooProductId, product.id]);
      } else if (result.id !== product.woocommerce_id) {
        run('UPDATE products SET woocommerce_id = ? WHERE id = ?', [result.id, product.id]);
      }
      saveDatabase();
      return { success: true, woocommerce_id: result.id };
    }
    
    return { success: false, error: 'No se pudo crear producto en WooCommerce' };
  } catch (e) {
    return { success: false, error: e.message };
  }
}


router.get('/', authenticate, (req, res) => {
  const { search, category, lowStock } = req.query;
  
  let query = `
    SELECT p.*, c.name as category_name 
    FROM products p 
    LEFT JOIN categories c ON p.category_id = c.id 
    WHERE 1=1
  `;
  const params = [];
  
  if (search) {
    query += ' AND (p.name LIKE ? OR p.sku LIKE ? OR p.barcode LIKE ?)';
    params.push('%' + search + '%', '%' + search + '%', '%' + search + '%');
  }
  
  if (category) {
    query += ' AND p.category_id = ?';
    params.push(category);
  }
  
  if (lowStock === 'true') {
    query += ' AND p.stock <= p.min_stock';
  }
  
  query += ' ORDER BY p.created_at DESC';
  
  const products = all(query, params);
  res.json(products);
});

router.get('/:id', authenticate, (req, res) => {
  const product = get(`
    SELECT p.*, c.name as category_name 
    FROM products p 
    LEFT JOIN categories c ON p.category_id = c.id 
    WHERE p.id = ?
  `, [req.params.id]);
  
  if (!product) return res.status(404).json({ error: 'Product not found' });
  res.json(product);
});

router.post('/', authenticate, async (req, res) => {
  const { sku, barcode, name, description, category_id, supplier, purchase_price, sale_price, stock, min_stock, image_url } = req.body;
  
  if (!name) {
    return res.status(400).json({ error: 'El nombre es requerido' });
  }
  
  const skuVal = sku === undefined || sku === '' ? null : sku;
  const barcodeVal = barcode === undefined || barcode === '' ? null : barcode;
  const descVal = description === undefined ? null : description;
  const catVal = category_id === undefined || category_id === '' ? null : category_id;
  const supplierVal = supplier === undefined ? null : supplier;
  const purchaseVal = purchase_price === undefined ? 0 : purchase_price;
  const saleVal = sale_price === undefined ? 0 : sale_price;
  const stockVal = stock === undefined ? 0 : stock;
  const minStockVal = min_stock === undefined ? 2 : min_stock;
  const imageVal = image_url === undefined || image_url === '' ? null : image_url;
  
  try {
    const result = run(`
      INSERT INTO products (sku, barcode, name, description, category_id, supplier, purchase_price, sale_price, stock, min_stock, image_url)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [skuVal, barcodeVal, name, descVal, catVal, supplierVal, purchaseVal, saleVal, stockVal, minStockVal, imageVal]);
    
    const product = get('SELECT * FROM products WHERE id = ?', [result.lastInsertRowid]);
    saveDatabase();
    
    setImmediate(() => {
      syncToWooCommerce(product).then(result => {
        if (result.success) {
          console.log('[PRODUCTS] Background sync successful for new product', product.id);
        } else {
          console.log('[PRODUCTS] Background sync skipped for product', product.id, ':', result.error);
        }
      }).catch(e => {
        console.error('[PRODUCTS] Background sync error for product', product.id, ':', e.message);
      });
    });
    
    res.status(201).json(product);
  } catch (err) {
    res.status(400).json({ error: err.message || 'Error al crear el producto' });
  }
});

router.put('/:id', authenticate, async (req, res) => {
  const { sku, barcode, name, description, category_id, supplier, purchase_price, sale_price, stock, min_stock, image_url } = req.body;
  
  const skuVal = sku === undefined ? null : sku;
  const barcodeVal = barcode === undefined ? null : barcode;
  const descVal = description === undefined ? null : description;
  const catVal = category_id === undefined ? null : category_id;
  const supplierVal = supplier === undefined ? null : supplier;
  const purchaseVal = purchase_price === undefined ? 0 : purchase_price;
  const saleVal = sale_price === undefined ? 0 : sale_price;
  const stockVal = stock === undefined ? 0 : stock;
  const minStockVal = min_stock === undefined ? 2 : min_stock;
  const imageVal = image_url === undefined ? null : image_url;
  
  try {
    run(`
      UPDATE products 
      SET sku = ?, barcode = ?, name = ?, description = ?, category_id = ?, supplier = ?, 
          purchase_price = ?, sale_price = ?, stock = ?, min_stock = ?, image_url = ?
      WHERE id = ?
    `, [skuVal, barcodeVal, name, descVal, catVal, supplierVal, purchaseVal, saleVal, stockVal, minStockVal, imageVal, req.params.id]);
    
    const product = get('SELECT * FROM products WHERE id = ?', [req.params.id]);
    saveDatabase();
    
    setImmediate(() => {
      syncToWooCommerce(product).then(result => {
        if (result.success) {
          console.log('[PRODUCTS] Background sync successful for updated product', product.id);
        } else {
          console.log('[PRODUCTS] Background sync skipped for product', product.id, ':', result.error);
        }
      }).catch(e => {
        console.error('[PRODUCTS] Background sync error for product', product.id, ':', e.message);
      });
    });
    
    res.json(product);
  } catch (err) {
    res.status(400).json({ error: 'SKU or barcode already exists' });
  }
});

router.delete('/:id', authenticate, async (req, res) => {
  if (req.params.id === 'all') {
    run('DELETE FROM products');
    saveDatabase();
    return res.json({ success: true, message: 'Todos los productos eliminados' });
  }
  
  const product = get('SELECT * FROM products WHERE id = ?', [req.params.id]);
  
  if (product && product.woocommerce_id) {
    try {
      const config = get('SELECT * FROM woocommerce_sync WHERE id = 1 AND active = 1');
      if (config && config.store_url) {
        const url = new URL(config.store_url);
        const auth = Buffer.from(`${config.consumer_key}:${config.consumer_secret}`).toString('base64');
        
        const options = {
          hostname: url.hostname,
          port: 443,
          path: `/wp-json/wc/v3/products/${product.woocommerce_id}?force=true`,
          method: 'DELETE',
          headers: { 'Authorization': `Basic ${auth}` }
        };
        
        await new Promise((resolve) => {
          const req = https.request(options, () => resolve());
          req.on('error', () => resolve());
          req.end();
        });
      }
    } catch (e) {}
  }
  
  run('DELETE FROM products WHERE id = ?', [req.params.id]);
  saveDatabase();
  res.json({ success: true });
});

router.get('/low-stock/alerts', authenticate, (req, res) => {
  const products = all(`
    SELECT p.*, c.name as category_name 
    FROM products p 
    LEFT JOIN categories c ON p.category_id = c.id 
    WHERE p.stock <= p.min_stock
    ORDER BY p.stock ASC
  `);
  res.json(products);
});

module.exports = router;
