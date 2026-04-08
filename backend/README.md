# Backend TypeScript Runtime

Esta carpeta ya no es solo un scaffold: ahora contiene la entrada oficial del runtime backend en TypeScript.

Estado actual:

- `backend/src/server.ts` es la entrada real del backend
- `server.js` queda como wrapper de compatibilidad que carga `backend/dist/server.js`
- `npm run build:backend` compila el runtime TypeScript
- `npm start` y `npm run dev:backend*` ya usan el backend compilado desde TypeScript
- las rutas y servicios JS existentes siguen preservados mientras avanza la migracion interna por bloques
- `backend/src/db` ahora define la base tipada para una capa de datos dual SQLite/PostgreSQL
- `backend/src/db/runtime.ts` centraliza el arranque actual de base
- el runtime usa PostgreSQL como base principal
- PostgreSQL ya puede inicializar schema base propio desde `backend/src/db/postgres-schema.ts`
- `routes/settings.js` y `routes/dashboard.js` ya pueden consumir el adapter expuesto en `app.locals.database`

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
- `npm run start:postgres`
- `npm run test:db-config`

Migracion a PostgreSQL por etapas:

1. preparar la capa `backend/src/db` con contratos comunes y adapters
2. centralizar el arranque del backend en `backend/src/db/runtime.ts`
3. mantener SQLite solo como soporte tecnico durante la transicion
4. introducir PostgreSQL por configuracion (`DATABASE_DIALECT=postgres`) con schema bootstrap propio
5. portar datos reales y terminar de eliminar caminos residuales antes del cierre final

Script de importacion de datos ya disponible:

- `npm run validate:postgres`
- `npm run migrate:postgres`
- `npm run preflight:postgres`
- `npm run verify:postgres`
- `npm run smoke:postgres`
- `npm run postgres:cutover-check`
- usa `data/milo-pro.db` o fallback `data/techfix.db`
- requiere `DATABASE_URL` o `PGHOST` + `PGDATABASE` + `PGUSER`
- acepta `DATABASE_DIALECT=postgres|sqlite`
- acepta `PG_MIGRATE_TRUNCATE=1` para reiniciar las tablas objetivo
- si el destino ya tiene datos y no se define `PG_MIGRATE_TRUNCATE=1`, la importacion falla de forma explicita
- `validate:postgres` valida el carril PG sin requerir una base real
- `test:db-config` valida la resolucion `postgres|sqlite`
- `preflight:postgres` detecta patrones SQLite-specific residuales en runtime JS
- `verify:postgres` compara conteos entre SQLite y PostgreSQL tabla por tabla
- el smoke test valida arranque + `/api/health` + login base sobre PostgreSQL
- `postgres:cutover-check` encadena validacion, importacion, verificacion y smoke sobre una instancia PG real
- el bootstrap PG ya crea `admin / admin123` y `tech / tech123` sobre base vacia, igual que SQLite, salvo que `MILO_DISABLE_SEED=1`
- el cutover completo ya fue ejecutado exitosamente sobre una PostgreSQL local de prueba
- la importacion ahora reconcilia huerfanos historicos de SQLite creando filas sinteticas seguras cuando faltan `suppliers` o `products` referenciados
- despues del ensayo, el runtime puede levantarse con `npm run start:postgres`
- si `DATABASE_DIALECT` queda ausente, el runtime usa PostgreSQL

Limitacion actual importante:

- `DATABASE_DIALECT=postgres` ya no esta bloqueado en el arranque del runtime
- importacion, verificacion y smoke ya fueron validados con una base PG real
- PostgreSQL ya queda promovido operativamente como default
- SQLite queda solo como herramienta tecnica puntual
- el proximo paso real ya no es tecnico base, sino seguir eliminando dependencias residuales de `database.js`

Interpretacion correcta desde este punto:

- la migracion base al nuevo stack ya esta cerrada
- el frontend principal ya queda fijado en React
- el backend runtime oficial ya arranca desde TypeScript compilado
- lo pendiente a futuro es modernizacion interna adicional, no una migracion estructural base

