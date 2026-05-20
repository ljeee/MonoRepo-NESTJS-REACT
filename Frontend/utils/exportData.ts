import type { FacturaItem } from '../components/facturas/FacturaShared';
import type { FacturaPago } from '@/src/shared';
import { formatCurrency } from '@/src/shared';

// ─── Shared PDF scaffold ───────────────────────────────────────────────────────

interface PdfConfig {
  title: string;
  subtitle?: string;
  headers: string[];
  rows: (string | number)[][];
  footer?: string;
  summaryRows?: { label: string; value: string; bold?: boolean }[];
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
@media print{@page{margin:10mm;size:A4}body{padding:0}}
`;

function openPrintWindow(html: string) {
  if (typeof window === 'undefined') return;
  const popup = window.open('', '_blank', 'width=1100,height=820');
  if (!popup) return;
  popup.document.write(html);
  popup.document.close();
}

export function exportPdf({ title, subtitle, headers, rows, footer, summaryRows }: PdfConfig) {
  if (typeof window === 'undefined') return;

  const thead = `<thead><tr>${headers.map(h => `<th>${h}</th>`).join('')}</tr></thead>`;
  const tbody = rows.map(row => `<tr>${row.map((c, i) => `<td class="${i === row.length - 1 || i === row.length - 2 ? 'num' : ''}">${c}</td>`).join('')}</tr>`).join('');

  const summary = summaryRows ? `
    <div class="summary">
      ${summaryRows.map(r => `<div class="summary-row ${r.bold ? 'bold' : ''}"><span>${r.label}</span><span>${r.value}</span></div>`).join('')}
    </div>` : '';

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"/><title>${title}</title><style>${CSS}</style></head>
<body>
<div class="header">
  <div><h1>${title}</h1>${subtitle ? `<p class="subtitle">${subtitle}</p>` : ''}</div>
  <div class="brand"><strong>POS PIZZA D'Firu</strong><br/>Generado: ${new Date().toLocaleString('es-CO')}</div>
</div>
<table>${thead}<tbody>${tbody}</tbody></table>
${summary}
<p class="footer">${footer ?? `Este documento fue generado automáticamente por POS Pizza D'Firu`}</p>
<script>window.onload=function(){window.print();}</script>
</body></html>`;

  openPrintWindow(html);
}

// ─── Existing report ───────────────────────────────────────────────────────────

export function exportFacturasPdf(facturas: FacturaItem[], periodLabel: string) {
  const total = facturas.reduce((sum, f) => sum + (Number(f.total) || 0), 0);
  const pagado = facturas.filter(f => f.estado === 'pagado').reduce((s, f) => s + (Number(f.total) || 0), 0);

  exportPdf({
    title: `Libro de Ventas — ${periodLabel}`,
    subtitle: `${facturas.length} facturas | Cobrado $${formatCurrency(pagado)}`,
    headers: ['ID', 'Fecha', 'Cliente', 'Estado', 'Método', 'Total'],
    rows: facturas.map(f => [
      `#${f.facturaId ?? ''}`,
      safeDateLabel(f.fechaFactura),
      f.clienteNombre || 'Sin nombre',
      `<span class="badge ${f.estado === 'pagado' ? 'badge-success' : f.estado === 'pendiente' ? 'badge-warning' : 'badge-danger'}">${f.estado ?? '—'}</span>`,
      f.metodo || '—',
      `$${formatCurrency(Number(f.total) || 0)}`,
    ]),
    summaryRows: [
      { label: 'Total facturado', value: `$${formatCurrency(total)}` },
      { label: 'Total cobrado', value: `$${formatCurrency(pagado)}` },
      { label: 'Pendiente por cobrar', value: `$${formatCurrency(total - pagado)}`, bold: true },
    ],
  });
}

// ─── Libro Diario ─────────────────────────────────────────────────────────────

export function exportLibroDiario(
  facturas: FacturaItem[],
  gastos: FacturaPago[],
  from: string,
  to: string,
) {
  if (typeof window === 'undefined') return;

  type Entry = { fecha: string; tipo: 'ingreso' | 'egreso'; ref: string; descripcion: string; debito: number; credito: number; };

  const entries: Entry[] = [];

  for (const f of facturas) {
    const monto = Number(f.total) || 0;
    const isPagado = f.estado === 'pagado';
    entries.push({
      fecha: f.fechaFactura ?? '',
      tipo: 'ingreso',
      ref: `F-${f.facturaId}`,
      descripcion: `Venta — ${f.clienteNombre || 'Sin nombre'} (${f.metodo || 'efectivo'})`,
      debito: isPagado ? monto : 0,
      credito: isPagado ? 0 : monto,
    });
  }

  for (const g of gastos) {
    const monto = Number(g.total) || 0;
    entries.push({
      fecha: g.fechaFactura ?? '',
      tipo: 'egreso',
      ref: `G-${g.pagosId}`,
      descripcion: `Gasto — ${g.nombreGasto || 'Sin descripción'} (${g.metodo || 'efectivo'})`,
      debito: 0,
      credito: monto,
    });
  }

  entries.sort((a, b) => (a.fecha ?? '').localeCompare(b.fecha ?? ''));

  const totalDebitos  = entries.reduce((s, e) => s + e.debito, 0);
  const totalCreditos = entries.reduce((s, e) => s + e.credito, 0);

  exportPdf({
    title: `Libro Diario — ${from} al ${to}`,
    subtitle: `${entries.length} asientos contables`,
    headers: ['Fecha', 'Referencia', 'Descripción', 'Débito', 'Crédito'],
    rows: entries.map(e => [
      safeDateLabel(e.fecha),
      `<span class="badge ${e.tipo === 'ingreso' ? 'badge-success' : 'badge-danger'}">${e.ref}</span>`,
      e.descripcion,
      e.debito > 0 ? `$${formatCurrency(e.debito)}` : '—',
      e.credito > 0 ? `$${formatCurrency(e.credito)}` : '—',
    ]),
    summaryRows: [
      { label: 'Total Débitos (Ingresos cobrados)', value: `$${formatCurrency(totalDebitos)}` },
      { label: 'Total Créditos (Gastos + pendientes)', value: `$${formatCurrency(totalCreditos)}` },
      { label: 'Saldo Neto', value: `$${formatCurrency(totalDebitos - totalCreditos)}`, bold: true },
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

  const ventasBrutas = facturas.reduce((s, f) => s + (Number(f.total) || 0), 0);
  const ventasCobradas = facturas.filter(f => f.estado === 'pagado').reduce((s, f) => s + (Number(f.total) || 0), 0);
  const cuentasPorCobrar = ventasBrutas - ventasCobradas;
  const totalGastos = gastos.filter(g => g.estado === 'pagado').reduce((s, g) => s + (Number(g.total) || 0), 0);
  const gastosPendientes = gastos.filter(g => g.estado === 'pendiente').reduce((s, g) => s + (Number(g.total) || 0), 0);

  const metodos: Record<string, number> = {};
  for (const f of facturas) {
    if (f.estado === 'pagado' && f.metodo) {
      metodos[f.metodo] = (metodos[f.metodo] ?? 0) + (Number(f.total) || 0);
    }
  }

  const rows: (string | number)[][] = [
    ['11', 'Efectivo y Equivalentes (Caja)', `$${formatCurrency(metodos['efectivo'] ?? 0)}`, '—', `$${formatCurrency(metodos['efectivo'] ?? 0)}`],
    ['11', 'Transferencias Recibidas', `$${formatCurrency((metodos['transferencia'] ?? 0) + (metodos['nequi'] ?? 0) + (metodos['daviplata'] ?? 0))}`, '—', `$${formatCurrency((metodos['transferencia'] ?? 0) + (metodos['nequi'] ?? 0) + (metodos['daviplata'] ?? 0))}`],
    ['11', 'Pagos con Tarjeta', `$${formatCurrency(metodos['tarjeta'] ?? 0)}`, '—', `$${formatCurrency(metodos['tarjeta'] ?? 0)}`],
    ['13', 'Cuentas por Cobrar (Clientes)', `$${formatCurrency(cuentasPorCobrar)}`, '—', `$${formatCurrency(cuentasPorCobrar)}`],
    ['41', 'Ventas — Ingresos Operacionales', '—', `$${formatCurrency(ventasBrutas)}`, `($${formatCurrency(ventasBrutas)})`],
    ['51', 'Gastos Operacionales (Pagados)', `$${formatCurrency(totalGastos)}`, '—', `$${formatCurrency(totalGastos)}`],
    ['22', 'Cuentas por Pagar (Gastos pendientes)', '—', `$${formatCurrency(gastosPendientes)}`, `($${formatCurrency(gastosPendientes)})`],
  ];

  const neto = ventasCobradas - totalGastos;

  exportPdf({
    title: `Balance de Prueba — ${from} al ${to}`,
    subtitle: `Estado de cuentas del período`,
    headers: ['Código', 'Cuenta Contable', 'Débito', 'Crédito', 'Saldo'],
    rows,
    summaryRows: [
      { label: 'Total Activos (Ingresos cobrados)', value: `$${formatCurrency(ventasCobradas)}` },
      { label: 'Total Gastos Pagados', value: `$${formatCurrency(totalGastos)}` },
      { label: 'Resultado del Período (Utilidad/Pérdida)', value: `${neto >= 0 ? '' : '−'}$${formatCurrency(Math.abs(neto))}`, bold: true },
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
    const key = (f.clienteNombre || 'Sin nombre').trim();
    if (!byCliente[key]) byCliente[key] = { nombre: key, count: 0, total: 0, cobrado: 0, pendiente: 0 };
    const monto = Number(f.total) || 0;
    byCliente[key].count++;
    byCliente[key].total += monto;
    if (f.estado === 'pagado') byCliente[key].cobrado += monto;
    else byCliente[key].pendiente += monto;
  }

  const sorted = Object.values(byCliente).sort((a, b) => b.total - a.total);
  const grandTotal = sorted.reduce((s, c) => s + c.total, 0);
  const grandCobrado = sorted.reduce((s, c) => s + c.cobrado, 0);

  exportPdf({
    title: `Balance de Prueba por Tercero — ${from} al ${to}`,
    subtitle: `${sorted.length} clientes | ${facturas.length} facturas`,
    headers: ['Cliente / Tercero', 'Órdenes', 'Total Facturado', 'Cobrado', 'Por Cobrar'],
    rows: sorted.map(c => [
      c.nombre,
      String(c.count),
      `$${formatCurrency(c.total)}`,
      `$${formatCurrency(c.cobrado)}`,
      c.pendiente > 0 ? `<span class="badge badge-warning">$${formatCurrency(c.pendiente)}</span>` : `<span class="badge badge-success">$0</span>`,
    ]),
    summaryRows: [
      { label: 'Total facturado (todos los clientes)', value: `$${formatCurrency(grandTotal)}` },
      { label: 'Total cobrado', value: `$${formatCurrency(grandCobrado)}` },
      { label: 'Cartera pendiente por cobrar', value: `$${formatCurrency(grandTotal - grandCobrado)}`, bold: true },
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

  const pagadas = facturas.filter(f => f.estado === 'pagado');
  const baseGravable = pagadas.reduce((s, f) => s + (Number(f.total) || 0) / (1 + IVA_RATE), 0);
  const ivaGenerado = pagadas.reduce((s, f) => s + ((Number(f.total) || 0) - (Number(f.total) || 0) / (1 + IVA_RATE)), 0);
  const totalVentas = pagadas.reduce((s, f) => s + (Number(f.total) || 0), 0);

  // By method (for witholding info)
  const byMetodo: Record<string, number> = {};
  for (const f of pagadas) {
    if (f.metodo) byMetodo[f.metodo] = (byMetodo[f.metodo] ?? 0) + (Number(f.total) || 0);
  }

  const rows: (string | number)[][] = [
    ...Object.entries(byMetodo).map(([m, v]) => [
      m.toUpperCase(),
      `$${formatCurrency(v / (1 + IVA_RATE))}`,
      `$${formatCurrency(v - v / (1 + IVA_RATE))}`,
      `$${formatCurrency(v)}`,
    ]),
  ];

  exportPdf({
    title: `Informe de Impuestos — ${from} al ${to}`,
    subtitle: `IVA Restaurante ${(IVA_RATE * 100).toFixed(0)}% (régimen simplificado) | ${pagadas.length} ventas cobradas`,
    headers: ['Método de Pago', 'Base Gravable', `IVA (${(IVA_RATE * 100).toFixed(0)}%)`, 'Total c/IVA'],
    rows,
    summaryRows: [
      { label: `Base gravable total (sin IVA ${(IVA_RATE * 100).toFixed(0)}%)`, value: `$${formatCurrency(baseGravable)}` },
      { label: `IVA generado total (${(IVA_RATE * 100).toFixed(0)}%)`, value: `$${formatCurrency(ivaGenerado)}` },
      { label: 'Total ventas (con IVA incluido)', value: `$${formatCurrency(totalVentas)}`, bold: true },
    ],
    footer: `Nota: Tarifa IVA aplicada: ${(IVA_RATE * 100).toFixed(0)}% para servicios de restaurante (Art. 426 E.T. Colombia). Verifique con su contador la tarifa vigente aplicable a su negocio.`,
  });
}
