import type { Orden, OrderFormState, OrderCartItem } from '../index';

export function mapOrdenToForm(orden: Orden): Partial<OrderFormState> {
  const cart: OrderCartItem[] = (orden.productos || []).map(p => ({
    id: p.id?.toString() || `existing-${Math.random()}`,
    productoNombre: p.producto || 'Producto',
    varianteNombre: '', 
    varianteId: p.varianteId || 0,
    precioUnitario: p.precioUnitario || 0,
    cantidad: p.cantidad || 1,
    sabores: (() => {
      // sabor1/2/3 are NOT separate DB columns — embedded in the `producto` string
      // Format: "Pizza Grande (Sabor1 + Sabor2)" or "Jugo Naranja (Leche)"
      // Ignore trailing base suffix "(Leche)" or "(Agua)" before extracting sabores
      const text = (p.producto || '').replace(/\s*\((leche|agua)\)\s*$/i, '').trim();
      const match = text.match(/\(([^)]+)\)\s*$/);
      if (!match) return [];
      const parts = match[1].split(/\s*\+\s*/).map((s: string) => s.trim()).filter(Boolean);
      // Only treat as sabores if they look like flavor names (not size descriptors)
      return parts;
    })(),
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
