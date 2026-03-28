import React, { useState } from 'react';
import { useRouter } from 'expo-router';
import { ScrollView, View, Text } from '../../tw';
import { PageContainer, PageHeader, Button, Icon, Card, Input } from '../../components/ui';
import { api } from '../../services/api';
import { useToast, Role, RegisterDto } from '@monorepo/shared';
import { Picker } from '@react-native-picker/picker';
import { useAuth } from '../../contexts/AuthContext';

const ROLES = [
    { label: 'Cajero', value: Role.Cajero },
    { label: 'Cocinero', value: Role.Cocina },
    { label: 'Domiciliario', value: Role.Domiciliario },
    { label: 'Mesero', value: Role.Mesero },
    { label: 'Administrador', value: Role.Admin },
];

export default function RegistroUsuariosScreen() {
    const router = useRouter();
    const { user } = useAuth();
    const { showToast } = useToast();

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
        
        if (form.roles?.[0] === Role.Domiciliario && !form.telefono) {
            showToast('El teléfono es obligatorio para los domiciliarios', 'error');
            return;
        }

        setLoading(true);
        try {
            await api.auth.register(form);
            showToast('Usuario registrado exitosamente', 'success');
            router.back();
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

            <ScrollView contentContainerStyle={{ paddingBottom: 40, paddingTop: 16 }}>
                <Card className="p-8 border border-white/5 bg-(--color-pos-surface) max-w-2xl mx-auto w-full">
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 16 }}>
                        <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: 'rgba(245,165,36,0.15)', alignItems: 'center', justifyContent: 'center' }}>
                            <Icon name="account-plus" size={18} color="#F5A524" />
                        </View>
                        <View>
                            <Text style={{ fontFamily: 'SpaceGrotesk-Bold', color: '#F8FAFC', fontSize: 17, letterSpacing: -0.3 }}>Nuevo Colaborador</Text>
                            <Text style={{ fontFamily: 'Outfit', color: '#64748B', fontSize: 11 }}>Cree una cuenta para el personal de la pizzería.</Text>
                        </View>
                    </View>

                    <View className="gap-6">
                        <Input
                            label="Nombre Completo"
                            value={form.name}
                            onChangeText={(val) => setForm(prev => ({ ...prev, name: val }))}
                            placeholder="Ej: Juan Pérez"
                            leftIcon={<Icon name="account-outline" size={16} color="#64748B" />}
                        />

                        <Input
                            label="Nombre de Usuario (Login)"
                            value={form.username}
                            onChangeText={(val) => setForm(prev => ({ ...prev, username: val.toLowerCase().replace(/\s/g, '') }))}
                            placeholder="ej: juanp"
                            autoCapitalize="none"
                            leftIcon={<Icon name="at" size={16} color="#64748B" />}
                        />

                        <Input
                            label="Contraseña"
                            value={form.password}
                            onChangeText={(val) => setForm(prev => ({ ...prev, password: val }))}
                            placeholder="Mínimo 8 caracteres"
                            secureTextEntry
                            leftIcon={<Icon name="lock-outline" size={16} color="#64748B" />}
                        />

                        <View>
                            <Text style={{ fontFamily: 'Outfit', color: '#475569', fontSize: 9, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8, marginLeft: 2 }}>Rol / Permisos</Text>
                            <View className="bg-black/20 rounded-2xl border-2 border-white/5 overflow-hidden">
                                <Picker
                                    selectedValue={form.roles?.[0]}
                                    onValueChange={(val) => setForm(prev => ({ ...prev, roles: [val] }))}
                                    style={{ color: 'white', height: 60, backgroundColor: 'transparent' }}
                                    dropdownIconColor="#94A3B8"
                                >
                                    {ROLES.map(r => (
                                        <Picker.Item 
                                            key={r.value} 
                                            label={r.label} 
                                            value={r.value} 
                                            style={{ backgroundColor: '#0f172a', color: 'white' }}
                                        />
                                    ))}
                                </Picker>
                            </View>
                        </View>

                        {form.roles?.[0] === Role.Domiciliario && (
                            <Input
                                label="Teléfono (Obligatorio para domiciliarios)"
                                value={form.telefono || ''}
                                onChangeText={(val) => setForm(prev => ({ ...prev, telefono: val }))}
                                placeholder="Ej: 3001234567"
                                keyboardType="phone-pad"
                                leftIcon={<Icon name="phone" size={16} color="#64748B" />}
                            />
                        )}

                        {apiError && (
                            <View className="bg-red-500/10 border border-red-500/30 p-4 rounded-xl flex-row items-center gap-3">
                                <Icon name="alert-circle-outline" size={24} color="#EF4444" />
                                <Text className="flex-1 text-red-400 font-bold leading-tight" style={{ fontFamily: 'Outfit' }}>{apiError}</Text>
                            </View>
                        )}

                        <Button 
                            title={loading ? 'Registrando...' : 'Finalizar Registro'}
                            icon="account-check-outline"
                            variant="primary"
                            onPress={handleRegister}
                            loading={loading}
                            className="mt-4 py-4"
                        />
                    </View>
                </Card>
            </ScrollView>
        </PageContainer>
    );
}
