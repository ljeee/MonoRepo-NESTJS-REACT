import { Platform } from 'react-native';
import type { FacturaPago } from '../types/models';
import type { FacturaItem } from '../components/facturas/FacturaShared';
import { formatCurrency } from './formatNumber';

type BalanceGastoItem = FacturaPago;

export function escapeCsvValue(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return '"' + value.replace(/"/g, '""') + '"';
  }
  return value;
}

export function downloadCsv(csv: string, filename: string) {
  if (Platform.OS !== 'web') return;
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 100);
}

export function buildCombinedBalanceCsv(facturas: FacturaItem[], gastos: BalanceGastoItem[]): string {
  const rows: string[] = ['Tipo,ID,Nombre/Cliente,Fecha,Total,Estado,Método,Tipo Pedido,Costo Domicilio,Notas,Productos'];

  let ingresosPagados = 0;
  let ingresosPendientes = 0;
  let gastosPagados = 0;
  let gastosPendientes = 0;

  const metodosPago: Record<string, number> = {};
  const productosVendidos: Record<string, number> = {};

  for (const factura of facturas) {
    const fecha = factura.fechaFactura ? new Date(factura.fechaFactura).toLocaleDateString('es-CO') : '';
    
    // Extract products and count them
    const productos = (factura.ordenes ?? [])
      .flatMap(o => o.productos ?? [])
      .map(p => {
        const qty = p.cantidad || 1;
        const name = p.productoNombre || 'Producto';
        
        // Count sold products ONLY if factura is paid
        if (factura.estado === 'pagado') {
          productosVendidos[name] = (productosVendidos[name] || 0) + qty;
        }

        return `${qty}x ${name}`;
      })
      .join(' | ');

    // Extract Tipo Pedido
    const tipos = (factura.ordenes ?? [])
      .map(o => o.tipoPedido || '')
      .filter(Boolean);
    const tipoPedido = tipos.length > 0 ? Array.from(new Set(tipos)).join(' + ') : '';

    // Extract Costo Domicilio
    const costoDomicilio = factura.domicilios?.[0]?.costoDomicilio 
      ? Number(factura.domicilios[0].costoDomicilio) 
      : 0;

    rows.push(
      `Factura,${factura.facturaId ?? ''},${escapeCsvValue(factura.clienteNombre || '')},${fecha},"$${formatCurrency(factura.total ?? 0)}",${factura.estado || ''},${factura.metodo || ''},${escapeCsvValue(tipoPedido)},"$${formatCurrency(costoDomicilio)}",${escapeCsvValue(factura.descripcion || '')},${escapeCsvValue(productos)}`,
    );

    if (factura.estado === 'pagado') {
      ingresosPagados += factura.total ?? 0;
      const metodo = factura.metodo || 'Sin método';
      metodosPago[metodo] = (metodosPago[metodo] || 0) + (factura.total ?? 0);
    }
    else if (factura.estado !== 'cancelado') ingresosPendientes += factura.total ?? 0;
  }

  for (const gasto of gastos) {
    const fecha = gasto.fechaFactura ? new Date(gasto.fechaFactura).toLocaleDateString('es-CO') : '';
    rows.push(
      `Gasto,${gasto.pagosId ?? ''},${escapeCsvValue(gasto.nombreGasto || '')},${fecha},"$${formatCurrency(gasto.total ?? 0)}",${gasto.estado || ''},${gasto.metodo || ''},"","","",`,
    );

    if (gasto.estado === 'pagado') gastosPagados += gasto.total ?? 0;
    else if (gasto.estado !== 'cancelado') gastosPendientes += gasto.total ?? 0;
  }

  rows.push('');
  rows.push('RESUMEN DE CONTABILIDAD,,,,,,,,,,');
  rows.push(`Ingresos Pagados (Ganancias),,,,"$${formatCurrency(ingresosPagados)}",,,,,,`);
  rows.push(`Ingresos Pendientes,,,,"$${formatCurrency(ingresosPendientes)}",,,,,,`);
  rows.push(`Gastos Pagados (Pérdidas),,,,"$${formatCurrency(gastosPagados)}",,,,,,`);
  rows.push(`Gastos Pendientes,,,,"$${formatCurrency(gastosPendientes)}",,,,,,`);
  rows.push(`Balance Total (Ganancias - Pérdidas),,,,"$${formatCurrency(ingresosPagados - gastosPagados)}",,,,,,`);

  // Resumen Métodos de Pago
  rows.push('');
  rows.push('RESUMEN POR MÉTODO DE PAGO (Solo Pagados),,,,,,,,,,');
  for (const [metodo, total] of Object.entries(metodosPago)) {
    rows.push(`${escapeCsvValue(metodo.toUpperCase())},,,,"$${formatCurrency(total)}",,,,,,`);
  }

  // Resumen Productos Vendidos
  rows.push('');
  rows.push('RESUMEN DE PRODUCTOS VENDIDOS (Solo Pagados),,,,,,,,,,');
  const productosOrdenados = Object.entries(productosVendidos).sort((a, b) => b[1] - a[1]);
  for (const [producto, cantidad] of productosOrdenados) {
    rows.push(`${escapeCsvValue(producto)},,,,${cantidad} unds,,,,,,`);
  }

  return rows.join('\n');
}