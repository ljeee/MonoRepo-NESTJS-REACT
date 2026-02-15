import React, { useState } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { useFacturasDia } from '../hooks/use-facturas';
import { colors } from '../styles/theme';
import { fontSize, fontWeight, spacing, radius } from '../styles/tokens';
import { FacturaCard, StatsHeader } from '../components/facturas/FacturaShared';
import { PageContainer, PageHeader, Button, ListSkeleton, Icon } from '../components/ui';

export default function FacturasDiaScreen() {
  const { data, loading, error, refetch, stats, updateEstado } = useFacturasDia();
  const [updating, setUpdating] = useState<number | null>(null);

  const handleChangeEstado = async (facturaId: number, currentEstado?: string) => {
    const nuevoEstado = currentEstado === 'pagado' ? 'pendiente' : 'pagado';
    setUpdating(facturaId);
    try {
      await updateEstado(facturaId, nuevoEstado);
    } finally {
      setUpdating(null);
    }
  };

  return (
    <PageContainer scrollable={false}>
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
        <View style={styles.errorBox}>
          <Icon name="alert-circle-outline" size={18} color={colors.danger} />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      {/* Content */}
      {loading ? (
        <ListSkeleton count={4} />
      ) : (
        <FlatList
          data={data}
          keyExtractor={(item, idx) =>
            item.facturaId?.toString() || idx.toString()
          }
          contentContainerStyle={{ paddingBottom: spacing.lg }}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Icon name="receipt" size={48} color={colors.textMuted} />
              <Text style={styles.emptyTitle}>Sin facturas hoy</Text>
              <Text style={styles.emptySubtitle}>
                No se han registrado facturas en el día de hoy
              </Text>
            </View>
          }
          renderItem={({ item }) => (
            <FacturaCard
              item={item}
              isUpdating={updating === item.facturaId}
              onToggleEstado={handleChangeEstado}
              showPrint
            />
          )}
        />
      )}
    </PageContainer>
  );
}

const styles = StyleSheet.create({
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
});
