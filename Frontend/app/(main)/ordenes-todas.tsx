import React, { useCallback, useEffect, useReducer, useState } from 'react';
import { ScrollView, TouchableOpacity, View, Text } from '../../tw';
import OrderCardKDS from '../../components/orders/OrderCardKDS';
import { useRouter } from 'expo-router';
import { api } from '../../services/api';
import type { Orden, PaginatedResponse } from '@monorepo/shared';
import { formatCurrency, formatDate } from '@monorepo/shared';
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
  const { isMobile } = useBreakpoint();
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

  // Masonry layout calculation
  const columns = isMobile ? 1 : 2; // For app/mobile, 1 or 2 pods
  const masonryColumns: Orden[][] = Array.from({ length: columns }, () => []);
  ordenes.forEach((o, index) => {
    masonryColumns[index % columns].push(o);
  });

  // KDS Fullscreen Overlay
  if (isFullscreen) {
      <View className="absolute z-[100] inset-0 bg-[#0F172A]">
        {/* Fullscreen Header */}
        <View className="h-16 px-6 bg-[#000000] border-b border-white/10 flex-row justify-between items-center">
          <View className="flex-row items-center gap-3">
            <Icon name="format-list-bulleted" size={24} color="#F5A524" />
            <Text className="text-xl font-black text-white uppercase tracking-wider">Historial • Expandido</Text>
            <View className="flex-row items-center ml-4 bg-emerald-500/10 px-3 py-1.5 rounded-full border border-emerald-500/20">
              <View className="w-2 h-2 rounded-full bg-emerald-500 mr-2" />
              <Text className="text-emerald-400 font-bold text-xs">TOTAL • {result?.total || 0}</Text>
            </View>
          </View>
          <View className="flex-row items-center gap-6">
            <Text className="text-2xl font-black text-white tracking-widest">{timeStr}</Text>
            <TouchableOpacity onPress={() => setIsFullscreen(false)} className="w-10 h-10 bg-white/5 rounded-xl border border-white/10 items-center justify-center">
              <Icon name="fullscreen-exit" size={24} color="#94A3B8" />
            </TouchableOpacity>
          </View>
        </View>

        <ScrollView className="flex-1 p-6" contentContainerClassName="pb-20">
          <View className="flex-row gap-4 flex-wrap">
            {ordenes.map((orden) => {
              const ec = getEstadoColor(orden.estadoOrden);
              const total = getOrdenTotal(orden);
              return (
                <View key={orden.ordenId} style={{ width: '32%', minWidth: 300, marginBottom: 12 }}>
                  <Card
                    onPress={() => router.push(`/orden-detalle?ordenId=${orden.ordenId}`)}
                    className="h-full overflow-hidden"
                  >
                    <View className="flex-row justify-between items-center mb-2">
                      <View className="flex-row items-center gap-2">
                        <Text className="text-white font-black text-base" style={{ fontFamily: 'SpaceGrotesk-Bold' }}>#{orden.ordenId}</Text>
                        <Badge label={orden.estadoOrden || 'N/A'} variant={orden.estadoOrden === 'cancelado' ? 'danger' : 'info'} icon={ec.icon} size="sm" />
                      </View>
                      <Text className="text-(--color-pos-primary) font-black text-lg" style={{ fontFamily: 'SpaceGrotesk-Bold' }}>
                         ${formatCurrency(total)}
                      </Text>
                    </View>
                    <View className="flex-row gap-3 mb-2">
                      <View className="flex-row items-center gap-1">
                        <Icon name="tag-outline" size={12} color="#64748B" />
                        <Text className="text-slate-400 text-[11px] font-bold uppercase">{orden.tipoPedido}</Text>
                      </View>
                    </View>
                    {orden.productos && orden.productos.length > 0 && (
                      <View className="bg-white/5 px-3 py-2 rounded-xl gap-1 border border-white/5 mt-auto">
                        {orden.productos.slice(0, 4).map((p, idx) => (
                          <View key={`${p.id ?? getProductoPreviewName(p)}-${idx}`} className="flex-row items-center gap-1.5">
                             <View className="w-1 h-1 rounded-full bg-(--color-pos-primary)/40" />
                             <Text className="text-slate-300 text-[11px] flex-1" numberOfLines={1}>{getProductoPreviewName(p)}</Text>
                             <Text className="text-slate-500 text-[10px] font-black uppercase">x{p.cantidad}</Text>
                          </View>
                        ))}
                      </View>
                    )}
                  </Card>
                </View>
              );
            })}
          </View>
        </ScrollView>
      </View>
  }

  return (
    <PageContainer>
      <PageHeader
        title="Historial de Órdenes"
        subtitle="Listado general"
        icon="format-list-bulleted"
        rightContent={
          <View className="flex-row items-center gap-2">
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
              title="Refrescar"
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
        <View className="items-center py-20 opacity-50">
          <View className="bg-white/5 p-10 rounded-full mb-6">
            <Icon name="clipboard-text-off-outline" size={64} color="#64748B" />
          </View>
          <Text className="text-slate-400 font-black text-lg uppercase tracking-wider" style={{ fontFamily: 'Space Grotesk' }}>No se encontraron órdenes</Text>
        </View>
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
    </PageContainer>
  );
}
