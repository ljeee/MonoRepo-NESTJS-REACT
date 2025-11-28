# Endpoints diarios y pendientes

Se agregaron endpoints para consultar registros del día y los pendientes del día en las siguientes entidades:

## Endpoints agregados

### Domicilios
- `GET /domicilios/dia` — Todos los domicilios creados hoy
- `GET /domicilios/dia/pendientes` — Domicilios de hoy con estado pendiente o sin estado

### Ordenes
- `GET /ordenes/dia` — Todas las órdenes creadas hoy
- `GET /ordenes/dia/pendientes` — Órdenes de hoy con estado pendiente o sin estado

### Facturas Ventas
- `GET /facturas-ventas/dia` — Todas las facturas de ventas creadas hoy
- `GET /facturas-ventas/dia/pendientes` — Facturas de ventas de hoy con estado pendiente o sin estado

### Facturas Pagos
- `GET /facturas-pagos/dia` — Todos los pagos de facturas creados hoy
- `GET /facturas-pagos/dia/pendientes` — Pagos de facturas de hoy con estado pendiente o sin estado

## Detalles técnicos
- El filtro "del día" usa la fecha/hora local del servidor (00:00:00 a 23:59:59.999).
- "Pendiente" se considera cuando el campo estado es 'pendiente' o NULL.
- Los endpoints devuelven un array de registros.

Puedes probarlos directamente desde Postman o navegador si no requieren body.
