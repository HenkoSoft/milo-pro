# Milo Pro - Sistema de Gestion

## Descripcion
Sistema mini ERP para tienda de reparacion de equipos tecnologicos y venta de productos.

## Estado actual

- Frontend principal: React + TypeScript + Vite + Tailwind
- Backend runtime: Express con entrada compilada desde TypeScript en `backend/src/server.ts`
- Base de datos: SQLite (`sql.js`)
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
- `npm test`

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
- Base de datos: SQLite (`sql.js`)
- Autenticacion: JWT

## Integraciones

- [WooCommerce Order Sync](./WOO_ORDER_SYNC.md)
- [Migration Plan](./MIGRATION_PLAN.md)

## Nota de migracion

La migracion base al nuevo stack ya quedo cerrada. Desde este punto, los cambios pendientes se consideran mejoras incrementales o consolidacion tecnica, no una migracion estructural pendiente.

## Licencia
MIT
