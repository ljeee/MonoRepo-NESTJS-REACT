import React from 'react';
import { ScrollView } from 'react-native';
import { View, Text, TouchableOpacity } from '../../tw';
import Button from './Button';
import Icon, { IconName } from './Icon';
import { ModalShell } from './ModalShell';

export interface PickerOption<T extends string | number> {
  value: T;
  label: string;
  icon?: IconName;
}

export interface OptionPickerModalProps<T extends string | number> {
  visible: boolean;
  title: string;
  subtitle?: string;
  icon?: IconName;
  color?: string;
  options: PickerOption<T>[];
  loading?: boolean;
  /** Mostrando "Cargando…" mientras llegan las opciones. */
  fetching?: boolean;
  emptyText?: string;
  onSelect: (option: PickerOption<T>) => void;
  onCancel: () => void;
}

/** Elegir una opción de una lista corta (cuentas, domiciliarios…). */
export function OptionPickerModal<T extends string | number>({
  visible,
  title,
  subtitle,
  icon,
  color = '#A78BFA',
  options,
  loading = false,
  fetching = false,
  emptyText = 'No hay opciones.',
  onSelect,
  onCancel,
}: OptionPickerModalProps<T>) {
  return (
    <ModalShell visible={visible} onClose={onCancel} title={title} subtitle={subtitle} icon={icon} color={color} closeOnBackdrop={!loading}>
      <ScrollView style={{ maxHeight: 280 }} className="mb-6">
        {fetching ? (
          <Text className="text-slate-500 text-center py-4">Cargando...</Text>
        ) : options.length === 0 ? (
          <Text className="text-slate-500 text-center py-4">{emptyText}</Text>
        ) : (
          <View className="gap-2">
            {options.map((o) => (
              <TouchableOpacity
                key={String(o.value)}
                onPress={() => onSelect(o)}
                disabled={loading}
                className="flex-row items-center gap-3 p-4 rounded-xl bg-black/30 border border-white/10"
              >
                {o.icon && <Icon name={o.icon} size={16} color={color} />}
                <Text className="text-slate-300 font-bold text-sm">{o.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </ScrollView>
      <Button title="Cancelar" onPress={onCancel} variant="ghost" disabled={loading} />
    </ModalShell>
  );
}
