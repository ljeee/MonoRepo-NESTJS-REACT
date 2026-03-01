import React, { useState } from 'react';
import { RefreshControl, StyleSheet, Text, View } from 'react-native';
import { api } from '../services/api';
import { Cliente, CreateClienteDto } from '../types/models';
import { useClientByPhone } from '../hooks/use-client-by-phone';
import { useClientesList } from '../hooks/use-clientes-list';
import { colors } from '../styles/theme';
import { fontSize, fontWeight, spacing, radius } from '../styles/tokens';
import {
  PageContainer,
  PageHeader,
  Button,
  Card,
  Input,
  Icon,
  ConfirmModal,
  ListSkeleton,
} from '../components/ui';

type FormMode = 'closed' | 'create' | 'edit';

export default function ClientesScreen() {
  const { data, loading, error, refetch } = useClientesList();
  const { client, loading: searching, error: searchError, fetchClient } = useClientByPhone();
  const [telefono, setTelefono] = useState('');
  const [refreshing, setRefreshing] = useState(false);

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
  const [editingPhone, setEditingPhone] = useState('');

  // ── Delete modal state ──
  const [deleteTarget, setDeleteTarget] = useState<Cliente | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

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

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleteLoading(true);
    try {
      await api.clientes.delete(deleteTarget.telefono);
      refetch();
      setDeleteTarget(null);
    } catch {
      // Show inline error
    } finally {
      setDeleteLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  };

  return (
    <PageContainer
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={handleRefresh}
          tintColor={colors.primary}
          colors={[colors.primary]}
        />
      }
    >
      <PageHeader
        title="Clientes"
        icon="account-group-outline"
        rightContent={
          <Button
            title="Nuevo"
            icon="plus"
            variant="primary"
            size="sm"
            onPress={openCreate}
          />
        }
      />

      {/* ── Create / Edit form ── */}
      {formMode !== 'closed' && (
        <Card variant="elevated" padding="lg" style={styles.cardMarginXl}>
          <View style={styles.formHeader}>
            <Icon
              name={formMode === 'create' ? 'account-plus-outline' : 'account-edit-outline'}
              size={22}
              color={colors.primary}
            />
            <Text style={styles.formTitle}>
              {formMode === 'create' ? 'Nuevo Cliente' : 'Editar Cliente'}
            </Text>
          </View>

          <View style={styles.formGrid}>
            <Input
              label="Teléfono *"
              value={formData.telefono}
              onChangeText={(v) => setFormData((p) => ({ ...p, telefono: v }))}
              keyboardType="number-pad"
              containerStyle={styles.inputContainer}
              editable={formMode === 'create'}
              leftIcon={<Icon name="phone-outline" size={16} color={colors.textMuted} />}
            />
            <Input
              label="Nombre"
              value={formData.clienteNombre}
              onChangeText={(v) => setFormData((p) => ({ ...p, clienteNombre: v }))}
              containerStyle={styles.inputContainer}
              leftIcon={<Icon name="account-outline" size={16} color={colors.textMuted} />}
            />
          </View>

          <Input
            label="Dirección 1"
            value={formData.direccion}
            onChangeText={(v) => setFormData((p) => ({ ...p, direccion: v }))}
            leftIcon={<Icon name="map-marker-outline" size={16} color={colors.textMuted} />}
          />

          <View style={styles.formGrid}>
            <Input
              label="Dirección 2 (opcional)"
              value={formData.direccionDos}
              onChangeText={(v) => setFormData((p) => ({ ...p, direccionDos: v }))}
              containerStyle={styles.inputContainer}
            />
            <Input
              label="Dirección 3 (opcional)"
              value={formData.direccionTres}
              onChangeText={(v) => setFormData((p) => ({ ...p, direccionTres: v }))}
              containerStyle={styles.inputContainer}
            />
          </View>

          {formError ? (
            <View style={styles.inlineError}>
              <Icon name="alert-circle-outline" size={14} color={colors.danger} />
              <Text style={styles.inlineErrorText}>{formError}</Text>
            </View>
          ) : null}

          <View style={styles.formActions}>
            <Button title="Cancelar" onPress={resetForm} variant="ghost" />
            <Button
              title={formLoading ? 'Guardando...' : 'Guardar'}
              onPress={handleSave}
              variant="primary"
              icon="content-save-outline"
              loading={formLoading}
            />
          </View>
        </Card>
      )}

      {/* ── Search ── */}
      <View style={styles.searchRow}>
        <Input
          label="Buscar por teléfono"
          value={telefono}
          onChangeText={setTelefono}
          placeholder="3001234567"
          keyboardType="number-pad"
          containerStyle={styles.searchInputContainer}
          leftIcon={<Icon name="magnify" size={16} color={colors.textMuted} />}
        />
        <View style={styles.searchActions}>
          <Button
            title={searching ? '...' : 'Buscar'}
            onPress={() => telefono && fetchClient(telefono)}
            variant="primary"
            size="sm"
            disabled={!telefono || searching}
            icon="magnify"
          />
          <Button
            title="Refrescar"
            icon="refresh"
            onPress={refetch}
            variant="ghost"
            size="sm"
            loading={loading}
          />
        </View>
      </View>

      {searchError ? (
        <View style={styles.inlineError}>
          <Icon name="alert-circle-outline" size={14} color={colors.danger} />
          <Text style={styles.inlineErrorText}>{searchError}</Text>
        </View>
      ) : null}

      {client && (
        <Card padding="md" style={styles.searchResultCard}>
          <Text style={styles.resultTitle}>Resultado de búsqueda</Text>
          <View style={styles.resultRow}>
            <Icon name="account-outline" size={16} color={colors.textMuted} />
            <Text style={styles.resultText}>{client.clienteNombre || '—'}</Text>
          </View>
          <View style={styles.resultRow}>
            <Icon name="map-marker-outline" size={16} color={colors.textMuted} />
            <Text style={styles.resultText}>{client.direccion || '—'}</Text>
          </View>
          {client.direccionDos && (
            <View style={styles.resultRow}>
              <Icon name="map-marker-outline" size={16} color={colors.textMuted} />
              <Text style={styles.resultText}>{client.direccionDos}</Text>
            </View>
          )}
        </Card>
      )}

      {/* ── Error / Loading ── */}
      {error && (
        <View style={styles.inlineError}>
          <Icon name="alert-circle-outline" size={14} color={colors.danger} />
          <Text style={styles.inlineErrorText}>{error}</Text>
        </View>
      )}
      {loading && <ListSkeleton count={4} />}

      {/* ── Client list ── */}
      {!loading && data.length === 0 && !error && (
        <View style={styles.emptyBox}>
          <Icon name="account-off-outline" size={48} color={colors.textMuted} />
          <Text style={styles.emptyText}>Sin clientes registrados</Text>
        </View>
      )}

      {!loading && data.map((item) => (
        <Card key={item.telefono} padding="md" style={styles.cardMarginMd}>
          <View style={styles.clientHeader}>
            <View style={styles.clientInfo}>
              <Text style={styles.clientName}>{item.clienteNombre || 'Sin nombre'}</Text>
              <View style={styles.clientPhoneRow}>
                <Icon name="phone-outline" size={14} color={colors.primary} />
                <Text style={styles.clientPhone}>{item.telefono}</Text>
              </View>
            </View>
            <View style={styles.clientActions}>
              <Button
                title="Editar"
                icon="pencil-outline"
                variant="ghost"
                size="sm"
                onPress={() => openEdit(item)}
              />
              <Button
                title="Eliminar"
                icon="trash-can-outline"
                variant="ghost"
                size="sm"
                onPress={() => setDeleteTarget(item)}
                style={styles.opacityMuted}
              />
            </View>
          </View>
          {item.direccion && (
            <View style={styles.addressRow}>
              <Icon name="map-marker-outline" size={14} color={colors.textMuted} />
              <Text style={styles.addressText}>{item.direccion}</Text>
            </View>
          )}
          {item.direccionDos && (
            <View style={styles.addressRow}>
              <Icon name="map-marker-outline" size={14} color={colors.textMuted} />
              <Text style={styles.addressText}>{item.direccionDos}</Text>
            </View>
          )}
          {item.direccionTres && (
            <View style={styles.addressRow}>
              <Icon name="map-marker-outline" size={14} color={colors.textMuted} />
              <Text style={styles.addressText}>{item.direccionTres}</Text>
            </View>
          )}
        </Card>
      ))}

      {/* ── Delete Confirmation Modal ── */}
      <ConfirmModal
        visible={!!deleteTarget}
        title="Eliminar cliente"
        message={`¿Estás seguro de eliminar a ${deleteTarget?.clienteNombre || deleteTarget?.telefono}? Esta acción no se puede deshacer.`}
        icon="trash-can-outline"
        variant="danger"
        confirmText="Eliminar"
        loading={deleteLoading}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </PageContainer>
  );
}

const styles = StyleSheet.create({
  formHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.xl,
  },
  formTitle: {
    fontSize: fontSize.xl,
    fontWeight: fontWeight.bold,
    color: colors.text,
  },
  formGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  formActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: spacing.md,
    marginTop: spacing.md,
  },
  inlineError: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginBottom: spacing.md,
    padding: spacing.sm,
    backgroundColor: colors.dangerLight,
    borderRadius: radius.sm,
  },
  inlineErrorText: {
    color: colors.danger,
    fontSize: fontSize.sm,
    fontWeight: fontWeight.medium,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.md,
    marginBottom: spacing.xl,
    flexWrap: 'wrap',
  },
  searchActions: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  resultTitle: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.bold,
    color: colors.primary,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: spacing.md,
  },
  resultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.xs,
  },
  resultText: {
    fontSize: fontSize.md,
    color: colors.textSecondary,
  },
  emptyBox: {
    alignItems: 'center',
    padding: spacing['5xl'],
    gap: spacing.md,
  },
  emptyText: {
    fontSize: fontSize.lg,
    color: colors.textMuted,
  },
  clientHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  clientInfo: {
    flex: 1,
    minWidth: 150,
  },
  clientName: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold,
    color: colors.text,
    marginBottom: spacing.xs,
  },
  clientPhoneRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  clientPhone: {
    fontSize: fontSize.sm,
    color: colors.primary,
    fontWeight: fontWeight.semibold,
  },
  clientActions: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  addressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: spacing.xs,
  },
  addressText: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
  },
  cardMarginXl: {
    marginBottom: spacing.xl,
  },
  inputContainer: {
    flex: 1,
    minWidth: 200,
  },
  searchInputContainer: {
    flex: 1,
    minWidth: 200,
    marginBottom: 0,
  },
  searchResultCard: {
    marginBottom: spacing.xl,
    borderLeftWidth: 3,
    borderLeftColor: colors.primary,
  },
  cardMarginMd: {
    marginBottom: spacing.md,
  },
  opacityMuted: {
    opacity: 0.7,
  },
});