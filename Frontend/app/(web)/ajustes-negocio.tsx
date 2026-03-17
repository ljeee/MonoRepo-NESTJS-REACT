import React, { useEffect, useState } from 'react';
import { View, Text } from '../../tw';
import { EmpresaConfig, UpdateEmpresaDto, useToast } from '@monorepo/shared';
import { FadeInUp } from 'react-native-reanimated';
import { Animated } from '../../tw/animated';
import { api as apiService } from '../../services/api';
import {
    PageContainer,
    PageHeader,
    Card,
    Input,
    Button,
    Icon,
    ListSkeleton
} from '../../components/ui';

export default function AjustesNegocioScreen() {
    const api = apiService;
    const { showToast } = useToast();
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
            showToast('No se pudo cargar la configuración del negocio', 'error');
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
            showToast('Configuración actualizada correctamente', 'success');
            loadConfig();
        } catch (error) {
            showToast('No se pudo guardar la configuración', 'error');
        } finally {
            setSaving(false);
        }
    };

    const renderInput = (label: string, icon: any, key: keyof UpdateEmpresaDto, placeholder: string, keyboard: any = 'default') => (
        <Input
            label={label}
            placeholder={placeholder}
            keyboardType={keyboard}
            value={form[key]?.toString()}
            onChangeText={(t) => setForm({ ...form, [key]: t })}
            leftIcon={<Icon name={icon} size={16} color="#64748B" />}
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

            <Animated.View entering={FadeInUp.duration(600)} className="max-w-4xl mx-auto w-full">
                <Card className="mb-8 overflow-hidden relative border-white/5 bg-transparent p-0">
                    <View className="absolute inset-0 bg-slate-900/40" />
                    <View className="absolute inset-0 bg-orange-500/5" />
                    
                    <View className="p-8">
                        <View className="flex-row items-center mb-8">
                            <View className="w-12 h-12 rounded-2xl bg-orange-500/20 items-center justify-center mr-4">
                                <Icon name="office-building" size={24} color="#F5A524" />
                            </View>
                            <View>
                                <Text className="text-white font-black text-xl uppercase tracking-widest" style={{ fontFamily: 'Space Grotesk' }}>
                                    Identidad Corporativa
                                </Text>
                                <Text className="text-zinc-500 text-xs">Datos legales y comerciales</Text>
                            </View>
                        </View>

                        <View className="gap-6">
                            {renderInput('Razón Social', 'text-box-outline', 'razonSocial', 'Nombre legal de la empresa')}
                            {renderInput('Nombre Comercial', 'tag-outline', 'nombreComercial', 'Marca que ven los clientes')}
                            <View className="flex-row gap-6">
                                <View className="flex-1">
                                    {renderInput('NIT / Identificación', 'fingerprint', 'nit', '900.000.000-1')}
                                </View>
                                <View className="flex-1">
                                    {renderInput('Régimen Tributario', 'receipt', 'regimen', 'Régimen Simple / Común')}
                                </View>
                            </View>
                        </View>
                    </View>
                </Card>

                <Card className="mb-8 overflow-hidden relative border-white/5 bg-transparent p-0">
                    <View className="absolute inset-0 bg-slate-900/40" />
                    <View className="absolute inset-0 bg-emerald-500/5" />
                    
                    <View className="p-8">
                        <View className="flex-row items-center mb-8">
                            <View className="w-12 h-12 rounded-2xl bg-emerald-500/20 items-center justify-center mr-4">
                                <Icon name="map-marker-outline" size={24} color="#10B981" />
                            </View>
                            <View>
                                <Text className="text-white font-black text-xl uppercase tracking-widest" style={{ fontFamily: 'Space Grotesk' }}>
                                    Ubicación y Contacto
                                </Text>
                                <Text className="text-zinc-500 text-xs">Información de contacto físico</Text>
                            </View>
                        </View>

                        <View className="gap-6">
                            {renderInput('Dirección', 'map-outline', 'direccion', 'Calle 123 #45-67')}
                            <View className="flex-row gap-6">
                                <View className="flex-1">
                                    {renderInput('Teléfono', 'phone-outline', 'telefono', '300 000 0000', 'phone-pad')}
                                </View>
                                <View className="flex-1">
                                    {renderInput('Municipio', 'city-variant-outline', 'municipio', 'Cali')}
                                </View>
                            </View>
                        </View>
                    </View>
                </Card>

                <Card className="mb-12 overflow-hidden relative border-white/5 bg-transparent p-0">
                    <View className="absolute inset-0 bg-slate-900/40" />
                    <View className="absolute inset-0 bg-slate-500/5" />
                    
                    <View className="p-8">
                        <View className="flex-row items-center mb-8">
                            <View className="w-12 h-12 rounded-2xl bg-slate-700/20 items-center justify-center mr-4">
                                <Icon name="calculator" size={24} color="#94A3B8" />
                            </View>
                            <View>
                                <Text className="text-white font-black text-xl uppercase tracking-widest" style={{ fontFamily: 'Space Grotesk' }}>
                                    Parámetros Fiscales
                                </Text>
                                <Text className="text-zinc-500 text-xs">Impuestos y facturación</Text>
                            </View>
                        </View>
                        {renderInput('Tarifa IVA (%)', 'percent-outline', 'tarifaIva', '0', 'numeric')}
                    </View>
                </Card>

                <Button
                    title={saving ? 'Guardando...' : 'Guardar Cambios'}
                    icon="check-decagram-outline"
                    variant="primary"
                    size="lg"
                    onPress={handleSave}
                    loading={saving}
                    className="mb-20 py-5"
                />
            </Animated.View>
        </PageContainer>
    );
}
