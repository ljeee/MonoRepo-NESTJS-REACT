import React from 'react';
import { StyleSheet } from 'react-native';
import { Text, Pressable, ScrollView } from '../../tw';
import Icon, { IconName } from './Icon';

export interface SegmentOption<T extends string> {
  value: T;
  label: string;
  icon?: IconName;
}

export interface SegmentedControlProps<T extends string> {
  options: SegmentOption<T>[];
  value: T;
  onChange: (value: T) => void;
  color?: string;
}

/** Pestañas/segmentos (una opción activa). Se desplaza si no cabe (móvil). */
export function SegmentedControl<T extends string>({ options, value, onChange, color = '#F5A524' }: SegmentedControlProps<T>) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.contenedor}>
      {options.map((o) => {
        const activo = o.value === value;
        return (
          <Pressable
            key={o.value}
            onPress={() => onChange(o.value)}
            style={[styles.segmento, activo && { backgroundColor: `${color}22`, borderColor: `${color}66` }]}
            accessibilityRole="tab"
            accessibilityState={{ selected: activo }}
          >
            {o.icon && <Icon name={o.icon} size={14} color={activo ? color : '#64748B'} />}
            <Text style={[styles.texto, { color: activo ? '#F8FAFC' : '#94A3B8' }]}>{o.label}</Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  contenedor: {
    flexDirection: 'row',
    gap: 6,
    padding: 4,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  segmento: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  texto: { fontSize: 11, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 0.6 },
});
