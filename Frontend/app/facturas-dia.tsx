import React from 'react';
import { FlatList, Text, TouchableOpacity, View } from 'react-native';
import { EmptyState } from '../components/states/EmptyState';
import { ErrorState } from '../components/states/ErrorState';
import { LoadingState } from '../components/states/LoadingState';
import { useFacturasDia } from '../hooks/use-facturas';
import { styles } from '../styles/facturas.styles';

function formatDate(date?: string) {
  if (!date) return '';
  const d = new Date(date);
  if (isNaN(d.getTime())) return date;
  return d.toLocaleString('es-CO', { dateStyle: 'short', timeStyle: 'short' });
}

export default function FacturasDiaScreen() {
  const { data, loading, error, refetch } = useFacturasDia();

  if (loading) return <LoadingState message="Cargando facturas..." />;
  if (error) return <ErrorState message={error} onRetry={refetch} />;

  return (
    <View style={styles.container}>
      <View style={styles.contentContainer}>
        <Text style={styles.title}>Facturas del día</Text>
        <TouchableOpacity onPress={refetch} style={styles.refreshButton}>
          <Text style={styles.buttonText}>Refrescar</Text>
        </TouchableOpacity>

        <FlatList
          data={data}
          keyExtractor={(item, idx) => (item.facturaId?.toString() || idx.toString())}
          contentContainerStyle={styles.listContainer}
          ListEmptyComponent={
            <EmptyState
              message="Sin facturas hoy"
              subMessage="No se han generado facturas en el día de hoy."
              icon="file-document-outline"
            />
          }
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
