import { Platform, Linking } from 'react-native';
import { formatCurrency } from '@/src/shared';

/** Ancho del rollo de la impresora térmica (mm). Xprinter T82E = 80mm. */
const PAPER_WIDTH_MM = 80;

export interface ReceiptProduct {
  nombre: string;
  cantidad: number;
  precioUnitario: number;
}

export interface OrderReceiptProduct {
  nombre: string;
  cantidad: number;
  sabores?: string[];
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
 * Genera recibo de COCINA (sin precios) para órdenes — formato ticket compacto
 */
export function printOrderReceipt(data: {
  ordenId: number;
  clienteNombre?: string;
  tipoPedido?: string;
  observaciones?: string;
  direccion?: string;
  productos: OrderReceiptProduct[];
  fecha?: string;
}) {
  if (Platform.OS !== 'web') return;

  const fecha = data.fecha
    ? new Date(data.fecha).toLocaleString('es-CO', { dateStyle: 'short', timeStyle: 'short' })
    : new Date().toLocaleString('es-CO', { dateStyle: 'short', timeStyle: 'short' });

  const tipoLabel = data.tipoPedido === 'domicilio'
    ? '🛵 DOMICILIO'
    : data.tipoPedido === 'llevar'
      ? '🛍 PARA LLEVAR'
      : data.tipoPedido === 'mesa'
        ? `🪑 MESA`
        : (data.tipoPedido || 'LOCAL').toUpperCase();

  const productRows = data.productos
    .map((p) => {
      const saboresStr = p.sabores && p.sabores.length > 0
        ? `<br><span style="color:#444;font-size:13px">[${p.sabores.join(' + ')}]</span>`
        : '';
      return `<tr><td class="b" style="width:34px;vertical-align:top">${p.cantidad}x</td><td style="vertical-align:top">${p.nombre}${saboresStr}</td></tr>`;
    })
    .join('');

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Cocina #${data.ordenId}</title>
<style>
@page{margin:0;size:${PAPER_WIDTH_MM}mm auto}*{margin:0;padding:0;box-sizing:border-box}
body{font-family:'Courier New',monospace;font-size:15px;width:${PAPER_WIDTH_MM}mm;padding:4mm 3mm;color:#000;background:#fff;line-height:1.4}
.c{text-align:center}.b{font-weight:bold}
.d{border-top:2px dashed #000;margin:6px 0}
.tipo{font-size:19px;font-weight:bold;text-align:center;padding:5px;border:2px solid #000;margin:6px 0;letter-spacing:1px}
h1{font-size:24px;margin-bottom:1px;text-align:center;font-weight:bold;letter-spacing:2px}
.orden{text-align:center;font-size:46px;font-weight:bold;padding:4px 0;line-height:1}
table{width:100%;border-collapse:collapse}td{padding:3px 0;vertical-align:top}
.nota{background:#eee;padding:6px;border-left:4px solid #000;margin:6px 0;font-style:italic;font-size:14px}
/* Barra de control: visible en pantalla, oculta al imprimir */
.bar{position:fixed;top:0;left:0;right:0;display:flex;gap:8px;justify-content:center;padding:10px;background:#111;font-family:system-ui,sans-serif}
.bar button{font-size:14px;font-weight:700;padding:10px 16px;border:0;border-radius:8px;cursor:pointer}
.bar .pr{background:#F5A524;color:#000}.bar .cl{background:#334155;color:#fff}
.sheet{margin-top:64px}
@media print{.bar{display:none}.sheet{margin-top:0}}
</style></head><body>
<div class="bar">
  <button class="pr" onclick="window.print()">🖨 Imprimir</button>
  <button class="cl" onclick="window.close()">Cerrar</button>
</div>
<div class="sheet">
<h1>COCINA</h1>
<div class="orden">#${data.ordenId}</div>
<div class="d"></div>
<div class="tipo">${tipoLabel}</div>
${data.clienteNombre ? `<p class="c b" style="font-size:16px">${data.clienteNombre}</p>` : ''}
${data.direccion ? `<p class="c" style="font-size:13px">📍 ${data.direccion}</p>` : ''}
<p class="c" style="font-size:13px;color:#444">${fecha}</p>
<div class="d"></div>
${data.observaciones ? `<div class="nota">⚠ ${data.observaciones}</div>` : ''}
<table><tbody>${productRows}</tbody></table>
<div class="d"></div>
<p class="c" style="font-size:12px">— D'Firu Pizzeria —</p>
</div>
<script>window.onload=function(){setTimeout(function(){window.print()},250)};</script>
</body></html>`;

  const w = window.open('', '_blank', `width=${PAPER_WIDTH_MM * 5},height=640`);
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
