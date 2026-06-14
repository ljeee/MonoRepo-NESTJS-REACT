import React, {
  useState,
  useEffect,
  useMemo,
  useCallback,
  memo,
} from 'react';
import {
  Modal,
  RefreshControl,
  KeyboardAvoidingView,
  Platform,
  Pressable,
} from 'react-native';
import { api } from '../../services/api';
import type { Cliente, ClienteFrecuente, CreateClienteDto } from '@/src/shared';
import { useClientByPhone } from '@/src/shared';
import { useClientesList } from '@/src/shared';
import { ScrollView, View, Text, TouchableOpacity } from '../../tw';
import PageContainer from '../../components/ui/PageContainer';
import PageHeader from '../../components/ui/PageHeader';
import Button from '../../components/ui/Button';
import Card from '../../components/ui/Card';
import Input from '../../components/ui/Input';
import Icon from '../../components/ui/Icon';
import ConfirmModal from '../../components/ui/ConfirmModal';
import { ListSkeleton } from '../../components/ui/SkeletonLoader';
import Badge from '../../components/ui/Badge';
import { formatCurrency } from '@/src/shared';

// ─── Helpers ──────────────────────────────────────────────────────────────────

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

/** YYYY-MM-DD for the first day of the current month */
function monthStart(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
}

/** YYYY-MM-DD for today */
function today(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

const PAGE_SIZE = 20;

// ─── Podium medal colours ────────────────────────────────────────────────────

const MEDAL_COLORS = [
  { bg: 'rgba(245,165,36,0.12)', border: 'rgba(245,165,36,0.3)', text: '#F5A524', label: '🥇' },
  { bg: 'rgba(203,213,225,0.08)', border: 'rgba(203,213,225,0.25)', text: '#CBD5E1', label: '🥈' },
  { bg: 'rgba(180,120,60,0.1)', border: 'rgba(205,127,50,0.25)', text: '#CD7F32', label: '🥉' },
];

// ─── PodiumCard — top-3 del mes ────────────────────────────────────────────

const PodiumCard = memo(({ item, rank }: { item: ClienteFrecuente; rank: number }) => {
  const m = MEDAL_COLORS[rank] ?? MEDAL_COLORS[2];
  return (
    <View
      style={{
        flex: 1,
        minWidth: 120,
        backgroundColor: m.bg,
        borderWidth: 1,
        borderColor: m.border,
        borderRadius: 20,
        padding: 14,
        alignItems: 'center',
        gap: 6,
      }}
    >
      <Text style={{ fontSize: 22 }}>{m.label}</Text>
      <Text
        numberOfLines={2}
        style={{
          fontFamily: 'SpaceGrotesk-Bold',
          color: m.text,
          fontSize: 11,
          textAlign: 'center',
          textTransform: 'uppercase',
          letterSpacing: 0.5,
        }}
      >
        {item.clienteNombre}
      </Text>
      <Text style={{ fontFamily: 'SpaceGrotesk-Bold', color: '#F8FAFC', fontSize: 14 }}>
        ${formatCurrency(item.gastoTotal)}
      </Text>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, opacity: 0.7 }}>
        <Icon name="shopping-outline" size={10} color="#94A3B8" />
        <Text style={{ color: '#94A3B8', fontSize: 9, fontFamily: 'SpaceGrotesk-Bold', textTransform: 'uppercase' }}>
          {item.totalOrdenes} pedidos
        </Text>
      </View>
    </View>
  );
});

// ─── ClienteFormModal ─────────────────────────────────────────────────────────

interface FormState extends CreateClienteDto {}

interface ClienteFormModalProps {
  visible: boolean;
  mode: 'create' | 'edit';
  formData: FormState;
  setFormData: React.Dispatch<React.SetStateAction<FormState>>;
  formError: string;
  formLoading: boolean;
  editingPhone: string;
  existingDirs: { id: number; direccion: string }[];
  newAddress: string;
  setNewAddress: (v: string) => void;
  newAddressInput: string;
  setNewAddressInput: (v: string) => void;
  addingAddress: string | null;
  onSave: () => void;
  onCancel: () => void;
  onAddAddress: (tel: string) => void;
  onRemoveAddress: (id: number) => void;
}

const ClienteFormModal = memo(({
  visible,
  mode,
  formData,
  setFormData,
  formError,
  formLoading,
  editingPhone,
  existingDirs,
  newAddress,
  setNewAddress,
  newAddressInput,
  setNewAddressInput,
  addingAddress,
  onSave,
  onCancel,
  onAddAddress,
  onRemoveAddress,
}: ClienteFormModalProps) => (
  <Modal
    visible={visible}
    transparent
    animationType="slide"
    statusBarTranslucent
    onRequestClose={onCancel}
  >
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'padding'}
      style={{ flex: 1 }}
    >
      <Pressable
        style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.75)', justifyContent: 'flex-end' }}
        onPress={onCancel}
      >
        <Pressable
          style={{
            backgroundColor: '#0F172A',
            borderTopLeftRadius: 28,
            borderTopRightRadius: 28,
            borderWidth: 1,
            borderColor: 'rgba(255,255,255,0.07)',
            maxHeight: '90%',
          }}
          onPress={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 12,
              padding: 20,
              borderBottomWidth: 1,
              borderBottomColor: 'rgba(255,255,255,0.05)',
            }}
          >
            <View
              style={{
                width: 40,
                height: 40,
                borderRadius: 12,
                backgroundColor: 'rgba(245,165,36,0.1)',
                alignItems: 'center',
                justifyContent: 'center',
                borderWidth: 1,
                borderColor: 'rgba(245,165,36,0.2)',
              }}
            >
              <Icon
                name={mode === 'create' ? 'account-plus-outline' : 'account-edit-outline'}
                size={20}
                color="#F5A524"
              />
            </View>
            <Text
              style={{
                fontFamily: 'SpaceGrotesk-Bold',
                color: '#F8FAFC',
                fontSize: 16,
                textTransform: 'uppercase',
                letterSpacing: 1,
                flex: 1,
              }}
            >
              {mode === 'create' ? 'Nuevo Cliente' : 'Editar Cliente'}
            </Text>
            <TouchableOpacity
              onPress={onCancel}
              className="w-9 h-9 items-center justify-center rounded-xl bg-white/5 border border-white/5"
            >
              <Icon name="close" size={18} color="#64748B" />
            </TouchableOpacity>
          </View>

          {/* Body */}
          <ScrollView
            style={{ maxHeight: 540 }}
            contentContainerStyle={{ padding: 20, gap: 14 }}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {/* Phone + Name */}
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
              <Input
                label="Teléfono *"
                value={formData.telefono}
                onChangeText={(v) => setFormData((p) => ({ ...p, telefono: v }))}
                keyboardType="number-pad"
                containerStyle={{ flex: 1, minWidth: 140 }}
                editable={mode === 'create'}
                leftIcon={<Icon name="phone-outline" size={16} color="#475569" />}
              />
              <Input
                label="Nombre"
                value={formData.clienteNombre}
                onChangeText={(v) => setFormData((p) => ({ ...p, clienteNombre: v }))}
                containerStyle={{ flex: 2, minWidth: 180 }}
                leftIcon={<Icon name="account-outline" size={16} color="#475569" />}
              />
            </View>

            {/* Documento */}
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
              <Input
                label="Tipo Documento"
                value={formData.tipoDocumento}
                onChangeText={(v) => setFormData((p) => ({ ...p, tipoDocumento: v }))}
                containerStyle={{ flex: 1, minWidth: 120 }}
                placeholder="CC, NIT..."
                leftIcon={<Icon name="card-account-details-outline" size={16} color="#475569" />}
              />
              <Input
                label="Nº Documento"
                value={formData.documento}
                onChangeText={(v) => setFormData((p) => ({ ...p, documento: v }))}
                containerStyle={{ flex: 1, minWidth: 140 }}
                leftIcon={<Icon name="identifier" size={16} color="#475569" />}
                keyboardType="number-pad"
              />
            </View>

            {/* Correo */}
            <Input
              label="Correo Electrónico"
              value={formData.correo}
              onChangeText={(v) => setFormData((p) => ({ ...p, correo: v }))}
              leftIcon={<Icon name="email-outline" size={16} color="#475569" />}
              keyboardType="email-address"
            />

            {/* Dirección principal (create only) */}
            {mode === 'create' && (
              <Input
                label="Dirección Principal"
                value={newAddress}
                onChangeText={setNewAddress}
                placeholder="Ej. Calle 10 #20-30"
                leftIcon={<Icon name="map-marker-outline" size={16} color="#475569" />}
              />
            )}

            {/* Direcciones (edit) */}
            {mode === 'edit' && (
              <View
                style={{
                  backgroundColor: 'rgba(255,255,255,0.03)',
                  borderRadius: 16,
                  borderWidth: 1,
                  borderColor: 'rgba(255,255,255,0.06)',
                  padding: 14,
                }}
              >
                <Text className="text-white font-black text-xs uppercase tracking-widest mb-3">
                  Direcciones Registradas
                </Text>
                {existingDirs.length > 0 ? (
                  existingDirs.map((dir) => (
                    <View
                      key={dir.id}
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: 10,
                        marginBottom: 8,
                        backgroundColor: 'rgba(255,255,255,0.04)',
                        padding: 10,
                        borderRadius: 10,
                      }}
                    >
                      <Icon name="map-marker-outline" size={14} color="#F5A524" />
                      <Text className="text-slate-300 text-xs flex-1">{dir.direccion}</Text>
                      <TouchableOpacity
                        onPress={() => onRemoveAddress(dir.id)}
                        className="w-8 h-8 items-center justify-center rounded-lg active:bg-red-500/20"
                      >
                        <Icon name="trash-can-outline" size={14} color="#EF4444" />
                      </TouchableOpacity>
                    </View>
                  ))
                ) : (
                  <Text className="text-slate-500 text-xs italic mb-3">Sin direcciones registradas</Text>
                )}

                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6 }}>
                  <Input
                    placeholder="Nueva dirección..."
                    value={newAddressInput}
                    onChangeText={setNewAddressInput}
                    containerStyle={{ flex: 1, marginBottom: 0 }}
                    size="sm"
                  />
                  <Button
                    title=""
                    icon="plus"
                    variant="primary"
                    size="sm"
                    onPress={() => onAddAddress(editingPhone)}
                    disabled={!newAddressInput.trim() || addingAddress === editingPhone}
                    loading={addingAddress === editingPhone}
                  />
                </View>
              </View>
            )}

            {/* Error */}
            {!!formError && (
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 8,
                  backgroundColor: 'rgba(239,68,68,0.1)',
                  padding: 10,
                  borderRadius: 10,
                  borderWidth: 1,
                  borderColor: 'rgba(239,68,68,0.2)',
                }}
              >
                <Icon name="alert-circle-outline" size={14} color="#EF4444" />
                <Text className="text-red-400 text-xs font-bold flex-1">{formError}</Text>
              </View>
            )}
          </ScrollView>

          {/* Footer actions */}
          <View
            style={{
              flexDirection: 'row',
              justifyContent: 'flex-end',
              gap: 10,
              padding: 16,
              borderTopWidth: 1,
              borderTopColor: 'rgba(255,255,255,0.05)',
            }}
          >
            <Button title="Cancelar" onPress={onCancel} variant="ghost" />
            <Button
              title={mode === 'create' ? 'Crear Cliente' : 'Guardar Cambios'}
              onPress={onSave}
              variant="primary"
              icon="content-save-outline"
              loading={formLoading}
              disabled={!formData.telefono}
            />
          </View>
        </Pressable>
      </Pressable>
    </KeyboardAvoidingView>
  </Modal>
));

// ─── StatChip — used inside client card ───────────────────────────────────────

const StatChip = memo(({
  icon,
  label,
  value,
  color,
  bordered,
}: {
  icon: string;
  label: string;
  value: string;
  color: string;
  bordered?: boolean;
}) => (
  <View
    style={{
      flex: 1,
      alignItems: 'center',
      borderRightWidth: bordered ? 1 : 0,
      borderRightColor: 'rgba(255,255,255,0.05)',
      paddingVertical: 4,
    }}
  >
    <Text style={{ fontFamily: 'SpaceGrotesk-Bold', color, fontSize: 14, marginBottom: 2 }}>{value}</Text>
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
      <Icon name={icon} size={9} color="#475569" />
      <Text style={{ color: '#475569', fontSize: 9, textTransform: 'uppercase', letterSpacing: 0.5 }}>{label}</Text>
    </View>
  </View>
));

// ─── ClienteCard ──────────────────────────────────────────────────────────────

const ClienteCard = memo(({
  item,
  stats,
  onEdit,
  onDelete,
}: {
  item: Cliente;
  stats?: ClienteFrecuente;
  onEdit: () => void;
  onDelete: () => void;
}) => {
  const ticketProm = stats && stats.totalOrdenes > 0
    ? Math.round(stats.gastoTotal / stats.totalOrdenes)
    : 0;

  return (
    <Card className="overflow-hidden mb-4">
      {/* Header */}
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
        <View style={{ flex: 1, marginRight: 8 }}>
          {/* Avatar + name */}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 6 }}>
            <View
              style={{
                width: 38,
                height: 38,
                borderRadius: 12,
                backgroundColor: 'rgba(245,165,36,0.08)',
                alignItems: 'center',
                justifyContent: 'center',
                borderWidth: 1,
                borderColor: 'rgba(245,165,36,0.15)',
              }}
            >
              <Text style={{ fontFamily: 'SpaceGrotesk-Bold', color: '#F5A524', fontSize: 16 }}>
                {(item.clienteNombre || item.telefono).charAt(0).toUpperCase()}
              </Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text
                style={{ fontFamily: 'SpaceGrotesk-Bold', color: '#F8FAFC', fontSize: 15 }}
                numberOfLines={1}
              >
                {item.clienteNombre || 'Sin nombre'}
              </Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 }}>
                <Icon name="phone-outline" size={11} color="#F5A524" />
                <Text style={{ color: '#94A3B8', fontSize: 11, fontFamily: 'SpaceGrotesk-Bold' }}>
                  {item.telefono}
                </Text>
              </View>
            </View>
          </View>

          {/* Addresses */}
          {item.direcciones && item.direcciones.length > 0 ? (
            item.direcciones.slice(0, 2).map((dir) => (
              <View key={dir.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 3 }}>
                <Icon name="map-marker-outline" size={10} color="#475569" />
                <Text style={{ color: '#64748B', fontSize: 10, flex: 1 }} numberOfLines={1}>
                  {dir.direccion}
                </Text>
              </View>
            ))
          ) : (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Icon name="map-marker-off-outline" size={10} color="#334155" />
              <Text style={{ color: '#334155', fontSize: 10, fontStyle: 'italic' }}>Sin direcciones</Text>
            </View>
          )}
          {item.direcciones && item.direcciones.length > 2 && (
            <Text style={{ color: '#475569', fontSize: 9, marginTop: 2 }}>+{item.direcciones.length - 2} más</Text>
          )}
        </View>

        {/* Actions */}
        <View style={{ flexDirection: 'row', gap: 6 }}>
          <TouchableOpacity
            onPress={onEdit}
            className="w-9 h-9 items-center justify-center rounded-xl bg-white/5 border border-white/5 active:bg-amber-500/10"
          >
            <Icon name="pencil-outline" size={15} color="#F5A524" />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={onDelete}
            className="w-9 h-9 items-center justify-center rounded-xl bg-white/5 border border-white/5 active:bg-red-500/10"
          >
            <Icon name="trash-can-outline" size={15} color="#EF4444" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Stats bar */}
      {stats && (
        <View
          style={{
            backgroundColor: 'rgba(255,255,255,0.03)',
            borderRadius: 14,
            padding: 10,
            borderWidth: 1,
            borderColor: 'rgba(255,255,255,0.05)',
          }}
        >
          <View style={{ flexDirection: 'row' }}>
            <StatChip
              icon="shopping-outline"
              label="Pedidos"
              value={String(stats.totalOrdenes)}
              color="#F8FAFC"
              bordered
            />
            <StatChip
              icon="cash-multiple"
              label="Total"
              value={`$${formatCurrency(stats.gastoTotal)}`}
              color="#34D399"
              bordered
            />
            <StatChip
              icon="trending-up"
              label="Ticket"
              value={`$${formatCurrency(ticketProm)}`}
              color="#60A5FA"
              bordered
            />
            <StatChip
              icon="crown-outline"
              label="Máx."
              value={`$${formatCurrency(stats.pedidoMaximo)}`}
              color="#F5A524"
            />
          </View>
          {stats.ultimaVisita && (
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 5,
                paddingTop: 8,
                marginTop: 6,
                borderTopWidth: 1,
                borderTopColor: 'rgba(255,255,255,0.04)',
              }}
            >
              <Icon name="clock-outline" size={9} color="#3B82F6" />
              <Text style={{ color: 'rgba(96,165,250,0.7)', fontSize: 9, fontFamily: 'SpaceGrotesk-Bold', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                Última visita: {timeAgo(stats.ultimaVisita)}
              </Text>
            </View>
          )}
        </View>
      )}
    </Card>
  );
});

// ─── Screen ────────────────────────────────────────────────────────────────────

type FormMode = 'closed' | 'create' | 'edit';

const EMPTY_FORM: CreateClienteDto = {
  telefono: '',
  clienteNombre: '',
  tipoDocumento: '',
  documento: '',
  correo: '',
};

export default function ClientesScreen() {
  const { data, loading, error, refetch } = useClientesList();
  const { client, loading: searching, error: searchError, fetchClient } = useClientByPhone();

  // ── Search & pagination ──
  const [searchQuery, setSearchQuery] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [page, setPage] = useState(1);

  const isPhoneQuery = /^\d+$/.test(searchQuery);

  const filteredData = useMemo(() => {
    if (!searchQuery || isPhoneQuery) return data;
    const q = searchQuery.toLowerCase();
    return data.filter((c) =>
      c.clienteNombre?.toLowerCase().includes(q) || c.telefono?.includes(q),
    );
  }, [data, searchQuery, isPhoneQuery]);

  useEffect(() => { setPage(1); }, [searchQuery, data]);

  const totalPages = Math.ceil(filteredData.length / PAGE_SIZE);
  const paginatedData = filteredData.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  // ── Stats (all-time + this month) ──
  const [frecuentes, setFrecuentes] = useState<ClienteFrecuente[]>([]);
  const [mejoresMes, setMejoresMes] = useState<ClienteFrecuente[]>([]);
  const [loadingStats, setLoadingStats] = useState(true);

  const fetchStats = useCallback(async () => {
    setLoadingStats(true);
    try {
      const [all, mes] = await Promise.all([
        api.estadisticas.clientesFrecuentes(200),
        api.estadisticas.clientesFrecuentes(3, monthStart(), today()),
      ]);
      setFrecuentes(all);
      setMejoresMes(mes);
    } catch {
      // non-critical — swallow
    } finally {
      setLoadingStats(false);
    }
  }, []);

  useEffect(() => { fetchStats(); }, [fetchStats, data]);

  const statsMap = useMemo(() => {
    const map = new Map<string, ClienteFrecuente>();
    for (const f of frecuentes) {
      if (f.clienteNombre) map.set(f.clienteNombre.toLowerCase(), f);
    }
    return map;
  }, [frecuentes]);

  const getStats = useCallback(
    (c: Cliente) => {
      const name = (c.clienteNombre || '').toLowerCase();
      return name ? statsMap.get(name) : undefined;
    },
    [statsMap],
  );

  // ── Form state ──
  const [formMode, setFormMode] = useState<FormMode>('closed');
  const [formData, setFormData] = useState<CreateClienteDto>(EMPTY_FORM);
  const [formLoading, setFormLoading] = useState(false);
  const [formError, setFormError] = useState('');
  const [editingPhone, setEditingPhone] = useState('');

  // ── Address state ──
  const [newAddress, setNewAddress] = useState('');
  const [newAddressInput, setNewAddressInput] = useState('');
  const [addingAddress, setAddingAddress] = useState<string | null>(null);

  // ── Delete modal ──
  const [deleteTarget, setDeleteTarget] = useState<Cliente | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const resetForm = useCallback(() => {
    setFormMode('closed');
    setFormData(EMPTY_FORM);
    setFormError('');
    setEditingPhone('');
    setNewAddress('');
    setNewAddressInput('');
  }, []);

  const openCreate = useCallback(() => {
    setFormMode('create');
    setFormData(EMPTY_FORM);
    setFormError('');
    setNewAddress('');
  }, []);

  const openEdit = useCallback((c: Cliente) => {
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
  }, []);

  const handleSave = useCallback(async () => {
    if (!formData.telefono) { setFormError('El teléfono es obligatorio'); return; }
    setFormLoading(true);
    setFormError('');
    try {
      if (formMode === 'create') {
        await api.clientes.create(formData);
        if (newAddress.trim()) await api.clientes.addDireccion(formData.telefono, newAddress.trim());
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
  }, [formMode, formData, newAddress, editingPhone, resetForm, refetch]);

  const handleAddAddress = useCallback(async (tel: string) => {
    if (!newAddressInput.trim()) return;
    setAddingAddress(tel);
    try {
      await api.clientes.addDireccion(tel, newAddressInput.trim());
      setNewAddressInput('');
      refetch();
    } catch {
      setFormError('Error al agregar dirección');
    } finally {
      setAddingAddress(null);
    }
  }, [newAddressInput, refetch]);

  const handleRemoveAddress = useCallback(async (id: number) => {
    try {
      await api.clientes.removeDireccion(id);
      refetch();
    } catch {
      setFormError('Error al eliminar dirección');
    }
  }, [refetch]);

  const handleDelete = useCallback(async () => {
    if (!deleteTarget) return;
    setDeleteLoading(true);
    try {
      await api.clientes.delete(deleteTarget.telefono);
      refetch();
      setDeleteTarget(null);
    } finally {
      setDeleteLoading(false);
    }
  }, [deleteTarget, refetch]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([refetch(), fetchStats()]);
    setRefreshing(false);
  }, [refetch, fetchStats]);

  // Derived: edit modal needs dirs from data
  const editingClient = useMemo(
    () => data.find((c) => c.telefono === editingPhone),
    [data, editingPhone],
  );
  const editDirs = editingClient?.direcciones ?? [];

  return (
    <PageContainer
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={handleRefresh}
          tintColor="#F5A524"
          colors={['#F5A524']}
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

      {/* ── Mejores del Mes ── */}
      {mejoresMes.length > 0 && (
        <Card variant="elevated" padding="md" className="mb-8">
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 14 }}>
            <Icon name="trophy-outline" size={18} color="#F5A524" />
            <Text style={{ fontFamily: 'SpaceGrotesk-Bold', color: '#F8FAFC', fontSize: 13, textTransform: 'uppercase', letterSpacing: 1 }}>
              Top del Mes
            </Text>
            <View
              style={{
                marginLeft: 'auto',
                backgroundColor: 'rgba(245,165,36,0.1)',
                borderWidth: 1,
                borderColor: 'rgba(245,165,36,0.2)',
                borderRadius: 8,
                paddingHorizontal: 8,
                paddingVertical: 3,
              }}
            >
              <Text style={{ color: '#F5A524', fontSize: 9, fontFamily: 'SpaceGrotesk-Bold', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                {new Date().toLocaleString('es-CO', { month: 'long' })}
              </Text>
            </View>
          </View>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            {mejoresMes.map((item, idx) => (
              <PodiumCard key={item.clienteNombre} item={item} rank={idx} />
            ))}
          </View>
          {/* Global summary */}
          {frecuentes.length > 0 && (
            <View
              style={{
                flexDirection: 'row',
                marginTop: 12,
                paddingTop: 12,
                borderTopWidth: 1,
                borderTopColor: 'rgba(255,255,255,0.05)',
                gap: 0,
              }}
            >
              <View style={{ flex: 1, alignItems: 'center' }}>
                <Text style={{ fontFamily: 'SpaceGrotesk-Bold', color: '#F8FAFC', fontSize: 15 }}>
                  {data.length}
                </Text>
                <Text style={{ color: '#475569', fontSize: 9, textTransform: 'uppercase', letterSpacing: 0.5 }}>Clientes</Text>
              </View>
              <View style={{ flex: 1, alignItems: 'center', borderLeftWidth: 1, borderLeftColor: 'rgba(255,255,255,0.05)', borderRightWidth: 1, borderRightColor: 'rgba(255,255,255,0.05)' }}>
                <Text style={{ fontFamily: 'SpaceGrotesk-Bold', color: '#34D399', fontSize: 15 }}>
                  ${formatCurrency(frecuentes.reduce((s, f) => s + f.gastoTotal, 0))}
                </Text>
                <Text style={{ color: '#475569', fontSize: 9, textTransform: 'uppercase', letterSpacing: 0.5 }}>Gasto Histórico</Text>
              </View>
              <View style={{ flex: 1, alignItems: 'center' }}>
                <Text style={{ fontFamily: 'SpaceGrotesk-Bold', color: '#F5A524', fontSize: 15 }}>
                  ${formatCurrency(Math.max(...frecuentes.map((f) => f.pedidoMaximo)))}
                </Text>
                <Text style={{ color: '#475569', fontSize: 9, textTransform: 'uppercase', letterSpacing: 0.5 }}>Pedido Máx.</Text>
              </View>
            </View>
          )}
        </Card>
      )}

      {/* ── Search Bar ── */}
      <Card className="mb-6 p-4 flex-row items-center gap-3">
        <Input
          placeholder="Buscar por nombre o teléfono..."
          value={searchQuery}
          onChangeText={setSearchQuery}
          className="flex-1"
          size="sm"
          leftIcon={<Icon name="magnify" size={18} color="#64748B" />}
          containerStyle={{ marginBottom: 0 }}
        />
        {isPhoneQuery && (
          <Button
            title={searching ? '...' : 'Buscar'}
            onPress={() => searchQuery && fetchClient(searchQuery)}
            variant="secondary"
            size="sm"
            disabled={!searchQuery || searching}
          />
        )}
      </Card>

      {/* Search error */}
      {!!searchError && (
        <View className="flex-row items-center gap-2 bg-red-500/10 p-3 rounded-xl border border-red-500/20 mb-6">
          <Icon name="alert-circle-outline" size={14} color="#EF4444" />
          <Text className="text-red-400 text-xs font-bold">{searchError}</Text>
        </View>
      )}

      {/* Phone search result */}
      {client && (
        <Card className="mb-8 p-5 border-2 border-(--color-pos-primary)/20 bg-(--color-pos-primary)/5">
          <Text className="text-(--color-pos-primary) font-black text-xs uppercase tracking-widest mb-4">
            Resultado de búsqueda
          </Text>
          <View className="flex-row items-center gap-3 mb-2">
            <Icon name="account-outline" size={18} color="#FFF" />
            <Text className="text-white font-black text-lg">{client.clienteNombre || 'Sin nombre'}</Text>
          </View>
          <View className="flex-row items-start gap-3">
            <Icon name="map-marker-outline" size={18} color="#64748B" />
            <Text className="text-slate-400 text-xs flex-1">
              {client.direcciones?.length
                ? client.direcciones.map((d) => d.direccion).join(' • ')
                : 'Sin direcciones'}
            </Text>
          </View>
        </Card>
      )}

      {/* ── Client list ── */}
      {loading && <ListSkeleton count={4} />}

      {!loading && data.length === 0 && !error && (
        <View className="items-center py-20 opacity-40">
          <Icon name="account-off-outline" size={64} color="#64748B" />
          <Text className="text-slate-500 font-bold mt-4 uppercase tracking-wider text-sm">
            Sin clientes registrados
          </Text>
        </View>
      )}

      {!loading &&
        paginatedData.map((item) => (
          <ClienteCard
            key={item.telefono}
            item={item}
            stats={getStats(item)}
            onEdit={() => openEdit(item)}
            onDelete={() => setDeleteTarget(item)}
          />
        ))}

      {/* ── Pagination ── */}
      {totalPages > 1 && (
        <View
          style={{
            flexDirection: 'row',
            justifyContent: 'center',
            alignItems: 'center',
            gap: 12,
            paddingVertical: 20,
          }}
        >
          <TouchableOpacity
            onPress={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1}
            style={{
              paddingHorizontal: 16,
              paddingVertical: 8,
              borderRadius: 12,
              backgroundColor: page <= 1 ? 'rgba(255,255,255,0.05)' : 'rgba(245,165,36,0.15)',
              borderWidth: 1,
              borderColor: page <= 1 ? 'rgba(255,255,255,0.08)' : 'rgba(245,165,36,0.3)',
              opacity: page <= 1 ? 0.4 : 1,
            }}
          >
            <Text style={{ color: '#F5A524', fontFamily: 'SpaceGrotesk-Bold', fontSize: 13 }}>
              ← Anterior
            </Text>
          </TouchableOpacity>

          <View style={{ alignItems: 'center' }}>
            <Text style={{ color: '#F8FAFC', fontFamily: 'SpaceGrotesk-Bold', fontSize: 14 }}>
              Página {page} de {totalPages}
            </Text>
            <Text style={{ color: '#64748B', fontSize: 11, marginTop: 2 }}>
              {filteredData.length} clientes
            </Text>
          </View>

          <TouchableOpacity
            onPress={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page >= totalPages}
            style={{
              paddingHorizontal: 16,
              paddingVertical: 8,
              borderRadius: 12,
              backgroundColor:
                page >= totalPages ? 'rgba(255,255,255,0.05)' : 'rgba(245,165,36,0.15)',
              borderWidth: 1,
              borderColor:
                page >= totalPages ? 'rgba(255,255,255,0.08)' : 'rgba(245,165,36,0.3)',
              opacity: page >= totalPages ? 0.4 : 1,
            }}
          >
            <Text style={{ color: '#F5A524', fontFamily: 'SpaceGrotesk-Bold', fontSize: 13 }}>
              Siguiente →
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {/* ── Create / Edit Modal ── */}
      <ClienteFormModal
        visible={formMode !== 'closed'}
        mode={formMode === 'closed' ? 'create' : formMode}
        formData={formData}
        setFormData={setFormData}
        formError={formError}
        formLoading={formLoading}
        editingPhone={editingPhone}
        existingDirs={editDirs}
        newAddress={newAddress}
        setNewAddress={setNewAddress}
        newAddressInput={newAddressInput}
        setNewAddressInput={setNewAddressInput}
        addingAddress={addingAddress}
        onSave={handleSave}
        onCancel={resetForm}
        onAddAddress={handleAddAddress}
        onRemoveAddress={handleRemoveAddress}
      />

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
