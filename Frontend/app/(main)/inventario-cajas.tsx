import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, TouchableOpacity, Platform, Modal } from 'react-native';
import { View, Text, ScrollView, TextInput } from '../../tw';
import { api } from '../../services/api';
import { PageContainer, PageHeader, Card, Icon, Button, ConfirmModal } from '../../components/ui';
import type { InventarioCaja, InventarioCajasMovimiento } from '@monorepo/shared';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatDateShort(dateStr: string): string {
  return new Date(dateStr).toLocaleString('es-CO', {
    hour: '2-digit',
    minute: '2-digit',
    day: 'numeric',
    month: 'short',
  });
}

const QUICK_ADDS = [5, 10, 50];
const QUICK_REMOVES = [1, 2, 5];

// ─── Box Card Component ───────────────────────────────────────────────────────

function InventarioCajaCard({
  caja,
  onAjustar,
  onConfigurarAlerta,
  onEliminar,
  adjustingId,
}: {
  caja: InventarioCaja;
  onAjustar: (id: number, delta: number, tipo: 'entrada'|'salida') => void;
  onConfigurarAlerta: (id: number, alerta: number) => void;
  onEliminar: (id: number) => void;
  adjustingId: number | null;
}) {
  const [editingAlerta, setEditingAlerta] = useState(false);
  const [alertaInput, setAlertaInput] = useState('');
  
  const pct = caja.alertaMinimo && caja.alertaMinimo > 0 ? Math.min(caja.cantidad / (caja.alertaMinimo * 3), 1) : Math.min(caja.cantidad / 200, 1);
  const barColor = caja.enAlerta ? '#F43F5E' : caja.cantidad <= (caja.alertaMinimo ?? 0) * 1.5 ? '#F5A524' : '#10B981';
  const isAdjusting = adjustingId === caja.id;

  const handleGuardarAlerta = () => {
    const val = parseInt(alertaInput, 10);
    if (!isNaN(val) && val >= 0) {
      onConfigurarAlerta(caja.id, val);
      setEditingAlerta(false);
      setAlertaInput('');
    }
  };

  return (
    <Card style={{
      overflow: 'hidden',
      backgroundColor: caja.enAlerta ? 'rgba(244,63,94,0.08)' : 'rgba(15,23,42,0.8)',
      borderColor: caja.enAlerta ? 'rgba(244,63,94,0.3)' : 'rgba(255,255,255,0.07)',
      padding: 0,
      position: 'relative'
    }}>
      <View style={{ padding: 16 }}>
        {/* Header */}
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <Text style={{ color: '#F8FAFC', fontSize: 18, fontFamily: 'SpaceGrotesk-Bold', textTransform: 'uppercase' }}>
            {caja.nombre}
          </Text>
          <TouchableOpacity onPress={() => onEliminar(caja.id)} style={{ padding: 4 }}>
            <Icon name="trash-can-outline" size={16} color="#64748B" />
          </TouchableOpacity>
        </View>

        {/* Counter */}
        <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 12, marginBottom: 12 }}>
          <Text style={{
            color: caja.enAlerta ? '#F43F5E' : '#10B981',
            fontSize: 48,
            fontWeight: '900',
            lineHeight: 52,
            fontFamily: 'SpaceGrotesk-Bold',
          }}>
            {caja.cantidad}
          </Text>
          <View style={{ paddingBottom: 6 }}>
            <Text style={{ color: 'rgba(255,255,255,0.4)', fontSize: 10, textTransform: 'uppercase' }}>Cajas disponibles</Text>
            {caja.enAlerta && (
               <Text style={{ color: '#F43F5E', fontSize: 10, fontWeight: 'bold' }}>¡STOCK BAJO!</Text>
            )}
          </View>
        </View>

        {/* Progress bar */}
        <View style={{ height: 4, backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 4, marginBottom: 16, overflow: 'hidden' }}>
          <View style={{
            height: 4,
            width: `${Math.max(pct * 100, 2)}%` as any,
            backgroundColor: barColor,
            borderRadius: 4,
          }} />
        </View>

        {/* Adjust Buttons */}
        <View style={{ flexDirection: 'row', gap: 10, marginBottom: 16 }}>
           <View style={{ flex: 1, gap: 6 }}>
              {QUICK_REMOVES.map((n) => (
                <TouchableOpacity
                  key={`rm-${n}`}
                  onPress={() => onAjustar(caja.id, -n, 'salida')}
                  disabled={isAdjusting || caja.cantidad < n}
                  style={{
                    paddingVertical: 8,
                    backgroundColor: isAdjusting || caja.cantidad < n ? 'rgba(244,63,94,0.05)' : 'rgba(244,63,94,0.12)',
                    borderRadius: 8,
                    borderWidth: 1,
                    borderColor: isAdjusting || caja.cantidad < n ? 'rgba(244,63,94,0.1)' : 'rgba(244,63,94,0.3)',
                    alignItems: 'center',
                    opacity: isAdjusting || caja.cantidad < n ? 0.4 : 1,
                  }}
                >
                  <Text style={{ color: '#F43F5E', fontSize: 12, fontWeight: '900' }}>-{n}</Text>
                </TouchableOpacity>
              ))}
           </View>
           <View style={{ flex: 1, gap: 6 }}>
              {QUICK_ADDS.map((n) => (
                <TouchableOpacity
                  key={`add-${n}`}
                  onPress={() => onAjustar(caja.id, n, 'entrada')}
                  disabled={isAdjusting}
                  style={{
                    paddingVertical: 8,
                    backgroundColor: isAdjusting ? 'rgba(16,185,129,0.05)' : 'rgba(16,185,129,0.12)',
                    borderRadius: 8,
                    borderWidth: 1,
                    borderColor: isAdjusting ? 'rgba(16,185,129,0.1)' : 'rgba(16,185,129,0.3)',
                    alignItems: 'center',
                    opacity: isAdjusting ? 0.4 : 1,
                  }}
                >
                  <Text style={{ color: '#10B981', fontSize: 12, fontWeight: '900' }}>+{n}</Text>
                </TouchableOpacity>
              ))}
           </View>
        </View>

        {/* Alert Config */}
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.05)', paddingTop: 12 }}>
          <View>
            <Text style={{ color: 'rgba(255,255,255,0.4)', fontSize: 10, textTransform: 'uppercase' }}>
              {caja.alertaMinimo !== null ? `Alerta en ≤ ${caja.alertaMinimo}` : 'Sin alerta'}
            </Text>
          </View>
          <TouchableOpacity onPress={() => { setEditingAlerta(!editingAlerta); setAlertaInput(caja.alertaMinimo?.toString() ?? ''); }}>
             <Icon name="pencil" size={14} color="#F5A524" />
          </TouchableOpacity>
        </View>
        
        {editingAlerta && (
          <View style={{ marginTop: 8, flexDirection: 'row', gap: 6 }}>
            <TextInput
              keyboardType="numeric"
              value={alertaInput}
              onChangeText={setAlertaInput}
              placeholder="Ej: 10"
              placeholderTextColor="rgba(255,255,255,0.2)"
              style={{
                flex: 1,
                backgroundColor: 'rgba(255,255,255,0.05)',
                borderWidth: 1,
                borderColor: 'rgba(245,165,36,0.3)',
                borderRadius: 6,
                paddingHorizontal: 8,
                paddingVertical: 6,
                color: '#fff',
                fontSize: 12,
              }}
            />
            <TouchableOpacity onPress={handleGuardarAlerta} style={{ backgroundColor: 'rgba(245,165,36,0.2)', paddingHorizontal: 12, borderRadius: 6, justifyContent: 'center' }}>
              <Text style={{ color: '#F5A524', fontWeight: 'bold', fontSize: 10 }}>OK</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </Card>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function InventarioCajasScreen() {
  const [cajas, setCajas] = useState<InventarioCaja[]>([]);
  const [movimientos, setMovimientos] = useState<InventarioCajasMovimiento[]>([]);
  const [loading, setLoading] = useState(true);
  const [adjustingId, setAdjustingId] = useState<number | null>(null);
  const [error, setError] = useState('');
  
  // Modal states
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newName, setNewName] = useState('');
  const [newInit, setNewInit] = useState('0');
  
  // Delete confirm
  const [deleteTarget, setDeleteTarget] = useState<InventarioCaja | null>(null);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const [est, movs] = await Promise.all([
        (api as any).inventarioCajas.getEstado(),
        (api as any).inventarioCajas.getMovimientos(30),
      ]);
      setCajas(Array.isArray(est) ? est : []);
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

  const handleAjustar = useCallback(async (cajaId: number, delta: number, tipo: 'entrada' | 'salida') => {
    if (adjustingId) return;
    setAdjustingId(cajaId);
    try {
      await (api as any).inventarioCajas.ajustar(cajaId, { delta, tipo });
      await fetchData();
    } catch {
      setError('Error al ajustar. Intenta de nuevo.');
    } finally {
      setAdjustingId(null);
    }
  }, [adjustingId, fetchData]);

  const handleConfigurarAlerta = useCallback(async (cajaId: number, alertaMinimo: number) => {
    try {
      await (api as any).inventarioCajas.configurarAlerta(cajaId, alertaMinimo);
      setCajas((prev: InventarioCaja[]) => prev.map((c: InventarioCaja) => c.id === cajaId ? { ...c, alertaMinimo, enAlerta: c.cantidad <= alertaMinimo } : c));
    } catch {
      setError('Error al guardar alerta.');
    }
  }, []);

  const handleCrear = async () => {
    if (!newName.trim()) return;
    try {
      await (api as any).inventarioCajas.crear({ nombre: newName.trim(), cantidad: parseInt(newInit) || 0 });
      setShowCreateModal(false);
      setNewName('');
      setNewInit('0');
      fetchData();
    } catch {
      setError('Error al crear tipo de caja.');
    }
  };

  const handleEliminar = async () => {
    if (!deleteTarget) return;
    try {
      await (api as any).inventarioCajas.eliminar(deleteTarget.id);
      setDeleteTarget(null);
      fetchData();
    } catch {
      setError('Error al eliminar.');
      setDeleteTarget(null);
    }
  };

  return (
    <PageContainer>
      <PageHeader
        title="Inventario de Cajas"
        subtitle="Control de empaques múltiples"
        icon="package-variant"
        rightContent={
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <Button
              title="Añadir Caja"
              icon="plus"
              variant="primary"
              size="sm"
              onPress={() => setShowCreateModal(true)}
            />
            <Button
              title=""
              icon="refresh"
              variant="ghost"
              size="sm"
              onPress={fetchData}
              loading={loading}
            />
          </View>
        }
      />

      {error ? (
        <View className="flex-row items-center gap-3 bg-red-500/10 p-4 rounded-2xl mb-6 border border-red-500/20">
          <Icon name="alert-circle-outline" size={18} color="#F43F5E" />
          <Text className="text-red-400 flex-1 font-bold">{error}</Text>
        </View>
      ) : null}

      {loading && cajas.length === 0 ? (
        <View className="items-center justify-center py-20">
          <ActivityIndicator size="large" color="#F5A524" />
        </View>
      ) : cajas.length === 0 ? (
         <View className="items-center justify-center py-20 bg-white/5 rounded-[32px] border border-white/5 mb-8">
           <Icon name="package-variant-closed" size={64} color="#1E293B" />
           <Text className="text-white font-black text-xl mt-4">Sin cajas configuradas</Text>
           <Text className="text-slate-500 mt-2 text-sm max-w-xs text-center">Añade tu primer tipo de caja (ej: Caja Mediana) usando el botón de la parte superior.</Text>
         </View>
      ) : (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 16, marginBottom: 32 }}>
           {cajas.map((c: InventarioCaja) => (
              <View key={c.id} style={{ width: '100%', maxWidth: Platform.OS === 'web' ? 340 : undefined, flexGrow: 1 }}>
                 <InventarioCajaCard
                   caja={c}
                   onAjustar={handleAjustar}
                   onConfigurarAlerta={handleConfigurarAlerta}
                   onEliminar={(id) => setDeleteTarget(c)}
                   adjustingId={adjustingId}
                 />
              </View>
           ))}
        </View>
      )}

      {/* ── Movement History ── */}
      {movimientos.length > 0 && (
        <View style={{ paddingBottom: 60 }}>
          <Text style={{ color: 'rgba(255,255,255,0.3)', fontSize: 10, textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 10 }}>
            Historial de movimientos globales
          </Text>
          {movimientos.map((mov: InventarioCajasMovimiento) => {
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
                  <Text style={{ color: '#F8FAFC', fontWeight: 'bold', fontSize: 12 }}>{mov.cajaNombre}</Text>
                  <Text style={{ color: isEntrada ? '#10B981' : '#F43F5E', fontWeight: '900', fontSize: 11 }}>
                    {isEntrada ? '+' : ''}{mov.delta} → quedó en {mov.cantidadResultante}
                  </Text>
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

      {/* CREATE MODAL */}
      <Modal visible={showCreateModal} transparent animationType="fade">
         <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'center', alignItems: 'center', padding: 20 }}>
            <Card style={{ width: '100%', maxWidth: 400, backgroundColor: '#0F172A', borderColor: 'rgba(255,255,255,0.1)' }}>
               <Text style={{ color: 'white', fontSize: 18, fontFamily: 'SpaceGrotesk-Bold', marginBottom: 16 }}>Añadir Tipo de Caja</Text>
               
               <Text style={{ color: '#94A3B8', fontSize: 12, marginBottom: 4 }}>Nombre de la Caja (Ej: Pizza Grande)</Text>
               <TextInput
                 value={newName}
                 onChangeText={setNewName}
                 style={{ backgroundColor: 'rgba(255,255,255,0.05)', color: 'white', padding: 12, borderRadius: 10, marginBottom: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' }}
                 placeholder="Caja Mediana..."
                 placeholderTextColor="rgba(255,255,255,0.2)"
               />

               <Text style={{ color: '#94A3B8', fontSize: 12, marginBottom: 4 }}>Stock Inicial (Opcional)</Text>
               <TextInput
                 value={newInit}
                 onChangeText={setNewInit}
                 keyboardType="numeric"
                 style={{ backgroundColor: 'rgba(255,255,255,0.05)', color: 'white', padding: 12, borderRadius: 10, marginBottom: 20, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' }}
               />

               <View style={{ flexDirection: 'row', gap: 10 }}>
                 <Button title="Cancelar" variant="secondary" onPress={() => setShowCreateModal(false)} style={{ flex: 1 }} />
                 <Button title="Crear Caja" variant="primary" onPress={handleCrear} style={{ flex: 1 }} />
               </View>
            </Card>
         </View>
      </Modal>

      {/* DELETE MODAL */}
      <ConfirmModal
        visible={!!deleteTarget}
        title="¿Eliminar Caja?"
        message={`¿Estás seguro de que deseas eliminar permanentemente el inventario de "${deleteTarget?.nombre}"? Esta acción borrará el recuento y todos los movimientos asociados.`}
        icon="trash-can"
        variant="danger"
        confirmText="Eliminar permanentemente"
        onConfirm={handleEliminar}
        onCancel={() => setDeleteTarget(null)}
      />
    </PageContainer>
  );
}
