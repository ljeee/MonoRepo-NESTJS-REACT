import React, { useCallback, useEffect, useState } from 'react';
import { View } from 'react-native';
import { Text, TouchableOpacity } from '../../tw';
import Icon from './Icon';
import { useApi } from '@/src/shared';
import type { BebidaMovimiento } from '@/src/shared';

interface Props {
  /** Cambiar este número fuerza un refetch (p. ej. tras ajustar stock o pull-to-refresh) */
  refreshSignal?: number;
}

function fmtFecha(iso: string): string {
  try {
    return new Date(iso).toLocaleString('es-CO', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  } catch {
    return iso;
  }
}

export function BebidaMovimientosWidget({ refreshSignal }: Props) {
  const api = useApi();
  const [movs, setMovs] = useState<BebidaMovimiento[]>([]);
  const [loading, setLoading] = useState(false);

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
    <View style={{ paddingBottom: 60, marginTop: 8 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <Text style={{ color: 'rgba(255,255,255,0.3)', fontSize: 10, textTransform: 'uppercase', letterSpacing: 1.5 }}>
          Historial de movimientos
        </Text>
        <TouchableOpacity onPress={load} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Icon name="refresh" size={15} color="#64748B" />
        </TouchableOpacity>
      </View>

      {movs.map((m) => {
        const isEntrada = m.tipo === 'entrada';
        const faltante = Math.abs(m.delta) - Math.abs(m.aplicado); // unidades vendidas sin stock
        return (
          <View
            key={m.id}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 12,
              paddingVertical: 10,
              paddingHorizontal: 14,
              marginBottom: 6,
              backgroundColor: 'rgba(255,255,255,0.03)',
              borderRadius: 12,
              borderWidth: 1,
              borderColor: 'rgba(255,255,255,0.05)',
            }}
          >
            <View style={{
              width: 32,
              height: 32,
              borderRadius: 10,
              backgroundColor: isEntrada ? 'rgba(16,185,129,0.15)' : 'rgba(244,63,94,0.15)',
              alignItems: 'center',
              justifyContent: 'center',
            }}>
              <Icon name={isEntrada ? 'plus' : 'minus'} size={14} color={isEntrada ? '#10B981' : '#F43F5E'} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: '#F8FAFC', fontWeight: 'bold', fontSize: 12 }} numberOfLines={1}>
                {m.productoNombre ? `${m.productoNombre} · ` : ''}{m.varianteNombre}
              </Text>
              <Text style={{ color: isEntrada ? '#10B981' : '#F43F5E', fontWeight: '900', fontSize: 11 }} numberOfLines={1}>
                {isEntrada ? '+' : ''}{m.delta} → quedó en {m.cantidadResultante}
              </Text>
              {faltante > 0 && (
                <Text style={{ color: '#F59E0B', fontSize: 9, marginTop: 2 }} numberOfLines={1}>
                  ⚠ Vendido sin stock: {faltante} und.
                </Text>
              )}
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={{ color: 'rgba(255,255,255,0.25)', fontSize: 10 }}>{fmtFecha(m.creadoEn)}</Text>
              {!!m.nota && (
                <Text style={{ color: 'rgba(255,255,255,0.2)', fontSize: 9, textTransform: 'uppercase', marginTop: 2 }} numberOfLines={1}>
                  {m.nota}
                </Text>
              )}
            </View>
          </View>
        );
      })}
    </View>
  );
}
