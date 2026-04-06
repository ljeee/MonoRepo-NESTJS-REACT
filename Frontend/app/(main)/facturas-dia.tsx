import React, { useState } from 'react';
import { RefreshControl, StyleSheet } from 'react-native';
import { Text, View, TextInput, TouchableOpacity } from '../../tw';
import { useFacturasDia } from '@monorepo/shared';
import { buildCombinedBalanceCsv, buildFacturasBackupCsv, downloadCsv } from '../../utils/csvExport';
import { exportFacturasPdf } from '../../utils/exportData';
import { FacturaCard, StatsHeader, FacturaItem } from '../../components/facturas/FacturaShared';
import { PageContainer, PageHeader, Button, ListSkeleton, Icon } from '../../components/ui';
import { useBreakpoint } from '../../styles/responsive';

export default function FacturasDiaScreen() {
  const { isMobile } = useBreakpoint();
  const { data, loading, error, refetch, stats, updateEstado, updateFactura } = useFacturasDia();
  const [updating, setUpdating] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterPending, setFilterPending] = useState(false);

  const handleChangeEstado = async (facturaId: number, nuevoEstado: string, metodo?: string) => {
    setUpdating(facturaId);
    try {
      if (nuevoEstado === 'pagado' && metodo) {
         await updateFactura(facturaId, { estado: 'pagado', metodo });
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

  const filteredData = (data || []).filter((f: FacturaItem) => {
    const matchesSearch = !searchQuery || (f.clienteNombre && f.clienteNombre.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesPending = !filterPending || f.estado === 'pendiente';
    return matchesSearch && matchesPending;
  });

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
            title="Refrescar"
            icon="refresh"
            variant="ghost"
            size="sm"
            onPress={refetch}
          />
        }
      />


      {/* Stats */}
      {stats && <StatsHeader stats={stats} periodLabel="Total del Día" />}

      {/* Buscador y Filtro */}
      <View className="mb-6 flex-row items-center gap-3">
        <View className="flex-row items-center bg-white/5 rounded-2xl px-5 py-3 min-h-[50px] border border-white/10 flex-1">
            <Icon name="magnify" size={22} color="#94A3B8" />
            <TextInput
                className="text-white ml-3 flex-1 h-full outline-none font-bold"
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

        <TouchableOpacity 
            onPress={() => setFilterPending(!filterPending)}
            className={`px-4 min-h-[50px] rounded-2xl border flex-row items-center gap-2 ${filterPending ? 'bg-orange-500/20 border-orange-500/40' : 'bg-white/5 border-white/10'}`}
        >
            <Icon name="alert-circle-outline" size={18} color={filterPending ? "#F5A524" : "#94A3B8"} />
            {!isMobile && <Text className={`font-bold text-xs uppercase tracking-widest ${filterPending ? 'text-orange-400' : 'text-slate-400'}`}>Pendientes</Text>}
        </TouchableOpacity>
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
                showPrint
              />
            </View>
          );})}
        </View>
      )}
    </PageContainer>
  );
}
