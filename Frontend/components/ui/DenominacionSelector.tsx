import React from 'react';
import { TextInput } from 'react-native';
import { View, Text, Pressable } from '../../tw';
import { DENOMINACIONES_COP, DenominacionesMap } from '@/src/shared';
import { formatCurrency } from '@/src/shared';

interface Props {
  value: DenominacionesMap;
  onChange: (map: DenominacionesMap) => void;
  disponible?: DenominacionesMap; // limita + al máximo disponible y muestra stock
  titulo?: string;
  monedas?: string;
  onMonedasChange?: (v: string) => void;
}

export function DenominacionSelector({ value, onChange, disponible, titulo, monedas, onMonedasChange }: Props) {
  const totalBilletes = Object.entries(value).reduce(
    (acc, [den, qty]) => acc + Number(den) * qty,
    0,
  );
  const totalMonedas = Number(monedas) || 0;
  const total = totalBilletes + totalMonedas;

  function set(den: number, qty: number) {
    const next = { ...value };
    const key = String(den);
    if (qty <= 0) {
      delete next[key];
    } else {
      next[key] = qty;
    }
    onChange(next);
  }

  function inc(den: number) {
    const key = String(den);
    const current = value[key] ?? 0;
    if (disponible) {
      const max = disponible[key] ?? 0;
      if (current >= max) return;
    }
    set(den, current + 1);
  }

  function dec(den: number) {
    const key = String(den);
    const current = value[key] ?? 0;
    if (current <= 0) return;
    set(den, current - 1);
  }

  return (
    <View className="gap-1.5">
      {titulo && (
        <Text className="text-xs font-bold text-(--color-pos-text-muted) mb-1 uppercase tracking-widest">{titulo}</Text>
      )}

      {DENOMINACIONES_COP.map(({ valor, label }) => {
        const key = String(valor);
        const qty = value[key] ?? 0;
        const maxDisp = disponible ? (disponible[key] ?? 0) : null;
        const atMax = maxDisp !== null && qty >= maxDisp;
        const subtotal = qty * valor;
        const hasStock = maxDisp !== null && maxDisp > 0;
        const noStock = maxDisp !== null && maxDisp === 0;

        return (
          <View
            key={valor}
            className={`flex-row items-center justify-between px-3 py-2.5 rounded-xl ${
              qty > 0 ? 'bg-emerald-500/8 border border-emerald-500/20' : 'bg-white/5'
            }`}
          >
            {/* Label + disponible */}
            <View className="flex-row items-center gap-2.5 flex-1">
              <View className="w-2 h-2 rounded-full bg-green-400" />
              <Text className={`text-sm font-bold w-20 ${noStock ? 'text-slate-600' : 'text-(--color-pos-text)'}`}>
                {label}
              </Text>
              {maxDisp !== null && (
                <View className={`px-2 py-0.5 rounded-md ${hasStock ? 'bg-emerald-500/15 border border-emerald-500/30' : 'bg-white/5'}`}>
                  <Text className={`text-[10px] font-black ${hasStock ? 'text-emerald-400' : 'text-slate-600'}`}>
                    {maxDisp} en caja
                  </Text>
                </View>
              )}
            </View>

            {/* Controles */}
            <View className="flex-row items-center gap-2">
              <Pressable
                onPress={() => dec(valor)}
                className={`w-8 h-8 rounded-lg items-center justify-center ${qty > 0 ? 'bg-white/10 active:bg-white/20' : 'bg-white/5 opacity-30'}`}
              >
                <Text className="text-base text-(--color-pos-text) leading-none">−</Text>
              </Pressable>

              <Text className={`text-sm font-bold w-6 text-center ${qty > 0 ? 'text-white' : 'text-slate-600'}`}>
                {qty}
              </Text>

              <Pressable
                onPress={() => inc(valor)}
                className={`w-8 h-8 rounded-lg items-center justify-center active:bg-white/20 ${atMax ? 'bg-white/5 opacity-30' : 'bg-emerald-500/10 border border-emerald-500/20'}`}
              >
                <Text className={`text-base leading-none ${atMax ? 'text-slate-600' : 'text-emerald-400'}`}>+</Text>
              </Pressable>

              <Text className={`text-xs w-20 text-right font-bold ${subtotal > 0 ? 'text-emerald-400' : 'text-slate-700'}`}>
                {subtotal > 0 ? formatCurrency(subtotal) : '—'}
              </Text>
            </View>
          </View>
        );
      })}

      {/* Monedas (monto libre) */}
      {onMonedasChange !== undefined && (
        <View className="flex-row items-center justify-between px-3 py-2.5 rounded-xl bg-white/5">
          <View className="flex-row items-center gap-2.5 flex-1">
            <View className="w-2 h-2 rounded-full bg-yellow-400" />
            <Text className="text-sm font-bold text-(--color-pos-text)">Monedas</Text>
          </View>
          <View className="flex-row items-center gap-2">
            <Text className="text-slate-400 text-sm">$</Text>
            <TextInput
              keyboardType="numeric"
              value={monedas ?? ''}
              onChangeText={(t) => onMonedasChange(t.replace(/[^0-9]/g, ''))}
              placeholder="0"
              placeholderTextColor="#475569"
              style={{ color: '#FFFFFF', minWidth: 80, textAlign: 'right', fontSize: 14, fontWeight: 'bold' }}
            />
          </View>
        </View>
      )}

      {/* Total */}
      <View className="flex-row justify-between items-center px-3 py-3 mt-0.5 rounded-xl bg-orange-500/10 border border-orange-500/20">
        <Text className="text-sm font-semibold text-orange-300">Total en efectivo</Text>
        <Text className="text-base font-bold text-orange-400">{formatCurrency(total)}</Text>
      </View>
    </View>
  );
}
