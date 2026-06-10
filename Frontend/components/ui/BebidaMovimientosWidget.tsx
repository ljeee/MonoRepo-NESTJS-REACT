import React, { useCallback, useEffect, useState } from 'react';
import { View, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Text } from '../../tw';
import Card from './Card';
import Icon from './Icon';
import { useApi } from '@/src/shared';
import type { BebidaMovimiento } from '@/src/shared';

interface Props {
  /** Cambiar este número fuerza un refetch (p. ej. tras ajustar stock o pull-to-refresh) */
  refreshSignal?: number;
}

function fmtFecha(iso: string): string {
  try {
    return new Date(iso).toLocaleString('es-CO', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
  } catch {
    return iso;
  }
}

export function BebidaMovimientosWidget({ refreshSignal }: Props) {
  const api = useApi();
  const [movs, setMovs] = useState<BebidaMovimiento[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    api.inventarioBebidas.getMovimientos(30)
      .then(setMovs)
      .catch(() => setMovs([]))
      .finally(() => setLoading(false));
  }, [api]);

  useEffect(() => { load(); }, [load, refreshSignal]);

  if (!loading && movs.length === 0) return null;

  return (
    <Card className="mt-4 mb-8 p-5">
      <View className="flex-row justify-between items-center">
        <View className="flex-row items-center gap-3">
          <Icon name="history" size={18} color="#F5A524" />
          <Text className="text-white font-black text-sm uppercase tracking-tight" style={{ fontFamily: 'Space Grotesk' }}>
            Historial de Bebidas
          </Text>
        </View>
        <TouchableOpacity onPress={load} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Icon name="refresh" size={16} color="#64748B" />
        </TouchableOpacity>
      </View>

      <TouchableOpacity
        className="mt-3 p-3 bg-white/5 border border-white/10 rounded-xl flex-row items-center justify-between active:bg-white/10"
        onPress={() => setOpen(v => !v)}
      >
        <View className="flex-row items-center gap-2">
          <Icon name="format-list-bulleted" size={15} color="#94A3B8" />
          <Text style={{ fontFamily: 'SpaceGrotesk-Bold', color: '#94A3B8', fontSize: 12, textTransform: 'uppercase' }}>
            {open ? 'Ocultar movimientos' : `Ver movimientos (${movs.length})`}
          </Text>
        </View>
        {loading ? <ActivityIndicator size="small" color="#64748B" /> : <Icon name={open ? 'chevron-up' : 'chevron-down'} size={18} color="#64748B" />}
      </TouchableOpacity>

      {open && (
        <View className="gap-2 mt-3">
          {movs.map((m) => {
            const isEntrada = m.tipo === 'entrada';
            const color = isEntrada ? '#10B981' : '#F43F5E';
            const faltante = Math.abs(m.delta) - Math.abs(m.aplicado); // unidades vendidas sin stock
            return (
              <View key={m.id} className="flex-row items-center justify-between p-3 bg-white/[0.02] border border-white/[0.05] rounded-xl">
                <View className="flex-row items-center gap-3 flex-1 mr-2">
                  <View className="w-8 h-8 rounded-full items-center justify-center" style={{ backgroundColor: `${color}15` }}>
                    <Icon name={isEntrada ? 'arrow-down-circle' : 'arrow-up-circle'} size={16} color={color} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontFamily: 'Outfit', color: '#E2E8F0', fontSize: 13, fontWeight: 'bold' }} numberOfLines={1}>
                      {m.productoNombre ? `${m.productoNombre} · ` : ''}{m.varianteNombre}
                    </Text>
                    <Text style={{ fontFamily: 'Outfit', color: '#94A3B8', fontSize: 10, marginTop: 2 }} numberOfLines={1}>
                      {m.nota ? `${m.nota} · ` : ''}{fmtFecha(m.creadoEn)}
                    </Text>
                    {faltante > 0 && (
                      <Text style={{ fontFamily: 'Outfit', color: '#F59E0B', fontSize: 9, marginTop: 2 }}>
                        ⚠ Vendido sin stock: {faltante} und.
                      </Text>
                    )}
                  </View>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={{ fontFamily: 'SpaceGrotesk-Bold', fontSize: 15, color }}>
                    {m.delta > 0 ? '+' : ''}{m.delta}
                  </Text>
                  <Text style={{ fontFamily: 'Outfit', color: '#475569', fontSize: 9 }}>
                    queda {m.cantidadResultante}
                  </Text>
                </View>
              </View>
            );
          })}
        </View>
      )}
    </Card>
  );
}
