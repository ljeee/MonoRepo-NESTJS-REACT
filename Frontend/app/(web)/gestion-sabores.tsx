import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
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
                        title="Nuevo"
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

            <View className="flex-1 px-2 pt-4">
                {sabores.map((sabor, idx) => (
                    <Animated.View 
                        key={sabor.saborId}
                        entering={FadeInUp.delay(idx * 50)}
                    >
                        <Card className="mb-4 p-8 bg-slate-900/50 border-white/5 mx-2 rounded-[32px]">
                            <View className="flex-row justify-between items-center mb-8">
                                <View className="flex-row items-center flex-1">
                                    <Text className="text-white text-xl font-black uppercase tracking-tight mr-4" style={{ fontFamily: 'Space Grotesk' }}>
                                        {sabor.nombre}
                                    </Text>
                                    <View className="bg-blue-500/10 px-3 py-1 rounded-full border border-blue-500/20">
                                        <Text className="text-blue-400 text-[10px] font-black uppercase tracking-widest">Configuración</Text>
                                    </View>
                                </View>
                                
                                <View className="flex-row gap-3">
                                    <TouchableOpacity 
                                        onPress={() => {
                                            setEditingSabor(sabor);
                                            setIsModalVisible(true);
                                        }}
                                        className="w-12 h-12 rounded-2xl bg-white/5 items-center justify-center border border-white/5 hover:bg-white/10 active:scale-95 transition-all"
                                    >
                                        <Icon name="pencil" size={20} color="#F5A524" />
                                    </TouchableOpacity>
                                    <TouchableOpacity 
                                        onPress={() => setDeleteId(sabor.saborId)}
                                        className="w-12 h-12 rounded-2xl bg-white/5 items-center justify-center border border-white/5 hover:bg-white/10 active:scale-95 transition-all"
                                    >
                                        <Icon name="trash-can-outline" size={20} color="#F43F5E" />
                                    </TouchableOpacity>
                                </View>
                            </View>
 
                            <View className="flex-row gap-12">
                                <View>
                                    <Text className="text-slate-500 text-[11px] font-black uppercase tracking-widest mb-2">Pequeña</Text>
                                    <Text className="text-white font-black text-2xl" style={{ fontFamily: 'Space Grotesk' }}>${sabor.recargoPequena}</Text>
                                </View>
                                <View>
                                    <Text className="text-slate-500 text-[11px] font-black uppercase tracking-widest mb-2">Mediana</Text>
                                    <Text className="text-white font-black text-2xl" style={{ fontFamily: 'Space Grotesk' }}>${sabor.recargoMediana}</Text>
                                </View>
                                <View>
                                    <Text className="text-slate-500 text-[11px] font-black uppercase tracking-widest mb-2">Grande</Text>
                                    <Text className="text-white font-black text-2xl" style={{ fontFamily: 'Space Grotesk' }}>${sabor.recargoGrande}</Text>
                                </View>
                            </View>
                        </Card>
                    </Animated.View>
                ))}
            </View>

            {/* Modal de Edición */}
            {isModalVisible && editingSabor && (
                <View className="absolute inset-0 bg-black/80 flex items-center justify-center px-6 z-50">
                    <Card className="w-full max-w-lg p-8 bg-zinc-900 border-white/10 shadow-2xl">
                        <View className="flex-row items-center gap-3 mb-8">
                            <View className="w-10 h-10 rounded-xl bg-orange-500/20 items-center justify-center">
                                <Icon name="pizza" size={20} color="#F5A524" />
                            </View>
                            <Text className="text-white text-2xl font-black uppercase tracking-tight" style={{ fontFamily: 'Space Grotesk' }}>
                                {editingSabor.saborId ? 'Editar Sabor' : 'Nuevo Sabor'}
                            </Text>
                        </View>
                        
                        <View className="mb-6">
                            <Input
                                label="Nombre del Sabor"
                                value={editingSabor.nombre}
                                onChangeText={(t) => setEditingSabor({...editingSabor, nombre: t})}
                                placeholder="Ej: Paisa, Mexicana..."
                                leftIcon={<Icon name="tag-outline" size={16} color="#64748B" />}
                            />
                        </View>

                        <Text className="text-zinc-500 text-[10px] font-black uppercase tracking-widest mb-3 ml-1">Clasificación</Text>
                        <View className="flex-row gap-4 mb-8">
                            <TouchableOpacity 
                                onPress={() => setEditingSabor({...editingSabor, tipo: 'tradicional'})}
                                className={`flex-1 p-4 rounded-2xl border ${editingSabor.tipo === 'tradicional' ? 'bg-orange-500/20 border-orange-500/50' : 'bg-black/20 border-white/5'}`}
                            >
                                <Text className={`text-center font-black uppercase text-xs tracking-widest ${editingSabor.tipo === 'tradicional' ? 'text-orange-500' : 'text-zinc-500'}`}>Tradicional</Text>
                            </TouchableOpacity>
                            <TouchableOpacity 
                                onPress={() => setEditingSabor({...editingSabor, tipo: 'especial'})}
                                className={`flex-1 p-4 rounded-2xl border ${editingSabor.tipo === 'especial' ? 'bg-amber-500/20 border-amber-500/50' : 'bg-black/20 border-white/5'}`}
                            >
                                <Text className={`text-center font-black uppercase text-xs tracking-widest ${editingSabor.tipo === 'especial' ? 'text-amber-500' : 'text-zinc-500'}`}>Especial</Text>
                            </TouchableOpacity>
                        </View>

                        <Text className="text-zinc-500 text-[10px] font-black uppercase tracking-widest mb-3 ml-1">Recargos por Tamaño</Text>
                        <View className="flex-row gap-4 mb-4">
                            <View className="flex-1">
                                <Input 
                                    label="S ($)" 
                                    keyboardType="numeric" 
                                    value={editingSabor.recargoPequena?.toString()} 
                                    onChangeText={(v) => setEditingSabor({...editingSabor, recargoPequena: parseInt(v) || 0})} 
                                />
                            </View>
                            <View className="flex-1">
                                <Input 
                                    label="M ($)" 
                                    keyboardType="numeric" 
                                    value={editingSabor.recargoMediana?.toString()} 
                                    onChangeText={(v) => setEditingSabor({...editingSabor, recargoMediana: parseInt(v) || 0})} 
                                />
                            </View>
                            <View className="flex-1">
                                <Input 
                                    label="L ($)" 
                                    keyboardType="numeric" 
                                    value={editingSabor.recargoGrande?.toString()} 
                                    onChangeText={(v) => setEditingSabor({...editingSabor, recargoGrande: parseInt(v) || 0})} 
                                />
                            </View>
                        </View>

                        <View className="flex-row gap-4 mt-8">
                            <Button title="Cancelar" variant="ghost" className="flex-1" onPress={() => setIsModalVisible(false)} />
                            <Button 
                                title={saving ? 'Guardando...' : 'Guardar'} 
                                variant="primary" 
                                className="flex-1" 
                                onPress={handleSave} 
                                loading={saving}
                            />
                        </View>
                    </Card>
                </View>
            )}

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
