import React from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { colors } from '../../styles/theme';
import { spacing } from '../../styles/tokens';
import { Button, Input, Icon } from '../ui';
import { modalStyles as styles } from '../../styles/components/Modal.styles';


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
            <Pressable style={styles.modalOverlay} onPress={onClose}>
                <Pressable style={styles.modalContent} onPress={(e) => e.stopPropagation()}>
                    <View style={styles.modalHeader}>
                        <Icon
                            name={editing ? 'pencil-outline' : 'plus-circle-outline'}
                            size={22}
                            color={colors.primary}
                        />
                        <Text style={styles.modalTitle}>
                            {editing ? 'Editar Producto' : 'Nuevo Producto'}
                        </Text>
                    </View>

                    <Input
                        label="Nombre Producto *"
                        value={name}
                        onChangeText={onNameChange}
                        placeholder="Ej: Pizza Hawaiana"
                    />
                    <Input
                        label="Categoría *"
                        value={category}
                        onChangeText={onCategoryChange}
                        placeholder="Ej: Pizzas, Bebidas"
                    />
                    <Input
                        label="Descripción"
                        value={description}
                        onChangeText={onDescriptionChange}
                        placeholder="Descripción corta"
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

                    {editing && onDelete && (
                        <Button
                            title="Eliminar Producto"
                            variant="danger"
                            icon="trash-can-outline"
                            fullWidth
                            onPress={onDelete}
                            style={localStyles.marginTopMd}
                        />
                    )}
                </Pressable>
            </Pressable>
        </Modal>
    );
}

const localStyles = StyleSheet.create({
    flexOne: {
        flex: 1,
    },
    marginTopMd: {
        marginTop: spacing.md,
    },
});


