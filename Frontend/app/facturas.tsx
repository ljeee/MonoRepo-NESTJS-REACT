import React, { useCallback, useState } from 'react';
import { FlatList, Platform, Text, TextInput, TouchableOpacity, View, ActivityIndicator } from 'react-native';
import { useFacturasRango } from '../hooks/use-facturas';
import { colors } from '../styles/theme';
import { styles } from '../styles/facturas.styles';
import { FacturaCard, StatsHeader, FacturaItem } from '../components/facturas/FacturaShared';
import { formatCurrency } from '../utils/formatNumber';

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
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.pageHeader}>
        <Text style={styles.pageTitle}>📅 Facturas por Fechas</Text>
      </View>

      {/* Date filter */}
      <View style={styles.filterSection}>
        <View style={styles.filterRow}>
          <View style={styles.filterInputGroup}>
            <Text style={styles.filterLabel}>Desde:</Text>
            <TextInput
              style={styles.filterInput}
              value={from}
              onChangeText={setFrom}
              placeholder="2025-01-01"
              placeholderTextColor={colors.placeholder}
            />
          </View>
          <View style={styles.filterInputGroup}>
            <Text style={styles.filterLabel}>Hasta:</Text>
            <TextInput
              style={styles.filterInput}
              value={to}
              onChangeText={setTo}
              placeholder="2026-12-31"
              placeholderTextColor={colors.placeholder}
            />
          </View>
          <TouchableOpacity
            onPress={fetchData}
            disabled={!from || !to || loading}
            style={[styles.filterBtn, (!from || !to || loading) ? styles.filterBtnDisabled : styles.filterBtnEnabled]}
          >
            <Text style={styles.filterBtnText}>{loading ? '...' : 'Buscar'}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={handleExportCsv}
            disabled={data.length === 0}
            style={[styles.csvBtn, data.length === 0 && styles.csvBtnDisabled]}
          >
            <Text style={styles.filterBtnText}>📥 CSV</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Stats (only when data) */}
      {data.length > 0 && (
        <StatsHeader stats={stats} periodLabel="Total del Período" />
      )}

      {/* Error */}
      {error && (
        <View style={styles.errorBox}>
          <Text style={styles.errorBoxText}>⚠️ {error}</Text>
        </View>
      )}

      {/* Loading */}
      {loading && (
        <View style={[styles.loadingContainer, { paddingVertical: 20 }]}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Buscando facturas...</Text>
        </View>
      )}

      {/* List */}
      <FlatList
        data={data}
        keyExtractor={(item, idx) => item.facturaId?.toString() || idx.toString()}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={!loading && !error ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyTitle}>
              {from && to ? '📭 Sin facturas en este rango' : '🔍 Selecciona fechas para buscar'}
            </Text>
            <Text style={styles.emptySubtitle}>
              {from && to ? 'No se encontraron facturas en el período.' : 'Ingresa las fechas y presiona Buscar.'}
            </Text>
          </View>
        ) : null}
        renderItem={({ item }) => (
          <FacturaCard
            item={item}
            isUpdating={updating === item.facturaId}
            onToggleEstado={handleChangeEstado}
          />
        )}
      />
    </View>
  );
}
