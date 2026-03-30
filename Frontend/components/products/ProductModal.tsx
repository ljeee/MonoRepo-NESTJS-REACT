import React from 'react';
import { Modal } from 'react-native';
import { View, Text, ScrollView } from '../../tw';
import { Button, Input, Icon, Card } from '../ui';

interface ProductModalProps {
    visible: boolean;
    editing: boolean;
    name: string;
    description: string;
    error: string;
    loading: boolean;
    onClose: () => void;
    onSave: () => void;
    onDelete?: () => void;
    onNameChange: (value: string) => void;
    onDescriptionChange: (value: string) => void;
}

export function ProductModal({
    visible,
    editing,
    name,
    description,
    error,
    loading,
    onClose,
    onSave,
    onDelete,
    onNameChange,
    onDescriptionChange,
}: ProductModalProps) {
    return (
        <Modal visible={visible} transparent animationType="fade" statusBarTranslucent>
            <View style={{ flex: 1, backgroundColor: 'rgba(5, 9, 20, 1)', justifyContent: 'center', alignItems: 'center', padding: 20 }}>
                <Card className="w-full max-w-[500px] bg-[#0F172A] border border-white/10 overflow-hidden rounded-[40px]">
                    <ScrollView contentContainerStyle={{ padding: 32 }}>
                        <View className="flex-row items-center gap-4 mb-8">
                            <View className="w-12 h-12 rounded-2xl bg-orange-500/10 items-center justify-center border border-orange-500/20">
                                <Icon
                                    name={editing ? 'pencil' : 'plus'}
                                    size={24}
                                    color="#F5A524"
                                />
                            </View>
                            <Text className="text-white font-black text-2xl uppercase tracking-tighter" style={{ fontFamily: 'Space Grotesk' }}>
                                {editing ? 'Editar Producto' : 'Nuevo Producto'}
                            </Text>
                        </View>

                        <View className="gap-y-6">
                            <Input
                                label="Nombre Producto"
                                value={name}
                                onChangeText={onNameChange}
                                placeholder="Ej: Pizza Hawaiana"
                                leftIcon={<Icon name="tag-outline" size={16} color="#64748B" />}
                            />
                            <Input
                                label="Descripción"
                                value={description}
                                onChangeText={onDescriptionChange}
                                placeholder="Descripción opcional"
                                multiline
                                numberOfLines={3}
                            />

                            {error ? (
                                <View className="flex-row items-center gap-2 bg-red-500/10 p-4 rounded-2xl border border-red-500/20">
                                    <Icon name="alert-circle" size={16} color="#EF4444" />
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

                            {editing && onDelete && (
                                <Button
                                    title="Eliminar Producto"
                                    variant="danger"
                                    icon="trash-can-outline"
                                    onPress={onDelete}
                                    className="mt-4 border-dashed border-red-500/20"
                                />
                            )}
                        </View>
                    </ScrollView>
                </Card>
            </View>
        </Modal>
    );
}


