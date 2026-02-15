import React, { useState } from 'react';
import { Text, TextInput, TouchableOpacity, View } from 'react-native';
import { api } from '../../services/api';
import { createDomiciliarioFormStyles as styles } from '../../styles/domiciliarios/create-domiciliario-form.styles';

export default function CreateDomiciliarioForm() {
  const [telefono, setTelefono] = useState('');
  const [nombre, setNombre] = useState('');
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    setLoading(true);
    setError('');
    setSuccess(false);
    try {
      await api.domiciliarios.create({
        telefono: telefono || '',
        domiciliarioNombre: nombre,
      });
      setSuccess(true);
      setTelefono('');
      setNombre('');
    } catch {
      setError('Error al crear el domiciliario');
    } finally {
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