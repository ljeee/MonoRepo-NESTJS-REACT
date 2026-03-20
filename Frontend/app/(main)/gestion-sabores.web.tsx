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
                        <Card className="mb-4 p-8 bg-[#0F172A] border-white/5 mx-2 rounded-[32px] shadow-sm">
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
                                        className="w-11 h-11 rounded-xl bg-white/5 items-center justify-center border border-white/5 hover:bg-white/10 active:scale-95 transition-all"
                                    >
                                        <Icon name="pencil" size={18} color="#94A3B8" />
                                    </TouchableOpacity>
                                    <TouchableOpacity 
                                        onPress={() => setDeleteId(sabor.saborId)}
                                        className="w-11 h-11 rounded-xl bg-red-500/10 items-center justify-center border border-red-500/20 hover:bg-red-500/20 active:scale-95 transition-all"
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
