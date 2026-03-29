import React from 'react';
import { Modal } from 'react-native';
import { View, Text, Pressable, ScrollView } from '../../tw';
import { Button, Input, Icon } from '../ui';

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
            <Pressable 
                className="flex-1 bg-black/60 items-center justify-center p-6" 
                onPress={onClose}
            >
                <Pressable 
                    className="w-full max-w-sm bg-slate-900 border border-white/10 rounded-3xl overflow-hidden max-h-[85%]" 
                    onPress={(e: any) => e.stopPropagation()}
                >
                    <View className="flex-row items-center gap-3 p-6 bg-white/5 border-b border-white/5">
                        <View className="w-10 h-10 rounded-xl bg-blue-500/10 items-center justify-center">
                            <Icon
                                name={editing ? 'pencil' : 'plus'}
                                size={20}
                                color="#3B82F6"
                            />
                        </View>
                        <Text className="text-white font-black uppercase tracking-widest text-sm" style={{ fontFamily: 'Space Grotesk' }}>
                            {editing ? 'Editar Variante' : 'Nueva Variante'}
                        </Text>
                    </View>

                    <ScrollView className="p-6" contentContainerClassName="gap-y-4">
                        <View className="gap-y-4">
                            <Input
                                label="Nombre (Tamaño/Sabor)"
                                value={name}
                                onChangeText={onNameChange}
                                placeholder="Ej: Mediana, Pequeña"
                                className="bg-black/20"
                            />
                            <Input
                                label="Precio"
                                value={price}
                                onChangeText={onPriceChange}
                                keyboardType="numeric"
                                placeholder="0"
                                leftIcon={<Icon name="currency-usd" size={16} color="#64748B" />}
                                className="bg-black/20"
                            />
                            <Input
                                label="Descripción (Opcional)"
                                value={description}
                                onChangeText={onDescriptionChange}
                                placeholder="Detalles extra"
                                multiline
                                className="bg-black/20"
                            />

                            {error ? (
                                <View className="flex-row items-center gap-2 bg-red-500/10 p-3 rounded-xl">
                                    <Icon name="alert-circle" size={14} color="#EF4444" />
                                    <Text className="text-red-400 font-bold text-xs">{error}</Text>
                                </View>
                            ) : null}

                            <View className="flex-row gap-3 mt-4 mb-4">
                                <Button
                                    title="Cancelar"
                                    variant="ghost"
                                    onPress={onClose}
                                    className="flex-1"
                                />
                                <Button
                                    title={loading ? '...' : 'Guardar'}
                                    variant="primary"
                                    icon="content-save"
                                    onPress={onSave}
                                    loading={loading}
                                    className="flex-1"
                                />
                            </View>
                        </View>
                    </ScrollView>
                </Pressable>
            </Pressable>
        </Modal>
    );
}


