import React from 'react';
import { TouchableOpacity } from 'react-native';
import { View, Text } from '../../tw';

// ── Filtro por método de pago, reutilizable en las 4 vistas de facturas/balance ──
// Mixto = facturas con metodo === 'efectivo_transferencia' (su propio bucket).

export type MethodFilterValue = 'todos' | 'efectivo' | 'transferencia' | 'mixto' | 'pendiente';

export interface MethodFilterChipsProps {
  value: string;
  onChange: (v: MethodFilterValue) => void;
  /** Conteos opcionales por chip; si se pasan, se muestra un badge con el número */
  counts?: Partial<Record<MethodFilterValue, number>>;
  /** Incluir el chip "Pendiente" (estado). Por defecto true (vistas de día). */
  includePendiente?: boolean;
}

type Chip = { key: MethodFilterValue; label: string; color: string; activeBg: string; activeBorder: string };

const CHIPS: Chip[] = [
  { key: 'todos',         label: 'Todos',      color: '#94A3B8', activeBg: 'rgba(148,163,184,0.12)', activeBorder: 'rgba(148,163,184,0.3)' },
  { key: 'efectivo',      label: 'Efectivo',   color: '#10B981', activeBg: 'rgba(16,185,129,0.12)',  activeBorder: 'rgba(16,185,129,0.3)' },
  { key: 'transferencia', label: 'QR / Trans', color: '#6366F1', activeBg: 'rgba(99,102,241,0.12)',  activeBorder: 'rgba(99,102,241,0.3)' },
  { key: 'mixto',         label: 'Mixto',      color: '#F5A524', activeBg: 'rgba(245,165,36,0.12)',  activeBorder: 'rgba(245,165,36,0.3)' },
  { key: 'pendiente',     label: 'Pendiente',  color: '#FB923C', activeBg: 'rgba(251,146,60,0.12)',  activeBorder: 'rgba(251,146,60,0.3)' },
];

export function MethodFilterChips({ value, onChange, counts, includePendiente = true }: MethodFilterChipsProps) {
  const chips = includePendiente ? CHIPS : CHIPS.filter(c => c.key !== 'pendiente');
  return (
    <View className="flex-row flex-wrap gap-2">
      {chips.map(({ key, label, color, activeBg, activeBorder }) => {
        const isSelected = value === key;
        const count = counts?.[key];
        return (
          <TouchableOpacity
            key={key}
            onPress={() => onChange(key)}
            style={{
              flexDirection: 'row', alignItems: 'center', gap: 6,
              paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20,
              backgroundColor: isSelected ? activeBg : 'rgba(255,255,255,0.04)',
              borderWidth: 1,
              borderColor: isSelected ? activeBorder : 'rgba(255,255,255,0.08)',
            }}
          >
            <Text style={{ fontSize: 10, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 0.8, color: isSelected ? color : '#64748B' }}>
              {label}
            </Text>
            {count !== undefined && (
              <View style={{ backgroundColor: isSelected ? color + '25' : 'rgba(255,255,255,0.06)', borderRadius: 10, paddingHorizontal: 5, paddingVertical: 1 }}>
                <Text style={{ fontSize: 9, fontWeight: '900', color: isSelected ? color : '#475569' }}>{count}</Text>
              </View>
            )}
          </TouchableOpacity>
        );
      })}
    </View>
  );
}
