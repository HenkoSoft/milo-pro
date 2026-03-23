# Milo Pro - Repair Shop & Retail Management System

## Project Overview

**Project Name:** Milo Pro  
**Type:** Full-stack Web Application (Mini ERP)  
**Core Functionality:** A comprehensive management system for a computer, cellphone, and videogame console repair shop that also sells technology products and accessories.  
**Target Users:** Shop owners, technicians, and staff.

---

## Technology Stack

- **Backend:** Node.js + Express.js
- **Database:** SQLite (better-sqlite3)
- **Frontend:** Vanilla HTML/CSS/JavaScript
- **Authentication:** JWT tokens
- **Architecture:** RESTful API + Modular structure

---

## Database Schema

### WooCommerce Sync Table
```sql
CREATE TABLE woocommerce_sync (
  id INTEGER PRIMARY KEY,
  store_url TEXT,
  consumer_key TEXT,
  consumer_secret TEXT,
  sync_direction TEXT DEFAULT 'both',
  last_sync DATETIME,
  auto_sync INTEGER DEFAULT 0,
  active INTEGER DEFAULT 1
);
```

### Product Sync Log Table
```sql
CREATE TABLE product_sync_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  milo_id INTEGER,
  woocommerce_id INTEGER,
  action TEXT,
  status TEXT,
  message TEXT,
  synced_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

### Users Table
```sql
CREATE TABLE users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT UNIQUE NOT NULL,
  password TEXT NOT NULL,
  role TEXT DEFAULT 'technician',
  name TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

### Categories Table
```sql
CREATE TABLE categories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  description TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

### Products Table
```sql
CREATE TABLE products (
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
  min_stock INTEGER DEFAULT 5,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (category_id) REFERENCES categories(id)
);
```

### Customers Table
```sql
CREATE TABLE customers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  address TEXT,
  notes TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

### Sales Table
```sql
CREATE TABLE sales (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  customer_id INTEGER,
  user_id INTEGER NOT NULL,
  total REAL NOT NULL,
  payment_method TEXT DEFAULT 'cash',
  notes TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (customer_id) REFERENCES customers(id),
  FOREIGN KEY (user_id) REFERENCES users(id)
);
```

### Sale Items Table
```sql
CREATE TABLE sale_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  sale_id INTEGER NOT NULL,
  product_id INTEGER NOT NULL,
  quantity INTEGER NOT NULL,
  unit_price REAL NOT NULL,
  subtotal REAL NOT NULL,
  FOREIGN KEY (sale_id) REFERENCES sales(id),
  FOREIGN KEY (product_id) REFERENCES products(id)
);
```

### Repairs Table
```sql
CREATE TABLE repairs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ticket_number TEXT UNIQUE NOT NULL,
  customer_id INTEGER NOT NULL,
  device_type TEXT NOT NULL,
  brand TEXT,
  model TEXT,
  serial_number TEXT,
  imei TEXT,
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
);
```

### Repair Logs Table
```sql
CREATE TABLE repair_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  repair_id INTEGER NOT NULL,
  status TEXT NOT NULL,
  notes TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (repair_id) REFERENCES repairs(id)
);
```

---

## UI/UX Specification

### Color Palette
- **Primary:** #2563eb (Blue)
- **Primary Dark:** #1d4ed8
- **Secondary:** #64748b (Slate)
- **Accent:** #10b981 (Emerald - for success)
- **Warning:** #f59e0b (Amber)
- **Danger:** #ef4444 (Red)
- **Background:** #f8fafc (Light slate)
- **Card Background:** #ffffff
- **Text Primary:** #1e293b
- **Text Secondary:** #64748b
- **Border:** #e2e8f0

### Typography
- **Font Family:** 'Segoe UI', system-ui, sans-serif
- **Headings:** 600 weight
- **Body:** 400 weight
- **Font Sizes:**
  - h1: 28px
  - h2: 22px
  - h3: 18px
  - body: 14px
  - small: 12px

### Layout
- **Sidebar:** 250px fixed width, dark theme (#1e293b)
- **Main Content:** Fluid, padding 24px
- **Cards:** White background, border-radius 8px, subtle shadow
- **Responsive:** Sidebar collapses on mobile (<768px)

### Components
- **Buttons:** Primary (blue), Secondary (gray), Success (green), Danger (red)
- **Forms:** Clean inputs with focus states
- **Tables:** Striped rows, hover effects
- **Modals:** Centered, overlay background
- **Status Badges:** Color-coded by status

### Status Colors
- **Received:** #64748b (gray)
- **Diagnosing:** #3b82f6 (blue)
- **Waiting for parts:** #f59e0b (amber)
- **Repairing:** #8b5cf6 (purple)
- **Ready for pickup:** #10b981 (green)
- **Delivered:** #22c55e (green)

---

## API Endpoints

### Authentication
- POST /api/auth/login
- POST /api/auth/logout
- GET /api/auth/me

### Products
- GET /api/products
- GET /api/products/:id
- POST /api/products
- PUT /api/products/:id
- DELETE /api/products/:id

### Categories
- GET /api/categories
- POST /api/categories
- PUT /api/categories/:id
- DELETE /api/categories/:id

### Sales
- GET /api/sales
- GET /api/sales/:id
- POST /api/sales
- GET /api/sales/today

### Customers
- GET /api/customers
- GET /api/customers/:id
- POST /api/customers
- PUT /api/customers/:id
- DELETE /api/customers/:id

### Repairs
- GET /api/repairs
- GET /api/repairs/:id
- POST /api/repairs
- PUT /api/repairs/:id
- PUT /api/repairs/:id/status
- GET /api/repairs/ticket/:ticketNumber

### Dashboard
- GET /api/dashboard/stats
- GET /api/dashboard/alerts
- GET /api/dashboard/recent-activity

### Reports
- GET /api/reports/sales
- GET /api/reports/repairs
- GET /api/reports/products
- GET /api/reports/revenue

### WooCommerce Integration
- GET /api/woocommerce/status
- GET /api/woocommerce/test
- PUT /api/woocommerce/config
- POST /api/woocommerce/sync
- POST /api/woocommerce/sync-product/:id
- GET /api/woocommerce/logs
- DELETE /api/woocommerce/disconnect

---

## Functionality Specification

### 1. Authentication
- Login with username/password
- JWT token storage in localStorage
- Role-based access (admin, technician)
- Auto-logout on token expiry

### 2. Inventory Management
- CRUD operations for products
- Category management
- SKU/Barcode support
- Stock level tracking with alerts
- Profit margin calculation
- Supplier information

### 3. POS/Sales
- Quick product selection
- Barcode scanning
- Multi-item transactions
- Automatic stock deduction
- Customer association (optional)
- Receipt generation
- Daily sales summary

### 4. Customer Management
- Contact information storage
- Purchase history
- Repair history
- Search functionality

### 5. Repair Management
- Work order creation
- Status workflow tracking
- Technician notes
- Cost estimation
- Repair timeline/log
- Ticket generation
- Customer signature capture

### 6. Dashboard
- Overview statistics
- Active repairs count
- Low stock alerts
- Today's sales
- Recent activity feed

### 7. Reports
- Sales by date range
- Repair statistics
- Top products
- Revenue analysis

### 8. WooCommerce Integration
- Bidirectional product sync (import from WooCommerce / export to WooCommerce)
- Configurable sync direction (import only, export only, or both)
- Manual and automatic sync options
- Individual product sync
- Sync history logging

---

## Acceptance Criteria

1. ✅ User can login and access role-appropriate features
2. ✅ Products can be created, viewed, edited, and deleted
3. ✅ Sales can be processed with automatic stock updates
4. ✅ Customers can be managed with full CRUD
5. ✅ Repairs follow complete workflow from received to delivered
6. ✅ Dashboard displays real-time statistics and alerts
7. ✅ Reports generate accurate data summaries
8. ✅ UI is responsive and works on mobile devices
9. ✅ Print receipts and tickets function correctly
10. ✅ Low stock alerts appear for products below minimum
11. ✅ WooCommerce integration syncs products bidirectionally

---

## Project Structure

```
milo-pro/
├── server.js              # Main server entry
├── package.json          # Dependencies
├── database.js           # Database initialization
├── docs/
│   └── README.md         # Setup instructions
├── routes/
│   ├── auth.js           # Authentication routes
│   ├── products.js       # Product routes
│   ├── categories.js     # Category routes
│   ├── sales.js          # Sales routes
│   ├── customers.js      # Customer routes
│   ├── repairs.js        # Repair routes
│   ├── dashboard.js      # Dashboard routes
│   ├── reports.js        # Report routes
│   └── woocommerce.js    # WooCommerce sync routes
├── public/
│   ├── index.html        # Main SPA
│   ├── css/
│   │   └── styles.css    # Main stylesheet
│   └── js/
│       ├── app.js        # Main application
│       ├── api.js        # API client
│       ├── auth.js       # Auth handling
│       ├── router.js     # Router
│       └── pages/
│           ├── dashboard.js
│           ├── products.js
│           ├── sales.js
│           ├── customers.js
│           ├── repairs.js
│           └── reports.js
└── data/
    └── milo-pro.db       # SQLite database
```
