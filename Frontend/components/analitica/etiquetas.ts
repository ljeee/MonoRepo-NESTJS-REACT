import { CATEGORIA_PRODUCTO_LABEL } from '@/src/shared';
import type { CategoriaProducto, TamanoPizza } from '@/src/shared';
import type { IconName } from '../ui/Icon';

/** Paleta categórica para series y donas (contraste sobre el fondo oscuro del POS). */
export const PALETA = ['#F5A524', '#3B82F6', '#10B981', '#A855F7', '#F43F5E', '#14B8A6', '#EAB308', '#94A3B8'];
export const colorDe = (i: number) => PALETA[i % PALETA.length];

export const TIPO_PEDIDO_LABEL: Record<string, string> = { mesa: 'Mesa', llevar: 'Para llevar', domicilio: 'Domicilio' };
export const METODO_LABEL: Record<string, string> = {
  efectivo: 'Efectivo',
  transferencia: 'QR/Trans',
  mixto: 'Mixto',
  sin_metodo: 'Sin método',
  otro: 'Otro',
};
export const ESTADO_PAGO_LABEL: Record<string, string> = { cobrada: 'Cobrada', parcial: 'Con abono', pendiente: 'Pendiente' };
export const CANAL_LABEL: Record<string, string> = { pos: 'POS', web: 'Web clientes', historico: 'Sin registro' };
export const TAMANO_LABEL: Record<TamanoPizza, string> = { pequena: 'Pequeña', mediana: 'Mediana', grande: 'Grande' };
export const DIA_LABEL = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
export const DIA_LABEL_LARGO = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];

export const etiquetaCategoria = (c: string) => CATEGORIA_PRODUCTO_LABEL[c as CategoriaProducto] ?? c;
export const etiquetaTamano = (t: string | null) => (t ? TAMANO_LABEL[t as TamanoPizza] ?? t : '');

export const ICONO_CATEGORIA: Record<string, IconName> = {
  pizza: 'pizza',
  calzone: 'food-croissant',
  bebida: 'bottle-soda',
  jugo: 'cup',
  adicion: 'plus-circle-outline',
  comida: 'hamburger',
  otro: 'dots-horizontal-circle-outline',
};

const FECHA_CORTA = new Intl.DateTimeFormat('es-CO', { day: '2-digit', month: 'short', timeZone: 'UTC' });
const MES = new Intl.DateTimeFormat('es-CO', { month: 'short', year: '2-digit', timeZone: 'UTC' });

/** Etiqueta del eje de una serie: 'YYYY-MM-DD' es la fecha local de Bogotá (se formatea en UTC). */
export function etiquetaPeriodo(periodo: string, granularidad: 'dia' | 'semana' | 'mes'): string {
  const fecha = new Date(`${periodo}T00:00:00Z`);
  if (Number.isNaN(fecha.getTime())) return periodo;
  return granularidad === 'mes' ? MES.format(fecha) : FECHA_CORTA.format(fecha);
}
