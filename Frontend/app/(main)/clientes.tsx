import React, {
  useState,
  useEffect,
  useMemo,
  useCallback,
  memo,
} from 'react';
import { Modal, KeyboardAvoidingView, Platform, Pressable, ActivityIndicator } from 'react-native';
import { PosRefreshControl, CardGrid, EntityCard, SegmentedControl, Paginator, InlineError } from '../../components/ui';
import { api } from '../../services/api';
import type { Cliente, CreateClienteDto, PresetRango } from '@/src/shared';
import { useClientByPhone, useToast, timeAgo, normalizePhone, useClientesList, formatCurrency } from '@/src/shared';
import { ScrollView, View, Text, TouchableOpacity } from '../../tw';
import PageContainer from '../../components/ui/PageContainer';
import PageHeader from '../../components/ui/PageHeader';
import Button from '../../components/ui/Button';
import Card from '../../components/ui/Card';
import Input from '../../components/ui/Input';
import Icon from '../../components/ui/Icon';
import ConfirmModal from '../../components/ui/ConfirmModal';
import { ListSkeleton } from '../../components/ui/SkeletonLoader';
import { useClientesStats, type EstadisticaCliente } from '../../hooks/use-clientes-stats';
import { ClientePerfilModal } from '../../components/clientes/ClientePerfilModal';

const PAGE_SIZE = 20;

// ─── Podium medal colours ────────────────────────────────────────────────────

const MEDAL_COLORS = [
  { bg: 'rgba(245,165,36,0.12)', border: 'rgba(245,165,36,0.3)', text: '#F5A524', label: '🥇' },
  { bg: 'rgba(203,213,225,0.08)', border: 'rgba(203,213,225,0.25)', text: '#CBD5E1', label: '🥈' },
  { bg: 'rgba(180,120,60,0.1)', border: 'rgba(205,127,50,0.25)', text: '#CD7F32', label: '🥉' },
];

// ─── PodiumCard — top-3 del período ──────────────────────────────────────────

const PodiumCard = memo(({
  item,
  rank,
  onPress,
}: {
  item: EstadisticaCliente;
  rank: number;
  onPress?: () => void;
}) => {
  const m = MEDAL_COLORS[rank] ?? MEDAL_COLORS[2];
  return (
    <TouchableOpacity
      activeOpacity={0.7}
      onPress={onPress}
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
        {item.nombre}
      </Text>
      <Text style={{ fontFamily: 'SpaceGrotesk-Bold', color: '#F8FAFC', fontSize: 14 }}>
        ${formatCurrency(item.gasto)}
      </Text>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, opacity: 0.7 }}>
        <Icon name="shopping-outline" size={10} color="#94A3B8" />
        <Text style={{ color: '#94A3B8', fontSize: 10, fontFamily: 'SpaceGrotesk-Bold', textTransform: 'uppercase' }}>
          {item.facturas} pedidos
        </Text>
      </View>
    </TouchableOpacity>
  );
});
PodiumCard.displayName = 'PodiumCard';

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
  existingDirs: { id: number; direccion: string; referencia?: string; costoDomicilio?: number }[];
  newAddress: string;
  setNewAddress: (v: string) => void;
  newAddressInput: { direccion: string, referencia: string, costoDomicilio: string };
  setNewAddressInput: React.Dispatch<React.SetStateAction<{ direccion: string, referencia: string, costoDomicilio: string }>>;
  addingAddress: string | null;
  /** Dirección que espera una segunda pulsación para borrarse. */
  dirPendiente: number | null;
  onSave: () => void;
  onCancel: () => void;
  onAddAddress: (tel: string) => void;
  onRemoveAddress: (id: number) => void;
  onResetPassword: (tel: string) => void;
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
  dirPendiente,
  onSave,
  onCancel,
  onAddAddress,
  onRemoveAddress,
  onResetPassword,
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
                onChangeText={(v) => setFormData((p) => ({ ...p, telefono: normalizePhone(v) }))}
                keyboardType="number-pad"
                containerStyle={{ flex: 1, minWidth: 140 }}
                editable={mode === 'create'}
                leftIcon={<Icon name="phone-outline" size={16} color="#7C8BA1" />}
              />
              <Input
                label="Nombre"
                value={formData.clienteNombre}
                onChangeText={(v) => setFormData((p) => ({ ...p, clienteNombre: v }))}
                containerStyle={{ flex: 2, minWidth: 180 }}
                leftIcon={<Icon name="account-outline" size={16} color="#7C8BA1" />}
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
                leftIcon={<Icon name="card-account-details-outline" size={16} color="#7C8BA1" />}
              />
              <Input
                label="Nº Documento"
                value={formData.documento}
                onChangeText={(v) => setFormData((p) => ({ ...p, documento: v }))}
                containerStyle={{ flex: 1, minWidth: 140 }}
                leftIcon={<Icon name="identifier" size={16} color="#7C8BA1" />}
                keyboardType="number-pad"
              />
            </View>

            {/* Correo */}
            <Input
              label="Correo Electrónico"
              value={formData.correo}
              onChangeText={(v) => setFormData((p) => ({ ...p, correo: v }))}
              leftIcon={<Icon name="email-outline" size={16} color="#7C8BA1" />}
              keyboardType="email-address"
            />

            {/* Dirección principal (create only) */}
            {mode === 'create' && (
              <Input
                label="Dirección Principal"
                value={newAddress}
                onChangeText={setNewAddress}
                placeholder="Ej. Calle 10 #20-30"
                leftIcon={<Icon name="map-marker-outline" size={16} color="#7C8BA1" />}
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
                          marginBottom: 8,
                          backgroundColor: 'rgba(255,255,255,0.04)',
                          padding: 10,
                          borderRadius: 10,
                        }}
                      >
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                          <Icon name="map-marker-outline" size={14} color="#F5A524" />
                          <Text className="text-slate-300 text-xs flex-1 font-bold">{dir.direccion}</Text>
                          <TouchableOpacity
                            onPress={() => onRemoveAddress(dir.id)}
                            accessibilityLabel={dirPendiente === dir.id ? 'Confirmar eliminar dirección' : 'Eliminar dirección'}
                            className={`h-8 items-center justify-center rounded-lg active:bg-red-500/20 ${dirPendiente === dir.id ? 'px-2 bg-red-500/20' : 'w-8'}`}
                          >
                            {dirPendiente === dir.id ? (
                              <Text className="text-red-400 text-[10px] font-black uppercase">¿Seguro?</Text>
                            ) : (
                              <Icon name="trash-can-outline" size={14} color="#EF4444" />
                            )}
                          </TouchableOpacity>
                        </View>
                        {(dir.referencia || dir.costoDomicilio !== undefined) && (
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4, paddingLeft: 24, opacity: 0.7 }}>
                            {dir.referencia ? <Text className="text-slate-400 text-[10px] italic flex-1">Ref: {dir.referencia}</Text> : null}
                            {dir.costoDomicilio !== undefined ? <Text className="text-slate-400 text-[10px] font-bold">Costo: ${formatCurrency(dir.costoDomicilio).replace('$', '')}</Text> : null}
                          </View>
                        )}
                      </View>
                    ))
                  ) : (
                    <Text className="text-slate-500 text-xs italic mb-3">Sin direcciones registradas</Text>
                  )}

                  <View style={{ flexDirection: 'column', gap: 8, marginTop: 6, backgroundColor: 'rgba(255,255,255,0.03)', padding: 10, borderRadius: 10, borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)' }}>
                    <Input
                      placeholder="Nueva dirección..."
                      value={newAddressInput.direccion}
                      onChangeText={(v) => setNewAddressInput(p => ({ ...p, direccion: v }))}
                      containerStyle={{ marginBottom: 0 }}
                      size="sm"
                    />
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      <Input
                        placeholder="Referencia (opcional)..."
                        value={newAddressInput.referencia}
                        onChangeText={(v) => setNewAddressInput(p => ({ ...p, referencia: v }))}
                        containerStyle={{ flex: 2, marginBottom: 0 }}
                        size="sm"
                      />
                      <Input
                        placeholder="Costo ($)"
                        value={newAddressInput.costoDomicilio}
                        onChangeText={(v) => setNewAddressInput(p => ({ ...p, costoDomicilio: v }))}
                        keyboardType="number-pad"
                        containerStyle={{ flex: 1, marginBottom: 0 }}
                        size="sm"
                      />
                      <Button
                        title=""
                        icon="plus"
                        variant="primary"
                        size="sm"
                        onPress={() => onAddAddress(editingPhone)}
                        disabled={!newAddressInput.direccion.trim() || addingAddress === editingPhone}
                        loading={addingAddress === editingPhone}
                      />
                    </View>
                  </View>
              </View>
            )}

            {/* Error */}
            <InlineError message={formError} size="sm" />
          </ScrollView>

          <View
            style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: 16,
              borderTopWidth: 1,
              borderTopColor: 'rgba(255,255,255,0.05)',
            }}
          >
            {mode === 'edit' ? (
              <Button
                title="Reset Password"
                onPress={() => onResetPassword(editingPhone)}
                variant="secondary"
                icon="lock-reset"
              />
            ) : <View />}
            <View style={{ flexDirection: 'row', gap: 10 }}>
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
          </View>
        </Pressable>
      </Pressable>
    </KeyboardAvoidingView>
  </Modal>
));
ClienteFormModal.displayName = 'ClienteFormModal';

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
      <Icon name={icon} size={10} color="#7C8BA1" />
      <Text style={{ color: '#7C8BA1', fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.5 }}>{label}</Text>
    </View>
  </View>
));
StatChip.displayName = 'StatChip';

// ─── ClienteCard ──────────────────────────────────────────────────────────────

const ClienteCard = memo(({
  item,
  stats,
  onPress,
  onViewProfile,
  onEdit,
  onDelete,
}: {
  item: Cliente;
  stats?: EstadisticaCliente;
  onPress: () => void;
  onViewProfile: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) => {
  const ticketProm = stats?.ticket ?? 0;

  return (
    <EntityCard
      title={item.clienteNombre || item.telefono}
      meta={[
        { icon: 'phone-outline', text: item.telefono, color: '#F5A524' },
        ...(item.direcciones && item.direcciones.length > 0
          ? item.direcciones.slice(0, 2).map((dir) => ({ icon: 'map-marker-outline' as const, text: dir.direccion }))
          : [{ icon: 'map-marker-off-outline' as const, text: 'Sin direcciones' }]),
        ...(item.direcciones && item.direcciones.length > 2 ? [{ icon: 'dots-horizontal' as const, text: `+${item.direcciones.length - 2} más` }] : []),
      ]}
      onPress={onPress}
      onViewProfile={onViewProfile}
      onEdit={onEdit}
      onDelete={onDelete}
    >
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
              value={String(stats.facturas)}
              color="#F8FAFC"
              bordered
            />
            <StatChip
              icon="cash-multiple"
              label="Total"
              value={`$${formatCurrency(stats.gasto)}`}
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
              <Text style={{ color: 'rgba(96,165,250,0.9)', fontSize: 10, fontFamily: 'SpaceGrotesk-Bold', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                Última visita: {timeAgo(stats.ultimaVisita, 'largo')}
              </Text>
            </View>
          )}
        </View>
      )}
    </EntityCard>
  );
});
ClienteCard.displayName = 'ClienteCard';

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
  const { showToast } = useToast();
  const { data, loading, loadingMore, progreso, error, refetch } = useClientesList();
  const { client, loading: searching, error: searchError, fetchClient } = useClientByPhone();

  // ── Search & pagination ──
  const [searchQuery, setSearchQuery] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [pageSel, setPage] = useState(1);

  const isPhoneQuery = /^\d+$/.test(searchQuery.trim());

  // Filtra la lista cargada por nombre O teléfono (también al escribir un número, con o sin +57). El botón
  // "Buscar" solo hace falta para un teléfono que aún no está en la lista cargada.
  const filteredData = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return data;
    const digitos = normalizePhone(searchQuery);
    return data.filter(
      (c) => c.clienteNombre?.toLowerCase().includes(q) || (digitos !== '' && !!c.telefono?.includes(digitos)),
    );
  }, [data, searchQuery]);

  // Solo una búsqueda nueva vuelve a la página 1: antes también lo hacía cada tanda de la carga progresiva
  // y devolvía a quien estaba en la página 3.
  useEffect(() => { setPage(1); }, [searchQuery]);

  const totalPages = Math.ceil(filteredData.length / PAGE_SIZE);
  const page = Math.min(pageSel, Math.max(totalPages, 1));
  const paginatedData = useMemo(() => filteredData.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE), [filteredData, page]);

  // ── Estadísticas y Top Clientes con filtro dinámico por período ──
  const [periodoTop, setPeriodoTop] = useState<PresetRango>('mes');
  // Contador que sube solo al guardar o refrescar: la lista cambia con cada tanda de la carga progresiva y no debe
  // volver a pedir las cifras cada vez.
  const [refrescos, setRefrescos] = useState(0);
  const telefonosVisibles = useMemo(() => paginatedData.map((c) => c.telefono), [paginatedData]);
  const { mejoresRanking, deCliente: getStats, cargandoTop, resumenAnio } = useClientesStats({
    telefonos: telefonosVisibles,
    periodoTop,
    topLimit: 3,
    recargarCon: refrescos,
  });

  // ── Perfil de Cliente modal state ──
  const [profilePhone, setProfilePhone] = useState<string | null>(null);
  const [profileClient, setProfileClient] = useState<Cliente | null>(null);

  const handleOpenProfile = useCallback(
    (c: { telefono: string; clienteNombre?: string }) => {
      setProfilePhone(c.telefono);
      const full = data.find((item) => item.telefono === c.telefono) || (c as Cliente);
      setProfileClient(full || null);
    },
    [data],
  );

  const etiquetaPeriodo = useMemo(() => {
    if (periodoTop === 'mes') {
      const mesActual = new Date().toLocaleString('es-CO', { month: 'long' });
      return mesActual.charAt(0).toUpperCase() + mesActual.slice(1);
    }
    if (periodoTop === 'mesAnterior') {
      const prev = new Date();
      prev.setDate(1);
      prev.setMonth(prev.getMonth() - 1);
      const mesAnt = prev.toLocaleString('es-CO', { month: 'long' });
      return mesAnt.charAt(0).toUpperCase() + mesAnt.slice(1);
    }
    if (periodoTop === '30d') return 'Últimos 30 días';
    if (periodoTop === 'anio') return `Año ${new Date().getFullYear()}`;
    return 'Top';
  }, [periodoTop]);

  // ── Form state ──
  const [formMode, setFormMode] = useState<FormMode>('closed');
  const [formData, setFormData] = useState<CreateClienteDto>(EMPTY_FORM);
  const [formLoading, setFormLoading] = useState(false);
  const [formError, setFormError] = useState('');
  const [editingPhone, setEditingPhone] = useState('');

  // ── Address state ──
  const [newAddress, setNewAddress] = useState('');
  const [newAddressInput, setNewAddressInput] = useState({ direccion: '', referencia: '', costoDomicilio: '' });
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
    setNewAddressInput({ direccion: '', referencia: '', costoDomicilio: '' });
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
    setNewAddressInput({ direccion: '', referencia: '', costoDomicilio: '' });
  }, []);

  const handleSave = useCallback(async () => {
    const telefono = normalizePhone(formData.telefono);
    if (!telefono) { setFormError('El teléfono es obligatorio'); return; }
    // El teléfono se guarda SIEMPRE local de 10 dígitos: con "+57 300…" no cruzaba con sus pedidos ni sus cifras.
    const datos = { ...formData, telefono };
    setFormLoading(true);
    setFormError('');
    try {
      if (formMode === 'create') {
        await api.clientes.create(datos);
        if (newAddress.trim()) await api.clientes.addDireccion(telefono, newAddress.trim());
      } else {
        await api.clientes.update(editingPhone, datos);
      }
      resetForm();
      refetch();
      setRefrescos((n) => n + 1);
    } catch (err: any) {
      setFormError(err.response?.data?.message || 'Error al guardar');
    } finally {
      setFormLoading(false);
    }
  }, [formMode, formData, newAddress, editingPhone, resetForm, refetch]);

  const handleAddAddress = useCallback(async (tel: string) => {
    if (!newAddressInput.direccion.trim()) return;
    setAddingAddress(tel);
    try {
      await api.clientes.addDireccion(tel, {
        direccion: newAddressInput.direccion.trim(),
        referencia: newAddressInput.referencia.trim() || undefined,
        costoDomicilio: newAddressInput.costoDomicilio ? Number(newAddressInput.costoDomicilio) : undefined
      });
      setNewAddressInput({ direccion: '', referencia: '', costoDomicilio: '' });
      refetch();
    } catch {
      setFormError('Error al agregar dirección');
    } finally {
      setAddingAddress(null);
    }
  }, [newAddressInput, refetch]);

  // Borrar una dirección pide una segunda pulsación (se descarta sola a los 4 s): antes un toque la eliminaba.
  const [dirPendiente, setDirPendiente] = useState<number | null>(null);
  useEffect(() => {
    if (dirPendiente == null) return;
    const t = setTimeout(() => setDirPendiente(null), 4000);
    return () => clearTimeout(t);
  }, [dirPendiente]);

  const handleRemoveAddress = useCallback(async (id: number) => {
    if (dirPendiente !== id) {
      setDirPendiente(id);
      return;
    }
    setDirPendiente(null);
    try {
      await api.clientes.removeDireccion(id);
      refetch();
    } catch {
      setFormError('Error al eliminar dirección');
    }
  }, [refetch, dirPendiente]);

  const handleDelete = useCallback(async () => {
    if (!deleteTarget) return;
    setDeleteLoading(true);
    try {
      await api.clientes.delete(deleteTarget.telefono);
      refetch();
      setRefrescos((n) => n + 1);
      setDeleteTarget(null);
    } catch (err: any) {
      // Antes un fallo (p. ej. sin permiso) no decía nada y el modal parecía colgado.
      showToast(err?.response?.data?.message || 'No se pudo eliminar el cliente', 'error');
    } finally {
      setDeleteLoading(false);
    }
  }, [deleteTarget, refetch, showToast]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await refetch();
    setRefrescos((n) => n + 1);
    setRefreshing(false);
  }, [refetch]);

  const handleResetPassword = useCallback(async (tel: string) => {
    try {
      await api.clientes.resetPassword(tel);
      showToast('Contraseña restablecida. La nueva contraseña es 123456', 'success');
    } catch {
      showToast('Error al restablecer contraseña', 'error');
    }
  }, [showToast]);

  // Derived: edit modal needs dirs from data
  const editingClient = useMemo(
    () => data.find((c) => c.telefono === editingPhone),
    [data, editingPhone],
  );
  const editDirs = editingClient?.direcciones ?? [];

  return (
    <PageContainer
      refreshControl={
        <PosRefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
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

      {/* ── Mejores Clientes por Período ── */}
      <Card variant="elevated" padding="md" className="mb-4">
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
          <Icon name="trophy-outline" size={18} color="#F5A524" />
          <Text style={{ fontFamily: 'SpaceGrotesk-Bold', color: '#F8FAFC', fontSize: 13, textTransform: 'uppercase', letterSpacing: 1 }}>
            Top Clientes
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
            <Text style={{ color: '#F5A524', fontSize: 10, fontFamily: 'SpaceGrotesk-Bold', textTransform: 'uppercase', letterSpacing: 0.5 }}>
              {etiquetaPeriodo}
            </Text>
          </View>
        </View>

        {/* Filtro de Período con SegmentedControl */}
        <View style={{ marginBottom: 14 }}>
          <SegmentedControl<PresetRango>
            value={periodoTop}
            onChange={setPeriodoTop}
            options={[
              { value: 'mes', label: 'Este Mes', icon: 'calendar-month' },
              { value: 'mesAnterior', label: 'Mes Pasado', icon: 'calendar-arrow-left' },
              { value: '30d', label: '30 Días', icon: 'clock-outline' },
              { value: 'anio', label: 'Año', icon: 'calendar-range' },
            ]}
            color="#F5A524"
          />
        </View>

        {cargandoTop ? (
          <View style={{ paddingVertical: 24, alignItems: 'center' }}>
            <ActivityIndicator size="small" color="#F5A524" />
          </View>
        ) : mejoresRanking.length > 0 ? (
          <View style={{ flexDirection: 'row', gap: 10 }}>
            {mejoresRanking.map((item, idx) => (
              <PodiumCard
                key={item.clave}
                item={item}
                rank={idx}
                onPress={() => item.telefono && handleOpenProfile({ telefono: item.telefono, clienteNombre: item.nombre })}
              />
            ))}
          </View>
        ) : (
          <View style={{ paddingVertical: 20, alignItems: 'center', opacity: 0.6 }}>
            <Text style={{ color: '#94A3B8', fontSize: 12 }}>Sin ventas registradas en este período</Text>
          </View>
        )}
          {/* Global summary */}
          {resumenAnio && resumenAnio.facturas > 0 && (
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
                <Text style={{ color: '#7C8BA1', fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.5 }}>Clientes</Text>
              </View>
              <View style={{ flex: 1, alignItems: 'center', borderLeftWidth: 1, borderLeftColor: 'rgba(255,255,255,0.05)', borderRightWidth: 1, borderRightColor: 'rgba(255,255,255,0.05)' }}>
                <Text style={{ fontFamily: 'SpaceGrotesk-Bold', color: '#34D399', fontSize: 15 }}>
                  ${formatCurrency(resumenAnio.facturado)}
                </Text>
                <Text style={{ color: '#7C8BA1', fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.5 }}>Facturado último año</Text>
              </View>
              <View style={{ flex: 1, alignItems: 'center' }}>
                <Text style={{ fontFamily: 'SpaceGrotesk-Bold', color: '#F5A524', fontSize: 15 }}>
                  ${formatCurrency(resumenAnio.ticket)}
                </Text>
                <Text style={{ color: '#7C8BA1', fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.5 }}>Ticket promedio</Text>
              </View>
            </View>
          )}
        </Card>

      {/* ── Search Bar ── */}
      <Card className="mb-4 p-4 flex-row items-center gap-3">
        <Input
          placeholder="Buscar por nombre o teléfono..."
          value={searchQuery}
          onChangeText={setSearchQuery}
          className="flex-1"
          size="sm"
          leftIcon={<Icon name="magnify" size={18} color="#64748B" />}
          containerStyle={{ marginBottom: 0 }}
        />
        {isPhoneQuery && filteredData.length === 0 && (
          <Button
            title={searching ? '...' : 'Buscar'}
            onPress={() => searchQuery && fetchClient(normalizePhone(searchQuery))}
            variant="secondary"
            size="sm"
            disabled={!searchQuery || searching}
          />
        )}
      </Card>

      {/* Search error */}
      <InlineError message={searchError} size="sm" className="mb-4" />

      {/* Phone search result */}
      {client && (
        <Card
          className="mb-4 p-5 border-2 border-(--color-pos-primary)/20 bg-(--color-pos-primary)/5"
          onPress={() => handleOpenProfile(client)}
        >
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <Text className="text-(--color-pos-primary) font-black text-xs uppercase tracking-widest">
              Resultado de búsqueda
            </Text>
            <Button
              title="Ver Historial"
              icon="chart-box-outline"
              size="sm"
              variant="secondary"
              onPress={() => handleOpenProfile(client)}
            />
          </View>
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

      {/* ── Progressive loading indicator ── */}
      {loadingMore && progreso && (
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            backgroundColor: 'rgba(56,189,248,0.08)',
            borderWidth: 1,
            borderColor: 'rgba(56,189,248,0.2)',
            borderRadius: 12,
            paddingHorizontal: 14,
            paddingVertical: 8,
            marginBottom: 16,
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <ActivityIndicator size="small" color="#38BDF8" />
            <Text style={{ color: '#38BDF8', fontSize: 12, fontWeight: '700' }}>
              Cargando clientes progresivamente ({progreso.cargados.toLocaleString()} de {progreso.total.toLocaleString()})…
            </Text>
          </View>
          <Text style={{ color: 'rgba(56,189,248,0.7)', fontSize: 11, fontWeight: '600' }}>
            {Math.round((progreso.cargados / Math.max(1, progreso.total)) * 100)}%
          </Text>
        </View>
      )}

      {/* ── Client list ── */}
      <InlineError message={error} className="mb-4" />
      {loading && <ListSkeleton count={4} />}

      {!loading && data.length === 0 && !error && (
        <View className="items-center py-20 opacity-40">
          <Icon name="account-off-outline" size={64} color="#64748B" />
          <Text className="text-slate-500 font-bold mt-4 uppercase tracking-wider text-sm">
            Sin clientes registrados
          </Text>
        </View>
      )}

      {!loading && (
        <CardGrid
          kind="persona"
          data={paginatedData}
          keyExtractor={(item) => item.telefono}
          renderItem={(item) => (
            <ClienteCard
              item={item}
              stats={getStats(item)}
              onPress={() => handleOpenProfile(item)}
              onViewProfile={() => handleOpenProfile(item)}
              onEdit={() => openEdit(item)}
              onDelete={() => setDeleteTarget(item)}
            />
          )}
        />
      )}

      {/* ── Pagination ── */}
      <Paginator page={page} totalPages={totalPages} onChange={setPage} caption={`${filteredData.length} clientes`} />

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
        dirPendiente={dirPendiente}
        onSave={handleSave}
        onCancel={resetForm}
        onAddAddress={handleAddAddress}
        onRemoveAddress={handleRemoveAddress}
        onResetPassword={handleResetPassword}
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

      {/* ── Client Profile Modal ── */}
      <ClientePerfilModal
        visible={!!profilePhone}
        telefono={profilePhone || ''}
        cliente={profileClient}
        onClose={() => {
          setProfilePhone(null);
          setProfileClient(null);
        }}
        onEdit={(c) => openEdit(c)}
      />
    </PageContainer>
  );
}
