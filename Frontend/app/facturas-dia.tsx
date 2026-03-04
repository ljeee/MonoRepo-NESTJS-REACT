import React, { useState } from 'react';
import { RefreshControl, StyleSheet, Text, View } from 'react-native';
import { useFacturasDia } from '../hooks/use-facturas';
import { buildCombinedBalanceCsv, buildFacturasBackupCsv, downloadCsv } from '../utils/csvExport';
import { exportFacturasPdf } from '../utils/exportData';
import { colors } from '../styles/theme';
import { fontSize, fontWeight, spacing, radius } from '../styles/tokens';
import { FacturaCard, StatsHeader } from '../components/facturas/FacturaShared';
import { PageContainer, PageHeader, Button, ListSkeleton, Icon } from '../components/ui';
import { useBreakpoint } from '../styles/responsive';

export default function FacturasDiaScreen() {
  const { isMobile } = useBreakpoint();
  const { data, loading, error, refetch, stats, updateEstado, updateFactura } = useFacturasDia();
  const [updating, setUpdating] = useState<number | null>(null);

  const handleChangeEstado = async (facturaId: number, currentEstado?: string) => {
    const nuevoEstado = currentEstado === 'pagado' ? 'pendiente' : 'pagado';
    setUpdating(facturaId);
    try {
      await updateEstado(facturaId, nuevoEstado);
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
    const today = new Date().toISOString().slice(0, 10);
    downloadCsv(csv, `facturas_${today}.csv`);
  };

  const handleExportContabilidad = async () => {
    if (!data || data.length === 0) return;
    const csv = await buildCombinedBalanceCsv(data, []);
    const today = new Date().toISOString().slice(0, 10);
    downloadCsv(csv, `contabilidad_${today}.csv`);
  };

  return (
    <PageContainer
      refreshControl={
        <RefreshControl
          refreshing={loading}
          onRefresh={refetch}
          tintColor={colors.primary}
          colors={[colors.primary]}
        />
      }
    >
      <PageHeader
        title="Resumen del Día"
        subtitle="Facturas"
        icon="chart-bar"
      />

      {/* Actions Bar */}
      <View style={styles.actionsBar}>
        <Button
          title="Refrescar"
          icon="refresh"
          variant="ghost"
          size="sm"
          onPress={refetch}
        />
        <Button
          title="PDF"
          icon="chart-bar"
          variant="outline"
          size="sm"
          onPress={handleExportPdf}
          disabled={!data || data.length === 0}
        />
        <Button
          title="CSV Backup"
          icon="download"
          variant="outline"
          size="sm"
          onPress={handleExportBackup}
          disabled={!data || data.length === 0}
        />
        <Button
          title="CSV Contabilidad"
          icon="scale-balance"
          variant="outline"
          size="sm"
          onPress={handleExportContabilidad}
          disabled={!data || data.length === 0}
        />
      </View>

      {/* Stats */}
      {stats && <StatsHeader stats={stats} periodLabel="Total del Día" />}

      {/* Error */}
      {error && (
        <View style={styles.errorBox}>
          <Icon name="alert-circle-outline" size={18} color={colors.danger} />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      {/* Content */}
      {loading && !data ? (
        <ListSkeleton count={4} />
      ) : data?.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Icon name="receipt" size={48} color={colors.textMuted} />
          <Text style={styles.emptyTitle}>Sin facturas hoy</Text>
          <Text style={styles.emptySubtitle}>
            No se han registrado facturas en el día de hoy
          </Text>
        </View>
      ) : (
        <View style={styles.gridContainer}>
          {data?.map((item, idx) => {
            const isLastOddDesktop = !isMobile && !!data && data.length % 2 === 1 && idx === data.length - 1;
            return (
            <View
              key={item.facturaId?.toString() || idx.toString()}
              style={isMobile ? styles.gridItemFull : isLastOddDesktop ? styles.gridItemFull : styles.gridItemHalf}
            >
              <FacturaCard
                item={item}
                isUpdating={updating === item.facturaId}
                onToggleEstado={handleChangeEstado}
                onUpdateTotal={handleUpdateTotal}
                showPrint
              />
            </View>
          );})}
        </View>
      )}
    </PageContainer>
  );
}

const styles = StyleSheet.create({
  actionsBar: {
    flexDirection: 'row',
    gap: spacing.md,
    marginBottom: spacing.xl,
    flexWrap: 'wrap',
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
  },
  emptySubtitle: {
    fontSize: fontSize.md,
    color: colors.textMuted,
    textAlign: 'center',
  },
  gridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: spacing.md,
    paddingBottom: spacing.lg,
  },
  gridItemFull: {
    width: '100%',
  },
  gridItemHalf: {
    width: '48.5%',
  },
});
