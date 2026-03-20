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
    const [form, setForm] = useState<RegisterDto & { telefono?: string }>({
        username: '',
        password: '',
        name: '',
        roles: [Role.Cajero],
        telefono: '',
    });

    const handleRegister = async () => {
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
            showToast('Error al registrar usuario', 'error');
        } finally {
            setLoading(false);
        }
    };

    return (
        <PageContainer>
            <PageHeader title="Registro de Usuarios" icon="account-plus-outline" />

            <ScrollView contentContainerStyle={{ paddingBottom: 40, paddingTop: 16 }}>
                <Card className="p-8 border border-white/5 bg-(--color-pos-surface) max-w-2xl mx-auto w-full">
                    <View className="flex-row items-center gap-3 mb-6">
                        <View className="w-10 h-10 rounded-xl bg-orange-500/20 items-center justify-center">
                            <Icon name="account-plus" size={20} color="#F5A524" />
                        </View>
                        <View>
                            <Text className="text-white font-black text-xl leading-tight" style={{ fontFamily: 'Space Grotesk' }}>Nuevo Colaborador</Text>
                            <Text className="text-slate-400 text-xs">Cree una cuenta para el personal de la pizzería.</Text>
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
                            <Text className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-3 ml-1">Rol / Permisos</Text>
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
