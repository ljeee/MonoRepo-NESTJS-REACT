import { Platform } from 'react-native';
import type { FacturaPago } from '../types/models';
import type { FacturaItem } from '../components/facturas/FacturaShared';
import type { Cliente } from '../types/models';
import { api } from '../services/api';
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

function formatDateForCsv(value?: string): string {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('es-CO');
}

function normalizePhone(value?: string): string {
  return String(value || '').replace(/\D/g, '');
}

function resolveCliente(factura: FacturaItem, clientes: Cliente[]): Cliente | undefined {
  const telefonoDomicilio = normalizePhone((factura as any).domicilios?.[0]?.telefono);
  if (telefonoDomicilio) {
    const matchByPhone = clientes.find((c) => normalizePhone(c.telefono) === telefonoDomicilio);
    if (matchByPhone) return matchByPhone;
  }
  const byName = (factura.clienteNombre || '').trim().toLowerCase();
  if (!byName) return undefined;
  return clientes.find((c) => (c.clienteNombre || '').trim().toLowerCase() === byName);
}

async function fetchClientesSafe(): Promise<Cliente[]> {
  try {
    return await api.clientes.getAll();
  } catch {
    return [];
  }
}

export async function buildFacturasBackupCsv(facturas: FacturaItem[]): Promise<string> {
  const clientes = await fetchClientesSafe();
  const rows: string[] = [
    'ID,Cliente,Tipo Documento,No. Documento,Correo,Fecha,Total Factura,Estado,Método,Producto,Cantidad,Precio Unitario,Subtotal',
  ];

  for (const f of facturas) {
    const cliente = resolveCliente(f, clientes);
    const id = String(f.facturaId ?? '');
    const clienteNombre = escapeCsvValue(f.clienteNombre || '');
    const tipoDoc = escapeCsvValue(cliente?.tipoDocumento || '');
    const documento = escapeCsvValue(cliente?.documento || '');
    const correo = escapeCsvValue(cliente?.correo || '');
    const fecha = formatDateForCsv(f.fechaFactura);
    const total = String(f.total ?? 0);
    const estado = f.estado || 'pendiente';
    const metodo = f.metodo || '';

    const productos = (f.ordenes ?? []).flatMap((o) => o.productos ?? []);

    if (productos.length === 0) {
      rows.push(`${id},${clienteNombre},${tipoDoc},${documento},${correo},${fecha},${total},${estado},${metodo},,,,`);
      continue;
    }

    for (const p of productos) {
      const nombre = escapeCsvValue(p.productoNombre || 'Producto');
      const cant = p.cantidad ?? 1;
      const precio = p.precioUnitario ?? 0;
      const sub = cant * precio;
      rows.push(`${id},${clienteNombre},${tipoDoc},${documento},${correo},${fecha},${total},${estado},${metodo},${nombre},${cant},${precio},${sub}`);
    }
  }

  return rows.join('\n');
}

export async function buildCombinedBalanceCsv(facturas: FacturaItem[], gastos: BalanceGastoItem[]): Promise<string> {
  const clientes = await fetchClientesSafe();
  const rows: string[] = ['Tipo,ID,Nombre/Cliente,Tipo Documento,No. Documento,Correo,Fecha,Total,Estado,Método,Tipo Pedido,Costo Domicilio,Notas,Productos'];

  let ingresosPagados = 0;
  let ingresosPendientes = 0;
  let gastosPagados = 0;
  let gastosPendientes = 0;

  const metodosPago: Record<string, number> = {};
  const productosVendidos: Record<string, number> = {};

  for (const factura of facturas) {
    const cliente = resolveCliente(factura, clientes);
    const fecha = formatDateForCsv(factura.fechaFactura);
    
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
      `Factura,${factura.facturaId ?? ''},${escapeCsvValue(factura.clienteNombre || '')},${escapeCsvValue(cliente?.tipoDocumento || '')},${escapeCsvValue(cliente?.documento || '')},${escapeCsvValue(cliente?.correo || '')},${fecha},"$${formatCurrency(factura.total ?? 0)}",${factura.estado || ''},${factura.metodo || ''},${escapeCsvValue(tipoPedido)},"$${formatCurrency(costoDomicilio)}",${escapeCsvValue(factura.descripcion || '')},${escapeCsvValue(productos)}`,
    );

    if (factura.estado === 'pagado') {
      ingresosPagados += factura.total ?? 0;
      const metodo = factura.metodo || 'Sin método';
      metodosPago[metodo] = (metodosPago[metodo] || 0) + (factura.total ?? 0);
    }
    else if (factura.estado !== 'cancelado') ingresosPendientes += factura.total ?? 0;
  }

  for (const gasto of gastos) {
    const fecha = formatDateForCsv(gasto.fechaFactura);
    rows.push(
      `Gasto,${gasto.pagosId ?? ''},${escapeCsvValue(gasto.nombreGasto || '')},"","","",${fecha},"$${formatCurrency(gasto.total ?? 0)}",${gasto.estado || ''},${gasto.metodo || ''},"","","",`,
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