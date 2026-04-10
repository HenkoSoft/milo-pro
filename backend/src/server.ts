const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const { initializeRuntimeDatabase } = require('./db');

type FrontendMode = 'react';

type FrontendStrategy = {
  mode: 'react';
  indexPath: string;
  reactActive: boolean;
  buildAvailable: boolean;
};

const app = express();
const PORT = Number(process.env.PORT || 3000);
const rootDir = path.resolve(__dirname, '../..');
const publicDir = path.join(rootDir, 'public');
const reactDistDir = path.join(rootDir, 'frontend', 'dist');
const reactIndexPath = path.join(reactDistDir, 'index.html');
const frontendMode = String(process.env.FRONTEND_MODE || 'react').trim().toLowerCase() as FrontendMode;

app.disable('x-powered-by');
app.use(cors());
app.use(express.json({
  limit: '35mb',
  verify: (req: any, _res: any, buf: unknown) => {
    req.rawBody = Buffer.from(buf);
  }
}));

function hasReactBuild(): boolean {
  return fs.existsSync(reactIndexPath);
}

function resolveFrontendStrategy(): FrontendStrategy {
  return {
    mode: 'react',
    indexPath: reactIndexPath,
    reactActive: true,
    buildAvailable: hasReactBuild()
  };
}

function sendIndexFile(res: any, filePath: string): void {
  res.sendFile(filePath);
}

function frontendRequestHandler(strategy: FrontendStrategy) {
  return (_req: any, res: any) => {
    sendIndexFile(res, strategy.indexPath);
  };
}

export async function startServer(): Promise<void> {
  try {
    const databaseState = await initializeRuntimeDatabase();

    const authRoutes = require('../src/routes/auth.js');
    const categoryRoutes = require('../src/routes/categories.js');
    const productRoutes = require('../src/routes/products.js');
    const saleRoutes = require('../src/routes/sales.js');
    const customerRoutes = require('../src/routes/customers.js');
    const repairRoutes = require('../src/routes/repairs.js');
    const dashboardRoutes = require('../src/routes/dashboard.js');
    const reportRoutes = require('../src/routes/reports.js');
    const settingsRoutes = require('../src/routes/settings.js');
    const woocommerceRoutes = require('../src/routes/woocommerce.js');
    const deviceOptionsRoutes = require('../src/routes/deviceOptions.js');
    const purchaseRoutes = require('../src/routes/purchases.js');
    const catalogService = require('../src/services/catalog.js');
    const woocommerceSyncService = require('../src/services/woocommerce-sync.js');
    const wooOrderSyncService = require('../src/services/woo-order-sync.js');

    app.locals.database = databaseState.adapter;

    if (typeof catalogService.setRuntimeDatabase === 'function') {
      catalogService.setRuntimeDatabase(databaseState.adapter);
    }
    if (typeof woocommerceSyncService.setRuntimeDatabase === 'function') {
      woocommerceSyncService.setRuntimeDatabase(databaseState.adapter);
    }
    if (typeof wooOrderSyncService.setRuntimeDatabase === 'function') {
      wooOrderSyncService.setRuntimeDatabase(databaseState.adapter);
    }

    const frontendStrategy = resolveFrontendStrategy();

    if (!frontendStrategy.buildAvailable) {
      throw new Error('React requiere un build existente en frontend/dist');
    }

    app.get('/api/health', (_req: any, res: any) => {
      res.json({
        ok: true,
        frontend_mode: frontendStrategy.mode,
        requested_frontend_mode: frontendMode,
        react_build_available: frontendStrategy.buildAvailable,
        requested_db_dialect: databaseState.requestedDialect,
        active_db_dialect: databaseState.activeDialect,
        postgres_runtime_ready: databaseState.postgresRuntimeReady
      });
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
    if (typeof woocommerceRoutes.setRuntimeDatabase === 'function') {
      woocommerceRoutes.setRuntimeDatabase(databaseState.adapter);
    }

    app.use('/api/woocommerce', woocommerceRoutes);
    app.use('/api/device-options', deviceOptionsRoutes);
    app.use('/api/purchases', purchaseRoutes);

    if (typeof woocommerceRoutes.initializeWooAutomation === 'function') {
      await woocommerceRoutes.initializeWooAutomation();
    }

    app.use('/api', (_req: any, res: any) => {
      res.status(404).json({ error: 'Endpoint not found' });
    });

    app.use('/productos', express.static(path.join(publicDir, 'productos')));
    app.use(express.static(reactDistDir));

    app.get('*', frontendRequestHandler(frontendStrategy));

    app.use((err: Error, _req: any, res: any, next: any) => {
      console.error('Unhandled server error:', err);
      if (res.headersSent) {
        return next(err);
      }
      res.status(500).json({ error: 'Internal server error' });
    });

    app.listen(PORT, () => {
      console.log('milo-pro running on http://localhost:' + PORT);
      console.log(`[FRONTEND] mode=${frontendStrategy.mode} requested=${frontendMode} react_build=${frontendStrategy.buildAvailable ? 'yes' : 'no'}`);
      console.log(`[DB] requested=${databaseState.requestedDialect} active=${databaseState.activeDialect} postgres_ready=${databaseState.postgresRuntimeReady ? 'yes' : 'no'}`);
    });
  } catch (error) {
    console.error('Server startup failed:', error);
    process.exit(1);
  }
}

void startServer();






