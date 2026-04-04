# Migration Plan

## Fase 0

Objetivo:

- crear una base moderna en paralelo con React + TypeScript + Vite + Tailwind
- mantener intactos Express, REST, JWT, WooCommerce y SQLite
- no reemplazar todavia el frontend legacy de `public/`

Archivos agregados o modificados:

- `frontend/*`
- `package.json`

Criterios de aceptacion:

- existe un frontend nuevo aislado en `frontend/`
- el backend actual sigue arrancando igual
- el frontend nuevo compila con TypeScript
- el frontend nuevo tiene router, layout y cliente API base
- el frontend legacy sigue siendo compatible

## Fase 1

Objetivo:

- conectar login real con JWT existente
- restaurar sesion con `/api/auth/me`
- proteger rutas del frontend nuevo
- mantener coexistencia con el frontend legacy

Criterios de aceptacion:

- login funcional contra API actual
- logout funcional
- persistencia de sesion local
- shell autenticado sin cambiar backend

## Fase 2

Objetivo:

- migrar `dashboard`, `customers` y `settings`
- conservar la API actual sin cambios
- dejar WooCommerce fuera de esta fase por riesgo de acoplamiento

Criterios de aceptacion:

- dashboard de solo lectura funcionando con la API actual
- customers con listado, busqueda, alta, edicion y borrado
- settings generales funcionando con permisos de admin
- el backend legacy sigue pasando tests y syntax check
- el frontend nuevo compila, testea y builda

Riesgos:

- diferencias funcionales entre vistas legacy y nuevas
- borrado accidental de campos si el formulario no envia el payload completo
- mezclar settings generales con WooCommerce antes de tiempo

Rollback:

- volver a exponer solo el flujo legacy para estos modulos
- conservar `frontend/` sin activarlo como interfaz principal
- revertir cambios de router y navegacion del frontend nuevo

Validacion manual:

- login en frontend nuevo
- abrir dashboard y verificar metricas
- buscar, crear, editar y eliminar clientes
- editar settings como admin
- comprobar que el legacy sigue funcionando

Validacion automatica:

- `npm run check:syntax`
- `npm test`
- `npm run typecheck:frontend`
- `npm run test:frontend`
- `npm run build:frontend`

## Fase 3

Objetivo:

- migrar `products`, `repairs` y una vista auxiliar de `catalog`
- mantener intactos los endpoints actuales de Express
- evitar cambios en ventas y WooCommerce hasta una fase posterior

Criterios de aceptacion:

- productos con listado, filtros, alta, edicion y borrado usando la API actual
- reparaciones con listado, detalle, cambio de estado y alta inicial
- catalogo auxiliar visible para categorias, marcas, tipos y modelos
- router React expone los nuevos modulos sin quitar el frontend legacy
- backend y frontend siguen compilando, testeando y buildando

Riesgos:

- `products` sigue acoplado a sync Woo e imagenes, aunque esta fase solo consume los contratos actuales
- `repairs` tiene logica de estados y detalle que puede diferir en microinteracciones respecto del legacy
- la vista de catalogo es de apoyo y no reemplaza todavia la administracion completa de tablas auxiliares

Rollback:

- quitar `/products`, `/repairs` y `/catalog` del router React
- volver a usar esos flujos desde el frontend legacy mientras se corrige el modulo nuevo
- conservar los archivos nuevos sin activarlos como interfaz principal

Validacion manual:

- iniciar sesion en el frontend nuevo
- abrir `Articulos` y probar busqueda, alta, edicion y borrado con usuario admin
- abrir `Reparaciones`, crear una reparacion, editar detalle y cambiar estado
- abrir `Catalogo` y verificar categorias, marcas, tipos y modelos
- confirmar que el legacy sigue disponible en `Convivencia`

Validacion automatica:

- `npm run check:syntax`
- `npm test`
- `npm run typecheck:frontend`
- `npm run test:frontend`
- `npm run build:frontend`

## Fase 4

Objetivo:

- migrar `sales` y `web-orders` al frontend React con alcance controlado
- conservar intacta la logica de stock, JWT, WooCommerce y SQLite del backend actual
- evitar reimplementar en esta fase todo el flujo legacy de facturacion avanzada

Criterios de aceptacion:

- ventas con alta local, composicion de items e historial usando la API actual
- pedidos web con feed online, detalle y cambio de estado
- rutas React nuevas sin romper el frontend legacy
- backend y frontend siguen compilando, testeando y buildando

Riesgos:

- `sales` descuenta stock y dispara sync Woo en backend, por lo que cualquier error de UI puede impactar inventario real
- el modulo React no replica todavia toda la facturacion legacy, listas de precio ni cobranzas avanzadas
- el cambio de estado en pedidos web depende de contratos sensibles con WooCommerce y debe validarse manualmente

Rollback:

- quitar `/sales` y `/web-orders` del router React
- volver a operar ventas y pedidos web desde el frontend legacy
- conservar los archivos nuevos sin hacerlos interfaz principal

Validacion manual:

- iniciar sesion en el frontend nuevo
- abrir `Ventas`, componer una venta local y confirmar que se registra
- revisar el historial de ventas y la numeracion del comprobante
- abrir `Pedidos web`, seleccionar un pedido online y cambiar su estado
- confirmar que `Convivencia` sigue disponible para el flujo legacy

Validacion automatica:

- `npm run check:syntax`
- `npm test`
- `npm run typecheck:frontend`
- `npm run test:frontend`
- `npm run build:frontend`

## Fase 5

Objetivo:

- servir el build React desde Express sin perder el frontend legacy
- introducir un selector operativo de frontend para `legacy`, `react` y `auto`
- dejar un rollback instantaneo sin tocar la API ni la base de datos

Criterios de aceptacion:

- Express puede arrancar en modo legacy, react o auto usando `FRONTEND_MODE`
- si React queda activo, el frontend legacy sigue disponible en `/legacy-app`
- `FRONTEND_MODE=react` falla rapido si no existe `frontend/dist`
- el endpoint `/api/health` informa el modo de frontend resuelto
- backend y frontend siguen compilando, testeando y buildando

Riesgos:

- cambiar el catch-all del servidor puede afectar navegacion si no existe build o si se usa un modo equivocado
- el frontend legacy sigue dependiendo de `/css`, `/js` y `/productos`, por lo que esos assets no deben moverse todavia
- `auto` es seguro para convivencia, pero produccion deberia usar un modo explicito para evitar sorpresas operativas

Rollback:

- arrancar con `npm run start:legacy` o `npm run dev:backend:legacy`
- mantener `/legacy-app` como ruta estable de contingencia
- volver a dejar `FRONTEND_MODE=legacy` como configuracion por defecto si aparece cualquier incidencia

Validacion manual:

- correr `npm run start:legacy` y confirmar que abre el frontend viejo
- correr `npm run start:auto` con build presente y confirmar que abre React
- abrir `/legacy-app` cuando React este activo y confirmar que carga el legacy
- consultar `/api/health` y verificar `frontend_mode`, `requested_frontend_mode` y `react_build_available`

Validacion automatica:

- `npm run check:syntax`
- `npm test`
- `npm run typecheck:frontend`
- `npm run test:frontend`
- `npm run build:frontend`

## Fase 6

Objetivo:

- preparar el backend para TypeScript progresivo sin cambiar todavia el runtime actual en JavaScript
- crear contratos compartidos entre frontend y backend para modulos estables
- dejar un `typecheck:backend` que permita avanzar modulo por modulo

Criterios de aceptacion:

- existe `backend/tsconfig.json` sin afectar Express actual
- existe estructura base `backend/src` y `shared/types`
- auth, customers, settings, dashboard y WooCommerce tienen helpers y tipos compartidos iniciales
- el comando `npm run typecheck:backend` pasa sin requerir migrar todavia archivos JS existentes
- WooCommerce conserva su runtime actual, pero con normalizacion tipada en config, logs, filtros de importacion, polling, helpers puros de ordenes y utilidades de sync/request
- backend y frontend siguen compilando, testeando y buildando

Riesgos:

- usar TypeScript desde `frontend/node_modules` es un puente temporal y no la solucion final
- WooCommerce sigue siendo el modulo de mayor riesgo por dependencias externas, aunque esta fase evita reescribir sincronizacion
- todavia no hay migracion real de rutas JS a TS, solo base de tipado y contratos compartidos
- si los contratos runtime cambian sin actualizar `shared/types`, el tipado puede dar una falsa sensacion de cobertura

Rollback:

- eliminar `backend/` y `shared/` si hiciera falta volver atras
- quitar `typecheck:backend` de `package.json`
- conservar intacto el runtime actual en `server.js`, `routes/` y `services/`

Validacion manual:

- abrir `backend/README.md` y verificar que la ruta de migracion sea clara
- revisar `shared/types` y confirmar que reflejan contratos existentes
- ejecutar `npm run typecheck:backend`

Validacion automatica:

- `npm run typecheck:backend`
- `npm run check:syntax`
- `npm test`
- `npm run typecheck:frontend`
- `npm run test:frontend`
- `npm run build:frontend`

## Migracion cerrada

La migracion puede considerarse cerrada en terminos funcionales y operativos:

- frontend nuevo en `frontend/` con React, TypeScript, Vite y Tailwind
- autenticacion JWT reutilizando la API existente
- modulos React migrados para dashboard, customers, settings, products, repairs, sales, web-orders y catalogo auxiliar
- Express puede servir `legacy`, `react` o `auto` sin perder rollback rapido
- backend con scaffold TypeScript en `backend/` y contratos compartidos en `shared/types`
- normalizacion progresiva de rutas JS existentes de riesgo bajo y medio
- WooCommerce dividido en modulos de rutas y utilidades para bajar acoplamiento sin reescribir la sincronizacion`r`n- carril TypeScript extendido tambien a `backend/src/services/woo-order-utils.ts`, `backend/src/services/woocommerce-sync-utils.ts` y `backend/src/services/woocommerce-request.ts`
- cobertura automatica real sobre sync de ordenes Woo, config y rutas HTTP de WooCommerce

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

Proximo paso recomendado:

- consolidar commits por bloques para dejar checkpoints claros
- si se sigue refactorizando Woo, extraer solo bloques chicos de `services/woocommerce-sync.js`
- mantener la regla actual: primero helpers puros y pruebas, despues logica transaccional


