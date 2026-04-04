# WooCommerce Order Sync

## Resumen tecnico

La aplicacion local es la fuente maestra para ventas, stock y estados internos. WooCommerce se trata como canal de venta externo:

- `WooCommerce -> webhook/API REST -> WooOrderSyncService -> sales/sale_items/customers/external_order_links/sync_logs`
- La idempotencia se garantiza por `external_order_links(channel, woocommerce_order_id)` y `sales.external_reference`
- El stock se descuenta solo cuando la orden entra en un estado interno configurable que requiere impacto de inventario
- Los cambios posteriores de estado actualizan la venta local sin duplicar la venta ni volver a descontar stock
- Toda orden importada deja trazabilidad completa en `sync_logs`

## Flujo de sincronizacion

1. WooCommerce envia un webhook a `POST /api/woocommerce/webhooks/orders` o la app importa por REST.
2. El payload se valida y se normaliza.
3. Se busca la venta local ya vinculada por `woocommerce_order_id`.
4. Se resuelve o crea el cliente local.
5. Cada linea se intenta mapear por prioridad:
   - `SKU`
   - `products.woocommerce_product_id` o `products.woocommerce_id`
   - si no hay match, se registra incidencia y la orden queda en estado parcial
6. Se crea o actualiza la venta local y su link externo.
7. Si el estado interno requiere stock, se aplica una sola vez; si cambia la orden, se ajusta el delta sin doble descuento.
8. Se registra auditoria en `sync_logs`.

## Riesgos y mitigaciones

- Webhook duplicado: mitigado con llave unica por `woocommerce_order_id`.
- Reintento manual: usa el mismo flujo idempotente que el webhook.
- Cambio de estado repetido: `sales.stock_applied_at` evita repetir descuento.
- Producto sin mapping: no rompe toda la orden; deja log parcial y revision manual.
- Cambios despues de descontar stock: el sistema ajusta delta si la orden sigue en estado que afecta stock; si pasa a estado no stockable luego del descuento, deja advertencia en logs.

## Variables de entorno

- `JWT_SECRET`
- `MILO_DB_FILENAME`
- `MILO_DISABLE_SEED`
- `WOO_ORDER_STATUS_MAP`
- `WOO_ORDER_STOCK_STATUSES`
- `WOO_ORDER_PAID_STATUSES`
- `WOO_ORDER_SALES_CHANNEL`
- `WOO_CUSTOMER_SYNC_STRATEGY`
- `WOO_GENERIC_CUSTOMER_NAME`
- `WOO_SYNC_USER_ID`
- `WOO_WEBHOOK_SECRET`
- `WOO_WEBHOOK_AUTH_TOKEN`
- `WOO_WEBHOOK_SIGNATURE_HEADER`
- `WOO_WEBHOOK_DELIVERY_HEADER`

Tambien pueden persistirse en `woocommerce_sync` desde `PUT /api/woocommerce/config`.

## Configuracion de credenciales

Guardar en la configuracion de WooCommerce:

- `store_url`
- `consumer_key`
- `consumer_secret`
- opcionalmente `webhook_secret`
- opcionalmente `webhook_auth_token`

La importacion manual usa la REST API moderna de WooCommerce sobre `/wp-json/wc/v3/orders`.

## Registro de webhook en WooCommerce

Crear un webhook para eventos de orden:

- Topic: `Order created`
- Topic: `Order updated`
- Delivery URL: `https://tu-dominio/api/woocommerce/webhooks/orders`
- Secret: el mismo valor configurado como `webhook_secret`

Headers esperados:

- firma HMAC base64 en `x-wc-webhook-signature`
- identificador de entrega en `x-wc-webhook-delivery-id` si WooCommerce lo envia

## Sincronizacion manual

Importar una orden por ID:

```bash
npm run sync:woo-orders -- --order-id 1234
```

Importar historico por fecha y estado:

```bash
npm run sync:woo-orders -- --date-from 2026-04-01T00:00:00 --date-to 2026-04-03T23:59:59 --status processing,completed
```

Tambien hay endpoints autenticados:

- `POST /api/woocommerce/orders/import/:id`
- `POST /api/woocommerce/orders/import`
- `GET /api/woocommerce/orders/logs`

## Mapeo de datos

WooCommerce order:

```json
{
  "id": 1205,
  "order_key": "wc_order_abcd1234",
  "status": "processing",
  "currency": "ARS",
  "total": "15000.00",
  "discount_total": "1000.00",
  "total_tax": "0.00",
  "shipping_total": "500.00",
  "payment_method": "bacs",
  "payment_method_title": "Transferencia",
  "billing": {
    "first_name": "Ana",
    "last_name": "Perez",
    "email": "ana@example.com",
    "phone": "+54 11 5555 0000",
    "address_1": "Calle 123",
    "city": "Buenos Aires",
    "state": "BA",
    "country": "AR"
  },
  "line_items": [
    {
      "id": 901,
      "product_id": 501,
      "sku": "SKU-WOO-1",
      "name": "Producto Woo 1",
      "quantity": 2,
      "total": "15000.00"
    }
  ]
}
```

Venta local persistida:

```json
{
  "sales": {
    "channel": "woocommerce",
    "status": "paid",
    "payment_status": "paid",
    "external_status": "processing",
    "external_reference": "woo-order-1205",
    "currency": "ARS",
    "subtotal": 16000,
    "discount_total": 1000,
    "shipping_total": 500,
    "total": 15000,
    "payment_method": "Transferencia"
  },
  "external_order_links": {
    "woocommerce_order_id": 1205,
    "woocommerce_order_key": "wc_order_abcd1234",
    "local_sale_id": 44,
    "external_reference": "woo-order-1205",
    "sync_state": "synced"
  },
  "sale_items": [
    {
      "product_id": 12,
      "external_line_id": "901",
      "external_product_id": "501",
      "sku": "SKU-WOO-1",
      "product_name": "Producto Woo 1",
      "quantity": 2,
      "unit_price": 7500,
      "subtotal": 15000
    }
  ]
}
```

## Tests

Ejecutar:

```bash
npm test
```

Los casos cubiertos:

- creacion de venta importada
- no duplicacion por doble webhook
- cambio de estado sin doble descuento de stock
- producto no mapeado con log parcial
- reintento manual idempotente
