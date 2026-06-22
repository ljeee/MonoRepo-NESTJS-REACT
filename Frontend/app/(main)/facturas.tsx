import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { TouchableOpacity, RefreshControl } from 'react-native';
import { View, Text, ScrollView } from '../../tw';
import { useFacturasRango, calcStats, useApi, getLocalDateString } from '@/src/shared';
import type { DenominacionesMap } from '@/src/shared';
import { buildCombinedBalanceCsv, downloadCsv } from '../../utils/csvExport';
import { exportFacturasPdf } from '../../utils/exportData';
import { FacturaCard, StatsHeader, FacturaItem } from '../../components/facturas/FacturaShared';
import PageContainer from '../../components/ui/PageContainer';
import PageHeader from '../../components/ui/PageHeader';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import Icon from '../../components/ui/Icon';
import { ListSkeleton } from '../../components/ui/SkeletonLoader';
import { MethodFilterChips, MethodFilterValue, DateRangeFilter } from '../../components/ui';
import { useBreakpoint } from '../../styles/responsive';

// ─── Tipos de filtro local ──────────────────────────────────────────────────

type EstadoFilter = 'todas' | 'pendiente' | 'pagado';

const ESTADO_TABS: { key: EstadoFilter; label: string; icon: string; color: string }[] = [
  { key: 'todas',     label: 'Todas',      icon: 'format-list-bulleted', color: '#94A3B8' },
  { key: 'pendiente', label: 'Pendientes', icon: 'clock-outline',        color: '#F5A524' },
  { key: 'pagado',    label: 'Pagadas',    icon: 'check-circle-outline', color: '#10B981' },
];

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function FacturasRangoScreen() {
  const { isMobile } = useBreakpoint();
  const api = useApi();
  const {
    data, loading, error,
    from, to, setFrom, setTo,
    fetchData, search,
    updateEstado, updateFactura, deleteFactura,
  } = useFacturasRango(5000);

  const [localPage, setLocalPage] = useState(1);
  const [refreshing, setRefreshing] = useState(false);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchData();
    setRefreshing(false);
  }, [fetchData]);

  const itemsPerPage = 50;

  const [updating, setUpdating] = useState<number | null>(null);
  const [hasSearched, setHasSearched] = useState(false);

  // ── Filtros locales ──
  const [estadoFilter, setEstadoFilter] = useState<EstadoFilter>('todas');
  const [metodoFilter, setMetodoFilter] = useState<MethodFilterValue>('todos');
  const [nombreFilter, setNombreFilter] = useState('');

  // ── Inicializar fechas con hoy al montar ──
  useEffect(() => {
    const hoy = getLocalDateString();
    if (!from) setFrom(hoy);
    if (!to) setTo(hoy);
  }, []);


  const handleChangeEstado = useCallback(async (
    facturaId: number,
    nuevoEstado: string,
    metodo?: string,
    pagoEfectivo?: number,
    pagoTransferencia?: number,
    denominaciones?: DenominacionesMap,
    cambioDenominaciones?: DenominacionesMap,
  ) => {
    setUpdating(facturaId);
    try {
      if (nuevoEstado === 'pagado' && metodo) {
        await updateFactura(facturaId, { estado: 'pagado', metodo, pagoEfectivo, pagoTransferencia, denominaciones, cambioDenominaciones });
      } else {
        await updateEstado(facturaId, nuevoEstado);
      }
    } catch { /* silent */ }
    setUpdating(null);
  }, [updateEstado, updateFactura]);

  const handleUpdateTotal = useCallback(async (facturaId: number, newTotal: number) => {
    await updateFactura(facturaId, { total: newTotal });
  }, [updateFactura]);

  const handleDeleteFactura = useCallback(async (facturaId: number): Promise<boolean> => {
    return deleteFactura(facturaId);
  }, [deleteFactura]);

  const handleAbono = useCallback(async (facturaId: number, monto: number, denominaciones?: DenominacionesMap, cambioDenominaciones?: DenominacionesMap) => {
    setUpdating(facturaId);
    try {
      await api.facturas.abono(facturaId, monto, denominaciones, cambioDenominaciones);
      // Refresh current search results
      search(from, to);
    } finally {
      setUpdating(null);
    }
  }, [api, from, to, search]);

  const isPagado = (f: FacturaItem) => f.estado === 'pagado' || f.estado === 'pagada';

  const metodoCounts = useMemo(() => ({
    todos:         data.length,
    efectivo:      data.filter(f => f.metodo === 'efectivo' && isPagado(f)).length,
    transferencia: data.filter(f => f.metodo === 'transferencia' && isPagado(f)).length,
    mixto:         data.filter(f => f.metodo === 'efectivo_transferencia' && isPagado(f)).length,
  }), [data]);

  // ── Filtrado local en cliente ──
  const filteredData = useMemo(() => {
    let result = data;
    if (estadoFilter !== 'todas') {
      result = result.filter(f => f.estado === estadoFilter);
    }
    if (metodoFilter !== 'todos') {
      const target = metodoFilter === 'mixto' ? 'efectivo_transferencia' : metodoFilter;
      result = result.filter(f => f.metodo === target && isPagado(f));
    }
    if (nombreFilter.trim()) {
      const q = nombreFilter.trim().toLowerCase();
      result = result.filter(f =>
        (f.clienteNombre || '').toLowerCase().includes(q)
      );
    }
    return result;
  }, [data, estadoFilter, metodoFilter, nombreFilter]);

  const computedStats = useMemo(() => calcStats(filteredData as any), [filteredData]);

  const totalLocalPages = Math.ceil(filteredData.length / itemsPerPage) || 1;

  const paginatedData = useMemo(() => {
    const start = (localPage - 1) * itemsPerPage;
    return filteredData.slice(start, start + itemsPerPage);
  }, [filteredData, localPage]);

  const handleExportPdf = useCallback(() => {
    if (filteredData.length === 0) return;
    exportFacturasPdf(filteredData, `${from || 'inicio'} a ${to || 'fin'}`);
  }, [filteredData, from, to]);

  const handleExportContabilidad = useCallback(async () => {
    if (filteredData.length === 0) return;
    const csv = await buildCombinedBalanceCsv(filteredData, []);
    downloadCsv(csv, `contabilidad_${from || 'inicio'}_${to || 'fin'}.csv`);
  }, [filteredData, from, to]);

  // ── Pagination bar ──────────────────────────────────────────────────────────
  const PaginationBar = totalLocalPages > 1 ? (
    <View style={{ flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 12, paddingVertical: 20 }}>
      <TouchableOpacity
        onPress={() => setLocalPage(p => Math.max(1, p - 1))}
        disabled={localPage <= 1 || loading}
        style={{
          paddingHorizontal: 16, paddingVertical: 8,
          borderRadius: 12,
          backgroundColor: localPage <= 1 ? 'rgba(255,255,255,0.05)' : 'rgba(245,165,36,0.15)',
          borderWidth: 1,
          borderColor: localPage <= 1 ? 'rgba(255,255,255,0.08)' : 'rgba(245,165,36,0.3)',
          opacity: localPage <= 1 ? 0.4 : 1,
        }}
      >
        <Text style={{ color: '#F5A524', fontFamily: 'SpaceGrotesk-Bold', fontSize: 13 }}>← Anterior</Text>
      </TouchableOpacity>

      <View style={{ alignItems: 'center' }}>
        <Text style={{ color: '#F8FAFC', fontFamily: 'SpaceGrotesk-Bold', fontSize: 14 }}>
          Página {localPage} de {totalLocalPages}
        </Text>
        <Text style={{ color: '#64748B', fontFamily: 'Outfit', fontSize: 11, marginTop: 2 }}>
          {filteredData.length} facturas filtradas
        </Text>
      </View>

      <TouchableOpacity
        onPress={() => setLocalPage(p => Math.min(totalLocalPages, p + 1))}
        disabled={localPage >= totalLocalPages || loading}
        style={{
          paddingHorizontal: 16, paddingVertical: 8,
          borderRadius: 12,
          backgroundColor: localPage >= totalLocalPages ? 'rgba(255,255,255,0.05)' : 'rgba(245,165,36,0.15)',
          borderWidth: 1,
          borderColor: localPage >= totalLocalPages ? 'rgba(255,255,255,0.08)' : 'rgba(245,165,36,0.3)',
          opacity: localPage >= totalLocalPages ? 0.4 : 1,
        }}
      >
        <Text style={{ color: '#F5A524', fontFamily: 'SpaceGrotesk-Bold', fontSize: 13 }}>Siguiente →</Text>
      </TouchableOpacity>
    </View>
  ) : null;

  return (
    /*
     * scrollable={false} + ScrollView from ../../tw inside is the proven pattern.
     * FlatList className="flex-1" (old code) was silently ignored — FlatList is a
     * raw RN component, not a tw wrapper, so className never became style={{ flex:1 }}.
     * Result: FlatList had no height → invisible. Fixed by using ScrollView from tw,
     * which converts className via useCssElement (same as all other working list screens).
     */
    <PageContainer scrollable={false} contentContainerClassName="flex-1">
      <ScrollView
        className="flex-1"
        contentContainerClassName="pb-4"
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
          title="Facturas por Fechas"
          subtitle="Facturación"
          icon="calendar-range"
          rightContent={
            <Button
              title=""
              icon="refresh"
              variant="ghost"
              size="sm"
              onPress={() => fetchData()}
            />
          }
        />


        {/* ── Filtro de fechas ────────────────────────────────────── */}
        <DateRangeFilter
          from={from}
          to={to}
          onFromChange={setFrom}
          onToChange={setTo}
          onSearch={(f, t) => {
            setFrom(f);
            setTo(t);
            search(f, t);
            setHasSearched(true);
            setEstadoFilter('todas');
            setMetodoFilter('todos');
            setNombreFilter('');
            setLocalPage(1);
          }}
          loading={loading}
        />

        {/* ── Filtros locales + Exportar (solo post-búsqueda) ─────── */}
        {hasSearched && !loading && (
          <View
            style={{
              backgroundColor: 'rgba(255,255,255,0.03)',
              borderWidth: 1,
              borderColor: 'rgba(255,255,255,0.07)',
              borderRadius: 16,
              padding: 12,
              marginBottom: 16,
              gap: 10,
            }}
          >
            {/* Fila 1: chips de estado */}
            <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
              {ESTADO_TABS.map((tab) => {
                const isActive = estadoFilter === tab.key;
                return (
                  <TouchableOpacity
                    key={tab.key}
                    onPress={() => { setEstadoFilter(tab.key); setLocalPage(1); }}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 5,
                      paddingHorizontal: 12,
                      paddingVertical: 6,
                      borderRadius: 20,
                      borderWidth: 1,
                      backgroundColor: isActive ? 'rgba(245,165,36,0.15)' : 'rgba(255,255,255,0.04)',
                      borderColor: isActive ? 'rgba(245,165,36,0.35)' : 'rgba(255,255,255,0.08)',
                    }}
                  >
                    <Icon name={tab.icon} size={12} color={isActive ? '#F5A524' : tab.color} />
                    <Text style={{
                      fontSize: 11, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 0.5,
                      color: isActive ? '#F5A524' : '#64748B',
                    }}>
                      {tab.label}
                    </Text>
                    {tab.key === 'todas' && (
                      <View style={{ backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 6, paddingHorizontal: 5, minWidth: 18, alignItems: 'center' }}>
                        <Text style={{ color: '#94A3B8', fontSize: 9, fontWeight: '900' }}>{data.length}</Text>
                      </View>
                    )}
                    {tab.key !== 'todas' && (
                      <View style={{ backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 6, paddingHorizontal: 5, minWidth: 18, alignItems: 'center' }}>
                        <Text style={{ color: '#94A3B8', fontSize: 9, fontWeight: '900' }}>
                          {data.filter(f => f.estado === tab.key).length}
                        </Text>
                      </View>
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Fila 1b: chips por método de pago (incluye Mixto) */}
            <MethodFilterChips value={metodoFilter} onChange={setMetodoFilter} counts={metodoCounts} includePendiente={false} />

            {/* Fila 2: buscador por nombre */}
            <Input
              placeholder="Buscar por nombre de cliente..."
              value={nombreFilter}
              onChangeText={(t) => { setNombreFilter(t); setLocalPage(1); }}
              size="sm"
              containerStyle={{ marginBottom: 0 }}
              leftIcon={<Icon name="account-search-outline" size={15} color="#475569" />}
            />

            {/* Fila 3: botones exportar */}
            <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
              <Button
                title="Exportar PDF"
                icon="file-pdf-outline"
                variant="secondary"
                size="sm"
                onPress={handleExportPdf}
                disabled={filteredData.length === 0}
                className="bg-purple-600/20 border-purple-500/30"
              />
              <Button
                title="CSV Contable"
                icon="table-large"
                variant="secondary"
                size="sm"
                onPress={handleExportContabilidad}
                disabled={filteredData.length === 0}
                className="bg-emerald-600/20 border-emerald-500/30"
              />
              {/* Contador de resultados filtrados */}
              {filteredData.length !== data.length && (
                <View style={{ flex: 1, justifyContent: 'center', alignItems: 'flex-end' }}>
                  <Text style={{ color: '#64748B', fontSize: 10, fontWeight: '700', textTransform: 'uppercase' }}>
                    {filteredData.length} de {data.length} resultados
                  </Text>
                </View>
              )}
            </View>
          </View>
        )}

        {/* Stats */}
        {data.length > 0 && (
          <StatsHeader
            stats={computedStats}
            periodLabel={`Mostrando ${filteredData.length} de ${data.length} facturas`}
          />
        )}

        {/* Error */}
        {error && (
          <View className="flex-row items-center gap-2 bg-(--color-pos-danger)/10 p-4 rounded-xl mb-8 border border-(--color-pos-danger)/20">
            <Icon name="alert-circle-outline" size={18} color="#F43F5E" />
            <Text className="text-(--color-pos-danger) flex-1">{error}</Text>
          </View>
        )}

        {/* Loading skeleton */}
        {loading && <ListSkeleton count={4} />}

        {/* Empty state */}
        {!loading && !error && paginatedData.length === 0 && (
          <View className="items-center justify-center py-20 gap-4">
            <Icon
              name={from && to ? 'email-off-outline' : 'calendar-search'}
              size={48}
              color="#64748B"
            />
            <Text className="text-white font-black text-xl text-center">
              {from && to
                ? (nombreFilter || estadoFilter !== 'todas')
                  ? 'Sin resultados con estos filtros'
                  : 'Sin facturas en este rango'
                : 'Selecciona fechas para buscar'}
            </Text>
            <Text className="text-(--color-pos-text-muted) text-center">
              {from && to
                ? (nombreFilter || estadoFilter !== 'todas')
                  ? 'Prueba con otros filtros de nombre o estado.'
                  : 'No se encontraron facturas en el período.'
                : 'Ingresa las fechas y presiona Buscar.'}
            </Text>
          </View>
        )}

        {/* ── Items grid — same flex-wrap pattern as facturas-dia.tsx ────────── */}
        {!loading && paginatedData.length > 0 && (
          <View className="flex-row flex-wrap justify-between gap-y-4">
            {paginatedData.map((item: FacturaItem, idx: number) => {
              const isLastOddDesktop = !isMobile && paginatedData.length % 2 === 1 && idx === paginatedData.length - 1;
              return (
                <View
                  key={item.facturaId?.toString() || idx.toString()}
                  className={isMobile ? 'w-full' : isLastOddDesktop ? 'w-full' : 'w-[48.5%]'}
                >
                  <View className="flex-1 pb-4">
                    <FacturaCard
                      item={item}
                      isUpdating={updating === item.facturaId}
                      onToggleEstado={handleChangeEstado}
                      onUpdateTotal={handleUpdateTotal}
                      onUpdate={updateFactura}
                      onDelete={handleDeleteFactura}
                      onAbono={handleAbono}
                    />
                  </View>
                </View>
              );
            })}
          </View>
        )}

        {/* Pagination */}
        {PaginationBar}

      </ScrollView>
    </PageContainer>
  );
}
