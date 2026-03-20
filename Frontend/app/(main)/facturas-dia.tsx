import React, { useState } from 'react';
import { RefreshControl, StyleSheet } from 'react-native';
import { Text, View } from '../../tw';
import { useFacturasDia } from '@monorepo/shared';
import { buildCombinedBalanceCsv, buildFacturasBackupCsv, downloadCsv } from '../../utils/csvExport';
import { exportFacturasPdf } from '../../utils/exportData';
import { FacturaCard, StatsHeader } from '../../components/facturas/FacturaShared';
import { PageContainer, PageHeader, Button, ListSkeleton, Icon } from '../../components/ui';
import { useBreakpoint } from '../../styles/responsive';

export default function FacturasDiaScreen() {
  const { isMobile } = useBreakpoint();
  const { data, loading, error, refetch, stats, updateEstado, updateFactura } = useFacturasDia();
  const [updating, setUpdating] = useState<number | null>(null);

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

      {/* Error */}
      {error && (
        <View className="flex-row items-center gap-3 bg-(--color-pos-danger)/10 p-5 rounded-2xl mb-8 border border-(--color-pos-danger)/20">
          <Icon name="alert-circle-outline" size={18} color="#F43F5E" />
          <Text className="text-(--color-pos-danger) font-medium flex-1">{error}</Text>
        </View>
      )}

      {/* Content */}
      {loading && !data ? (
        <ListSkeleton count={4} />
      ) : data?.length === 0 ? (
        <View className="items-center justify-center p-20 gap-4">
          <Icon name="receipt" size={48} color="#64748B" />
          <Text className="text-white font-black text-xl">Sin facturas hoy</Text>
          <Text className="text-(--color-pos-text-muted) text-center">
            No se han registrado facturas en el día de hoy
          </Text>
        </View>
      ) : (
        <View className="flex-row flex-wrap justify-between gap-y-4 pb-8">
          {data?.map((item, idx) => {
            const isLastOddDesktop = !isMobile && !!data && data.length % 2 === 1 && idx === data.length - 1;
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
