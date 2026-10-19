import React, { memo } from 'react';
import { StyleSheet } from 'react-native';
import { View, Text, Pressable } from '../../tw';
import Icon, { IconName } from './Icon';
import { variacion, colorVariacion } from '../charts/formato';

export interface StatCardProps {
  label: string;
  value: string;
  icon?: IconName;
  color?: string;
  /** Texto pequeño bajo el valor. */
  sub?: string;
  /** Valores numéricos actual/anterior: calculan y pintan la variación. */
  current?: number;
  previous?: number | null;
  /** Para métricas donde bajar es bueno (cancelaciones, descuentos). */
  lowerIsBetter?: boolean;
  onPress?: () => void;
  /** Clases del contenedor (ancho en grillas). */
  className?: string;
  /**
   * 'card' (por defecto): KPI con ícono, variación y acento inferior.
   * 'counter': contador compacto — barra de color, número grande y etiqueta (estado de órdenes, pendientes…).
   */
  variant?: 'card' | 'counter';
  /** Solo 'counter': pinta el número con `color` (hay algo que atender). */
  urgent?: boolean;
  /** Solo 'counter': fondo teñido con `color` (resalta el contador, p. ej. "Sin asignar" > 0). */
  tinted?: boolean;
  /** Ancho fijo en px (grillas de 2 columnas calculadas a mano). */
  width?: number;
}

/**
 * Tarjeta de KPI única: etiqueta, valor, ícono y variación vs el período anterior.
 * Reemplaza las KpiCard/StatCard definidas inline en dashboard, analítica,
 * contabilidad y domiciliarios.
 */
export const StatCard = memo(function StatCard({
  label,
  value,
  icon,
  color = '#F5A524',
  sub,
  current,
  previous,
  lowerIsBetter = false,
  onPress,
  className = '',
  variant = 'card',
  urgent = false,
  tinted = false,
  width,
}: StatCardProps) {
  if (variant === 'counter') {
    const fondo = tinted ? { backgroundColor: `${color}1A`, borderColor: `${color}40` } : null;
    const cuerpo = (
      <>
        <View style={[styles.barra, { backgroundColor: color }]} />
        <View style={styles.contadorTexto}>
          <Text style={[styles.contadorValor, { color: urgent ? color : '#F8FAFC' }]} numberOfLines={1}>
            {value}
          </Text>
          <Text style={styles.contadorEtiqueta} numberOfLines={1}>
            {label}
          </Text>
        </View>
        {onPress ? <Icon name="chevron-right" size={14} color={color} /> : null}
      </>
    );
    const caja = [styles.contador, width ? { width } : { flex: 1, minWidth: 130 }, fondo];
    const clasesContador = `bg-white/[0.04] border border-white/[0.07] rounded-2xl ${className}`;
    return onPress ? (
      <Pressable onPress={onPress} className={`${clasesContador} active:opacity-80`} style={caja} accessibilityRole="button" accessibilityLabel={`${label}: ${value}`}>
        {cuerpo}
      </Pressable>
    ) : (
      <View className={clasesContador} style={caja} accessibilityLabel={`${label}: ${value}`}>
        {cuerpo}
      </View>
    );
  }

  const delta = current != null && previous !== undefined ? variacion(current, previous) : undefined;
  const contenido = (
    <>
      <View style={styles.cabecera}>
        {icon && (
          <View style={[styles.icono, { backgroundColor: `${color}22` }]}>
            <Icon name={icon} size={18} color={color} />
          </View>
        )}
        <Text className="text-slate-500 text-[10px] font-black uppercase tracking-widest flex-1" numberOfLines={2}>
          {label}
        </Text>
      </View>
      <Text className="text-white text-xl font-black tracking-tight" style={styles.valor} numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </Text>
      <View style={styles.pie}>
        {delta !== undefined && (
          <Text style={[styles.delta, { color: colorVariacion(delta, lowerIsBetter) }]}>
            {delta == null ? (current ? 'nuevo' : '—') : `${delta > 0 ? '▲' : delta < 0 ? '▼' : '='} ${Math.abs(delta)}%`}
          </Text>
        )}
        {!!sub && (
          <Text className="text-slate-500 text-[10px] font-bold flex-1" numberOfLines={2}>
            {sub}
          </Text>
        )}
      </View>
      <View style={[styles.acento, { backgroundColor: color }]} />
    </>
  );

  const clases = `bg-slate-900 border border-white/5 rounded-2xl overflow-hidden ${className}`;
  return onPress ? (
    <Pressable onPress={onPress} className={`${clases} active:opacity-80`} style={styles.caja} accessibilityRole="button" accessibilityLabel={`${label}: ${value}`}>
      {contenido}
    </Pressable>
  ) : (
    <View className={clases} style={styles.caja} accessibilityLabel={`${label}: ${value}`}>
      {contenido}
    </View>
  );
});

const styles = StyleSheet.create({
  caja: { padding: 14, minWidth: 150, flexGrow: 1, flexBasis: 150 },
  cabecera: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  icono: { width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  valor: { fontFamily: 'SpaceGrotesk-Bold' },
  pie: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4, minHeight: 14 },
  delta: { fontSize: 10, fontWeight: '900' },
  acento: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 3, opacity: 0.35 },
  contador: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16 },
  barra: { width: 3, height: 36, borderRadius: 2 },
  contadorTexto: { flex: 1 },
  contadorValor: { fontFamily: 'SpaceGrotesk-Bold', fontSize: 22, fontWeight: '900' },
  contadorEtiqueta: { color: '#7C8BA1', fontSize: 10, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 1 },
});
