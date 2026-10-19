import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useFacturaActions } from '../../hooks/use-factura-actions';
import { usePaginaLocal } from '../../hooks/use-pagina-local';
import { PaginadorLocal } from '../../components/contabilidad/PaginadorLocal';
import { View, Text, ScrollView } from '../../tw';
import { useFacturasRango, calcStats, getLocalDateString, SIN_LIMITE } from '@/src/shared';
import { buildCombinedBalanceCsv, downloadCsv } from '../../utils/csvExport';
import { exportFacturasPdf } from '../../utils/exportData';
import { FacturaCard, StatsHeader, FacturaItem } from '../../components/facturas/FacturaShared';
import PageContainer from '../../components/ui/PageContainer';
import PageHeader from '../../components/ui/PageHeader';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import Icon from '../../components/ui/Icon';
import { ListSkeleton } from '../../components/ui/SkeletonLoader';
import { MethodFilterValue, DateRangeFilter, matchesMetodoFilter, PosRefreshControl, InlineError, CardGrid } from '../../components/ui';
import { FacturaToolbar } from '../../components/facturas/FacturaToolbar';

// ─── Tipos de filtro local ──────────────────────────────────────────────────


// ─── Screen ───────────────────────────────────────────────────────────────────

export default function FacturasRangoScreen() {
  const [sortAsc, setSortAsc] = useState(false);
  const {
    data, loading, error,
    from, to, setFrom, setTo,
    fetchData, search,
    updateEstado, updateFactura, deleteFactura,
  } = useFacturasRango(SIN_LIMITE);

  const [refreshing, setRefreshing] = useState(false);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchData();
    setRefreshing(false);
  }, [fetchData]);

  const [hasSearched, setHasSearched] = useState(false);

  // ── Filtros locales ──
  const [metodoFilter, setMetodoFilter] = useState<MethodFilterValue>('todos');
  const [nombreFilter, setNombreFilter] = useState('');

  // ── Inicializar fechas con hoy al montar ──
  useEffect(() => {
    const hoy = getLocalDateString();
    if (!from) setFrom(hoy);
    if (!to) setTo(hoy);
  }, []);


  const { updatingId: updating, accionesFactura, onUpdate } = useFacturaActions({
    updateEstado,
    updateFactura,
    deleteFactura,
    recargar: () => search(from, to),
  });

  const isPagado = (f: FacturaItem) => f.estado === 'pagado' || f.estado === 'pagada';

  const nameFiltered = useMemo(() => {
    if (!nombreFilter.trim()) return data;
    const q = nombreFilter.trim().toLowerCase();
    return data.filter(f => (f.clienteNombre || '').toLowerCase().includes(q));
  }, [data, nombreFilter]);

  const metodoCounts = useMemo(() => ({
    todos:         nameFiltered.length,
    efectivo:      nameFiltered.filter(f => matchesMetodoFilter(f, 'efectivo') && isPagado(f)).length,
    transferencia: nameFiltered.filter(f => matchesMetodoFilter(f, 'transferencia') && isPagado(f)).length,
    mixto:         nameFiltered.filter(f => matchesMetodoFilter(f, 'mixto') && isPagado(f)).length,
    pendiente:     nameFiltered.filter(f => f.estado === 'pendiente' || f.estado === 'parcial').length,
  }), [nameFiltered]);

  // ── Filtrado local en cliente ──
  const filteredData = useMemo(() => {
    if (metodoFilter === 'todos') return nameFiltered;
    if (metodoFilter === 'pendiente') {
      return nameFiltered.filter(f => f.estado === 'pendiente' || f.estado === 'parcial');
    }
    return nameFiltered.filter(f => matchesMetodoFilter(f, metodoFilter) && isPagado(f));
  }, [nameFiltered, metodoFilter]);

  const computedStats = useMemo(() => calcStats(filteredData as any, metodoFilter === 'todos' ? undefined : metodoFilter), [filteredData, metodoFilter]);

  // Todo el rango viene del servidor (sin tope). Se ordena TODO y la paginación (solo visual) reparte lo ordenado.
  const sortedData = useMemo(() => (sortAsc ? [...filteredData].reverse() : filteredData), [filteredData, sortAsc]);
  const pagina = usePaginaLocal(sortedData, 60);

  const handleExportPdf = useCallback(() => {
    if (filteredData.length === 0) return;
    exportFacturasPdf(filteredData, `${from || 'inicio'} a ${to || 'fin'}`);
  }, [filteredData, from, to]);

  const handleExportContabilidad = useCallback(async () => {
    if (filteredData.length === 0) return;
    const csv = await buildCombinedBalanceCsv(filteredData, []);
    downloadCsv(csv, `contabilidad_${from || 'inicio'}_${to || 'fin'}.csv`);
  }, [filteredData, from, to]);

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
          <PosRefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
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
            setMetodoFilter('todos');
            setNombreFilter('');
          }}
          loading={loading}
        />

        {/* ── Filtros locales + Exportar (solo post-búsqueda) ─────── */}
        {hasSearched && !loading && (
          <FacturaToolbar
            metodo={{ value: metodoFilter, onChange: setMetodoFilter, counts: metodoCounts }}
            busqueda={{ value: nombreFilter, onChange: setNombreFilter }}
            orden={{ asc: sortAsc, onToggle: () => setSortAsc((prev) => !prev) }}
            exportar={{ onPdf: handleExportPdf, onCsv: handleExportContabilidad, disabled: filteredData.length === 0, pdfLabel: 'Exportar PDF', csvLabel: 'CSV Contable' }}
            resultados={filteredData.length !== data.length ? `${filteredData.length} de ${data.length} resultados` : undefined}
          />
        )}

        {/* Stats */}
        {data.length > 0 && (
          <StatsHeader
            stats={computedStats}
            periodLabel={`Mostrando ${filteredData.length} de ${data.length} facturas`}
          />
        )}

        {/* Error */}
        <InlineError message={error} className="mb-4" />

        {/* Loading skeleton */}
        {loading && <ListSkeleton count={4} />}

        {/* Empty state */}
        {!loading && !error && filteredData.length === 0 && (
          <View className="items-center justify-center py-20 gap-4">
            <Icon
              name={from && to ? 'email-off-outline' : 'calendar-search'}
              size={48}
              color="#64748B"
            />
            <Text className="text-white font-black text-xl text-center">
              {from && to
                ? (nombreFilter || metodoFilter !== 'todos')
                  ? 'Sin resultados con estos filtros'
                  : 'Sin facturas en este rango'
                : 'Selecciona fechas para buscar'}
            </Text>
            <Text className="text-(--color-pos-text-muted) text-center">
              {from && to
                ? (nombreFilter || metodoFilter !== 'todos')
                  ? 'Prueba con otros filtros de nombre o método.'
                  : 'No se encontraron facturas en el período.'
                : 'Ingresa las fechas y presiona Buscar.'}
            </Text>
          </View>
        )}

        {/* ── Items grid — Equal-height card rows ────────── */}
        {!loading && pagina.items.length > 0 && (
          <View className="pb-4">
            <CardGrid
              kind="factura"
              data={pagina.items}
              keyExtractor={(item, i) => item.facturaId?.toString() ?? String(i)}
              renderItem={(item) => (
                <FacturaCard
                  item={item}
                  isUpdating={updating === item.facturaId}
                  activeFilter={metodoFilter}
                  {...accionesFactura}
                  onUpdate={onUpdate}
                />
              )}
            />
          </View>
        )}

        {/* Paginación visual sobre el conjunto completo */}
        {!loading && <PaginadorLocal pagina={pagina} etiqueta="facturas" />}

      </ScrollView>
    </PageContainer>
  );
}
