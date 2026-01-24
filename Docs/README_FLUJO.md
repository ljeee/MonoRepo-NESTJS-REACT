# Dback - Flujo de creación de órdenes y facturas

## Flujo principal
- Al crear una orden:
  1. Se crea primero una factura (`facturas_ventas`).
  2. Se crea la orden (`ordenes`) ligada a esa factura.
  3. Si la orden es tipo `mesa`, el proceso termina ahí.
  4. Si la orden es tipo `domicilio`:
     - Se solicita el teléfono del cliente y del domiciliario.
     - Si el cliente no existe, se crea con nombre, dirección y teléfono.
     - Si el domiciliario no existe, se crea con su teléfono.
     - Se crea un registro en `domicilios` enlazando la orden, la factura, el cliente y el domiciliario.

## Campos por defecto
- `estado` de facturas y órdenes: "pendiente"
- `fecha_factura` y `fecha_orden`: fecha y hora actual

## Ejemplo de creación de orden
### Orden tipo mesa
```json
{
  "tipoPedido": "mesa"
}
```

### Orden tipo domicilio
```json
{
  "tipoPedido": "domicilio",
  "telefonoCliente": 3001112222,
  "nombreCliente": "Ana Perez",
  "direccionCliente": "Calle 10 #5-20",
  "telefonoDomiciliario": 3109998888
}
```

## Notas
- Si el cliente o domiciliario ya existen, solo se enlazan.
- Todos los datos y relaciones se crean automáticamente según el tipo de pedido.
