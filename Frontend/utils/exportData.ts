import type { FacturaItem } from '../components/facturas/FacturaShared';
import type { FacturaPago } from '@/src/shared';
import {
  cobrado,
  formatCurrency,
  isAnulada,
  isCobrada,
  isGastoPagado,
  montoEfectivo,
  montoTransferencia,
  nombreCategoria,
  porCobrar,
  resumirFacturas,
  resumirGastos,
  tieneCobroTransferencia,
  tipoDeGasto,
  TIPO_GASTO_META,
  transferenciasPorCuenta,
} from '@/src/shared';

// ─── Shared PDF scaffold ───────────────────────────────────────────────────────

/**
 * Fragmento HTML generado por este módulo (badges). Todo lo demás que llega a una celda
 * se ESCAPA: nombres de cliente y descripciones vienen de ClientWeb/WhatsApp y antes se
 * inyectaban tal cual en una ventana del mismo origen (XSS almacenado).
 */
interface HtmlSeguro {
  __htmlSeguro: true;
  html: string;
}
type CeldaPdf = string | number | HtmlSeguro;

export function escaparHtml(valor: unknown): string {
  return String(valor ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function badge(texto: string, variante: 'success' | 'warning' | 'danger' | 'neutral'): HtmlSeguro {
  return { __htmlSeguro: true, html: `<span class="badge badge-${variante}">${escaparHtml(texto)}</span>` };
}

const celdaHtml = (c: CeldaPdf) => (typeof c === 'object' && c !== null && c.__htmlSeguro ? c.html : escaparHtml(c));

type FilaResumenPdf = { label: string; value: string; bold?: boolean };

/** Tabla extra al final del documento (p. ej. productos vendidos del libro diario). Sin `headers`, solo la nota. */
interface SeccionPdf {
  titulo: string;
  nota?: string;
  headers?: string[];
  rows?: CeldaPdf[][];
  /** Cuántas columnas del final van alineadas a la derecha (cifras). Por defecto 2. */
  numericas?: number;
  summaryRows?: FilaResumenPdf[];
}

interface PdfConfig {
  title: string;
  subtitle?: string;
  headers: string[];
  rows: CeldaPdf[][];
  footer?: string;
  summaryRows?: FilaResumenPdf[];
  secciones?: SeccionPdf[];
}

function safeDateLabel(value?: string): string {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('es-CO');
}

const CSS = `
*{box-sizing:border-box}
body{font-family:'Segoe UI',system-ui,sans-serif;margin:0;padding:24px;color:#111827;font-size:13px}
.header{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:2px solid #f3f4f6;padding-bottom:14px;margin-bottom:18px}
.brand{font-size:11px;color:#9ca3af;text-align:right}
h1{font-size:18px;margin:0 0 3px;font-weight:800;color:#111827}
.subtitle{font-size:11px;color:#6b7280;margin:0 0 14px}
table{width:100%;border-collapse:collapse}
thead th{text-align:left;font-size:10px;padding:8px 10px;background:#f3f4f6;border-bottom:2px solid #e5e7eb;text-transform:uppercase;letter-spacing:.5px;font-weight:700;color:#374151}
tbody td{padding:7px 10px;border-bottom:1px solid #f3f4f6;font-size:12px;vertical-align:middle;color:#1f2937}
tbody tr:hover{background:#fafafa}
.num{text-align:right;font-variant-numeric:tabular-nums;font-weight:600}
.summary{margin-top:20px;border-top:2px solid #e5e7eb;padding-top:14px}
.summary-row{display:flex;justify-content:space-between;padding:5px 0;font-size:12px;color:#374151}
.summary-row.bold{font-weight:800;font-size:14px;color:#111827;border-top:1px solid #e5e7eb;margin-top:6px;padding-top:10px}
.badge{display:inline-block;padding:2px 8px;border-radius:9999px;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.5px}
.badge-success{background:#d1fae5;color:#065f46}
.badge-warning{background:#fef3c7;color:#92400e}
.badge-danger{background:#fee2e2;color:#991b1b}
.badge-neutral{background:#f3f4f6;color:#4b5563}
.footer{margin-top:20px;font-size:10px;color:#9ca3af;border-top:1px solid #f3f4f6;padding-top:10px}
.seccion{margin-top:28px;break-inside:auto}
.seccion h2{font-size:15px;margin:0 0 3px;font-weight:800;color:#111827}
@media print{@page{margin:10mm;size:A4}body{padding:0}.seccion{break-before:auto}}
`;

function openPrintWindow(html: string) {
  if (typeof window === 'undefined') return;
  const popup = window.open('', '_blank', 'width=1100,height=820');
  if (!popup) return;
  popup.document.write(html);
  popup.document.close();
}

function tablaHtml(headers: string[], rows: CeldaPdf[][], numericas = 2): string {
  const thead = `<thead><tr>${headers.map(h => `<th>${escaparHtml(h)}</th>`).join('')}</tr></thead>`;
  const tbody = rows.map(row => `<tr>${row.map((c, i) => `<td class="${i >= row.length - numericas ? 'num' : ''}">${celdaHtml(c)}</td>`).join('')}</tr>`).join('');
  return `<table>${thead}<tbody>${tbody}</tbody></table>`;
}

function resumenHtml(filas?: FilaResumenPdf[]): string {
  return filas ? `
    <div class="summary">
      ${filas.map(r => `<div class="summary-row ${r.bold ? 'bold' : ''}"><span>${escaparHtml(r.label)}</span><span>${escaparHtml(r.value)}</span></div>`).join('')}
    </div>` : '';
}

export function exportPdf({ title, subtitle, headers, rows, footer, summaryRows, secciones }: PdfConfig) {
  if (typeof window === 'undefined') return;

  const summary = resumenHtml(summaryRows);
  const extras = (secciones ?? [])
    .map(s => `<section class="seccion"><h2>${escaparHtml(s.titulo)}</h2>${s.nota ? `<p class="subtitle">${escaparHtml(s.nota)}</p>` : ''}${s.headers?.length ? tablaHtml(s.headers, s.rows ?? [], s.numericas) : ''}${resumenHtml(s.summaryRows)}</section>`)
    .join('');

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"/><title>${escaparHtml(title)}</title><style>${CSS}</style></head>
<body>
<div class="header">
  <div><h1>${escaparHtml(title)}</h1>${subtitle ? `<p class="subtitle">${escaparHtml(subtitle)}</p>` : ''}</div>
  <div class="brand"><strong>POS PIZZA D'Firu</strong><br/>Generado: ${new Date().toLocaleString('es-CO')}</div>
</div>
${tablaHtml(headers, rows)}
${summary}
${extras}
<p class="footer">${footer ? escaparHtml(footer) : `Este documento fue generado automáticamente por POS Pizza D'Firu`}</p>
<script>window.onload=function(){window.print();}</script>
</body></html>`;

  openPrintWindow(html);
}

// ─── Cifras compartidas ────────────────────────────────────────────────────────
// Todas las exportaciones calculan con las MISMAS definiciones que el servidor y las pantallas
// (src/shared/domain): cobrado topado al total, abonos de las parciales, mixtas repartidas entre
// efectivo y QR, anuladas fuera y lo cobrado por QR repartido por cuenta. Antes cada PDF sumaba a
// su manera (solo estado 'pagado', total completo de las mixtas, anuladas incluidas en "ventas").

const cop = (n: number) => `$${formatCurrency(n)}`;

const metodoTexto = (f: FacturaItem): string => {
  if (!f.metodo) return '—';
  if (f.metodo === 'efectivo_transferencia') {
    return `EFECTIVO Y TRANSFERENCIA (Ef: ${cop(montoEfectivo(f))} / Tr: ${cop(montoTransferencia(f))})`;
  }
  return f.metodo.replace(/_/g, ' ').toUpperCase();
};

const cuentasTexto = (f: FacturaItem): string =>
  transferenciasPorCuenta(f)
    .map((c) => `${c.cuenta ?? 'Sin asignar'}${transferenciasPorCuenta(f).length > 1 ? ` ${cop(c.monto)}` : ''}`)
    .join(' + ');

const estadoBadge = (f: FacturaItem): HtmlSeguro =>
  badge(f.estado ?? '—', isCobrada(f) ? 'success' : isAnulada(f) ? 'danger' : 'warning');

// ─── Libro de ventas ───────────────────────────────────────────────────────────

export function exportFacturasPdf(facturas: FacturaItem[], periodLabel: string) {
  const r = resumirFacturas(facturas);

  exportPdf({
    title: `Libro de Ventas — ${periodLabel}`,
    subtitle: `${facturas.length} facturas${r.anuladas ? ` (${r.anuladas} anuladas)` : ''} | Cobrado ${cop(r.cobrado)}`,
    headers: ['ID', 'Fecha', 'Cliente', 'Estado', 'Método', 'Cuenta QR', 'Total'],
    rows: facturas.map((f) => [
      `#${f.facturaId ?? ''}`,
      safeDateLabel(f.fechaFactura),
      f.clienteNombre || 'Sin nombre',
      estadoBadge(f),
      metodoTexto(f),
      cuentasTexto(f) || '—',
      cop(Number(f.total) || 0),
    ]),
    summaryRows: [
      { label: 'Total facturado (sin anuladas)', value: cop(r.facturado) },
      { label: 'Total cobrado', value: cop(r.cobrado) },
      { label: '  · en efectivo', value: cop(r.efectivo) },
      { label: '  · por QR / transferencia', value: cop(r.transferencia) },
      ...r.porCuenta.map((c) => ({ label: `      ${c.cuenta}`, value: cop(c.monto) })),
      { label: 'Pendiente por cobrar', value: cop(r.porCobrar), bold: true },
    ],
  });
}

// ─── Transferencias / QR ───────────────────────────────────────────────────────

/**
 * Listado COMPLETO de transferencias del rango (una fila por cuenta de cada factura), con el total por
 * cuenta. `facturas` debe ser la lista completa, sin paginar.
 */
export function exportTransferenciasPdf(facturas: FacturaItem[], periodLabel: string, filtroLabel?: string, filtro?: FiltroCuentaTransferencia) {
  // Con una cuenta filtrada, solo SU parte: una factura abonada a dos cuentas trae también la fila de la otra.
  const filas = transferenciasFilas(facturas, filtro);
  const r = resumirFacturas(facturas.filter((f) => tieneCobroTransferencia(f)));
  const total = filas.reduce((t, x) => t + x.monto, 0);

  exportPdf({
    title: `Transferencias / QR — ${periodLabel}${filtroLabel ? ` (${filtroLabel})` : ''}`,
    subtitle: `${filas.length} transferencias en ${r.facturas} facturas`,
    headers: ['Factura', 'Fecha', 'Cliente', 'Cuenta', 'Estado', 'Monto QR'],
    rows: filas.map((x) => [`#${x.facturaId ?? ''}`, safeDateLabel(x.fecha), x.cliente, x.cuenta, estadoBadge(x.factura), cop(x.monto)]),
    summaryRows: [
      ...porCuentaDeFilas(filas).map((c) => ({ label: `${c.cuenta} (${c.facturas})`, value: cop(c.monto) })),
      { label: 'Total transferencias', value: cop(total), bold: true },
    ],
  });
}

export interface FilaTransferencia {
  facturaId?: number;
  fecha?: string;
  cliente: string;
  cuenta: string;
  cuentaId: number | null;
  monto: number;
  factura: FacturaItem;
}

/**
 * Cuenta elegida en QR / Transferencias: `id` null = las SIN cuenta asignada. `nombre` reconoce las filas viejas
 * que solo guardaron el nombre (mismo criterio que `sqlCoincideCuenta` del servidor).
 */
export interface FiltroCuentaTransferencia {
  id: number | null;
  nombre?: string;
}

function coincideCuenta(t: { cuentaId: number | null; cuenta: string | null }, filtro: FiltroCuentaTransferencia): boolean {
  if (filtro.id == null) return t.cuentaId == null && !t.cuenta;
  return t.cuentaId === filtro.id || (t.cuentaId == null && !!filtro.nombre && t.cuenta === filtro.nombre);
}

/**
 * Una fila por (factura, cuenta) con dinero cobrado por transferencia. Con `filtro`, solo las de esa cuenta:
 * sin él, una factura abonada a Nequi y a Bancolombia aparecía con las dos filas en el reporte "de Nequi" y su
 * total sumaba también lo de Bancolombia.
 */
export function transferenciasFilas(facturas: FacturaItem[], filtro?: FiltroCuentaTransferencia): FilaTransferencia[] {
  const filas: FilaTransferencia[] = [];
  for (const f of facturas) {
    for (const t of transferenciasPorCuenta(f)) {
      if (filtro && !coincideCuenta(t, filtro)) continue;
      filas.push({
        facturaId: f.facturaId,
        fecha: f.fechaFactura,
        cliente: f.clienteNombre || 'Sin nombre',
        cuenta: t.cuenta ?? 'Sin asignar',
        cuentaId: t.cuentaId,
        monto: t.monto,
        factura: f,
      });
    }
  }
  return filas;
}

function porCuentaDeFilas(filas: FilaTransferencia[]): { cuenta: string; facturas: number; monto: number }[] {
  const mapa = new Map<string, { cuenta: string; facturas: Set<number | undefined>; monto: number }>();
  for (const x of filas) {
    const clave = x.cuentaId != null ? `id:${x.cuentaId}` : x.cuenta;
    const fila = mapa.get(clave) ?? { cuenta: x.cuenta, facturas: new Set<number | undefined>(), monto: 0 };
    fila.monto += x.monto;
    fila.facturas.add(x.facturaId);
    mapa.set(clave, fila);
  }
  return [...mapa.values()].map((f) => ({ cuenta: f.cuenta, facturas: f.facturas.size, monto: f.monto })).sort((a, b) => b.monto - a.monto);
}

// ─── Libro diario ──────────────────────────────────────────────────────────────
// Lo arma el SERVIDOR (GET /contabilidad/libro-diario): es el mismo libro que recibe el contador en cada cierre.

/**
 * Abre en una pestaña un PDF que genera el servidor (libro diario). La pestaña se abre YA (en el clic): si se abriera
 * al llegar la respuesta, el navegador la bloquearía como ventana emergente. Si aun así la bloquea, el PDF se
 * descarga. Si falla la carga, la cierra y relanza el error.
 */
export async function abrirPdfDelServidor(cargar: () => Promise<Blob>, nombreArchivo: string, espera = 'Generando el PDF…') {
  if (typeof window === 'undefined') return;
  const popup = window.open('', '_blank');
  popup?.document.write(`<p style="font-family:system-ui,sans-serif;padding:24px;color:#475569">${escaparHtml(espera)}</p>`);
  try {
    const blob = await cargar();
    const pdf = blob.type === 'application/pdf' ? blob : new Blob([blob], { type: 'application/pdf' });
    const url = URL.createObjectURL(pdf);
    if (popup) {
      popup.location.href = url;
    } else {
      const a = document.createElement('a');
      a.href = url;
      a.download = nombreArchivo;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    }
    // La pestaña ya cargó el PDF; se libera la URL después.
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  } catch (error) {
    popup?.close();
    throw error;
  }
}

// ─── Balance de Prueba ────────────────────────────────────────────────────────

export function exportBalanceDePrueba(
  facturas: FacturaItem[],
  gastos: FacturaPago[],
  from: string,
  to: string,
) {
  if (typeof window === 'undefined') return;

  const v = resumirFacturas(facturas);
  const g = resumirGastos(gastos);
  const pagadosDe = (tipo: string) => g.porTipo.find((t) => t.tipo === tipo)?.pagados ?? 0;
  const costos = pagadosDe('costo');
  const operativos = pagadosDe('gasto');
  const sinClasificar = pagadosDe('sin_clasificar');

  const rows: (string | number)[][] = [
    ['11', 'Efectivo y Equivalentes (Caja)', cop(v.efectivo), '—', cop(v.efectivo)],
    ['11', 'Transferencias Recibidas (QR / bancos)', cop(v.transferencia), '—', cop(v.transferencia)],
    ...v.porCuenta.map((c) => ['11', `   · ${c.cuenta}`, cop(c.monto), '—', cop(c.monto)]),
    ['13', 'Cuentas por Cobrar (Clientes)', cop(v.porCobrar), '—', cop(v.porCobrar)],
    ['41', 'Ventas — Ingresos Operacionales', '—', cop(v.facturado), `(${cop(v.facturado)})`],
    ['61', 'Costos de Ventas (insumos, mercancía, empaques) — Pagados', cop(costos), '—', cop(costos)],
    ['51', 'Gastos Operacionales (nómina, servicios…) — Pagados', cop(operativos), '—', cop(operativos)],
    ...(sinClasificar > 0 ? [['51', 'Egresos pagados SIN CLASIFICAR (costo o gasto)', cop(sinClasificar), '—', cop(sinClasificar)]] : []),
    ['22', 'Cuentas por Pagar (egresos pendientes)', '—', cop(g.pendientes), `(${cop(g.pendientes)})`],
  ];

  const utilidadBruta = v.cobrado - costos;
  const neto = utilidadBruta - operativos - sinClasificar;

  exportPdf({
    title: `Balance de Prueba — ${from} al ${to}`,
    subtitle: `Estado de cuentas del período`,
    headers: ['Código', 'Cuenta Contable', 'Débito', 'Crédito', 'Saldo'],
    rows,
    summaryRows: [
      { label: 'Total Activos (Ingresos cobrados)', value: cop(v.cobrado) },
      { label: 'Costos pagados', value: cop(costos) },
      { label: 'Utilidad bruta (cobrado − costos)', value: `${utilidadBruta >= 0 ? '' : '−'}${cop(Math.abs(utilidadBruta))}` },
      { label: 'Gastos operativos pagados', value: cop(operativos + sinClasificar) },
      { label: 'Resultado del Período (Utilidad/Pérdida)', value: `${neto >= 0 ? '' : '−'}${cop(Math.abs(neto))}`, bold: true },
    ],
  });
}

// ─── Balance de Prueba por Tercero ────────────────────────────────────────────

export function exportBalancePorTercero(
  facturas: FacturaItem[],
  from: string,
  to: string,
) {
  if (typeof window === 'undefined') return;

  const byCliente: Record<string, { nombre: string; count: number; total: number; cobrado: number; pendiente: number }> = {};

  for (const f of facturas) {
    if (isAnulada(f)) continue;
    const key = (f.clienteNombre || 'Sin nombre').trim();
    if (!byCliente[key]) byCliente[key] = { nombre: key, count: 0, total: 0, cobrado: 0, pendiente: 0 };
    byCliente[key].count++;
    byCliente[key].total += Number(f.total) || 0;
    byCliente[key].cobrado += cobrado(f);
    byCliente[key].pendiente += porCobrar(f);
  }

  const sorted = Object.values(byCliente).sort((a, b) => b.total - a.total);
  const grandTotal = sorted.reduce((s, c) => s + c.total, 0);
  const grandCobrado = sorted.reduce((s, c) => s + c.cobrado, 0);
  const grandPendiente = sorted.reduce((s, c) => s + c.pendiente, 0);

  exportPdf({
    title: `Balance de Prueba por Tercero — ${from} al ${to}`,
    subtitle: `${sorted.length} clientes | ${sorted.reduce((s, c) => s + c.count, 0)} facturas`,
    headers: ['Cliente / Tercero', 'Órdenes', 'Total Facturado', 'Cobrado', 'Por Cobrar'],
    rows: sorted.map((c) => [
      c.nombre,
      String(c.count),
      cop(c.total),
      cop(c.cobrado),
      c.pendiente > 0 ? badge(cop(c.pendiente), 'warning') : badge('$0', 'success'),
    ]),
    summaryRows: [
      { label: 'Total facturado (todos los clientes)', value: cop(grandTotal) },
      { label: 'Total cobrado', value: cop(grandCobrado) },
      { label: 'Cartera pendiente por cobrar', value: cop(grandPendiente), bold: true },
    ],
  });
}

// ─── Informe de Impuestos ─────────────────────────────────────────────────────

const IVA_RATE = 0.08; // 8% IVA restaurantes Colombia (régimen simplificado)

export function exportInformeImpuesto(
  facturas: FacturaItem[],
  from: string,
  to: string,
) {
  if (typeof window === 'undefined') return;

  // IVA sobre lo efectivamente cobrado (abonos incluidos), no sobre el total de las 'pagado'.
  const v = resumirFacturas(facturas);
  const baseDe = (monto: number) => monto / (1 + IVA_RATE);
  const baseGravable = baseDe(v.cobrado);
  const ivaGenerado = v.cobrado - baseGravable;

  const rows: (string | number)[][] = [
    ['EFECTIVO', cop(baseDe(v.efectivo)), cop(v.efectivo - baseDe(v.efectivo)), cop(v.efectivo)],
    ['TRANSFERENCIA / QR', cop(baseDe(v.transferencia)), cop(v.transferencia - baseDe(v.transferencia)), cop(v.transferencia)],
  ];

  exportPdf({
    title: `Informe de Impuestos — ${from} al ${to}`,
    subtitle: `IVA Restaurante ${(IVA_RATE * 100).toFixed(0)}% (régimen simplificado) | ${v.facturas} facturas válidas`,
    headers: ['Método de Pago', 'Base Gravable', `IVA (${(IVA_RATE * 100).toFixed(0)}%)`, 'Total c/IVA'],
    rows,
    summaryRows: [
      { label: `Base gravable total (sin IVA ${(IVA_RATE * 100).toFixed(0)}%)`, value: cop(baseGravable) },
      { label: `IVA generado total (${(IVA_RATE * 100).toFixed(0)}%)`, value: cop(ivaGenerado) },
      { label: 'Total cobrado (con IVA incluido)', value: cop(v.cobrado), bold: true },
    ],
    footer: `Nota: Tarifa IVA aplicada: ${(IVA_RATE * 100).toFixed(0)}% para servicios de restaurante (Art. 426 E.T. Colombia). Verifique con su contador la tarifa vigente aplicable a su negocio.`,
  });
}

// ─── Egresos por tipo ─────────────────────────────────────────────────────────

/** Egresos del rango agrupados por tipo (costo / gasto) y categoría, con el detalle completo. */
export function exportEgresosPdf(gastos: FacturaPago[], periodLabel: string) {
  const g = resumirGastos(gastos);
  const ordenados = [...gastos].sort((a, b) => (a.fechaFactura ?? '').localeCompare(b.fechaFactura ?? ''));

  exportPdf({
    title: `Egresos — ${periodLabel}`,
    subtitle: `${g.cantidad} egresos | Pagados ${cop(g.pagados)} | Pendientes ${cop(g.pendientes)}`,
    headers: ['ID', 'Fecha', 'Concepto', 'Tipo', 'Categoría', 'Método', 'Estado', 'Total'],
    rows: ordenados.map((x) => [
      `#${x.pagosId ?? ''}`,
      safeDateLabel(x.fechaFactura),
      x.nombreGasto || 'Sin nombre',
      TIPO_GASTO_META[tipoDeGasto(x)].label,
      nombreCategoria(x.categoria),
      x.metodo || '—',
      badge(x.estado ?? '—', isGastoPagado(x) ? 'success' : 'warning'),
      cop(Number(x.total) || 0),
    ]),
    summaryRows: [
      ...g.porTipo.filter((t) => t.cantidad > 0).map((t) => ({ label: `${TIPO_GASTO_META[t.tipo].label} (${t.cantidad}) — pagados`, value: cop(t.pagados) })),
      ...g.porCategoria.map((c) => ({ label: `      ${nombreCategoria(c.categoria)} · ${TIPO_GASTO_META[c.tipo].label} (${c.cantidad})`, value: cop(c.total) })),
      { label: 'Total egresos', value: cop(g.total), bold: true },
    ],
  });
}
