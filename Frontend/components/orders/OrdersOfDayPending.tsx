import React, { useCallback, useEffect, useState } from 'react';
import { FlatList, RefreshControl, ActivityIndicator } from 'react-native';
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

function getErrorStatusCode(error: unknown): number | undefined {
  if (
    error &&
    typeof error === 'object' &&
    'response' in error &&
    (error as { response?: unknown }).response &&
    typeof (error as { response?: unknown }).response === 'object' &&
    'status' in ((error as { response?: { status?: unknown } }).response as { status?: unknown })
  ) {
    const status = ((error as { response?: { status?: unknown } }).response as { status?: unknown }).status;
    return typeof status === 'number' ? status : undefined;
  }
  return undefined;
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
  const [currentTime, setCurrentTime] = useState(new Date());

  // Clock for fullscreen mode
  useEffect(() => {
    if (!isFullscreen) return;
    const interval = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(interval);
  }, [isFullscreen]);
  
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
    const url_estado = filter === 'pendientes' ? 'pendiente' : undefined;
    try {
      const data = await api.ordenes.getDay(url_estado);
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

  const renderOrderItem = useCallback(({ item, fullscreen = false }: { item: Orden, fullscreen?: boolean }) => {
    // If not in fullscreen, the Masonry parent already applies the correct column width (w-1/3, w-1/2, w-full).
    // If in fullscreen, we apply responsive widths directly because we use a normal flex-row.
    const itemWidthClass = fullscreen 
      ? 'w-full sm:w-1/2 md:w-1/3 lg:w-1/4 xl:w-1/5' 
      : 'w-full';

    return (
      <View className={`p-2 ${itemWidthClass}`}>
        <Card
          onPress={() =>
            router.push(`/orden-detalle?ordenId=${item.ordenId}` as Href)
          }
          className={`bg-(--color-pos-surface) border border-white/5 rounded-xl overflow-hidden shadow-2xl ${fullscreen ? 'p-5' : 'p-3'}`}
        >
          <View className="flex-row justify-between items-start mb-3">
            <View className="flex-row items-center flex-1 mr-2">
              <View className={`${fullscreen ? 'w-10 h-10' : 'w-7 h-7'} rounded-full bg-(--color-pos-primary)/10 items-center justify-center mr-3`}>
                <Icon
                  name={
                    item.tipoPedido === 'domicilio'
                      ? 'truck-delivery-outline'
                      : item.tipoPedido === 'llevar'
                        ? 'shopping-outline'
                        : 'table-furniture'
                  }
                  size={fullscreen ? 20 : 14}
                  color="#F5A524"
                />
              </View>
              <Text className={`text-white font-black ${fullscreen ? 'text-lg' : 'text-sm'}`} numberOfLines={1}>
                {getClientName(item)}
              </Text>
            </View>
            <View className="flex-row items-center gap-2">
              <TouchableOpacity
                onPress={(e) => {
                  e.stopPropagation();
                  router.push(`/editar-orden?ordenId=${item.ordenId}` as Href);
                }}
                className={`w-8 h-8 rounded-xl bg-orange-500/10 items-center justify-center border border-orange-500/20`}
              >
                <Icon name="pencil" size={14} color="#F5A524" />
              </TouchableOpacity>
              <Badge
                label={item.estadoOrden}
                variant={
                  item.estadoOrden === 'pendiente'
                    ? 'warning'
                    : item.estadoOrden === 'completada' || item.estadoOrden === 'entregado'
                      ? 'success'
                      : item.estadoOrden === 'cancelado'
                        ? 'danger'
                        : 'info'
                }
              />
            </View>
          </View>

          <View className={`flex-row justify-between items-center opacity-60 ${fullscreen ? 'mb-4' : 'mb-2'}`}>
            <Text className={`text-slate-400 font-black uppercase tracking-widest ${fullscreen ? 'text-[12px]' : 'text-[10px]'}`}>{item.tipoPedido}</Text>
            <Text className={`text-slate-400 font-bold ${fullscreen ? 'text-[12px]' : 'text-[10px]'}`}>{formatDate(item.fechaOrden)}</Text>
          </View>

          {item.tipoPedido === 'domicilio' && item.domicilios?.[0]?.direccionEntrega && (
            <View className={`flex-row items-center bg-black/20 rounded-lg ${fullscreen ? 'px-3 py-2 mb-2' : 'px-2 py-1.5 mb-1.5'}`}>
              <Icon name="map-marker-outline" size={fullscreen ? 16 : 12} color="#94A3B8" />
              <Text className={`text-slate-300 ml-2 flex-1 ${fullscreen ? 'text-sm font-bold' : 'text-xs'}`} numberOfLines={fullscreen ? 2 : 1}>{item.domicilios[0].direccionEntrega}</Text>
            </View>
          )}

          {item.observaciones && (
            <View className={`flex-row items-start bg-amber-500/10 rounded-lg border border-amber-500/30 ${fullscreen ? 'px-3 py-2.5 mb-2' : 'px-2 py-1.5 mb-1.5'}`}>
              <Icon name="note-text-outline" size={fullscreen ? 16 : 12} color="#F5A524" />
              <Text className={`text-amber-100 ml-2 flex-1 font-black italic ${fullscreen ? 'text-sm font-bold' : 'text-[11px]'}`} numberOfLines={fullscreen ? 4 : 2}>{item.observaciones}</Text>
            </View>
          )}

          {item.productos && item.productos.length > 0 && (
            <View className={`${fullscreen ? 'mb-4' : 'mb-2'}`}>
              {item.productos.slice(0, fullscreen ? 10 : 5).map((prod) => {
                const novelty = novedades[item.ordenId];
                const isNew = novelty?.adds?.includes(prod.id!);
                const modType = novelty?.modifies?.[prod.id!];
                
                const dotColor = isNew ? 'bg-green-400' : modType ? 'bg-amber-400' : 'bg-(--color-pos-primary)';
                const textColor = isNew ? 'text-green-400 font-bold' : modType ? 'text-amber-400 font-bold' : 'text-slate-300';

                return (
                  <View key={prod.id} className={`flex-row items-center ${fullscreen ? 'mb-1.5' : 'mb-0.5'}`}>
                    <View className={`w-1.5 h-1.5 rounded-full ${dotColor} ${fullscreen ? 'mr-3' : 'mr-1.5'}`} />
                    <Text className={`flex-1 ${fullscreen ? 'text-sm' : 'text-xs'} ${textColor}`} numberOfLines={1}>
                      {prod.producto}
                    </Text>
                    {isNew && (
                      <View className="bg-green-500/20 px-1.5 py-0.5 rounded mr-1.5 border border-green-500/30">
                        <Text className="text-green-400 text-[8px] font-black uppercase">Nuevo</Text>
                      </View>
                    )}
                    {modType && (
                      <View className="bg-amber-500/20 px-1.5 py-0.5 rounded mr-1.5 border border-amber-500/30">
                        <Text className="text-amber-400 text-[8px] font-black uppercase">
                          {modType === 'flavor' ? 'Sabor changed' : modType === 'qty' ? 'Canti changed' : 'Editado'}
                        </Text>
                      </View>
                    )}
                    <Text className={`text-white font-black ${fullscreen ? 'text-sm' : 'text-xs'} ${modType === 'qty' ? 'text-amber-400' : ''}`}>x{prod.cantidad}</Text>
                  </View>
                );
              })}
              
              {novedades[item.ordenId]?.removes?.map((remName, idx) => (
                <View key={`rem-${idx}`} className="flex-row items-center mb-0.5">
                  <View className="w-1.5 h-1.5 rounded-full bg-red-500 mr-1.5" />
                  <Text className="text-red-400 font-bold text-xs flex-1 line-through" numberOfLines={1}>{remName}</Text>
                  <View className="bg-red-500 px-2 py-0.5 rounded border border-red-500">
                    <Text className="text-black text-[9px] font-black uppercase">Eliminado</Text>
                  </View>
                </View>
              ))}

              {item.productos.length > 5 && (
                <Text className="text-slate-500 text-[10px] italic">+ {item.productos.length - 5} más...</Text>
              )}
            </View>
          )}

          <View className="flex-row justify-end items-center border-t border-white/5 pt-2">
            {!fullscreen && item.estadoOrden !== 'completada' && item.estadoOrden !== 'cancelado' && (
              <TouchableOpacity
                className={`w-10 h-10 rounded-full bg-(--color-pos-success) items-center justify-center ${patchLoading === item.ordenId ? 'opacity-50' : ''}`}
                onPress={() => markAsCompleted(item)}
                disabled={patchLoading === item.ordenId}
              >
                {patchLoading === item.ordenId ? (
                  <ActivityIndicator size="small" color="white" />
                ) : (
                  <Icon name="check" size={20} color="white" />
                )}
              </TouchableOpacity>
            )}
          </View>
        </Card>
      </View>
    );
  }, [getClientName, isMobile, isTablet, markAsCompleted, patchLoading, router, novedades]);

  const numColumns = isMobile ? 1 : isTablet ? 2 : 3;

  return (
    <PageContainer scrollable={false} className="flex-1 bg-(--color-pos-bg)">
      <View className="px-5 pt-4">
        <PageHeader
          title={filter === 'pendientes' ? 'Pendientes' : 'Hoy'}
          icon="clipboard-text-outline"
          rightContent={(
             <View className="flex-row items-center gap-2">
                {!isMobile && typeof window !== 'undefined' && (
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
                className="flex-row items-center bg-orange-500/20 px-3 py-1.5 rounded-full mr-3 border border-orange-500/30"
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
            <View className={`w-3 h-3 rounded-full will-change-variable ${isConnected ? 'bg-green-500' : 'bg-red-500'} mr-2`} />
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
                        {orders
                            .filter((_, idx) => idx % numColumns === colIndex)
                            .map((order) => (
                                <React.Fragment key={order.ordenId}>
                                    {renderOrderItem({ item: order, fullscreen: false })}
                                </React.Fragment>
                            ))}
                    </View>
                ))}
            </View>
        )}
      </ScrollView>

      {/* FULLSCREEN KDS OVERLAY */}
      {isFullscreen && (
        <View className="fixed inset-0 bg-black z-[99999] p-4 sm:p-8">
            <View className="flex-row justify-between items-center mb-6 pt-4 border-b border-white/10 pb-4">
                <View className="flex-row items-center gap-4">
                    <View className="w-10 h-10 rounded-xl bg-orange-500 items-center justify-center">
                        <Icon name="clipboard-list" size={24} color="black" />
                    </View>
                    <View>
                        <Text className="text-white text-3xl font-black uppercase tracking-tighter" style={{ fontFamily: 'Space Grotesk' }}>Órdenes Activas</Text>
                        <Text className="text-slate-500 text-xs font-bold uppercase tracking-widest">Vista Expandida</Text>
                    </View>
                </View>
                
                <View className="flex-row items-center gap-8">
                    <View className="items-end">
                        <Text className="text-white text-3xl font-black" style={{ fontFamily: 'Space Grotesk' }}>
                             {currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </Text>
                        <Text className="text-orange-500 text-[10px] font-black uppercase tracking-widest">
                            {currentTime.toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long' })}
                        </Text>
                    </View>
                    <TouchableOpacity 
                        onPress={() => setIsFullscreen(false)}
                        className="w-12 h-12 rounded-2xl bg-white/5 items-center justify-center border border-white/10 active:bg-white/10"
                    >
                        <Icon name="fullscreen-exit" size={24} color="white" />
                    </TouchableOpacity>
                </View>
            </View>

            <ScrollView contentContainerClassName="pb-20">
                <View className="flex-row flex-wrap">
                     {orders
                        .filter(o => o.estadoOrden === 'pendiente')
                        .map((order) => (
                            <React.Fragment key={order.ordenId}>
                                {renderOrderItem({ item: order, fullscreen: true })}
                            </React.Fragment>
                        ))
                     }
                     {orders.filter(o => o.estadoOrden === 'pendiente').length === 0 && (
                        <View className="flex-1 items-center justify-center pt-20">
                            <Icon name="check-circle" size={100} color="#1E293B" />
                            <Text className="text-slate-700 text-3xl font-black mt-6">TODO ENTREGADO</Text>
                        </View>
                     )}
                </View>
            </ScrollView>
        </View>
      )}
    </PageContainer>
  );
}
