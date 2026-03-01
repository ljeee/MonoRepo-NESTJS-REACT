import React, { useState } from 'react';
import { RefreshControl, StyleSheet, Text, View } from 'react-native';
import { useDomiciliariosList } from '../../hooks/use-domiciliarios-list';
import { colors } from '../../styles/theme';
import { fontSize, fontWeight, spacing, radius } from '../../styles/tokens';
import { api } from '../../services/api';
import {
  PageContainer,
  PageHeader,
  Button,
  Card,
  Input,
  Icon,
  ConfirmModal,
  ListSkeleton,
} from '../ui';

type FormMode = 'closed' | 'create' | 'edit';

export default function DomiciliariosList() {
  const { data, loading, error, refetch } = useDomiciliariosList();
  const [telefono, setTelefono] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  // ── Form state ──
  const [formMode, setFormMode] = useState<FormMode>('closed');
  const [formData, setFormData] = useState({ telefono: '', domiciliarioNombre: '' });
  const [formLoading, setFormLoading] = useState(false);
  const [formError, setFormError] = useState('');
  const [editingPhone, setEditingPhone] = useState('');

  // ── Delete modal state ──
  const [deleteTarget, setDeleteTarget] = useState<{ telefono: string; domiciliarioNombre?: string } | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

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

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleteLoading(true);
    try {
      await api.domiciliarios.delete(deleteTarget.telefono);
      refetch();
      setDeleteTarget(null);
    } catch {
      // Error handled
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
        title="Domiciliarios"
        icon="moped"
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
              name={formMode === 'create' ? 'plus-circle-outline' : 'pencil-outline'}
              size={22}
              color={colors.primary}
            />
            <Text style={styles.formTitle}>
              {formMode === 'create' ? 'Nuevo Domiciliario' : 'Editar Domiciliario'}
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
              value={formData.domiciliarioNombre}
              onChangeText={(v) => setFormData((p) => ({ ...p, domiciliarioNombre: v }))}
              containerStyle={styles.inputContainer}
              leftIcon={<Icon name="account-outline" size={16} color={colors.textMuted} />}
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
            title="Refrescar"
            icon="refresh"
            onPress={refetch}
            variant="ghost"
            size="sm"
            loading={loading}
          />
        </View>
      </View>

      {/* ── Error / Loading ── */}
      {error && (
        <View style={styles.inlineError}>
          <Icon name="alert-circle-outline" size={14} color={colors.danger} />
          <Text style={styles.inlineErrorText}>{error}</Text>
        </View>
      )}
      {loading && <ListSkeleton count={4} />}

      {/* ── Domiciliario list ── */}
      {!loading && data.length === 0 && !error && (
        <View style={styles.emptyBox}>
          <Icon name="moped-outline" size={48} color={colors.textMuted} />
          <Text style={styles.emptyText}>Sin domiciliarios registrados</Text>
        </View>
      )}

      {!loading && data.map((item) => (
        <Card key={item.telefono} padding="md" style={styles.cardMarginMd}>
          <View style={styles.itemHeader}>
            <View style={styles.itemInfo}>
              <Text style={styles.itemName}>{item.domiciliarioNombre || 'Sin nombre'}</Text>
              <View style={styles.itemPhoneRow}>
                <Icon name="phone-outline" size={14} color={colors.primary} />
                <Text style={styles.itemPhone}>{item.telefono}</Text>
              </View>
            </View>
            <View style={styles.itemActions}>
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
        </Card>
      ))}

      {/* ── Delete Confirmation Modal ── */}
      <ConfirmModal
        visible={!!deleteTarget}
        title="Eliminar domiciliario"
        message={`¿Estás seguro de eliminar a ${deleteTarget?.domiciliarioNombre || deleteTarget?.telefono}? Esta acción no se puede deshacer.`}
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
    marginBottom: spacing.lg,
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
  itemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  itemInfo: {
    flex: 1,
    minWidth: 150,
  },
  itemName: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold,
    color: colors.text,
    marginBottom: spacing.xs,
  },
  itemPhoneRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  itemPhone: {
    fontSize: fontSize.sm,
    color: colors.primary,
    fontWeight: fontWeight.semibold,
  },
  itemActions: {
    flexDirection: 'row',
    gap: spacing.xs,
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
  cardMarginMd: {
    marginBottom: spacing.md,
  },
  opacityMuted: {
    opacity: 0.7,
  },
});