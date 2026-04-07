# Milo Pro - Sistema de Gestion

## Descripcion
Sistema mini ERP para tienda de reparacion de equipos tecnologicos y venta de productos.

## Estado actual

- Frontend por defecto con `npm start`: legacy en `public/`
- Frontend React disponible en paralelo para la migracion visual con paridad
- Backend runtime: Express con entrada compilada desde TypeScript en `backend/src/server.ts`
- Base de datos activa: SQLite (`sql.js`)
- Migracion de base futura: PostgreSQL planificado por etapas desde `backend/src/db`
- Autenticacion: JWT
- Integracion externa: WooCommerce
- Frontend legacy: disponible solo como fallback operativo en `/legacy-app`

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

- `npm start`: compila el backend TypeScript y levanta la app
- `npm run start:auto`: usa React si existe `frontend/dist`, o legacy como fallback
- `npm run start:react`: exige build de React y lo sirve como frontend principal
- `npm run start:legacy`: fuerza el frontend legacy
- `npm run dev:frontend`: levanta Vite para el frontend nuevo
- `npm run build:backend`: compila el runtime backend TypeScript a `backend/dist`
- `npm run build:frontend`: genera `frontend/dist`
- `npm run typecheck:backend`
- `npm run typecheck:frontend`
- `npm run check:syntax`
- `npm test`
- `npm run validate`: ejecuta build backend + typechecks + check de sintaxis + tests

## Flujo recomendado de validacion

Para validar el estado final del stack con un solo comando:

- `npm run validate`

Para desarrollo del frontend nuevo:

1. `npm run dev:frontend`
2. `npm run start:auto` o `npm run start:react`

## PostgreSQL por etapas

La aplicacion sigue usando SQLite como runtime actual. La migracion a PostgreSQL se va a hacer sin corte brusco. Si hoy alguien define `DATABASE_DIALECT=postgres`, el backend falla de forma explicita para evitar estados ambiguos:

1. crear adapters y config tipados en `backend/src/db`
2. mover el runtime a una abstraccion comun de acceso a datos
3. portar schema y datos a PostgreSQL
4. activar PostgreSQL por configuracion cuando toda la validacion este verde

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

La migracion tecnologica ya avanzo sobre el nuevo stack, pero por regla del proyecto la referencia visual sigue siendo el frontend legacy hasta cerrar la auditoria final de paridad. Desde este punto, los cambios pendientes se concentran en consolidacion visual, validacion manual y la futura sustitucion de SQLite por PostgreSQL.

## Licencia
MIT

