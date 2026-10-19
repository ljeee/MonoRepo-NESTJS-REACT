import React from 'react';
import { StyleSheet } from 'react-native';
import { View, Text, ScrollView } from '../../tw';
import { FormatoValor, formatearValor } from './formato';

export interface HeatmapProps {
  /** Etiquetas de filas (p. ej. días o sabores). */
  rows: { key: string; label: string }[];
  /** Etiquetas de columnas (p. ej. horas o tamaños). */
  columns: { key: string; label: string }[];
  /** Valor de una celda; 0 o undefined = vacía. */
  value: (rowKey: string, columnKey: string) => number | undefined;
  color?: string;
  formato?: FormatoValor;
  cellWidth?: number;
  /** Escribe el valor dentro de cada celda (útil con pocas columnas). */
  showValues?: boolean;
  rowLabelWidth?: number;
}

/** Mapa de calor con Views (día × hora, sabor × tamaño). Intensidad relativa al máximo. */
export function Heatmap({
  rows,
  columns,
  value,
  color = '#F5A524',
  formato = 'numero',
  cellWidth = 26,
  showValues = false,
  rowLabelWidth = 64,
}: HeatmapProps) {
  let max = 0;
  for (const r of rows) for (const c of columns) max = Math.max(max, value(r.key, c.key) ?? 0);

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
      <View>
        <View style={styles.fila}>
          <View style={{ width: rowLabelWidth }} />
          {columns.map((c) => (
            <Text key={c.key} style={[styles.encabezado, { width: cellWidth }]} numberOfLines={1}>
              {c.label}
            </Text>
          ))}
        </View>
        {rows.map((r) => (
          <View key={r.key} style={styles.fila}>
            <Text style={[styles.etiquetaFila, { width: rowLabelWidth }]} numberOfLines={1}>
              {r.label}
            </Text>
            {columns.map((c) => {
              const v = value(r.key, c.key) ?? 0;
              const intensidad = max > 0 ? v / max : 0;
              return (
                <View
                  key={c.key}
                  style={[
                    styles.celda,
                    { width: cellWidth - 3, backgroundColor: v > 0 ? color : 'rgba(255,255,255,0.04)', opacity: v > 0 ? 0.18 + intensidad * 0.82 : 1 },
                  ]}
                  accessibilityLabel={`${r.label}, ${c.label}: ${formatearValor(v, formato)}`}
                >
                  {showValues && v > 0 && (
                    <Text style={styles.valorCelda} numberOfLines={1}>
                      {formatearValor(v, formato === 'moneda' ? 'monedaCompacta' : formato)}
                    </Text>
                  )}
                </View>
              );
            })}
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  fila: { flexDirection: 'row', alignItems: 'center', marginBottom: 3 },
  encabezado: { color: '#64748B', fontSize: 8, fontWeight: '900', textAlign: 'center', textTransform: 'uppercase' },
  etiquetaFila: { color: '#94A3B8', fontSize: 9, fontWeight: '800', textTransform: 'uppercase', paddingRight: 6 },
  celda: { height: 22, borderRadius: 4, marginRight: 3, alignItems: 'center', justifyContent: 'center' },
  valorCelda: { color: '#0F172A', fontSize: 8, fontWeight: '900' },
});
