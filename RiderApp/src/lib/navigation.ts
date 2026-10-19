import { Linking, Platform } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import Toast from 'react-native-toast-message';
import {
  formatPhoneDisplay,
  toDialablePhone,
  toWhatsappPhone,
  formatCOP,
  type Domicilio,
} from '@/src/shared';

/**
 * Abre una URL y dice si se pudo. NO se usa `canOpenURL`: en Android 11+ devuelve false para cualquier
 * esquema que la app no declare en `<queries>` del manifiesto (waze://, whatsapp://, google.navigation:),
 * aunque la app esté instalada, y mandaba siempre al navegador. `openURL` sí abre la app y solo rechaza si
 * de verdad no hay quién la atienda.
 */
async function abrir(url: string): Promise<boolean> {
  try {
    await Linking.openURL(url);
    return true;
  } catch {
    return false;
  }
}

/** Prueba cada URL en orden y se queda con la primera que abre. */
async function abrirPrimera(urls: string[]): Promise<boolean> {
  for (const url of urls) {
    if (await abrir(url)) return true;
  }
  return false;
}

const hayCoords = (lat?: number, lng?: number): lat is number =>
  typeof lat === 'number' && typeof lng === 'number' && isFinite(lat) && isFinite(lng) && lat !== 0 && lng !== 0;

/** Abre la dirección o coordenadas en Google Maps (app nativa y, si no hay, el enlace web universal). */
export async function openGoogleMaps(addr: string, lat?: number, lng?: number): Promise<void> {
  const conCoords = hayCoords(lat, lng);
  const cleanAddr = (addr || '').trim();

  if (!conCoords && !cleanAddr) {
    Toast.show({ type: 'error', text1: 'Sin dirección', text2: 'No hay coordenadas ni dirección para navegar' });
    return;
  }

  const destino = conCoords ? `${lat},${lng}` : encodeURIComponent(cleanAddr);
  const nativas =
    Platform.OS === 'android'
      ? [
          `google.navigation:q=${destino}&mode=d`,
          conCoords
            ? `geo:${lat},${lng}?q=${lat},${lng}(${encodeURIComponent(cleanAddr || 'Destino')})`
            : `geo:0,0?q=${encodeURIComponent(cleanAddr)}`,
        ]
      : Platform.OS === 'ios'
        ? [`comgooglemaps://?daddr=${destino}&directionsmode=driving`, `maps:0,0?q=${conCoords ? `${lat},${lng}` : encodeURIComponent(cleanAddr)}`]
        : [];

  const ok = await abrirPrimera([...nativas, `https://www.google.com/maps/dir/?api=1&destination=${destino}`]);
  if (!ok) Toast.show({ type: 'error', text1: 'Error', text2: 'No se pudo abrir Google Maps' });
}

/** Abre Waze para navegar con tráfico en tiempo real. */
export async function openWaze(addr: string, lat?: number, lng?: number): Promise<void> {
  const conCoords = hayCoords(lat, lng);
  const cleanAddr = (addr || '').trim();

  if (!conCoords && !cleanAddr) {
    Toast.show({ type: 'error', text1: 'Sin dirección', text2: 'No hay datos de ubicación disponibles para Waze' });
    return;
  }

  const consulta = conCoords ? `ll=${lat},${lng}` : `q=${encodeURIComponent(cleanAddr)}`;
  const ok = await abrirPrimera([`waze://?${consulta}&navigate=yes`, `https://waze.com/ul?${consulta}&navigate=yes`]);
  if (!ok) Toast.show({ type: 'error', text1: 'Error', text2: 'No se pudo abrir Waze' });
}

/** Abre la conversación de WhatsApp con el cliente, con un mensaje de cortesía prellenado. */
export async function openWhatsApp(phone: string, text?: string): Promise<void> {
  const wa = toWhatsappPhone(phone);
  if (!wa) {
    Toast.show({ type: 'error', text1: 'Teléfono inválido', text2: 'No tiene formato válido para WhatsApp' });
    return;
  }

  const mensaje = text ? encodeURIComponent(text) : '';
  const ok = await abrirPrimera([
    `whatsapp://send?phone=${wa}${mensaje ? `&text=${mensaje}` : ''}`,
    `https://wa.me/${wa}${mensaje ? `?text=${mensaje}` : ''}`,
  ]);
  if (!ok) Toast.show({ type: 'error', text1: 'Error', text2: 'No se pudo abrir WhatsApp' });
}

/**
 * Abre el marcador telefónico para llamar directamente al cliente.
 */
export function callPhone(phone: string): void {
  const dialable = toDialablePhone(phone);
  if (!dialable) {
    Toast.show({ type: 'error', text1: 'Número inválido', text2: 'No se puede marcar este número' });
    return;
  }
  Linking.openURL(`tel:${dialable}`).catch(() => {
    Toast.show({ type: 'error', text1: 'Error', text2: 'No se pudo abrir el marcador de llamadas' });
  });
}

/**
 * Copia un texto al portapapeles y emite una confirmación Toast inmediata.
 */
export async function copyToClipboard(label: string, text: string): Promise<boolean> {
  const clean = (text || '').trim();
  if (!clean) {
    Toast.show({ type: 'info', text1: 'Vacío', text2: `No hay ${label.toLowerCase()} para copiar` });
    return false;
  }
  try {
    await Clipboard.setStringAsync(clean);
    Toast.show({
      type: 'success',
      text1: `${label} copiado`,
      text2: clean.length > 55 ? `${clean.slice(0, 52)}…` : clean,
    });
    return true;
  } catch {
    Toast.show({ type: 'error', text1: 'Error', text2: 'No se pudo copiar al portapapeles' });
    return false;
  }
}

function productLabel(p: { producto?: string; productoNombre?: string; cantidad: number; sabores?: string[] }) {
  const nombre = p.productoNombre?.trim() || p.producto?.trim() || 'Producto';
  const sabores = p.sabores?.length ? ` (${p.sabores.join(', ')})` : '';
  return `${p.cantidad}× ${nombre}${sabores}`;
}

/**
 * Genera una ficha o resumen de entrega completa, perfecta para compartir o pegar
 * en notas o grupos de despacho.
 */
export function buildDeliverySummary(item: Domicilio): string {
  const id = item.orden?.ordenId || item.domicilioId;
  const cliente = item.cliente?.clienteNombre || item.orden?.nombreCliente || item.factura?.clienteNombre || 'Sin nombre';
  const rawPhone = item.telefono || item.orden?.telefonoCliente || item.factura?.telefonoCliente;
  const telefono = rawPhone ? formatPhoneDisplay(rawPhone) : 'Sin teléfono';
  const direccion = item.direccionEntrega || 'Sin dirección';
  const referencia = item.referenciaDomicilio ? `\n🏢 Ref: ${item.referenciaDomicilio}` : '';
  const observaciones = item.orden?.observaciones ? `\n📝 Notas cocina/cliente: ${item.orden.observaciones}` : '';
  
  const pagado = item.factura?.estado === 'pagado' || item.factura?.estado === 'pagada';
  const metodo = item.factura?.metodo ? ` [${item.factura.metodo.toUpperCase()}]` : '';
  const cuenta = item.factura?.cuentaTransferenciaNombre ? ` (${item.factura.cuentaTransferenciaNombre})` : '';
  const totalStr = formatCOP(item.factura?.total || 0);
  const estadoCobro = pagado ? `PAGADO (${totalStr})` : `POR COBRAR: ${totalStr}${metodo}${cuenta}`;

  const productos = (item.orden?.productos ?? [])
    .map((p) => `• ${productLabel(p)}`)
    .join('\n');

  return `🛵 DOMICILIO DFIRU #${id}
👤 Cliente: ${cliente}
📞 Teléfono: ${telefono}
📍 Dirección: ${direccion}${referencia}${observaciones}
💰 Total: ${estadoCobro}
${productos ? `\n📦 Contenido:\n${productos}` : ''}`.trim();
}
