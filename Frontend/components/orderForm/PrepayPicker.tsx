import React from 'react';
import { Text, TextInput, TouchableOpacity, View } from '../../tw';
import Icon from '../ui/Icon';
import { formatCurrency, useApi } from '@/src/shared';
import type { IconName } from '../ui/Icon';
import type { CuentaTransferencia } from '@/src/shared';

export type PrepayMetodo = 'efectivo' | 'transferencia' | 'efectivo_transferencia';

export interface PrepayState {
  metodo: PrepayMetodo | null; // null = queda pendiente de cobro
  efectivo: string;
  transferencia: string;
  cuentaTransferenciaId?: number;
  cuentaTransferenciaNombre?: string;
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
  const api = useApi();
  const [cuentas, setCuentas] = React.useState<CuentaTransferencia[]>([]);

  React.useEffect(() => {
    let unmounted = false;
    api.empresa.cuentasTransferencia.getAll()
      .then(res => {
        if (unmounted) return;
        const activas = (res || []).filter(c => c.activa);
        setCuentas(activas);
      })
      .catch(() => {});
    return () => { unmounted = true; };
  }, [api]);

  const isMixto = value.metodo === 'efectivo_transferencia';
  const isTransfer = value.metodo === 'transferencia' || isMixto;
  const efectivoNum = Number(value.efectivo) || 0;
  const transferNum = Number(value.transferencia) || 0;
  const sumaMixto = efectivoNum + transferNum;
  const descuadre = isMixto && sumaMixto !== total;

  const setMetodo = (metodo: PrepayMetodo | null) => {
    const defaultCuenta = cuentas.length > 0 ? cuentas[0] : undefined;
    if (metodo === 'efectivo_transferencia') {
      onChange({
        metodo,
        efectivo: String(total),
        transferencia: '0',
        cuentaTransferenciaId: defaultCuenta?.id,
        cuentaTransferenciaNombre: defaultCuenta?.nombre,
      });
      return;
    }
    onChange({
      metodo,
      efectivo: '',
      transferencia: '',
      cuentaTransferenciaId: metodo === 'transferencia' ? defaultCuenta?.id : undefined,
      cuentaTransferenciaNombre: metodo === 'transferencia' ? defaultCuenta?.nombre : undefined,
    });
  };

  const setCuenta = (cuenta: CuentaTransferencia) => {
    onChange({
      ...value,
      cuentaTransferenciaId: cuenta.id,
      cuentaTransferenciaNombre: cuenta.nombre,
    });
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

      {isTransfer && cuentas.length > 0 && (
        <View className="mt-2.5 bg-black/20 rounded-xl border border-white/5 p-2.5">
          <Text className="text-[9px] font-black text-slate-400 mb-1.5 uppercase tracking-wider">
            ¿Cuenta destino?
          </Text>
          <View className="flex-row flex-wrap gap-1.5">
            {cuentas.map((c) => {
              const active = value.cuentaTransferenciaId === c.id;
              return (
                <TouchableOpacity
                  key={c.id}
                  onPress={() => setCuenta(c)}
                  className={`flex-row items-center gap-1 px-2 py-1 rounded-lg border ${
                    active ? 'bg-purple-500/20 border-purple-500/50' : 'bg-black/20 border-white/5'
                  }`}
                >
                  <Icon name="bank" size={11} color={active ? '#C084FC' : '#64748B'} />
                  <Text className={`text-[10px] font-bold ${active ? 'text-purple-300' : 'text-slate-400'}`}>
                    {c.nombre}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      )}

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
