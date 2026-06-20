import React, { useState } from 'react';
import { RefreshControl, Modal, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { useDomiciliariosList } from '@/src/shared';
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
import { useToast } from '@/src/shared';
import { useRouter } from 'expo-router';

// ─── Edit Modal ───────────────────────────────────────────────────────────────

interface EditModalProps {
  visible: boolean;
  domiciliario: any | null;
  onClose: () => void;
  onSaved: () => void;
}

function EditDomiciliarioModal({ visible, domiciliario, onClose, onSaved }: EditModalProps) {
  const { showToast } = useToast();
  const [loading, setLoading] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);

  const [form, setForm] = useState({
    name: '',
    username: '',
    telefono: '',
    password: '',
    confirmPassword: '',
  });

  // Sync form whenever the selected domiciliario changes
  React.useEffect(() => {
    if (domiciliario) {
      setForm({
        name: domiciliario.domiciliarioNombre || '',
        username: domiciliario.user?.username || '',
        telefono: domiciliario.telefono || '',
        password: '',
        confirmPassword: '',
      });
      setApiError(null);
    }
  }, [domiciliario]);

  const handleSave = async () => {
    if (!domiciliario) return;
    setApiError(null);

    if (!form.name.trim()) {
      showToast('El nombre es obligatorio', 'error');
      return;
    }

    if (form.password && form.password !== form.confirmPassword) {
      showToast('Las contraseñas no coinciden', 'error');
      return;
    }

    if (form.password && form.password.length < 8) {
      showToast('La contraseña debe tener al menos 8 caracteres', 'error');
      return;
    }

    setLoading(true);
    try {
      // 1. Update domiciliario record (phone + name)
      await api.domiciliarios.update(domiciliario.telefono, {
        domiciliarioNombre: form.name.trim(),
      });

      // 2. Update user credentials if userId is available
      if (domiciliario.userId) {
        const userPatch: { name?: string; username?: string; password?: string } = {
          name: form.name.trim(),
        };
        if (form.username.trim() && form.username.trim() !== domiciliario.user?.username) {
          userPatch.username = form.username.trim().toLowerCase().replace(/\s/g, '');
        }
        if (form.password) {
          userPatch.password = form.password;
        }
        await api.auth.updateUser(domiciliario.userId, userPatch);
      }

      showToast('Domiciliario actualizado correctamente', 'success');
      onSaved();
      onClose();
    } catch (error: any) {
      const rawMsg = error.response?.data?.message || error.message || 'Error al actualizar';
      const msg = Array.isArray(rawMsg) ? rawMsg.join(' • ') : rawMsg;
      setApiError(msg);
      showToast('Error al guardar los cambios', 'error');
    } finally {
      setLoading(false);
    }
  };

  if (!visible || !domiciliario) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View
        style={{
          flex: 1,
          backgroundColor: 'rgba(0,0,0,0.72)',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 20,
        }}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={{ width: '100%', maxWidth: 520 }}
        >
          <View
            style={{
              backgroundColor: '#0f172a',
              borderRadius: 28,
              borderWidth: 1,
              borderColor: 'rgba(255,255,255,0.07)',
              overflow: 'hidden',
            }}
          >
            {/* Header */}
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                padding: 20,
                borderBottomWidth: 1,
                borderBottomColor: 'rgba(255,255,255,0.06)',
                gap: 12,
              }}
            >
              <View
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 12,
                  backgroundColor: 'rgba(245,165,36,0.15)',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Icon name="account-cog" size={20} color="#F5A524" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontFamily: 'SpaceGrotesk-Bold', color: '#F8FAFC', fontSize: 16 }}>
                  Editar Domiciliario
                </Text>
                <Text style={{ fontFamily: 'Outfit', color: '#64748B', fontSize: 11 }}>
                  {domiciliario.domiciliarioNombre || domiciliario.telefono}
                </Text>
              </View>
              <TouchableOpacity
                onPress={onClose}
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 10,
                  backgroundColor: 'rgba(255,255,255,0.05)',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Icon name="close" size={18} color="#94A3B8" />
              </TouchableOpacity>
            </View>

            {/* Body */}
            <ScrollView
              style={{ maxHeight: 520 }}
              contentContainerStyle={{ padding: 20, gap: 16 }}
              showsVerticalScrollIndicator={false}
            >
              {/* Section: Datos personales */}
              <View
                style={{
                  backgroundColor: 'rgba(255,255,255,0.03)',
                  borderRadius: 16,
                  borderWidth: 1,
                  borderColor: 'rgba(255,255,255,0.06)',
                  padding: 16,
                  gap: 14,
                }}
              >
                <Text
                  style={{
                    fontFamily: 'Outfit',
                    color: '#F5A524',
                    fontSize: 9,
                    textTransform: 'uppercase',
                    letterSpacing: 2,
                    marginBottom: 2,
                  }}
                >
                  Datos personales
                </Text>

                <Input
                  label="Nombre completo"
                  value={form.name}
                  onChangeText={(val) => setForm((p) => ({ ...p, name: val }))}
                  placeholder="Ej: Pedro Ramírez"
                  leftIcon={<Icon name="account-outline" size={16} color="#64748B" />}
                  containerStyle={{ marginBottom: 0 }}
                />

                <Input
                  label="Teléfono"
                  value={form.telefono}
                  onChangeText={() => {}}
                  editable={false}
                  placeholder="Teléfono"
                  keyboardType="phone-pad"
                  leftIcon={<Icon name="phone" size={16} color="#64748B" />}
                  containerStyle={{ marginBottom: 0, opacity: 0.5 }}
                />
              </View>

              {/* Section: Credenciales */}
              <View
                style={{
                  backgroundColor: 'rgba(255,255,255,0.03)',
                  borderRadius: 16,
                  borderWidth: 1,
                  borderColor: 'rgba(255,255,255,0.06)',
                  padding: 16,
                  gap: 14,
                }}
              >
                <Text
                  style={{
                    fontFamily: 'Outfit',
                    color: '#60A5FA',
                    fontSize: 9,
                    textTransform: 'uppercase',
                    letterSpacing: 2,
                    marginBottom: 2,
                  }}
                >
                  Credenciales de acceso
                </Text>

                <Input
                  label="Nombre de usuario (Login)"
                  value={form.username}
                  onChangeText={(val) =>
                    setForm((p) => ({ ...p, username: val.toLowerCase().replace(/\s/g, '') }))
                  }
                  placeholder="ej: pedro.ramirez"
                  autoCapitalize="none"
                  leftIcon={<Icon name="at" size={16} color="#64748B" />}
                  containerStyle={{ marginBottom: 0 }}
                />

                <Input
                  label="Nueva contraseña (dejar vacío para no cambiar)"
                  value={form.password}
                  onChangeText={(val) => setForm((p) => ({ ...p, password: val }))}
                  placeholder="Mínimo 8 caracteres"
                  secureTextEntry
                  leftIcon={<Icon name="lock-outline" size={16} color="#64748B" />}
                  containerStyle={{ marginBottom: 0 }}
                />

                {form.password.length > 0 && (
                  <Input
                    label="Confirmar nueva contraseña"
                    value={form.confirmPassword}
                    onChangeText={(val) => setForm((p) => ({ ...p, confirmPassword: val }))}
                    placeholder="Repetir contraseña"
                    secureTextEntry
                    leftIcon={<Icon name="lock-check-outline" size={16} color="#64748B" />}
                    containerStyle={{ marginBottom: 0 }}
                  />
                )}
              </View>

              {/* Error */}
              {apiError && (
                <View
                  style={{
                    backgroundColor: 'rgba(239,68,68,0.1)',
                    borderWidth: 1,
                    borderColor: 'rgba(239,68,68,0.3)',
                    borderRadius: 12,
                    padding: 14,
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 10,
                  }}
                >
                  <Icon name="alert-circle-outline" size={20} color="#EF4444" />
                  <Text style={{ flex: 1, color: '#FCA5A5', fontFamily: 'Outfit', fontSize: 13 }}>
                    {apiError}
                  </Text>
                </View>
              )}
            </ScrollView>

            {/* Footer */}
            <View
              style={{
                flexDirection: 'row',
                gap: 10,
                padding: 16,
                borderTopWidth: 1,
                borderTopColor: 'rgba(255,255,255,0.06)',
              }}
            >
              <Button
                title="Cancelar"
                variant="secondary"
                onPress={onClose}
                className="flex-1"
                size="md"
              />
              <Button
                title={loading ? 'Guardando...' : 'Guardar cambios'}
                icon="content-save-outline"
                variant="primary"
                onPress={handleSave}
                loading={loading}
                className="flex-1"
                size="md"
              />
            </View>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function DomiciliariosList() {
  const router = useRouter();
  const { isMobile } = useBreakpoint();
  const { data, loading, error, refetch } = useDomiciliariosList();
  const [telefonoBusqueda, setTelefonoBusqueda] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  // ── Delete modal state ──
  const [deleteTarget, setDeleteTarget] = useState<{ telefono: string; domiciliarioNombre?: string } | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // ── Edit modal state ──
  const [editTarget, setEditTarget] = useState<any | null>(null);

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
        subtitle="Monitoreo de domiciliarios y analíticas"
        icon="moped"
      />



      {/* ── Search & Actions ── */}
      <View className={`gap-3 mb-8 ${isMobile ? 'flex-col' : 'flex-row items-end'}`}>
        <Input
          label="Filtrar por nombre o teléfono"
          value={telefonoBusqueda}
          onChangeText={setTelefonoBusqueda}
          placeholder="Buscar..."
          keyboardType="default"
          className="flex-1"
          containerStyle={{ marginBottom: 0 }}
          leftIcon={<Icon name="magnify" size={18} color="#64748B" />}
        />
        <View className="flex-row gap-3">
          <Button
            title="Alta Domiciliarios"
            icon="account-plus"
            onPress={() => router.push('/(main)/registro-usuarios')}
            variant="primary"
            size="md"
            className={`h-11 px-4 ${isMobile ? 'flex-1' : ''}`}
          />
          <Button
            title=""
            icon="refresh"
            onPress={refetch}
            variant="secondary"
            size="md"
            loading={loading}
            className="h-11 w-11 px-0"
          />
        </View>
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
                        {item.user?.username && (
                          <View className="flex-row items-center gap-1.5 mt-0.5">
                            <Icon name="at" size={12} color="#475569" />
                            <Text style={{ color: '#475569', fontSize: 11, fontFamily: 'Outfit' }}>{item.user.username}</Text>
                          </View>
                        )}
                    </View>

                    <View className="flex-row gap-2">
                        <TouchableOpacity
                            onPress={() => setEditTarget(item)}
                            className="w-10 h-10 rounded-full bg-white/5 items-center justify-center active:bg-white/10"
                        >
                            <Icon name="account-cog" size={18} color="#94A3B8" />
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

      {/* ── Edit Modal ── */}
      <EditDomiciliarioModal
        visible={!!editTarget}
        domiciliario={editTarget}
        onClose={() => setEditTarget(null)}
        onSaved={refetch}
      />

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
