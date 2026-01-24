import React from 'react';
import { FlatList, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { EmptyState } from '../components/states/EmptyState';
import { ErrorState } from '../components/states/ErrorState';
import { LoadingState } from '../components/states/LoadingState';
import { useFacturasRango } from '../hooks/use-facturas';
import { styles } from '../styles/facturas.styles';

function formatDate(date?: string) {
  if (!date) return '';
  const d = new Date(date);
  if (isNaN(d.getTime())) return date;
  return d.toLocaleString('es-CO', { dateStyle: 'short', timeStyle: 'short' });
}

export default function FacturasRangoScreen() {
  const { data, loading, error, from, to, setFrom, setTo, fetchData } = useFacturasRango();

  return (
    <View style={styles.container}>
      <View style={styles.contentContainer}>
        <Text style={styles.title}>Facturas por fechas</Text>

        <View style={styles.filterContainer}>
          <View style={styles.filterRow}>
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Desde (YYYY-MM-DD):</Text>
              <TextInput
                style={styles.input}
                value={from}
                onChangeText={setFrom}
                placeholder="2025-11-01"
                placeholderTextColor="#7aa6b8"
              />
            </View>
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Hasta (YYYY-MM-DD):</Text>
              <TextInput
                style={styles.input}
                value={to}
                onChangeText={setTo}
                placeholder="2025-11-30"
                placeholderTextColor="#7aa6b8"
              />
            </View>
            <TouchableOpacity
              onPress={fetchData}
              style={styles.searchButton}
              disabled={!from || !to || loading}
            >
              <Text style={styles.buttonText}>{loading ? 'Buscando...' : 'Buscar'}</Text>
            </TouchableOpacity>
          </View>
        </View>

        {error && <ErrorState message={error} onRetry={fetchData} />}
        {loading && <LoadingState message="Buscando facturas..." />}

        <FlatList
          data={data}
          keyExtractor={(item, idx) => (item.facturaId?.toString() || idx.toString())}
          contentContainerStyle={styles.listContainer}
          ListEmptyComponent={!loading && !error ? (
            <EmptyState
              message="Sin facturas"
              subMessage={from && to ? "No se encontraron facturas en el rango de fechas seleccionado." : "Selecciona un rango de fechas para buscar facturas."}
              icon="file-document-outline"
            />
          ) : null}
          renderItem={({ item }) => (
            <View style={styles.facturaCard}>
              <View style={styles.facturaHeader}>
                <Text style={styles.facturaId}>{item.clienteNombre || 'Sin cliente'}</Text>
                <Text style={styles.facturaDate}>{formatDate(item.fechaFactura)}</Text>
              </View>
              {item.total != null && <Text style={styles.facturaTotal}>Total: $ {item.total.toLocaleString('es-CO')}</Text>}
              {item.metodo && <Text style={styles.facturaMetodo}>Método: {item.metodo}</Text>}
              {item.estado && <Text style={item.estado === 'pendiente' ? styles.facturaEstadoPendiente : styles.facturaEstadoCompletado}>Estado: {item.estado}</Text>}
              {item.descripcion && <Text style={styles.facturaDesc}>Descripción: {item.descripcion}</Text>}
            </View>
          )}
        />
      </View>
    </View>
  );
}
