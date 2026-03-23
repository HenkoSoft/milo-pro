const initSqlJs = require('sql.js');
const bcrypt = require('bcryptjs');
const path = require('path');
const fs2 = require('fs');

let db = null;
const DATABASE_FILENAME = 'milo-pro.db';
const LEGACY_DATABASE_FILENAME = 'techfix.db';

function getDatabasePath(filename = DATABASE_FILENAME) {
  return path.join(__dirname, 'data', filename);
}

function run(sql, params = []) {
  if (!db) throw new Error('Database not initialized');
  db.run(sql, params);
  return { lastInsertRowid: db.exec("SELECT last_insert_rowid()")[0]?.values[0][0] };
}

function get(sql, params = []) {
  if (!db) throw new Error('Database not initialized');
  const stmt = db.prepare(sql);
  stmt.bind(params);
  if (stmt.step()) {
    const row = stmt.getAsObject();
    stmt.free();
    return row;
  }
  stmt.free();
  return null;
}

function all(sql, params = []) {
  if (!db) throw new Error('Database not initialized');
  const stmt = db.prepare(sql);
  stmt.bind(params);
  const results = [];
  while (stmt.step()) {
    results.push(stmt.getAsObject());
  }
  stmt.free();
  return results;
}

function transaction(fn) {
  return function(...args) {
    db.run('BEGIN TRANSACTION');
    try {
      const result = fn.apply(this, args);
      if (result && typeof result.then === 'function') {
        return result.then((value) => {
          db.run('COMMIT');
          return value;
        }).catch((error) => {
          db.run('ROLLBACK');
          throw error;
        });
      }
      db.run('COMMIT');
      return result;
    } catch (e) {
      db.run('ROLLBACK');
      throw e;
    }
  };
}

async function initializeDatabase() {
  const SQL = await initSqlJs();
  const dbPath = getDatabasePath();
  const legacyDbPath = getDatabasePath(LEGACY_DATABASE_FILENAME);
  const dataDir = path.dirname(dbPath);

  if (!fs2.existsSync(dataDir)) {
    fs2.mkdirSync(dataDir, { recursive: true });
  }

  if (!fs2.existsSync(dbPath) && fs2.existsSync(legacyDbPath)) {
    fs2.copyFileSync(legacyDbPath, dbPath);
  }
  
  let buffer = null;
  if (fs2.existsSync(dbPath)) {
    buffer = fs2.readFileSync(dbPath);
  }
  
  db = buffer ? new SQL.Database(buffer) : new SQL.Database();
  db.run('PRAGMA foreign_keys = ON');
  
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      role TEXT DEFAULT 'technician',
      name TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
  
  db.run(`
    CREATE TABLE IF NOT EXISTS categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
  
  db.run(`
    CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sku TEXT UNIQUE,
      barcode TEXT,
      name TEXT NOT NULL,
      description TEXT,
      category_id INTEGER,
      supplier TEXT,
      purchase_price REAL DEFAULT 0,
      sale_price REAL DEFAULT 0,
      stock INTEGER DEFAULT 0,
      min_stock INTEGER DEFAULT 2,
      woocommerce_id INTEGER,
      image_url TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (category_id) REFERENCES categories(id)
    )
  `);
  
  db.run(`
    CREATE TABLE IF NOT EXISTS customers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      phone TEXT,
      email TEXT,
      address TEXT,
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
  
  db.run(`
    CREATE TABLE IF NOT EXISTS sales (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      customer_id INTEGER,
      user_id INTEGER NOT NULL,
      total REAL NOT NULL,
      payment_method TEXT DEFAULT 'cash',
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (customer_id) REFERENCES customers(id),
      FOREIGN KEY (user_id) REFERENCES users(id)
    )
  `);
  
  db.run(`
    CREATE TABLE IF NOT EXISTS sale_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sale_id INTEGER NOT NULL,
      product_id INTEGER NOT NULL,
      quantity INTEGER NOT NULL,
      unit_price REAL NOT NULL,
      subtotal REAL NOT NULL,
      FOREIGN KEY (sale_id) REFERENCES sales(id),
      FOREIGN KEY (product_id) REFERENCES products(id)
    )
  `);
  
  db.run(`
    CREATE TABLE IF NOT EXISTS repairs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ticket_number TEXT UNIQUE NOT NULL,
      customer_id INTEGER NOT NULL,
      device_type TEXT NOT NULL,
      brand TEXT,
      model TEXT,
      serial_number TEXT,
      imei TEXT,
      password TEXT,
      pattern TEXT,
      problem_description TEXT NOT NULL,
      accessories TEXT,
      status TEXT DEFAULT 'received',
      estimated_price REAL,
      final_price REAL,
      technician_notes TEXT,
      entry_date DATETIME DEFAULT CURRENT_TIMESTAMP,
      delivery_date DATETIME,
      customer_signature TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (customer_id) REFERENCES customers(id)
    )
  `);
  
  db.run(`
    CREATE TABLE IF NOT EXISTS repair_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      repair_id INTEGER NOT NULL,
      status TEXT NOT NULL,
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (repair_id) REFERENCES repairs(id)
    )
  `);
  
  db.run(`
    CREATE TABLE IF NOT EXISTS settings (
      id INTEGER PRIMARY KEY,
      business_name TEXT DEFAULT 'Milo Pro',
      business_address TEXT,
      business_phone TEXT,
      business_email TEXT,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
  
  db.run(`
    CREATE TABLE IF NOT EXISTS woocommerce_sync (
      id INTEGER PRIMARY KEY,
      store_url TEXT,
      consumer_key TEXT,
      consumer_secret TEXT,
      sync_direction TEXT DEFAULT 'both',
      last_sync DATETIME,
      auto_sync INTEGER DEFAULT 0,
      active INTEGER DEFAULT 1
    )
  `);
  
  try {
    db.run('ALTER TABLE products ADD COLUMN image_url TEXT');
  } catch (e) {
    // Column may already exist
  }
  
  db.run(`
    CREATE TABLE IF NOT EXISTS product_sync_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      milo_id INTEGER,
      woocommerce_id INTEGER,
      action TEXT,
      status TEXT,
      message TEXT,
      synced_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
  
  const settingsCount = get('SELECT COUNT(*) as count FROM settings');
  if (!settingsCount || settingsCount.count === 0) {
    run('INSERT INTO settings (id, business_name) VALUES (1, ?)', ['Milo Pro']);
  }
  
  db.run(`
    CREATE TABLE IF NOT EXISTS device_types (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      active INTEGER DEFAULT 1
    )
  `);
  
  db.run(`
    CREATE TABLE IF NOT EXISTS brands (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      active INTEGER DEFAULT 1
    )
  `);
  
  db.run(`
    CREATE TABLE IF NOT EXISTS device_models (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      brand_id INTEGER,
      name TEXT NOT NULL,
      active INTEGER DEFAULT 1,
      FOREIGN KEY (brand_id) REFERENCES brands(id)
    )
  `);
  
  db.run(`
    CREATE TABLE IF NOT EXISTS suppliers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      phone TEXT,
      email TEXT,
      address TEXT,
      city TEXT,
      tax_id TEXT,
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
  
  db.run(`
    CREATE TABLE IF NOT EXISTS purchases (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      supplier_id INTEGER,
      invoice_type TEXT DEFAULT 'FA',
      invoice_number TEXT,
      invoice_date DATE,
      subtotal REAL DEFAULT 0,
      iva REAL DEFAULT 0,
      total REAL DEFAULT 0,
      notes TEXT,
      status TEXT DEFAULT 'pending',
      user_id INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (supplier_id) REFERENCES suppliers(id),
      FOREIGN KEY (user_id) REFERENCES users(id)
    )
  `);
  
  db.run(`
    CREATE TABLE IF NOT EXISTS purchase_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      purchase_id INTEGER NOT NULL,
      product_id INTEGER,
      product_name TEXT NOT NULL,
      product_code TEXT,
      quantity INTEGER NOT NULL,
      unit_cost REAL NOT NULL,
      subtotal REAL NOT NULL,
      FOREIGN KEY (purchase_id) REFERENCES purchases(id),
      FOREIGN KEY (product_id) REFERENCES products(id)
    )
  `);
  
  db.run(`
    CREATE TABLE IF NOT EXISTS supplier_payments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      supplier_id INTEGER NOT NULL,
      amount REAL NOT NULL,
      payment_method TEXT DEFAULT 'cash',
      reference TEXT,
      notes TEXT,
      user_id INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (supplier_id) REFERENCES suppliers(id),
      FOREIGN KEY (user_id) REFERENCES users(id)
    )
  `);
  
  db.run(`
    CREATE TABLE IF NOT EXISTS supplier_credits (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      supplier_id INTEGER NOT NULL,
      credit_note_number TEXT NOT NULL,
      reference_invoice TEXT,
      invoice_date DATE,
      subtotal REAL DEFAULT 0,
      iva REAL DEFAULT 0,
      total REAL DEFAULT 0,
      notes TEXT,
      status TEXT DEFAULT 'pending',
      user_id INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (supplier_id) REFERENCES suppliers(id),
      FOREIGN KEY (user_id) REFERENCES users(id)
    )
  `);
  
  db.run(`
    CREATE TABLE IF NOT EXISTS supplier_credit_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      credit_id INTEGER NOT NULL,
      product_id INTEGER,
      product_name TEXT NOT NULL,
      product_code TEXT,
      quantity INTEGER NOT NULL,
      unit_price REAL NOT NULL,
      subtotal REAL NOT NULL,
      FOREIGN KEY (credit_id) REFERENCES supplier_credits(id),
      FOREIGN KEY (product_id) REFERENCES products(id)
    )
  `);
  
  db.run(`
    CREATE TABLE IF NOT EXISTS supplier_account (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      supplier_id INTEGER NOT NULL UNIQUE,
      total_purchases REAL DEFAULT 0,
      total_credits REAL DEFAULT 0,
      total_payments REAL DEFAULT 0,
      balance REAL DEFAULT 0,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (supplier_id) REFERENCES suppliers(id)
    )
  `);
  
  db.run(`
    CREATE TABLE IF NOT EXISTS supplier_account_movements (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      supplier_id INTEGER NOT NULL,
      type TEXT NOT NULL,
      reference_id INTEGER,
      reference_number TEXT,
      description TEXT,
      debit REAL DEFAULT 0,
      credit REAL DEFAULT 0,
      balance REAL DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (supplier_id) REFERENCES suppliers(id)
    )
  `);
  
  try {
    db.run(`ALTER TABLE suppliers ADD COLUMN total_purchases REAL DEFAULT 0`);
  } catch (e) {}
  try {
    db.run(`ALTER TABLE suppliers ADD COLUMN total_credits REAL DEFAULT 0`);
  } catch (e) {}
  try {
    db.run(`ALTER TABLE suppliers ADD COLUMN total_payments REAL DEFAULT 0`);
  } catch (e) {}
  try {
    db.run(`ALTER TABLE suppliers ADD COLUMN balance REAL DEFAULT 0`);
  } catch (e) {}
  try {
    db.run('ALTER TABLE product_sync_log RENAME COLUMN techfix_id TO milo_id');
  } catch (e) {}
  
  const supplierCount = get('SELECT COUNT(*) as count FROM suppliers');
  if (!supplierCount || supplierCount.count === 0) {
    const defaultSuppliers = [
      { name: 'Distribuidora Tech', phone: '11-5555-1234', email: 'ventas@distritech.com', city: 'Buenos Aires', tax_id: '30-12345678-9' },
      { name: 'Global Parts SA', phone: '11-5555-5678', email: 'info@globalparts.com', city: 'Córdoba', tax_id: '30-87654321-0' },
      { name: 'Mega Electrónica', phone: '11-5555-9012', email: 'mega@electronica.com', city: 'Rosario', tax_id: '30-45678901-2' }
    ];
    defaultSuppliers.forEach(s => {
      run('INSERT INTO suppliers (name, phone, email, city, tax_id) VALUES (?, ?, ?, ?, ?)', 
        [s.name, s.phone, s.email, s.city, s.tax_id]);
    });
  }
  
  const deviceTypeCount = get('SELECT COUNT(*) as count FROM device_types');
  if (!deviceTypeCount || deviceTypeCount.count === 0) {
    const defaultTypes = ['Celular', 'Computadora', 'Tablet', 'Consola', 'Smartwatch', 'Otro'];
    defaultTypes.forEach(t => run('INSERT INTO device_types (name) VALUES (?)', [t]));
  }
  
  const brandCount = get('SELECT COUNT(*) as count FROM brands');
  if (!brandCount || brandCount.count === 0) {
    const defaultBrands = ['Apple', 'Samsung', 'Huawei', 'Xiaomi', 'Motorola', 'Nokia', 'LG', 'Sony', 'Lenovo', 'Dell', 'HP', 'Asus', 'Acer', 'Microsoft', 'Nintendo', 'Otro'];
    defaultBrands.forEach(b => run('INSERT INTO brands (name) VALUES (?)', [b]));
  }
  
  const modelCount = get('SELECT COUNT(*) as count FROM device_models');
  if (!modelCount || modelCount.count === 0) {
    const defaultModels = [
      { name: 'iPhone 15 Pro Max', brand: 'Apple' },
      { name: 'iPhone 15 Pro', brand: 'Apple' },
      { name: 'iPhone 15', brand: 'Apple' },
      { name: 'iPhone 14 Pro Max', brand: 'Apple' },
      { name: 'iPhone 14', brand: 'Apple' },
      { name: 'iPhone 13', brand: 'Apple' },
      { name: 'iPhone SE', brand: 'Apple' },
      { name: 'iPad Pro', brand: 'Apple' },
      { name: 'iPad Air', brand: 'Apple' },
      { name: 'iPad Mini', brand: 'Apple' },
      { name: 'Samsung Galaxy S24 Ultra', brand: 'Samsung' },
      { name: 'Samsung Galaxy S24+', brand: 'Samsung' },
      { name: 'Samsung Galaxy S24', brand: 'Samsung' },
      { name: 'Samsung Galaxy S23 Ultra', brand: 'Samsung' },
      { name: 'Samsung Galaxy S23', brand: 'Samsung' },
      { name: 'Samsung Galaxy A54', brand: 'Samsung' },
      { name: 'Samsung Galaxy A34', brand: 'Samsung' },
      { name: 'Samsung Galaxy A14', brand: 'Samsung' },
      { name: 'Samsung Galaxy Tab S9', brand: 'Samsung' },
      { name: 'Samsung Galaxy Tab A8', brand: 'Samsung' },
      { name: 'Huawei Mate 60 Pro', brand: 'Huawei' },
      { name: 'Huawei P70 Pro', brand: 'Huawei' },
      { name: 'Huawei Nova 12i', brand: 'Huawei' },
      { name: 'Huawei MatePad', brand: 'Huawei' },
      { name: 'Xiaomi Redmi Note 13', brand: 'Xiaomi' },
      { name: 'Xiaomi Redmi 13', brand: 'Xiaomi' },
      { name: 'Xiaomi POCO X6', brand: 'Xiaomi' },
      { name: 'Xiaomi POCO M6 Pro', brand: 'Xiaomi' },
      { name: 'Xiaomi Mi 14 Ultra', brand: 'Xiaomi' },
      { name: 'Xiaomi Pad 6', brand: 'Xiaomi' },
      { name: 'Motorola Edge 40 Pro', brand: 'Motorola' },
      { name: 'Motorola Edge 40', brand: 'Motorola' },
      { name: 'Motorola Moto G84', brand: 'Motorola' },
      { name: 'Motorola Moto G54', brand: 'Motorola' },
      { name: 'Motorola Moto G14', brand: 'Motorola' },
      { name: 'Nokia G42', brand: 'Nokia' },
      { name: 'Nokia C32', brand: 'Nokia' },
      { name: 'Nokia G21', brand: 'Nokia' },
      { name: 'LG K62', brand: 'LG' },
      { name: 'LG K52', brand: 'LG' },
      { name: 'LG Velvet', brand: 'LG' },
      { name: 'Sony Xperia 1 V', brand: 'Sony' },
      { name: 'Sony Xperia 10 V', brand: 'Sony' },
      { name: 'Sony Xperia Pro-I', brand: 'Sony' },
      { name: 'Lenovo Tab P12', brand: 'Lenovo' },
      { name: 'Lenovo Tab M10', brand: 'Lenovo' },
      { name: 'Lenovo Legion Go', brand: 'Lenovo' },
      { name: 'Dell XPS 15', brand: 'Dell' },
      { name: 'Dell XPS 13', brand: 'Dell' },
      { name: 'Dell Inspiron 15', brand: 'Dell' },
      { name: 'Dell Latitude 14', brand: 'Dell' },
      { name: 'HP Pavilion 15', brand: 'HP' },
      { name: 'HP Spectre x360', brand: 'HP' },
      { name: 'HP EliteBook 840', brand: 'HP' },
      { name: 'HP Chromebook 14', brand: 'HP' },
      { name: 'Asus ROG Phone 8', brand: 'Asus' },
      { name: 'Asus Zenfone 11', brand: 'Asus' },
      { name: 'Asus VivoBook 15', brand: 'Asus' },
      { name: 'Asus ROG Strix', brand: 'Asus' },
      { name: 'Asus Chromebook', brand: 'Asus' },
      { name: 'Acer Aspire 5', brand: 'Acer' },
      { name: 'Acer Swift 3', brand: 'Acer' },
      { name: 'Acer Nitro 5', brand: 'Acer' },
      { name: 'Acer Iconia Tab', brand: 'Acer' },
      { name: 'PlayStation 5', brand: 'Sony' },
      { name: 'PlayStation 4 Slim', brand: 'Sony' },
      { name: 'Xbox Series X', brand: 'Microsoft' },
      { name: 'Xbox Series S', brand: 'Microsoft' },
      { name: 'Nintendo Switch OLED', brand: 'Nintendo' },
      { name: 'Nintendo Switch', brand: 'Nintendo' }
    ];
    
    defaultModels.forEach(m => {
      const brand = get('SELECT id FROM brands WHERE name = ?', [m.brand]);
      if (brand) {
        run('INSERT INTO device_models (name, brand_id) VALUES (?, ?)', [m.name, brand.id]);
      }
    });
  }
  
  const userCount = get('SELECT COUNT(*) as count FROM users');
  if (!userCount || userCount.count === 0) {
    const hashedPassword = bcrypt.hashSync('admin123', 10);
    run('INSERT INTO users (username, password, role, name) VALUES (?, ?, ?, ?)', ['admin', hashedPassword, 'admin', 'Administrator']);
    run('INSERT INTO users (username, password, role, name) VALUES (?, ?, ?, ?)', ['tech', bcrypt.hashSync('tech123', 10), 'technician', 'Technician']);
    
    const categories = [
      { name: 'Computers', description: 'Laptops and Desktops' },
      { name: 'Cellphones', description: 'Mobile phones and smartphones' },
      { name: 'Tablets', description: 'iPads and Android tablets' },
      { name: 'Consoles', description: 'Video game consoles' },
      { name: 'Accessories', description: 'Cases, chargers, cables' },
      { name: 'Spare Parts', description: 'Screens, batteries, components' },
      { name: 'Networking', description: 'Routers, modems, adapters' },
      { name: 'Audio', description: 'Headphones, speakers' }
    ];
    
    categories.forEach(cat => {
      run('INSERT INTO categories (name, description) VALUES (?, ?)', [cat.name, cat.description]);
    });
    
    const products = [
      { sku: 'LAP-001', name: 'HP Laptop 15s', category_id: 1, supplier: 'HP Distributor', purchase_price: 450, sale_price: 549, stock: 5 },
      { sku: 'LAP-002', name: 'Dell Inspiron 15', category_id: 1, supplier: 'Dell Inc', purchase_price: 520, sale_price: 649, stock: 3 },
      { sku: 'CEL-001', name: 'iPhone 14 Case', category_id: 2, supplier: 'CaseWorld', purchase_price: 8, sale_price: 19.99, stock: 50 },
      { sku: 'CEL-002', name: 'Samsung Galaxy Screen Protector', category_id: 2, supplier: 'ScreenPro', purchase_price: 3, sale_price: 12.99, stock: 100 },
      { sku: 'ACC-001', name: 'USB-C Cable 1m', category_id: 5, supplier: 'CableCo', purchase_price: 5, sale_price: 14.99, stock: 30 },
      { sku: 'ACC-002', name: 'Wireless Mouse', category_id: 5, supplier: 'Logitech', purchase_price: 15, sale_price: 29.99, stock: 15 },
      { sku: 'CON-001', name: 'PS5 Controller', category_id: 4, supplier: 'Sony', purchase_price: 45, sale_price: 64.99, stock: 8 },
      { sku: 'SPA-001', name: 'iPhone Battery', category_id: 6, supplier: 'PartsWorld', purchase_price: 35, sale_price: 59.99, stock: 10 },
      { sku: 'NET-001', name: 'TP-Link Router', category_id: 7, supplier: 'TP-Link', purchase_price: 25, sale_price: 45, stock: 7 },
      { sku: 'AUD-001', name: 'Bluetooth Headphones', category_id: 8, supplier: 'AudioTech', purchase_price: 20, sale_price: 39.99, stock: 12 }
    ];
    
    products.forEach(p => {
      run('INSERT INTO products (sku, name, category_id, supplier, purchase_price, sale_price, stock) VALUES (?, ?, ?, ?, ?, ?, ?)', 
        [p.sku, p.name, p.category_id, p.supplier, p.purchase_price, p.sale_price, p.stock]);
    });
    
    console.log('Database initialized with seed data');
  }
  
  saveDatabase();
  
  run('UPDATE products SET min_stock = 2 WHERE min_stock = 5');
  saveDatabase();
  
  return { db, run, get, all, transaction };
}

function saveDatabase() {
  if (!db) return;
  const data = db.export();
  const buffer = Buffer.from(data);
  const dbPath = getDatabasePath();
  fs2.writeFileSync(dbPath, buffer);
}

module.exports = { initializeDatabase, run, get, all, transaction, saveDatabase };
