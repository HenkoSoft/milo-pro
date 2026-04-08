# Milo Pro - Sistema de Gestion

## Descripcion
Sistema mini ERP para tienda de reparacion de equipos tecnologicos y venta de productos.

## Estado actual

- Frontend por defecto con `npm start`: React
- Backend runtime: Express con entrada compilada desde TypeScript en `backend/src/server.ts`
- Base de datos por defecto: PostgreSQL
- SQLite: disponible solo para mantenimiento o tareas tecnicas explicitas
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

- `npm start`: compila el backend TypeScript y levanta la app React
- `npm run start:react`: exige build de React y lo sirve como frontend principal
- `npm run start:postgres`: arranca el backend con `DATABASE_DIALECT=postgres`
- `npm run dev:frontend`: levanta Vite para el frontend nuevo
- `npm run build:backend`: compila el runtime backend TypeScript a `backend/dist`
- `npm run build:frontend`: genera `frontend/dist`
- `npm run typecheck:backend`
- `npm run typecheck:frontend`
- `npm run check:syntax`
- `npm test`
- `npm run validate`: ejecuta build backend + typechecks + check de sintaxis + tests
- `npm run test:db-config`: valida la resolucion `postgres|sqlite`

## Flujo recomendado de validacion

Para validar el estado final del stack con un solo comando:

- `npm run validate`

Para desarrollo del frontend nuevo:

1. `npm run dev:frontend`
2. `npm start` o `npm run start:react`

## PostgreSQL por etapas

La aplicacion ya no usa SQLite como decision por defecto del runtime. El backend arranca en PostgreSQL salvo que se fuerce SQLite de manera explicita para mantenimiento tecnico.

Estado actual del carril PG:

1. adapters y config tipados en `backend/src/db`: listos
2. runtime backend centralizado sobre la abstraccion comun: listo
3. schema bootstrap PostgreSQL: listo
4. importacion real SQLite -> PostgreSQL: validada
5. verify tabla por tabla: validado
6. smoke del backend en `DATABASE_DIALECT=postgres`: validado
7. SQLite queda reservado para mantenimiento tecnico puntual

Script disponible para importar datos:

- `npm run validate:postgres`
- `npm run migrate:postgres`
- `npm run preflight:postgres`
- `npm run verify:postgres`
- `npm run smoke:postgres`
- `npm run postgres:cutover-check`
- `npm run test:db-config`

Variables esperadas:

- `DATABASE_DIALECT=postgres|sqlite`
- `DATABASE_URL` o `PGHOST` + `PGDATABASE` + `PGUSER`
- opcional: `PGPASSWORD`, `PGPORT`, `PGSCHEMA`
- opcional: `PG_MIGRATE_TRUNCATE=1` para vaciar tablas antes de importar
- sin `PG_MIGRATE_TRUNCATE=1`, la importacion falla si la base destino ya tiene datos

Resolucion de dialecto:

- `DATABASE_DIALECT=postgres`: fuerza PostgreSQL
- `DATABASE_DIALECT=sqlite`: fuerza SQLite para mantenimiento tecnico
- ausente o `DATABASE_DIALECT=postgres`: usa PostgreSQL

Promocion operativa actual:

- `npm start` corre con PostgreSQL como runtime principal
- SQLite queda reservado para mantenimiento puntual

Smoke test PostgreSQL:

- levanta el backend con `DATABASE_DIALECT=postgres`
- valida `/api/health`
- valida login con `admin / admin123`
- sobre una base vacia, el bootstrap PG ya replica el seed base de SQLite salvo que `MILO_DISABLE_SEED=1`

Verificacion de importacion:

- compara conteos tabla por tabla entre SQLite y PostgreSQL
- sirve para validar la migracion antes del primer smoke completo

Preflight de compatibilidad:

- escanea el runtime JS activo dentro de `backend/src`
- detecta patrones SQLite-specific que todavia podrian romper en PostgreSQL

Validacion local del carril PostgreSQL:

- `validate:postgres` encadena build backend, typecheck backend, preflight y tests del adapter/bootstrap
- `validate:postgres` tambien valida la resolucion del dialecto activo
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

- `backend/src/config`: configuracion y compatibilidad (`auth.js`, `database.js`)
- `backend/src/controllers`: controladores y normalizadores tipados
- `backend/src/routes`: rutas Express operativas del runtime
- `backend/src/services`: logica de negocio e integraciones
- `backend/src/middlewares`: middlewares
- `backend/src/models`: espacio reservado para modelos de dominio
- `backend/src/db`: adapters y runtime de base de datos
- `frontend/src/components`: componentes reutilizables
- `frontend/src/pages`: paginas base
- `frontend/src/hooks`: hooks compartidos
- `frontend/src/services`: cliente HTTP y servicios del frontend
- `frontend/src/utils`: utilidades del frontend
- `shared/`: tipos compartidos entre frontend y backend
- `public/`: assets heredados y recursos estaticos conservados
- `data/`: base SQLite para soporte tecnico puntual

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
- Base de datos principal: PostgreSQL
- Base de datos auxiliar para mantenimiento: SQLite (`sql.js`)
- Autenticacion: JWT

## Integraciones

- [WooCommerce Order Sync](./WOO_ORDER_SYNC.md)
- [Migration Plan](./MIGRATION_PLAN.md)

## Nota de migracion

La migracion tecnologica base ya quedo cerrada sobre el nuevo stack. React es la entrada principal del frontend y PostgreSQL es el runtime principal de base de datos. Desde este punto, los cambios pendientes ya son de mantenimiento o mejora incremental.

## Licencia
MIT

