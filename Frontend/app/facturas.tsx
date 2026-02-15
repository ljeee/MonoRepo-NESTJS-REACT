import React, { useCallback, useState } from 'react';
import { FlatList, Platform, StyleSheet, Text, View } from 'react-native';
import { useFacturasRango } from '../hooks/use-facturas';
import { colors } from '../styles/theme';
import { fontSize, fontWeight, spacing, radius } from '../styles/tokens';
import { FacturaCard, StatsHeader, FacturaItem } from '../components/facturas/FacturaShared';
import { formatCurrency } from '../utils/formatNumber';
import {
  PageContainer,
  PageHeader,
  Button,
  Input,
  Icon,
  ListSkeleton,
} from '../components/ui';

// ─── CSV helpers ──────────────────────────────────────────────────────────────

function esc(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return '"' + value.replace(/"/g, '""') + '"';
  }
  return value;
}

function buildCsv(facturas: FacturaItem[]): string {
  const header = 'ID,Cliente,Fecha,Total Factura,Estado,Método,Producto,Cantidad,Precio Unitario,Subtotal';
  const rows: string[] = [];

  for (const f of facturas) {
    const id = String(f.facturaId ?? '');
    const cliente = esc(f.clienteNombre || '');
    const fecha = f.fechaFactura ? new Date(f.fechaFactura).toLocaleDateString('es-CO') : '';
    const total = formatCurrency(f.total ?? 0);
    const estado = f.estado || 'pendiente';
    const metodo = f.metodo || '';

    const productos = (f.ordenes ?? []).flatMap(o => o.productos ?? []);

    if (productos.length === 0) {
      rows.push(`${id},${cliente},${fecha},${total},${estado},${metodo},,,,`);
    } else {
      for (const p of productos) {
        const nombre = esc(p.productoNombre || 'Producto');
        const cant = p.cantidad ?? 1;
        const precio = p.precioUnitario ?? 0;
        const sub = cant * precio;
        rows.push(`${id},${cliente},${fecha},${total},${estado},${metodo},${nombre},${cant},${formatCurrency(precio)},${formatCurrency(sub)}`);
      }
    }
  }
  return [header, ...rows].join('\n');
}

function downloadCsv(csv: string, filename: string) {
  if (Platform.OS !== 'web') return;
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 100);
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function FacturasRangoScreen() {
  const { data, loading, error, from, to, setFrom, setTo, fetchData, stats, updateEstado } = useFacturasRango();
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

  const handleExportCsv = useCallback(() => {
    if (data.length === 0) return;
    const csv = buildCsv(data);
    const filename = `facturas_${from || 'inicio'}_${to || 'fin'}.csv`;
    downloadCsv(csv, filename);
  }, [data, from, to]);

  return (
    <PageContainer scrollable={false}>
      <PageHeader
        title="Facturas por Fechas"
        subtitle="Facturación"
        icon="calendar-range"
        rightContent={
          <Button
            title="Exportar CSV"
            icon="download"
            variant="outline"
            size="sm"
            onPress={handleExportCsv}
            disabled={data.length === 0}
          />
        }
      />

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
            onPress={fetchData}
            disabled={!from || !to || loading}
            loading={loading}
          />
        </View>
      </View>

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

      {/* List */}
      <FlatList
        data={data}
        keyExtractor={(item, idx) => item.facturaId?.toString() || idx.toString()}
        contentContainerStyle={{ paddingBottom: spacing.lg }}
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
          <FacturaCard
            item={item}
            isUpdating={updating === item.facturaId}
            onToggleEstado={handleChangeEstado}
          />
        )}
      />
    </PageContainer>
  );
}

const styles = StyleSheet.create({
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
