import React, { useCallback, useEffect, useState } from 'react';
import { FlatList, RefreshControl, ActivityIndicator, Modal, Platform } from 'react-native';
import { Href, useRouter } from 'expo-router';
import { api } from '../../services/api';
import { useBreakpoint } from '../../styles/responsive';
import { EmptyState } from '../states/EmptyState';
import { ErrorState } from '../states/ErrorState';
import { ListSkeleton } from '../ui/SkeletonLoader';
import { PageContainer, PageHeader, Button, Card, Badge, Icon } from '../ui';
import { formatDate, useOrdenesSocket, useOfflineQueue, useAntiDebounce } from '@monorepo/shared';
import { getBaseUrl } from '../../services/api';
import { View, Text, TouchableOpacity, ScrollView } from '../../tw';
import { useAuth } from '../../contexts/AuthContext';
import type { Orden, OrdenProducto } from '@monorepo/shared';
import { printOrderReceipt } from '../../utils/printReceipt';
import OrderCardKDS from './OrderCardKDS';
import OrderCardPOS from './OrderCardPOS';

function getErrorStatusCode(error: unknown): number | undefined {
  const status = (error as any)?.response?.status;
  return typeof status === 'number' ? status : undefined;
}

function getProductFlavors(p: OrdenProducto): string[] {
  if (p.sabores && Array.isArray(p.sabores)) return p.sabores;
  const s = [];
  if (p.sabor1) s.push(p.sabor1);
  if (p.sabor2) s.push(p.sabor2);
  if (p.sabor3) s.push(p.sabor3);
  return s;
}

export default function OrdersOfDayPending() {
  const router = useRouter();
  const { isMobile, isTablet } = useBreakpoint();
  const [orders, setOrders] = useState<Orden[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [patchLoading, setPatchLoading] = useState<number | null>(null);
  const [filter, setFilter] = useState<'dia' | 'pendientes'>('dia');
  
  // ==================== STATES ====================
  const [isFullscreen, setIsFullscreen] = useState(false);
  
  // ==================== NOVEDADES ====================
  // Estructura: { ordenId: { adds: id[], removes: name[], modifies: { id: number, type: 'qty'|'flavor'|'both' }[], timestamp: number } }
  const [novedades, setNovedades] = useState<Record<number, { 
    adds: number[], 
    removes: string[], 
    modifies: Record<number, 'qty' | 'flavor' | 'both'>,
    timestamp: number 
  }>>({});
  const prevOrdersRef = React.useRef<Orden[]>([]);

  // Limpiar novedades antiguas cada minuto
  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      setNovedades(prev => {
        const next = { ...prev };
        let changed = false;
        Object.keys(next).forEach(id => {
          // Aumentar TTL a 15 minutos (900000 ms) para que el personal vea qué cambió
          if (now - next[Number(id)].timestamp > 900000) { 
            delete next[Number(id)];
            changed = true;
          }
        });
        return changed ? next : prev;
      });
    }, 60000);
    return () => clearInterval(interval);
  }, []);

  // Detectar cambios cuando orders se actualiza
  useEffect(() => {
    if (prevOrdersRef.current.length === 0) {
      prevOrdersRef.current = orders;
      return;
    }

    const newNovedades = { ...novedades };
    let hasNewNovedad = false;

    orders.forEach(currentOrder => {
      const prevOrder = prevOrdersRef.current.find(o => o.ordenId === currentOrder.ordenId);
      if (!prevOrder) return;

      const currentProds = currentOrder.productos || [];
      const prevProds = prevOrder.productos || [];

      const removes: string[] = [];
      const adds: number[] = [];
      const modifies: Record<number, 'qty' | 'flavor' | 'both'> = {};

      // 1. Detectar REMOVED o MODIFIED
      prevProds.forEach(pp => {
        const cp = currentProds.find(c => c.id === pp.id || (c.varianteId === pp.varianteId && c.producto === pp.producto));
        if (!cp) {
          removes.push(pp.producto);
        } else {
          // Es el mismo producto, ver si cambió algo
          const qtyChanged = cp.cantidad !== pp.cantidad;
          const currentFlavors = getProductFlavors(cp).sort().join(',');
          const prevFlavors = getProductFlavors(pp).sort().join(',');
          const flavorsChanged = currentFlavors !== prevFlavors;

          if (qtyChanged && flavorsChanged) modifies[cp.id!] = 'both';
          else if (qtyChanged) modifies[cp.id!] = 'qty';
          else if (flavorsChanged) modifies[cp.id!] = 'flavor';
        }
      });

      // 2. Detectar ADDED
      currentProds.forEach(cp => {
        const pp = prevProds.find(p => p.id === cp.id || (p.varianteId === cp.varianteId && p.producto === cp.producto));
        if (!pp) {
          adds.push(cp.id!);
        }
      });

      if (adds.length > 0 || removes.length > 0 || Object.keys(modifies).length > 0) {
        newNovedades[currentOrder.ordenId] = {
          adds,
          removes,
          modifies,
          timestamp: Date.now()
        };
        hasNewNovedad = true;
      }
    });

    if (hasNewNovedad) {
      setNovedades(newNovedades);
    }
    prevOrdersRef.current = orders;
  }, [orders]);

  const fetchOrders = useCallback(async (isRefresh = false) => {
    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    setError('');
    try {
      const data = await api.ordenes.getDay(filter === 'pendientes' ? 'pendiente' : undefined);
      setOrders(data);
      if (isRefresh) {
        setRefreshing(false);
      } else {
        setLoading(false);
      }
    } catch (error: unknown) {
      if (getErrorStatusCode(error) === 404) {
        setOrders([]);
      } else {
        setError('No pudimos cargar las órdenes. Por favor, intenta de nuevo.');
      }
      if (isRefresh) {
        setRefreshing(false);
      } else {
        setLoading(false);
      }
    }
  }, [filter]);

  useEffect(() => {
    const timer = setTimeout(() => {
      void fetchOrders();
    }, 0);

    return () => clearTimeout(timer);
  }, [fetchOrders]);

  const { user } = useAuth();
  const { isConnected } = useOrdenesSocket(getBaseUrl(), user?.roles?.[0] || 'cajero', () => fetchOrders(true));
  const { addPayment, hasItems, queue, isSyncing, syncPayments } = useOfflineQueue();
  const { debounce, isProcessing } = useAntiDebounce();

  const markAsCompleted = debounce(async (orden: Orden) => {
    setPatchLoading(orden.ordenId);
    try {
      await api.ordenes.update(orden.ordenId, { estadoOrden: 'completada' });
      await fetchOrders();
      setPatchLoading(null);
    } catch (err: any) {
      console.error('Error al completar:', err);
      setError('No se pudo completar la orden. Intente de nuevo.');
      setPatchLoading(null);
    }
  });


  const getClientName = useCallback((item: Orden) => {
    const nombre = item.factura?.clienteNombre || item.nombreCliente;
    if (!nombre) return 'Sin nombre';
    if (item.tipoPedido === 'mesa') {
      return /^\d+$/.test(nombre)
        ? `Mesa ${nombre}`
        : nombre.startsWith('Mesa')
          ? nombre
          : `Mesa ${nombre}`;
    }
    return nombre;
  }, []);

  const renderOrderItem = useCallback(({ item }: { item: Orden }) => {
    return (
      <View className="p-2 w-full">
        <OrderCardPOS
          item={item}
          clientName={getClientName(item)}
          novedad={novedades[item.ordenId]}
          patchLoading={patchLoading === item.ordenId}
          onPress={() => router.push(`/orden-detalle?ordenId=${item.ordenId}` as Href)}
          onEdit={() => router.push(`/editar-orden?ordenId=${item.ordenId}` as Href)}
          onPrint={Platform.OS === 'web' ? () => printOrderReceipt({
            ordenId: item.ordenId,
            clienteNombre: getClientName(item),
            tipoPedido: item.tipoPedido,
            observaciones: item.observaciones,
            direccion: item.domicilios?.[0]?.direccionEntrega,
            fecha: item.fechaOrden,
            productos: (item.productos || []).map((p) => ({
              nombre: p.producto,
              cantidad: p.cantidad ?? 1,
              sabores: getProductFlavors(p).filter(Boolean),
            })),
          }) : undefined}
          onComplete={() => markAsCompleted(item)}
        />
      </View>
    );
  }, [getClientName, markAsCompleted, patchLoading, router, novedades]);


  const numColumns = isMobile ? 1 : isTablet ? 2 : 3;

  return (
    <PageContainer scrollable={false} className="flex-1 bg-(--color-pos-bg)">
      <View className="px-5 pt-4">
        <PageHeader
          title={filter === 'pendientes' ? 'Pendientes' : 'Hoy'}
          icon="clipboard-text-outline"
          rightContent={(
             <View className="flex-row items-center gap-2">
                {!isMobile && Platform.OS === 'web' && (
                  <Button
                      title="Ampliar"
                      icon="fullscreen"
                      variant="outline"
                      size="sm"
                      onPress={() => setIsFullscreen(true)}
                  />
                )}
                <Button
                    title=""
                    icon="refresh"
                    variant="ghost"
                    size="sm"
                    onPress={() => fetchOrders(true)}
                    loading={refreshing}
                />
             </View>
          )}
        >
          <View className="flex-row items-center">
            {hasItems && (
              <TouchableOpacity
                onPress={() => syncPayments()}
                disabled={isSyncing}
                hitSlop={{ top: 12, bottom: 12, left: 8, right: 8 }}
                className="flex-row items-center bg-orange-500/20 px-3 py-2 rounded-full mr-3 border border-orange-500/30"
              >
                {isSyncing ? (
                  <ActivityIndicator size="small" color="#F5A524" className="mr-2" />
                ) : (
                  <View className="mr-2">
                    <Icon name="sync-alert" size={14} color="#F5A524" />
                  </View>
                )}
                <Text className="text-orange-400 text-[10px] font-black uppercase">
                  {queue.length} pendientes
                </Text>
              </TouchableOpacity>
            )}
            <View className={`w-3 h-3 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'} mr-2`} />
          </View>
        </PageHeader>
      </View>

      {/* Actions & Filters */}
      <View className="flex-row justify-between items-center px-4 mb-2 mt-1">
        <View className="flex-row bg-white/5 p-0.5 rounded-xl border border-white/5">
          {([
            { key: 'dia' as const, label: 'Todas', icon: 'calendar-today' as const },
            { key: 'pendientes' as const, label: 'Pendientes', icon: 'clock-outline' as const },
          ]).map((f) => {
            const isActive = filter === f.key;
            return (
              <TouchableOpacity
                key={f.key}
                onPress={() => setFilter(f.key)}
                className={`flex-row items-center px-3 py-1.5 rounded-lg ${isActive ? 'bg-(--color-pos-primary)' : ''}`}
              >
                <Icon
                  name={f.icon}
                  size={12}
                  color={isActive ? '#000' : '#64748B'}
                />
                <Text className={`ml-1.5 text-[11px] font-black uppercase ${isActive ? 'text-black' : 'text-slate-500'}`}>
                  {f.label}
                </Text>
              </TouchableOpacity>
            )
          })}
        </View>
      </View>

      {/* Content (Masonry Grid) */}
      <ScrollView 
        className="flex-1 px-2"
        contentContainerClassName="pb-20"
        refreshControl={
            <RefreshControl
                refreshing={refreshing}
                onRefresh={() => fetchOrders(true)}
                tintColor="#F5A524"
                colors={["#F5A524"]}
                progressBackgroundColor="#1E293B"
            />
        }
      >
        {loading ? (
          <View className="px-2"><ListSkeleton count={6} /></View>
        ) : error ? (
          <ErrorState message={error} onRetry={fetchOrders} />
        ) : orders.length === 0 ? (
            <EmptyState
                message="Sin órdenes hoy"
                subMessage={
                filter === 'pendientes'
                    ? 'No tienes órdenes pendientes.'
                    : 'Aún no se han registrado órdenes hoy.'
                }
                icon="clipboard-text-off-outline"
            />
        ) : (
            <View className="flex-row flex-wrap">
                {/* Column based rendering for Masonry */}
                {[...Array(numColumns)].map((_, colIndex) => (
                    <View key={`col-${colIndex}`} className={isMobile ? 'w-full' : isTablet ? 'w-1/2' : 'w-1/3'}>
                        {[...orders]
                            .sort((a, b) => new Date(a.fechaOrden).getTime() - new Date(b.fechaOrden).getTime())
                            .filter((_, idx) => idx % numColumns === colIndex)
                            .map((order) => (
                                <React.Fragment key={order.ordenId}>
                                    {renderOrderItem({ item: order })}
                                </React.Fragment>
                            ))}
                    </View>
                ))}
            </View>
        )}
      </ScrollView>

      {/* FULLSCREEN KDS OVERLAY */}
      {isFullscreen && (
        <Modal visible={isFullscreen} transparent animationType="fade">
        <View className="flex-1 bg-black p-4 sm:p-8 pt-8">
            <View className="flex-row justify-between items-center mb-6 pt-4 border-b border-white/10 pb-4">
                <View className="flex-row items-center gap-3">
                    <View className="w-10 h-10 rounded-xl bg-orange-500 items-center justify-center shrink-0">
                        <Icon name="clipboard-list" size={24} color="black" />
                    </View>
                    <View>
                        <Text className={`text-white font-black uppercase tracking-tighter ${isMobile ? 'text-xl' : 'text-3xl'}`} style={{ fontFamily: 'Space Grotesk' }}>Órdenes Activas</Text>
                        <Text className="text-slate-500 text-xs font-bold uppercase tracking-widest">Vista Expandida</Text>
                    </View>
                </View>

                <View className={`flex-row items-center ${isMobile ? 'gap-2' : 'gap-8'}`}>
                    {!isMobile && <HeaderClock />}
                    <TouchableOpacity
                        onPress={() => setIsFullscreen(false)}
                        className="w-12 h-12 rounded-2xl bg-white/5 items-center justify-center border border-white/10 active:bg-white/10"
                    >
                        <Icon name="fullscreen-exit" size={24} color="white" />
                    </TouchableOpacity>
                </View>
            </View>

            <ScrollView contentContainerClassName="pb-20">
                <View className="flex-row flex-wrap px-2">
                     {[...Array(4)].map((_, colIndex) => (
                         <View key={`fs-col-${colIndex}`} style={{ width: '25%', paddingHorizontal: 6 }}>
                             {orders
                                 .filter(o => o.estadoOrden === 'pendiente')
                                 .sort((a, b) => new Date(a.fechaOrden).getTime() - new Date(b.fechaOrden).getTime())
                                 .filter((_, idx) => idx % 4 === colIndex)
                                 .map((order) => (
                                     <View key={order.ordenId} style={{ marginBottom: 16 }}>
                                         <OrderCardKDS
                                             orden={order}
                                             onListo={() => markAsCompleted(order)}
                                             readOnly
                                         />
                                     </View>
                                 ))}
                         </View>
                     ))}
                     {orders.filter(o => o.estadoOrden === 'pendiente').length === 0 && (
                        <View className="flex-1 items-center justify-center pt-20">
                            <Icon name="check-circle" size={100} color="#1E293B" />
                            <Text className="text-slate-700 text-3xl font-black mt-6">TODO ENTREGADO</Text>
                        </View>
                     )}
                </View>
            </ScrollView>
        </View>
      </Modal>
      )}
    </PageContainer>
  );
}

// ── Isolated clock to avoid re-rendering the whole tree every second ──
function HeaderClock() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const iv = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(iv);
  }, []);
  return (
    <View className="items-end">
      <Text className="text-white text-2xl font-black" style={{ fontFamily: 'Space Grotesk' }}>
        {now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
      </Text>
      <Text className="text-orange-500 text-[10px] font-black uppercase tracking-widest">
        {now.toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long' })}
      </Text>
    </View>
  );
}
