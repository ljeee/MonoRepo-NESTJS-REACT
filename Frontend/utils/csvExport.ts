import { Platform } from 'react-native';
import type { FacturaPago, FacturaVenta, Cliente } from '@/src/shared';
import type { FacturaItem } from '../components/facturas/FacturaShared';
import { api } from '../services/api';
import {
  cobrado,
  formatCurrency,
  isAnulada,
  isCobrada,
  montoEfectivo,
  montoTransferencia,
  nombreCategoria,
  porCobrar,
  resumirFacturas,
  resumirGastos,
  tipoDeGasto,
  TIPO_GASTO_META,
  transferenciasPorCuenta,
} from '@/src/shared';
import { transferenciasFilas } from './exportData';
import type { FiltroCuentaTransferencia } from './exportData';
import { getLocalDateString } from '../src/shared/utils/dateRange';
import { productoAgrupado, textoLinea } from './lineas-venta';

type BalanceGastoItem = FacturaPago;

export function escapeCsvValue(value: string): string {
  // Inyección de fórmulas: Excel ejecuta celdas que empiezan con = + - @ (o tab/CR).
  // Nombres de cliente llegan de ClientWeb/WhatsApp, así que se neutralizan con un
  // apóstrofo inicial. Los números (incluidos negativos) se dejan intactos.
  if (/^[=+\-@\t\r]/.test(value) && !/^-?\d[\d.,]*$/.test(value)) {
    value = `'${value}`;
  }
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return '"' + value.replace(/"/g, '""') + '"';
  }
  return value;
}

/** Descarga un archivo ya armado (p. ej. el CSV que genera el servidor). Solo web. */
export function descargarBlob(blob: Blob, filename: string) {
  if (Platform.OS !== 'web') return;
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
      .map((p) => `${p.cantidad ?? 1}x ${textoLinea(p)}`)
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

const money = (n: number) => `"$${formatCurrency(n)}"`;

/**
 * CSV contable del rango: todas las cifras con las definiciones únicas (cobrado topado, abonos de las
 * parciales, mixtas repartidas, anuladas fuera, QR por cuenta) y los egresos por tipo y categoría.
 * Recibe las listas COMPLETAS del rango (nunca una página).
 */
export async function buildCombinedBalanceCsv(
  facturas: FacturaItem[],
  gastos: BalanceGastoItem[],
  options: BalanceCsvOptions = {},
): Promise<string> {
  const { incluirDomicilio = true } = options;
  const clientes = await fetchClientesSafe();
  const rows: string[] = [];

  const costoDomicilioDe = (f: FacturaItem) => (f.domicilios?.[0]?.costoDomicilio ? Number(f.domicilios[0].costoDomicilio) : 0);
  const v = resumirFacturas(facturas);
  const g = resumirGastos(gastos);
  // "Sin domicilio": el costo del domicilio sale de lo facturado y de lo cobrado (lo que se le paga al domiciliario).
  let domFacturado = 0;
  let domCobrado = 0;
  const productosVendidos: Record<string, { cantidad: number; subtotal: number }> = {};

  const facturasRows: string[] = [
    'ID,Cliente,Tipo Documento,No. Documento,Correo,Fecha,Total,Total sin Domicilio,Estado,Cobrado,Por Cobrar,Método,Cuenta QR,Pago Efectivo,Pago Transferencia,Tipo Pedido,Costo Domicilio,Notas,Productos',
  ];

  for (const factura of facturas) {
    const cliente = resolveCliente(factura, clientes);
    const fecha = formatDateForCsv(factura.fechaFactura);
    const anulada = isAnulada(factura);
    const cobradoF = cobrado(factura);

    const costoDomicilio = costoDomicilioDe(factura);
    const baseTotal = Number(factura.total ?? 0);
    const totalSinDom = Math.max(0, baseTotal - costoDomicilio);
    if (!anulada) {
      domFacturado += costoDomicilio;
      domCobrado += Math.min(costoDomicilio, cobradoF);
    }
    const totalCalculado = incluirDomicilio ? baseTotal : totalSinDom;

    // Extract products
    const productos = (factura.ordenes ?? [])
      .flatMap(o => o.productos ?? [])
      .map(p => {
        const qty = p.cantidad || 1;
        const name = productoAgrupado(p);
        const sub = p.subtotal || (p.precioUnitario ? p.precioUnitario * qty : 0);

        if (isCobrada(factura)) {
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

    // Cuenta(s) a las que entró lo cobrado por QR (varias si se abonó a cuentas distintas)
    const cuentaQr = escapeCsvValue(
      transferenciasPorCuenta(factura)
        .map((c) => c.cuenta ?? 'Sin asignar')
        .join(' + '),
    );
    // Efectivo y QR COBRADOS (para una parcial, lo abonado por cada vía)
    const pagoEf = money(montoEfectivo(factura));
    const pagoTrans = money(montoTransferencia(factura));

    facturasRows.push(
      `${factura.facturaId ?? ''},${escapeCsvValue(factura.clienteNombre || '')},${escapeCsvValue(cliente?.tipoDocumento || '')},${escapeCsvValue(cliente?.documento || '')},${escapeCsvValue(cliente?.correo || '')},${fecha},"$${formatCurrency(totalCalculado)}","$${formatCurrency(totalSinDom)}",${factura.estado || ''},${money(cobradoF)},${money(porCobrar(factura))},${factura.metodo || ''},${cuentaQr},${pagoEf},${pagoTrans},${escapeCsvValue(tipoPedido)},"$${formatCurrency(costoDomicilio)}",${escapeCsvValue(factura.descripcion || '')},${escapeCsvValue(productos)}`,
    );
  }

  const facturado = incluirDomicilio ? v.facturado : v.facturado - domFacturado;
  const cobradoNeto = incluirDomicilio ? v.cobrado : v.cobrado - domCobrado;

  const costos = g.porTipo.find((t) => t.tipo === 'costo');
  const operativos = g.porTipo.find((t) => t.tipo === 'gasto');
  const sinClasificar = g.porTipo.find((t) => t.tipo === 'sin_clasificar');
  const utilidadBruta = cobradoNeto - (costos?.pagados ?? 0);
  const utilidadOperativa = utilidadBruta - (operativos?.pagados ?? 0) - (sinClasificar?.pagados ?? 0);

  const gastosRows: string[] = ['ID,Concepto,Fecha,Total,Estado,Método,Tipo,Categoría'];
  for (const gasto of gastos) {
    gastosRows.push(
      `${gasto.pagosId ?? ''},${escapeCsvValue(gasto.nombreGasto || '')},${formatDateForCsv(gasto.fechaFactura)},"$${formatCurrency(gasto.total ?? 0)}",${gasto.estado || ''},${gasto.metodo || ''},${escapeCsvValue(TIPO_GASTO_META[tipoDeGasto(gasto)].label)},${escapeCsvValue(nombreCategoria(gasto.categoria))}`,
    );
  }

  // ── 1. RESUMEN EJECUTIVO ──────────────────────────────────────────────────
  rows.push('═══ SECCIÓN 1: RESUMEN DE CONTABILIDAD ═══');
  rows.push('Concepto,Monto');
  rows.push(`Facturado (ventas válidas${incluirDomicilio ? '' : ', sin domicilios'}),${money(facturado)}`);
  rows.push(`Ingresos Cobrados (incluye abonos),${money(cobradoNeto)}`);
  rows.push(`Ingresos Pendientes (Por cobrar),${money(v.porCobrar)}`);
  rows.push(`Costos Pagados (insumos, mercancía, empaques),${money(costos?.pagados ?? 0)}`);
  rows.push(`UTILIDAD BRUTA (Cobrado - Costos),${money(utilidadBruta)}`);
  rows.push(`Gastos Operativos Pagados (nómina, servicios...),${money(operativos?.pagados ?? 0)}`);
  rows.push(`Egresos Pagados SIN CLASIFICAR,${money(sinClasificar?.pagados ?? 0)}`);
  rows.push(`Egresos Pendientes (Por pagar),${money(g.pendientes)}`);
  rows.push(`BALANCE NETO (Cobrado - Egresos Pagados),${money(utilidadOperativa)}`);
  rows.push(`Facturas anuladas (no cuentan),${v.anuladas}`);
  rows.push('');

  // ── 2. DESGLOSE MÉTODOS Y CUENTAS DE PAGO ───────────────────────────────
  rows.push('═══ SECCIÓN 2: DESGLOSE POR MÉTODO Y CUENTA DE PAGO (cobrado) ═══');
  rows.push('Método / Cuenta,Total Cobrado');
  rows.push(`EFECTIVO,${money(v.efectivo)}`);
  rows.push(`TRANSFERENCIA / QR,${money(v.transferencia)}`);
  if (v.porCuenta.length > 0) {
    rows.push('--- Cuentas de Transferencia / QR ---,');
    for (const c of v.porCuenta) {
      rows.push(`QR ${escapeCsvValue(c.cuenta)} (${c.facturas} fact.),${money(c.monto)}`);
    }
  }
  rows.push('');

  // ── 3. EGRESOS POR TIPO Y CATEGORÍA ──────────────────────────────────────
  rows.push('═══ SECCIÓN 3: EGRESOS POR TIPO Y CATEGORÍA ═══');
  rows.push('Tipo,Categoría,Cantidad,Total,Pagados');
  for (const c of g.porCategoria) {
    rows.push(`${escapeCsvValue(TIPO_GASTO_META[c.tipo].label)},${escapeCsvValue(nombreCategoria(c.categoria))},${c.cantidad},${money(c.total)},${money(c.pagados)}`);
  }
  for (const t of g.porTipo.filter((x) => x.cantidad > 0)) {
    rows.push(`TOTAL ${escapeCsvValue(TIPO_GASTO_META[t.tipo].label.toUpperCase())},,${t.cantidad},${money(t.total)},${money(t.pagados)}`);
  }
  rows.push('');

  // ── 4. PRODUCTOS VENDIDOS ────────────────────────────────────────────────
  rows.push('═══ SECCIÓN 4: PRODUCTOS VENDIDOS (Solo Pagados) ═══');
  rows.push('Producto,Cantidad Vendida,Valor Total Aprox.');
  const productosOrdenados = Object.entries(productosVendidos).sort((a, b) => b[1].cantidad - a[1].cantidad);
  for (const [producto, data] of productosOrdenados) {
    rows.push(`${escapeCsvValue(producto)},${data.cantidad} unds,${money(data.subtotal)}`);
  }
  rows.push('');

  // ── 5. FACTURAS DE VENTA ──────────────────────────────────────────────────
  rows.push('═══ SECCIÓN 5: DETALLE DE FACTURAS DE VENTA ═══');
  rows.push(...facturasRows);
  rows.push('');

  // ── 6. GASTOS / EGRESOS ──────────────────────────────────────────────────
  rows.push('═══ SECCIÓN 6: DETALLE DE GASTOS / EGRESOS ═══');
  rows.push(...gastosRows);

  return rows.join('\n');
}

/** Listado COMPLETO de transferencias del rango: una fila por (factura, cuenta); con `filtro`, solo esa cuenta. */
export function buildTransferenciasCsv(facturas: FacturaItem[], filtro?: FiltroCuentaTransferencia): string {
  const filas = transferenciasFilas(facturas, filtro);
  const rows = ['Factura,Fecha,Cliente,Cuenta,Estado,Método,Monto QR'];
  for (const x of filas) {
    rows.push(
      `${x.facturaId ?? ''},${formatDateForCsv(x.fecha)},${escapeCsvValue(x.cliente)},${escapeCsvValue(x.cuenta)},${x.factura.estado || ''},${x.factura.metodo || ''},${money(x.monto)}`,
    );
  }
  rows.push('');
  rows.push('Cuenta,Facturas,Total');
  const porCuenta = new Map<string, { cuenta: string; facturas: Set<number | undefined>; monto: number }>();
  for (const x of filas) {
    const clave = x.cuentaId != null ? `id:${x.cuentaId}` : x.cuenta;
    const fila = porCuenta.get(clave) ?? { cuenta: x.cuenta, facturas: new Set<number | undefined>(), monto: 0 };
    fila.monto += x.monto;
    fila.facturas.add(x.facturaId);
    porCuenta.set(clave, fila);
  }
  for (const c of [...porCuenta.values()].sort((a, b) => b.monto - a.monto)) {
    rows.push(`${escapeCsvValue(c.cuenta)},${c.facturas.size},${money(c.monto)}`);
  }
  rows.push(`TOTAL,,${money(filas.reduce((t, x) => t + x.monto, 0))}`);
  return rows.join('\n');
}

/** Egresos del rango con su tipo (costo / gasto) y categoría, más el total por categoría. */
export function buildEgresosCsv(gastos: BalanceGastoItem[]): string {
  const g = resumirGastos(gastos);
  const rows = ['ID,Concepto,Fecha,Total,Estado,Método,Tipo,Categoría,Descripción'];
  for (const x of gastos) {
    rows.push(
      `${x.pagosId ?? ''},${escapeCsvValue(x.nombreGasto || '')},${formatDateForCsv(x.fechaFactura)},${money(x.total ?? 0)},${x.estado || ''},${x.metodo || ''},${escapeCsvValue(TIPO_GASTO_META[tipoDeGasto(x)].label)},${escapeCsvValue(nombreCategoria(x.categoria))},${escapeCsvValue(x.descripcion || '')}`,
    );
  }
  rows.push('');
  rows.push('Tipo,Categoría,Cantidad,Total,Pagados');
  for (const c of g.porCategoria) {
    rows.push(`${escapeCsvValue(TIPO_GASTO_META[c.tipo].label)},${escapeCsvValue(nombreCategoria(c.categoria))},${c.cantidad},${money(c.total)},${money(c.pagados)}`);
  }
  rows.push(`TOTAL EGRESOS,,${g.cantidad},${money(g.total)},${money(g.pagados)}`);
  return rows.join('\n');
}
