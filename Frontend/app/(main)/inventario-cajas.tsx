import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, TouchableOpacity, Platform } from 'react-native';
import { View, Text, ScrollView } from '../../tw';
import { api } from '../../services/api';
import { PageContainer, PageHeader, Card, Icon, Button } from '../../components/ui';
import type { InventarioCajasEstado, InventarioCajasMovimiento } from '@monorepo/shared';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatDateShort(dateStr: string): string {
  return new Date(dateStr).toLocaleString('es-CO', {
    hour: '2-digit',
    minute: '2-digit',
    day: 'numeric',
    month: 'short',
  });
}

// ─── Quick adjust buttons config ─────────────────────────────────────────────

const QUICK_ADDS = [1, 5, 10, 25, 50];
const QUICK_REMOVES = [1, 2, 5, 10];

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function InventarioCajasScreen() {
  const [estado, setEstado] = useState<InventarioCajasEstado | null>(null);
  const [movimientos, setMovimientos] = useState<InventarioCajasMovimiento[]>([]);
  const [loading, setLoading] = useState(true);
  const [adjusting, setAdjusting] = useState(false);
  const [editingAlerta, setEditingAlerta] = useState(false);
  const [alertaInput, setAlertaInput] = useState('');
  const [error, setError] = useState('');
  const [notaInput, setNotaInput] = useState('');

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const [est, movs] = await Promise.all([
        (api as any).inventarioCajas.getEstado(),
        (api as any).inventarioCajas.getMovimientos(30),
      ]);
      setEstado(est);
      setMovimientos(Array.isArray(movs) ? movs : []);
      setError('');
    } catch {
      setError('No se pudo cargar el inventario.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleAjustar = useCallback(async (delta: number, tipo: 'entrada' | 'salida' | 'ajuste', nota?: string) => {
    if (adjusting) return;
    setAdjusting(true);
    try {
      const result = await (api as any).inventarioCajas.ajustar({ delta, tipo, nota: nota || undefined });
      setEstado(result);
      // Refresh movements
      const movs = await (api as any).inventarioCajas.getMovimientos(30);
      setMovimientos(Array.isArray(movs) ? movs : []);
    } catch {
      setError('Error al ajustar. Intenta de nuevo.');
    } finally {
      setAdjusting(false);
    }
  }, [adjusting]);

  const handleGuardarAlerta = useCallback(async () => {
    const val = parseInt(alertaInput, 10);
    if (isNaN(val) || val < 0) return;
    try {
      await (api as any).inventarioCajas.configurarAlerta(val);
      setEstado(prev => prev ? { ...prev, alertaMinimo: val, enAlerta: prev.cantidad <= val } : prev);
      setEditingAlerta(false);
      setAlertaInput('');
    } catch {
      setError('Error al guardar alerta.');
    }
  }, [alertaInput]);

  const cantidad = estado?.cantidad ?? 0;
  const alertaMinimo = estado?.alertaMinimo ?? null;
  const enAlerta = estado?.enAlerta ?? false;

  // Danger thresholds
  const pct = alertaMinimo && alertaMinimo > 0 ? Math.min(cantidad / (alertaMinimo * 3), 1) : Math.min(cantidad / 100, 1);
  const barColor = enAlerta ? '#F43F5E' : cantidad <= (alertaMinimo ?? 0) * 1.5 ? '#F5A524' : '#10B981';

  return (
    <PageContainer>
      <PageHeader
        title="Inventario de Cajas"
        subtitle="Pizza para llevar"
        icon="package-variant"
        rightContent={
          <Button
            title="Refrescar"
            icon="refresh"
            variant="ghost"
            size="sm"
            onPress={fetchData}
            loading={loading}
          />
        }
      />

      {error ? (
        <View className="flex-row items-center gap-3 bg-red-500/10 p-4 rounded-2xl mb-6 border border-red-500/20">
          <Icon name="alert-circle-outline" size={18} color="#F43F5E" />
          <Text className="text-red-400 flex-1 font-bold">{error}</Text>
        </View>
      ) : null}

      {loading && !estado ? (
        <View className="items-center justify-center py-20">
          <ActivityIndicator size="large" color="#F5A524" />
        </View>
      ) : (
        <>
          {/* ── Main Counter Card ── */}
          <Card style={{
            marginBottom: 16,
            overflow: 'hidden',
            backgroundColor: enAlerta ? 'rgba(244,63,94,0.08)' : 'rgba(15,23,42,0.8)',
            borderColor: enAlerta ? 'rgba(244,63,94,0.3)' : 'rgba(255,255,255,0.07)',
          }}>
            {/* Status bar */}
            {enAlerta && (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 16, backgroundColor: 'rgba(244,63,94,0.15)', padding: 10, borderRadius: 12 }}>
                <Icon name="alert" size={18} color="#F43F5E" />
                <Text style={{ color: '#F43F5E', fontWeight: 'bold', fontSize: 12, textTransform: 'uppercase', letterSpacing: 1 }}>
                  ¡STOCK BAJO! Quedan pocas cajas
                </Text>
              </View>
            )}

            {/* Big counter */}
            <View style={{ alignItems: 'center', paddingVertical: 16 }}>
              <Text style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11, textTransform: 'uppercase', letterSpacing: 2, marginBottom: 4 }}>
                Cajas disponibles
              </Text>
              <Text style={{
                color: enAlerta ? '#F43F5E' : '#F8FAFC',
                fontSize: 96,
                fontWeight: '900',
                lineHeight: 100,
                fontFamily: 'SpaceGrotesk-Bold',
              }}>
                {cantidad}
              </Text>
              {alertaMinimo !== null && (
                <Text style={{ color: enAlerta ? 'rgba(244,63,94,0.6)' : 'rgba(255,255,255,0.3)', fontSize: 11, textTransform: 'uppercase', marginTop: 4 }}>
                  Alerta en ≤ {alertaMinimo} cajas
                </Text>
              )}
            </View>

            {/* Progress bar */}
            <View style={{ height: 6, backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 6, marginBottom: 8, overflow: 'hidden' }}>
              <View style={{
                height: 6,
                width: `${Math.max(pct * 100, 2)}%` as any,
                backgroundColor: barColor,
                borderRadius: 6,
              }} />
            </View>
          </Card>

          {/* ── Quick REMOVE Buttons ── */}
          <View style={{ marginBottom: 12 }}>
            <Text style={{ color: 'rgba(255,255,255,0.3)', fontSize: 10, textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 8 }}>
              Restar cajas usadas
            </Text>
            <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
              {QUICK_REMOVES.map((n) => (
                <TouchableOpacity
                  key={`rm-${n}`}
                  onPress={() => handleAjustar(-n, 'salida')}
                  disabled={adjusting || cantidad < n}
                  style={{
                    flex: 1,
                    minWidth: 64,
                    paddingVertical: 14,
                    backgroundColor: adjusting || cantidad < n ? 'rgba(244,63,94,0.05)' : 'rgba(244,63,94,0.12)',
                    borderRadius: 14,
                    borderWidth: 1,
                    borderColor: adjusting || cantidad < n ? 'rgba(244,63,94,0.1)' : 'rgba(244,63,94,0.3)',
                    alignItems: 'center',
                    opacity: adjusting || cantidad < n ? 0.4 : 1,
                  }}
                >
                  <Text style={{ color: '#F43F5E', fontSize: 11, fontWeight: '900', textTransform: 'uppercase' }}>
                    -{n}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* ── Quick ADD Buttons ── */}
          <View style={{ marginBottom: 20 }}>
            <Text style={{ color: 'rgba(255,255,255,0.3)', fontSize: 10, textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 8 }}>
              Agregar cajas al stock
            </Text>
            <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
              {QUICK_ADDS.map((n) => (
                <TouchableOpacity
                  key={`add-${n}`}
                  onPress={() => handleAjustar(n, 'entrada')}
                  disabled={adjusting}
                  style={{
                    flex: 1,
                    minWidth: 64,
                    paddingVertical: 14,
                    backgroundColor: adjusting ? 'rgba(16,185,129,0.05)' : 'rgba(16,185,129,0.12)',
                    borderRadius: 14,
                    borderWidth: 1,
                    borderColor: adjusting ? 'rgba(16,185,129,0.1)' : 'rgba(16,185,129,0.3)',
                    alignItems: 'center',
                    opacity: adjusting ? 0.4 : 1,
                  }}
                >
                  <Text style={{ color: '#10B981', fontSize: 11, fontWeight: '900', textTransform: 'uppercase' }}>
                    +{n}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* ── Alert Config ── */}
          <Card style={{ marginBottom: 20, backgroundColor: 'rgba(245,165,36,0.05)', borderColor: 'rgba(245,165,36,0.15)' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <Icon name="bell-outline" size={18} color="#F5A524" />
                <View>
                  <Text style={{ color: '#F5A524', fontWeight: '900', fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.5 }}>Umbral de Alerta</Text>
                  <Text style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11, marginTop: 2 }}>
                    {alertaMinimo !== null ? `Alerta cuando queden ≤ ${alertaMinimo} cajas` : 'Sin alerta configurada'}
                  </Text>
                </View>
              </View>
              <TouchableOpacity
                onPress={() => { setEditingAlerta(!editingAlerta); setAlertaInput(alertaMinimo?.toString() ?? ''); }}
                style={{ backgroundColor: 'rgba(245,165,36,0.15)', padding: 8, borderRadius: 10, borderWidth: 1, borderColor: 'rgba(245,165,36,0.2)' }}
              >
                <Icon name="pencil" size={14} color="#F5A524" />
              </TouchableOpacity>
            </View>

            {editingAlerta && Platform.OS === 'web' && (
              <View style={{ marginTop: 12, flexDirection: 'row', gap: 8, alignItems: 'center' }}>
                <input
                  type="number"
                  value={alertaInput}
                  onChange={(e: any) => setAlertaInput(e.target.value)}
                  placeholder="Ej: 10"
                  style={{
                    flex: 1,
                    backgroundColor: 'rgba(255,255,255,0.05)',
                    border: '1px solid rgba(245,165,36,0.3)',
                    borderRadius: 10,
                    padding: '8px 12px',
                    color: '#fff',
                    fontSize: 14,
                    outline: 'none',
                  }}
                  min={0}
                />
                <TouchableOpacity
                  onPress={handleGuardarAlerta}
                  style={{ backgroundColor: 'rgba(245,165,36,0.2)', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 10, borderWidth: 1, borderColor: 'rgba(245,165,36,0.3)' }}
                >
                  <Text style={{ color: '#F5A524', fontWeight: '900', fontSize: 12 }}>Guardar</Text>
                </TouchableOpacity>
              </View>
            )}
          </Card>

          {/* ── Movement History ── */}
          {movimientos.length > 0 && (
            <View>
              <Text style={{ color: 'rgba(255,255,255,0.3)', fontSize: 10, textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 10 }}>
                Historial de movimientos
              </Text>
              {movimientos.map((mov) => {
                const isEntrada = mov.delta > 0;
                return (
                  <View
                    key={mov.id}
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
                      <Text style={{ color: isEntrada ? '#10B981' : '#F43F5E', fontWeight: '900', fontSize: 13 }}>
                        {isEntrada ? '+' : ''}{mov.delta} cajas → {mov.cantidadResultante} total
                      </Text>
                      {mov.nota && (
                        <Text style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11, marginTop: 2, fontStyle: 'italic' }}>{mov.nota}</Text>
                      )}
                    </View>
                    <View style={{ alignItems: 'flex-end' }}>
                      <Text style={{ color: 'rgba(255,255,255,0.25)', fontSize: 10 }}>{formatDateShort(mov.creadoEn)}</Text>
                      <Text style={{ color: 'rgba(255,255,255,0.2)', fontSize: 9, textTransform: 'uppercase', marginTop: 2 }}>{mov.tipo}</Text>
                    </View>
                  </View>
                );
              })}
            </View>
          )}
        </>
      )}
    </PageContainer>
  );
}
