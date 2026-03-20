import React, { useEffect, useState } from 'react';
import { Alert, Switch, Modal } from 'react-native';
import { View, Text, ScrollView, TouchableOpacity, TextInput } from '../../tw';
import { api as apiService } from '../../services/api';
import { PizzaSabor } from '@monorepo/shared';
import { Ionicons } from '@expo/vector-icons';
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
    ListSkeleton
} from '../../components/ui';

export default function GestionSaboresScreen() {
    const api = apiService;
    const [sabores, setSabores] = useState<PizzaSabor[]>([]);
    const [loading, setLoading] = useState(true);
    const [editingSabor, setEditingSabor] = useState<Partial<PizzaSabor> | null>(null);
    const [isModalVisible, setIsModalVisible] = useState(false);

    const loadSabores = async () => {
        try {
            setLoading(true);
            const data = await api.pizzaSabores.getAll();
            setSabores(data);
        } catch (error) {
            Alert.alert('Error', 'No se pudieron cargar los sabores');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadSabores();
    }, []);

    const handleSave = async () => {
        if (!editingSabor?.nombre) return Alert.alert('Error', 'El nombre es obligatorio');
        
        try {
            if (editingSabor.saborId) {
                await api.pizzaSabores.update(editingSabor.saborId, editingSabor);
            } else {
                await api.pizzaSabores.create(editingSabor as any);
            }
            setIsModalVisible(false);
            setEditingSabor(null);
            loadSabores();
            Alert.alert('Éxito', 'Sabor guardado correctamente');
        } catch (error) {
            Alert.alert('Error', 'No se pudo guardar el sabor');
        }
    };

    const handleDelete = (id: number) => {
        Alert.alert(
            'Confirmar',
            '¿Estás seguro de eliminar este sabor? Esto podría afectar a órdenes existentes.',
            [
                { text: 'Cancelar', style: 'cancel' },
                {
                    text: 'Eliminar',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            await api.pizzaSabores.delete(id);
                            loadSabores();
                        } catch (error) {
                            Alert.alert('Error', 'No se pudo eliminar el sabor');
                        }
                    }
                }
            ]
        );
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
                        <Card className="mb-4 p-6 bg-[#0F172A] border-white/5 mx-2 rounded-[24px] shadow-sm">
                            <View className="flex-row justify-between items-center mb-6">
                                <View className="flex-row items-center flex-1">
                                    <Text className="text-white text-base font-black uppercase tracking-tight mr-3" style={{ fontFamily: 'Space Grotesk', color: '#FFFFFF' }}>
                                        {sabor.nombre}
                                    </Text>
                                    <View className="bg-blue-500/10 px-2 py-0.5 rounded-full border border-blue-500/20">
                                        <Text className="text-blue-400 text-[8px] font-black uppercase tracking-widest">Configuración</Text>
                                    </View>
                                </View>
                                
                                <View className="flex-row gap-2">
                                    <TouchableOpacity 
                                        onPress={() => {
                                            setEditingSabor(sabor);
                                            setIsModalVisible(true);
                                        }}
                                        className="w-10 h-10 rounded-xl bg-white/5 items-center justify-center border border-white/5 active:scale-95 transition-all"
                                    >
                                        <Icon name="pencil" size={16} color="#F5A524" />
                                    </TouchableOpacity>
                                    <TouchableOpacity 
                                        onPress={() => handleDelete(sabor.saborId)}
                                        className="w-10 h-10 rounded-xl bg-white/5 items-center justify-center border border-white/5 active:scale-95 transition-all"
                                    >
                                        <Icon name="trash-can-outline" size={16} color="#F43F5E" />
                                    </TouchableOpacity>
                                </View>
                            </View>
 
                            <View className="flex-row gap-8">
                                <View>
                                    <Text className="text-slate-500 text-[9px] font-black uppercase tracking-widest mb-1.5">Pequena</Text>
                                    <Text className="text-white font-black text-lg" style={{ fontFamily: 'Space Grotesk', color: '#FFFFFF' }}>${sabor.recargoPequena}</Text>
                                </View>
                                <View>
                                    <Text className="text-slate-500 text-[9px] font-black uppercase tracking-widest mb-1.5">Mediana</Text>
                                    <Text className="text-white font-black text-lg" style={{ fontFamily: 'Space Grotesk', color: '#FFFFFF' }}>${sabor.recargoMediana}</Text>
                                </View>
                                <View>
                                    <Text className="text-slate-500 text-[9px] font-black uppercase tracking-widest mb-1.5">Grande</Text>
                                    <Text className="text-white font-black text-lg" style={{ fontFamily: 'Space Grotesk', color: '#FFFFFF' }}>${sabor.recargoGrande}</Text>
                                </View>
                            </View>
                        </Card>
                    </Animated.View>
                ))}
            </View>

            {isModalVisible && editingSabor && (
                <Modal visible={true} transparent animationType="fade" onRequestClose={() => setIsModalVisible(false)}>
                    <View className="flex-1 bg-black/80 items-center justify-center p-4">
                        <Card className="w-full max-w-2xl p-8 bg-[#0F172A] border border-white/10 rounded-[24px] shadow-2xl shadow-black/50">
                            <Text className="text-white text-2xl font-black mb-6 uppercase tracking-tight" style={{ fontFamily: 'Space Grotesk' }}>
                                {editingSabor.saborId ? 'Editar Sabor' : 'Nuevo Sabor'}
                            </Text>
                        
                        <View className="mb-6">
                            <Input
                                label="Nombre del Sabor"
                                value={editingSabor.nombre}
                                onChangeText={(t) => setEditingSabor({...editingSabor, nombre: t})}
                                placeholder="Ej: Paisa, Mexicana..."
                            />
                        </View>

                        <View className="flex-row gap-4 mb-6">
                            <TouchableOpacity 
                                onPress={() => setEditingSabor({...editingSabor, tipo: 'tradicional'})}
                                className={`flex-1 p-4 rounded-2xl border ${editingSabor.tipo === 'tradicional' ? 'bg-orange-500 border-orange-400 shadow-lg shadow-orange-500/20' : 'bg-zinc-800/50 border-white/5'}`}
                            >
                                <Text className={`text-center font-black uppercase text-xs tracking-widest ${editingSabor.tipo === 'tradicional' ? 'text-white' : 'text-zinc-500'}`}>Tradicional</Text>
                            </TouchableOpacity>
                            <TouchableOpacity 
                                onPress={() => setEditingSabor({...editingSabor, tipo: 'especial'})}
                                className={`flex-1 p-4 rounded-2xl border ${editingSabor.tipo === 'especial' ? 'bg-amber-600 border-amber-500 shadow-lg shadow-amber-500/20' : 'bg-zinc-800/50 border-white/5'}`}
                            >
                                <Text className={`text-center font-black uppercase text-xs tracking-widest ${editingSabor.tipo === 'especial' ? 'text-white' : 'text-zinc-500'}`}>Especial</Text>
                            </TouchableOpacity>
                        </View>

                        <View className="flex-row gap-4 mb-4">
                            <View className="flex-1">
                                <Input label="S ($)" keyboardType="numeric" value={editingSabor.recargoPequena?.toString()} onChangeText={(v) => setEditingSabor({...editingSabor, recargoPequena: parseInt(v) || 0})} />
                            </View>
                            <View className="flex-1">
                                <Input label="M ($)" keyboardType="numeric" value={editingSabor.recargoMediana?.toString()} onChangeText={(v) => setEditingSabor({...editingSabor, recargoMediana: parseInt(v) || 0})} />
                            </View>
                        </View>
                        <Input label="L ($)" keyboardType="numeric" value={editingSabor.recargoGrande?.toString()} onChangeText={(v) => setEditingSabor({...editingSabor, recargoGrande: parseInt(v) || 0})} />

                        <View className="flex-row gap-4 mt-8">
                            <Button title="Cancelar" variant="ghost" className="flex-1" onPress={() => setIsModalVisible(false)} />
                            <Button title="Guardar" variant="primary" className="flex-2" onPress={handleSave} />
                        </View>
                    </Card>
                </View>
            </Modal>
        )}
    </PageContainer>
  );
}
