# Milo Pro UI Redesign

## Objetivo

Unificar toda la interfaz de Milo Pro bajo un unico sistema visual y operativo, sin tocar logica de negocio ni procesos actuales.

Principios:

- Misma estructura visual en todos los modulos
- Misma jerarquia de acciones
- Misma logica de formularios, tablas, filtros y modales
- Enfoque escritorio primero, con compatibilidad tablet
- Prioridad en velocidad operativa, lectura y baja tasa de error

---

## Diagnostico actual

Hoy el sistema ya tiene una base funcional, pero conviven tres niveles de UI:

- Base global simple en `public/css/styles.css`
- Modulos evolucionados con mejor lenguaje visual, por ejemplo `Clientes`
- Modulos administrativos mas estructurados, por ejemplo `Administracion` y parte de `Ventas`

Eso genera inconsistencias en:

- Espaciado
- Alturas de controles
- Estructura de paginas
- Jerarquia de botones
- Estilo de tablas
- Uso de modales
- Copys y estados visuales

La propuesta apunta a consolidar todo en un solo design system liviano.

---

## Arquitectura visual propuesta

### 1. Shell global unico

Toda pantalla debe usar siempre esta estructura:

1. Sidebar lateral fija
2. Header superior del modulo
3. Barra contextual del modulo
4. Area de trabajo principal
5. Modal estandar cuando corresponda

### 2. Sidebar

Patron:

- Logo + nombre de empresa
- Usuario actual y rol
- Menu principal expandible por modulo
- Modulo activo resaltado
- Submodulo activo con contraste mas fuerte
- Footer con acciones globales: configuracion, ayuda, cerrar sesion

Secciones del menu:

1. Clientes
2. Articulos
3. Ventas
4. Vendedores
5. Caja
6. Reportes
7. Administracion
8. Herramientas
9. Ayuda

### 3. Header superior

Siempre igual:

- Titulo del modulo
- Subtitulo corto con contexto
- Acciones primarias del modulo a la derecha
- Estado rapido opcional: fecha, sucursal, caja, usuario, lista activa

Ejemplo:

- `Ventas`
- `Facturacion diaria y comprobantes comerciales`
- Botones: `Nuevo`, `Exportar`, `Actualizar`

### 4. Barra contextual

Debajo del header principal, usar una barra de operacion con:

- Buscador principal
- Filtros
- Chips o tabs internas
- Indicadores de cantidad
- Atajos visibles cuando aplique

Regla:

- Si el modulo trabaja por listado, primero van buscador y filtros
- Si el modulo trabaja por operacion, primero van el estado del comprobante y atajos

---

## Sistema de componentes

### 1. Tokens visuales

Definir variables globales unificadas:

- Colores de marca
- Colores de fondo
- Color de texto principal y secundario
- Colores de exito, alerta y error
- Sombras
- Bordes
- Radios
- Alturas de controles
- Escala de espaciado

Escala recomendada:

- `4`
- `8`
- `12`
- `16`
- `20`
- `24`
- `32`

Alturas recomendadas:

- Input: `40px`
- Select: `40px`
- Boton secundario: `36px`
- Boton principal: `40px`
- Filtros compactos: `32px`

### 2. Tipografia

Estilo:

- Fuente: `Segoe UI` o equivalente ya alineado al escritorio Windows
- H1 modulo: `24px / 600`
- H2 seccion: `18px / 600`
- H3 bloque: `15px / 600`
- Texto base: `13px` o `14px`
- Etiqueta de campo: `12px / 600`
- Texto auxiliar: `12px`

### 3. Botones

Estados unificados:

- Primario
- Secundario
- Exito
- Peligro
- Fantasma
- Iconico

Reglas:

- Accion principal siempre abajo a la derecha en formularios
- Cancelar siempre a la izquierda del primario
- Acciones destructivas nunca compartir mismo color que guardar

### 4. Inputs

Reglas:

- Label arriba
- Placeholder corto
- Ayuda debajo solo cuando agregue valor
- Error debajo en rojo
- Foco visible uniforme
- Controles alineados por grilla

### 5. Tablas

Todas las tablas deben compartir:

- Cabecera sticky cuando haya scroll
- Fila hover
- Altura uniforme
- Columna de acciones a la derecha
- Buscador superior
- Paginacion inferior
- Resumen de resultados
- Estado vacio
- Estado cargando

Barra estandar de tabla:

- Titulo
- Buscador
- Filtros
- Acciones globales
- Contador de resultados

### 6. Modales

Estructura unica:

1. Header con titulo y subtitulo opcional
2. Tabs o bloques internos
3. Body con grilla consistente
4. Footer fijo con acciones

Tamanos:

- `modal-sm`
- `modal-md`
- `modal-lg`
- `modal-xl`

Reglas:

- Modal operativo: ancho grande
- Modal de confirmacion: ancho chico
- Footer siempre visible
- Cerrar con `Esc`
- Overlay oscuro uniforme

### 7. Mensajeria

Patrones:

- Exito
- Error
- Advertencia
- Informacion

Reglas:

- Misma ubicacion
- Misma paleta
- Mismo copy pattern
- Confirmacion obligatoria para acciones criticas

---

## Patron funcional por tipo de pantalla

### A. Pantalla de listado

Usar para:

- Clientes
- Articulos planilla
- Vendedores planilla
- Usuarios
- Consultas
- Ingresos/Gastos/Retiros

Estructura:

1. Header del modulo
2. Toolbar con buscador y filtros
3. Tabla principal
4. Paginacion y resumen
5. Panel lateral opcional de detalle rapido

### B. Pantalla operativa de transaccion

Usar para:

- Facturacion
- Remitos
- Presupuestos
- Pedidos
- Nota de credito
- Salida de mercaderia

Estructura:

1. Bloque superior de datos del comprobante
2. Bloque de datos relacionados
3. Campo de carga rapida
4. Tabla de items
5. Panel de totales y acciones
6. Banda de atajos visibles

### C. Pantalla de configuracion

Usar para:

- Configuracion
- Tablas auxiliares
- Offline
- Ayuda

Estructura:

1. Menu interno lateral o tabs verticales
2. Formulario o tabla a la derecha
3. Bloque de acciones abajo

### D. Pantalla dashboard/resumen

Usar para:

- Caja del dia
- Dashboard general
- Estado de sincronizacion

Estructura:

1. Tarjetas KPI arriba
2. Filtros rapidos
3. Detalles en bloques o tablas

---

## Propuesta por modulo

## 1. Clientes

### Listado

Layout:

- Header: `Clientes`
- Toolbar: buscador, filtro por vendedor, filtro por zona, boton `Nuevo Cliente`
- Tabla estandar

Columnas recomendadas:

- Codigo
- R. Social
- Contacto
- Celular
- Localidad
- Cond. IVA
- Vendedor
- Acciones

### Modal Nuevo / Editar

Mantener tabs:

- Datos
- Datos de Facturacion
- Observaciones

Mejora UX:

- Codigo solo lectura arriba a la izquierda
- Datos principales primero
- Facturacion en una grilla 2 columnas
- Lista de precios como cards tipo radio
- Observaciones a ancho completo

Estado actual:

- Este modulo ya tiene una buena base y puede transformarse en patron para el resto

## 2. Articulos

### Shell del modulo

Submenu horizontal o lateral interno:

- Planilla
- Actualizacion de Precios
- Ajuste de Stock
- Salida de Mercaderia
- Consulta de Salidas
- Imprimir Etiquetas
- Codigos de Barra
- Codigos QR

### Planilla

Toolbar:

- Buscador general
- Filtros por marca, rubro, proveedor, categoria
- Botones `Nuevo`, `Importar`, `Actualizar`

Tabla:

- Codigo
- Cód. Prov.
- Descripcion
- Marca
- Rubro
- Categoria
- Stock
- Minimo
- Costo
- Lista activa
- Acciones

### Modal Nuevo Articulo

Tabs:

- Datos
- Listas de precios

Bloques recomendados:

- Identificacion
- Clasificacion
- Stock
- Flags
- Imagen

La tab de listas debe tener:

- Bloque superior de costos e impuestos
- Tabla editable uniforme para Lista 1 a Lista 6

### Ajuste de Stock

Pantalla partida:

- Panel izquierdo: articulos
- Panel derecho: ajustes pendientes

Con barra inferior fija:

- Guardar ajuste
- Cancelar

### Salida de Mercaderia

Patron transaccional:

- Datos superiores
- Campo carga por codigo
- Tabla de items
- Acciones abajo

## 3. Ventas

### Es el modulo mas operativo

Debe priorizar:

- Menos clicks
- Lectura rapida
- Atajos visibles
- Totales siempre presentes

### Facturacion

Layout recomendado:

- Fila 1: datos del comprobante
- Fila 2: cliente
- Fila 3: carga rapida de articulo
- Centro: tabla de items grande
- Lateral derecho o pie fijo: totales
- Footer: acciones

Atajos visibles en una franja dedicada:

- `D`
- `F3`
- `F5`
- Otros atajos ya existentes

### Remitos / Presupuestos / Pedidos

Mismo esqueleto que facturacion.

Cambian:

- Etiquetas
- Acciones
- Totales segun aplique

### Nota de Credito

Debe mantener el mismo patron de comprobante para evitar curva de aprendizaje.

### Cobranzas / Cuenta Corriente

Vista de dos zonas:

- Tab superior o lateral para `Listado de Clientes` y `Cta. Cte. del Cliente`
- Panel lateral derecho con deudores, por vendedor y por zona

### Consultas

Patron unico:

- Encabezado de consulta
- Filtros por fecha
- Buscador
- Tabla
- Acciones `Borrar entre fechas`, `Exportar`, `Imprimir`

## 4. Vendedores

### Planilla

Listado simple con estructura identica a Clientes.

### Alta / Edicion

Modal mediano, 2 columnas, footer fijo.

### Comisiones

Pantalla analitica:

- Filtros arriba
- Tabla central
- Totales abajo o a la derecha
- Acciones finales al pie

### Consulta de Pagos y Reporte de Ventas

Reusar patron de consulta estandar.

## 5. Caja

### Ingresos / Gastos / Retiros

Tres submodulos con mismo patron:

- Buscador
- Filtro fecha
- Tabla
- Boton `Nuevo`

Los tres deben diferenciarse solo por color semantico y titulo.

### Caja del Dia

Vista dashboard operativa:

- Selector de fecha arriba
- Tarjetas KPI
- Cuatro bloques de detalle
- Totales destacados

## 6. Reportes

### Debe ser el modulo mas sistematizado

Propuesta:

- Navegacion lateral por categoria
- Selector de subreporte
- Panel superior de filtros
- Resultados en tabla
- Botonera de salida

Patron fijo:

- Buscar
- Exportar Excel
- Exportar PDF
- Imprimir

Beneficio:

- Un usuario aprende un reporte y aprende todos

## 7. Administracion

### Usuarios

Mantener tabla actual, pero alinearla al patron base:

- Header
- Toolbar
- Tabla
- Paginacion

### Tablas Auxiliares

Usar un CRUD base reutilizable:

- Tabla a la izquierda
- Formulario a la derecha o modal
- Acciones claras

### Configuracion

Usar tabs verticales:

- Datos Generales
- Comprobantes
- Mail
- Borrar datos iniciales

### Solucionar Problemas

Pantalla de herramientas criticas con:

- Cards de accion
- Confirmacion reforzada
- Resultado detallado debajo

## 8. Herramientas

### Offline

Tres vistas:

- Sincronizar articulos
- Consultar precios offline
- Estado de sincronizacion

Patron:

- Cards KPI
- Tabla o buscador
- Boton principal arriba a la derecha

## 9. Ayuda

### Guia de uso

Usar layout de documentacion interna:

- Buscador
- Navegacion lateral
- Contenido central
- Descargar PDF

### Como comprar

Bloques simples de contenido comercial.

### Soporte

Tarjetas de contacto + formulario.

---

## Sistema de consistencia transversal

### 1. Naming visual estandar

Todos los modulos deben usar los mismos nombres de bloques:

- `module-shell`
- `module-header`
- `module-toolbar`
- `module-tabs`
- `module-panel`
- `data-table`
- `form-grid`
- `summary-cards`
- `sticky-actions`

### 2. Componentes reutilizables a crear

En vez de diseñar modulo por modulo desde cero, conviene crear:

- Header de modulo
- Toolbar de filtros
- Tabla unificada
- Paginacion
- Buscador
- Badge de estado
- Modal estandar
- Tabs
- Form grid
- Panel KPI
- Confirm dialog
- Empty state
- Loading state

### 3. Reglas de interaccion

- Siempre Enter confirma una busqueda cuando aplique
- Esc cierra modal
- Doble click en fila abre detalle donde tenga sentido
- Accion primaria siempre misma ubicacion
- Accion eliminar siempre pide confirmacion
- Estados vacios siempre con mensaje accionable

### 4. Accesibilidad operativa

- Contraste legible
- Foco visible
- Areas clickeables amplias
- Navegacion por teclado en modulos de uso intenso

---

## Propuesta tecnica para implementarlo en este repo

## Fase 1. Base global

Actualizar `public/css/styles.css` y crear sistema unificado con:

- Variables de tema
- Grid base
- Botones
- Inputs
- Toolbar
- Tablas
- Modales
- Tabs
- Cards KPI
- Mensajes

Meta:

- No tocar reglas de negocio
- Mejorar toda la base visual primero

## Fase 2. Shell y navegacion

Unificar:

- Sidebar
- Header superior
- Barra contextual
- Estructura de pagina

Meta:

- Todos los modulos montan sobre la misma carcasa

## Fase 3. Formularios y modales

Tomar `Clientes` como referencia de calidad y llevar a un patron comun.

Meta:

- Un solo estilo de modal y formularios

## Fase 4. Tablas y consultas

Crear estilo comun para:

- Listados
- Reportes
- Consultas
- Paginacion

## Fase 5. Modulos de alta operacion

Prioridad:

1. Ventas
2. Articulos
3. Clientes
4. Caja
5. Reportes

## Fase 6. Ajuste fino

- Copys
- Atajos visibles
- Confirmaciones
- Estados vacios
- Estados de error

---

## Recomendacion de implementacion inmediata

Orden recomendado:

1. Crear design system CSS comun
2. Crear layout shell unificado
3. Normalizar `Clientes`, `Administracion` y `Ventas` como modulos patron
4. Llevar `Articulos`, `Caja`, `Vendedores` y `Reportes` al mismo lenguaje
5. Cerrar con `Herramientas` y `Ayuda`

---

## Resultado esperado

Con este rediseño, Milo Pro pasa de ser una suma de pantallas funcionales a un sistema coherente:

- Mas rapido de aprender
- Mas rapido de operar
- Con menos errores de carga
- Mas profesional visualmente
- Mas facil de mantener tecnicamente

Sin cambiar la logica actual, la aplicacion queda preparada para crecer con un lenguaje visual unico y reusable.
