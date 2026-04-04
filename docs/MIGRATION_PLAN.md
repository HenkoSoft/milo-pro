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

## Que queda despues de la migracion

Lo que sigue desde este punto ya no es “terminar la migracion”, sino mejora incremental:

- migrar mas runtime JS interno a TS por bloques pequenos
- ampliar tests fuera de Woo
- decidir cuando retirar definitivamente el fallback legacy
- seguir reduciendo deuda tecnica interna
