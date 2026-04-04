# Backend TypeScript Scaffold

Esta carpeta prepara la migracion progresiva del backend a TypeScript sin reemplazar todavia el runtime actual en JavaScript.

Principios de esta fase:

- no mover ni renombrar rutas Express existentes
- no cambiar contratos REST existentes
- no tocar la logica de WooCommerce salvo necesidad clara
- usar `shared/types` para contratos ya consumidos por frontend y backend

Primer alcance tipado:

- auth
- customers
- settings
- dashboard
- categories
- deviceOptions
- reports
- repairs
- products
- purchases
- sales
- woocommerce (helpers tipados de config, logs, filtros y status)

Piezas ya preparadas:

- `backend/src/middleware/auth.ts` con helpers tipados para token y rol admin
- `backend/src/routes/auth.ts` con normalizacion y saneado de contratos de auth
- `backend/src/routes/settings.ts` con normalizacion de payload y defaults de settings
- `backend/src/routes/customers.ts` con normalizacion de payloads y detalle tipado de customer
- `backend/src/routes/dashboard.ts` con builders tipados para stats, alerts y actividad reciente
- `backend/src/routes/catalog.ts` con helpers tipados de categorias, marcas, tipos y modelos
- `backend/src/routes/reports.ts` con saneado tipado de agregados y revenue
- `backend/src/routes/repairs.ts` con normalizacion de payloads y serializacion de reparaciones
- `backend/src/routes/products.ts` con saneado base para productos
- `backend/src/routes/purchases.ts` con normalizacion de proveedores, compras, pagos y NC
- `backend/src/routes/sales.ts` con normalizacion de payloads y serializacion segura de ventas
- `backend/src/routes/woocommerce.ts` con helpers tipados para configuracion, logs, filtros de importacion y estado de polling
- `backend/src/services/woo-order-client.ts` con sanitizacion tipada de filtros para fetch paginado de ordenes Woo`r`n- `backend/src/services/woo-order-utils.ts` con helpers tipados de normalizacion y mapeo de ordenes Woo`r`n- `backend/src/services/woocommerce-sync-utils.ts` con helpers tipados de atributos, imagenes y normalizacion basica de productos Woo`r`n- `backend/src/services/woocommerce-request.ts` con contratos tipados para requests remotos a WooCommerce y WordPress

Comando de validacion:

- `npm run typecheck:backend`

Estado consolidado de WooCommerce:

- `routes/woocommerce.js` ahora funciona principalmente como ensamblador de modulos
- `services/woocommerce-admin-routes.js` concentra config, status, test y disconnect
- `services/woocommerce-product-routes.js` concentra sync de productos, reconcile, logs, reintento de imagenes y webhook de productos
- `services/woocommerce-order-routes.js` concentra importacion manual, logs y webhooks de ordenes
- `services/woocommerce-polling-routes.js` concentra polling y cleanup
- `services/woocommerce-admin.js` concentra normalizacion y saneado de config, logs, status y polling
- `services/woocommerce-polling.js` concentra el manager de polling
- `services/woo-order-utils.js` concentra helpers puros de normalizacion y mapeo de ordenes Woo
- `services/woocommerce-sync-utils.js` concentra helpers puros de transporte, atributos, imagenes y normalizacion basica
- `services/woocommerce-request.js` concentra requests remotos a WooCommerce y WordPress`r`n- `backend/src/services/woo-order-utils.ts` replica en TypeScript la capa pura de ordenes Woo`r`n- `backend/src/services/woocommerce-sync-utils.ts` replica en TypeScript la capa pura de sync de productos Woo`r`n- `backend/src/services/woocommerce-request.ts` replica en TypeScript la capa de requests remotos de Woo

Cobertura automatica agregada:

- `tests/woo-order-sync.test.js`
- `tests/woo-order-config.test.js`
- `tests/woocommerce-routes.test.js`

Siguiente paso recomendado:

- consolidar commits por bloques de migracion y refactor de Woo para facilitar rollback logico
- si se sigue refactorizando, extraer categorias/atributos o payload de producto desde `services/woocommerce-sync.js` en bloques chicos
- mantener la estrategia actual: primero helpers puros y tests, despues cualquier cambio mas profundo de sincronizacion


