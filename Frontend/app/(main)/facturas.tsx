import React, { useCallback, useMemo, useState } from 'react';
import { FlatList, TouchableOpacity } from 'react-native';
import { View, Text } from '../../tw';
import { useFacturasRango, calcStats } from '@monorepo/shared';
import { buildCombinedBalanceCsv, downloadCsv } from '../../utils/csvExport';
import { exportFacturasPdf } from '../../utils/exportData';
import { validateFlexibleDateRange } from '@monorepo/shared';
import { FacturaCard, StatsHeader, FacturaItem } from '../../components/facturas/FacturaShared';
import {
  PageContainer,
  PageHeader,
  Button,
  Input,
  Icon,
  ListSkeleton,
} from '../../components/ui';
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
  const {
    data, loading, error,
    from, to, setFrom, setTo,
    fetchData, search,
    stats, updateEstado, updateFactura, deleteFactura,
  } = useFacturasRango({ limit: 5000 });

  const [localPage, setLocalPage] = useState(1);
  const itemsPerPage = 50;

  const [updating, setUpdating] = useState<number | null>(null);
  const [filterError, setFilterError] = useState('');
  const [hasSearched, setHasSearched] = useState(false);

  // ── Filtros locales ──
  const [estadoFilter, setEstadoFilter] = useState<EstadoFilter>('todas');
  const [nombreFilter, setNombreFilter] = useState('');

  const handleSearch = useCallback(() => {
    const { from: fromParsed, to: toParsed, error } = validateFlexibleDateRange(from, to);
    if (error) {
      setFilterError(error);
      return;
    }
    setFilterError('');
    setFrom(fromParsed);
    setTo(toParsed);
    search(fromParsed, toParsed);
    setHasSearched(true);
    // Limpiar filtros locales al hacer nueva búsqueda
    setEstadoFilter('todas');
    setNombreFilter('');
    setLocalPage(1);
  }, [from, to, setFrom, setTo, search]);

  const handleChangeEstado = useCallback(async (facturaId: number, nuevoEstado: string, metodo?: string) => {
    setUpdating(facturaId);
    try {
      if (nuevoEstado === 'pagado' && metodo) {
         await updateFactura(facturaId, { estado: 'pagado', metodo });
      } else {
         await updateEstado(facturaId, nuevoEstado);
      }
      setUpdating(null);
    } catch {
      setUpdating(null);
    }
  }, [updateEstado, updateFactura]);

  const handleUpdateTotal = useCallback(async (facturaId: number, newTotal: number) => {
    await updateFactura(facturaId, { total: newTotal });
  }, [updateFactura]);

  const handleDeleteFactura = useCallback(async (facturaId: number): Promise<boolean> => {
    return deleteFactura(facturaId);
  }, [deleteFactura]);

  // ── Filtrado local en cliente ──
  const filteredData = useMemo(() => {
    let result = data;
    if (estadoFilter !== 'todas') {
      result = result.filter(f => f.estado === estadoFilter);
    }
    if (nombreFilter.trim()) {
      const q = nombreFilter.trim().toLowerCase();
      result = result.filter(f =>
        (f.clienteNombre || '').toLowerCase().includes(q)
      );
    }
    return result;
  }, [data, estadoFilter, nombreFilter]);

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

  const renderFacturaItem = useCallback(({ item }: { item: FacturaItem }) => (
    <View className="flex-1 pb-4">
      <FacturaCard
        item={item}
        isUpdating={updating === item.facturaId}
        onToggleEstado={handleChangeEstado}
        onUpdateTotal={handleUpdateTotal}
        onUpdate={updateFactura}
        onDelete={handleDeleteFactura}
      />
    </View>
  ), [handleChangeEstado, handleUpdateTotal, handleDeleteFactura, updating]);

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
    <PageContainer scrollable={false} contentContainerClassName="flex-1">
      <FlatList
        data={paginatedData}
        className="flex-1"
        keyExtractor={(item: FacturaItem, idx: number) => item.facturaId?.toString() || idx.toString()}
        key={isMobile ? 'col_1' : 'col_2'}
        numColumns={isMobile ? 1 : 2}
        contentContainerClassName="pb-4"
        columnWrapperStyle={!isMobile ? { gap: 16 } : undefined}
        ListHeaderComponent={
          <>
            <PageHeader
              title="Facturas por Fechas"
              subtitle="Facturación"
              icon="calendar-range"
              rightContent={
                <Button
                  title="Refrescar"
                  icon="refresh"
                  variant="ghost"
                  size="sm"
                  onPress={() => fetchData()}
                />
              }
            />

            {/* ── Filtro de fechas ────────────────────────────────────── */}
            <View className="flex-row gap-4 mb-4 flex-wrap items-end">
              <Input
                label="Desde"
                value={from}
                onChangeText={setFrom}
                placeholder="2025-01-01"
                containerStyle={{ flex: 1, minWidth: 140, marginBottom: 0 }}
                size="sm"
                leftIcon={<Icon name="calendar" size={16} color="#64748B" />}
              />
              <Input
                label="Hasta"
                value={to}
                onChangeText={setTo}
                placeholder="2026-12-31"
                containerStyle={{ flex: 1, minWidth: 140, marginBottom: 0 }}
                size="sm"
                leftIcon={<Icon name="calendar" size={16} color="#64748B" />}
              />
              <Button
                title={loading ? '...' : 'Buscar'}
                icon="magnify"
                variant="primary"
                size="sm"
                onPress={handleSearch}
                disabled={!from || !to || loading}
                loading={loading}
              />
            </View>

            {filterError ? (
              <View className="flex-row items-center gap-2 bg-(--color-pos-danger)/10 p-4 rounded-xl mb-4 border border-(--color-pos-danger)/20">
                <Icon name="alert-circle-outline" size={14} color="#F43F5E" />
                <Text className="text-(--color-pos-danger) flex-1">{filterError}</Text>
              </View>
            ) : null}

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

            {/* Loading */}
            {loading && <ListSkeleton count={4} />}
          </>
        }
        ListFooterComponent={PaginationBar}
        ListEmptyComponent={
          !loading && !error ? (
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
          ) : null}
        renderItem={renderFacturaItem}
      />
    </PageContainer>
  );
}
