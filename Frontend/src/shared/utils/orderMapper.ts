import type { Orden, OrderFormState, OrderCartItem } from '../index';

export function mapOrdenToForm(orden: Orden): Partial<OrderFormState> {
  const cart: OrderCartItem[] = (orden.productos || []).map(p => ({
    id: p.id?.toString() || `existing-${Math.random()}`,
    productoNombre: p.producto || 'Producto',
    varianteNombre: '', 
    varianteId: p.varianteId || 0,
    precioUnitario: p.precioUnitario || 0,
    cantidad: p.cantidad || 1,
    sabores: [p.sabor1, p.sabor2, p.sabor3].filter((s): s is string => !!s),
  }));

  const domicilio = orden.domicilios?.[0];

  return {
    tipoPedido: (orden.tipoPedido as 'mesa' | 'domicilio' | 'llevar') || 'mesa',
    nombreCliente: (orden as any).nombreCliente || orden.factura?.clienteNombre || '',
    numeroMesa: orden.tipoPedido === 'mesa' ? ((orden as any).nombreCliente || orden.factura?.clienteNombre || '') : '',
    telefonoCliente: orden.telefonoCliente || (domicilio?.telefono as any) || '',
    selectedAddress: (domicilio?.direccionEntrega as any) || '',
    newAddress: (domicilio?.direccionEntrega as any) || '',
    telefonoDomiciliario: (domicilio?.telefonoDomiciliarioAsignado as any) || '',
    costoDomicilio: domicilio?.costoDomicilio?.toString() || '',
    metodo: orden.factura?.metodo || 'efectivo',
    observaciones: orden.observaciones || '',
    cart,
  };
}
