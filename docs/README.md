# Milo Pro - Sistema de Gestion

## Descripcion
Sistema mini ERP para tienda de reparacion de equipos tecnologicos y venta de productos.

## Requisitos
- Node.js 14+
- npm

## Instalacion

1. Instalar dependencias:
   npm install

2. Iniciar el servidor:
   npm start

3. Abrir en navegador:
   http://localhost:3000

## Credenciales por defecto

- Administrador: admin / admin123
- Tecnico: tech / tech123

## Estructura del proyecto

milo-pro/
├── server.js          # Servidor Express
├── database.js        # Base de datos SQLite
├── routes/            # Rutas API
├── public/           # Frontend
│   ├── index.html
│   ├── css/styles.css
│   └── js/
│       ├── api.js
│       ├── auth.js
│       ├── router.js
│       ├── app.js
│       └── pages/
└── data/             # Base de datos

## Modulos

### Inventario
- CRUD de productos
- Categorias
- Control de stock
- Alertas de stock bajo

### Ventas / POS
- Carrito de compras
- Busqueda de productos
- Multiples metodos de pago
- Actualizacion automatica de stock

### Clientes
- Registro de clientes
- Historial de compras y reparaciones

### Reparaciones
- Creacion de tickets
- Estados: Recibido - Diagnostico - Esperando repuestos - Reparacion - Listo - Entregado
- Impresion de tickets

### Informes
- Ventas del periodo
- Productos mas vendidos
- Estado de reparaciones

## Tecnologias
- Backend: Node.js + Express
- Base de datos: SQLite (better-sqlite3)
- Frontend: Vanilla JavaScript + CSS
- Autenticacion: JWT

## Licencia
MIT
