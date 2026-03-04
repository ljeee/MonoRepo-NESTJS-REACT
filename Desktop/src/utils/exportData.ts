/**
 * ── Export Utilities ──
 * CSV and PDF export for accounting/contabilidad
 */

// ── CSV Export ──────────────────────────────────────────────────────────────────

interface CsvConfig<T> {
    filename: string;
    headers: string[];
    rows: T[];
    mapRow: (item: T) => (string | number)[];
}

export function exportCsv<T>({ filename, headers, rows, mapRow }: CsvConfig<T>) {
    const BOM = '\uFEFF'; // UTF-8 BOM for Excel compatibility
    const csvHeader = headers.join(';') + '\n';
    const csvBody = rows.map((r) => mapRow(r).join(';')).join('\n');
    const csvContent = BOM + csvHeader + csvBody;

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${filename}.csv`;
    a.click();
    URL.revokeObjectURL(url);
}

// ── PDF Export (print-based) ────────────────────────────────────────────────────

interface PdfConfig {
    title: string;
    subtitle?: string;
    headers: string[];
    rows: (string | number)[][];
    filename?: string;
}

export function exportPdf({ title, subtitle, headers, rows }: PdfConfig) {
    const tableRows = rows
        .map(
            (row) =>
                `<tr>${row.map((cell) => `<td style="padding:6px 10px;border-bottom:1px solid #e2e8f0;font-size:12px;">${cell}</td>`).join('')}</tr>`
        )
        .join('');

    const html = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8"/>
    <title>${title}</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: 'Segoe UI', system-ui, sans-serif; padding: 30px; color: #1e293b; }
        h1 { font-size: 20px; margin-bottom: 4px; }
        .subtitle { color: #64748b; font-size: 13px; margin-bottom: 20px; }
        table { width: 100%; border-collapse: collapse; }
        thead th {
            text-align: left; padding: 8px 10px; font-size: 11px;
            text-transform: uppercase; letter-spacing: 0.5px;
            background: #f1f5f9; color: #475569; border-bottom: 2px solid #cbd5e1;
        }
        tbody tr:nth-child(even) { background: #f8fafc; }
        .footer { margin-top: 24px; font-size: 11px; color: #94a3b8; text-align: center; }
        @media print {
            body { padding: 15px; }
            @page { margin: 1cm; }
        }
    </style>
</head>
<body>
    <h1>${title}</h1>
    ${subtitle ? `<div class="subtitle">${subtitle}</div>` : ''}
    <table>
        <thead><tr>${headers.map((h) => `<th>${h}</th>`).join('')}</tr></thead>
        <tbody>${tableRows}</tbody>
    </table>
    <div class="footer">Generado el ${new Date().toLocaleString('es-CO')} — POS Desktop</div>
</body>
</html>`;

    const printWindow = window.open('', '_blank', 'width=900,height=700');
    if (printWindow) {
        printWindow.document.write(html);
        printWindow.document.close();
        // Auto-trigger print after load
        printWindow.onload = () => {
            printWindow.print();
        };
    }
}

// ── Facturas export helpers ─────────────────────────────────────────────────────

import type { FacturaVenta } from '../types/models';

function fmtCurrency(n: number) {
    return n.toLocaleString('es-CO');
}

export function exportFacturasCsv(facturas: FacturaVenta[], periodo: string) {
    exportCsv({
        filename: `facturas_${periodo}`,
        headers: ['Factura ID', 'Fecha', 'Cliente', 'Método', 'Total', 'Estado'],
        rows: facturas,
        mapRow: (f) => [
            f.facturaId ?? '',
            f.fechaFactura ? new Date(f.fechaFactura).toLocaleDateString('es-CO') : '',
            f.clienteNombre || 'Sin nombre',
            f.metodo || 'Sin método',
            f.total ?? 0,
            f.estado || '',
        ],
    });
}

export function exportFacturasPdf(facturas: FacturaVenta[], periodo: string) {
    const total = facturas.reduce((s, f) => s + (Number(f.total) || 0), 0);
    exportPdf({
        title: `Reporte de Facturas — ${periodo}`,
        subtitle: `${facturas.length} facturas | Total: $${fmtCurrency(total)}`,
        headers: ['#', 'Fecha', 'Cliente', 'Método', 'Total', 'Estado'],
        rows: facturas.map((f) => [
            f.facturaId ?? 0,
            f.fechaFactura ? new Date(f.fechaFactura).toLocaleDateString('es-CO') : '',
            f.clienteNombre || 'Sin nombre',
            f.metodo || '',
            `$${fmtCurrency(Number(f.total) || 0)}`,
            f.estado || '',
        ]),
    });
}
