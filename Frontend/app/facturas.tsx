import React, { useCallback, useState } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { useFacturasRango } from '../hooks/use-facturas';
import { buildCombinedBalanceCsv, buildFacturasBackupCsv, downloadCsv } from '../utils/csvExport';
import { exportFacturasPdf } from '../utils/exportData';
import { validateFlexibleDateRange } from '../utils/dateRange';
import { colors } from '../styles/theme';
import { fontSize, fontWeight, spacing, radius } from '../styles/tokens';
import { FacturaCard, StatsHeader, FacturaItem } from '../components/facturas/FacturaShared';
import {
  PageContainer,
  PageHeader,
  Button,
  Input,
  Icon,
  ListSkeleton,
} from '../components/ui';
import { useBreakpoint } from '../styles/responsive';

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

  const handleChangeEstado = useCallback(async (facturaId: number, currentEstado?: string) => {
    const nuevoEstado = currentEstado === 'pagado' ? 'pendiente' : 'pagado';
    setUpdating(facturaId);
    try {
      await updateEstado(facturaId, nuevoEstado);
      setUpdating(null);
      return;
    } catch {
      setUpdating(null);
    }
  }, [updateEstado]);

  const handleUpdateTotal = useCallback(async (facturaId: number, newTotal: number) => {
    await updateFactura(facturaId, { total: newTotal });
  }, [updateFactura]);

  const handleExportCsv = useCallback(async () => {
    if (data.length === 0) return;
    const csv = await buildFacturasBackupCsv(data);
    const filename = `facturas_${from || 'inicio'}_${to || 'fin'}.csv`;
    downloadCsv(csv, filename);
  }, [data, from, to]);

  const handleExportPdf = useCallback(() => {
    if (data.length === 0) return;
    exportFacturasPdf(data, `${from || 'inicio'} a ${to || 'fin'}`);
  }, [data, from, to]);

  const handleExportContabilidad = useCallback(async () => {
    if (data.length === 0) return;
    const csv = await buildCombinedBalanceCsv(data, []);
    const filename = `contabilidad_${from || 'inicio'}_${to || 'fin'}.csv`;
    downloadCsv(csv, filename);
  }, [data, from, to]);

  const renderFacturaItem = useCallback(({ item }: { item: FacturaItem }) => (
    <View style={styles.renderItem}>
      <FacturaCard
        item={item}
        isUpdating={updating === item.facturaId}
        onToggleEstado={handleChangeEstado}
        onUpdateTotal={handleUpdateTotal}
      />
    </View>
  ), [handleChangeEstado, handleUpdateTotal, updating]);

  return (
    <PageContainer scrollable={false} contentContainerStyle={styles.flex1}>
      <FlatList
        data={data}
        style={styles.flex1}
        keyExtractor={(item, idx) => item.facturaId?.toString() || idx.toString()}
        key={isMobile ? 'col_1' : 'col_2'}
        numColumns={isMobile ? 1 : 2}
        contentContainerStyle={styles.listContent}
        columnWrapperStyle={!isMobile ? { gap: spacing.md } : undefined}
        ListHeaderComponent={
          <>
            <PageHeader
              title="Facturas por Fechas"
              subtitle="Facturación"
              icon="calendar-range"
            />

            {/* Actions Bar */}
            <View style={styles.actionsBar}>
              <Button
                title="Refrescar"
                icon="refresh"
                variant="ghost"
                size="sm"
                onPress={fetchData}
              />
              <Button
                title="PDF"
                icon="chart-bar"
                variant="outline"
                size="sm"
                onPress={handleExportPdf}
                disabled={data.length === 0}
              />
              <Button
                title="CSV Backup"
                icon="download"
                variant="outline"
                size="sm"
                onPress={handleExportCsv}
                disabled={data.length === 0}
              />
              <Button
                title="CSV Contabilidad"
                icon="scale-balance"
                variant="outline"
                size="sm"
                onPress={handleExportContabilidad}
                disabled={data.length === 0}
              />
            </View>

            {/* Date filter */}
            <View style={styles.filterRow}>
              <Input
                label="Desde"
                value={from}
                onChangeText={setFrom}
                placeholder="2025-01-01"
                containerStyle={styles.inputContainer}
                size="sm"
                leftIcon={<Icon name="calendar" size={16} color={colors.textMuted} />}
              />
              <Input
                label="Hasta"
                value={to}
                onChangeText={setTo}
                placeholder="2026-12-31"
                containerStyle={styles.inputContainer}
                size="sm"
                leftIcon={<Icon name="calendar" size={16} color={colors.textMuted} />}
              />
              <View style={styles.filterActions}>
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
              <View style={styles.errorBox}>
                <Icon name="alert-circle-outline" size={14} color={colors.danger} />
                <Text style={styles.errorText}>{filterError}</Text>
              </View>
            ) : null}

            {/* Stats */}
            {data.length > 0 && <StatsHeader stats={stats} periodLabel="Total del Período" />}

            {/* Error */}
            {error && (
              <View style={styles.errorBox}>
                <Icon name="alert-circle-outline" size={18} color={colors.danger} />
                <Text style={styles.errorText}>{error}</Text>
              </View>
            )}

            {/* Loading */}
            {loading && <ListSkeleton count={4} />}
          </>
        }
        ListEmptyComponent={
          !loading && !error ? (
            <View style={styles.emptyContainer}>
              <Icon
                name={from && to ? 'email-off-outline' : 'calendar-search'}
                size={48}
                color={colors.textMuted}
              />
              <Text style={styles.emptyTitle}>
                {from && to ? 'Sin facturas en este rango' : 'Selecciona fechas para buscar'}
              </Text>
              <Text style={styles.emptySubtitle}>
                {from && to
                  ? 'No se encontraron facturas en el período.'
                  : 'Ingresa las fechas y presiona Buscar.'}
              </Text>
            </View>
          ) : null
        }
        renderItem={renderFacturaItem}
      />
    </PageContainer>
  );
}

const styles = StyleSheet.create({
  actionsBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xl,
    gap: spacing.md,
  },
  filterRow: {
    flexDirection: 'row',
    gap: spacing.md,
    marginBottom: spacing.xl,
    flexWrap: 'wrap',
    alignItems: 'flex-end',
  },
  filterActions: {
    marginBottom: spacing.lg,
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.dangerLight,
    padding: spacing.lg,
    borderRadius: radius.md,
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: colors.danger,
  },
  errorText: {
    color: colors.danger,
    fontSize: fontSize.md,
    fontWeight: fontWeight.medium,
    flex: 1,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing['5xl'],
    gap: spacing.md,
  },
  emptyTitle: {
    fontSize: fontSize.xl,
    fontWeight: fontWeight.bold,
    color: colors.text,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: fontSize.md,
    color: colors.textMuted,
    textAlign: 'center',
  },
  flex1: {
    flex: 1,
  },
  listContent: {
    paddingBottom: spacing.lg,
  },
  inputContainer: {
    flex: 1,
    minWidth: 140,
  },
  renderItem: {
    flex: 1,
    paddingBottom: spacing.md,
  },
});
