import React, { useState } from 'react';
import { FlatList, Text, TouchableOpacity, View, ActivityIndicator } from 'react-native';
import { useFacturasDia } from '../hooks/use-facturas';
import { colors } from '../styles/theme';
import { styles } from '../styles/facturas.styles';
import { FacturaCard, StatsHeader } from '../components/facturas/FacturaShared';

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

  if (loading) {
    return (
      <View style={[styles.container, styles.loadingContainer]}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>Cargando facturas...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.pageHeader}>
        <Text style={styles.pageTitle}>📊 Resumen del Día</Text>
        <TouchableOpacity onPress={refetch} style={styles.refreshBtn}>
          <Text style={styles.refreshBtnText}>Refrescar</Text>
        </TouchableOpacity>
      </View>

      {/* Stats */}
      <StatsHeader stats={stats} periodLabel="Total del Día" />

      {/* Error */}
      {error && (
        <View style={styles.errorBox}>
          <Text style={styles.errorBoxText}>⚠️ {error}</Text>
        </View>
      )}

      {/* Lista */}
      <FlatList
        data={data}
        keyExtractor={(item, idx) => item.facturaId?.toString() || idx.toString()}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyTitle}>📭 Sin facturas hoy</Text>
            <Text style={styles.emptySubtitle}>No se han registrado facturas en el día de hoy</Text>
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
    </View>
  );
}
