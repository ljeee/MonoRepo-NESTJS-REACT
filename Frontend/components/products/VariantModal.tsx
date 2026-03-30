import React from 'react';
import { Modal } from 'react-native';
import { View, Text, ScrollView } from '../../tw';
import { Button, Input, Icon, Card } from '../ui';

interface VariantModalProps {
    visible: boolean;
    editing: boolean;
    name: string;
    price: string;
    description: string;
    error: string;
    loading: boolean;
    onClose: () => void;
    onSave: () => void;
    onNameChange: (value: string) => void;
    onPriceChange: (value: string) => void;
    onDescriptionChange: (value: string) => void;
}

export function VariantModal({
    visible,
    editing,
    name,
    price,
    description,
    error,
    loading,
    onClose,
    onSave,
    onNameChange,
    onPriceChange,
    onDescriptionChange,
}: VariantModalProps) {
    return (
        <Modal visible={visible} transparent animationType="fade" statusBarTranslucent>
            <View style={{ flex: 1, backgroundColor: 'rgba(5, 9, 20, 1)', justifyContent: 'center', alignItems: 'center', padding: 20 }}>
                <Card className="w-full max-w-[500px] bg-[#0F172A] border border-white/10 overflow-hidden rounded-[40px]">
                    <ScrollView contentContainerStyle={{ padding: 32 }}>
                        <View className="flex-row items-center gap-4 mb-8">
                            <View className="w-12 h-12 rounded-2xl bg-blue-500/10 items-center justify-center border border-blue-500/20">
                                <Icon
                                    name={editing ? 'pencil' : 'plus'}
                                    size={24}
                                    color="#3B82F6"
                                />
                            </View>
                            <Text className="text-white font-black text-2xl uppercase tracking-tighter" style={{ fontFamily: 'Space Grotesk' }}>
                                {editing ? 'Editar Variante' : 'Nueva Variante'}
                            </Text>
                        </View>

                        <View className="gap-y-6">
                            <Input
                                label="Nombre (Tamaño/Sabor)"
                                value={name}
                                onChangeText={onNameChange}
                                placeholder="Ej: Mediana, Pequeña"
                                leftIcon={<Icon name="tag-outline" size={16} color="#64748B" />}
                            />
                            <Input
                                label="Precio"
                                value={price}
                                onChangeText={onPriceChange}
                                keyboardType="numeric"
                                placeholder="0"
                                leftIcon={<Icon name="currency-usd" size={16} color="#F5A524" />}
                            />
                            <Input
                                label="Descripción"
                                value={description}
                                onChangeText={onDescriptionChange}
                                placeholder="Detalles extra"
                                multiline
                                numberOfLines={3}
                            />

                            {error ? (
                                <View className="flex-row items-center gap-2 bg-red-500/10 p-4 rounded-2xl border border-red-500/20">
                                    <Icon name="alert-circle" size={14} color="#EF4444" />
                                    <Text className="text-red-400 font-bold text-xs">{error}</Text>
                                </View>
                            ) : null}

                            <View className="flex-row gap-4 mt-2">
                                <Button
                                    title="Cancelar"
                                    variant="ghost"
                                    onPress={onClose}
                                    style={{ flex: 1 }}
                                />
                                <Button
                                    title={loading ? 'Salvando...' : 'Guardar'}
                                    variant="primary"
                                    onPress={onSave}
                                    loading={loading}
                                    style={{ flex: 1 }}
                                />
                            </View>
                        </View>
                    </ScrollView>
                </Card>
            </View>
        </Modal>
    );
}


