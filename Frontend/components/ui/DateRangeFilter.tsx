import React from 'react';
import { TouchableOpacity } from 'react-native';
import { View, Text } from '../../tw';
import Input from './Input';
import Button from './Button';
import Icon from './Icon';
import { validateFlexibleDateRange, presetRange } from '@/src/shared';
import type { PresetRango } from '@/src/shared';

const PRESET_LABEL: Record<PresetRango, string> = {
  hoy: 'Hoy',
  ayer: 'Ayer',
  semana: 'Semana',
  '7d': '7d',
  '30d': '30d',
  mes: 'Mes',
  mesAnterior: 'Mes ant.',
  anio: 'Año',
};

/** Los mismos 5 atajos de siempre y en el mismo orden (`activePreset` es un índice). */
const PRESETS_POR_DEFECTO: PresetRango[] = ['hoy', 'ayer', '7d', '30d', 'mes'];

export interface DateRangeFilterProps {
  from: string;
  to: string;
  onFromChange: (v: string) => void;
  onToChange: (v: string) => void;
  onSearch: (from: string, to: string) => void;
  loading?: boolean;
  /** Active preset index, controlled externally */
  activePreset?: number;
  onPresetChange?: (idx: number) => void;
  /** Atajos a mostrar (por defecto hoy, ayer, 7d, 30d, mes). Se calculan en hora de Bogotá. */
  presets?: PresetRango[];
  /** Con onCompararChange se muestra el interruptor "Comparar con el período anterior". */
  comparar?: boolean;
  onCompararChange?: (comparar: boolean) => void;
}

export function DateRangeFilter({
  from,
  to,
  onFromChange,
  onToChange,
  onSearch,
  loading,
  activePreset,
  onPresetChange,
  presets = PRESETS_POR_DEFECTO,
  comparar,
  onCompararChange,
}: DateRangeFilterProps) {
  const [localActive, setLocalActive] = React.useState<number | null>(null);
  const active = activePreset ?? localActive;

  const handlePreset = (idx: number, preset: PresetRango) => {
    // Día contable de Bogotá, no el del dispositivo (antes 'Mes' se detectaba por índice).
    const range = presetRange(preset);
    onFromChange(range.from);
    onToChange(range.to);
    if (onPresetChange) onPresetChange(idx);
    else setLocalActive(idx);
    const { error } = validateFlexibleDateRange(range.from, range.to);
    if (!error) onSearch(range.from, range.to);
  };

  const handleSearchPress = () => {
    const { from: f, to: t, error } = validateFlexibleDateRange(from, to);
    if (!error) onSearch(f, t);
  };

  const { error } = from && to ? validateFlexibleDateRange(from, to) : { error: null };

  return (
    <View className="bg-white/5 rounded-2xl border border-white/5 p-4 mb-4">
      {/* Preset chips */}
      <View className="flex-row gap-2 mb-3 flex-wrap">
        {presets.map((p, idx) => {
          const isActive = active === idx;
          return (
            <TouchableOpacity
              key={p}
              onPress={() => handlePreset(idx, p)}
              // Mientras carga una búsqueda no se apilan otras (cada atajo dispara una búsqueda completa).
              disabled={!!loading}
              style={loading ? { opacity: 0.5 } : undefined}
              accessibilityLabel={`Buscar ${PRESET_LABEL[p]}`}
              className={`px-3 py-1.5 rounded-full border ${
                isActive
                  ? 'bg-(--color-pos-primary) border-(--color-pos-primary)'
                  : 'bg-white/5 border-white/10'
              }`}
            >
              <Text
                className={`text-[10px] font-black uppercase tracking-wider ${
                  isActive ? 'text-black' : 'text-slate-400'
                }`}
              >
                {PRESET_LABEL[p]}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Date inputs */}
      <View className="flex-row gap-3">
        <View className="flex-1">
          <Input
            label="Desde"
            value={from}
            onChangeText={v => { onFromChange(v); if (onPresetChange) onPresetChange(-1); else setLocalActive(null); }}
            placeholder="YYYY-MM-DD"
            size="sm"
            leftIcon={<Icon name="calendar-start" size={14} color="#64748B" />}
          />
        </View>
        <View className="flex-1">
          <Input
            label="Hasta"
            value={to}
            onChangeText={v => { onToChange(v); if (onPresetChange) onPresetChange(-1); else setLocalActive(null); }}
            placeholder="YYYY-MM-DD"
            size="sm"
            leftIcon={<Icon name="calendar-end" size={14} color="#64748B" />}
          />
        </View>
      </View>

      {/* Error */}
      {!!error && (
        <View className="flex-row items-center gap-2 mb-2">
          <Icon name="alert-circle-outline" size={12} color="#F43F5E" />
          <Text className="text-red-400 text-[10px] font-bold">{error}</Text>
        </View>
      )}

      {onCompararChange && (
        <TouchableOpacity
          onPress={() => onCompararChange(!comparar)}
          className="flex-row items-center gap-2 mb-3"
          accessibilityRole="switch"
          accessibilityState={{ checked: !!comparar }}
        >
          <Icon name={comparar ? 'checkbox-marked' : 'checkbox-blank-outline'} size={18} color={comparar ? '#F5A524' : '#64748B'} />
          <Text className="text-slate-300 text-xs font-bold">Comparar con el período anterior</Text>
        </TouchableOpacity>
      )}

      {/* Search button */}
      <Button
        title="Buscar"
        icon="magnify"
        loading={loading}
        variant="primary"
        size="sm"
        onPress={handleSearchPress}
        disabled={!!error || !from || !to || loading}
      />
    </View>
  );
}
