import React, { memo, useCallback } from 'react';
import { StyleSheet } from 'react-native';
import { View, Text, Pressable, ScrollView } from '../../tw';
import Icon, { IconName } from './Icon';

export interface ChipOption<T extends string | number> {
  value: T;
  label: string;
  icon?: IconName;
  /** Número a la derecha (conteos). */
  count?: number;
}

interface ChipGroupBase<T extends string | number> {
  options: ChipOption<T>[];
  /** Color del chip activo. */
  color?: string;
  /** Una sola fila desplazable en vez de varias filas. */
  scroll?: boolean;
  size?: 'sm' | 'md';
}

interface ChipGroupSingle<T extends string | number> extends ChipGroupBase<T> {
  multiple?: false;
  value: T | null;
  onChange: (value: T | null) => void;
  /** Permite deseleccionar el chip activo (vuelve a null). */
  allowEmpty?: boolean;
}

interface ChipGroupMultiple<T extends string | number> extends ChipGroupBase<T> {
  multiple: true;
  value: T[];
  onChange: (value: T[]) => void;
}

export type ChipGroupProps<T extends string | number> = ChipGroupSingle<T> | ChipGroupMultiple<T>;

/**
 * Grupo de chips genérico (selección simple o múltiple). Reemplaza las filas de chips
 * hechas a mano en contabilidad, balance-fechas, inventario, órdenes…
 */
// Sobrecargas: con la unión sola TypeScript ensancha T a string | number.
export function ChipGroup<T extends string | number>(props: ChipGroupMultiple<T>): React.JSX.Element;
export function ChipGroup<T extends string | number>(props: ChipGroupSingle<T>): React.JSX.Element;
export function ChipGroup<T extends string | number>(props: ChipGroupProps<T>): React.JSX.Element {
  const { options, color = '#F5A524', scroll = false, size = 'sm' } = props;
  const activo = (v: T) => (props.multiple ? props.value.includes(v) : props.value === v);

  const alternar = useCallback(
    (v: T) => {
      if (props.multiple) {
        props.onChange(props.value.includes(v) ? props.value.filter((x) => x !== v) : [...props.value, v]);
      } else if (props.value === v) {
        if (props.allowEmpty) props.onChange(null);
      } else {
        props.onChange(v);
      }
    },
    [props],
  );

  const chips = options.map((o) => (
    <Chip key={String(o.value)} option={o} active={activo(o.value)} color={color} size={size} onPress={alternar} />
  ));

  return scroll ? (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.fila}>
      {chips}
    </ScrollView>
  ) : (
    <View style={[styles.fila, styles.envolver]}>{chips}</View>
  );
}

function ChipInterno<T extends string | number>({
  option,
  active,
  color,
  size,
  onPress,
}: {
  option: ChipOption<T>;
  active: boolean;
  color: string;
  size: 'sm' | 'md';
  onPress: (v: T) => void;
}) {
  return (
    <Pressable
      onPress={() => onPress(option.value)}
      style={[
        styles.chip,
        size === 'md' && styles.chipMd,
        active ? { backgroundColor: `${color}26`, borderColor: `${color}80` } : styles.chipInactivo,
      ]}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
    >
      {option.icon && <Icon name={option.icon} size={12} color={active ? color : '#94A3B8'} />}
      <Text style={[styles.texto, { color: active ? color : '#94A3B8' }]}>{option.label}</Text>
      {option.count != null && (
        <Text style={[styles.conteo, { color: active ? color : '#64748B' }]}>{option.count}</Text>
      )}
    </Pressable>
  );
}

const Chip = memo(ChipInterno) as typeof ChipInterno;

const styles = StyleSheet.create({
  fila: { flexDirection: 'row', gap: 6 },
  envolver: { flexWrap: 'wrap' },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, borderWidth: 1 },
  chipMd: { paddingHorizontal: 14, paddingVertical: 8 },
  chipInactivo: { backgroundColor: 'rgba(255,255,255,0.04)', borderColor: 'rgba(255,255,255,0.1)' },
  texto: { fontSize: 10, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 0.6 },
  conteo: { fontSize: 10, fontWeight: '900' },
});
