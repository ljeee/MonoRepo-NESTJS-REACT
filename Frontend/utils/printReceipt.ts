import { Platform, Linking } from 'react-native';
import {
  cobrado,
  formatCurrency,
  isAnulada,
  isCobrada,
  isParcial,
  montoEfectivo,
  porCobrar,
  toWhatsappPhone,
  transferenciasPorCuenta,
} from '@/src/shared';
import type { DesgloseTransferencia, EmpresaConfig, FacturaDomicilio, FacturaOrden } from '@/src/shared';
import { api } from '../services/api';

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

/** Lo que el recibo necesita de una factura (FacturaItem / FacturaVenta lo cumplen). */
export interface ReciboFactura {
  facturaId?: number;
  clienteNombre?: string;
  fechaFactura?: string;
  total?: number;
  montoPagado?: number;
  metodo?: string;
  estado?: string;
  pagoEfectivo?: number;
  pagoTransferencia?: number;
  cuentaTransferenciaId?: number | null;
  cuentaTransferenciaNombre?: string | null;
  desgloseTransferencia?: DesgloseTransferencia[] | null;
  ordenes?: FacturaOrden[];
  domicilios?: FacturaDomicilio[];
}

const esc = (valor: unknown) =>
  String(valor ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
const pesos = (n: number) => `$${formatCurrency(Math.round(n))}`;
const FECHA = new Intl.DateTimeFormat('es-CO', { dateStyle: 'short', timeStyle: 'short', timeZone: 'America/Bogota' });
const TIPO_PEDIDO: Record<string, string> = { mesa: 'Mesa', llevar: 'Para llevar', domicilio: 'Domicilio' };

// Datos del negocio para el encabezado (GET /empresa es público): se piden una vez y quedan en memoria.
let empresaCache: Promise<Partial<EmpresaConfig> | null> | null = null;
function datosEmpresa(): Promise<Partial<EmpresaConfig> | null> {
  if (!empresaCache) {
    empresaCache = Promise.race([
      api.empresa.get().catch(() => null),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), 2500)),
    ]).then((e) => {
      if (!e) empresaCache = null; // se reintenta en el próximo recibo
      return e;
    });
  }
  return empresaCache;
}

/** Abre la ventana YA (en el clic, para que el navegador no la bloquee) y escribe el recibo cuando está listo. */
function abrirVentana(ancho: number): Window | null {
  const w = window.open('', '_blank', `width=${ancho},height=640`);
  w?.document.write('<p style="font-family:system-ui,sans-serif;padding:16px;color:#475569">Preparando recibo…</p>');
  return w;
}

function escribir(w: Window | null, html: string) {
  if (!w) return;
  w.document.open();
  w.document.write(html);
  w.document.close();
}

/** Forma de pago en líneas, con las definiciones de dinero del POS (las mismas del libro diario). */
function lineasPago(f: ReciboFactura): { titulo: string; lineas: [string, string][]; estado: string } {
  if (isAnulada(f)) return { titulo: 'Anulada', lineas: [], estado: 'FACTURA ANULADA' };
  const efectivo = montoEfectivo(f);
  const cuentas = transferenciasPorCuenta(f);
  const lineas: [string, string][] = [
    ...(efectivo > 0 ? [['Efectivo', pesos(efectivo)] as [string, string]] : []),
    ...cuentas.map((c) => [`QR · ${c.cuenta || 'sin cuenta'}`, pesos(c.monto)] as [string, string]),
  ];
  if (isParcial(f)) {
    return { titulo: 'Abonos', lineas: [...lineas, ['Saldo pendiente', pesos(porCobrar(f))]], estado: `ABONADO ${pesos(cobrado(f))} · DEBE ${pesos(porCobrar(f))}` };
  }
  if (!isCobrada(f)) return { titulo: 'Pendiente de pago', lineas: [], estado: 'PENDIENTE DE PAGO' };
  const titulo = efectivo > 0 && cuentas.length ? 'Mixto' : cuentas.length ? 'QR / transferencia' : efectivo > 0 ? 'Efectivo' : 'Pagado';
  // Un solo medio: la línea repetiría el total; basta con el título.
  return { titulo, lineas: lineas.length > 1 ? lineas : [], estado: 'PAGADO' };
}

const ESTILOS_TICKET = `
@page{margin:0;size:${PAPER_WIDTH_MM}mm auto}*{margin:0;padding:0;box-sizing:border-box}
body{font-family:Arial,Helvetica,sans-serif;font-size:13px;width:${PAPER_WIDTH_MM}mm;padding:4mm 4mm 6mm;color:#000;background:#fff;line-height:1.3}
.c{text-align:center}.b{font-weight:bold}.r{text-align:right;white-space:nowrap}
.d{border-top:1px dashed #000;margin:6px 0}
h1{font-size:20px;letter-spacing:.5px}
.meta{font-size:12px}
table{width:100%;border-collapse:collapse}td{padding:1px 0;vertical-align:top}
.det td{font-size:12px;color:#222;padding-bottom:3px}
.total td{font-size:17px;font-weight:bold;padding-top:4px}
.estado{font-size:14px;font-weight:bold;text-align:center;padding:4px;border:2px solid #000;margin:6px 0}
.f{font-size:12px}
.bar{position:fixed;top:0;left:0;right:0;display:flex;gap:8px;justify-content:center;padding:10px;background:#111;font-family:system-ui,sans-serif}
.bar button{font-size:14px;font-weight:700;padding:10px 16px;border:0;border-radius:8px;cursor:pointer}
.bar .pr{background:#F5A524;color:#000}.bar .cl{background:#334155;color:#fff}
.sheet{margin-top:64px}
@media print{.bar{display:none}.sheet{margin-top:0}}`;

const BARRA = `<div class="bar"><button class="pr" onclick="window.print()">🖨 Imprimir</button><button class="cl" onclick="window.close()">Cerrar</button></div>`;

/**
 * Recibo del CLIENTE en el rollo de 80 mm (alto automático: no se corta con pedidos largos). Encabezado con los datos
 * del negocio, productos (cantidad × precio), subtotal, domicilio, total, forma de pago (efectivo, QR por cuenta,
 * mixto, abonos con saldo) y estado. Imprime solo y cierra la ventana al terminar.
 */
export function printReceipt(f: ReciboFactura) {
  if (Platform.OS !== 'web') return;
  const w = abrirVentana(PAPER_WIDTH_MM * 5);

  void datosEmpresa().then((empresa) => {
    const nombreNegocio = empresa?.nombreComercial || empresa?.razonSocial || "D'Firu Pizzería";
    const contacto = [empresa?.direccion, empresa?.municipio, empresa?.telefono ? `Tel. ${empresa.telefono}` : null].filter(Boolean).join(' · ');
    const fecha = f.fechaFactura ? FECHA.format(new Date(f.fechaFactura)) : FECHA.format(new Date());
    const tipo = f.ordenes?.find((o) => o.tipoPedido)?.tipoPedido;
    const dom = f.domicilios?.[0];
    const costoDomicilio = Number(dom?.costoDomicilio) || 0;

    const productos = (f.ordenes ?? []).flatMap((o) => o.productos ?? []);
    const filas = productos
      .map((p) => {
        const cantidad = p.cantidad ?? 1;
        const unitario = Number(p.precioUnitario) || 0;
        const linea = cantidad * unitario;
        return cantidad > 1
          ? `<tr><td colspan="2" class="b">${cantidad} x ${esc(p.productoNombre || 'Producto')}</td></tr>
             <tr class="det"><td>&nbsp;&nbsp;${cantidad} x ${pesos(unitario)}</td><td class="r">${pesos(linea)}</td></tr>`
          : `<tr><td class="b">1 x ${esc(p.productoNombre || 'Producto')}</td><td class="r">${pesos(linea)}</td></tr>`;
      })
      .join('');
    const subtotal = productos.reduce((s, p) => s + (p.cantidad ?? 1) * (Number(p.precioUnitario) || 0), 0);
    const pago = lineasPago(f);

    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Recibo #${esc(f.facturaId ?? '')}</title><style>${ESTILOS_TICKET}</style></head><body>
${BARRA}
<div class="sheet">
<div class="c"><h1>${esc(nombreNegocio)}</h1>
${empresa?.nit ? `<p class="meta">NIT ${esc(empresa.nit)}</p>` : ''}
${contacto ? `<p class="meta">${esc(contacto)}</p>` : ''}</div>
<div class="d"></div>
<table class="meta"><tr><td class="b">Factura #${esc(f.facturaId ?? '—')}</td><td class="r">${esc(fecha)}</td></tr></table>
<p class="meta"><span class="b">Cliente:</span> ${esc(f.clienteNombre || 'Consumidor final')}</p>
${tipo ? `<p class="meta"><span class="b">Pedido:</span> ${esc(TIPO_PEDIDO[tipo] ?? tipo)}</p>` : ''}
${dom?.direccionEntrega ? `<p class="meta"><span class="b">Dirección:</span> ${esc(dom.direccionEntrega)}${dom.referencia ? ` (${esc(dom.referencia)})` : ''}</p>` : ''}
<div class="d"></div>
<table><tbody>${filas || '<tr><td>Sin productos</td></tr>'}</tbody></table>
<div class="d"></div>
<table>
${costoDomicilio ? `<tr><td>Subtotal productos</td><td class="r">${pesos(subtotal)}</td></tr><tr><td>Domicilio</td><td class="r">${pesos(costoDomicilio)}</td></tr>` : ''}
<tr class="total"><td>TOTAL</td><td class="r">${pesos(Number(f.total) || 0)}</td></tr>
</table>
<div class="d"></div>
<table class="meta"><tr><td class="b">Pago: ${esc(pago.titulo)}</td><td></td></tr>
${pago.lineas.map(([k, v]) => `<tr><td>&nbsp;&nbsp;${esc(k)}</td><td class="r">${esc(v)}</td></tr>`).join('')}</table>
<div class="estado">${esc(pago.estado)}</div>
<div class="c f"><p>¡Gracias por su compra!</p><p>${esc(nombreNegocio)}</p></div>
</div>
<script>window.onafterprint=function(){window.close()};window.onload=function(){setTimeout(function(){window.print()},250)};</script>
</body></html>`;
    escribir(w, html);
  });
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

  const fecha = data.fecha ? FECHA.format(new Date(data.fecha)) : FECHA.format(new Date());

  const tipoLabel = data.tipoPedido === 'domicilio'
    ? '🛵 DOMICILIO'
    : data.tipoPedido === 'llevar'
      ? '🛍 PARA LLEVAR'
      : data.tipoPedido === 'mesa'
        ? `🪑 MESA`
        : esc((data.tipoPedido || 'LOCAL').toUpperCase());

  const productRows = data.productos
    .map((p) => {
      const saboresStr = p.sabores && p.sabores.length > 0
        ? `<br><span style="color:#444;font-size:13px">[${esc(p.sabores.join(' + '))}]</span>`
        : '';
      return `<tr><td class="b" style="width:34px;vertical-align:top">${p.cantidad}x</td><td style="vertical-align:top">${esc(p.nombre)}${saboresStr}</td></tr>`;
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
${BARRA}
<div class="sheet">
<h1>COCINA</h1>
<div class="orden">#${data.ordenId}</div>
<div class="d"></div>
<div class="tipo">${tipoLabel}</div>
${data.clienteNombre ? `<p class="c b" style="font-size:16px">${esc(data.clienteNombre)}</p>` : ''}
${data.direccion ? `<p class="c" style="font-size:13px">📍 ${esc(data.direccion)}</p>` : ''}
<p class="c" style="font-size:13px;color:#444">${esc(fecha)}</p>
<div class="d"></div>
${data.observaciones ? `<div class="nota">⚠ ${esc(data.observaciones)}</div>` : ''}
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
    referencia?: string;
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
    data.referencia ? `Referencia: ${data.referencia}` : '',
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

  const phone = toWhatsappPhone(telefonoDomiciliario);

  const url = `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;

  if (Platform.OS === 'web') {
    window.open(url, '_blank');
  } else {
    Linking.openURL(url).catch(err => console.error('Error opening WhatsApp:', err));
  }
}
