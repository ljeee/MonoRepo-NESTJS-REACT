import React, { useState } from 'react';
import { ActivityIndicator, FlatList, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useClientByPhone } from '../hooks/use-client-by-phone';
import { useClientesList } from '../hooks/use-clientes-list';
import { styles } from '../styles/clientes.styles';

export default function ClientesScreen() {
  const { data, loading, error, refetch } = useClientesList();
  const { client, loading: searching, error: searchError, fetchClient } = useClientByPhone();
  const [telefono, setTelefono] = useState('');

  return (
    <View style={styles.container}>
      <View style={styles.contentContainer}>
        <Text style={styles.title}>Clientes</Text>

        <View style={styles.searchContainer}>
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Buscar por teléfono:</Text>
            <TextInput
              value={telefono}
              onChangeText={setTelefono}
              placeholder="Ej: 3001234567"
              placeholderTextColor="#7aa6b8"
              style={styles.input}
              keyboardType="number-pad"
            />
          </View>
          <TouchableOpacity
            onPress={() => telefono && fetchClient(telefono)}
            style={styles.searchButton}
            disabled={!telefono || searching}
          >
            <Text style={styles.buttonText}>{searching ? 'Buscando...' : 'Buscar'}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={refetch}
            style={styles.refreshButton}
            disabled={loading}
          >
            <Text style={styles.buttonText}>{loading ? 'Cargando...' : 'Refrescar'}</Text>
          </TouchableOpacity>
        </View>

        {searchError ? <Text style={styles.errorText}>{searchError}</Text> : null}
        {client && (
          <View style={styles.resultCard}>
            <Text style={styles.resultTitle}>Resultado búsqueda</Text>
            <Text style={styles.resultText}>Nombre: {client.clienteNombre || '—'}</Text>
            <Text style={styles.resultText}>Dirección: {client.direccion || '—'}</Text>
            {client.direccionDos && <Text style={styles.resultText}>Dirección 2: {client.direccionDos}</Text>}
            {client.direccionTres && <Text style={styles.resultText}>Dirección 3: {client.direccionTres}</Text>}
          </View>
        )}

        {error ? <Text style={styles.errorText}>{error}</Text> : null}
        {loading && !data.length && <ActivityIndicator style={styles.loader} size="large" color="#00bcd4" />}

        <FlatList
          data={data}
          keyExtractor={(item, idx) => (item.telefono || idx.toString())}
          contentContainerStyle={styles.listContainer}
          ListEmptyComponent={!loading ? <Text style={styles.emptyText}>No hay clientes.</Text> : null}
          renderItem={({ item }) => (
            <View style={styles.clientCard}>
              <Text style={styles.clientName}>{item.clienteNombre || 'Sin nombre'}</Text>
              {item.telefono && <Text style={styles.clientPhone}>Teléfono: {item.telefono}</Text>}
              {item.direccion && <Text style={styles.clientAddress}>Dirección: {item.direccion}</Text>}
            </View>
          )}
        />
      </View>
    </View>
  );
}