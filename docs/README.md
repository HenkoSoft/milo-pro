# Milo Pro - Sistema de Gestion

## Descripcion
Sistema mini ERP para tienda de reparacion de equipos tecnologicos y venta de productos.

## Estado actual

- Frontend por defecto con `npm start`: React si existe `frontend/dist`
- Frontend legacy: retenido solo como fallback operativo en `/legacy-app`
- Backend runtime: Express con entrada compilada desde TypeScript en `backend/src/server.ts`
- Base de datos por defecto: autodeteccion con preferencia por PostgreSQL cuando existe configuracion PG
- SQLite: fallback operativo y modo explicito para compatibilidad/local
- PostgreSQL: runtime validado localmente de punta a punta desde `backend/src/db`
- Autenticacion: JWT
- Integracion externa: WooCommerce

## Requisitos

- Node.js 20+
- npm

## Instalacion

1. Instalar dependencias:
   `npm install`

2. Iniciar la aplicacion:
   `npm start`

3. Abrir en navegador:
   `http://localhost:3000`

## Scripts principales

- `npm start`: compila el backend TypeScript y levanta la app con `FRONTEND_MODE=auto`
- `npm run start:auto`: usa React si existe `frontend/dist`, o legacy como fallback
- `npm run start:react`: exige build de React y lo sirve como frontend principal
- `npm run start:legacy`: fuerza el frontend legacy
- `npm run start:sqlite`: fuerza SQLite
- `npm run start:postgres`: arranca el backend con `DATABASE_DIALECT=postgres`
- `npm run dev:frontend`: levanta Vite para el frontend nuevo
- `npm run build:backend`: compila el runtime backend TypeScript a `backend/dist`
- `npm run build:frontend`: genera `frontend/dist`
- `npm run typecheck:backend`
- `npm run typecheck:frontend`
- `npm run check:syntax`
- `npm test`
- `npm run validate`: ejecuta build backend + typechecks + check de sintaxis + tests
- `npm run test:db-config`: valida la resolucion `postgres|sqlite|auto`

## Flujo recomendado de validacion

Para validar el estado final del stack con un solo comando:

- `npm run validate`

Para desarrollo del frontend nuevo:

1. `npm run dev:frontend`
2. `npm start` o `npm run start:react`

## PostgreSQL por etapas

La aplicacion ya no usa SQLite como decision por defecto del runtime. El backend resuelve el dialecto en modo `auto`: si encuentra configuracion PostgreSQL, entra por PostgreSQL; si no, cae a SQLite como fallback operativo.

Estado actual del carril PG:

1. adapters y config tipados en `backend/src/db`: listos
2. runtime backend centralizado sobre la abstraccion comun: listo
3. schema bootstrap PostgreSQL: listo
4. importacion real SQLite -> PostgreSQL: validada
5. verify tabla por tabla: validado
6. smoke del backend en `DATABASE_DIALECT=postgres`: validado
7. SQLite queda como fallback explicito (`start:sqlite`) y compatibilidad local

Script disponible para importar datos:

- `npm run validate:postgres`
- `npm run migrate:postgres`
- `npm run preflight:postgres`
- `npm run verify:postgres`
- `npm run smoke:postgres`
- `npm run postgres:cutover-check`
- `npm run test:db-config`

Variables esperadas:

- `DATABASE_DIALECT=postgres|sqlite|auto`
- `DATABASE_URL` o `PGHOST` + `PGDATABASE` + `PGUSER`
- opcional: `PGPASSWORD`, `PGPORT`, `PGSCHEMA`
- opcional: `PG_MIGRATE_TRUNCATE=1` para vaciar tablas antes de importar
- sin `PG_MIGRATE_TRUNCATE=1`, la importacion falla si la base destino ya tiene datos

Resolucion de dialecto:

- `DATABASE_DIALECT=postgres`: fuerza PostgreSQL
- `DATABASE_DIALECT=sqlite`: fuerza SQLite
- `DATABASE_DIALECT=auto` o ausente: usa PostgreSQL si encuentra config PG; si no, cae a SQLite

Promocion operativa actual:

- `npm start` corre con resolucion `auto`
- en cualquier entorno con `DATABASE_URL` o `PGHOST` + `PGDATABASE` + `PGUSER`, el runtime entra por PostgreSQL
- SQLite queda reservado para fallback, fixtures locales o arranque explicito con `npm run start:sqlite`

Smoke test PostgreSQL:

- levanta el backend con `DATABASE_DIALECT=postgres`
- valida `/api/health`
- valida login con `admin / admin123`
- sobre una base vacia, el bootstrap PG ya replica el seed base de SQLite salvo que `MILO_DISABLE_SEED=1`

Verificacion de importacion:

- compara conteos tabla por tabla entre SQLite y PostgreSQL
- sirve para validar la migracion antes del primer smoke completo

Preflight de compatibilidad:

- escanea `routes/`, `services/` y `auth.js`
- detecta patrones SQLite-specific que todavia podrian romper en PostgreSQL

Validacion local del carril PostgreSQL:

- `validate:postgres` encadena build backend, typecheck backend, preflight y tests del adapter/bootstrap
- `validate:postgres` tambien valida la resolucion automatica del dialecto
- no requiere una instancia PostgreSQL real

Ensayo completo contra una instancia PostgreSQL:

- `postgres:cutover-check` ejecuta `validate:postgres` + `migrate:postgres` + `verify:postgres` + `smoke:postgres`
- sirve como paso unico antes de promover PostgreSQL en serio
- el ensayo ya fue ejecutado exitosamente sobre una PostgreSQL local de prueba
- despues del cutover, puede levantarse el runtime con `npm run start:postgres`

Notas de importacion:

- si SQLite tiene huerfanos historicos en relaciones como `suppliers` o `products`, la importacion genera filas sinteticas seguras para preservar integridad referencial
- eso permite completar la migracion sin perder movimientos historicos

## Credenciales por defecto

- Administrador: `admin / admin123`
- Tecnico: `tech / tech123`

## Estructura actual

- `backend/`: scaffold y runtime TypeScript progresivo
- `frontend/`: SPA nueva en React
- `shared/`: tipos compartidos entre frontend y backend
- `routes/`: runtime JS existente preservado durante la transicion
- `services/`: logica de negocio e integraciones
- `public/`: frontend legacy y assets heredados
- `data/`: base SQLite

## Modulos funcionales

- Inventario
- Ventas / POS
- Clientes
- Reparaciones
- Compras / proveedores
- Informes
- Configuracion
- Integracion WooCommerce

## Tecnologias

- Backend: Node.js + Express + TypeScript progresivo
- Frontend: React + TypeScript + Vite + Tailwind
- Base de datos actual: SQLite (`sql.js`)
- Base de datos objetivo: PostgreSQL
- Autenticacion: JWT

## Integraciones

- [WooCommerce Order Sync](./WOO_ORDER_SYNC.md)
- [Migration Plan](./MIGRATION_PLAN.md)

## Nota de migracion

La migracion tecnologica ya avanzo sobre el nuevo stack, y el carril PostgreSQL ya fue probado localmente de punta a punta. React ya queda promovido como frontend principal por defecto; el legacy se conserva solo como fallback operativo en `/legacy-app`. Desde este punto, los cambios pendientes se concentran en consolidacion visual fina, validacion manual y retiro eventual del fallback legacy.

## Licencia
MIT

