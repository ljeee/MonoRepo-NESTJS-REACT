import React, { useState } from 'react';
import { RefreshControl } from 'react-native';
import { Text, View, TextInput, TouchableOpacity } from '../../tw';
import { useFacturasDia, calcStats, useApi } from '@/src/shared';
import type { DenominacionesMap } from '@/src/shared';
import { buildCombinedBalanceCsv, buildFacturasBackupCsv, downloadCsv } from '../../utils/csvExport';
import { exportFacturasPdf } from '../../utils/exportData';
import { FacturaCard, StatsHeader, FacturaItem } from '../../components/facturas/FacturaShared';
import PageContainer from '../../components/ui/PageContainer';
import PageHeader from '../../components/ui/PageHeader';
import Button from '../../components/ui/Button';
import { ListSkeleton } from '../../components/ui/SkeletonLoader';
import Icon from '../../components/ui/Icon';
import { MethodFilterChips, MethodFilterValue } from '../../components/ui';
import { useBreakpoint } from '../../styles/responsive';

export default function FacturasDiaScreen() {
  const { isMobile } = useBreakpoint();
  const api = useApi();
  const { data, loading, error, refetch, stats, updateEstado, updateFactura } = useFacturasDia();
  const [updating, setUpdating] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterMethod, setFilterMethod] = useState<MethodFilterValue>('todos');

  const handleChangeEstado = async (
    facturaId: number,
    nuevoEstado: string,
    metodo?: string,
    pagoEfectivo?: number,
    pagoTransferencia?: number,
    denominaciones?: Record<string, number>,
    cambioDenominaciones?: Record<string, number>,
  ) => {
    setUpdating(facturaId);
    try {
      if (nuevoEstado === 'pagado' && metodo) {
         await updateFactura(facturaId, { estado: 'pagado', metodo, pagoEfectivo, pagoTransferencia, denominaciones, cambioDenominaciones });
      } else {
         await updateEstado(facturaId, nuevoEstado);
      }
      setUpdating(null);
      return;
    } catch {
      setUpdating(null);
    }
  };

  const handleUpdateTotal = async (facturaId: number, newTotal: number) => {
    await updateFactura(facturaId, { total: newTotal });
  };

  const handleAbono = async (facturaId: number, monto: number, denominaciones?: DenominacionesMap, cambioDenominaciones?: DenominacionesMap) => {
    setUpdating(facturaId);
    try {
      await api.facturas.abono(facturaId, monto, denominaciones, cambioDenominaciones);
      await refetch();
    } finally {
      setUpdating(null);
    }
  };

  const handleExportPdf = () => {
    if (!data || data.length === 0) return;
    exportFacturasPdf(data, 'Hoy');
  };

  const handleExportBackup = async () => {
    if (!data || data.length === 0) return;
    const csv = await buildFacturasBackupCsv(data);
    const today = (() => {
      const now = new Date();
      return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    })();
    downloadCsv(csv, `facturas_${today}.csv`);
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

  const noPendiente = (f: FacturaItem) => f.estado !== 'pendiente' && f.estado !== 'parcial';
  const methodCounts = {
    todos:         searchFiltered.length,
    efectivo:      searchFiltered.filter(f => f.metodo === 'efectivo' && noPendiente(f)).length,
    transferencia: searchFiltered.filter(f => f.metodo === 'transferencia' && noPendiente(f)).length,
    mixto:         searchFiltered.filter(f => f.metodo === 'efectivo_transferencia' && noPendiente(f)).length,
    pendiente:     searchFiltered.filter(f => f.estado === 'pendiente' || f.estado === 'parcial').length,
  };

  const filteredData = searchFiltered.filter((f: FacturaItem) => {
    if (filterMethod === 'todos') return true;
    if (filterMethod === 'pendiente') return f.estado === 'pendiente' || f.estado === 'parcial';
    if (filterMethod === 'mixto') return f.metodo === 'efectivo_transferencia' && noPendiente(f);
    return f.metodo === filterMethod && noPendiente(f);
  });

  const computedStats = React.useMemo(() => calcStats(filteredData as any), [filteredData]);

  return (
    <PageContainer
      refreshControl={
        <RefreshControl
          refreshing={loading}
          onRefresh={refetch}
          tintColor="#F5A524"
          colors={["#F5A524"]}
        />
      }
    >
      <PageHeader
        title="Resumen del Día"
        subtitle="Facturas"
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


      {/* Stats */}
      {data && data.length > 0 && <StatsHeader stats={computedStats} periodLabel="Total del Día (Filtrado)" />}

        {/* Buscador y Filtro */}
        <View className={`mb-6 flex-col gap-3 ${isMobile ? 'w-full' : ''}`}>
          <View className={`flex-row items-center gap-3 ${isMobile ? 'flex-col' : ''}`}>
            <View className={`flex-row items-center bg-white/5 rounded-2xl px-5 py-3 min-h-[50px] border border-white/10 ${isMobile ? 'w-full' : 'flex-1'}`}>
                <Icon name="magnify" size={22} color="#94A3B8" />
                <TextInput
                    className="text-white ml-3 flex-1 h-full font-bold"
                    placeholder="Buscar factura por cliente..."
                    placeholderTextColor="#64748B"
                    value={searchQuery}
                    onChangeText={setSearchQuery}
                />
                {searchQuery.length > 0 && (
                    <TouchableOpacity onPress={() => setSearchQuery('')} className="bg-white/10 rounded-full p-1 border border-white/20">
                        <Icon name="close" size={14} color="#CBD5E1" />
                    </TouchableOpacity>
                )}
            </View>
          </View>
          
          <MethodFilterChips value={filterMethod} onChange={setFilterMethod} counts={methodCounts} />
        </View>

      {/* Error */}
      {error && (
        <View className="flex-row items-center gap-3 bg-(--color-pos-danger)/10 p-5 rounded-2xl mb-8 border border-(--color-pos-danger)/20">
          <Icon name="alert-circle-outline" size={18} color="#F43F5E" />
          <Text className="text-(--color-pos-danger) font-medium flex-1">{error}</Text>
        </View>
      )}

      {/* Content */}
      {loading && (!data || data.length === 0) ? (
        <ListSkeleton count={4} />
      ) : filteredData.length === 0 ? (
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
        <View className="flex-row flex-wrap justify-between gap-y-4 pb-8">
          {filteredData.map((item: FacturaItem, idx: number) => {
            const isLastOddDesktop = !isMobile && filteredData.length % 2 === 1 && idx === filteredData.length - 1;
            return (
            <View
              key={item.facturaId?.toString() || idx.toString()}
              className={isMobile ? 'w-full' : isLastOddDesktop ? 'w-full' : 'w-[48.5%]'}
            >
              <FacturaCard
                item={item}
                isUpdating={updating === item.facturaId}
                onToggleEstado={handleChangeEstado}
                onUpdateTotal={handleUpdateTotal}
                onUpdate={updateFactura}
                onAbono={handleAbono}
                showPrint
              />
            </View>
          );})}
        </View>
      )}
    </PageContainer>
  );
}
