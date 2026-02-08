import React, { useState } from 'react';
import { Alert, FlatList, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { api } from '../services/api';
import { Cliente, CreateClienteDto } from '../types/models';
import { useClientByPhone } from '../hooks/use-client-by-phone';
import { useClientesList } from '../hooks/use-clientes-list';
import { styles } from '../styles/clientes.styles';
import { colors } from '../styles/theme';

type FormMode = 'closed' | 'create' | 'edit';

export default function ClientesScreen() {
  const { data, loading, error, refetch } = useClientesList();
  const { client, loading: searching, error: searchError, fetchClient } = useClientByPhone();
  const [telefono, setTelefono] = useState('');

  // ── Form state ──
  const [formMode, setFormMode] = useState<FormMode>('closed');
  const [formData, setFormData] = useState<CreateClienteDto>({
    telefono: '',
    clienteNombre: '',
    direccion: '',
    direccionDos: '',
    direccionTres: '',
  });
  const [formLoading, setFormLoading] = useState(false);
  const [formError, setFormError] = useState('');
  const [editingPhone, setEditingPhone] = useState(''); // original phone when editing

  const resetForm = () => {
    setFormMode('closed');
    setFormData({ telefono: '', clienteNombre: '', direccion: '', direccionDos: '', direccionTres: '' });
    setFormError('');
    setEditingPhone('');
  };

  const openCreate = () => {
    setFormMode('create');
    setFormData({ telefono: '', clienteNombre: '', direccion: '', direccionDos: '', direccionTres: '' });
    setFormError('');
  };

  const openEdit = (c: Cliente) => {
    setFormMode('edit');
    setEditingPhone(c.telefono);
    setFormData({
      telefono: c.telefono,
      clienteNombre: c.clienteNombre || '',
      direccion: c.direccion || '',
      direccionDos: c.direccionDos || '',
      direccionTres: c.direccionTres || '',
    });
    setFormError('');
  };

  const handleSave = async () => {
    if (!formData.telefono) {
      setFormError('El teléfono es obligatorio');
      return;
    }
    setFormLoading(true);
    setFormError('');
    try {
      if (formMode === 'create') {
        await api.clientes.create(formData);
      } else {
        await api.clientes.update(editingPhone, formData);
      }
      resetForm();
      refetch();
    } catch (err: any) {
      setFormError(err.response?.data?.message || 'Error al guardar');
    } finally {
      setFormLoading(false);
    }
  };

  const handleDelete = (c: Cliente) => {
    Alert.alert(
      'Eliminar cliente',
      `¿Eliminar a ${c.clienteNombre || c.telefono}?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            try {
              await api.clientes.delete(c.telefono);
              refetch();
            } catch {
              Alert.alert('Error', 'No se pudo eliminar el cliente');
            }
          },
        },
      ],
    );
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
      {/* Header */}
      <View style={styles.headerRow}>
        <Text style={styles.title}>👥 Clientes</Text>
        <TouchableOpacity style={styles.createBtn} onPress={openCreate}>
          <Text style={styles.createBtnText}>+ Nuevo</Text>
        </TouchableOpacity>
      </View>

      {/* Create / Edit form */}
      {formMode !== 'closed' && (
        <View style={styles.formCard}>
          <Text style={styles.formTitle}>
            {formMode === 'create' ? '➕ Nuevo Cliente' : '✏️ Editar Cliente'}
          </Text>
          <View style={styles.formRow}>
            <TextInput
              style={styles.formInput}
              placeholder="Teléfono *"
              placeholderTextColor={colors.placeholder}
              value={formData.telefono}
              onChangeText={v => setFormData(p => ({ ...p, telefono: v }))}
              keyboardType="number-pad"
              editable={formMode === 'create'} // can't change phone on edit
            />
            <TextInput
              style={styles.formInput}
              placeholder="Nombre"
              placeholderTextColor={colors.placeholder}
              value={formData.clienteNombre}
              onChangeText={v => setFormData(p => ({ ...p, clienteNombre: v }))}
            />
          </View>
          <View style={styles.formRow}>
            <TextInput
              style={styles.formInput}
              placeholder="Dirección 1"
              placeholderTextColor={colors.placeholder}
              value={formData.direccion}
              onChangeText={v => setFormData(p => ({ ...p, direccion: v }))}
            />
          </View>
          <View style={styles.formRow}>
            <TextInput
              style={styles.formInput}
              placeholder="Dirección 2 (opcional)"
              placeholderTextColor={colors.placeholder}
              value={formData.direccionDos}
              onChangeText={v => setFormData(p => ({ ...p, direccionDos: v }))}
            />
            <TextInput
              style={styles.formInput}
              placeholder="Dirección 3 (opcional)"
              placeholderTextColor={colors.placeholder}
              value={formData.direccionTres}
              onChangeText={v => setFormData(p => ({ ...p, direccionTres: v }))}
            />
          </View>
          {formError ? <Text style={styles.errorText}>{formError}</Text> : null}
          <View style={styles.formBtnRow}>
            <TouchableOpacity style={styles.formCancelBtn} onPress={resetForm}>
              <Text style={styles.formCancelBtnText}>Cancelar</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.formSaveBtn} onPress={handleSave} disabled={formLoading}>
              <Text style={styles.formSaveBtnText}>{formLoading ? 'Guardando...' : 'Guardar'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Search */}
      <View style={styles.searchContainer}>
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Buscar por teléfono</Text>
          <TextInput
            value={telefono}
            onChangeText={setTelefono}
            placeholder="3001234567"
            placeholderTextColor={colors.placeholder}
            style={styles.input}
            keyboardType="number-pad"
          />
        </View>
        <TouchableOpacity
          onPress={() => telefono && fetchClient(telefono)}
          style={styles.searchButton}
          disabled={!telefono || searching}
        >
          <Text style={styles.buttonText}>{searching ? '...' : 'Buscar'}</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={refetch} style={styles.refreshButton} disabled={loading}>
          <Text style={styles.buttonText}>{loading ? '...' : 'Refrescar'}</Text>
        </TouchableOpacity>
      </View>

      {searchError ? <Text style={styles.errorText}>⚠️ {searchError}</Text> : null}
      {client && (
        <View style={styles.resultCard}>
          <Text style={styles.resultTitle}>Resultado</Text>
          <Text style={styles.resultText}>Nombre: {client.clienteNombre || '—'}</Text>
          <Text style={styles.resultText}>Dirección: {client.direccion || '—'}</Text>
          {client.direccionDos ? <Text style={styles.resultText}>Dir 2: {client.direccionDos}</Text> : null}
          {client.direccionTres ? <Text style={styles.resultText}>Dir 3: {client.direccionTres}</Text> : null}
        </View>
      )}

      {/* Error / Loading */}
      {error ? <Text style={styles.errorText}>⚠️ {error}</Text> : null}
      {loading && <Text style={styles.emptyText}>Cargando clientes...</Text>}

      {/* Client list */}
      {data.length === 0 && !loading && !error ? (
        <Text style={styles.emptyText}>Sin clientes registrados</Text>
      ) : null}

      {data.map((item) => (
        <View key={item.telefono} style={styles.clientCard}>
          <View style={styles.clientHeader}>
            <Text style={styles.clientName}>{item.clienteNombre || 'Sin nombre'}</Text>
            <View style={styles.clientActions}>
              <TouchableOpacity style={styles.editBtn} onPress={() => openEdit(item)}>
                <Text style={styles.actionBtnText}>Editar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.deleteBtn} onPress={() => handleDelete(item)}>
                <Text style={styles.actionBtnText}>Eliminar</Text>
              </TouchableOpacity>
            </View>
          </View>
          <Text style={styles.clientPhone}>📞 {item.telefono}</Text>
          {item.direccion ? <Text style={styles.clientAddress}>📍 {item.direccion}</Text> : null}
          {item.direccionDos ? <Text style={styles.clientAddress}>📍 {item.direccionDos}</Text> : null}
          {item.direccionTres ? <Text style={styles.clientAddress}>📍 {item.direccionTres}</Text> : null}
        </View>
      ))}
    </ScrollView>
  );
}