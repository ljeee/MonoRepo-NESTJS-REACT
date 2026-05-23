import { Platform } from 'react-native';
import type { FacturaPago, FacturaVenta, Cliente } from '@/src/shared';
import type { FacturaItem } from '../components/facturas/FacturaShared';
import { api } from '../services/api';
import { formatCurrency } from '@/src/shared';
import { getLocalDateString } from '../src/shared/utils/dateRange';

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
  // If it's a date-only string YYYY-MM-DD, parse directly to avoid TZ shift
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [year, month, day] = value.split('-');
    return `${day}/${month}/${year}`;
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return getLocalDateString(date).split('-').reverse().join('/');
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
  // ── Headers must match exactly what the backend controller reads ──────────
  // Backend lookup keys (after normalize + lowercase):
  //   id, cliente, tipo documento, no. documento, correo, fecha, total, estado, metodo, pago efectivo, pago transferencia, notas, productos
  const rows: string[] = [
    'ID,Cliente,Tipo Documento,No. Documento,Correo,Fecha,Total,Estado,Metodo,Pago Efectivo,Pago Transferencia,Notas,Productos',
  ];

  for (const f of facturas) {
    const cliente = resolveCliente(f, clientes);

    // ── One row per factura (NOT per product) to avoid duplicate imports ──
    const id           = String(f.facturaId ?? '');
    const clienteNom   = escapeCsvValue(f.clienteNombre || '');
    const tipoDoc      = escapeCsvValue(cliente?.tipoDocumento || '');
    const documento    = escapeCsvValue(cliente?.documento || '');
    const correo       = escapeCsvValue(cliente?.correo || '');

    // ISO date (YYYY-MM-DD) — backend can always parse this reliably
    const rawFecha = f.fechaFactura ? new Date(f.fechaFactura) : null;
    const fecha = rawFecha && !isNaN(rawFecha.getTime())
      ? getLocalDateString(rawFecha)
      : '';

    // Plain number — backend strips non-numeric chars anyway, but let's be clean
    const total  = String(Number(f.total ?? 0));
    const estado = f.estado || 'pendiente';
    const metodo = f.metodo || 'efectivo';
    const pagoEfectivo = f.pagoEfectivo !== undefined && f.pagoEfectivo !== null ? String(f.pagoEfectivo) : '';
    const pagoTransferencia = f.pagoTransferencia !== undefined && f.pagoTransferencia !== null ? String(f.pagoTransferencia) : '';
    const notas  = escapeCsvValue(f.descripcion || '');

    // Compact product summary in a single quoted cell
    const productos = (f.ordenes ?? [])
      .flatMap((o) => o.productos ?? [])
      .map((p) => `${p.cantidad ?? 1}x ${p.productoNombre || 'Producto'}`)
      .join(' | ');

    rows.push(
      `${id},${clienteNom},${tipoDoc},${documento},${correo},${fecha},${total},${estado},${metodo},${pagoEfectivo},${pagoTransferencia},${notas},${escapeCsvValue(productos)}`,
    );
  }

  return rows.join('\n');
}


export async function buildCombinedBalanceCsv(facturas: FacturaItem[], gastos: BalanceGastoItem[]): Promise<string> {
  const clientes = await fetchClientesSafe();
  const rows: string[] = ['Tipo,ID,Nombre/Cliente,Tipo Documento,No. Documento,Correo,Fecha,Total,Estado,Método,Pago Efectivo,Pago Transferencia,Tipo Pedido,Costo Domicilio,Notas,Productos'];

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

    const pagoEf = factura.pagoEfectivo !== undefined && factura.pagoEfectivo !== null ? `"$${formatCurrency(factura.pagoEfectivo)}"` : '""';
    const pagoTrans = factura.pagoTransferencia !== undefined && factura.pagoTransferencia !== null ? `"$${formatCurrency(factura.pagoTransferencia)}"` : '""';

    rows.push(
      `Factura,${factura.facturaId ?? ''},${escapeCsvValue(factura.clienteNombre || '')},${escapeCsvValue(cliente?.tipoDocumento || '')},${escapeCsvValue(cliente?.documento || '')},${escapeCsvValue(cliente?.correo || '')},${fecha},"$${formatCurrency(factura.total ?? 0)}",${factura.estado || ''},${factura.metodo || ''},${pagoEf},${pagoTrans},${escapeCsvValue(tipoPedido)},"$${formatCurrency(costoDomicilio)}",${escapeCsvValue(factura.descripcion || '')},${escapeCsvValue(productos)}`,
    );

    if (factura.estado === 'pagado') {
      ingresosPagados += factura.total ?? 0;
      if (factura.metodo === 'efectivo_transferencia') {
        const ef = Number(factura.pagoEfectivo) || 0;
        const trans = Number(factura.pagoTransferencia) || 0;
        metodosPago['efectivo'] = (metodosPago['efectivo'] || 0) + ef;
        metodosPago['transferencia'] = (metodosPago['transferencia'] || 0) + trans;
      } else {
        const metodo = factura.metodo || 'efectivo';
        metodosPago[metodo] = (metodosPago[metodo] || 0) + (factura.total ?? 0);
      }
    }
    else if (factura.estado !== 'cancelado') ingresosPendientes += factura.total ?? 0;
  }

  for (const gasto of gastos) {
    const fecha = formatDateForCsv(gasto.fechaFactura);
    rows.push(
      `Gasto,${gasto.pagosId ?? ''},${escapeCsvValue(gasto.nombreGasto || '')},"","","",${fecha},"$${formatCurrency(gasto.total ?? 0)}",${gasto.estado || ''},${gasto.metodo || ''},"","","","","","",`,
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