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


export interface BalanceCsvOptions {
  incluirDomicilio?: boolean;
}

export async function buildCombinedBalanceCsv(
  facturas: FacturaItem[],
  gastos: BalanceGastoItem[],
  options: BalanceCsvOptions = {},
): Promise<string> {
  const { incluirDomicilio = true } = options;
  const clientes = await fetchClientesSafe();
  const rows: string[] = [];

  let ingresosPagados = 0;
  let ingresosPendientes = 0;
  let gastosPagados = 0;
  let gastosPendientes = 0;

  const metodosPago: Record<string, number> = {};
  const porCuentaQr: Record<string, { total: number; cantidad: number }> = {};
  const productosVendidos: Record<string, { cantidad: number; subtotal: number }> = {};

  const facturasRows: string[] = [
    'ID,Cliente,Tipo Documento,No. Documento,Correo,Fecha,Total,Total sin Domicilio,Estado,Método,Cuenta QR,Pago Efectivo,Pago Transferencia,Tipo Pedido,Costo Domicilio,Notas,Productos',
  ];

  for (const factura of facturas) {
    const cliente = resolveCliente(factura, clientes);
    const fecha = formatDateForCsv(factura.fechaFactura);
    const isPagado = factura.estado === 'pagado' || factura.estado === 'pagada';

    // Extract Costo Domicilio
    const costoDomicilio = factura.domicilios?.[0]?.costoDomicilio 
      ? Number(factura.domicilios[0].costoDomicilio) 
      : 0;

    const baseTotal = Number(factura.total ?? 0);
    const totalSinDom = Math.max(0, baseTotal - costoDomicilio);
    const totalCalculado = incluirDomicilio ? baseTotal : totalSinDom;

    // Extract products
    const productos = (factura.ordenes ?? [])
      .flatMap(o => o.productos ?? [])
      .map(p => {
        const qty = p.cantidad || 1;
        const name = p.productoNombre || 'Producto';
        const sub = p.subtotal || (p.precioUnitario ? p.precioUnitario * qty : 0);

        if (isPagado) {
          if (!productosVendidos[name]) productosVendidos[name] = { cantidad: 0, subtotal: 0 };
          productosVendidos[name].cantidad += qty;
          productosVendidos[name].subtotal += sub;
        }

        return `${qty}x ${name}`;
      })
      .join(' | ');

    // Extract Tipo Pedido
    const tipos = (factura.ordenes ?? [])
      .map(o => o.tipoPedido || '')
      .filter(Boolean);
    const tipoPedido = tipos.length > 0 ? Array.from(new Set(tipos)).join(' + ') : '';

    const cuentaQr = escapeCsvValue(factura.cuentaTransferenciaNombre || '');
    const pagoEf = factura.pagoEfectivo !== undefined && factura.pagoEfectivo !== null ? `"$${formatCurrency(factura.pagoEfectivo)}"` : '""';
    const pagoTrans = factura.pagoTransferencia !== undefined && factura.pagoTransferencia !== null ? `"$${formatCurrency(factura.pagoTransferencia)}"` : '""';

    facturasRows.push(
      `${factura.facturaId ?? ''},${escapeCsvValue(factura.clienteNombre || '')},${escapeCsvValue(cliente?.tipoDocumento || '')},${escapeCsvValue(cliente?.documento || '')},${escapeCsvValue(cliente?.correo || '')},${fecha},"$${formatCurrency(totalCalculado)}","$${formatCurrency(totalSinDom)}",${factura.estado || ''},${factura.metodo || ''},${cuentaQr},${pagoEf},${pagoTrans},${escapeCsvValue(tipoPedido)},"$${formatCurrency(costoDomicilio)}",${escapeCsvValue(factura.descripcion || '')},${escapeCsvValue(productos)}`,
    );

    if (isPagado) {
      ingresosPagados += totalCalculado;
      if (factura.metodo === 'efectivo_transferencia') {
        const ef = Number(factura.pagoEfectivo) || 0;
        const trans = Number(factura.pagoTransferencia) || 0;
        metodosPago['efectivo'] = (metodosPago['efectivo'] || 0) + ef;
        metodosPago['transferencia'] = (metodosPago['transferencia'] || 0) + trans;

        if (trans > 0) {
          const accName = factura.cuentaTransferenciaNombre || 'Sin asignar';
          if (!porCuentaQr[accName]) porCuentaQr[accName] = { total: 0, cantidad: 0 };
          porCuentaQr[accName].total += trans;
          porCuentaQr[accName].cantidad += 1;
        }
      } else {
        const metodo = factura.metodo || 'efectivo';
        metodosPago[metodo] = (metodosPago[metodo] || 0) + totalCalculado;

        if (metodo === 'transferencia' || metodo === 'qr') {
          const accName = factura.cuentaTransferenciaNombre || 'Sin asignar';
          if (!porCuentaQr[accName]) porCuentaQr[accName] = { total: 0, cantidad: 0 };
          porCuentaQr[accName].total += totalCalculado;
          porCuentaQr[accName].cantidad += 1;
        }
      }
    } else if (factura.estado !== 'cancelado') {
      ingresosPendientes += totalCalculado;
    }
  }

  const gastosRows: string[] = ['ID,Concepto,Fecha,Total,Estado,Método'];
  for (const gasto of gastos) {
    const fecha = formatDateForCsv(gasto.fechaFactura);
    gastosRows.push(
      `${gasto.pagosId ?? ''},${escapeCsvValue(gasto.nombreGasto || '')},${fecha},"$${formatCurrency(gasto.total ?? 0)}",${gasto.estado || ''},${gasto.metodo || ''}`,
    );

    if (gasto.estado === 'pagado') gastosPagados += gasto.total ?? 0;
    else if (gasto.estado !== 'cancelado') gastosPendientes += gasto.total ?? 0;
  }

  // ── 1. RESUMEN EJECUTIVO ──────────────────────────────────────────────────
  rows.push('═══ SECCIÓN 1: RESUMEN DE CONTABILIDAD ═══');
  rows.push('Concepto,Monto');
  rows.push(`Ingresos Cobrados (Ventas Pagadas),"$${formatCurrency(ingresosPagados)}"`);
  rows.push(`Ingresos Pendientes (Por cobrar),"$${formatCurrency(ingresosPendientes)}"`);
  rows.push(`Gastos Pagados (Egresos),"$${formatCurrency(gastosPagados)}"`);
  rows.push(`Gastos Pendientes (Por pagar),"$${formatCurrency(gastosPendientes)}"`);
  rows.push(`BALANCE NETO (Ingresos - Gastos Pagados),"$${formatCurrency(ingresosPagados - gastosPagados)}"`);
  rows.push('');

  // ── 2. DESGLOSE MÉTODOS Y CUENTAS DE PAGO ───────────────────────────────
  rows.push('═══ SECCIÓN 2: DESGLOSE POR MÉTODO Y CUENTA DE PAGO ═══');
  rows.push('Método / Cuenta,Total Cobrado');
  for (const [metodo, total] of Object.entries(metodosPago)) {
    rows.push(`${escapeCsvValue(metodo.toUpperCase())},"$${formatCurrency(total)}"`);
  }
  if (Object.keys(porCuentaQr).length > 0) {
    rows.push('--- Cuentas de Transferencia / QR ---,');
    for (const [cuenta, data] of Object.entries(porCuentaQr)) {
      rows.push(`QR ${escapeCsvValue(cuenta)} (${data.cantidad} trans),"$${formatCurrency(data.total)}"`);
    }
  }
  rows.push('');

  // ── 3. PRODUCTOS VENDIDOS ────────────────────────────────────────────────
  rows.push('═══ SECCIÓN 3: PRODUCTOS VENDIDOS (Solo Pagados) ═══');
  rows.push('Producto,Cantidad Vendida,Valor Total Aprox.');
  const productosOrdenados = Object.entries(productosVendidos).sort((a, b) => b[1].cantidad - a[1].cantidad);
  for (const [producto, data] of productosOrdenados) {
    rows.push(`${escapeCsvValue(producto)},${data.cantidad} unds,"$${formatCurrency(data.subtotal)}"`);
  }
  rows.push('');

  // ── 4. FACTURAS DE VENTA ──────────────────────────────────────────────────
  rows.push('═══ SECCIÓN 4: DETALLE DE FACTURAS DE VENTA ═══');
  rows.push(...facturasRows);
  rows.push('');

  // ── 5. GASTOS / EGRESOS ──────────────────────────────────────────────────
  rows.push('═══ SECCIÓN 5: DETALLE DE GASTOS / EGRESOS ═══');
  rows.push(...gastosRows);

  return rows.join('\n');
}