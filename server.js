const express = require('express');
const cors = require('cors');
const path = require('path');
const { initializeDatabase } = require('./database');

const authRoutes = require('./routes/auth');
const categoryRoutes = require('./routes/categories');
const productRoutes = require('./routes/products');
const saleRoutes = require('./routes/sales');
const customerRoutes = require('./routes/customers');
const repairRoutes = require('./routes/repairs');
const dashboardRoutes = require('./routes/dashboard');
const reportRoutes = require('./routes/reports');
const settingsRoutes = require('./routes/settings');
const woocommerceRoutes = require('./routes/woocommerce');
const deviceOptionsRoutes = require('./routes/deviceOptions');
const purchaseRoutes = require('./routes/purchases');

const app = express();
const PORT = process.env.PORT || 3000;

app.disable('x-powered-by');
app.use(cors());
app.use(express.json({ limit: '35mb' }));
app.use(express.static(path.join(__dirname, 'public')));

async function startServer() {
  try {
    await initializeDatabase();

    app.get('/api/health', (req, res) => {
      res.json({ ok: true });
    });

    app.use('/api/auth', authRoutes);
    app.use('/api/categories', categoryRoutes);
    app.use('/api/products', productRoutes);
    app.use('/api/sales', saleRoutes);
    app.use('/api/customers', customerRoutes);
    app.use('/api/repairs', repairRoutes);
    app.use('/api/dashboard', dashboardRoutes);
    app.use('/api/reports', reportRoutes);
    app.use('/api/settings', settingsRoutes);
    app.use('/api/woocommerce', woocommerceRoutes);
    app.use('/api/device-options', deviceOptionsRoutes);
    app.use('/api/purchases', purchaseRoutes);

    if (typeof woocommerceRoutes.initializeWooAutomation === 'function') {
      woocommerceRoutes.initializeWooAutomation();
    }

    app.use('/api', (req, res) => {
      res.status(404).json({ error: 'Endpoint not found' });
    });

    app.get('*', (req, res) => {
      res.sendFile(path.join(__dirname, 'public', 'index.html'));
    });

    app.use((err, req, res, next) => {
      console.error('Unhandled server error:', err);
      if (res.headersSent) {
        return next(err);
      }
      res.status(500).json({ error: 'Internal server error' });
    });

    app.listen(PORT, () => {
      console.log('milo-pro running on http://localhost:' + PORT);
    });
  } catch (error) {
    console.error('Server startup failed:', error);
    process.exit(1);
  }
}

startServer();
