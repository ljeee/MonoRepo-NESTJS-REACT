import React, { useState, useEffect } from 'react';
import { Modal, Pressable, StyleSheet, Text, View, TextInput } from 'react-native';
import { colors } from '../../styles/theme';
import { fontSize, fontWeight, radius, shadows, spacing } from '../../styles/tokens';
import Button from '../ui/Button';
import Icon from '../ui/Icon';

interface UpdateTotalModalProps {
    visible: boolean;
    currentTotal: number;
    loading?: boolean;
    onConfirm: (newTotal: number) => void;
    onCancel: () => void;
}

export default function UpdateTotalModal({
    visible,
    currentTotal,
    loading = false,
    onConfirm,
    onCancel,
}: UpdateTotalModalProps) {
    const [value, setValue] = useState('');

    useEffect(() => {
        if (visible) {
            setValue(currentTotal.toString());
        }
    }, [visible, currentTotal]);

    const handleConfirm = () => {
        const num = parseFloat(value);
        if (!isNaN(num) && num >= 0) {
            onConfirm(num);
        }
    };

    return (
        <Modal visible={visible} transparent animationType="fade" statusBarTranslucent>
            <Pressable style={styles.overlay} onPress={onCancel}>
                <Pressable style={styles.content} onPress={(e) => e.stopPropagation()}>
                    <View style={styles.header}>
                        <Icon name="pencil-outline" size={24} color={colors.primary} />
                        <Text style={styles.title}>Editar Total</Text>
                    </View>

                    <Text style={styles.label}>Nuevo Valor</Text>
                    <TextInput
                        style={styles.input}
                        value={value}
                        onChangeText={setValue}
                        keyboardType="numeric"
                        placeholder="0"
                        placeholderTextColor={colors.textMuted}
                        autoFocus
                        selectTextOnFocus
                    />

                    <View style={styles.actions}>
                        <View style={{ flex: 1 }}>
                            <Button
                                title="Cancelar"
                                onPress={onCancel}
                                variant="ghost"
                                size="md"
                                fullWidth
                                disabled={loading}
                            />
                        </View>
                        <View style={{ flex: 1 }}>
                            <Button
                                title="Guardar"
                                onPress={handleConfirm}
                                variant="primary"
                                size="md"
                                fullWidth
                                loading={loading}
                            />
                        </View>
                    </View>
                </Pressable>
            </Pressable>
        </Modal>
    );
}

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.6)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: spacing.md,
    },
    content: {
        backgroundColor: colors.card,
        borderRadius: radius.xl,
        padding: spacing.xl,
        width: '100%',
        maxWidth: 360,
        borderWidth: 1,
        borderColor: colors.border,
        ...shadows.lg,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: spacing.lg,
        gap: spacing.sm,
        justifyContent: 'center'
    },
    title: {
        fontSize: fontSize.xl,
        fontWeight: fontWeight.bold,
        color: colors.text,
    },
    label: {
        fontSize: fontSize.sm,
        color: colors.textSecondary,
        marginBottom: spacing.xs,
        fontWeight: fontWeight.medium,
    },
    input: {
        backgroundColor: colors.bg,
        borderRadius: radius.md,
        padding: spacing.md,
        color: colors.text,
        fontSize: fontSize.lg,
        borderWidth: 1,
        borderColor: colors.border,
        marginBottom: spacing.xl,
        textAlign: 'center',
        fontWeight: fontWeight.bold,
    },
    actions: {
        flexDirection: 'row',
        gap: spacing.md,
        width: '100%',
    },
});
