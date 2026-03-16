import { Platform, Linking } from 'react-native';
import { formatCurrency } from '@monorepo/shared';

export interface ReceiptProduct {
  nombre: string;
  cantidad: number;
  precioUnitario: number;
}

/**
 * Genera recibo HTML para formato Business Card (55x85mm) y abre window.print()
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
        `<tr><td class="b">${p.cantidad}x</td><td>${p.nombre}</td><td style="text-align:right">$${formatCurrency(p.precioUnitario * p.cantidad)}</td></tr>`,
    )
    .join('');

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Recibo</title>
<style>
@page{margin:0;size:55mm 85mm}*{margin:0;padding:0;box-sizing:border-box}
body{font-family:'Inter',system-ui,sans-serif;font-size:10px;width:55mm;height:85mm;padding:3mm;color:#000;background:#fff;line-height:1.2}
.c{text-align:center}.b{font-weight:bold}
.d{border-top:1px dashed #ccc;margin:4px 0}
h1{font-size:14px;margin-bottom:1px;letter-spacing:-0.5px}
table{width:100%;border-collapse:collapse}td{padding:1px 0;vertical-align:top}
.t td{font-size:12px;font-weight:bold;padding-top:4px}
.f{margin-top:6px;font-size:8px;color:#666}
.meta{font-size:9px}
</style></head><body>
<div class="c"><h1>PIZZERIA</h1><p class="meta">${fecha}</p></div>
<div class="d"></div>
<div class="meta">${data.ordenId ? `<p><span class="b">Orden:</span> #${data.ordenId}</p>` : ''}
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
  // We allow execution on mobile now, so we remove the block.
  // if (Platform.OS !== 'web') return;

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
  
  if (Platform.OS === 'web') {
    window.open(url, '_blank');
  } else {
    Linking.openURL(url).catch(err => console.error('Error opening WhatsApp:', err));
  }
}
