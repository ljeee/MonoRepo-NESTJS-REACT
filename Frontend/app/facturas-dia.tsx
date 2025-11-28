import React from 'react';
import { ActivityIndicator, FlatList, Text, TouchableOpacity, View } from 'react-native';
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

  if (loading) return <ActivityIndicator style={styles.loader} size="large" color="#00bcd4" />;
  if (error) return <Text style={styles.errorText}>{error}</Text>;

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
          ListEmptyComponent={<Text style={styles.emptyText}>No hay facturas hoy.</Text>}
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
