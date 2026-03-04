import React, { useState, useEffect, useMemo } from 'react';
import { RefreshControl, Text, View } from 'react-native';
import { api } from '../services/api';
import { Cliente, CreateClienteDto } from '../types/models';
import { useClientByPhone } from '../hooks/use-client-by-phone';
import { useClientesList } from '../hooks/use-clientes-list';
import { colors } from '../styles/theme';
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
import { clientesStyles as styles } from '../styles/clientes/clientes.styles';

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
      // Show inline error
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
          tintColor={colors.primary}
          colors={[colors.primary]}
        />
      }
    >
      <PageHeader
        title="Clientes"
        icon="account-group-outline"
        rightContent={
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            {data.length > 0 && (
              <Text style={styles.headerCount}>{data.length} registrados</Text>
            )}
            <Button
              title="Nuevo"
              icon="plus"
              variant="primary"
              size="sm"
              onPress={openCreate}
            />
          </View>
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
            <Input
              label="Tipo Documento (CC, NIT, etc.)"
              value={formData.tipoDocumento}
              onChangeText={(v) => setFormData((p) => ({ ...p, tipoDocumento: v }))}
              containerStyle={styles.inputContainer}
              leftIcon={<Icon name="card-account-details-outline" size={16} color={colors.textMuted} />}
            />
            <Input
              label="Nº Documento"
              value={formData.documento}
              onChangeText={(v) => setFormData((p) => ({ ...p, documento: v }))}
              containerStyle={styles.inputContainer}
              leftIcon={<Icon name="identifier" size={16} color={colors.textMuted} />}
              keyboardType="number-pad"
            />
            <Input
              label="Correo Electrónico"
              value={formData.correo}
              onChangeText={(v) => setFormData((p) => ({ ...p, correo: v }))}
              containerStyle={styles.inputContainer}
              leftIcon={<Icon name="email-outline" size={16} color={colors.textMuted} />}
              keyboardType="email-address"
            />
          </View>

          {/* Section for Direcciones */}
          {formMode === 'create' && (
            <View style={{ marginTop: 16 }}>
              <Input
                label="Dirección (Opcional)"
                value={newAddress}
                onChangeText={setNewAddress}
                placeholder="Ej. Calle 10 #20-30"
                leftIcon={<Icon name="map-marker-outline" size={16} color={colors.textMuted} />}
              />
            </View>
          )}

          {formMode === 'edit' && (() => {
            const editClient = data.find(c => c.telefono === editingPhone);
            const editDirs = editClient?.direcciones || [];
            return (
              <View style={{ marginTop: 16 }}>
                <Text style={{ fontWeight: '600', marginBottom: 8 }}>Direcciones</Text>
                {editDirs.length > 0 ? (
                  editDirs.map(dir => (
                    <View key={dir.id} style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
                      <Icon name="map-marker-outline" size={14} color={colors.textMuted} style={{ marginRight: 6 }} />
                      <Text style={{ flex: 1, fontSize: 13, color: colors.text }}>{dir.direccion}</Text>
                      <Button
                        title=""
                        icon="trash-can-outline"
                        variant="ghost"
                        size="sm"
                        onPress={() => handleRemoveAddress(dir.id)}
                        style={{ padding: 4 }}
                      />
                    </View>
                  ))
                ) : (
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
                    <Icon name="map-marker-outline" size={14} color={colors.textMuted} style={{ marginRight: 6 }} />
                    <Text style={{ fontSize: 13, color: colors.textMuted }}>Sin direcciones registradas</Text>
                  </View>
                )}
                <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 8 }}>
                  <Input
                    label=""
                    placeholder="Añadir nueva dirección"
                    value={newAddressInput}
                    onChangeText={setNewAddressInput}
                    containerStyle={{ flex: 1, marginRight: 8, marginBottom: 0 }}
                  />
                  <Button
                    title="Añadir"
                    variant="primary"
                    size="sm"
                    onPress={() => handleAddAddress(editingPhone)}
                    disabled={!newAddressInput.trim() || addingAddress === editingPhone}
                    loading={addingAddress === editingPhone}
                  />
                </View>
              </View>
            );
          })()}

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
            <Text style={styles.resultText}>
              {client.direcciones?.length ? client.direcciones.map(d => d.direccion).join(' | ') : 'Sin direcciones'}
            </Text>
          </View>
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

      {!loading && data.map((item) => {
        const stats = getStats(item);
        return (
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

            {/* ── Stats Row ── */}
            {stats && (
              <>
                <View style={styles.statsRow}>
                  <View style={styles.statItem}>
                    <Text style={styles.statValuePrimary}>{stats.totalOrdenes}</Text>
                    <Text style={styles.statLabel}>Órdenes</Text>
                  </View>
                  <View style={styles.statItem}>
                    <Text style={styles.statValueSuccess}>{formatCurrency(stats.gastoTotal)}</Text>
                    <Text style={styles.statLabel}>Gasto Total</Text>
                  </View>
                  <View style={styles.statItem}>
                    <Text style={styles.statValueInfo}>
                      {formatCurrency(Math.round(stats.gastoTotal / stats.totalOrdenes))}
                    </Text>
                    <Text style={styles.statLabel}>Ticket Prom.</Text>
                  </View>
                </View>
                {stats.ultimaVisita && (
                  <View style={styles.lastVisitBadge}>
                    <Icon name="clock-outline" size={12} color="#3b82f6" />
                    <Text style={styles.lastVisitText}>
                      Última visita: {timeAgo(stats.ultimaVisita)}
                    </Text>
                  </View>
                )}
              </>
            )}

            {/* ── Addresses ── */}
            {item.direcciones && item.direcciones.length > 0 ? (
              item.direcciones.map((dir) => (
                <View key={dir.id} style={styles.addressRow}>
                  <Icon name="map-marker-outline" size={14} color={colors.textMuted} />
                  <Text style={styles.addressText}>{dir.direccion}</Text>
                </View>
              ))
            ) : (
              <View style={styles.addressRow}>
                <Icon name="map-marker-outline" size={14} color={colors.textMuted} />
                <Text style={[styles.addressText, { color: colors.textMuted }]}>Sin direcciones</Text>
              </View>
            )}
          </Card>
        );
      })}

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