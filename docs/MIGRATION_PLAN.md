# Migration Plan

## Resultado final

La migracion base queda cerrada con este estado:

- frontend principal en React + TypeScript + Vite + Tailwind
- backend oficial ejecutando una entrada compilada desde TypeScript (`backend/src/server.ts`)
- API REST conservada
- JWT conservado
- WooCommerce conservado
- SQLite conservado
- frontend legacy retenido solo como fallback operativo en `/legacy-app`

## Fase 0 a Fase 5

Las fases iniciales quedaron cumplidas durante la migracion incremental del frontend, la convivencia con legacy y la estabilizacion del backend Express existente.

## Fase 6

Objetivo original:

- preparar el backend para TypeScript progresivo sin romper el runtime existente

Estado alcanzado:

- existe `backend/tsconfig.json` para typecheck
- existe `backend/tsconfig.build.json` para compilar el runtime real
- existe `backend/src/server.ts` como entrada oficial del backend
- `server.js` queda como wrapper de compatibilidad hacia `backend/dist/server.js`
- `npm start` y `npm run dev:backend*` ya usan el backend compilado desde TypeScript
- `shared/types` centraliza contratos compartidos
- WooCommerce conserva runtime JS estable, pero con amplia cobertura de helpers tipados y modularizacion por rutas/servicios
- `backend/src/db` prepara una capa tipada para migrar la persistencia desde SQLite hacia PostgreSQL por etapas
- `backend/src/db/runtime.ts` centraliza el arranque actual y ya permite inicializar PostgreSQL con schema bootstrap propio

Criterios de aceptacion cumplidos:

- backend compila desde TypeScript con `npm run build:backend`
- backend typecheckea con `npm run typecheck:backend`
- frontend typecheckea con `npm run typecheck:frontend`
- los tests existentes siguen pasando con `npm test`
- la API publica no cambio
- el fallback legacy sigue disponible

Validacion realizada:

- `npm run build:backend`
- `npm run typecheck:backend`
- `npm run typecheck:frontend`
- `npm run check:syntax`
- `npm test`
- `npm run validate`
- smoke start del runtime compilado en `backend/dist/server.js`

## Estado consolidado de WooCommerce

WooCommerce hoy queda repartido asi:

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
- `backend/src/services/woo-order-utils.ts`
- `backend/src/services/woocommerce-sync-utils.ts`
- `backend/src/services/woocommerce-request.ts`

## Hoja de ruta PostgreSQL

Fase PG-1:

- definir capa comun en `backend/src/db`
- mantener SQLite como default
- preparar config y adapters tipados

Fase PG-2:

- centralizar el arranque del backend en la nueva capa de DB
- exponer el dialecto activo desde `/api/health`
- bloquear la activacion prematura de PostgreSQL mientras el runtime aun dependa de `database.js`

Fase PG-3:

- mover el runtime a consumir la abstraccion comun en lugar de depender directo de `database.js`
- adaptar placeholders, transacciones y semantica de inserts para PostgreSQL

Fase PG-4:

- portar schema y datos a PostgreSQL
- validar auth, products, repairs, sales, purchases y WooCommerce sobre PostgreSQL

Fase PG-5:

- habilitar PostgreSQL por configuracion en entornos reales
- dejar SQLite solo como fallback o fixture local si sigue teniendo sentido

Estado PG actual:

- `DATABASE_DIALECT=postgres` ya puede iniciar el adapter y bootstrapear schema base
- `DATABASE_DIALECT=auto` o ausente ya puede resolver PostgreSQL automaticamente cuando existe configuracion PG
- `pg` pasa a ser dependencia del runtime
- PostgreSQL queda promovido operativamente como default cuando existe configuracion PG
- SQLite queda como fallback operativo explicito
- el ensayo real de corte sobre una PostgreSQL local ya paso completo con `postgres:cutover-check`
- la migracion de datos SQLite -> PostgreSQL ya funciona sobre una instancia real
- `verify:postgres` ya valida conteos tabla por tabla despues de importar
- el runtime ya pudo arrancar, responder `/api/health` y autenticar `admin / admin123` sobre PostgreSQL real
- durante la importacion se reconcilian automaticamente huerfanos detectados en SQLite mediante filas sinteticas seguras para `suppliers` y `products`
- la deuda que queda ya no es el arranque ni la importacion base, sino la eliminacion final de caminos legacy residuales y la consolidacion operativa posterior al cutover
- ya existe `npm run validate:postgres` para validar localmente el carril PG sin instancia real
- ya existe `npm run preflight:postgres` para escanear dialectismos SQLite residuales en runtime JS
- ya existe `npm run migrate:postgres` para importar tablas desde SQLite a PostgreSQL respetando ids y orden relacional
- `migrate:postgres` ahora falla si el destino ya tiene datos, salvo que se pida `PG_MIGRATE_TRUNCATE=1`
- ya existe `npm run verify:postgres` para comparar conteos entre ambas bases despues de importar
- ya existe `npm run smoke:postgres` para validar arranque, health y login sobre una instancia PG real
- ya existe `npm run postgres:cutover-check` para ejecutar el ensayo completo de corte sobre una instancia PG real
- ya existe `npm run start:postgres` para forzar el runtime en modo PostgreSQL despues del cutover
- ya existe `npm run start:sqlite` para fallback explicito o compatibilidad local
- el bootstrap PG ya replica el seed base de SQLite cuando la base esta vacia

## Que queda despues de la migracion

Lo que sigue desde este punto ya no es “terminar la migracion”, sino mejora incremental:

- migrar mas runtime JS interno a TS por bloques pequenos
- ampliar tests fuera de Woo
- consolidar PostgreSQL como runtime por defecto en entornos reales
- decidir cuando retirar definitivamente el fallback legacy
- seguir reduciendo deuda tecnica interna
- terminar de eliminar dependencias residuales de `database.js`


## Estado actual de paridad visual del frontend

Referencia obligatoria:

- el frontend legacy en `public/` sigue siendo la fuente de verdad visual
- el frontend React debe copiar estructura, navegacion y flujo observable sin reinterpretar la UX
- `npm start` sigue entrando por legacy por defecto

Hashes del sidebar ya cubiertos con pantalla React propia:

- `#dashboard`
- `#customers`
- `#products`
- `#products-price-update`
- `#products-stock-adjustment`
- `#products-stock-output`
- `#products-stock-query`
- `#products-labels`
- `#products-barcodes`
- `#products-qr`
- `#merchandise-entry`
- `#nc-proveedor`
- `#purchase-query`
- `#nc-query`
- `#supplier-payments`
- `#suppliers`
- `#repairs`
- `#reports`
- `#reports-sales`
- `#reports-purchases`
- `#reports-customers`
- `#reports-delivery-notes`
- `#reports-accounts`
- `#reports-ranking`
- `#reports-cash`
- `#reports-excel`
- `#sales`
- `#sales-delivery-notes`
- `#sales-quotes`
- `#sales-orders`
- `#sales-web-orders`
- `#sales-credit-notes`
- `#sales-collections`
- `#sales-query-invoices`
- `#sales-query-delivery-notes`
- `#sales-query-credit-notes`
- `#sales-query-quotes`
- `#sales-query-orders`
- `#sellers`
- `#sellers-commissions`
- `#sellers-payments`
- `#sellers-sales-report`
- `#cash`
- `#cash-expenses`
- `#cash-withdrawals`
- `#cash-day`
- `#admin-users`
- `#admin-device-options`
- `#admin-categories`
- `#admin-integrations-woocommerce`
- `#tools-import`
- `#tools-export`
- `#tools-backup`
- `#help-center`
- `#help-shortcuts`

Hashes del sidebar que siguen con diferencias funcionales o soporte auxiliar:

- `#products-stock-adjustment`
- `#products-stock-output`
- `#products-stock-query`
- `#products-labels`
- `#products-barcodes`
- `#products-qr`

Notas:

- esos hashes ya no envian al legacy, pero hoy resuelven persistencia o impresion con alcance auxiliar local dentro del frontend React
- el resto de los hashes del sidebar ya no cae en placeholder generico ni en puente directo al legacy
- `#settings` se normaliza a `#admin-integrations-woocommerce`

Siguiente orden recomendado para seguir cerrando paridad:

1. auditoria visual hash por hash contra `public/`
2. smoke testing manual de todos los modulos React
3. decidir cuando volver a promover React como frontend principal
4. recien despues, retirar el fallback legacy si se aprueba
