import React, { useCallback, useMemo, useState } from 'react';
import { LayoutChangeEvent, StyleSheet } from 'react-native';
import Svg, { Circle, Defs, Line, LinearGradient, Path, Stop } from 'react-native-svg';
import { View, Text, Pressable } from '../../tw';
import { FormatoValor, formatearValor } from './formato';

export interface LineChartPoint {
  key: string;
  label: string;
  value: number;
}

export interface LineChartProps {
  data: LineChartPoint[];
  /** Serie del período anterior, alineada por posición (punteada). */
  comparison?: number[] | null;
  color?: string;
  formato?: FormatoValor;
  height?: number;
  /** Mostrar solo una de cada N etiquetas del eje X. */
  labelEvery?: number;
}

const PAD_X = 8;
const PAD_TOP = 12;
const PAD_BOTTOM = 4;

/**
 * Línea con área (SVG) y comparación punteada. Tocar el gráfico selecciona el punto
 * más cercano y muestra su valor. El ancho se mide con onLayout: funciona igual en
 * web y en móvil.
 */
export function LineChart({ data, comparison, color = '#10B981', formato = 'numero', height = 160, labelEvery = 1 }: LineChartProps) {
  const [ancho, setAncho] = useState(0);
  const [seleccion, setSeleccion] = useState<number | null>(null);

  const onLayout = useCallback((e: LayoutChangeEvent) => setAncho(e.nativeEvent.layout.width), []);

  const geometria = useMemo(() => {
    if (!ancho || data.length === 0) return null;
    const valores = data.map((d) => d.value);
    const max = Math.max(1, ...valores, ...(comparison ?? []));
    const alto = height - PAD_TOP - PAD_BOTTOM;
    const pasoX = data.length > 1 ? (ancho - PAD_X * 2) / (data.length - 1) : 0;
    const x = (i: number) => PAD_X + (data.length > 1 ? i * pasoX : (ancho - PAD_X * 2) / 2);
    const y = (v: number) => PAD_TOP + alto - (v / max) * alto;
    const linea = (serie: number[]) => serie.map((v, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
    const lineaActual = linea(valores);
    const area = `${lineaActual} L${x(valores.length - 1).toFixed(1)},${PAD_TOP + alto} L${x(0).toFixed(1)},${PAD_TOP + alto} Z`;
    const comp = comparison && comparison.length ? linea(comparison.slice(0, data.length)) : null;
    return { x, y, lineaActual, area, comp, max };
  }, [ancho, data, comparison, height]);

  const seleccionar = useCallback(
    (locationX: number) => {
      if (!geometria || data.length === 0) return;
      let mejor = 0;
      let distancia = Infinity;
      data.forEach((_, i) => {
        const d = Math.abs(geometria.x(i) - locationX);
        if (d < distancia) {
          distancia = d;
          mejor = i;
        }
      });
      setSeleccion(mejor);
    },
    [geometria, data],
  );

  const punto = seleccion != null ? data[seleccion] : null;
  const previo = seleccion != null && comparison ? comparison[seleccion] : undefined;

  return (
    <View>
      <View style={styles.leyenda}>
        <Text className="text-white font-black text-sm" style={styles.numero}>
          {punto ? formatearValor(punto.value, formato) : formatearValor(data.reduce((s, d) => s + d.value, 0), formato)}
        </Text>
        <Text className="text-slate-500 text-[10px] font-bold uppercase ml-2">
          {punto ? punto.label : 'Total del período'}
          {previo !== undefined ? ` · antes ${formatearValor(previo, formato)}` : ''}
        </Text>
      </View>
      <Pressable
        onLayout={onLayout}
        onPress={(e) => seleccionar(e.nativeEvent.locationX)}
        style={{ height }}
        accessibilityLabel="Gráfica de tendencia. Toca para ver el valor de un punto."
      >
        {geometria && (
          <Svg width={ancho} height={height}>
            <Defs>
              <LinearGradient id="relleno" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor={color} stopOpacity={0.35} />
                <Stop offset="1" stopColor={color} stopOpacity={0} />
              </LinearGradient>
            </Defs>
            <Line x1={PAD_X} x2={ancho - PAD_X} y1={height - PAD_BOTTOM} y2={height - PAD_BOTTOM} stroke="rgba(255,255,255,0.08)" strokeWidth={1} />
            <Path d={geometria.area} fill="url(#relleno)" />
            {geometria.comp && <Path d={geometria.comp} stroke="#94A3B8" strokeWidth={1.5} strokeDasharray="4 4" fill="none" opacity={0.7} />}
            <Path d={geometria.lineaActual} stroke={color} strokeWidth={2.5} fill="none" strokeLinejoin="round" strokeLinecap="round" />
            {seleccion != null && (
              <>
                <Line x1={geometria.x(seleccion)} x2={geometria.x(seleccion)} y1={PAD_TOP} y2={height - PAD_BOTTOM} stroke="rgba(255,255,255,0.25)" strokeWidth={1} />
                <Circle cx={geometria.x(seleccion)} cy={geometria.y(data[seleccion].value)} r={4.5} fill={color} stroke="#0F172A" strokeWidth={2} />
              </>
            )}
          </Svg>
        )}
      </Pressable>
      <View style={styles.ejeX}>
        {data.map((d, i) => (
          <Text key={d.key} style={styles.etiqueta} numberOfLines={1}>
            {i % labelEvery === 0 ? d.label : ''}
          </Text>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  leyenda: { flexDirection: 'row', alignItems: 'baseline', marginBottom: 8, flexWrap: 'wrap' },
  numero: { fontFamily: 'Space Grotesk' },
  ejeX: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 4, paddingHorizontal: 2 },
  etiqueta: { flex: 1, color: '#64748B', fontSize: 8, fontWeight: '900', textTransform: 'uppercase', textAlign: 'center' },
});
