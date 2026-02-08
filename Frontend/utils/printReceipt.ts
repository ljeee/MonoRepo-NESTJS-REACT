import { Platform } from 'react-native';
import { formatCurrency } from './formatNumber';

export interface ReceiptProduct {
  nombre: string;
  cantidad: number;
  precioUnitario: number;
}

/**
 * Genera recibo HTML para impresora térmica 80mm y abre window.print()
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
  if (Platform.OS !== 'web') return;

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
@page{margin:0;size:80mm auto}*{margin:0;padding:0;box-sizing:border-box}
body{font-family:'Courier New',monospace;font-size:12px;width:80mm;padding:4mm;color:#000}
.c{text-align:center}.b{font-weight:bold}
.d{border-top:1px dashed #000;margin:6px 0}
h1{font-size:18px;margin-bottom:2px}
table{width:100%;border-collapse:collapse}td{padding:2px 0;vertical-align:top}
.t td{font-size:16px;font-weight:bold;padding-top:6px}
.f{margin-top:8px;font-size:10px}
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

  const w = window.open('', '_blank', 'width=320,height=600');
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
  if (Platform.OS !== 'web') return;

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
  window.open(url, '_blank');
}
