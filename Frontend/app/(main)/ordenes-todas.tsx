import React, { useCallback, useEffect, useReducer, useState } from 'react';
import { RefreshControl } from 'react-native';
import { ScrollView, TouchableOpacity, View, Text } from '../../tw';
import { useRouter } from 'expo-router';
import { api } from '../../services/api';
import type { Orden, PaginatedResponse } from '@/src/shared';
import { formatCurrency, formatDate } from '@/src/shared';
import { ESTADO_LABELS, getEstadoColor } from '../../constants/estados';
import {
  PageContainer,
  PageHeader,
  Button,
  Card,
  Badge,
  Icon,
  Input,
  ListSkeleton,
} from '../../components/ui';
import { useBreakpoint } from '../../styles/responsive';
import { EmptyState } from '../../components/states/EmptyState';

const LIMIT = 20;

// Simplified filter states - only show most commonly used
const FILTER_ESTADOS = ['', 'pendiente', 'completada', 'cancelado'] as const;

type OrdenesQueryParams = {
  page: number;
  limit: number;
  estado?: string;
  from?: string;
  to?: string;
};

function getOrdenTotal(orden: Orden): number {
  if (typeof orden.factura?.totalFactura === 'number') {
    return orden.factura.totalFactura;
  }

  if (typeof orden.factura?.total === 'number') {
    return orden.factura.total;
  }

  return (
    orden.productos?.reduce(
      (sum, producto) => sum + (producto.precioUnitario ?? 0) * (producto.cantidad ?? 1),
      0,
    ) ?? 0
  );
}

function getProductoPreviewName(producto: NonNullable<Orden['productos']>[number]): string {
  if (typeof producto.productoNombre === 'string' && producto.productoNombre.trim()) {
    return producto.productoNombre;
  }
  if (typeof producto.producto === 'string' && producto.producto.trim()) {
    return producto.producto;
  }
  return 'Producto';
}

export default function OrdenesTodasScreen() {
  const router = useRouter();
  const { isMobile, isTablet } = useBreakpoint();
  type ScreenState = {
    page: number;
    estado: string;
    from: string;
    to: string;
    result: PaginatedResponse<Orden> | null;
    loading: boolean;
    error: string;
  };

  const [state, patchState] = useReducer(
    (prev: ScreenState, patch: Partial<ScreenState>): ScreenState => ({ ...prev, ...patch }),
    {
      page: 1,
      estado: '',
      from: '',
      to: '',
      result: null,
      loading: false,
      error: '',
    },
  );

  const { page, estado, from, to, result, loading, error } = state;
  const [refreshing, setRefreshing] = useState(false);

  const fetchData = useCallback(
    async (p: number) => {
      patchState({ loading: true, error: '' });
      try {
        const params: OrdenesQueryParams = { page: p, limit: LIMIT };
        if (estado) params.estado = estado;
        if (from) params.from = from;
        if (to) params.to = to;
        const data = await api.ordenes.getAll(params);
        patchState({ result: data, page: p, loading: false });
        return;
      } catch {
        patchState({ error: 'Error al cargar órdenes', loading: false });
        return;
      }
    },
    [estado, from, to],
  );

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchData(1);
    setRefreshing(false);
  }, [fetchData]);

  useEffect(() => {
    const timer = setTimeout(() => {
      void fetchData(1);
    }, 0);

    return () => clearTimeout(timer);
  }, [fetchData]);

  const [isFullscreen, setIsFullscreen] = useState(false);
  const [timeStr, setTimeStr] = useState('');

  useEffect(() => {
    if (!isFullscreen) return;
    const updateTime = () => {
      const now = new Date();
      setTimeStr(now.toLocaleTimeString('en-US', { hour12: false }));
    };
    updateTime();
    const t = setInterval(updateTime, 1000);
    return () => clearInterval(t);
  }, [isFullscreen]);

  const ordenes = result?.data ?? [];

  const fsCardWidth = isMobile ? '100%' : isTablet ? '49%' : '32%';

  return (
    <PageContainer
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={handleRefresh}
          tintColor="#F5A524"
          colors={['#F5A524']}
        />
      }
    >
      <PageHeader
        title="Historial de Órdenes"
        subtitle="Listado general"
        icon="format-list-bulleted"
        rightContent={
          <View style={{ flexDirection: 'row', alignItems: 'center' }} className="gap-2">
            {!isMobile && (
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
              onPress={() => fetchData(1)}
            />
          </View>
        }
      />

      {/* Filters Area */}
      <Card className="mb-6 p-4">
        {/* Estado chips */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          className="mb-3"
          contentContainerStyle={{ gap: 6 }}
        >
          {FILTER_ESTADOS.map((e) => {
            const ec = getEstadoColor(e || undefined);
            const active = estado === e;
            return (
              <TouchableOpacity
                key={e}
                style={{
                  flexDirection: 'row', alignItems: 'center', gap: 6,
                  paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20,
                  borderWidth: 1,
                  backgroundColor: active ? 'rgba(245,165,36,0.15)' : 'rgba(255,255,255,0.04)',
                  borderColor: active ? 'rgba(245,165,36,0.35)' : 'rgba(255,255,255,0.06)',
                }}
                onPress={() => patchState({ estado: e })}
              >
                {e !== '' && (
                  <Icon name={ec.icon} size={14} color={active ? '#F5A524' : '#64748B'} />
                )}
                <Text
                  className={`text-xs font-black uppercase tracking-wider ${
                    active ? 'text-(--color-pos-primary)' : 'text-slate-400'
                  }`}
                >
                  {ESTADO_LABELS[e]}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* Date filters */}
        <View className={`${isMobile ? 'flex-col' : 'flex-row'} gap-4`}>
          <Input
            label="Desde"
            value={from}
            onChangeText={(value) => patchState({ from: value })}
            placeholder="YYYY-MM-DD"
            size="sm"
            className="flex-1"
            leftIcon={<Icon name="calendar" size={16} color="#475569" />}
          />
          <Input
            label="Hasta"
            value={to}
            onChangeText={(value) => patchState({ to: value })}
            placeholder="YYYY-MM-DD"
            size="sm"
            className="flex-1"
            leftIcon={<Icon name="calendar" size={16} color="#475569" />}
          />
        </View>
      </Card>

      {/* Pagination info */}
      {result && (
        <View className="flex-row justify-between items-center mb-6 flex-wrap gap-4">
          <Text className="text-slate-500 text-xs font-bold uppercase tracking-widest">
            {result.total} órdenes encontradas
          </Text>
          <View className="flex-row items-center gap-2">
            <TouchableOpacity
              className={`w-10 h-10 rounded-xl items-center justify-center bg-white/5 border border-white/5 ${page <= 1 ? 'opacity-30' : 'active:bg-white/10'}`}
              onPress={() => page > 1 && fetchData(page - 1)}
              disabled={page <= 1}
            >
              <Icon name="chevron-left" size={20} color={page <= 1 ? '#475569' : '#FFF'} />
            </TouchableOpacity>
            
            <View className="bg-white/5 px-4 h-10 items-center justify-center rounded-xl border border-white/5">
              <Text className="text-white font-black text-xs">
                {result.page} / {result.totalPages}
              </Text>
            </View>

            <TouchableOpacity
              className={`w-10 h-10 rounded-xl items-center justify-center bg-white/5 border border-white/5 ${page >= (result?.totalPages ?? 1) ? 'opacity-30' : 'active:bg-white/10'}`}
              onPress={() =>
                page < (result?.totalPages ?? 1) && fetchData(page + 1)
              }
              disabled={page >= (result?.totalPages ?? 1)}
            >
              <Icon name="chevron-right" size={20} color={page >= (result?.totalPages ?? 1) ? '#475569' : '#FFF'} />
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Loading / Error / Empty */}
      {loading && <ListSkeleton count={5} />}
      {error ? (
        <View className="flex-row items-center gap-3 bg-red-500/10 p-5 rounded-2xl border border-red-500/20 mb-6">
          <Icon name="alert-circle-outline" size={20} color="#EF4444" />
          <Text className="text-red-400 font-bold text-sm flex-1">{error}</Text>
        </View>
      ) : null}
      {!loading && !error && ordenes.length === 0 && (
        <EmptyState icon="format-list-bulleted" message="Sin órdenes" subMessage="No hay órdenes en el período" />
      )}

      {/* Order cards */}
      {!loading &&
        ordenes.map((orden) => {
          const ec = getEstadoColor(orden.estadoOrden);
          const total = getOrdenTotal(orden);

          return (
            <Card
              key={orden.ordenId}
              onPress={() =>
                router.push(`/orden-detalle?ordenId=${orden.ordenId}`)
              }
              className="mb-3 overflow-hidden"
            >
              {/* Header */}
              <View className="flex-row justify-between items-center mb-2">
                <View className="flex-row items-center gap-2">
                  <Text className="text-white font-black text-base" style={{ fontFamily: 'SpaceGrotesk-Bold' }}>#{orden.ordenId}</Text>
                  <Badge
                    label={orden.estadoOrden || 'N/A'}
                    variant={
                      orden.estadoOrden === 'pendiente'
                        ? 'warning'
                        : orden.estadoOrden === 'completada' || orden.estadoOrden === 'entregado'
                          ? 'success'
                          : orden.estadoOrden === 'cancelado'
                            ? 'danger'
                            : 'info'
                    }
                    icon={ec.icon}
                    size="sm"
                  />
                </View>
                <Text className="text-(--color-pos-primary) font-black text-lg" style={{ fontFamily: 'SpaceGrotesk-Bold' }}>
                   ${formatCurrency(total)}
                </Text>
              </View>

              {/* Meta */}
              <View className="flex-row gap-3 mb-2">
                <View className="flex-row items-center gap-1">
                  <Icon name="tag-outline" size={12} color="#64748B" />
                  <Text className="text-slate-400 text-[11px] font-bold uppercase">{orden.tipoPedido}</Text>
                </View>
                <View className="flex-row items-center gap-1">
                  <Icon name="calendar-outline" size={12} color="#64748B" />
                  <Text className="text-slate-400 text-[11px] font-bold uppercase">
                    {formatDate(orden.fechaOrden)}
                  </Text>
                </View>
              </View>

              {/* Products preview */}
              {orden.productos && orden.productos.length > 0 && (
                <View className="bg-white/5 px-3 py-2 rounded-xl gap-1 border border-white/5">
                  {orden.productos.slice(0, 3).map((p, idx) => (
                    <View key={`${p.id ?? getProductoPreviewName(p)}-${idx}`} className="flex-row items-center gap-1.5">
                       <View className="w-1 h-1 rounded-full bg-(--color-pos-primary)/40" />
                       <Text className="text-slate-300 text-[11px] flex-1" numberOfLines={1}>
                          {getProductoPreviewName(p)}
                       </Text>
                       <Text className="text-slate-500 text-[10px] font-black uppercase">x{p.cantidad}</Text>
                    </View>
                  ))}
                  {orden.productos.length > 3 && (
                    <Text className="text-slate-500 text-[10px] font-black italic uppercase text-right">
                      +{orden.productos.length - 3} más
                    </Text>
                  )}
                </View>
              )}
            </Card>
          );
        })}

      {/* Bottom pagination */}
      {result && result.totalPages > 1 && (
        <View className="flex-row justify-center items-center py-10 gap-4">
          <Button
            title="Anterior"
            icon="chevron-left"
            variant="ghost"
            size="sm"
            onPress={() => page > 1 && fetchData(page - 1)}
            disabled={page <= 1}
          />
          <View className="bg-white/5 px-6 py-2 rounded-full border border-white/5">
             <Text className="text-white font-black text-xs">Pág {page} de {result.totalPages}</Text>
          </View>
          <Button
            title="Siguiente"
            iconRight="chevron-right"
            variant="ghost"
            size="sm"
            onPress={() => page < result.totalPages && fetchData(page + 1)}
            disabled={page >= result.totalPages}
          />
        </View>
      )}

      {/* ── KDS FULLSCREEN OVERLAY ── */}
      {isFullscreen && (
        <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 99999, flexDirection: 'column', backgroundColor: '#070D1A' }}>
          {/* Header row 1: brand + clock + actions */}
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1, borderColor: 'rgba(255,255,255,0.07)', backgroundColor: '#000000' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <View style={{ width: 38, height: 38, borderRadius: 12, backgroundColor: 'rgba(245,165,36,0.12)', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(245,165,36,0.22)' }}>
                <Icon name="format-list-bulleted" size={18} color="#F5A524" />
              </View>
              <View>
                <Text style={{ color: '#F8FAFC', fontFamily: 'SpaceGrotesk-Bold', fontSize: 17, letterSpacing: -0.3 }}>Historial KDS</Text>
                <Text style={{ color: '#475569', fontSize: 10, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 1 }}>Vista Expandida</Text>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(245,165,36,0.08)', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20, borderWidth: 1, borderColor: 'rgba(245,165,36,0.18)', marginLeft: 8 }}>
                <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: '#F5A524' }} />
                <Text style={{ color: '#F5A524', fontSize: 11, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.5 }}>{result?.total ?? 0} Órdenes</Text>
              </View>
            </View>

            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <View className="hidden sm:flex items-end">
                <Text style={{ color: '#FFFFFF', fontFamily: 'SpaceGrotesk-Bold', fontSize: 22, letterSpacing: 1 }}>{timeStr}</Text>
              </View>
              <TouchableOpacity
                onPress={() => void fetchData(page)}
                style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.09)', alignItems: 'center', justifyContent: 'center' }}
              >
                <Icon name="refresh" size={18} color="#94A3B8" />
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => setIsFullscreen(false)}
                style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.09)', alignItems: 'center', justifyContent: 'center' }}
              >
                <Icon name="fullscreen-exit" size={20} color="#94A3B8" />
              </TouchableOpacity>
            </View>
          </View>

          {/* Header row 2: status filter chips */}
          <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: 1, borderColor: 'rgba(255,255,255,0.05)', backgroundColor: 'rgba(0,0,0,0.4)', gap: 6 }}>
            <Icon name="filter-variant" size={14} color="#475569" />
            {FILTER_ESTADOS.map((e) => {
              const ec = getEstadoColor(e || undefined);
              const active = estado === e;
              return (
                <TouchableOpacity
                  key={e}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, borderWidth: 1, backgroundColor: active ? 'rgba(245,165,36,0.14)' : 'rgba(255,255,255,0.04)', borderColor: active ? 'rgba(245,165,36,0.32)' : 'rgba(255,255,255,0.07)' }}
                  onPress={() => { patchState({ estado: e }); }}
                >
                  {e !== '' && <Icon name={ec.icon} size={12} color={active ? '#F5A524' : '#64748B'} />}
                  <Text style={{ color: active ? '#F5A524' : '#64748B', fontSize: 11, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.5 }}>{ESTADO_LABELS[e]}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Card grid */}
          <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, paddingBottom: 24 }}>
            {loading && <ListSkeleton count={6} />}
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
              {ordenes.map((orden) => {
                const ec = getEstadoColor(orden.estadoOrden);
                const total = getOrdenTotal(orden);
                const diffMins = Math.max(0, Math.floor((Date.now() - new Date(orden.fechaOrden).getTime()) / 60000));
                const isUrgente = diffMins >= 20 && orden.estadoOrden === 'pendiente';
                const isPendiente = orden.estadoOrden === 'pendiente';
                const isCompletada = orden.estadoOrden === 'completada' || orden.estadoOrden === 'entregado';
                const isCancelado = orden.estadoOrden === 'cancelado';
                const accentColor = isPendiente ? '#F5A524' : isCompletada ? '#10B981' : isCancelado ? '#EF4444' : '#475569';
                const badgeVariant = isPendiente ? 'warning' : isCompletada ? 'success' : isCancelado ? 'danger' : 'info';
                const clientName = (orden as any).nombreCliente?.trim() || (orden.factura as any)?.clienteNombre || (orden.tipoPedido?.toLowerCase() === 'mesa' ? `Mesa ${(orden as any).mesa || ''}` : 'Sin nombre');

                return (
                  <TouchableOpacity
                    key={orden.ordenId}
                    style={{ width: fsCardWidth, borderRadius: 16, overflow: 'hidden', backgroundColor: '#0C1828', borderWidth: 1, borderColor: isUrgente ? 'rgba(239,68,68,0.35)' : 'rgba(255,255,255,0.07)', marginBottom: 0 }}
                    onPress={() => { router.push(`/orden-detalle?ordenId=${orden.ordenId}`); setIsFullscreen(false); }}
                    activeOpacity={0.82}
                  >
                    {/* Status accent bar */}
                    <View style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 3, backgroundColor: accentColor, borderTopLeftRadius: 16, borderBottomLeftRadius: 16 }} />

                    {/* Card header */}
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingLeft: 16, paddingRight: 12, paddingTop: 12, paddingBottom: 10, borderBottomWidth: 1, borderColor: 'rgba(255,255,255,0.05)' }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1, minWidth: 0 }}>
                        <Text style={{ color: '#F5A524', fontFamily: 'SpaceGrotesk-Bold', fontSize: 13 }}>#{orden.ordenId}</Text>
                        <Badge label={orden.estadoOrden || 'N/A'} variant={badgeVariant} icon={ec.icon} size="sm" />
                      </View>
                      <Text style={{ color: '#F5A524', fontFamily: 'SpaceGrotesk-Bold', fontSize: 15 }}>${formatCurrency(total)}</Text>
                    </View>

                    {/* Client + timer */}
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingTop: 10, paddingBottom: 6 }}>
                      <Text style={{ color: '#F1F5F9', fontSize: 13, fontWeight: '800', textTransform: 'uppercase', letterSpacing: -0.2, flex: 1 }} numberOfLines={1}>{clientName}</Text>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: isUrgente ? 'rgba(239,68,68,0.15)' : 'rgba(255,255,255,0.06)', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, borderWidth: 1, borderColor: isUrgente ? 'rgba(239,68,68,0.3)' : 'rgba(255,255,255,0.08)', marginLeft: 8 }}>
                        <Icon name="clock-outline" size={11} color={isUrgente ? '#F87171' : '#475569'} />
                        <Text style={{ color: isUrgente ? '#F87171' : '#475569', fontSize: 11, fontWeight: '800' }}>{diffMins > 0 ? `${diffMins}m` : '<1m'}</Text>
                      </View>
                    </View>

                    {/* Tipo + date */}
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, paddingBottom: 10 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(255,255,255,0.04)', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)' }}>
                        <Icon name="tag-outline" size={10} color="#64748B" />
                        <Text style={{ color: '#64748B', fontSize: 10, fontWeight: '700', textTransform: 'uppercase' }}>{orden.tipoPedido || 'Mesa'}</Text>
                      </View>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                        <Icon name="calendar-outline" size={10} color="#334155" />
                        <Text style={{ color: '#334155', fontSize: 10, fontWeight: '700' }}>{formatDate(orden.fechaOrden)}</Text>
                      </View>
                    </View>

                    {/* Products list */}
                    {orden.productos && orden.productos.length > 0 && (
                      <View style={{ marginHorizontal: 12, marginBottom: 12, backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: 12, padding: 10, borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)', gap: 6 }}>
                        {orden.productos.slice(0, 5).map((p, idx) => (
                          <View key={`${(p as any).id ?? getProductoPreviewName(p)}-${idx}`} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                            <View style={{ backgroundColor: 'rgba(245,165,36,0.14)', borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2, minWidth: 26, alignItems: 'center', borderWidth: 1, borderColor: 'rgba(245,165,36,0.22)' }}>
                              <Text style={{ color: '#F5A524', fontSize: 11, fontWeight: '800' }}>{p.cantidad}</Text>
                            </View>
                            <Text style={{ flex: 1, color: '#CBD5E1', fontSize: 12, fontWeight: '600' }} numberOfLines={1}>{getProductoPreviewName(p)}</Text>
                          </View>
                        ))}
                        {orden.productos.length > 5 && (
                          <Text style={{ color: '#334155', fontSize: 10, fontWeight: '800', textTransform: 'uppercase', textAlign: 'right' }}>+{orden.productos.length - 5} más</Text>
                        )}
                      </View>
                    )}
                  </TouchableOpacity>
                );
              })}
              {!loading && ordenes.length === 0 && (
                <EmptyState icon="format-list-bulleted" message="Sin órdenes" subMessage="No hay órdenes en el período" />
              )}
            </View>
          </ScrollView>

          {/* Footer pagination */}
          {result && result.totalPages > 1 && (
            <View style={{ flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 10, paddingVertical: 12, borderTopWidth: 1, borderColor: 'rgba(255,255,255,0.06)', backgroundColor: '#000000' }}>
              <TouchableOpacity
                onPress={() => page > 1 && fetchData(page - 1)}
                disabled={page <= 1}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 10, borderWidth: 1, backgroundColor: 'rgba(255,255,255,0.04)', borderColor: 'rgba(255,255,255,0.08)', opacity: page <= 1 ? 0.35 : 1 }}
              >
                <Icon name="chevron-left" size={15} color="#94A3B8" />
                <Text style={{ color: '#94A3B8', fontSize: 12, fontWeight: '800', textTransform: 'uppercase' }}>Anterior</Text>
              </TouchableOpacity>
              <View style={{ backgroundColor: 'rgba(255,255,255,0.05)', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 10, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' }}>
                <Text style={{ color: '#FFFFFF', fontFamily: 'SpaceGrotesk-Bold', fontSize: 12 }}>Página {page} / {result.totalPages}</Text>
              </View>
              <TouchableOpacity
                onPress={() => page < result.totalPages && fetchData(page + 1)}
                disabled={page >= result.totalPages}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 10, borderWidth: 1, backgroundColor: 'rgba(255,255,255,0.04)', borderColor: 'rgba(255,255,255,0.08)', opacity: page >= result.totalPages ? 0.35 : 1 }}
              >
                <Text style={{ color: '#94A3B8', fontSize: 12, fontWeight: '800', textTransform: 'uppercase' }}>Siguiente</Text>
                <Icon name="chevron-right" size={15} color="#94A3B8" />
              </TouchableOpacity>
            </View>
          )}
        </View>
      )}
    </PageContainer>
  );
}
