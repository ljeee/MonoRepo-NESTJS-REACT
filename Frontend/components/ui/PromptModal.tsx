import React, { useEffect, useState } from 'react';
import { View, Text, TextInput } from '../../tw';
import Button from './Button';
import { ModalShell } from './ModalShell';
import type { IconName } from './Icon';

export interface PromptModalProps {
  visible: boolean;
  title: string;
  label?: string;
  icon?: IconName;
  /** Valor con el que abre (se reinicia en cada apertura). */
  initialValue: string;
  /** 'moneda' muestra "$" y solo acepta dígitos. */
  kind?: 'texto' | 'moneda';
  hint?: string;
  confirmText?: string;
  loading?: boolean;
  /** Devuelve un mensaje para bloquear el envío (validación), o null. */
  validate?: (valor: string) => string | null;
  onConfirm: (valor: string) => void;
  onCancel: () => void;
}

/** Pedir un valor (texto o monto). Reemplaza los modales "editar X" hechos a mano. */
export function PromptModal({
  visible,
  title,
  label,
  icon = 'pencil',
  initialValue,
  kind = 'texto',
  hint,
  confirmText = 'Guardar',
  loading = false,
  validate,
  onConfirm,
  onCancel,
}: PromptModalProps) {
  const [valor, setValor] = useState(initialValue);
  // Queda montado (p. ej. uno por tarjeta): al abrir hay que partir del valor ACTUAL.
  useEffect(() => {
    if (visible) setValor(initialValue);
  }, [visible, initialValue]);

  const error = validate ? validate(valor) : null;
  const moneda = kind === 'moneda';

  return (
    <ModalShell visible={visible} onClose={onCancel} title={title} icon={icon} closeOnBackdrop={!loading}>
      <View className="mb-6">
        {label ? <Text className="text-slate-500 text-[10px] font-black uppercase mb-2 ml-1">{label}</Text> : null}
        <View className="flex-row items-center bg-white/5 border border-white/10 rounded-2xl px-4">
          {moneda && <Text className="text-(--color-pos-primary) font-black text-lg">$</Text>}
          <TextInput
            className={`flex-1 py-4 text-white font-black ${moneda ? 'text-2xl text-center' : 'text-base'}`}
            style={{ fontFamily: 'Space Grotesk' }}
            value={valor}
            onChangeText={(v: string) => setValor(moneda ? v.replace(/\D/g, '') : v)}
            keyboardType={moneda ? 'numeric' : 'default'}
            placeholder={moneda ? '0' : ''}
            placeholderTextColor="#475569"
            selectTextOnFocus
            autoFocus
            onSubmitEditing={() => !error && onConfirm(valor)}
          />
        </View>
        {error ? (
          <Text className="text-red-400 text-[11px] font-bold text-center mt-2">{error}</Text>
        ) : hint ? (
          <Text className="text-slate-600 text-[10px] font-bold text-center mt-2 uppercase tracking-widest">{hint}</Text>
        ) : null}
      </View>

      <View className="flex-row gap-3">
        <View className="flex-1">
          <Button title="Cancelar" onPress={onCancel} variant="ghost" disabled={loading} />
        </View>
        <View className="flex-1">
          <Button title={confirmText} onPress={() => onConfirm(valor)} variant="primary" loading={loading} disabled={!!error} />
        </View>
      </View>
    </ModalShell>
  );
}
