import React, { useState } from 'react';
import { useRouter } from 'expo-router';
import { ScrollView, TextInput, TouchableOpacity, View, Text } from '../../tw';
import { PageContainer, PageHeader, Button, Icon, Card } from '../../components/ui';
import { api } from '../../services/api';
import { useToast, Role, RegisterDto } from '@monorepo/shared';
import { Picker } from '@react-native-picker/picker';
import { useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';

const ROLES = [
    { label: 'Cajero', value: Role.Cajero },
    { label: 'Cocinero', value: Role.Cocina },
    { label: 'Domiciliario', value: Role.Domiciliario },
    { label: 'Mesero', value: Role.Mesero },
    // El rol Admin está prohibido en este formulario
];

export default function RegistroUsuariosScreen() {
    const router = useRouter();
    const { user } = useAuth();
    const { showToast } = useToast();

    useEffect(() => {
        if (user && !user.roles?.includes(Role.Admin)) {
            showToast('Acceso denegado: Se requiere rol Admin', 'error');
            router.replace('/usuarios' as any);
        }
    }, [user, router, showToast]);

    const [loading, setLoading] = useState(false);
    const [apiError, setApiError] = useState<string | null>(null);

    const [form, setForm] = useState<RegisterDto & { telefono?: string }>({
        username: '',
        password: '',
        name: '',
        roles: [Role.Cajero],
        telefono: '',
    });

    const handleRegister = async () => {
        setApiError(null);
        if (!form.username || !form.password || !form.name) {
            showToast('Todos los campos son obligatorios', 'error');
            return;
        }

        if (form.password.length < 8) {
            showToast('La contraseña debe tener al menos 8 caracteres', 'error');
            return;
        }

        if (form.roles?.[0] === Role.Domiciliario && !form.telefono) {
            showToast('El teléfono es obligatorio para los domiciliarios', 'error');
            return;
        }

        setLoading(true);
        try {
            await api.auth.register(form);
            showToast('Usuario registrado exitosamente', 'success');
            setForm({
                username: '',
                password: '',
                name: '',
                roles: [Role.Cajero],
            });
        } catch (error: any) {
            const rawMsg = error.response?.data?.message || error.message || 'Error al registrar usuario';
            const msg = Array.isArray(rawMsg) ? rawMsg.join(' • ') : rawMsg;
            setApiError(msg);
            showToast('Verifique los datos del formulario', 'error');
        } finally {
            setLoading(false);
        }
    };

    return (
        <PageContainer>
            <PageHeader title="Registro de Usuarios" icon="account-plus-outline" />

            <ScrollView contentContainerClassName="pb-10 pt-4">
                <Card className="p-8 border border-white/5 bg-(--color-pos-surface)">
                    <Text className="text-white font-black text-xl mb-2" style={{ fontFamily: 'Space Grotesk' }}>Nuevo Colaborador</Text>
                    <Text className="text-slate-400 text-sm mb-8">Cree una cuenta para el personal de la pizzería.</Text>

                    <View className="gap-6">
                        <View>
                            <Text className="text-xs font-black text-slate-500 uppercase tracking-widest mb-2 ml-1">Nombre Completo</Text>
                            <TextInput
                                className="bg-black/20 rounded-2xl border-2 border-white/5 px-5 py-4 text-white text-lg"
                                value={form.name}
                                onChangeText={(val) => setForm(prev => ({ ...prev, name: val }))}
                                placeholder="Ej: Juan Pérez"
                                placeholderTextColor="#475569"
                            />
                        </View>

                        <View>
                            <Text className="text-xs font-black text-slate-500 uppercase tracking-widest mb-2 ml-1">Nombre de Usuario (Login)</Text>
                            <TextInput
                                className="bg-black/20 rounded-2xl border-2 border-white/5 px-5 py-4 text-white text-lg"
                                value={form.username}
                                onChangeText={(val) => setForm(prev => ({ ...prev, username: val.toLowerCase().replace(/\s/g, '') }))}
                                placeholder="ej: juanp"
                                placeholderTextColor="#475569"
                                autoCapitalize="none"
                            />
                        </View>

                        <View>
                            <Text className="text-xs font-black text-slate-500 uppercase tracking-widest mb-2 ml-1">Contraseña</Text>
                            <TextInput
                                className="bg-black/20 rounded-2xl border-2 border-white/5 px-5 py-4 text-white text-lg"
                                value={form.password}
                                onChangeText={(val) => setForm(prev => ({ ...prev, password: val }))}
                                placeholder="Mínimo 8 caracteres"
                                placeholderTextColor="#475569"
                                secureTextEntry
                            />
                        </View>

                        <View>
                            <Text className="text-xs font-black text-slate-500 uppercase tracking-widest mb-2 ml-1">Rol / Permisos</Text>
                            <View className="bg-black/20 rounded-2xl border-2 border-white/5 overflow-hidden">
                                <Picker
                                    selectedValue={form.roles?.[0]}
                                    onValueChange={(val) => setForm(prev => ({ ...prev, roles: [val] }))}
                                    style={{ color: 'white', height: 60 }}
                                    dropdownIconColor="#94A3B8"
                                >
                                    {ROLES.map(r => <Picker.Item key={r.value} label={r.label} value={r.value} />)}
                                </Picker>
                            </View>
                        </View>

                        {form.roles?.[0] === Role.Domiciliario && (
                            <View>
                                <Text className="text-xs font-black text-slate-500 uppercase tracking-widest mb-2 ml-1">Teléfono (Obligatorio para domiciliarios)</Text>
                                <TextInput
                                    className="bg-black/20 rounded-2xl border-2 border-white/5 px-5 py-4 text-white text-lg"
                                    value={form.telefono || ''}
                                    onChangeText={(val) => setForm(prev => ({ ...prev, telefono: val }))}
                                    placeholder="Ej: 3001234567"
                                    placeholderTextColor="#475569"
                                    keyboardType="phone-pad"
                                />
                            </View>
                        )}

                        {apiError && (
                            <View className="bg-red-500/10 border border-red-500/30 p-4 rounded-xl flex-row items-center gap-3 mt-2">
                                <Icon name="alert-circle-outline" size={24} color="#EF4444" />
                                <Text className="flex-1 text-red-400 font-bold leading-tight" style={{ fontFamily: 'Outfit' }}>{apiError}</Text>
                            </View>
                        )}

                        <TouchableOpacity
                            className={`bg-(--color-pos-primary) py-5 rounded-2xl items-center mt-4 shadow-amber-500/20 ${loading ? 'opacity-60' : ''}`}
                            onPress={handleRegister}
                            disabled={loading}
                        >
                            <Text className="text-white font-black text-lg uppercase tracking-widest">
                                {loading ? 'Registrando...' : 'Finalizar Registro'}
                            </Text>
                        </TouchableOpacity>
                    </View>
                </Card>
            </ScrollView>
        </PageContainer>
    );
}
