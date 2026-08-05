import React, { useEffect, useState } from 'react';
import { TouchableOpacity, TextInput } from 'react-native';
import { View, Text } from '../../tw';
import { EmpresaConfig, UpdateEmpresaDto, CuentaTransferencia, useToast } from '@/src/shared';
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

    // ── Cuentas QR state ──
    const [cuentas, setCuentas] = useState<CuentaTransferencia[]>([]);
    const [nuevaCuenta, setNuevaCuenta] = useState('');
    const [savingCuenta, setSavingCuenta] = useState(false);

    const loadConfig = async () => {
        try {
            setLoading(true);
            const [data, cData] = await Promise.all([
                api.empresa.get(),
                api.empresa.cuentasTransferencia.getAll(),
            ]);
            setConfig(data);
            setForm(data as any);
            setCuentas(cData || []);
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

    const handleAddCuenta = async () => {
        if (!nuevaCuenta.trim()) return;
        try {
            setSavingCuenta(true);
            await api.empresa.cuentasTransferencia.create(nuevaCuenta.trim());
            setNuevaCuenta('');
            showToast('Cuenta de transferencia agregada', 'success');
            const updated = await api.empresa.cuentasTransferencia.getAll();
            setCuentas(updated || []);
        } catch {
            showToast('No se pudo crear la cuenta', 'error');
        } finally {
            setSavingCuenta(false);
        }
    };

    const handleToggleCuenta = async (c: CuentaTransferencia) => {
        try {
            await api.empresa.cuentasTransferencia.update(c.id, { activa: !c.activa });
            const updated = await api.empresa.cuentasTransferencia.getAll();
            setCuentas(updated || []);
        } catch {
            showToast('No se pudo cambiar el estado de la cuenta', 'error');
        }
    };

    const handleDeleteCuenta = async (id: number) => {
        try {
            await api.empresa.cuentasTransferencia.delete(id);
            showToast('Cuenta eliminada', 'success');
            const updated = await api.empresa.cuentasTransferencia.getAll();
            setCuentas(updated || []);
        } catch {
            showToast('No se pudo eliminar la cuenta', 'error');
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
                        <View style={{ gap: 20 }}>
                            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 20 }}>
                                <View style={{ flex: 1, minWidth: 150 }}>
                                    {renderInput('Tarifa IVA (%)', 'percent-outline', 'tarifaIva', '0', 'numeric')}
                                </View>
                                <View style={{ flex: 1, minWidth: 150 }}>
                                    {renderInput('Recargo Leche ($)', 'cup-water', 'recargoLeche', '1000', 'numeric')}
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
                            <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: 'rgba(139,92,246,0.1)', alignItems: 'center', justifyContent: 'center' }}>
                                <Icon name="bank" size={20} color="#A78BFA" />
                            </View>
                            <View>
                                <Text style={{ fontFamily: 'SpaceGrotesk-Bold', color: '#F8FAFC', fontSize: 16, textTransform: 'uppercase', letterSpacing: 1 }}>
                                    Cuentas de Transferencia / QR
                                </Text>
                                <Text style={{ fontFamily: 'Outfit', color: '#64748B', fontSize: 11 }}>Cuentas bancarias para cobro por QR (Jeferson, Diana, Firu...)</Text>
                            </View>
                        </View>

                        {/* Input agregar cuenta */}
                        <View style={{ flexDirection: 'row', gap: 10, marginBottom: 20 }}>
                            <View style={{ flex: 1 }}>
                                <Input
                                    placeholder="Nombre de la cuenta (ej. Jeferson)..."
                                    value={nuevaCuenta}
                                    onChangeText={setNuevaCuenta}
                                />
                            </View>
                            <Button
                                title={savingCuenta ? '...' : 'Agregar'}
                                icon="plus"
                                variant="secondary"
                                onPress={handleAddCuenta}
                                loading={savingCuenta}
                                disabled={!nuevaCuenta.trim()}
                            />
                        </View>

                        {/* Lista de cuentas */}
                        <View style={{ gap: 10 }}>
                            {cuentas.map(c => (
                                <View
                                    key={c.id}
                                    style={{
                                        flexDirection: 'row',
                                        alignItems: 'center',
                                        justifyContent: 'space-between',
                                        padding: 12,
                                        borderRadius: 14,
                                        backgroundColor: 'rgba(0,0,0,0.3)',
                                        borderWidth: 1,
                                        borderColor: 'rgba(255,255,255,0.06)',
                                    }}
                                >
                                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                                        <Icon name="bank" size={16} color={c.activa ? '#A78BFA' : '#64748B'} />
                                        <Text style={{ fontFamily: 'SpaceGrotesk-Bold', color: c.activa ? '#FFFFFF' : '#64748B', fontSize: 14 }}>
                                            {c.nombre}
                                        </Text>
                                    </View>
                                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                        <TouchableOpacity
                                            onPress={() => handleToggleCuenta(c)}
                                            style={{
                                                paddingHorizontal: 10,
                                                paddingVertical: 4,
                                                borderRadius: 8,
                                                backgroundColor: c.activa ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)',
                                            }}
                                        >
                                            <Text style={{ fontFamily: 'Outfit', color: c.activa ? '#34D399' : '#F87171', fontSize: 11, fontWeight: '700' }}>
                                                {c.activa ? 'Activa' : 'Inactiva'}
                                            </Text>
                                        </TouchableOpacity>
                                        <TouchableOpacity
                                            onPress={() => handleDeleteCuenta(c.id)}
                                            style={{ padding: 6 }}
                                        >
                                            <Icon name="trash-can-outline" size={16} color="#EF4444" />
                                        </TouchableOpacity>
                                    </View>
                                </View>
                            ))}
                            {cuentas.length === 0 && (
                                <Text style={{ fontFamily: 'Outfit', color: '#64748B', fontSize: 12, textAlign: 'center' }}>
                                    No hay cuentas registradas. Agrega la primera arriba.
                                </Text>
                            )}
                        </View>
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
