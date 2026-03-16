import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Alert, TextInput, KeyboardAvoidingView, Platform } from 'react-native';
import { EmpresaConfig, UpdateEmpresaDto } from '@monorepo/shared';
import { Ionicons } from '@expo/vector-icons';
import { FadeInUp } from 'react-native-reanimated';
import { Animated } from '../../tw/animated';
import { api as apiService } from '../../services/api';
import {
    PageContainer,
    PageHeader,
    Card,
    Input,
    Button,
    ListSkeleton
} from '../../components/ui';

export default function AjustesNegocioScreen() {
    const api = apiService;
    const [config, setConfig] = useState<EmpresaConfig | null>(null);
    const [form, setForm] = useState<UpdateEmpresaDto>({});
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    const loadConfig = async () => {
        try {
            setLoading(true);
            const data = await api.empresa.get();
            setConfig(data);
            setForm(data as any);
        } catch (error) {
            Alert.alert('Error', 'No se pudo cargar la configuración del negocio');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadConfig();
    }, []);

    const handleSave = async () => {
        try {
            setSaving(true);
            await api.empresa.update(form);
            Alert.alert('Éxito', 'Configuración actualizada correctamente');
            loadConfig();
        } catch (error) {
            Alert.alert('Error', 'No se pudo guardar la configuración');
        } finally {
            setSaving(false);
        }
    };

    const renderInput = (label: string, icon: string, key: keyof UpdateEmpresaDto, placeholder: string, keyboard: any = 'default') => (
        <Input
            label={label}
            placeholder={placeholder}
            keyboardType={keyboard}
            value={form[key]?.toString()}
            onChangeText={(t) => setForm({ ...form, [key]: t })}
        />
    );

    if (loading) return <PageContainer scrollable={false}><ListSkeleton count={8} /></PageContainer>;

    return (
        <PageContainer scrollable>
            <PageHeader
                title="Perfil de Negocio"
                subtitle="Configuración legal y de facturación"
                icon="business"
            />

            <Animated.View entering={FadeInUp.duration(600)}>
                <Card className="mb-8 overflow-hidden relative border-0 p-0 bg-transparent">
                    <View className="absolute inset-0 bg-slate-900" />
                    <View className="absolute inset-0 bg-orange-500/10" />
                    
                    <View className="p-6">
                        <View className="flex-row items-center mb-6">
                            <View className="w-10 h-10 rounded-xl bg-orange-500/20 items-center justify-center mr-3">
                                <Ionicons name="business" size={20} color="#F5A524" />
                            </View>
                            <Text className="text-white font-black text-lg uppercase tracking-widest" style={{ fontFamily: 'Space Grotesk' }}>
                                Identidad Corporativa
                            </Text>
                        </View>

                        {renderInput('Razón Social', 'text', 'razonSocial', 'Nombre legal de la empresa')}
                        {renderInput('Nombre Comercial', 'pricetag', 'nombreComercial', 'Marca que ven los clientes')}
                        {renderInput('NIT / Identificación', 'finger-print', 'nit', '900.000.000-1')}
                        {renderInput('Régimen Tributario', 'receipt', 'regimen', 'Régimen Simple / Común')}
                    </View>
                </Card>

                <Card className="mb-8 overflow-hidden relative border-0 p-0 bg-transparent">
                    <View className="absolute inset-0 bg-slate-900" />
                    <View className="absolute inset-0 bg-emerald-500/10" />
                    
                    <View className="p-6">
                        <View className="flex-row items-center mb-6">
                            <View className="w-10 h-10 rounded-xl bg-emerald-500/20 items-center justify-center mr-3">
                                <Ionicons name="location" size={20} color="#10B981" />
                            </View>
                            <Text className="text-white font-black text-lg uppercase tracking-widest" style={{ fontFamily: 'Space Grotesk' }}>
                                Ubicación y Contacto
                            </Text>
                        </View>

                        {renderInput('Dirección', 'map', 'direccion', 'Calle 123 #45-67')}
                        {renderInput('Teléfono', 'call', 'telefono', '300 000 0000', 'phone-pad')}
                        
                        <View className="flex-row gap-4">
                            <View className="flex-1">
                                {renderInput('Municipio', 'business', 'municipio', 'Cali')}
                            </View>
                            <View className="flex-1">
                                {renderInput('Departamento', 'map', 'departamento', 'Valle')}
                            </View>
                        </View>
                    </View>
                </Card>

                <Card className="mb-12 overflow-hidden relative border-0 p-0 bg-transparent">
                    <View className="absolute inset-0 bg-slate-900" />
                    <View className="absolute inset-0 bg-slate-500/10" />
                    
                    <View className="p-6">
                        <View className="flex-row items-center mb-6">
                            <View className="w-10 h-10 rounded-xl bg-slate-700/20 items-center justify-center mr-3">
                                <Ionicons name="calculator" size={20} color="#94A3B8" />
                            </View>
                            <Text className="text-white font-black text-lg uppercase tracking-widest" style={{ fontFamily: 'Space Grotesk' }}>
                                Parámetros Fiscales
                            </Text>
                        </View>
                        {renderInput('Tarifa IVA (%)', 'percent', 'tarifaIva', '0', 'numeric')}
                    </View>
                </Card>
            </Animated.View>

            <Button
                title={saving ? 'Guardando...' : 'Guardar Cambios'}
                icon="check-circle"
                variant="primary"
                size="lg"
                onPress={handleSave}
                loading={saving}
                className="mb-20 h-16"
            />
        </PageContainer>
    );
}
