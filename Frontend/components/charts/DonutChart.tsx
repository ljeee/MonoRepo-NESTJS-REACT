import React, { useMemo } from 'react';
import { StyleSheet } from 'react-native';
import Svg, { Circle, G } from 'react-native-svg';
import { View, Text } from '../../tw';
import { FormatoValor, formatearValor } from './formato';

export interface DonutSegment {
  key: string;
  label: string;
  value: number;
  color: string;
}

export interface DonutChartProps {
  segments: DonutSegment[];
  formato?: FormatoValor;
  size?: number;
  /** Texto en el centro (por defecto el total). */
  centerLabel?: string;
}

const GROSOR = 14;

/** Dona (SVG) con leyenda de porcentajes. Para mezclas: tipo de pedido, método, canal. */
export function DonutChart({ segments, formato = 'numero', size = 132, centerLabel = 'Total' }: DonutChartProps) {
  const total = segments.reduce((s, x) => s + x.value, 0);
  const radio = (size - GROSOR) / 2;
  const circunferencia = 2 * Math.PI * radio;

  const arcos = useMemo(() => {
    let acumulado = 0;
    return segments
      .filter((s) => s.value > 0)
      .map((s) => {
        const fraccion = total > 0 ? s.value / total : 0;
        const arco = { ...s, largo: fraccion * circunferencia, offset: acumulado * circunferencia };
        acumulado += fraccion;
        return arco;
      });
  }, [segments, total, circunferencia]);

  return (
    <View style={styles.fila}>
      <View style={{ width: size, height: size }}>
        <Svg width={size} height={size}>
          <G rotation={-90} origin={`${size / 2}, ${size / 2}`}>
            <Circle cx={size / 2} cy={size / 2} r={radio} stroke="rgba(255,255,255,0.06)" strokeWidth={GROSOR} fill="none" />
            {arcos.map((a) => (
              <Circle
                key={a.key}
                cx={size / 2}
                cy={size / 2}
                r={radio}
                stroke={a.color}
                strokeWidth={GROSOR}
                fill="none"
                strokeDasharray={`${a.largo} ${circunferencia - a.largo}`}
                strokeDashoffset={-a.offset}
              />
            ))}
          </G>
        </Svg>
        <View style={[StyleSheet.absoluteFill, styles.centro]} pointerEvents="none">
          <Text className="text-white font-black text-sm" style={styles.numero} numberOfLines={1}>
            {formatearValor(total, formato === 'moneda' ? 'monedaCompacta' : formato)}
          </Text>
          <Text className="text-slate-500 text-[9px] font-black uppercase">{centerLabel}</Text>
        </View>
      </View>
      <View style={styles.leyenda}>
        {segments.map((s) => (
          <View key={s.key} style={styles.itemLeyenda} accessibilityLabel={`${s.label}: ${formatearValor(s.value, formato)}`}>
            <View style={[styles.punto, { backgroundColor: s.color }]} />
            <Text className="text-slate-300 text-[11px] font-bold flex-1" numberOfLines={1}>
              {s.label}
            </Text>
            <Text className="text-white text-[11px] font-black" style={styles.numero}>
              {total > 0 ? Math.round((s.value / total) * 100) : 0}%
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  fila: { flexDirection: 'row', alignItems: 'center', gap: 16, flexWrap: 'wrap' },
  centro: { alignItems: 'center', justifyContent: 'center' },
  numero: { fontFamily: 'Space Grotesk' },
  leyenda: { flex: 1, minWidth: 140, gap: 8 },
  itemLeyenda: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  punto: { width: 10, height: 10, borderRadius: 5 },
});
