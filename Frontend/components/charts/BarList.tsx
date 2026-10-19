import React, { memo, useCallback } from 'react';
import { StyleSheet } from 'react-native';
import { View, Text, Pressable } from '../../tw';
import { FormatoValor, formatearValor, variacion, colorVariacion } from './formato';

export interface BarListItem {
  key: string;
  label: string;
  value: number;
  /** Texto secundario bajo la etiqueta (p. ej. "12 órdenes · $480k"). */
  sublabel?: string;
  /** Valor del período anterior: muestra la variación. */
  previous?: number | null;
  /** Marca visual de dato incompleto (p. ej. sabor sin clasificar). */
  muted?: boolean;
}

export interface BarListProps {
  items: BarListItem[];
  color?: string;
  formato?: FormatoValor;
  /** Muestra la posición (#1, #2…). */
  ranked?: boolean;
  /** Máximo de filas visibles. */
  limit?: number;
  onPressItem?: (key: string) => void;
}

/**
 * Ranking horizontal: etiqueta, valor, barra proporcional al mayor y, si se pasa el
 * período anterior, la variación. Reemplaza los HBar y "share bars" copiados en
 * estadisticas, contabilidad y domiciliarios.
 */
export function BarList({ items, color = '#10B981', formato = 'numero', ranked = true, limit, onPressItem }: BarListProps) {
  const visibles = limit ? items.slice(0, limit) : items;
  const max = Math.max(1, ...visibles.map((i) => i.value));
  return (
    <View style={styles.lista}>
      {visibles.map((item, idx) => (
        <BarListRow
          key={item.key}
          item={item}
          rank={ranked ? idx + 1 : undefined}
          pct={(item.value / max) * 100}
          color={color}
          formato={formato}
          onPress={onPressItem}
        />
      ))}
    </View>
  );
}

const BarListRow = memo(function BarListRow({
  item,
  rank,
  pct,
  color,
  formato,
  onPress,
}: {
  item: BarListItem;
  rank?: number;
  pct: number;
  color: string;
  formato: FormatoValor;
  onPress?: (key: string) => void;
}) {
  const handlePress = useCallback(() => onPress?.(item.key), [onPress, item.key]);
  const delta = item.previous !== undefined ? variacion(item.value, item.previous) : undefined;
  const contenido = (
    <>
      <View style={styles.fila}>
        {rank != null && <Text style={[styles.rank, { color }]}>#{rank}</Text>}
        <View style={styles.etiquetas}>
          <Text
            className={`text-xs font-bold uppercase ${item.muted ? 'text-slate-500 italic' : 'text-slate-200'}`}
            numberOfLines={1}
          >
            {item.label}
          </Text>
          {!!item.sublabel && (
            <Text className="text-slate-500 text-[10px] font-bold mt-0.5" numberOfLines={1}>
              {item.sublabel}
            </Text>
          )}
        </View>
        <View style={styles.valores}>
          <Text className="text-white font-black text-xs" style={styles.numero}>
            {formatearValor(item.value, formato)}
          </Text>
          {delta !== undefined && (
            <Text style={[styles.delta, { color: colorVariacion(delta) }]}>
              {delta == null ? (item.value > 0 ? 'nuevo' : '—') : `${delta > 0 ? '▲' : delta < 0 ? '▼' : ''} ${Math.abs(delta)}%`}
            </Text>
          )}
        </View>
      </View>
      <View style={styles.pista}>
        <View style={[styles.barra, { width: `${Math.max(pct, item.value > 0 ? 2 : 0)}%`, backgroundColor: item.muted ? '#475569' : color }]} />
      </View>
    </>
  );

  return onPress ? (
    <Pressable onPress={handlePress} className="active:opacity-70" style={styles.item} accessibilityRole="button" accessibilityLabel={`${item.label}: ${formatearValor(item.value, formato)}`}>
      {contenido}
    </Pressable>
  ) : (
    <View style={styles.item} accessibilityLabel={`${item.label}: ${formatearValor(item.value, formato)}`}>
      {contenido}
    </View>
  );
});

const styles = StyleSheet.create({
  lista: { gap: 14 },
  item: {},
  fila: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  rank: { fontSize: 11, fontWeight: '900', minWidth: 22 },
  etiquetas: { flex: 1, minWidth: 0 },
  valores: { alignItems: 'flex-end' },
  numero: { fontFamily: 'Space Grotesk' },
  delta: { fontSize: 9, fontWeight: '800', marginTop: 1 },
  pista: { height: 6, backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 6, overflow: 'hidden' },
  barra: { height: 6, borderRadius: 6 },
});
