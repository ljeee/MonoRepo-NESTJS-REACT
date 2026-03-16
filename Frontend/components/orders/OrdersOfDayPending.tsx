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
  const [novedades, setNovedades] = useState<Record<number, { adds: number[], removes: string[], timestamp: number }>>({});
  const prevOrdersRef = React.useRef<Orden[]>([]);

  // Limpiar novedades antiguas cada minuto
  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      setNovedades(prev => {
        const next = { ...prev };
        let changed = false;
        Object.keys(next).forEach(id => {
          if (now - next[Number(id)].timestamp > 120000) { // 2 minutos
            delete next[Number(id)];
            changed = true;
          }
        });
        return changed ? next : prev;
      });
    }, 30000);
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
      if (!prevOrder) return; // Es una orden nueva, no una actualización

      const currentProds = currentOrder.productos || [];
      const prevProds = prevOrder.productos || [];

      // Identificar nuevos
      const adds = currentProds
        .filter(cp => !prevProds.some(pp => pp.id === cp.id))
        .map(cp => cp.id!)
        .filter(id => id !== undefined);

      // Identificar eliminados
      const removes = prevProds
        .filter(pp => !currentProds.some(cp => cp.id === pp.id))
        .map(pp => pp.producto);

      if (adds.length > 0 || removes.length > 0) {
        newNovedades[currentOrder.ordenId] = {
          adds,
          removes,
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

  const { isConnected } = useOrdenesSocket(getBaseUrl(), 'cajero', () => fetchOrders(true));
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
    const numColumns = isMobile ? 1 : isTablet ? 2 : 3;
    const itemWidth = isMobile ? 'w-full' : isTablet ? 'w-1/2' : 'w-1/3';

    return (
      <View className={`p-2 ${itemWidth}`}>
        <Card
          onPress={() =>
            router.push(`/orden-detalle?ordenId=${item.ordenId}` as Href)
          }
          className="bg-(--color-pos-surface) border border-white/5 rounded-2xl overflow-hidden shadow-xl active:scale-[0.98] transition-transform"
        >
          <View className="flex-row justify-between items-start mb-3">
            <View className="flex-row items-center flex-1 mr-2">
              <View className="w-8 h-8 rounded-full bg-(--color-pos-primary)/10 items-center justify-center mr-2">
                <Icon
                  name={
                    item.tipoPedido === 'domicilio'
                      ? 'truck-delivery-outline'
                      : item.tipoPedido === 'llevar'
                        ? 'shopping-outline'
                        : 'table-furniture'
                  }
                  size={16}
                  color="#F5A524"
                />
              </View>
              <Text className="text-white font-black text-base" numberOfLines={1}>
                {getClientName(item)}
              </Text>
            </View>
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


          <View className="flex-row justify-between items-center mb-4 opacity-60">
            <Text className="text-slate-400 text-[10px] font-black uppercase tracking-widest">{item.tipoPedido}</Text>
            <Text className="text-slate-400 text-[10px] font-bold">{formatDate(item.fechaOrden)}</Text>
          </View>

          {item.tipoPedido === 'domicilio' && item.domicilios?.[0]?.direccionEntrega && (
            <View className="flex-row items-center bg-black/20 p-2 rounded-lg mb-3">
              <Icon name="map-marker-outline" size={14} color="#94A3B8" />
              <Text className="text-slate-300 text-xs ml-1 flex-1" numberOfLines={1}>{item.domicilios[0].direccionEntrega}</Text>
            </View>
          )}

          {item.observaciones && (
            <View className="flex-row items-start bg-amber-500/10 p-2 rounded-lg mb-3 border border-amber-500/20">
              <Icon name="note-text-outline" size={14} color="#F5A524" />
              <Text className="text-amber-200/80 text-[11px] ml-1 flex-1 italic" numberOfLines={2}>{item.observaciones}</Text>
            </View>
          )}

          {item.productos && item.productos.length > 0 && (
            <View className="mb-4">
              {item.productos.slice(0, 5).map((prod) => {
                const isNew = novedades[item.ordenId]?.adds?.includes(prod.id!);
                return (
                  <View key={prod.id} className="flex-row items-center mb-1">
                    <View className={`w-1.5 h-1.5 rounded-full ${isNew ? 'bg-green-400' : 'bg-(--color-pos-primary)'} mr-2`} />
                    <Text className={`text-xs flex-1 ${isNew ? 'text-green-400 font-bold' : 'text-slate-300'}`} numberOfLines={1}>
                      {prod.producto}
                    </Text>
                    {isNew && (
                      <View className="bg-green-500/20 px-1.5 py-0.5 rounded mr-2 border border-green-500/30">
                        <Text className="text-green-400 text-[8px] font-black uppercase">Nuevo</Text>
                      </View>
                    )}
                    <Text className="text-white font-black text-xs">x{prod.cantidad}</Text>
                  </View>
                );
              })}
              
              {/* Productos eliminados expuestos como tachados */}
              {novedades[item.ordenId]?.removes?.map((remName, idx) => (
                <View key={`rem-${idx}`} className="flex-row items-center mb-1 opacity-50">
                  <View className="w-1.5 h-1.5 rounded-full bg-red-400 mr-2" />
                  <Text className="text-red-300 text-xs flex-1 line-through" numberOfLines={1}>{remName}</Text>
                  <View className="bg-red-500/20 px-1.5 py-0.5 rounded border border-red-500/30">
                    <Text className="text-red-400 text-[8px] font-black uppercase">Eliminado</Text>
                  </View>
                </View>
              ))}

              {item.productos.length > 5 && (
                <Text className="text-slate-500 text-[10px] italic mt-1">+ {item.productos.length - 5} productos más...</Text>
              )}
            </View>
          )}

          <View className="flex-row justify-end items-center border-t border-white/5 pt-3">
            {item.estadoOrden !== 'completada' && item.estadoOrden !== 'cancelado' && (
              <TouchableOpacity
                className={`w-12 h-12 rounded-full bg-(--color-pos-success) items-center justify-center shadow-lg shadow-green-500/20 active:scale-[0.9] transition-transform ${patchLoading === item.ordenId ? 'opacity-50' : ''}`}
                onPress={() => markAsCompleted(item)}
                disabled={patchLoading === item.ordenId}
              >
                {patchLoading === item.ordenId ? (
                  <ActivityIndicator size="small" color="white" />
                ) : (
                  <Icon name="check" size={24} color="white" />
                )}
              </TouchableOpacity>
            )}
          </View>
        </Card>
      </View>
    );
  }, [getClientName, isMobile, isTablet, markAsCompleted, patchLoading, router]);

  const numColumns = isMobile ? 1 : isTablet ? 2 : 3;

  return (
    <PageContainer scrollable={false} className="flex-1 bg-(--color-pos-bg)">
      <View className="px-5 pt-4">
        <PageHeader
          title={filter === 'pendientes' ? 'Pendientes' : 'Hoy'}
          icon="clipboard-text-outline"
          rightContent={
             <View className="flex-row items-center gap-2">
                <Button
                    title={isMobile ? "" : "Pantalla Completa"}
                    icon="fullscreen"
                    variant="outline"
                    size="sm"
                    onPress={() => setIsFullscreen(true)}
                />
                <Button
                    title=""
                    icon="refresh"
                    variant="ghost"
                    size="sm"
                    onPress={() => fetchOrders(true)}
                    loading={refreshing}
                />
             </View>
          }
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
            <View className={`w-3 h-3 rounded-full will-change-variable ${isConnected ? 'bg-green-500 shadow-[0_0_10px_rgba(34,197,94,0.5)]' : 'bg-red-500'} mr-2`} />
          </View>
        </PageHeader>
      </View>

      {/* Actions & Filters */}
      <View className="flex-row justify-between items-center px-5 mb-4 mt-2">
        <View className="flex-row bg-white/5 p-1 rounded-xl border border-white/5">
          {([
            { key: 'dia' as const, label: 'Todas', icon: 'calendar-today' as const },
            { key: 'pendientes' as const, label: 'Pendientes', icon: 'clock-outline' as const },
          ]).map((f) => {
            const isActive = filter === f.key;
            return (
              <TouchableOpacity
                key={f.key}
                onPress={() => setFilter(f.key)}
                className={`flex-row items-center px-4 py-2 rounded-lg ${isActive ? 'bg-(--color-pos-primary)' : ''}`}
              >
                <Icon
                  name={f.icon}
                  size={14}
                  color={isActive ? '#000' : '#64748B'}
                />
                <Text className={`ml-2 text-xs font-black uppercase ${isActive ? 'text-black' : 'text-slate-500'}`}>
                  {f.label}
                </Text>
              </TouchableOpacity>
            )
          })}
        </View>

        <TouchableOpacity 
          onPress={() => fetchOrders()}
          className="w-10 h-10 rounded-xl bg-white/5 items-center justify-center border border-white/5 active:bg-white/10"
        >
          <Icon name="refresh" size={18} color="#94A3B8" />
        </TouchableOpacity>
      </View>

      {/* Content (Masonry Grid) */}
      <ScrollView 
        className="flex-1 px-3"
        contentContainerClassName="pb-32"
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
                                <View key={order.ordenId} className="p-2">
                                     <Card
                                        onPress={() =>
                                            router.push(`/orden-detalle?ordenId=${order.ordenId}` as Href)
                                        }
                                        className="bg-(--color-pos-surface) border border-white/5 rounded-2xl overflow-hidden shadow-xl active:scale-[0.98] transition-transform"
                                        >
                                        <View className="flex-row justify-between items-start mb-3">
                                            <View className="flex-row items-center flex-1 mr-2">
                                            <View className="w-8 h-8 rounded-full bg-(--color-pos-primary)/10 items-center justify-center mr-2">
                                                <Icon
                                                name={
                                                    order.tipoPedido === 'domicilio'
                                                    ? 'truck-delivery-outline'
                                                    : order.tipoPedido === 'llevar'
                                                        ? 'shopping-outline'
                                                        : 'table-furniture'
                                                }
                                                size={16}
                                                color="#F5A524"
                                                />
                                            </View>
                                            <Text className="text-white font-black text-base" numberOfLines={1}>
                                                {getClientName(order)}
                                            </Text>
                                            </View>
                                            <Badge
                                            label={order.estadoOrden}
                                            variant={
                                                order.estadoOrden === 'pendiente'
                                                ? 'warning'
                                                : order.estadoOrden === 'completada' || order.estadoOrden === 'entregado'
                                                    ? 'success'
                                                    : order.estadoOrden === 'cancelado'
                                                    ? 'danger'
                                                    : 'info'
                                            }
                                            />
                                        </View>

                                        <View className="flex-row justify-between items-center mb-4 opacity-60">
                                            <Text className="text-slate-400 text-[10px] font-black uppercase tracking-widest">{order.tipoPedido}</Text>
                                            <Text className="text-slate-400 text-[10px] font-bold">{formatDate(order.fechaOrden)}</Text>
                                        </View>

                                        {order.tipoPedido === 'domicilio' && order.domicilios?.[0]?.direccionEntrega && (
                                            <View className="flex-row items-center bg-black/20 p-2 rounded-lg mb-3">
                                            <Icon name="map-marker-outline" size={14} color="#94A3B8" />
                                            <Text className="text-slate-300 text-xs ml-1 flex-1" numberOfLines={1}>{order.domicilios[0].direccionEntrega}</Text>
                                            </View>
                                        )}

                                        {order.observaciones && (
                                            <View className="flex-row items-start bg-amber-500/10 p-2 rounded-lg mb-3 border border-amber-500/20">
                                            <Icon name="note-text-outline" size={14} color="#F5A524" />
                                            <Text className="text-amber-200/80 text-[11px] ml-1 flex-1 italic" numberOfLines={2}>{order.observaciones}</Text>
                                            </View>
                                        )}

                                        {order.productos && order.productos.length > 0 && (
                                            <View className="mb-4">
                                            {order.productos.slice(0, 10).map((prod) => {
                                                const isNew = novedades[order.ordenId]?.adds?.includes(prod.id!);
                                                return (
                                                <View key={prod.id} className="flex-row items-center mb-1">
                                                    <View className={`w-1.5 h-1.5 rounded-full ${isNew ? 'bg-green-400' : 'bg-(--color-pos-primary)'} mr-2`} />
                                                    <Text className={`text-xs flex-1 ${isNew ? 'text-green-400 font-bold' : 'text-slate-300'}`} numberOfLines={1}>
                                                    {prod.producto}
                                                    </Text>
                                                    {isNew && (
                                                    <View className="bg-green-500/20 px-1.5 py-0.5 rounded mr-2 border border-green-500/30">
                                                        <Text className="text-green-400 text-[8px] font-black uppercase">Nuevo</Text>
                                                    </View>
                                                    )}
                                                    <Text className="text-white font-black text-xs">x{prod.cantidad}</Text>
                                                </View>
                                                );
                                            })}
                                            
                                            {novedades[order.ordenId]?.removes?.map((remName, idx) => (
                                                <View key={`rem-${idx}`} className="flex-row items-center mb-1 opacity-50">
                                                <View className="w-1.5 h-1.5 rounded-full bg-red-400 mr-2" />
                                                <Text className="text-red-300 text-xs flex-1 line-through" numberOfLines={1}>{remName}</Text>
                                                <View className="bg-red-500/20 px-1.5 py-0.5 rounded border border-red-500/30">
                                                    <Text className="text-red-400 text-[8px] font-black uppercase">Eliminado</Text>
                                                </View>
                                                </View>
                                            ))}

                                            {order.productos.length > 10 && (
                                                <Text className="text-slate-500 text-[10px] italic mt-1">+ {order.productos.length - 10} más...</Text>
                                            )}
                                            </View>
                                        )}

                                        <View className="flex-row justify-end items-center border-t border-white/5 pt-3">
                                            {order.estadoOrden !== 'completada' && order.estadoOrden !== 'cancelado' && (
                                            <TouchableOpacity
                                                className={`w-12 h-12 rounded-full bg-(--color-pos-success) items-center justify-center shadow-lg shadow-green-500/20 active:scale-[0.9] transition-transform ${patchLoading === order.ordenId ? 'opacity-50' : ''}`}
                                                onPress={() => markAsCompleted(order)}
                                                disabled={patchLoading === order.ordenId}
                                            >
                                                {patchLoading === order.ordenId ? (
                                                <ActivityIndicator size="small" color="white" />
                                                ) : (
                                                <Icon name="check" size={24} color="white" />
                                                )}
                                            </TouchableOpacity>
                                            )}
                                        </View>
                                    </Card>
                                </View>
                            ))}
                    </View>
                ))}
            </View>
        )}
      </ScrollView>

      {/* FULLSCREEN KDS OVERLAY */}
      {isFullscreen && (
        <View className="absolute inset-0 bg-black z-50 p-6">
            <View className="flex-row justify-between items-center mb-10 border-b border-white/10 pb-6">
                <View className="flex-row items-center gap-4">
                    <View className="w-10 h-10 rounded-xl bg-orange-500 items-center justify-center">
                        <Icon name="fire" size={24} color="black" />
                    </View>
                    <View>
                        <Text className="text-white text-3xl font-black uppercase tracking-tighter" style={{ fontFamily: 'Space Grotesk' }}>COCINA / KDS</Text>
                        <Text className="text-slate-500 text-xs font-bold uppercase tracking-widest">Monitor de Órdenes en Tiempo Real</Text>
                    </View>
                </View>
                
                <View className="flex-row items-center gap-8">
                    <View className="items-end">
                        <Text className="text-white text-4xl font-black" style={{ fontFamily: 'Space Grotesk' }}>
                             {currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </Text>
                        <Text className="text-orange-500 text-[10px] font-black uppercase tracking-widest">
                            {currentTime.toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long' })}
                        </Text>
                    </View>
                    <TouchableOpacity 
                        onPress={() => setIsFullscreen(false)}
                        className="w-14 h-14 rounded-2xl bg-white/5 items-center justify-center border border-white/10 active:bg-white/10"
                    >
                        <Icon name="close" size={28} color="white" />
                    </TouchableOpacity>
                </View>
            </View>

            <ScrollView contentContainerClassName="pb-20">
                <View className="flex-row flex-wrap">
                     {orders
                        .filter(o => o.estadoOrden === 'pendiente')
                        .map((order) => (
                         <View key={`kds-${order.ordenId}`} className={isMobile ? 'w-full' : isTablet ? 'w-1/2' : 'w-1/4'}>
                            <View className="m-2 p-6 bg-slate-900 rounded-3xl border border-white/10 relative overflow-hidden">
                                {order.tipoPedido === 'domicilio' && (
                                    <View className="absolute top-0 right-0 bg-red-500 px-4 py-1 rounded-bl-xl">
                                        <Text className="text-white text-[10px] font-black uppercase">Domicilio</Text>
                                    </View>
                                )}
                                
                                <View className="flex-row items-center gap-3 mb-6">
                                    <View className="w-12 h-12 rounded-2xl bg-white/5 items-center justify-center border border-white/10">
                                        <Text className="text-white text-xl font-black">{order.nombreCliente?.slice(0,1) || '?'}</Text>
                                    </View>
                                    <View className="flex-1">
                                         <Text className="text-white font-black text-xl uppercase tracking-tighter" numberOfLines={1}>
                                            {getClientName(order)}
                                         </Text>
                                         <Text className="text-slate-500 text-[10px] font-bold">OR-#{order.ordenId}</Text>
                                    </View>
                                </View>

                                <View className="gap-y-3 mb-8">
                                    {order.productos?.map((p, idx) => (
                                        <View key={idx} className="flex-row items-start gap-3">
                                            <View className="bg-orange-500 w-7 h-7 rounded-lg items-center justify-center">
                                                <Text className="text-black font-black text-xs">{p.cantidad}</Text>
                                            </View>
                                            <Text className="text-slate-200 text-lg font-bold flex-1 leading-6">{p.producto}</Text>
                                        </View>
                                    ))}
                                    {order.observaciones && (
                                        <View className="mt-2 bg-amber-500/10 p-4 rounded-2xl border border-amber-500/20">
                                             <Text className="text-amber-200 text-sm italic font-medium">"{order.observaciones}"</Text>
                                        </View>
                                    )}
                                </View>

                                <TouchableOpacity 
                                    onPress={() => markAsCompleted(order)}
                                    disabled={patchLoading === order.ordenId}
                                    className="w-full h-16 bg-emerald-500 rounded-2xl items-center justify-center shadow-lg shadow-emerald-500/40 active:bg-emerald-400 active:scale-[0.98] transition-transform"
                                >
                                    {patchLoading === order.ordenId ? (
                                        <ActivityIndicator color="black" />
                                    ) : (
                                        <View className="flex-row items-center gap-3">
                                            <Icon name="check-bold" size={24} color="black" />
                                            <Text className="text-black font-black text-lg uppercase tracking-widest">Listo</Text>
                                        </View>
                                    )}
                                </TouchableOpacity>
                            </View>
                         </View>
                     ))}
                     {orders.filter(o => o.estadoOrden === 'pendiente').length === 0 && (
                        <View className="flex-1 items-center justify-center pt-20">
                            <Icon name="chef-hat" size={100} color="#1E293B" />
                            <Text className="text-slate-700 text-3xl font-black mt-6">COCINA DESPEJADA</Text>
                        </View>
                     )}
                </View>
            </ScrollView>
        </View>
      )}
    </PageContainer>
  );
}
