import type { FacturaItem } from '../components/facturas/FacturaShared';
import type { FacturaPago, ResumenGeneral } from '@/src/shared';
import { textoLinea } from './lineas-venta';
import {
  CATEGORIA_PRODUCTO_LABEL,
  cobrado,
  formatCurrency,
  isAnulada,
  isCobrada,
  isGastoPagado,
  isParcial,
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

/** Descripción + línea de detalle pequeña, ambos escapados. */
function conDetalle(descripcion: string, detalle: string): HtmlSeguro {
  return {
    __htmlSeguro: true,
    html: `${escaparHtml(descripcion)}<br/><small style="color: #64748B; font-size: 10px;">${escaparHtml(detalle)}</small>`,
  };
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

const claseGasto = (g: FacturaPago): string => `${TIPO_GASTO_META[tipoDeGasto(g)].label} · ${nombreCategoria(g.categoria)}`;

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

export interface LibroDiarioOptions {
  filtro?: 'completo' | 'solo_transferencias' | 'cuenta_especifica';
  cuentaId?: number;
  cuentaNombre?: string;
  incluirProductos?: boolean;
  incluirDomicilio?: boolean;
  /**
   * Resumen del servidor para el MISMO rango (`GET /estadisticas/resumen`): con él, el libro completo cierra con
   * los productos vendidos (unidades y valor de cada uno, cuántas pizzas salieron) y los ajustes manuales de
   * precio, con las mismas cifras del cierre de caja.
   */
  resumen?: ResumenGeneral | null;
}

const copSigno = (n: number) => (n > 0 ? `+${cop(n)}` : n < 0 ? `−${cop(-n)}` : cop(0));
const unidadesTexto = (n: number) => formatCurrency(n);
const etiquetaCategoriaPdf = (c?: string | null) =>
  (c && (CATEGORIA_PRODUCTO_LABEL as Record<string, string>)[c]) || (c ? c : 'Sin categoría');

/** Ajuste de una fila de productos: "+$10.000 · −$5.000 (3 manuales, 1 sin precio de lista)". */
function ajusteTexto(p: ResumenGeneral['productos'][number]): string {
  if (!p.lineasManuales) return '—';
  const partes = [p.aumentos > 0 ? `+${cop(p.aumentos)}` : '', p.bajas < 0 ? `−${cop(-p.bajas)}` : ''].filter(Boolean);
  const detalle = [`${p.lineasManuales} manual${p.lineasManuales === 1 ? '' : 'es'}`, p.sinPrecioLista ? `${p.sinPrecioLista} sin precio de menú` : '']
    .filter(Boolean)
    .join(', ');
  return `${partes.join(' · ') || 'sin diferencia calculable'} (${detalle})`;
}

/**
 * Secciones del libro diario con lo que se VENDIÓ (no solo el dinero): productos por producto + variante con
 * unidades y valor cobrado, subtotal por categoría (cuántas pizzas salieron) y los precios cambiados a mano
 * (precio del menú desactualizado, adición que no estaba en el menú…), para que lo cobrado cuadre con el
 * precio de lista. Cifras del servidor: las mismas del cierre de caja y del correo.
 */
function seccionesProductosVendidos(resumen: ResumenGeneral): { secciones: SeccionPdf[]; pizzas: number } {
  const productos = resumen.productos ?? [];
  const aj = resumen.ajustesPrecio;
  const valorTotal = productos.reduce((t, p) => t + p.valor, 0);
  const unidadesTotal = productos.reduce((t, p) => t + p.unidades, 0);

  const porCategoria = new Map<string, { unidades: number; valor: number }>();
  for (const p of productos) {
    const c = p.categoria || 'otro';
    const acc = porCategoria.get(c) ?? { unidades: 0, valor: 0 };
    acc.unidades += p.unidades;
    acc.valor += p.valor;
    porCategoria.set(c, acc);
  }
  const pizzas = porCategoria.get('pizza')?.unidades ?? 0;

  const vendidos: SeccionPdf = {
    titulo: 'Productos vendidos',
    nota:
      'Cada producto (producto + variante) de las ventas válidas del período, también las aún por cobrar (los asientos de arriba solo ' +
      'registran lo cobrado): unidades y valor vendido al precio que se cobró, con los precios cambiados a mano. Sin el costo de domicilio. ' +
      'Mismas cifras del cierre de caja.',
    headers: ['Producto', 'Categoría', 'Ajuste manual', 'Unidades', 'Valor vendido'],
    rows: productos.length
      ? productos.map((p) => [p.nombre, etiquetaCategoriaPdf(p.categoria), ajusteTexto(p), unidadesTexto(p.unidades), cop(p.valor)])
      : [['Sin productos vendidos en el período', '', '', '', '']],
    summaryRows: [
      ...[...porCategoria.entries()]
        .sort((a, b) => b[1].unidades - a[1].unidades)
        .map(([c, v]) => ({ label: `${etiquetaCategoriaPdf(c)}: ${unidadesTexto(v.unidades)} unidades`, value: cop(v.valor) })),
      { label: `Total productos: ${unidadesTexto(unidadesTotal)} unidades`, value: cop(valorTotal), bold: true },
    ],
  };

  const ajustes: SeccionPdf = {
    titulo: 'Ajustes manuales de precio',
    nota: 'Líneas en las que el cajero cambió el precio del menú (precio desactualizado, adición que no estaba contemplada, descuento). Las antiguas sin precio de menú guardado se cuentan aparte: su ajuste no se puede calcular.',
    headers: ['Concepto', 'Monto'],
    numericas: 1,
    rows: aj && aj.lineasManuales
      ? [
          ['Aumentos (se cobró más que el menú: adiciones no contempladas, precio desactualizado)', copSigno(aj.aumentos)],
          ['Bajas (se cobró menos que el menú: descuentos, cortesías)', copSigno(aj.bajas)],
          ['Ajuste neto sobre el precio del menú', copSigno(aj.neto)],
          ['Líneas con precio manual', unidadesTexto(aj.lineasManuales)],
          ...(aj.sinPrecioLista ? [['Manuales sin precio de menú guardado (ventas antiguas: su ajuste no se puede calcular)', unidadesTexto(aj.sinPrecioLista)]] : []),
        ]
      : [['Sin precios cambiados a mano en el período', '—']],
    summaryRows: aj && aj.lineasManuales
      ? [
          {
            label:
              aj.sinPrecioLista === 1
                ? 'Productos a precio del menú (la línea sin precio de menú va al precio cobrado)'
                : aj.sinPrecioLista
                ? `Productos a precio del menú (las ${unidadesTexto(aj.sinPrecioLista)} líneas sin precio de menú van al precio cobrado)`
                : 'Productos a precio del menú',
            value: cop(valorTotal - aj.neto),
          },
          { label: 'Ajuste manual neto', value: copSigno(aj.neto) },
          { label: 'Valor vendido en productos', value: cop(valorTotal), bold: true },
        ]
      : undefined,
  };

  return { secciones: [vendidos, ajustes], pizzas };
}

export function exportLibroDiario(
  facturas: FacturaItem[],
  gastos: FacturaPago[],
  from: string,
  to: string,
  options: LibroDiarioOptions = {},
) {
  if (typeof window === 'undefined') return;

  const {
    filtro = 'completo',
    cuentaId,
    cuentaNombre,
    incluirProductos = false,
    incluirDomicilio = true,
    resumen,
  } = options;

  type Entry = { fecha: string; tipo: 'ingreso' | 'egreso'; ref: string; descripcion: string; detalle?: string; debito: number; credito: number };

  const entries: Entry[] = [];
  let porCobrarTotal = 0;

  for (const f of facturas) {
    // Anuladas: no son venta. Pendientes: no entran al libro (no hay dinero), solo se informan abajo.
    if (isAnulada(f)) continue;
    const costoDom = f.domicilios?.[0]?.costoDomicilio ? Number(f.domicilios[0].costoDomicilio) : 0;
    // Sin domicilio: el costo del domicilio se descarta de lo cobrado en efectivo primero.
    let descuentoDom = incluirDomicilio ? 0 : Math.min(costoDom, cobrado(f));

    // Detalle de productos como TEXTO (se escapa y se pinta en una línea aparte)
    let prodDetail = '';
    if (incluirProductos && f.ordenes && f.ordenes.length > 0) {
      const prods = f.ordenes.flatMap((o) => o.productos ?? []);
      if (prods.length > 0) {
        // Las líneas con precio cambiado a mano dicen cuánto se cobró y cuánto valía en el menú.
        prodDetail = prods
          .map((p) => {
            const manual = p.precioManual
              ? ` (precio manual ${cop(Number(p.precioUnitario) || 0)}${p.precioLista != null ? `, menú ${cop(p.precioLista)}` : ''})`
              : '';
            return `${p.cantidad ?? 1}x ${textoLinea(p)}${manual}`;
          })
          .join(', ');
      }
    }
    const cliente = f.clienteNombre || 'Sin nombre';
    const base = { fecha: f.fechaFactura ?? '', tipo: 'ingreso' as const, ref: `F-${f.facturaId}`, detalle: prodDetail || undefined, credito: 0 };

    // Efectivo cobrado (no aplica a los filtros de transferencia)
    const ef = montoEfectivo(f);
    if (filtro === 'completo' && ef > 0) {
      const desc = Math.min(descuentoDom, ef);
      descuentoDom -= desc;
      entries.push({ ...base, descripcion: `Venta (Efectivo) — ${cliente}${isParcial(f) ? ' · abonos' : ''}`, debito: ef - desc });
    }

    // Transferencias cobradas: una línea por cuenta
    for (const t of transferenciasPorCuenta(f)) {
      if (filtro === 'cuenta_especifica') {
        const coincide = cuentaId != null ? t.cuentaId === cuentaId : !!cuentaNombre && t.cuenta === cuentaNombre;
        if (!coincide) continue;
      }
      const desc = Math.min(descuentoDom, t.monto);
      descuentoDom -= desc;
      entries.push({
        ...base,
        descripcion: `Venta (Transferencia${t.cuenta ? ` — ${t.cuenta}` : ' — sin cuenta asignada'}) — ${cliente}${isParcial(f) ? ' · abonos' : ''}`,
        debito: t.monto - desc,
      });
    }

    if (filtro === 'completo') porCobrarTotal += porCobrar(f);
  }

  // Egresos PAGADOS = dinero que salió (crédito). Los pendientes aún no salieron: igual que las ventas por cobrar,
  // no son asiento y se informan en una nota. Así el saldo es el balance de caja de todas las pantallas (cobrado −
  // egresos pagados); antes restaba también los pendientes y no cuadraba. Filtro de transferencias: los pagados por
  // QR; de una cuenta: los que salieron de ESA cuenta (`cuentaOrigenId`; los QR viejos sin cuenta quedan fuera).
  const esQr = (g: FacturaPago) => g.metodo === 'transferencia' || g.metodo === 'qr';
  const egresoDelFiltro = (g: FacturaPago) =>
    filtro === 'completo' ||
    (filtro === 'solo_transferencias' && esQr(g)) ||
    (filtro === 'cuenta_especifica' && esQr(g) && cuentaId != null && g.cuentaOrigenId === cuentaId);
  let pendientesPorPagar = 0;
  for (const g of gastos) {
    if (!egresoDelFiltro(g)) continue;
    if (!isGastoPagado(g)) {
      pendientesPorPagar += Number(g.total) || 0;
      continue;
    }
    entries.push({
      fecha: g.fechaFactura ?? '',
      tipo: 'egreso',
      ref: `G-${g.pagosId}`,
      descripcion: `Egreso — ${g.nombreGasto || 'Sin descripción'} (${g.metodo || 'efectivo'})`,
      detalle: claseGasto(g),
      debito: 0,
      credito: Number(g.total) || 0,
    });
  }

  entries.sort((a, b) => (a.fecha ?? '').localeCompare(b.fecha ?? ''));

  const totalDebitos = entries.reduce((s, e) => s + e.debito, 0);
  const totalCreditos = entries.reduce((s, e) => s + e.credito, 0);
  const saldoLabel =
    filtro === 'solo_transferencias'
      ? 'Saldo neto por QR / transferencias (entró − salió)'
      : filtro === 'cuenta_especifica'
      ? `Saldo de la cuenta${cuentaNombre ? ` ${cuentaNombre}` : ''} (entró − salió)`
      : incluirDomicilio
      ? 'Saldo neto = balance de caja (cobrado − egresos pagados)'
      : 'Saldo neto sin domicilios (cobrado sin domicilio − egresos pagados)';

  const filtroSub =
    filtro === 'solo_transferencias'
      ? ' (Solo Transferencias / QR)'
      : filtro === 'cuenta_especifica'
      ? ` (Cuenta: ${cuentaNombre || 'Específica'})`
      : '';

  // Lo vendido (productos, pizzas, ajustes manuales) solo en el libro completo: con un filtro de transferencias
  // o de una cuenta, los productos de TODAS las ventas no corresponderían a los asientos de arriba.
  const vendido = filtro === 'completo' && resumen ? seccionesProductosVendidos(resumen) : null;
  const sinResumen: SeccionPdf[] =
    filtro === 'completo' && !resumen
      ? [{ titulo: 'Productos vendidos', nota: 'El resumen de productos del período aún no había cargado: vuelve a exportar en unos segundos.' }]
      : [];

  exportPdf({
    title: `Libro Diario — ${from} al ${to}${filtroSub}`,
    subtitle:
      `${entries.length} asientos contables${vendido ? ` · ${unidadesTexto(vendido.pizzas)} pizzas vendidas` : ''}${!incluirDomicilio ? ' (sin domicilio)' : ''}` +
      ' · Débito = dinero que entró (ventas cobradas) · Crédito = dinero que salió (egresos pagados)',
    secciones: vendido ? vendido.secciones : sinResumen,
    headers: ['Fecha', 'Referencia', 'Descripción', 'Débito (entra)', 'Crédito (sale)'],
    rows: entries.map((e) => [
      safeDateLabel(e.fecha),
      badge(e.ref, e.tipo === 'ingreso' ? 'success' : 'danger'),
      e.detalle ? conDetalle(e.descripcion, e.detalle) : e.descripcion,
      e.debito > 0 ? cop(e.debito) : '—',
      e.credito > 0 ? cop(e.credito) : '—',
    ]),
    summaryRows: [
      { label: 'Total débitos: lo que ENTRÓ (ventas cobradas)', value: cop(totalDebitos) },
      { label: 'Total créditos: lo que SALIÓ (egresos pagados)', value: cop(totalCreditos) },
      { label: saldoLabel, value: cop(totalDebitos - totalCreditos), bold: true },
      // Lo que aún no movió dinero: se informa, no suma ni resta.
      ...(filtro === 'completo' ? [{ label: 'Nota: ventas por cobrar (aún no entran, no suman)', value: cop(porCobrarTotal) }] : []),
      { label: 'Nota: egresos pendientes de pago (aún no salen, no restan)', value: cop(pendientesPorPagar) },
    ],
  });
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
