import React, { useState, useEffect, useMemo } from 'react';
import { RefreshControl } from 'react-native';
import { api } from '../../services/api';
import type { Cliente, CreateClienteDto } from '@monorepo/shared';
import { useClientByPhone } from '@monorepo/shared';
import { useClientesList } from '@monorepo/shared';
import { ScrollView, View, Text, TouchableOpacity } from '../../tw';
import {
  PageContainer,
  PageHeader,
  Button,
  Card,
  Input,
  Icon,
  ConfirmModal,
  ListSkeleton,
  Badge,
} from '../../components/ui';

type FormMode = 'closed' | 'create' | 'edit';

interface ClienteStats {
  clienteNombre: string;
  totalOrdenes: number;
  gastoTotal: number;
  ultimaVisita: string;
}

function formatCurrency(n: number) {
  return n.toLocaleString('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 });
}

function timeAgo(dateStr: string): string {
  if (!dateStr) return '—';
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Ahora';
  if (mins < 60) return `Hace ${mins} min`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `Hace ${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `Hace ${days}d`;
  return `Hace ${Math.floor(days / 30)} mes${Math.floor(days / 30) > 1 ? 'es' : ''}`;
}

export default function ClientesScreen() {
  const { data, loading, error, refetch } = useClientesList();
  const { client, loading: searching, error: searchError, fetchClient } = useClientByPhone();
  const [telefono, setTelefono] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [frecuentes, setFrecuentes] = useState<ClienteStats[]>([]);

  // ── Form state ──
  const [formMode, setFormMode] = useState<FormMode>('closed');
  const [formData, setFormData] = useState<CreateClienteDto>({
    telefono: '',
    clienteNombre: '',
    tipoDocumento: '',
    documento: '',
    correo: '',
  });
  const [formLoading, setFormLoading] = useState(false);
  const [formError, setFormError] = useState('');
  const [editingPhone, setEditingPhone] = useState('');

  // ── Address state ──
  const [newAddress, setNewAddress] = useState('');
  const [newAddressInput, setNewAddressInput] = useState('');
  const [addingAddress, setAddingAddress] = useState<string | null>(null);

  // ── Delete modal state ──
  const [deleteTarget, setDeleteTarget] = useState<Cliente | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // ── Fetch stats ──
  useEffect(() => {
    api.estadisticas.clientesFrecuentes(200)
      .then(setFrecuentes)
      .catch(() => { /* ignore */ });
  }, [data]);

  const statsMap = useMemo(() => {
    const map = new Map<string, ClienteStats>();
    for (const f of frecuentes) {
      if (f.clienteNombre) map.set(f.clienteNombre.toLowerCase(), f);
    }
    return map;
  }, [frecuentes]);

  const getStats = (c: Cliente) => {
    const name = (c.clienteNombre || '').toLowerCase();
    return name ? statsMap.get(name) : undefined;
  };

  const resetForm = () => {
    setFormMode('closed');
    setFormData({ telefono: '', clienteNombre: '', tipoDocumento: '', documento: '', correo: '' });
    setFormError('');
    setEditingPhone('');
    setNewAddress('');
  };

  const openCreate = () => {
    setFormMode('create');
    setFormData({ telefono: '', clienteNombre: '', tipoDocumento: '', documento: '', correo: '' });
    setFormError('');
    setNewAddress('');
  };

  const openEdit = (c: Cliente) => {
    setFormMode('edit');
    setEditingPhone(c.telefono);
    setFormData({
      telefono: c.telefono,
      clienteNombre: c.clienteNombre || '',
      tipoDocumento: c.tipoDocumento || '',
      documento: c.documento || '',
      correo: c.correo || '',
    });
    setFormError('');
    setNewAddressInput('');
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
        if (newAddress.trim()) {
          await api.clientes.addDireccion(formData.telefono, newAddress.trim());
        }
      } else {
        await api.clientes.update(editingPhone, formData);
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

  const handleAddAddress = async (tel: string) => {
    if (!newAddressInput.trim()) return;
    setAddingAddress(tel);
    try {
      await api.clientes.addDireccion(tel, newAddressInput.trim());
      setNewAddressInput('');
      refetch();
    } catch {
      setFormError('Error al agregar dirección');
      setAddingAddress(null);
      return;
    }

    setAddingAddress(null);
  };

  const handleRemoveAddress = async (id: number) => {
    try {
      await api.clientes.removeDireccion(id);
      refetch();
    } catch {
      setFormError('Error al eliminar dirección');
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
        title="Directorio de Clientes"
        subtitle="Gestión de fidelidad"
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
        <Card className="mb-8 p-6">
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 16 }}>
            <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: 'rgba(245,165,36,0.1)', alignItems: 'center', justifyContent: 'center' }}>
              <Icon
                name={formMode === 'create' ? 'account-plus-outline' : 'account-edit-outline'}
                size={20}
                color="#F5A524"
              />
            </View>
            <Text style={{ fontFamily: 'SpaceGrotesk-Bold', color: '#F8FAFC', fontSize: 15, textTransform: 'uppercase', letterSpacing: 1 }}>
              {formMode === 'create' ? 'Nuevo Cliente' : 'Editar Cliente'}
            </Text>
          </View>

          <View className="gap-y-4">
            <View className="flex-row flex-wrap gap-4">
              <Input
                label="Teléfono *"
                value={formData.telefono}
                onChangeText={(v) => setFormData((p) => ({ ...p, telefono: v }))}
                keyboardType="number-pad"
                className="flex-1 min-w-[140px]"
                editable={formMode === 'create'}
                leftIcon={<Icon name="phone-outline" size={16} color="#475569" />}
              />
              <Input
                label="Nombre"
                value={formData.clienteNombre}
                onChangeText={(v) => setFormData((p) => ({ ...p, clienteNombre: v }))}
                className="flex-1 min-w-[200px]"
                leftIcon={<Icon name="account-outline" size={16} color="#475569" />}
              />
            </View>
            
            <View className="flex-row flex-wrap gap-4">
              <Input
                label="Tipo Documento"
                value={formData.tipoDocumento}
                onChangeText={(v) => setFormData((p) => ({ ...p, tipoDocumento: v }))}
                className="flex-1 min-w-[140px]"
                placeholder="CC, NIT..."
                leftIcon={<Icon name="card-account-details-outline" size={16} color="#475569" />}
              />
              <Input
                label="Nº Documento"
                value={formData.documento}
                onChangeText={(v) => setFormData((p) => ({ ...p, documento: v }))}
                className="flex-1 min-w-[160px]"
                leftIcon={<Icon name="identifier" size={16} color="#475569" />}
                keyboardType="number-pad"
              />
            </View>

            <Input
              label="Correo Electrónico"
              value={formData.correo}
              onChangeText={(v) => setFormData((p) => ({ ...p, correo: v }))}
              leftIcon={<Icon name="email-outline" size={16} color="#475569" />}
              keyboardType="email-address"
            />

            {/* Section for Direcciones */}
            {formMode === 'create' && (
              <Input
                label="Dirección Principal"
                value={newAddress}
                onChangeText={setNewAddress}
                placeholder="Ej. Calle 10 #20-30"
                leftIcon={<Icon name="map-marker-outline" size={16} color="#475569" />}
              />
            )}

            {formMode === 'edit' && (() => {
              const editClient = data.find(c => c.telefono === editingPhone);
              const editDirs = editClient?.direcciones || [];
              return (
                <View className="mt-4 p-4 bg-white/5 rounded-2xl border border-white/5">
                  <Text className="text-white font-black text-xs uppercase tracking-widest mb-4">Direcciones Registradas</Text>
                  {editDirs.length > 0 ? (
                    editDirs.map(dir => (
                      <View key={dir.id} className="flex-row items-center gap-3 mb-3 bg-white/5 p-3 rounded-xl">
                        <Icon name="map-marker-outline" size={14} color="#F5A524" />
                        <Text className="text-slate-300 text-xs flex-1">{dir.direccion}</Text>
                        <TouchableOpacity 
                          onPress={() => handleRemoveAddress(dir.id)}
                          className="w-8 h-8 items-center justify-center rounded-lg active:bg-red-500/20"
                        >
                          <Icon name="trash-can-outline" size={14} color="#EF4444" />
                        </TouchableOpacity>
                      </View>
                    ))
                  ) : (
                    <Text className="text-slate-500 text-xs italic mb-4">Sin direcciones registradas</Text>
                  )}
                  
                  <View className="flex-row items-center gap-2 mt-2">
                    <Input
                      placeholder="Nueva dirección..."
                      value={newAddressInput}
                      onChangeText={setNewAddressInput}
                      className="flex-1"
                      size="sm"
                    />
                    <Button
                      title="+"
                      variant="primary"
                      size="sm"
                      onPress={() => handleAddAddress(editingPhone)}
                      disabled={!newAddressInput.trim() || addingAddress === editingPhone}
                      loading={addingAddress === editingPhone}
                      className="h-10 w-10 p-0 items-center justify-center"
                    />
                  </View>
                </View>
              );
            })()}
          </View>

          {formError ? (
            <View className="flex-row items-center gap-2 bg-red-500/10 p-3 rounded-xl border border-red-500/20 mt-6">
              <Icon name="alert-circle-outline" size={14} color="#EF4444" />
              <Text className="text-red-400 text-xs font-bold">{formError}</Text>
            </View>
          ) : null}

          <View className="flex-row justify-end gap-3 mt-8">
            <Button title="Cancelar" onPress={resetForm} variant="ghost" />
            <Button
              title={formMode === 'create' ? 'Crear Cliente' : 'Guardar Cambios'}
              onPress={handleSave}
              variant="primary"
              icon="content-save-outline"
              loading={formLoading}
            />
          </View>
        </Card>
      )}

      {/* ── Search Bar ── */}
      <Card className="mb-6 p-4 flex-row items-center gap-3">
        <Input
          placeholder="Buscar teléfono..."
          value={telefono}
          onChangeText={setTelefono}
          keyboardType="number-pad"
          className="flex-1"
          size="sm"
          leftIcon={<Icon name="magnify" size={18} color="#64748B" />}
        />
        <Button
          title={searching ? '...' : 'Buscar'}
          onPress={() => telefono && fetchClient(telefono)}
          variant="secondary"
          size="sm"
          disabled={!telefono || searching}
        />
      </Card>

      {searchError ? (
        <View className="flex-row items-center gap-2 bg-red-500/10 p-3 rounded-xl border border-red-500/20 mb-6">
          <Icon name="alert-circle-outline" size={14} color="#EF4444" />
          <Text className="text-red-400 text-xs font-bold">{searchError}</Text>
        </View>
      ) : null}

      {client && (
        <Card className="mb-8 p-5 border-2 border-(--color-pos-primary)/20 bg-(--color-pos-primary)/5">
          <Text className="text-(--color-pos-primary) font-black text-xs uppercase tracking-widest mb-4">Resultado de búsqueda</Text>
          <View className="flex-row items-center gap-3 mb-2">
            <Icon name="account-outline" size={18} color="#FFF" />
            <Text className="text-white font-black text-lg">{client.clienteNombre || 'Sin nombre'}</Text>
          </View>
          <View className="flex-row items-start gap-3">
            <Icon name="map-marker-outline" size={18} color="#64748B" />
            <Text className="text-slate-400 text-xs flex-1">
              {client.direcciones?.length ? client.direcciones.map(d => d.direccion).join(' • ') : 'Sin direcciones'}
            </Text>
          </View>
        </Card>
      )}

      {/* ── Client List ── */}
      {loading && <ListSkeleton count={4} />}
      {!loading && data.length === 0 && !error && (
        <View className="items-center py-20 opacity-40">
          <Icon name="account-off-outline" size={64} color="#64748B" />
          <Text className="text-slate-500 font-bold mt-4 uppercase tracking-wider text-sm">Sin clientes registrados</Text>
        </View>
      )}

      <View className="gap-y-4 pb-10">
        {!loading && data.map((item) => {
          const stats = getStats(item);
          return (
            <Card key={item.telefono} className="overflow-hidden">
              <View className="flex-row justify-between items-start mb-4">
                <View className="flex-1">
                    <Text style={{ fontFamily: 'SpaceGrotesk-Bold', color: '#F8FAFC', fontSize: 16 }}>{item.clienteNombre || 'Sin nombre'}</Text>
                  <View className="flex-row items-center gap-1.5 mt-1">
                    <Icon name="phone-outline" size={12} color="#F5A524" />
                    <Text className="text-slate-400 text-xs font-bold">{item.telefono}</Text>
                  </View>
                </View>
                <View className="flex-row gap-1">
                  <TouchableOpacity 
                    onPress={() => openEdit(item)}
                    className="w-10 h-10 items-center justify-center rounded-xl bg-white/5 border border-white/5 active:bg-white/10"
                  >
                    <Icon name="pencil-outline" size={16} color="#F5A524" />
                  </TouchableOpacity>
                  <TouchableOpacity 
                    onPress={() => setDeleteTarget(item)}
                    className="w-10 h-10 items-center justify-center rounded-xl bg-white/5 border border-white/5 active:bg-red-500/20"
                  >
                    <Icon name="trash-can-outline" size={16} color="#EF4444" />
                  </TouchableOpacity>
                </View>
              </View>

              {/* ── Stats Indicators ── */}
              {stats && (
                <View className="bg-white/5 rounded-2xl p-4 mb-4 border border-white/5">
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 }}>
                    <View style={{ flex: 1, alignItems: 'center', borderRightWidth: 1, borderRightColor: 'rgba(255,255,255,0.05)' }}>
                      <Text style={{ fontFamily: 'SpaceGrotesk-Bold', color: '#F8FAFC', fontSize: 16 }}>{stats.totalOrdenes}</Text>
                      <Text style={{ fontFamily: 'Outfit', color: '#475569', fontSize: 9, textTransform: 'uppercase', letterSpacing: 1 }}>Órdenes</Text>
                    </View>
                    <View style={{ flex: 1, alignItems: 'center', borderRightWidth: 1, borderRightColor: 'rgba(255,255,255,0.05)' }}>
                      <Text style={{ fontFamily: 'SpaceGrotesk-Bold', color: '#34D399', fontSize: 16 }}>${formatCurrency(stats.gastoTotal).replace('$', '')}</Text>
                      <Text style={{ fontFamily: 'Outfit', color: '#475569', fontSize: 9, textTransform: 'uppercase', letterSpacing: 1 }}>Gasto Total</Text>
                    </View>
                    <View style={{ flex: 1, alignItems: 'center' }}>
                      <Text style={{ fontFamily: 'SpaceGrotesk-Bold', color: '#60A5FA', fontSize: 16 }}>${formatCurrency(Math.round(stats.gastoTotal / stats.totalOrdenes)).replace('$', '')}</Text>
                      <Text style={{ fontFamily: 'Outfit', color: '#475569', fontSize: 9, textTransform: 'uppercase', letterSpacing: 1 }}>Ticket Prom.</Text>
                    </View>
                  </View>
                  
                  {stats.ultimaVisita && (
                    <View className="flex-row items-center justify-center gap-2 pt-3 border-t border-white/5">
                      <Icon name="clock-outline" size={10} color="#3b82f6" />
                      <Text className="text-blue-400/70 text-[10px] uppercase font-black tracking-wider">
                        Última visita: {timeAgo(stats.ultimaVisita)}
                      </Text>
                    </View>
                  )}
                </View>
              )}

              {/* ── Addresses ── */}
              <View className="gap-y-2">
                {item.direcciones && item.direcciones.length > 0 ? (
                  item.direcciones.map((dir) => (
                    <View key={dir.id} className="flex-row items-center gap-2">
                      <Icon name="map-marker-outline" size={12} color="#64748B" />
                      <Text className="text-slate-400 text-xs flex-1" numberOfLines={1}>{dir.direccion}</Text>
                    </View>
                  ))
                ) : (
                  <View className="flex-row items-center gap-2 opacity-50">
                    <Icon name="map-marker-outline" size={12} color="#64748B" />
                    <Text className="text-slate-500 text-xs italic">Sin direcciones</Text>
                  </View>
                )}
              </View>
            </Card>
          );
        })}
      </View>

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
