import React, { ReactNode } from 'react';
import { ActivityIndicator, StyleSheet } from 'react-native';
import { View, Text } from '../../tw';
import Icon, { IconName } from '../ui/Icon';
import { colors } from '../../styles/tokens';

export interface ChartCardProps {
  title: string;
  subtitle?: string;
  icon?: IconName;
  color?: string;
  /** Controles a la derecha del título (chips, toggles). */
  right?: ReactNode;
  loading?: boolean;
  /** Muestra el estado vacío en lugar del contenido. */
  empty?: boolean;
  emptyText?: string;
  children?: ReactNode;
  /** Clases extra del contenedor (p. ej. ancho en grillas responsive). */
  className?: string;
}

/**
 * Marco común de toda tarjeta de gráfica: encabezado con ícono, estados de carga y
 * vacío. Reemplaza los ~6 encabezados "ícono + título" copiados por pantalla.
 */
export function ChartCard({
  title,
  subtitle,
  icon = 'chart-bar',
  color = colors.primary,
  right,
  loading,
  empty,
  emptyText = 'Sin datos para este período',
  children,
  className = '',
}: ChartCardProps) {
  return (
    <View className={`bg-slate-900 border border-white/5 rounded-3xl p-5 ${className}`}>
      <View style={styles.header}>
        <View style={[styles.iconBox, { backgroundColor: `${color}1A` }]}>
          <Icon name={icon} size={16} color={color} />
        </View>
        <View style={styles.titleBox}>
          <Text className="text-white font-black uppercase text-xs tracking-widest" style={styles.title} numberOfLines={1}>
            {title}
          </Text>
          {!!subtitle && (
            <Text className="text-slate-500 text-[10px] font-bold mt-0.5" numberOfLines={2}>
              {subtitle}
            </Text>
          )}
        </View>
        {right}
      </View>

      {loading ? (
        <View style={styles.estado}>
          <ActivityIndicator color={color} />
        </View>
      ) : empty ? (
        <View style={styles.estado}>
          <Icon name="chart-box-outline" size={28} color={colors.textDim} />
          <Text className="text-slate-500 text-xs italic mt-2 text-center">{emptyText}</Text>
        </View>
      ) : (
        children
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 18 },
  iconBox: { width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  titleBox: { flex: 1, minWidth: 0 },
  title: { fontFamily: 'Space Grotesk' },
  estado: { minHeight: 120, alignItems: 'center', justifyContent: 'center' },
});
