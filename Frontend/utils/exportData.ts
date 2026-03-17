import type { FacturaItem } from '../components/facturas/FacturaShared';
import { formatCurrency } from '@monorepo/shared';

interface PdfConfig {
  title: string;
  subtitle?: string;
  headers: string[];
  rows: (string | number)[][];
  footer?: string;
}

function safeDateLabel(value?: string): string {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('es-CO');
}

export function exportPdf({ title, subtitle, headers, rows, footer }: PdfConfig) {
  if (typeof window === 'undefined') return;

  const tableRows = rows
    .map((row) => `<tr>${row.map((cell) => `<td>${cell}</td>`).join('')}</tr>`)
    .join('');

  const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<title>${title}</title>
<style>
*{box-sizing:border-box}
body{font-family:Segoe UI,system-ui,sans-serif;margin:0;padding:24px;color:#111827}
h1{font-size:20px;margin:0 0 4px}
.subtitle{font-size:12px;color:#6b7280;margin:0 0 14px}
table{width:100%;border-collapse:collapse;max-width:100%}
thead th{text-align:left;font-size:11px;padding:8px;background:#f3f4f6;border-bottom:2px solid #e5e7eb;text-transform:uppercase}
tbody td{padding:7px 8px;border-bottom:1px solid #e5e7eb;font-size:12px;vertical-align:top}
tbody tr:nth-child(even){background:#fafafa}
.footer{margin-top:14px;font-size:11px;color:#6b7280}
@media print{ @page{margin:10mm;} body{padding:0} }
</style>
</head>
<body>
<h1>${title}</h1>
${subtitle ? `<p class="subtitle">${subtitle}</p>` : ''}
<table>
<thead><tr>${headers.map((h) => `<th>${h}</th>`).join('')}</tr></thead>
<tbody>${tableRows}</tbody>
</table>
<p class="footer">${footer || `Generado ${new Date().toLocaleString('es-CO')}`}</p>
<script>window.onload=function(){window.print();}</script>
</body>
</html>`;

  const popup = window.open('', '_blank', 'width=1100,height=760');
  if (!popup) return;
  popup.document.write(html);
  popup.document.close();
}

export function exportFacturasPdf(facturas: FacturaItem[], periodLabel: string) {
  const total = facturas.reduce((sum, f) => sum + (Number(f.total) || 0), 0);

  exportPdf({
    title: `Reporte de Facturas - ${periodLabel}`,
    subtitle: `${facturas.length} facturas | Total $${formatCurrency(total)}`,
    headers: ['ID', 'Fecha', 'Cliente', 'Estado', 'Metodo', 'Total'],
    rows: facturas.map((f) => [
      f.facturaId ?? '',
      safeDateLabel(f.fechaFactura),
      f.clienteNombre || 'Sin nombre',
      f.estado || 'pendiente',
      f.metodo || '-',
      `$${formatCurrency(Number(f.total) || 0)}`,
    ]),
  });
}
