import React, { useEffect, useState } from 'react';
import { useFacturaActions } from '../../hooks/use-factura-actions';

import { Text, View, TouchableOpacity } from '../../tw';
import { useFacturasDia, calcStats, useOrdenesSocket, bogotaToday } from '@/src/shared';
import { useResumenGeneral } from '../../hooks/use-resumen-general';
import { ResumenDiaCompleto } from '../../components/contabilidad/ResumenDiaCompleto';
import { buildCombinedBalanceCsv, downloadCsv } from '../../utils/csvExport';
import { exportFacturasPdf } from '../../utils/exportData';
import { FacturaCard, StatsHeader, FacturaItem } from '../../components/facturas/FacturaShared';
import PageContainer from '../../components/ui/PageContainer';
import PageHeader from '../../components/ui/PageHeader';
import Button from '../../components/ui/Button';
import { ListSkeleton } from '../../components/ui/SkeletonLoader';
import Icon from '../../components/ui/Icon';
import { MethodFilterValue, matchesMetodoFilter, InlineError, CardGrid } from '../../components/ui';
import { useBreakpoint } from '../../styles/responsive';
import { useAuth } from '../../contexts/AuthContext';
import { getBaseUrl } from '../../services/api';
import { PosRefreshControl } from '../../components/ui/PosRefreshControl';
import { FacturaToolbar } from '../../components/facturas/FacturaToolbar';

export default function FacturasDiaScreen() {
  const { isMobile } = useBreakpoint();
  const { data, loading, error, refetch, updateEstado, updateFactura } = useFacturasDia();
  const [searchQuery, setSearchQuery] = useState('');
  const [filterMethod, setFilterMethod] = useState<MethodFilterValue>('todos');

  // Sin esto la pantalla solo se actualizaba con refresh manual: un abono o
  // cobro hecho desde otra pantalla/dispositivo no se reflejaba aquí.
  // Consolidado del día: lo mismo que balance del día y cierre de caja (servidor, definiciones únicas).
  const hoy = bogotaToday();
  const [versionResumen, setVersionResumen] = useState(0);
  const { data: resumen } = useResumenGeneral(hoy, hoy, versionResumen);
  const [verConsolidado, setVerConsolidado] = useState(false);
  useEffect(() => {
    setVersionResumen((v) => v + 1);
  }, [data]);

  const { user, token } = useAuth();
  useOrdenesSocket(getBaseUrl(), user?.roles?.[0] || 'cajero', refetch, token);

  const { updatingId: updating, accionesFactura, onUpdate } = useFacturaActions({ updateEstado, updateFactura, recargar: refetch });

  const handleExportPdf = () => {
    if (!data || data.length === 0) return;
    exportFacturasPdf(data, 'Hoy');
  };

  const handleExportContabilidad = async () => {
    if (!data || data.length === 0) return;
    const csv = await buildCombinedBalanceCsv(data, []);
    const today = (() => {
      const now = new Date();
      return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    })();
    downloadCsv(csv, `contabilidad_${today}.csv`);
  };

  const searchFiltered = (data || []).filter((f: FacturaItem) =>
    !searchQuery || (f.clienteNombre && f.clienteNombre.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const isPagado = (f: FacturaItem) => f.estado === 'pagado' || f.estado === 'pagada';
  const methodCounts = {
    todos:         searchFiltered.length,
    efectivo:      searchFiltered.filter(f => matchesMetodoFilter(f, 'efectivo') && isPagado(f)).length,
    transferencia: searchFiltered.filter(f => matchesMetodoFilter(f, 'transferencia') && isPagado(f)).length,
    mixto:         searchFiltered.filter(f => matchesMetodoFilter(f, 'mixto') && isPagado(f)).length,
    pendiente:     searchFiltered.filter(f => f.estado === 'pendiente' || f.estado === 'parcial').length,
  };

  const [sortAsc, setSortAsc] = useState(false);


  const filteredData = searchFiltered.filter((f: FacturaItem) => {
    if (filterMethod === 'todos') return true;
    if (filterMethod === 'pendiente') return f.estado === 'pendiente' || f.estado === 'parcial';
    return matchesMetodoFilter(f, filterMethod) && isPagado(f);
  });

  const sortedData = React.useMemo(() => {
    if (!sortAsc) return filteredData;
    return [...filteredData].reverse();
  }, [filteredData, sortAsc]);

  const computedStats = React.useMemo(() => calcStats(filteredData as any, filterMethod === 'todos' ? undefined : filterMethod), [filteredData, filterMethod]);

  return (
    <PageContainer
      refreshControl={
        <PosRefreshControl
          refreshing={loading}
          onRefresh={refetch}
        />
      }
    >
      <PageHeader
        title="Resumen del Día"
        subtitle="Facturas del día"
        icon="chart-bar"
        rightContent={
          <Button
            title={isMobile ? "" : "Refrescar"}
            icon="refresh"
            variant="ghost"
            size="sm"
            onPress={refetch}
          />
        }
      />


      {/* Consolidado del día (por método, por cuenta QR, productos, gastos) */}
      {!!resumen && (
        <View className="mb-6">
          <TouchableOpacity
            onPress={() => setVerConsolidado((v) => !v)}
            className="flex-row items-center justify-between px-4 py-3 rounded-2xl bg-white/5 border border-white/10"
          >
            <View className="flex-row items-center gap-2">
              <Icon name="chart-box-outline" size={18} color="#F5A524" />
              <Text className="text-white font-black uppercase text-xs tracking-widest">Consolidado del día</Text>
            </View>
            <Icon name={verConsolidado ? 'chevron-up' : 'chevron-down'} size={18} color="#94A3B8" />
          </TouchableOpacity>
          {verConsolidado && (
            <View className="mt-3">
              <ResumenDiaCompleto resumen={resumen} />
            </View>
          )}
        </View>
      )}

      {/* Stats */}
      {data && data.length > 0 && <StatsHeader stats={computedStats} periodLabel="Total del Día (Filtrado)" />}

        <FacturaToolbar
          metodo={{ value: filterMethod, onChange: setFilterMethod, counts: methodCounts }}
          busqueda={{ value: searchQuery, onChange: setSearchQuery, placeholder: 'Buscar factura por cliente...' }}
          orden={{ asc: sortAsc, onToggle: () => setSortAsc((prev) => !prev) }}
          exportar={{ onPdf: handleExportPdf, onCsv: handleExportContabilidad, disabled: !data || data.length === 0, pdfLabel: 'Exportar PDF', csvLabel: 'CSV Contable' }}
        />

      {/* Error */}
      <InlineError message={error} className="mb-8" />

      {/* Content */}
      {loading && (!data || data.length === 0) ? (
        <ListSkeleton count={4} />
      ) : sortedData.length === 0 ? (
        <View className="items-center justify-center p-20 gap-4">
          <Icon name={searchQuery ? "account-search" : "receipt"} size={48} color="#64748B" />
          <Text className="text-white font-black text-xl">
            {searchQuery ? "No se encontraron facturas" : "Sin facturas hoy"}
          </Text>
          <Text className="text-(--color-pos-text-muted) text-center">
            {searchQuery ? `No hay resultados para "${searchQuery}"` : "No se han registrado facturas en el día de hoy"}
          </Text>
        </View>
      ) : (
        <View className="pb-8">
          <CardGrid
            kind="factura"
            data={sortedData}
            keyExtractor={(item, i) => item.facturaId?.toString() ?? String(i)}
            renderItem={(item) => (
              <FacturaCard
                item={item}
                isUpdating={updating === item.facturaId}
                activeFilter={filterMethod}
                {...accionesFactura}
                onUpdate={onUpdate}
                showPrint
              />
            )}
          />
        </View>
      )}
    </PageContainer>
  );
}
