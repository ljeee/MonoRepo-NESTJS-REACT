import React from 'react';
import { Text, TextInput, TouchableOpacity, View } from '../../tw';
import Icon from '../ui/Icon';
import { formatCurrency } from '@/src/shared';
import type { IconName } from '../ui/Icon';

// Marca la orden como YA PAGADA en el mismo acto de crearla, sin tener que
// buscarla después en Facturación para cobrarla. Útil en mostrador y para
// llevar, donde el cliente paga antes de que salga el pedido.
//
// Los métodos son los mismos del resto del POS:
//   'efectivo' | 'transferencia' (UI: "QR/Trans") | 'efectivo_transferencia' (UI: "Mixto")

export type PrepayMetodo = 'efectivo' | 'transferencia' | 'efectivo_transferencia';

export interface PrepayState {
  metodo: PrepayMetodo | null; // null = queda pendiente de cobro
  efectivo: string;
  transferencia: string;
}

export const emptyPrepay: PrepayState = { metodo: null, efectivo: '', transferencia: '' };

const OPCIONES: { key: PrepayMetodo | null; label: string; icon: IconName }[] = [
  { key: null, label: 'Pendiente', icon: 'clock-outline' },
  { key: 'efectivo', label: 'Efectivo', icon: 'cash' },
  { key: 'transferencia', label: 'QR/Trans', icon: 'qrcode' },
  { key: 'efectivo_transferencia', label: 'Mixto', icon: 'cash-multiple' },
];

interface Props {
  value: PrepayState;
  onChange: (next: PrepayState) => void;
  total: number;
}

export default function PrepayPicker({ value, onChange, total }: Props) {
  const isMixto = value.metodo === 'efectivo_transferencia';
  const efectivoNum = Number(value.efectivo) || 0;
  const transferNum = Number(value.transferencia) || 0;
  const sumaMixto = efectivoNum + transferNum;
  const descuadre = isMixto && sumaMixto !== total;

  const setMetodo = (metodo: PrepayMetodo | null) => {
    if (metodo === 'efectivo_transferencia') {
      // Precarga todo en efectivo: el cajero suele ajustar solo una parte.
      onChange({ metodo, efectivo: String(total), transferencia: '0' });
      return;
    }
    onChange({ metodo, efectivo: '', transferencia: '' });
  };

  return (
    <View className="mt-4">
      <Text className="text-[10px] font-black text-slate-400 ml-1 mb-2 uppercase tracking-wider">
        ¿Ya está pagada?
      </Text>

      <View className="flex-row flex-wrap gap-1.5">
        {OPCIONES.map((op) => {
          const active = value.metodo === op.key;
          return (
            <TouchableOpacity
              key={op.label}
              onPress={() => setMetodo(op.key)}
              className={`flex-row items-center gap-1.5 px-2.5 py-2 rounded-xl border ${
                active ? 'bg-emerald-500/15 border-emerald-500/45' : 'bg-black/20 border-white/5'
              }`}
            >
              <Icon name={op.icon} size={13} color={active ? '#34D399' : '#64748B'} />
              <Text
                className={`text-[11px] font-black ${active ? 'text-emerald-400' : 'text-slate-400'}`}
              >
                {op.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {isMixto && (
        <View className="mt-2.5 bg-black/20 rounded-xl border border-white/5 p-3">
          <View className="flex-row gap-2">
            <View className="flex-1">
              <Text className="text-[9px] font-black text-slate-500 mb-1 uppercase tracking-wider">
                Efectivo
              </Text>
              <TextInput
                className="bg-black/30 rounded-lg border border-white/5 px-2.5 py-2 text-sm text-white"
                value={value.efectivo}
                onChangeText={(v: string) =>
                  onChange({ ...value, efectivo: v.replace(/\D/g, '') })
                }
                keyboardType="numeric"
                placeholder="0"
                placeholderTextColor="#475569"
              />
            </View>
            <View className="flex-1">
              <Text className="text-[9px] font-black text-slate-500 mb-1 uppercase tracking-wider">
                QR / Transferencia
              </Text>
              <TextInput
                className="bg-black/30 rounded-lg border border-white/5 px-2.5 py-2 text-sm text-white"
                value={value.transferencia}
                onChangeText={(v: string) =>
                  onChange({ ...value, transferencia: v.replace(/\D/g, '') })
                }
                keyboardType="numeric"
                placeholder="0"
                placeholderTextColor="#475569"
              />
            </View>
          </View>

          <View className="flex-row justify-between items-center mt-2.5">
            <Text className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
              Suma
            </Text>
            <Text
              className={`text-[12px] font-black ${descuadre ? 'text-rose-400' : 'text-emerald-400'}`}
            >
              ${formatCurrency(sumaMixto)} / ${formatCurrency(total)}
            </Text>
          </View>
          {descuadre && (
            <Text className="text-rose-400 text-[10px] font-bold mt-1">
              El desglose debe sumar exactamente el total.
            </Text>
          )}
        </View>
      )}
    </View>
  );
}
