import { formatCurrency } from '@monorepo/shared';

export interface ReceiptProduct {
  nombre: string;
  cantidad: number;
  precioUnitario: number;
}

/**
 * Genera recibo HTML imprimible adaptable para ticket o hoja estándar.
 */
export function printReceipt(data: {
  ordenId?: number;
  clienteNombre: string;
  metodo: string;
  productos: ReceiptProduct[];
  total: number;
  costoDomicilio?: number;
  fecha?: string;
}) {
  const fecha = data.fecha
    ? new Date(data.fecha).toLocaleString('es-CO', { dateStyle: 'short', timeStyle: 'short' })
    : new Date().toLocaleString('es-CO', { dateStyle: 'short', timeStyle: 'short' });

  const productRows = data.productos
    .map(
      (p) =>
        `<tr><td>${p.cantidad}x ${p.nombre}</td><td style="text-align:right">$${formatCurrency(p.precioUnitario * p.cantidad)}</td></tr>`,
    )
    .join('');

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Recibo</title>
<style>
@page{margin:0;size:auto}*{margin:0;padding:0;box-sizing:border-box}
body{font-family:'Courier New',monospace;font-size:16px;width:100%;max-width:400px;margin:0 auto;padding:20px;color:#000}
.c{text-align:center}.b{font-weight:bold}
.d{border-top:2px dashed #000;margin:12px 0}
h1{font-size:24px;margin-bottom:4px}
table{width:100%;border-collapse:collapse}td{padding:4px 0;vertical-align:top}
.t td{font-size:20px;font-weight:bold;padding-top:10px}
.f{margin-top:16px;font-size:14px}
@media print{
  body{max-width:100%;padding:12mm;font-size:17px}
  h1{font-size:28px}
  td{font-size:16px}
  .t td{font-size:24px}
}
</style></head><body>
<div class="c"><h1>PIZZERIA</h1><p>${fecha}</p></div>
<div class="d"></div>
<div>${data.ordenId ? `<p><span class="b">Orden:</span> #${data.ordenId}</p>` : ''}
<p><span class="b">Cliente:</span> ${data.clienteNombre || 'N/A'}</p>
<p><span class="b">Pago:</span> ${data.metodo || 'N/A'}</p></div>
<div class="d"></div>
<table><tbody>${productRows}</tbody></table>
${data.costoDomicilio ? `<div class="d"></div><table><tr><td>Domicilio</td><td style="text-align:right">$${formatCurrency(data.costoDomicilio)}</td></tr></table>` : ''}
<div class="d"></div>
<table><tr class="t"><td>TOTAL</td><td style="text-align:right">$${formatCurrency(data.total)}</td></tr></table>
<div class="d"></div>
<div class="c f"><p>Gracias por su compra!</p></div>
<script>window.onload=function(){window.print();setTimeout(function(){window.close()},500)};</script>
</body></html>`;

  const w = window.open('', '_blank', 'width=900,height=800');
  if (w) { w.document.write(html); w.document.close(); }
}

/**
 * Abre WhatsApp Web con mensaje prellenado para el domiciliario
 */
export function sendWhatsAppDomicilio(
  telefonoDomiciliario: string,
  data: {
    clienteNombre: string;
    direccion: string;
    telefonoCliente?: string;
    productos: ReceiptProduct[];
    total: number;
    costoDomicilio?: number;
    metodo: string;
  },
) {
  const productList = data.productos
    .map((p) => `- ${p.cantidad}x ${p.nombre} - $${formatCurrency(p.precioUnitario * p.cantidad)}`)
    .join('\n');

  const message = [
    'NUEVO DOMICILIO',
    '',
    `Cliente: ${data.clienteNombre}`,
    data.telefonoCliente ? `Tel: ${data.telefonoCliente}` : '',
    `Direccion: ${data.direccion}`,
    '',
    'Productos:',
    productList,
    '',
    `Total: $${formatCurrency(data.total)}`,
    data.costoDomicilio ? `(Domicilio: $${formatCurrency(data.costoDomicilio)})` : '',
    `Pago: ${data.metodo}`,
  ]
    .filter(Boolean)
    .join('\n');

  let phone = telefonoDomiciliario.replace(/\D/g, '');
  if (phone.length === 10) phone = '57' + phone;

  const url = `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;

  // Tauri WebView2 blocks window.open for external URLs.
  // Use an anchor element click to open in the system browser.
  const a = document.createElement('a');
  a.href = url;
  a.target = '_blank';
  a.rel = 'noopener noreferrer';
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  setTimeout(() => document.body.removeChild(a), 100);
}
