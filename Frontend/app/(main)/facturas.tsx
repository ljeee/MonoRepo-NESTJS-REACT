import React, { useCallback, useState } from 'react';
import { FlatList } from 'react-native';
import { View, Text } from '../../tw';
import { useFacturasRango } from '@monorepo/shared';
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

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function FacturasRangoScreen() {
  const { isMobile } = useBreakpoint();
  const { data, loading, error, from, to, setFrom, setTo, fetchData, stats, updateEstado, updateFactura } = useFacturasRango();
  const [updating, setUpdating] = useState<number | null>(null);
  const [filterError, setFilterError] = useState('');

  const handleSearch = useCallback(() => {
    const { from: fromParsed, to: toParsed, error } = validateFlexibleDateRange(from, to);
    if (error) {
      setFilterError(error);
      return;
    }

    setFilterError('');
    setFrom(fromParsed);
    setTo(toParsed);
    fetchData(fromParsed, toParsed);
  }, [from, to, setFrom, setTo, fetchData]);

  const handleChangeEstado = useCallback(async (facturaId: number, nuevoEstado: string, metodo?: string) => {
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
  }, [updateEstado, updateFactura]);

  const handleUpdateTotal = useCallback(async (facturaId: number, newTotal: number) => {
    await updateFactura(facturaId, { total: newTotal });
  }, [updateFactura]);



  const renderFacturaItem = useCallback(({ item }: { item: FacturaItem }) => (
    <View className="flex-1 pb-4">
      <FacturaCard
        item={item}
        isUpdating={updating === item.facturaId}
        onToggleEstado={handleChangeEstado}
        onUpdateTotal={handleUpdateTotal}
        onUpdate={updateFactura}
      />
    </View>
  ), [handleChangeEstado, handleUpdateTotal, updating]);

  return (
    <PageContainer scrollable={false} contentContainerClassName="flex-1">
      <FlatList
        data={data}
        className="flex-1"
        keyExtractor={(item, idx) => item.facturaId?.toString() || idx.toString()}
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

            {/* Actions Bar (Exports) */}

            {/* Date filter */}
            <View className="flex-row gap-4 mb-8 flex-wrap items-end">
              <Input
                label="Desde"
                value={from}
                onChangeText={setFrom}
                placeholder="2025-01-01"
                containerStyle={{ flex: 1, minWidth: 140 }}
                size="sm"
                leftIcon={<Icon name="calendar" size={16} color="#64748B" />}
              />
              <Input
                label="Hasta"
                value={to}
                onChangeText={setTo}
                placeholder="2026-12-31"
                containerStyle={{ flex: 1, minWidth: 140 }}
                size="sm"
                leftIcon={<Icon name="calendar" size={16} color="#64748B" />}
              />
              <View className="mb-8">
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
            </View>

            {filterError ? (
              <View className="flex-row items-center gap-2 bg-(--color-pos-danger)/10 p-4 rounded-xl mb-8 border border-(--color-pos-danger)/20">
                <Icon name="alert-circle-outline" size={14} color="#F43F5E" />
                <Text className="text-(--color-pos-danger) flex-1">{filterError}</Text>
              </View>
            ) : null}

            {/* Stats */}
            {data.length > 0 && <StatsHeader stats={stats} periodLabel="Total del Período" />}

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
        ListEmptyComponent={
          !loading && !error ? (
            <View className="items-center justify-center py-20 gap-4">
              <Icon
                name={from && to ? 'email-off-outline' : 'calendar-search'}
                size={48}
                color="#64748B"
              />
              <Text className="text-white font-black text-xl text-center">
                {from && to ? 'Sin facturas en este rango' : 'Selecciona fechas para buscar'}
              </Text>
              <Text className="text-(--color-pos-text-muted) text-center">
                {from && to
                  ? 'No se encontraron facturas en el período.'
                  : 'Ingresa las fechas y presiona Buscar.'}
              </Text>
            </View>
          ) : null}
        renderItem={renderFacturaItem}
      />
    </PageContainer>
  );
}
