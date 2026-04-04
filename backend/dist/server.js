"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.startServer = startServer;
const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const { initializeDatabase } = require('../../database');
const authRoutes = require('../../routes/auth');
const categoryRoutes = require('../../routes/categories');
const productRoutes = require('../../routes/products');
const saleRoutes = require('../../routes/sales');
const customerRoutes = require('../../routes/customers');
const repairRoutes = require('../../routes/repairs');
const dashboardRoutes = require('../../routes/dashboard');
const reportRoutes = require('../../routes/reports');
const settingsRoutes = require('../../routes/settings');
const woocommerceRoutes = require('../../routes/woocommerce');
const deviceOptionsRoutes = require('../../routes/deviceOptions');
const purchaseRoutes = require('../../routes/purchases');
const app = express();
const PORT = Number(process.env.PORT || 3000);
const rootDir = path.resolve(__dirname, '../..');
const publicDir = path.join(rootDir, 'public');
const reactDistDir = path.join(rootDir, 'frontend', 'dist');
const legacyIndexPath = path.join(publicDir, 'index.html');
const reactIndexPath = path.join(reactDistDir, 'index.html');
const frontendMode = String(process.env.FRONTEND_MODE || 'auto').trim().toLowerCase();
app.disable('x-powered-by');
app.use(cors());
app.use(express.json({
    limit: '35mb',
    verify: (req, _res, buf) => {
        req.rawBody = Buffer.from(buf);
    }
}));
function hasReactBuild() {
    return fs.existsSync(reactIndexPath);
}
function resolveFrontendStrategy() {
    if (frontendMode === 'react') {
        return {
            mode: 'react',
            indexPath: reactIndexPath,
            reactActive: true,
            buildAvailable: hasReactBuild()
        };
    }
    if (frontendMode === 'auto') {
        const buildAvailable = hasReactBuild();
        return {
            mode: buildAvailable ? 'react' : 'legacy',
            indexPath: buildAvailable ? reactIndexPath : legacyIndexPath,
            reactActive: buildAvailable,
            buildAvailable
        };
    }
    return {
        mode: 'legacy',
        indexPath: legacyIndexPath,
        reactActive: false,
        buildAvailable: hasReactBuild()
    };
}
function sendIndexFile(res, filePath) {
    res.sendFile(filePath);
}
function frontendRequestHandler(strategy) {
    return (_req, res) => {
        sendIndexFile(res, strategy.indexPath);
    };
}
async function startServer() {
    try {
        await initializeDatabase();
        const frontendStrategy = resolveFrontendStrategy();
        if (frontendMode === 'react' && !frontendStrategy.buildAvailable) {
            throw new Error('FRONTEND_MODE=react requiere un build existente en frontend/dist');
        }
        app.get('/api/health', (_req, res) => {
            res.json({
                ok: true,
                frontend_mode: frontendStrategy.mode,
                requested_frontend_mode: frontendMode,
                react_build_available: frontendStrategy.buildAvailable,
                legacy_entry: '/legacy-app'
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
        app.use('/api/woocommerce', woocommerceRoutes);
        app.use('/api/device-options', deviceOptionsRoutes);
        app.use('/api/purchases', purchaseRoutes);
        if (typeof woocommerceRoutes.initializeWooAutomation === 'function') {
            woocommerceRoutes.initializeWooAutomation();
        }
        app.use('/api', (_req, res) => {
            res.status(404).json({ error: 'Endpoint not found' });
        });
        app.use('/productos', express.static(path.join(publicDir, 'productos')));
        app.use('/css', express.static(path.join(publicDir, 'css')));
        app.use('/js', express.static(path.join(publicDir, 'js')));
        app.get('/legacy-app', (_req, res) => {
            sendIndexFile(res, legacyIndexPath);
        });
        if (frontendStrategy.reactActive) {
            app.use(express.static(reactDistDir));
        }
        app.get('*', frontendRequestHandler(frontendStrategy));
        app.use((err, _req, res, next) => {
            console.error('Unhandled server error:', err);
            if (res.headersSent) {
                return next(err);
            }
            res.status(500).json({ error: 'Internal server error' });
        });
        app.listen(PORT, () => {
            console.log('milo-pro running on http://localhost:' + PORT);
            console.log(`[FRONTEND] mode=${frontendStrategy.mode} requested=${frontendMode} react_build=${frontendStrategy.buildAvailable ? 'yes' : 'no'} legacy=/legacy-app`);
        });
    }
    catch (error) {
        console.error('Server startup failed:', error);
        process.exit(1);
    }
}
void startServer();
