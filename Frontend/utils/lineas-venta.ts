/** Lo que puede traer una línea vendida: cruda del servidor (`producto` = texto) o pasada por `mapFactura` (`productoNombre`). */
interface LineaVendida {
  producto?: unknown;
  productoNombre?: string | null;
  productoBase?: string | null;
  varianteNombre?: string | null;
}

/**
 * Texto de una línea vendida para mostrar/exportar: "Pizza - Grande (Paisa + Carnes)". `mapFactura` lo deja en
 * `productoNombre`; las facturas CRUDAS del servidor (copia de seguridad de Monitoreo) lo traen en `producto`
 * y antes salían como «1x Producto».
 */
export function textoLinea(p: LineaVendida): string {
  const crudo = typeof p.producto === 'string' ? p.producto : '';
  return (p.productoNombre || crudo || '').trim() || 'Producto';
}

/**
 * Clave para AGRUPAR líneas vendidas: producto + variante cuando la línea trae el detalle estructurado (como el
 * resumen de productos del servidor); si no, su texto (lo que hacía la exportación hasta ahora).
 */
export function productoAgrupado(p: LineaVendida): string {
  if (p.productoBase) return p.varianteNombre ? `${p.productoBase} - ${p.varianteNombre}` : p.productoBase;
  return textoLinea(p);
}
