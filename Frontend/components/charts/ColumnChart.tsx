import React, { memo } from 'react';
import { StyleSheet } from 'react-native';
import { View, Text, ScrollView } from '../../tw';
import { FormatoValor, formatearValor } from './formato';

export interface ColumnChartPoint {
  key: string;
  label: string;
  value: number;
  /** Valor del período anterior (columna fantasma detrás). */
  previous?: number | null;
}

export interface ColumnChartProps {
  data: ColumnChartPoint[];
  color?: string;
  formato?: FormatoValor;
  /** Altura del área de barras (fija: con alturas % sin altura del padre las barras colapsan). */
  height?: number;
  /** Ancho mínimo por columna; si no caben, se desplaza horizontalmente. */
  columnWidth?: number;
  /** Muestra el valor sobre cada barra. */
  showValues?: boolean;
  /** Mostrar solo una de cada N etiquetas (series largas). */
  labelEvery?: number;
  highlightKey?: string;
}

/**
 * Columnas verticales. Reemplaza las gráficas por hora (3 copias, la del Dashboard se
 * colapsaba en móvil por usar flex sin altura) y la de ventas por día.
 */
export function ColumnChart({
  data,
  color = '#3B82F6',
  formato = 'numero',
  height = 140,
  columnWidth = 26,
  showValues = true,
  labelEvery = 1,
  highlightKey,
}: ColumnChartProps) {
  const max = Math.max(1, ...data.map((d) => Math.max(d.value, d.previous ?? 0)));
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.scroll}>
      <View style={styles.fila}>
        {data.map((d, i) => (
          <Columna
            key={d.key}
            punto={d}
            max={max}
            height={height}
            width={columnWidth}
            color={color}
            formato={formato}
            showValue={showValues}
            showLabel={i % labelEvery === 0}
            destacada={highlightKey === d.key}
          />
        ))}
      </View>
    </ScrollView>
  );
}

const Columna = memo(function Columna({
  punto,
  max,
  height,
  width,
  color,
  formato,
  showValue,
  showLabel,
  destacada,
}: {
  punto: ColumnChartPoint;
  max: number;
  height: number;
  width: number;
  color: string;
  formato: FormatoValor;
  showValue: boolean;
  showLabel: boolean;
  destacada: boolean;
}) {
  const alto = (punto.value / max) * height;
  const altoPrevio = punto.previous != null ? (punto.previous / max) * height : 0;
  return (
    <View style={[styles.columna, { width }]} accessibilityLabel={`${punto.label}: ${formatearValor(punto.value, formato)}`}>
      <Text style={styles.valor} numberOfLines={1}>
        {showValue && punto.value > 0 ? formatearValor(punto.value, formato === 'moneda' ? 'monedaCompacta' : formato) : ''}
      </Text>
      <View style={[styles.pista, { height, width: Math.min(width - 6, 18) }]}>
        {altoPrevio > 0 && <View style={[styles.previa, { height: altoPrevio }]} />}
        <View
          style={[
            styles.barra,
            { height: Math.max(alto, punto.value > 0 ? 2 : 0), backgroundColor: color, opacity: destacada ? 1 : 0.85 },
          ]}
        />
      </View>
      <Text style={[styles.etiqueta, destacada && styles.etiquetaDestacada]} numberOfLines={1}>
        {showLabel ? punto.label : ''}
      </Text>
    </View>
  );
});

const styles = StyleSheet.create({
  scroll: { flexGrow: 1 },
  fila: { flexDirection: 'row', alignItems: 'flex-end', gap: 4, paddingHorizontal: 2 },
  columna: { alignItems: 'center' },
  valor: { color: '#E2E8F0', fontSize: 8, fontWeight: '900', marginBottom: 3, height: 11 },
  pista: { justifyContent: 'flex-end', backgroundColor: 'rgba(255,255,255,0.04)', borderTopLeftRadius: 4, borderTopRightRadius: 4, overflow: 'hidden' },
  previa: { position: 'absolute', left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(148,163,184,0.25)' },
  barra: { width: '100%', borderTopLeftRadius: 4, borderTopRightRadius: 4 },
  etiqueta: { color: '#64748B', fontSize: 8, fontWeight: '900', marginTop: 5, textTransform: 'uppercase', height: 11 },
  etiquetaDestacada: { color: '#F8FAFC' },
});
