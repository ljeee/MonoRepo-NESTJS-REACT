import React from 'react';
import { Modal } from 'react-native';
import { View, Text, Pressable } from '../../tw';
import { Button, Input, Icon } from '../ui';

interface ProductModalProps {
    visible: boolean;
    editing: boolean;
    name: string;
    category: string;
    description: string;
    error: string;
    loading: boolean;
    onClose: () => void;
    onSave: () => void;
    onDelete?: () => void;
    onNameChange: (value: string) => void;
    onCategoryChange: (value: string) => void;
    onDescriptionChange: (value: string) => void;
}

export function ProductModal({
    visible,
    editing,
    name,
    category,
    description,
    error,
    loading,
    onClose,
    onSave,
    onDelete,
    onNameChange,
    onCategoryChange,
    onDescriptionChange,
}: ProductModalProps) {
    return (
        <Modal visible={visible} transparent animationType="fade" statusBarTranslucent>
            <Pressable 
                className="flex-1 bg-black/60 items-center justify-center p-6" 
                onPress={onClose}
            >
                <Pressable 
                    className="w-full max-w-md bg-slate-900 border border-white/10 rounded-3xl overflow-hidden" 
                    onPress={(e: any) => e.stopPropagation()}
                >
                    <View className="flex-row items-center gap-3 p-6 bg-white/5 border-b border-white/5">
                        <View className="w-10 h-10 rounded-xl bg-orange-500/10 items-center justify-center">
                            <Icon
                                name={editing ? 'pencil' : 'plus'}
                                size={20}
                                color="#F5A524"
                            />
                        </View>
                        <Text className="text-white font-black uppercase tracking-widest text-sm" style={{ fontFamily: 'Space Grotesk' }}>
                            {editing ? 'Editar Producto' : 'Nuevo Producto'}
                        </Text>
                    </View>

                    <View className="p-6 gap-y-4">
                        <Input
                            label="Nombre Producto"
                            value={name}
                            onChangeText={onNameChange}
                            placeholder="Ej: Pizza Hawaiana"
                            className="bg-black/20"
                        />
                        <Input
                            label="Categoría"
                            value={category}
                            onChangeText={onCategoryChange}
                            placeholder="Ej: Pizzas, Bebidas"
                            className="bg-black/20"
                        />
                        <Input
                            label="Descripción"
                            value={description}
                            onChangeText={onDescriptionChange}
                            placeholder="Descripción opcional"
                            multiline
                            className="bg-black/20"
                        />

                        {error ? (
                            <View className="flex-row items-center gap-2 bg-red-500/10 p-3 rounded-xl">
                                <Icon name="alert-circle" size={14} color="#EF4444" />
                                <Text className="text-red-400 font-bold text-xs">{error}</Text>
                            </View>
                        ) : null}

                        <View className="flex-row gap-3 mt-2">
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

                        {editing && onDelete && (
                            <Button
                                title="Eliminar Producto"
                                variant="danger"
                                icon="trash-can-outline"
                                onPress={onDelete}
                                className="mt-2 border-dashed border-red-500/20"
                            />
                        )}
                    </View>
                </Pressable>
            </Pressable>
        </Modal>
    );
}


