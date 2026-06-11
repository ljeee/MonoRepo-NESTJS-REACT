import React from 'react';
import { TouchableOpacity } from 'react-native';
import { View, Text } from '../../tw';
import Input from './Input';
import Button from './Button';
import Icon from './Icon';
import { validateFlexibleDateRange, getRangeDates } from '@/src/shared';

interface Preset {
  label: string;
  days: number;
}

// Mes preset: from 1st of current month to today
function getMesRange(): { from: string; to: string } {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  const toISO = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const first = new Date(now.getFullYear(), now.getMonth(), 1);
  return { from: toISO(first), to: toISO(now) };
}

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
}: DateRangeFilterProps) {
  const [localActive, setLocalActive] = React.useState<number | null>(null);
  const active = activePreset ?? localActive;

  const handlePreset = (idx: number, preset: Preset) => {
    const range = idx === 4 ? getMesRange() : getRangeDates(preset.days);
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

  const PRESETS: Preset[] = [
    { label: 'Hoy',  days: 0  },
    { label: 'Ayer', days: -1 },
    { label: '7d',   days: 7  },
    { label: '30d',  days: 30 },
    { label: 'Mes',  days: 30 },
  ];

  return (
    <View className="bg-white/5 rounded-2xl border border-white/5 p-4 mb-4">
      {/* Preset chips */}
      <View className="flex-row gap-2 mb-3 flex-wrap">
        {PRESETS.map((p, idx) => {
          const isActive = active === idx;
          return (
            <TouchableOpacity
              key={p.label}
              onPress={() => handlePreset(idx, p)}
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
                {p.label}
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
