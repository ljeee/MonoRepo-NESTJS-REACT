import React, { useCallback, useEffect, useReducer, useState } from 'react';
import { ScrollView, Text, TouchableOpacity, View } from '../../tw';
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
import { useOrdenesSocket } from '@monorepo/shared';
import { getBaseUrl } from '../../services/api';

const LIMIT = 20;

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

  const { isConnected } = useOrdenesSocket(getBaseUrl(), 'cocina', () => fetchData(1));

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
  const columns = isMobile ? 1 : 3; // 3 columns for desktop, 1 for mobile
  const masonryColumns: Orden[][] = Array.from({ length: columns }, () => []);
  ordenes.forEach((o, index) => {
    masonryColumns[index % columns].push(o);
  });

  // KDS Fullscreen Overlay
  if (isFullscreen) {
    return (
      <View className="absolute z-50 inset-0 bg-[#0F172A]">
        {/* KDS Header */}
        <View className="h-16 px-6 bg-[#000000] border-b border-white/10 flex-row justify-between items-center">
          <View className="flex-row items-center gap-3">
            <Icon name="chef-hat" size={24} color="#F5A524" />
            <Text className="text-2xl font-black text-white uppercase tracking-wider">KDS / COCINA</Text>
            <View className="flex-row items-center ml-4 bg-emerald-500/10 px-3 py-1.5 rounded-full border border-emerald-500/20">
              <View className="w-2 h-2 rounded-full bg-emerald-500 mr-2" />
              <Text className="text-emerald-400 font-bold text-xs">SISTEMA ACTIVO • {result?.total || 0} ÓRDENES</Text>
            </View>
          </View>
          <View className="flex-row items-center gap-6">
            <Text className="text-3xl font-black text-white tracking-widest">{timeStr}</Text>
            <TouchableOpacity onPress={() => setIsFullscreen(false)} className="w-10 h-10 bg-white/5 rounded-xl border border-white/10 items-center justify-center">
              <Icon name="fullscreen-exit" size={24} color="#94A3B8" />
            </TouchableOpacity>
          </View>
        </View>

        {/* KDS Body */}
        <ScrollView className="flex-1 p-6" contentContainerClassName="pb-20">
          <View className="flex-row gap-4">
            {masonryColumns.map((col, cIndex) => (
              <View key={`col-${cIndex}`} className="flex-1 gap-4">
                {col.map((orden) => (
                  <OrderCardKDS 
                    key={orden.ordenId} 
                    orden={orden} 
                    onPress={() => router.push(`/orden-detalle?ordenId=${orden.ordenId}`)}
                  />
                ))}
              </View>
            ))}
          </View>
        </ScrollView>
      </View>
    );
  }

  return (
    <PageContainer>
      <PageHeader
        title="Todas las Órdenes"
        rightContent={
          <Button
            title="Refrescar"
            icon="refresh"
            variant="ghost"
            size="sm"
            onPress={() => fetchData(1)}
          />
        }
      />

      <View className="flex-row justify-end items-center mb-10 gap-4">
        <View className="flex-row gap-2">
          <TouchableOpacity 
            onPress={() => setIsFullscreen(true)}
            className="bg-amber-500/10 px-4 py-2 rounded-lg border border-amber-500/20 flex-row items-center hover:bg-amber-500/20 transition-all"
          >
            <Icon name="chef-hat" size={20} color="#F5A524" />
            <Text className="text-amber-500 font-bold ml-2">Modo KDS</Text>
          </TouchableOpacity>
          <View className="bg-(--color-pos-surface) p-2 rounded-lg border border-white/10 justify-center items-center h-10 w-10">
            <Icon name="format-list-bulleted" size={24} color="#F5A524" />
          </View>
        </View>
      </View>

      {/* Estado chips */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        className="mb-8 flex-none"
        contentContainerClassName="gap-2 py-1"
      >
        {FILTER_ESTADOS.map((e) => {
          const ec = getEstadoColor(e || undefined);
          const active = estado === e;
          return (
            <TouchableOpacity
              key={e}
              className={`flex-row items-center gap-2 py-2 px-4 rounded-full border ${active ? 'bg-amber-500/10 border-amber-500/20' : 'bg-(--color-pos-surface) border-white/10'}`}
              onPress={() => patchState({ estado: e })}
            >
              {e !== '' && (
                <Icon name={ec.icon} size={14} color={active ? '#F5A524' : '#64748B'} />
              )}
              <Text className={`text-sm ${active ? 'text-amber-500 font-bold' : 'text-slate-500 font-medium'}`}>
                {ESTADO_LABELS[e]}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* Date filters */}
      <View className={`flex-row gap-4 mb-2 ${isMobile ? 'flex-col' : ''}`}>
        <Input
          label="Desde"
          value={from}
          onChangeText={(value) => patchState({ from: value })}
          placeholder="YYYY-MM-DD"
          containerStyle={{ flex: 1, minWidth: 140 }}
          size="sm"
          leftIcon={<Icon name="calendar" size={16} color="#64748B" />}
        />
        <Input
          label="Hasta"
          value={to}
          onChangeText={(value) => patchState({ to: value })}
          placeholder="YYYY-MM-DD"
          containerStyle={{ flex: 1, minWidth: 140 }}
          size="sm"
          leftIcon={<Icon name="calendar" size={16} color="#64748B" />}
        />
      </View>

      {/* Pagination info */}
      {result && (
        <View className="flex-row justify-between items-center mb-8 flex-wrap gap-2">
          <Text className="text-sm text-slate-500">
            {result.total} órdenes encontradas
          </Text>
          <View className="flex-row items-center gap-4">
            <TouchableOpacity
              className={`flex-row items-center gap-1 py-2 px-4 rounded-lg bg-(--color-pos-surface) border border-white/10 ${page <= 1 ? 'opacity-40' : ''}`}
              onPress={() => page > 1 && fetchData(page - 1)}
              disabled={page <= 1}
            >
              <Icon name="chevron-left" size={18} color={page <= 1 ? '#64748B' : '#F1F5F9'} />
            </TouchableOpacity>
            <Text className="text-sm text-slate-400 font-semibold">
              {result.page} / {result.totalPages}
            </Text>
            <TouchableOpacity
              className={`flex-row items-center gap-1 py-2 px-4 rounded-lg bg-(--color-pos-surface) border border-white/10 ${page >= (result?.totalPages ?? 1) ? 'opacity-40' : ''}`}
              onPress={() =>
                page < (result?.totalPages ?? 1) && fetchData(page + 1)
              }
              disabled={page >= (result?.totalPages ?? 1)}
            >
              <Icon name="chevron-right" size={18} color={page >= (result?.totalPages ?? 1) ? '#64748B' : '#F1F5F9'} />
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Loading / Error / Empty */}
      {loading && <ListSkeleton count={5} />}
      {error ? (
        <View className="flex-row items-center gap-3 bg-(--color-pos-danger)/10 p-5 rounded-2xl mb-8 border border-(--color-pos-danger)/20">
          <Icon name="alert-circle-outline" size={18} color="#F43F5E" />
          <Text className="text-(--color-pos-danger) font-medium flex-1">{error}</Text>
        </View>
      ) : null}
      {!loading && !error && ordenes.length === 0 && (
        <View className="items-center py-20 gap-4">
          <Icon name="clipboard-text-off-outline" size={48} color="#64748B" />
          <Text className="text-lg text-slate-500 font-medium">No se encontraron órdenes</Text>
        </View>
      )}

      {/* Order cards (Standard View) - Now using Masonry too, or just List */}
      {!loading && ordenes.length > 0 && (
        <View className="flex-col gap-4">
          {ordenes.map((orden) => {
            const ec = getEstadoColor(orden.estadoOrden);
            const total = getOrdenTotal(orden);

            return (
              <Card
                key={orden.ordenId}
                onPress={() =>
                  router.push(`/orden-detalle?ordenId=${orden.ordenId}`)
                }
                padding="md"
              >
                {/* Header */}
                <View className="flex-row justify-between items-center mb-2">
                  <View className="flex-row items-center gap-3">
                    <Text className="text-lg font-bold text-white">#{orden.ordenId}</Text>
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
                  <Text className="text-lg font-black text-amber-500">${formatCurrency(total)}</Text>
                </View>

                {/* Meta */}
                <View className="flex-row gap-6 mb-2">
                  <View className="flex-row items-center gap-1.5">
                    <Icon name="tag-outline" size={14} color="#64748B" />
                    <Text className="text-sm text-slate-500 capitalize">{orden.tipoPedido}</Text>
                  </View>
                  <View className="flex-row items-center gap-1.5">
                    <Icon name="calendar-outline" size={14} color="#64748B" />
                    <Text className="text-sm text-slate-500">
                      {formatDate(orden.fechaOrden)}
                    </Text>
                  </View>
                </View>

                {/* Products preview */}
                {orden.productos && orden.productos.length > 0 && (
                  <View className="p-3 bg-black/20 rounded-lg mt-1">
                    {orden.productos.slice(0, 3).map((p) => (
                      <Text
                        key={`${p.id ?? getProductoPreviewName(p)}-${p.cantidad ?? 1}`}
                        className="text-sm text-slate-400 py-0.5"
                      >
                        • {getProductoPreviewName(p)} x{p.cantidad}
                      </Text>
                    ))}
                    {orden.productos.length > 3 && (
                      <Text className="text-xs text-slate-500 italic mt-1">
                        +{orden.productos.length - 3} más...
                      </Text>
                    )}
                  </View>
                )}
              </Card>
            );
          })}
        </View>
      )}

      {/* Bottom pagination */}
      {result && result.totalPages > 1 && (
        <View className="flex-row items-center justify-center py-8 gap-4">
          <TouchableOpacity
            className={`flex-row items-center gap-2 py-3 px-6 rounded-xl bg-(--color-pos-surface) border border-white/10 ${page <= 1 ? 'opacity-40' : ''}`}
            onPress={() => page > 1 && fetchData(page - 1)}
            disabled={page <= 1}
          >
            <Icon name="chevron-left" size={18} color={page <= 1 ? '#64748B' : '#F1F5F9'} />
            <Text className={`text-sm font-medium ${page <= 1 ? 'text-slate-500' : 'text-white'}`}>Anterior</Text>
          </TouchableOpacity>
          <Text className="text-sm text-slate-400 font-semibold px-4">
            Pág {page} de {result.totalPages}
          </Text>
          <TouchableOpacity
            className={`flex-row items-center gap-2 py-3 px-6 rounded-xl bg-(--color-pos-surface) border border-white/10 ${page >= result.totalPages ? 'opacity-40' : ''}`}
            onPress={() => page < result.totalPages && fetchData(page + 1)}
            disabled={page >= result.totalPages}
          >
            <Text className={`text-sm font-medium ${page >= result.totalPages ? 'text-slate-500' : 'text-white'}`}>Siguiente</Text>
            <Icon name="chevron-right" size={18} color={page >= result.totalPages ? '#64748B' : '#F1F5F9'} />
          </TouchableOpacity>
        </View>
      )}
    </PageContainer>
  );
}
