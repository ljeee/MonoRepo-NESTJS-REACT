import React, { useCallback, useState } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { useFacturasRango } from '../hooks/use-facturas';
import { downloadCsv, escapeCsvValue } from '../utils/csvExport';
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

function buildCsv(facturas: FacturaItem[]): string {
  const header = 'ID,Cliente,Fecha,Total Factura,Estado,Método,Producto,Cantidad,Precio Unitario,Subtotal';
  const rows: string[] = [];

  for (const f of facturas) {
    const id = String(f.facturaId ?? '');
    const cliente = escapeCsvValue(f.clienteNombre || '');
    const fecha = f.fechaFactura ? new Date(f.fechaFactura).toLocaleDateString('es-CO') : '';
    const total = String(f.total ?? 0);
    const estado = f.estado || 'pendiente';
    const metodo = f.metodo || '';

    const productos = (f.ordenes ?? []).flatMap(o => o.productos ?? []);

    if (productos.length === 0) {
      rows.push(`${id},${cliente},${fecha},${total},${estado},${metodo},,,,`);
    } else {
      for (const p of productos) {
        const nombre = escapeCsvValue(p.productoNombre || 'Producto');
        const cant = p.cantidad ?? 1;
        const precio = p.precioUnitario ?? 0;
        const sub = cant * precio;
        rows.push(`${id},${cliente},${fecha},${total},${estado},${metodo},${nombre},${cant},${precio},${sub}`);
      }
    }
  }
  return [header, ...rows].join('\n');
}

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

  const handleChangeEstado = async (facturaId: number, currentEstado?: string) => {
    const nuevoEstado = currentEstado === 'pagado' ? 'pendiente' : 'pagado';
    setUpdating(facturaId);
    try {
      await updateEstado(facturaId, nuevoEstado);
    } finally {
      setUpdating(null);
    }
  };

  const handleUpdateTotal = async (facturaId: number, newTotal: number) => {
    await updateFactura(facturaId, { total: newTotal });
  };

  const handleExportCsv = useCallback(() => {
    if (data.length === 0) return;
    const csv = buildCsv(data);
    const filename = `facturas_${from || 'inicio'}_${to || 'fin'}.csv`;
    downloadCsv(csv, filename);
  }, [data, from, to]);

  return (
    <PageContainer scrollable={false} contentContainerStyle={{ flex: 1 }}>
      <FlatList
        data={data}
        style={{ flex: 1 }}
        keyExtractor={(item, idx) => item.facturaId?.toString() || idx.toString()}
        key={isMobile ? 'col_1' : 'col_2'}
        numColumns={isMobile ? 1 : 2}
        contentContainerStyle={{ paddingBottom: spacing.lg }}
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
                title="Exportar CSV"
                icon="download"
                variant="outline"
                size="sm"
                onPress={handleExportCsv}
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
                containerStyle={{ flex: 1, minWidth: 140 }}
                size="sm"
                leftIcon={<Icon name="calendar" size={16} color={colors.textMuted} />}
              />
              <Input
                label="Hasta"
                value={to}
                onChangeText={setTo}
                placeholder="2026-12-31"
                containerStyle={{ flex: 1, minWidth: 140 }}
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
        renderItem={({ item }) => (
          <View style={{ flex: 1, paddingBottom: spacing.md }}>
            <FacturaCard
              item={item}
              isUpdating={updating === item.facturaId}
              onToggleEstado={handleChangeEstado}
              onUpdateTotal={handleUpdateTotal}
            />
          </View>
        )}
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
});
