import React, { useEffect, useState } from 'react';
import { Platform } from 'react-native';
import { View, Text, TouchableOpacity, ScrollView } from '../../tw';
import { api as apiService } from '../../services/api';
import { PizzaSabor, useToast } from '@/src/shared';
import { FadeInUp } from 'react-native-reanimated';
import { Animated } from '../../tw/animated';
import { useBreakpoint } from '../../styles/responsive';
import {
    PageContainer,
    PageHeader,
    Card,
    Input,
    Button,
    Badge,
    Icon,
    ListSkeleton,
    ConfirmModal
} from '../../components/ui';
import { Modal } from 'react-native';

function formatFlavorName(name: string): string {
    if (!name) return '';
    if (name.toUpperCase() === 'RECARGO_3_SABORES') return 'Recargo 3 Sabores';
    return name
        .toLowerCase()
        .replace(/_/g, ' ')
        .replace(/\b\w/g, (l) => l.toUpperCase());
}

function formatCurrency(n: number) {
    return '$' + n.toLocaleString('es-CO', { minimumFractionDigits: 0 });
}

export default function GestionSaboresScreen() {
    const api = apiService;
    const { showToast } = useToast();
    const [sabores, setSabores] = useState<PizzaSabor[]>([]);
    const [loading, setLoading] = useState(true);
    const [editingSabor, setEditingSabor] = useState<Partial<PizzaSabor> | null>(null);
    const [isModalVisible, setIsModalVisible] = useState(false);
    const [deleteId, setDeleteId] = useState<number | null>(null);
    const [saving, setSaving] = useState(false);
    const { isMobile } = useBreakpoint();
    const isWeb = Platform.OS === 'web';

    const loadSabores = async () => {
        try {
            setLoading(true);
            const data = await api.pizzaSabores.getAll();
            setSabores(data);
        } catch (error) {
            showToast('No se pudieron cargar los sabores', 'error');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadSabores();
    }, []);

    const handleSave = async () => {
        if (!editingSabor?.nombre) return showToast('El nombre es obligatorio', 'error');
        setSaving(true);
        try {
            const isPizza = editingSabor.tipo === 'tradicional' || editingSabor.tipo === 'especial' || (editingSabor.tipo as string) === 'pizza';
            const isCalzone = editingSabor.tipo === 'calzone';
            
            const recargoPequena = Number(isCalzone ? 0 : (editingSabor.recargoPequena ?? 0));
            const recargoMediana = Number(isCalzone ? 0 : (editingSabor.recargoMediana ?? 0));
            const recargoGrande = Number(isCalzone ? 0 : (editingSabor.recargoGrande ?? 0));
            
            const tipoFinal = isPizza
                ? (recargoPequena > 0 || recargoMediana > 0 || recargoGrande > 0 ? 'especial' : 'tradicional')
                : editingSabor.tipo;

            const dataToSave = {
                ...editingSabor,
                tipo: tipoFinal,
                recargoPequena,
                recargoMediana,
                recargoGrande,
            };
            if (editingSabor.saborId) {
                await api.pizzaSabores.update(editingSabor.saborId, dataToSave);
            } else {
                await api.pizzaSabores.create(dataToSave as any);
            }
            setIsModalVisible(false);
            setEditingSabor(null);
            loadSabores();
            showToast('Sabor guardado correctamente', 'success');
        } catch (error) {
            showToast('No se pudo guardar el sabor', 'error');
        } finally {
            setSaving(false);
        }
    };

    const confirmDelete = async () => {
        if (!deleteId) return;
        try {
            await api.pizzaSabores.delete(deleteId);
            setDeleteId(null);
            loadSabores();
            showToast('Sabor eliminado', 'success');
        } catch (error) {
            showToast('No se pudo eliminar el sabor', 'error');
        }
    };

    if (loading) return <PageContainer scrollable={false}><ListSkeleton count={8} /></PageContainer>;

    return (
        <PageContainer scrollable>
            <PageHeader 
                title="Saborización"
                subtitle="Administración de variedades y recargos"
                icon="pizza"
                rightContent={
                    <Button 
                        title="Nuevo Sabor"
                        icon="plus"
                        variant="primary"
                        size="sm"
                        onPress={() => {
                            setEditingSabor({ tipo: 'tradicional', recargoPequena: 0, recargoMediana: 0, recargoGrande: 0, activo: true });
                            setIsModalVisible(true);
                        }}
                    />
                }
            />

            <View className="flex-row flex-wrap gap-4 px-2 pt-4 pb-20">
                {sabores.map((sabor, idx) => (
                    <Animated.View 
                        key={sabor.saborId}
                        entering={FadeInUp.delay(idx * 50)}
                        className={`${isWeb ? 'w-full lg:w-[49%]' : 'w-full'}`}
                    >
                        <Card className="p-6 bg-white/5 border border-white/5 rounded-[32px]">
                            <View className="flex-row justify-between items-start mb-6">
                                <View className="flex-row items-center flex-1 mr-4">
                                    <View className={`w-12 h-12 rounded-2xl items-center justify-center mr-4 border ${sabor.tipo === 'calzone' ? 'bg-sky-500/10 border-sky-500/20' : 'bg-orange-500/10 border-orange-500/20'}`}>
                                        <Icon name={sabor.tipo === 'calzone' ? 'food-variant' : 'pizza'} size={24} color={sabor.tipo === 'calzone' ? '#38BDF8' : '#F5A524'} />
                                    </View>
                                    <View className="flex-1">
                                        <Text className="text-white text-lg font-black uppercase tracking-tight" style={{ fontFamily: 'Space Grotesk' }} numberOfLines={1}>
                                            {formatFlavorName(sabor.nombre)}
                                        </Text>
                                        <View className="flex-row items-center mt-1">
                                            <View className={`w-1.5 h-1.5 rounded-full mr-2 ${sabor.tipo === 'especial' ? 'bg-amber-400' : sabor.tipo === 'calzone' ? 'bg-sky-400' : sabor.tipo === 'configuracion' ? 'bg-slate-400' : 'bg-emerald-400'}`} />
                                            <Text className="text-slate-500 text-[9px] font-black uppercase tracking-widest">
                                                {sabor.tipo === 'tradicional' || sabor.tipo === 'especial' ? 'pizza' : sabor.tipo}
                                            </Text>
                                        </View>
                                    </View>
                                </View>
                                
                                <View className="flex-row gap-2">
                                    <TouchableOpacity 
                                        onPress={() => {
                                            setEditingSabor(sabor);
                                            setIsModalVisible(true);
                                        }}
                                        className="w-10 h-10 rounded-xl bg-white/5 items-center justify-center border border-white/10 active:bg-white/10"
                                    >
                                        <Icon name="pencil-outline" size={16} color="#94A3B8" />
                                    </TouchableOpacity>
                                    <TouchableOpacity 
                                        onPress={() => setDeleteId(sabor.saborId)}
                                        className="w-10 h-10 rounded-xl bg-red-500/10 items-center justify-center border border-red-500/20 active:bg-red-500/20"
                                    >
                                        <Icon name="trash-can-outline" size={16} color="#EF4444" />
                                    </TouchableOpacity>
                                </View>
                            </View>
 
                            {sabor.tipo === 'calzone' ? (
                                <View className="flex-row justify-between bg-black/20 p-4 rounded-2xl border border-white/5">
                                    <View className="items-center flex-1">
                                        <Text className="text-slate-500 text-[8px] font-black uppercase tracking-widest mb-1">Precio Calzone</Text>
                                        <Text className="text-sky-400 font-bold text-sm uppercase" style={{ fontFamily: 'Space Grotesk' }}>Precio Plano (Sin Recargos)</Text>
                                    </View>
                                </View>
                            ) : (sabor.tipo !== 'configuracion' && Number(sabor.recargoPequena) === 0 && Number(sabor.recargoMediana) === 0 && Number(sabor.recargoGrande) === 0) ? (
                                <View className="flex-row justify-between bg-black/20 p-4 rounded-2xl border border-white/5">
                                    <View className="items-center flex-1">
                                        <Text className="text-slate-500 text-[8px] font-black uppercase tracking-widest mb-1">Precio Pizza</Text>
                                        <Text className="text-emerald-400 font-bold text-sm uppercase" style={{ fontFamily: 'Space Grotesk' }}>Precio Regular (Sin Recargo)</Text>
                                    </View>
                                </View>
                            ) : (
                                <View className="flex-row justify-between bg-black/20 p-4 rounded-2xl border border-white/5">
                                    <View className="items-center flex-1 border-r border-white/5">
                                        <Text className="text-slate-500 text-[8px] font-black uppercase tracking-widest mb-1">Pequeña</Text>
                                        <Text className="text-white font-bold text-sm" style={{ fontFamily: 'Space Grotesk' }}>{formatCurrency(Number(sabor.recargoPequena))}</Text>
                                    </View>
                                    <View className="items-center flex-1 border-r border-white/5">
                                        <Text className="text-slate-500 text-[8px] font-black uppercase tracking-widest mb-1">Mediana</Text>
                                        <Text className="text-orange-400 font-bold text-sm" style={{ fontFamily: 'Space Grotesk' }}>{formatCurrency(Number(sabor.recargoMediana))}</Text>
                                    </View>
                                    <View className="items-center flex-1">
                                        <Text className="text-slate-500 text-[8px] font-black uppercase tracking-widest mb-1">Grande</Text>
                                        <Text className="text-white font-bold text-sm" style={{ fontFamily: 'Space Grotesk' }}>{formatCurrency(Number(sabor.recargoGrande))}</Text>
                                    </View>
                                </View>
                            )}
                        </Card>
                    </Animated.View>
                ))}
            </View>

            <Modal visible={isModalVisible && !!editingSabor} transparent animationType="fade" statusBarTranslucent>
                <View style={{ flex: 1, backgroundColor: 'rgba(5, 9, 20, 1)', justifyContent: 'center', alignItems: 'center', padding: 20 }}>
                    <Card className="w-full max-w-[500px] bg-[#0F172A] border border-white/10 overflow-hidden rounded-[40px]">
                        <ScrollView contentContainerStyle={{ padding: 32 }}>
                            <View className="flex-row items-center gap-4 mb-8">
                                <View className={`w-12 h-12 rounded-2xl items-center justify-center border ${editingSabor?.tipo === 'calzone' ? 'bg-sky-500/10 border-sky-500/20' : 'bg-orange-500/10 border-orange-500/20'}`}>
                                    <Icon name={editingSabor?.tipo === 'calzone' ? 'food-variant' : 'pizza'} size={24} color={editingSabor?.tipo === 'calzone' ? '#38BDF8' : '#F5A524'} />
                                </View>
                                <Text className="text-white font-black text-2xl uppercase tracking-tighter" style={{ fontFamily: 'Space Grotesk' }}>
                                    {editingSabor?.saborId ? 'Editar Sabor' : 'Nuevo Sabor'}
                                </Text>
                            </View>
                            
                            <View className="mb-6">
                                <Input
                                    label="Nombre del Sabor"
                                    value={editingSabor?.nombre || ''}
                                    onChangeText={(t) => setEditingSabor({...editingSabor, nombre: t})}
                                    placeholder="Ej: Paisa, Mexicana..."
                                    leftIcon={<Icon name="tag-outline" size={16} color="#64748B" />}
                                />
                            </View>
 
                            <Text className="text-slate-500 text-[10px] font-black uppercase tracking-widest mb-3 ml-1">Clasificación de Sabor</Text>
                            <View className="flex-row flex-wrap gap-1.5 mb-8">
                                {['pizza', 'calzone', 'configuracion'].map((type) => {
                                    const isSelected = type === 'pizza'
                                        ? (editingSabor?.tipo === 'tradicional' || editingSabor?.tipo === 'especial' || (editingSabor?.tipo as string) === 'pizza')
                                        : editingSabor?.tipo === type;
                                    return (
                                        <TouchableOpacity 
                                            key={type}
                                            onPress={() => setEditingSabor({...editingSabor, tipo: (type === 'pizza' ? 'tradicional' : type) as any})}
                                            className={`flex-1 min-w-[75px] py-3 items-center rounded-2xl border ${isSelected ? 'bg-orange-500/20 border-orange-500/40' : 'bg-white/5 border-white/5'}`}
                                        >
                                            <Text className={`font-black text-[10px] uppercase ${isSelected ? 'text-orange-400' : 'text-slate-500'}`}>{type.substring(0, 5)}</Text>
                                        </TouchableOpacity>
                                    );
                                })}
                            </View>
 
                            {(editingSabor?.tipo === 'tradicional' || editingSabor?.tipo === 'especial' || editingSabor?.tipo === 'configuracion' || (editingSabor?.tipo as string) === 'pizza') ? (
                                <>
                                    <Text className="text-slate-500 text-[10px] font-black uppercase tracking-widest mb-3 ml-1">Recargos Adicionales ($)</Text>
                                    <View className="flex-row gap-4 mb-10">
                                        <View className="flex-1">
                                            <Input 
                                                label="S" 
                                                keyboardType="numeric" 
                                                value={editingSabor?.recargoPequena?.toString()} 
                                                onChangeText={(v) => setEditingSabor({...editingSabor, recargoPequena: parseInt(v) || 0})} 
                                            />
                                        </View>
                                        <View className="flex-1">
                                            <Input 
                                                label="M" 
                                                keyboardType="numeric" 
                                                value={editingSabor?.recargoMediana?.toString()} 
                                                onChangeText={(v) => setEditingSabor({...editingSabor, recargoMediana: parseInt(v) || 0})} 
                                            />
                                        </View>
                                        <View className="flex-1">
                                            <Input 
                                                label="L" 
                                                keyboardType="numeric" 
                                                value={editingSabor?.recargoGrande?.toString()} 
                                                onChangeText={(v) => setEditingSabor({...editingSabor, recargoGrande: parseInt(v) || 0})} 
                                            />
                                        </View>
                                    </View>
                                </>
                            ) : (
                                <View className="bg-white/5 border border-white/10 rounded-2xl p-4 mb-10 items-center">
                                    <Icon name="information-outline" size={20} color="#38BDF8" />
                                    <Text className="text-slate-400 text-xs font-bold text-center mt-2">
                                        Los calzones manejan precio plano (definido en variantes de producto). No requieren recargos por tamaño.
                                    </Text>
                                </View>
                            )}

                            <View className="flex-row gap-4">
                                <Button title="Cerrar" variant="ghost" style={{ flex: 1 }} onPress={() => setIsModalVisible(false)} />
                                <Button 
                                    title={saving ? 'Salvando...' : 'Guardar'} 
                                    variant="primary" 
                                    style={{ flex: 1 }} 
                                    onPress={handleSave} 
                                    loading={saving}
                                />
                            </View>
                        </ScrollView>
                    </Card>
                </View>
            </Modal>

            <ConfirmModal
                visible={!!deleteId}
                title="Eliminar Sabor"
                message="¿Estás seguro de eliminar este sabor? Esto podría afectar a órdenes existentes en el historial."
                icon="trash-can-outline"
                variant="danger"
                onConfirm={confirmDelete}
                onCancel={() => setDeleteId(null)}
            />
        </PageContainer>
    );
}
