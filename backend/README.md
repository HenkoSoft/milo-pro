# Backend TypeScript Runtime

Esta carpeta ya no es solo un scaffold: ahora contiene la entrada oficial del runtime backend en TypeScript.

Estado actual:

- `backend/src/server.ts` es la entrada real del backend
- `server.js` queda como wrapper de compatibilidad que carga `backend/dist/server.js`
- `npm run build:backend` compila el runtime TypeScript
- `npm start` y `npm run dev:backend*` ya usan el backend compilado desde TypeScript
- las rutas y servicios JS existentes siguen preservados mientras avanza la migracion interna por bloques
- `backend/src/db` ahora define la base tipada para una capa de datos dual SQLite/PostgreSQL
- `backend/src/db/runtime.ts` centraliza el arranque actual de base y hoy mantiene SQLite como runtime activo`r`n- `routes/settings.js` y `routes/dashboard.js` ya pueden consumir el adapter expuesto en `app.locals.database` con fallback legacy

Principios que se mantienen:

- no cambiar contratos REST existentes
- no tocar logica de negocio sin necesidad clara
- seguir migrando backend por bloques pequenos y seguros
- mantener WooCommerce estable y cubierto por tests

Cobertura tipada ya disponible:

- `backend/src/middleware/auth.ts`
- `backend/src/routes/auth.ts`
- `backend/src/routes/settings.ts`
- `backend/src/routes/customers.ts`
- `backend/src/routes/dashboard.ts`
- `backend/src/routes/catalog.ts`
- `backend/src/routes/reports.ts`
- `backend/src/routes/repairs.ts`
- `backend/src/routes/products.ts`
- `backend/src/routes/purchases.ts`
- `backend/src/routes/sales.ts`
- `backend/src/routes/woocommerce.ts`
- `backend/src/services/woo-order-client.ts`
- `backend/src/services/woo-order-utils.ts`
- `backend/src/services/woocommerce-sync-utils.ts`
- `backend/src/services/woocommerce-request.ts`
- `backend/src/db/index.ts`
- `backend/src/db/config.ts`
- `backend/src/db/sqlite-adapter.ts`
- `backend/src/db/postgres-adapter.ts`
- `backend/src/db/runtime.ts`
- `backend/src/db/types.ts`

WooCommerce consolidado:

- `routes/woocommerce.js` como ensamblador principal
- `services/woocommerce-admin-routes.js`
- `services/woocommerce-product-routes.js`
- `services/woocommerce-order-routes.js`
- `services/woocommerce-polling-routes.js`
- `services/woocommerce-admin.js`
- `services/woocommerce-polling.js`
- `services/woo-order-utils.js`
- `services/woocommerce-sync-utils.js`
- `services/woocommerce-request.js`

Comandos de validacion:

- `npm run build:backend`
- `npm run typecheck:backend`
- `npm run check:syntax`
- `npm test`
- `npm run validate`

Migracion a PostgreSQL por etapas:

1. preparar la capa `backend/src/db` con contratos comunes y adapters
2. centralizar el arranque del backend en `backend/src/db/runtime.ts`
3. mantener SQLite como runtime por defecto mientras se adapta el acceso a datos existente
4. introducir PostgreSQL por configuracion (`DATABASE_DIALECT=postgres`) cuando el runtime ya consuma esa capa
5. portar schema, datos y pruebas antes del corte final

Limitacion actual importante:

- si alguien define `DATABASE_DIALECT=postgres`, el backend falla de forma explicita
- eso es intencional: hoy el runtime sigue dependiendo de rutas y servicios sincronicos sobre `database.js`
- el proximo paso real es extender este patron a mas rutas y servicios hasta que el runtime deje de depender de `database.js`

Interpretacion correcta desde este punto:

- la migracion base al nuevo stack ya esta cerrada
- el frontend principal ya es React
- el backend runtime oficial ya arranca desde TypeScript compilado
- lo pendiente a futuro es modernizacion interna adicional, no una migracion estructural base

