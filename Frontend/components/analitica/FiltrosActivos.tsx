import React, { useMemo } from 'react';
import { StyleSheet } from 'react-native';
import { Text, Pressable, ScrollView } from '../../tw';
import { Icon } from '../ui';
import type { OpcionesAnalitica } from '@/src/shared';
import type { ClaveFiltro, FiltrosExtra } from '../../hooks/use-analitica-filtros';
import {
  CANAL_LABEL,
  DIA_LABEL,
  ESTADO_PAGO_LABEL,
  METODO_LABEL,
  TIPO_PEDIDO_LABEL,
  etiquetaCategoria,
  etiquetaTamano,
} from './etiquetas';

interface Chip {
  id: string;
  texto: string;
  quitar: () => void;
}

export interface FiltrosActivosProps {
  filtros: FiltrosExtra;
  opciones?: OpcionesAnalitica;
  onCambiar: <K extends ClaveFiltro>(clave: K, valor: FiltrosExtra[K] | undefined) => void;
  onLimpiar: () => void;
}

/** Chips removibles con cada filtro activo, con nombres legibles (no ids). */
export function FiltrosActivos({ filtros, opciones, onCambiar, onLimpiar }: FiltrosActivosProps) {
  const chips = useMemo<Chip[]>(() => {
    const lista: Chip[] = [];
    const deLista = <K extends ClaveFiltro>(clave: K, etiqueta: (v: never) => string, prefijo = '') => {
      const valores = (filtros[clave] ?? []) as unknown[];
      if (!Array.isArray(valores)) return;
      for (const v of valores) {
        lista.push({
          id: `${clave}:${String(v)}`,
          texto: `${prefijo}${etiqueta(v as never)}`,
          quitar: () => onCambiar(clave, (valores.filter((x) => x !== v) as unknown) as FiltrosExtra[K]),
        });
      }
    };
    const nombreProducto = (id: number) => opciones?.productos.find((p) => p.productoId === id)?.nombre ?? `#${id}`;
    const nombreSabor = (id: number) => opciones?.sabores.find((s) => s.saborId === id)?.nombre ?? `#${id}`;

    deLista('tipoPedido', (v: string) => TIPO_PEDIDO_LABEL[v] ?? v);
    deLista('categoria', (v: string) => etiquetaCategoria(v));
    deLista('tamano', (v: string) => etiquetaTamano(v));
    deLista('productoId', (v: number) => nombreProducto(v));
    deLista('saborId', (v: number) => nombreSabor(v), 'Sabor: ');
    deLista('saborGrupoId', (v: number) => opciones?.grupos?.find((g) => g.id === v)?.nombre ?? `#${v}`, 'Grupo: ');
    deLista('metodoPago', (v: string) => METODO_LABEL[v] ?? v);
    deLista('estadoPago', (v: string) => ESTADO_PAGO_LABEL[v] ?? v);
    deLista('canal', (v: string) => CANAL_LABEL[v] ?? v);
    deLista('diaSemana', (v: number) => DIA_LABEL[v - 1] ?? String(v));

    if (filtros.horaDesde != null || filtros.horaHasta != null) {
      lista.push({
        id: 'hora',
        texto: `${filtros.horaDesde ?? 0}h – ${filtros.horaHasta ?? 23}h`,
        quitar: () => {
          onCambiar('horaDesde', undefined);
          onCambiar('horaHasta', undefined);
        },
      });
    }
    if (filtros.domiciliario) {
      const nombre = opciones?.domiciliarios.find((d) => d.telefono === filtros.domiciliario)?.nombre ?? filtros.domiciliario;
      lista.push({ id: 'domiciliario', texto: `Domiciliario: ${nombre}`, quitar: () => onCambiar('domiciliario', undefined) });
    }
    if (filtros.usuario) {
      const nombre = opciones?.usuarios.find((u) => u.id === filtros.usuario)?.nombre ?? 'usuario';
      lista.push({ id: 'usuario', texto: `Creada por: ${nombre}`, quitar: () => onCambiar('usuario', undefined) });
    }
    if (filtros.cliente) lista.push({ id: 'cliente', texto: `Cliente: ${filtros.cliente}`, quitar: () => onCambiar('cliente', undefined) });
    if (filtros.precioManual != null) {
      lista.push({
        id: 'precioManual',
        texto: filtros.precioManual ? 'Con precio manual' : 'Precio normal',
        quitar: () => onCambiar('precioManual', undefined),
      });
    }
    return lista;
  }, [filtros, opciones, onCambiar]);

  if (!chips.length) return null;

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.fila}>
      {chips.map((c) => (
        <Pressable key={c.id} onPress={c.quitar} style={styles.chip} accessibilityLabel={`Quitar filtro ${c.texto}`}>
          <Text style={styles.texto}>{c.texto}</Text>
          <Icon name="close" size={12} color="#F5A524" />
        </Pressable>
      ))}
      <Pressable onPress={onLimpiar} style={[styles.chip, styles.limpiar]}>
        <Text style={[styles.texto, styles.textoLimpiar]}>Quitar todos</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  fila: { flexDirection: 'row', gap: 6, paddingBottom: 4 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: 'rgba(245,165,36,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(245,165,36,0.35)',
  },
  texto: { color: '#FCD34D', fontSize: 10, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 0.5 },
  limpiar: { backgroundColor: 'rgba(255,255,255,0.04)', borderColor: 'rgba(255,255,255,0.1)' },
  textoLimpiar: { color: '#94A3B8' },
});
