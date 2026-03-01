import React from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { colors } from '../../styles/theme';
import { Button, Input, Icon } from '../ui';
import { modalStyles as styles } from '../../styles/components/Modal.styles';


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
            <Pressable style={styles.modalOverlay} onPress={onClose}>
                <Pressable style={styles.modalContent} onPress={(e) => e.stopPropagation()}>
                    <View style={styles.modalHeader}>
                        <Icon
                            name={editing ? 'pencil-outline' : 'plus-circle-outline'}
                            size={22}
                            color={colors.primary}
                        />
                        <Text style={styles.modalTitle}>
                            {editing ? 'Editar Variante' : 'Nueva Variante'}
                        </Text>
                    </View>

                    <Input
                        label="Nombre (Tamaño/Sabor) *"
                        value={name}
                        onChangeText={onNameChange}
                        placeholder="Ej: Mediana, Pequeña"
                    />
                    <Input
                        label="Precio *"
                        value={price}
                        onChangeText={onPriceChange}
                        keyboardType="numeric"
                        placeholder="0"
                        leftIcon={<Icon name="currency-usd" size={16} color={colors.textMuted} />}
                    />
                    <Input
                        label="Descripción (Opcional)"
                        value={description}
                        onChangeText={onDescriptionChange}
                        placeholder="Detalles extra"
                        multiline
                    />

                    {error ? (
                        <View style={styles.inlineError}>
                            <Icon name="alert-circle-outline" size={14} color={colors.danger} />
                            <Text style={styles.inlineErrorText}>{error}</Text>
                        </View>
                    ) : null}

                    <View style={styles.modalActions}>
                        <Button
                            title="Cancelar"
                            variant="ghost"
                            onPress={onClose}
                            style={localStyles.flexOne}
                        />
                        <Button
                            title={loading ? 'Guardando...' : 'Guardar'}
                            variant="primary"
                            icon="content-save-outline"
                            onPress={onSave}
                            loading={loading}
                            style={localStyles.flexOne}
                        />
                    </View>
                </Pressable>
            </Pressable>
        </Modal>
    );
}

const localStyles = StyleSheet.create({
    flexOne: {
        flex: 1,
    },
});


