import React, { useEffect, useState } from 'react';
import { FlatList, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { api } from '../../services/api';
import { EmptyState } from '../states/EmptyState';
import { ErrorState } from '../states/ErrorState';
import { LoadingState } from '../states/LoadingState';
import { colors } from '../../styles/theme';
import CreateDomiciliarioForm from './CreateDomiciliarioForm';
import { domiciliariosListStyles as styles } from '../../styles/domiciliarios-list.styles';

type Domiciliario = { telefono: number; domiciliarioNombre?: string };

export default function DomiciliariosList() {
  const [domiciliarios, setDomiciliarios] = useState<Domiciliario[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingTelefono, setEditingTelefono] = useState<number | null>(null);
  const [editingField, setEditingField] = useState<'nombre' | 'telefono' | null>(null);
  const [editNombre, setEditNombre] = useState('');
  const [editTelefono, setEditTelefono] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const fetchDomiciliarios = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.domiciliarios.getAll();
      setDomiciliarios(res as any);
    } catch (err: any) {
      // If 404, just means no domiciliarios yet
      if (err.response?.status === 404) {
        setDomiciliarios([]);
      } else {
        setError('No se pudo cargar domiciliarios');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchDomiciliarios(); }, []);

  const handleDelete = async (telefono: number) => {
    setLoading(true);
    setError('');
    try {
      await api.domiciliarios.delete(String(telefono));
      setSuccess('Domiciliario eliminado');
      fetchDomiciliarios();
    } catch {
      setError('No se pudo eliminar');
    } finally {
      setLoading(false);
    }
  };

  const handleEditNombre = (d: Domiciliario) => {
    setEditingTelefono(d.telefono);
    setEditingField('nombre');
    setEditNombre(d.domiciliarioNombre || '');
  };

  const handleEditTelefono = (d: Domiciliario) => {
    setEditingTelefono(d.telefono);
    setEditingField('telefono');
    setEditTelefono(d.telefono.toString());
  };

  const handleSave = async (telefono: number) => {
    setLoading(true);
    setError('');
    try {
      let data: any = {};
      if (editingField === 'nombre') {
        data.domiciliarioNombre = editNombre;
      } else if (editingField === 'telefono') {
        data.telefono = editTelefono ? Number(editTelefono) : undefined;
      }
      await api.domiciliarios.update(String(telefono), data);
      setEditingTelefono(null);
      setEditingField(null);
      setSuccess('Domiciliario actualizado');
      fetchDomiciliarios();
    } catch {
      setError('No se pudo actualizar');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.contentContainer}>
        {!showForm ? (
          <TouchableOpacity onPress={() => setShowForm(true)} style={styles.toggleFormButton}>
            <Text style={styles.buttonText}>Crear nuevo domiciliario</Text>
          </TouchableOpacity>
        ) : (
          <>
            <CreateDomiciliarioForm />
            <TouchableOpacity onPress={() => setShowForm(false)} style={styles.closeFormButton}>
              <Text style={styles.buttonText}>Cerrar formulario</Text>
            </TouchableOpacity>
          </>
        )}
        <Text style={styles.title}>Domiciliarios</Text>
        {error ? <ErrorState message={error} onRetry={fetchDomiciliarios} /> : null}
        {success ? <Text style={styles.success}>{success}</Text> : null}
        {loading && domiciliarios.length === 0 ? <LoadingState message="Cargando domiciliarios..." /> : null}
        <FlatList
          data={domiciliarios}
          scrollEnabled={false}
          keyExtractor={item => item.telefono?.toString()}
          renderItem={({ item }) => (
            <View style={styles.itemBox}>
              <View style={styles.rowMain}>
                <View style={{ flex: 1 }}>
                  {/* Nombre */}
                  {editingTelefono === item.telefono && editingField === 'nombre' ? (
                    <>
                      <TextInput
                        style={styles.input}
                        value={editNombre}
                        onChangeText={setEditNombre}
                        placeholder="Nombre"
                        placeholderTextColor={colors.subText}
                      />
                      <View style={styles.rowBtns}>
                        <TouchableOpacity onPress={() => handleSave(item.telefono)} style={styles.editBtn}>
                          <Text style={styles.buttonText}>✔</Text>
                        </TouchableOpacity>
                        <TouchableOpacity onPress={() => { setEditingTelefono(null); setEditingField(null); }} style={styles.deleteBtn}>
                          <Text style={styles.buttonText}>Cancelar</Text>
                        </TouchableOpacity>
                      </View>
                    </>
                  ) : (
                    <View style={styles.rowField}>
                      <Text style={styles.label}>{item.domiciliarioNombre || '(Sin nombre)'}</Text>
                      <TouchableOpacity onPress={() => handleEditNombre(item)} style={styles.editBtnSmall}>
                        <Text style={styles.buttonText}>✎</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                  {/* Teléfono */}
                  {editingTelefono === item.telefono && editingField === 'telefono' ? (
                    <>
                      <TextInput
                        style={styles.input}
                        value={editTelefono}
                        onChangeText={setEditTelefono}
                        placeholder="Teléfono"
                        placeholderTextColor={colors.subText}
                        keyboardType="numeric"
                      />
                      <View style={styles.rowBtns}>
                        <TouchableOpacity onPress={() => handleSave(item.telefono)} style={styles.editBtn}>
                          <Text style={styles.buttonText}>✔</Text>
                        </TouchableOpacity>
                        <TouchableOpacity onPress={() => { setEditingTelefono(null); setEditingField(null); }} style={styles.deleteBtn}>
                          <Text style={styles.buttonText}>Cancelar</Text>
                        </TouchableOpacity>
                      </View>
                    </>
                  ) : (
                    <View style={styles.rowField}>
                      <Text style={styles.label}>{item.telefono}</Text>
                      <TouchableOpacity onPress={() => handleEditTelefono(item)} style={styles.editBtnSmall}>
                        <Text style={styles.buttonText}>✎</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
                <TouchableOpacity onPress={() => handleDelete(item.telefono)} style={styles.deleteBtn}>
                  <Text style={styles.buttonText}>Eliminar</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
          ListEmptyComponent={!loading && !error ? (
            <EmptyState
              message="Sin domiciliarios"
              subMessage="No hay domiciliarios registrados en el sistema."
              icon="moped-outline"
            />
          ) : null}
        />
      </ScrollView>
    </View>
  );
}