import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView } from '../../tw';
import { api as apiService } from '../../services/api';
import { PizzaSabor, useToast } from '@monorepo/shared';
import { FadeInUp } from 'react-native-reanimated';
import { Animated } from '../../tw/animated';
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
    // Específicamente para RECARGO_3_SABORES -> Recargo de tres sabores
    if (name.toUpperCase() === 'RECARGO_3_SABORES') return 'Recargo de tres sabores';
    
    // Para otros: Sustituir guiones bajos por espacios y capitalizar
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
            if (editingSabor.saborId) {
                await api.pizzaSabores.update(editingSabor.saborId, editingSabor);
            } else {
                await api.pizzaSabores.create(editingSabor as any);
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
                title="Catálogo de Sabores"
                subtitle="Gestiona variedades y recargos"
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
                        style={{ minWidth: 140 }}
                    />
                }
            />

            <View className="flex-1 px-2 pt-4">
                {sabores.map((sabor, idx) => (
                    <Animated.View 
                        key={sabor.saborId}
                        entering={FadeInUp.delay(idx * 50)}
                    >
                        <Card className="mb-4 p-6 bg-slate-900 border-white/5 mx-2 rounded-3xl shadow-sm">
                            <View className="flex-row justify-between items-center mb-8">
                                <View className="flex-row items-center flex-1">
                                    <View className="w-12 h-12 rounded-2xl bg-orange-500/20 items-center justify-center mr-4 border border-orange-500/30">
                                        <Icon name="pizza" size={24} color="#F5A524" />
                                    </View>
                                    <View>
                                        <Text className="text-white text-xl font-bold tracking-tight" style={{ fontFamily: 'Space Grotesk', color: '#FFFFFF' }}>
                                            {formatFlavorName(sabor.nombre)}
                                        </Text>
                                        <View className="flex-row items-center mt-1">
                                            <View className={`w-2 h-2 rounded-full mr-2 ${sabor.tipo === 'especial' ? 'bg-amber-400' : 'bg-emerald-400'}`} />
                                            <Text className="text-slate-400 text-[10px] font-black uppercase tracking-widest">{sabor.tipo}</Text>
                                        </View>
                                    </View>
                                </View>
                                
                                <View className="flex-row gap-3">
                                    <TouchableOpacity 
                                        onPress={() => {
                                            setEditingSabor(sabor);
                                            setIsModalVisible(true);
                                        }}
                                        className="w-11 h-11 rounded-xl bg-white/5 items-center justify-center border border-white/5"
                                    >
                                        <Icon name="pencil" size={18} color="#94A3B8" />
                                    </TouchableOpacity>
                                    <TouchableOpacity 
                                        onPress={() => setDeleteId(sabor.saborId)}
                                        className="w-11 h-11 rounded-xl bg-red-500/10 items-center justify-center border border-red-500/20"
                                    >
                                        <Icon name="trash-can-outline" size={18} color="#F43F5E" />
                                    </TouchableOpacity>
                                </View>
                            </View>
 
                            <View className="flex-row gap-8 md:gap-16">
                                <View className="flex-row items-center gap-4">
                                    <View className="w-10 h-10 rounded-full bg-white/10 items-center justify-center border border-white/10">
                                        <Text className="text-white font-black text-xs">S</Text>
                                    </View>
                                    <View>
                                        <Text className="text-slate-500 text-[10px] font-black uppercase tracking-widest mb-0.5">Pequeña</Text>
                                        <Text className="text-white font-bold text-xl" style={{ fontFamily: 'Space Grotesk', color: '#FFFFFF' }}>{formatCurrency(Number(sabor.recargoPequena))}</Text>
                                    </View>
                                </View>
                                <View className="flex-row items-center gap-4">
                                    <View className="w-10 h-10 rounded-full bg-white/10 items-center justify-center border border-white/10">
                                        <Text className="text-white font-black text-xs">M</Text>
                                    </View>
                                    <View>
                                        <Text className="text-slate-500 text-[10px] font-black uppercase tracking-widest mb-0.5">Mediana</Text>
                                        <Text className="text-white font-bold text-xl" style={{ fontFamily: 'Space Grotesk', color: '#FFFFFF' }}>{formatCurrency(Number(sabor.recargoMediana))}</Text>
                                    </View>
                                </View>
                                <View className="flex-row items-center gap-4">
                                    <View className="w-10 h-10 rounded-full bg-white/10 items-center justify-center border border-white/10">
                                        <Text className="text-white font-black text-xs">L</Text>
                                    </View>
                                    <View>
                                        <Text className="text-slate-500 text-[10px] font-black uppercase tracking-widest mb-0.5">Grande</Text>
                                        <Text className="text-white font-bold text-xl" style={{ fontFamily: 'Space Grotesk', color: '#FFFFFF' }}>{formatCurrency(Number(sabor.recargoGrande))}</Text>
                                    </View>
                                </View>
                            </View>
                        </Card>
                    </Animated.View>
                ))}
            </View>

            <Modal visible={isModalVisible && !!editingSabor} transparent animationType="fade" statusBarTranslucent>
                <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'center', alignItems: 'center', padding: 20 }}>
                    <Card style={{ width: '100%', maxWidth: 512, backgroundColor: '#18181B', borderColor: 'rgba(255,255,255,0.1)', overflow: 'hidden', maxHeight: '90%' }}>
                        <ScrollView contentContainerStyle={{ padding: 32 }}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 32 }}>
                                <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: 'rgba(245,165,36,0.2)', alignItems: 'center', justifyContent: 'center' }}>
                                    <Icon name="pizza" size={20} color="#F5A524" />
                                </View>
                                <Text style={{ fontFamily: 'SpaceGrotesk-Bold', color: '#FFFFFF', fontSize: 24, textTransform: 'uppercase', letterSpacing: -0.5 }}>
                                    {editingSabor?.saborId ? 'Editar Sabor' : 'Nuevo Sabor'}
                                </Text>
                            </View>
                            
                            <View style={{ marginBottom: 24 }}>
                                <Input
                                    label="Nombre del Sabor"
                                    value={editingSabor?.nombre || ''}
                                    onChangeText={(t) => setEditingSabor({...editingSabor, nombre: t})}
                                    placeholder="Ej: Paisa, Mexicana... o RECARGO_3_SABORES"
                                    leftIcon={<Icon name="tag-outline" size={16} color="#64748B" />}
                                />
                            </View>

                            <Text style={{ fontFamily: 'Outfit', color: '#71717A', fontSize: 10, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12 }}>Clasificación</Text>
                            <View style={{ flexDirection: 'row', gap: 8, marginBottom: 32 }}>
                                <TouchableOpacity 
                                    onPress={() => setEditingSabor({...editingSabor, tipo: 'tradicional'})}
                                    style={{ flex: 1, paddingVertical: 12, paddingHorizontal: 4, borderRadius: 16, borderWidth: 1, borderColor: editingSabor?.tipo === 'tradicional' ? 'rgba(245,165,36,0.5)' : 'rgba(255,255,255,0.05)', backgroundColor: editingSabor?.tipo === 'tradicional' ? 'rgba(245,165,36,0.2)' : 'rgba(0,0,0,0.2)' }}
                                >
                                    <Text numberOfLines={1} style={{ textAlign: 'center', fontFamily: 'Outfit', fontWeight: 'bold', textTransform: 'uppercase', fontSize: 10, letterSpacing: 0.5, color: editingSabor?.tipo === 'tradicional' ? '#F5A524' : '#71717A' }}>Tradicional</Text>
                                </TouchableOpacity>
                                <TouchableOpacity 
                                    onPress={() => setEditingSabor({...editingSabor, tipo: 'especial'})}
                                    style={{ flex: 1, paddingVertical: 12, paddingHorizontal: 4, borderRadius: 16, borderWidth: 1, borderColor: editingSabor?.tipo === 'especial' ? 'rgba(245,158,11,0.5)' : 'rgba(255,255,255,0.05)', backgroundColor: editingSabor?.tipo === 'especial' ? 'rgba(245,158,11,0.2)' : 'rgba(0,0,0,0.2)' }}
                                >
                                    <Text numberOfLines={1} style={{ textAlign: 'center', fontFamily: 'Outfit', fontWeight: 'bold', textTransform: 'uppercase', fontSize: 10, letterSpacing: 0.5, color: editingSabor?.tipo === 'especial' ? '#F59E0B' : '#71717A' }}>Especial</Text>
                                </TouchableOpacity>
                                <TouchableOpacity 
                                    onPress={() => setEditingSabor({...editingSabor, tipo: 'configuracion'})}
                                    style={{ flex: 1, paddingVertical: 12, paddingHorizontal: 4, borderRadius: 16, borderWidth: 1, borderColor: editingSabor?.tipo === 'configuracion' ? 'rgba(168,85,247,0.5)' : 'rgba(255,255,255,0.05)', backgroundColor: editingSabor?.tipo === 'configuracion' ? 'rgba(168,85,247,0.2)' : 'rgba(0,0,0,0.2)' }}
                                >
                                    <Text numberOfLines={1} style={{ textAlign: 'center', fontFamily: 'Outfit', fontWeight: 'bold', textTransform: 'uppercase', fontSize: 10, letterSpacing: 0.5, color: editingSabor?.tipo === 'configuracion' ? '#A855F7' : '#71717A' }}>Config</Text>
                                </TouchableOpacity>
                            </View>

                            <Text style={{ fontFamily: 'Outfit', color: '#71717A', fontSize: 10, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12 }}>Recargos por Tamaño</Text>
                            <View style={{ flexDirection: 'row', gap: 16, marginBottom: 16 }}>
                                <View style={{ flex: 1 }}>
                                    <Input 
                                        label="S ($)" 
                                        keyboardType="numeric" 
                                        value={editingSabor?.recargoPequena?.toString()} 
                                        onChangeText={(v) => setEditingSabor({...editingSabor, recargoPequena: parseInt(v) || 0})} 
                                    />
                                </View>
                                <View style={{ flex: 1 }}>
                                    <Input 
                                        label="M ($)" 
                                        keyboardType="numeric" 
                                        value={editingSabor?.recargoMediana?.toString()} 
                                        onChangeText={(v) => setEditingSabor({...editingSabor, recargoMediana: parseInt(v) || 0})} 
                                    />
                                </View>
                                <View style={{ flex: 1 }}>
                                    <Input 
                                        label="L ($)" 
                                        keyboardType="numeric" 
                                        value={editingSabor?.recargoGrande?.toString()} 
                                        onChangeText={(v) => setEditingSabor({...editingSabor, recargoGrande: parseInt(v) || 0})} 
                                    />
                                </View>
                            </View>

                            <View style={{ flexDirection: 'row', gap: 16, marginTop: 32 }}>
                                <Button title="Cancelar" variant="ghost" style={{ flex: 1 }} onPress={() => setIsModalVisible(false)} />
                                <Button 
                                    title={saving ? 'Guardando...' : 'Guardar'} 
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
                message="¿Estás seguro de eliminar este sabor? Esto podría afectar a órdenes existentes."
                icon="trash-can-outline"
                variant="danger"
                onConfirm={confirmDelete}
                onCancel={() => setDeleteId(null)}
            />
        </PageContainer>
    );
}
