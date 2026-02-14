
import React, { useState } from 'react';
import { ScrollView, Text, TextInput, TouchableOpacity, View, Alert } from 'react-native';
import { useDomiciliariosList } from '../../hooks/use-domiciliarios-list';
import { domiciliariosListStyles as styles } from '../../styles/domiciliarios-list.styles';
import { colors } from '../../styles/theme';
import { api } from '../../services/api';

export default function DomiciliariosList() {
  const { data, loading, error, refetch } = useDomiciliariosList();
  const [telefono, setTelefono] = useState('');
  const [formMode, setFormMode] = useState<'closed' | 'create' | 'edit'>('closed');
  const [formData, setFormData] = useState({ telefono: '', domiciliarioNombre: '' });
  const [formLoading, setFormLoading] = useState(false);
  const [formError, setFormError] = useState('');
  const [editingPhone, setEditingPhone] = useState('');

  const resetForm = () => {
    setFormMode('closed');
    setFormData({ telefono: '', domiciliarioNombre: '' });
    setFormError('');
    setEditingPhone('');
  };

  const openCreate = () => {
    setFormMode('create');
    setFormData({ telefono: '', domiciliarioNombre: '' });
    setFormError('');
  };

  const openEdit = (d: { telefono: string; domiciliarioNombre?: string }) => {
    setFormMode('edit');
    setEditingPhone(d.telefono);
    setFormData({
      telefono: d.telefono,
      domiciliarioNombre: d.domiciliarioNombre || '',
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
        await api.domiciliarios.create(formData);
      } else {
        await api.domiciliarios.update(editingPhone, formData);
      }
      resetForm();
      refetch();
    } catch (err: any) {
      setFormError(err.response?.data?.message || 'Error al guardar');
    } finally {
      setFormLoading(false);
    }
  };

  const handleDelete = (d: { telefono: string; domiciliarioNombre?: string }) => {
    Alert.alert(
      'Eliminar domiciliario',
      `¿Eliminar a ${d.domiciliarioNombre || d.telefono}?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            try {
              await api.domiciliarios.delete(d.telefono);
              refetch();
            } catch {
              Alert.alert('Error', 'No se pudo eliminar el domiciliario');
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
        <Text style={styles.title}>🛵 Domiciliarios</Text>
        <TouchableOpacity style={styles.createBtn} onPress={openCreate}>
          <Text style={styles.createBtnText}>+ Nuevo</Text>
        </TouchableOpacity>
      </View>

      {/* Create / Edit form */}
      {formMode !== 'closed' && (
        <View style={styles.formCard}>
          <Text style={styles.formTitle}>
            {formMode === 'create' ? '➕ Nuevo Domiciliario' : '✏️ Editar Domiciliario'}
          </Text>
          <View style={styles.formRow}>
            <TextInput
              style={styles.formInput}
              placeholder="Teléfono *"
              placeholderTextColor={colors.placeholder}
              value={formData.telefono}
              onChangeText={v => setFormData(p => ({ ...p, telefono: v }))}
              keyboardType="number-pad"
              editable={formMode === 'create'}
            />
            <TextInput
              style={styles.formInput}
              placeholder="Nombre"
              placeholderTextColor={colors.placeholder}
              value={formData.domiciliarioNombre}
              onChangeText={v => setFormData(p => ({ ...p, domiciliarioNombre: v }))}
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
          onPress={refetch}
          style={styles.refreshButton}
          disabled={loading}
        >
          <Text style={styles.buttonText}>{loading ? '...' : 'Refrescar'}</Text>
        </TouchableOpacity>
      </View>

      {/* Error / Loading */}
      {error ? <Text style={styles.errorText}>⚠️ {error}</Text> : null}
      {loading && <Text style={styles.emptyText}>Cargando domiciliarios...</Text>}

      {/* Domiciliario list */}
      {data.length === 0 && !loading && !error ? (
        <Text style={styles.emptyText}>Sin domiciliarios registrados</Text>
      ) : null}

      {data.map((item) => (
        <View key={item.telefono} style={styles.clientCard}>
          <View style={styles.clientHeader}>
            <Text style={styles.clientName}>{item.domiciliarioNombre || 'Sin nombre'}</Text>
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
        </View>
      ))}
    </ScrollView>
  );
}