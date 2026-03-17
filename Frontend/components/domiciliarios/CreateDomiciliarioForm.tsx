import React, { useState } from 'react';
import { StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { api } from '../../services/api';

export default function CreateDomiciliarioForm() {
  const [telefono, setTelefono] = useState('');
  const [nombre, setNombre] = useState('');
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    const telefonoValue = telefono || '';
    setLoading(true);
    setError('');
    setSuccess(false);
    try {
      await api.domiciliarios.create({
        telefono: telefonoValue,
        domiciliarioNombre: nombre,
      });
      setSuccess(true);
      setTelefono('');
      setNombre('');
      setLoading(false);
    } catch {
      setError('Error al crear el domiciliario');
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Crear Domiciliario</Text>
      <Text style={styles.label}>Teléfono</Text>
      <TextInput
        style={styles.input}
        value={telefono}
        onChangeText={setTelefono}
        placeholder="Teléfono"
        placeholderTextColor="#7aa6b8"
        keyboardType="numeric"
      />
      <Text style={styles.label}>Nombre</Text>
      <TextInput
        style={styles.input}
        value={nombre}
        onChangeText={setNombre}
        placeholder="Nombre"
        placeholderTextColor="#7aa6b8"
      />
      <TouchableOpacity
        style={[styles.button, loading && styles.buttonDisabled]}
        onPress={handleSubmit}
        disabled={loading}
      >
        <Text style={styles.buttonText}>{loading ? 'Creando...' : 'Crear Domiciliario'}</Text>
      </TouchableOpacity>
      {success && <Text style={styles.success}>¡Domiciliario creado!</Text>}
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: 20 },
  title: { fontSize: 20, fontWeight: 'bold', color: '#fff', marginBottom: 16 },
  label: { fontSize: 14, color: '#94a3b8', marginBottom: 4, marginTop: 12 },
  input: { backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 12, padding: 12, color: '#fff', fontSize: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  button: { backgroundColor: '#F5A524', borderRadius: 12, padding: 14, alignItems: 'center' as const, marginTop: 20 },
  buttonDisabled: { opacity: 0.5 },
  buttonText: { color: '#000', fontWeight: 'bold', fontSize: 14 },
  success: { color: '#22c55e', marginTop: 12, fontWeight: 'bold' },
  error: { color: '#ef4444', marginTop: 12, fontWeight: 'bold' },
});
