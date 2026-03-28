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
                    
                    <View style={{ padding: 24 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 24, gap: 12 }}>
                            <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: 'rgba(245,165,36,0.1)', alignItems: 'center', justifyContent: 'center' }}>
                                <Icon name="office-building" size={20} color="#F5A524" />
                            </View>
                            <View>
                                <Text style={{ fontFamily: 'SpaceGrotesk-Bold', color: '#F8FAFC', fontSize: 16, textTransform: 'uppercase', letterSpacing: 1 }}>
                                    Identidad Corporativa
                                </Text>
                                <Text style={{ fontFamily: 'Outfit', color: '#64748B', fontSize: 11 }}>Datos legales y comerciales</Text>
                            </View>
                        </View>

                        <View style={{ gap: 20 }}>
                            {renderInput('Razón Social', 'text-box-outline', 'razonSocial', 'Nombre legal de la empresa')}
                            {renderInput('Nombre Comercial', 'tag-outline', 'nombreComercial', 'Marca que ven los clientes')}
                            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 20 }}>
                                <View style={{ flex: 1, minWidth: 200 }}>
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
                    
                    <View style={{ padding: 24 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 24, gap: 12 }}>
                            <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: 'rgba(16,185,129,0.1)', alignItems: 'center', justifyContent: 'center' }}>
                                <Icon name="map-marker-outline" size={20} color="#10B981" />
                            </View>
                            <View>
                                <Text style={{ fontFamily: 'SpaceGrotesk-Bold', color: '#F8FAFC', fontSize: 16, textTransform: 'uppercase', letterSpacing: 1 }}>
                                    Ubicación y Contacto
                                </Text>
                                <Text style={{ fontFamily: 'Outfit', color: '#64748B', fontSize: 11 }}>Información de contacto físico</Text>
                            </View>
                        </View>

                        <View style={{ gap: 20 }}>
                            {renderInput('Dirección', 'map-outline', 'direccion', 'Calle 123 #45-67')}
                            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 20 }}>
                                <View style={{ flex: 1, minWidth: 150 }}>
                                    {renderInput('Teléfono', 'phone-outline', 'telefono', '300 000 0000', 'phone-pad')}
                                </View>
                                <View style={{ flex: 1, minWidth: 150 }}>
                                    {renderInput('Municipio', 'city-variant-outline', 'municipio', 'Medellin')}
                                </View>
                            </View>
                        </View>
                    </View>
                </Card>

                <Card className="mb-12 overflow-hidden relative border-white/5 bg-transparent p-0">
                    <View className="absolute inset-0 bg-slate-900/40" />
                    <View className="absolute inset-0 bg-slate-500/5" />
                    
                    <View style={{ padding: 24 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 24, gap: 12 }}>
                            <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: 'rgba(148,163,184,0.1)', alignItems: 'center', justifyContent: 'center' }}>
                                <Icon name="calculator" size={20} color="#94A3B8" />
                            </View>
                            <View>
                                <Text style={{ fontFamily: 'SpaceGrotesk-Bold', color: '#F8FAFC', fontSize: 16, textTransform: 'uppercase', letterSpacing: 1 }}>
                                    Parámetros Fiscales
                                </Text>
                                <Text style={{ fontFamily: 'Outfit', color: '#64748B', fontSize: 11 }}>Impuestos y facturación</Text>
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
