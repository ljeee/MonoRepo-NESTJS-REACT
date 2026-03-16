import React, { useState } from 'react';
import { RefreshControl } from 'react-native';
import { useDomiciliariosList } from '@monorepo/shared';
import { api } from '../../services/api';
import { View, Text, TouchableOpacity } from '../../tw';
import { useBreakpoint } from '../../styles/responsive';
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
  const { isMobile } = useBreakpoint();
  const { data, loading, error, refetch } = useDomiciliariosList();
  const [telefonoBusqueda, setTelefonoBusqueda] = useState('');
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
      setFormLoading(false);
      return;
    }

    setFormLoading(false);
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleteLoading(true);
    try {
      await api.domiciliarios.delete(deleteTarget.telefono);
      refetch();
      setDeleteTarget(null);
    } catch {
      setDeleteLoading(false);
      return;
    }

    setDeleteLoading(false);
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  };

  const filteredData = data.filter(d => 
    d.telefono.includes(telefonoBusqueda) || 
    (d.domiciliarioNombre?.toLowerCase().includes(telefonoBusqueda.toLowerCase()))
  );

  return (
    <PageContainer
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={handleRefresh}
          tintColor="#F5A524"
          colors={["#F5A524"]}
        />
      }
    >
      <PageHeader
        title="Flota Logística"
        subtitle="Gestión de domiciliarios"
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
        <Card className="mb-8 overflow-hidden bg-slate-900 border-orange-500/20 shadow-2xl shadow-orange-500/10">
          <View className="flex-row items-center gap-3 mb-6 p-4 bg-orange-500/10 border-b border-orange-500/10">
            <Icon
              name={formMode === 'create' ? 'plus-circle-outline' : 'pencil-outline'}
              size={22}
              color="#F5A524"
            />
            <Text className="text-white font-black text-base uppercase tracking-widest" style={{ fontFamily: 'Space Grotesk' }}>
              {formMode === 'create' ? 'Registrar Domiciliario' : 'Editar Información'}
            </Text>
          </View>

          <View className="px-6 pb-6 gap-y-4">
            <View className={`${isMobile ? 'flex-col' : 'flex-row'} gap-4`}>
                <Input
                label="Número de Contacto *"
                value={formData.telefono}
                onChangeText={(v) => setFormData((p) => ({ ...p, telefono: v }))}
                keyboardType="number-pad"
                className="flex-1"
                editable={formMode === 'create'}
                placeholder="Ej. 3001234567"
                leftIcon={<Icon name="phone-outline" size={16} color="#64748B" />}
                />
                <Input
                label="Nombre Completo"
                value={formData.domiciliarioNombre}
                onChangeText={(v) => setFormData((p) => ({ ...p, domiciliarioNombre: v }))}
                className="flex-1"
                placeholder="Nombre del conductor"
                leftIcon={<Icon name="account-outline" size={16} color="#64748B" />}
                />
            </View>

            {formError ? (
                <View className="flex-row items-center gap-2 bg-red-500/10 p-3 rounded-xl border border-red-500/20">
                    <Icon name="alert-circle-outline" size={16} color="#EF4444" />
                    <Text className="text-red-400 text-xs font-black uppercase tracking-tight">{formError}</Text>
                </View>
            ) : null}

            <View className="flex-row justify-end gap-3 mt-2">
                <Button title="Cancelar" onPress={resetForm} variant="ghost" />
                <Button
                title={formLoading ? 'Guardando...' : 'Guardar Cambios'}
                onPress={handleSave}
                variant="primary"
                icon="content-save-outline"
                loading={formLoading}
                className="px-8"
                />
            </View>
          </View>
        </Card>
      )}

      {/* ── Search ── */}
      <View className="flex-row items-end gap-3 mb-8">
        <Input
          label="Filtrar por nombre o teléfono"
          value={telefonoBusqueda}
          onChangeText={setTelefonoBusqueda}
          placeholder="Buscar..."
          keyboardType="default"
          className="flex-1"
          leftIcon={<Icon name="magnify" size={18} color="#64748B" />}
        />
        <Button
          title="Recargar"
          icon="refresh"
          onPress={refetch}
          variant="secondary"
          size="md"
          loading={loading}
          className="h-11 px-4"
        />
      </View>

      {/* ── Error / Loading ── */}
      {error && (
        <View className="flex-row items-center gap-2 bg-red-500/10 p-4 rounded-xl border border-red-500/20 mb-6">
          <Icon name="alert-circle-outline" size={18} color="#EF4444" />
          <Text className="text-red-400 text-sm font-bold">{error}</Text>
        </View>
      )}
      {loading && <ListSkeleton count={4} />}

      {/* ── Domiciliario list ── */}
      {!loading && filteredData.length === 0 && !error && (
        <View className="py-20 items-center justify-center opacity-40">
          <Icon name="moped-outline" size={64} color="#94A3B8" />
          <Text className="text-slate-400 font-bold mt-4 text-center">No se encontraron domiciliarios</Text>
        </View>
      )}

      <View className="gap-y-4 pb-10">
        {!loading && filteredData.map((item) => (
            <Card key={item.telefono} className="overflow-hidden border-white/5 bg-slate-900/40">
                <View className="flex-row items-center p-4">
                    <View className="w-14 h-14 rounded-2xl bg-orange-500/10 items-center justify-center mr-4 border border-orange-500/20">
                        <Icon name="account-tie" size={28} color="#F5A524" />
                    </View>

                    <View className="flex-1">
                        <Text className="text-white font-black text-lg uppercase leading-tight" style={{ fontFamily: 'Space Grotesk' }}>
                            {item.domiciliarioNombre || 'Sin nombre'}
                        </Text>
                        <View className="flex-row items-center gap-1.5 mt-1">
                            <Icon name="phone" size={14} color="#F5A524" />
                            <Text className="text-(--color-pos-primary) font-black tracking-widest text-sm">{item.telefono}</Text>
                        </View>
                    </View>

                    <View className="flex-row gap-2">
                        <TouchableOpacity
                            onPress={() => openEdit(item)}
                            className="w-10 h-10 rounded-full bg-white/5 items-center justify-center active:bg-white/10"
                        >
                            <Icon name="pencil" size={18} color="#94A3B8" />
                        </TouchableOpacity>
                        <TouchableOpacity
                            onPress={() => setDeleteTarget(item)}
                            className="w-10 h-10 rounded-full bg-red-500/10 items-center justify-center active:bg-red-500/20"
                        >
                            <Icon name="trash-can-outline" size={18} color="#EF4444" />
                        </TouchableOpacity>
                    </View>
                </View>
            </Card>
        ))}
      </View>

      {/* ── Delete Confirmation Modal ── */}
      <ConfirmModal
        visible={!!deleteTarget}
        title="Eliminar registro"
        message={`¿Estás seguro de eliminar a ${deleteTarget?.domiciliarioNombre || deleteTarget?.telefono}? Esta acción revocará su acceso a las órdenes.`}
        icon="trash-can-outline"
        variant="danger"
        confirmText="Confirmar eliminación"
        loading={deleteLoading}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </PageContainer>
  );
}
