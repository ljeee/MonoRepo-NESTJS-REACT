import React from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { colors } from '../../styles/theme';
import { fontSize, fontWeight, radius, shadows, spacing } from '../../styles/tokens';
import Button from './Button';
import Icon, { IconName } from './Icon';

interface ConfirmModalProps {
    visible: boolean;
    title: string;
    message: string;
    icon?: IconName;
    confirmText?: string;
    cancelText?: string;
    variant?: 'danger' | 'warning' | 'info';
    loading?: boolean;
    onConfirm: () => void;
    onCancel: () => void;
}

/**
 * Styled confirmation modal to replace native alert() and confirm() calls.
 * Maintains dark theme consistency.
 */
export default function ConfirmModal({
    visible,
    title,
    message,
    icon,
    confirmText = 'Confirmar',
    cancelText = 'Cancelar',
    variant = 'danger',
    loading = false,
    onConfirm,
    onCancel,
}: ConfirmModalProps) {
    const variantColor =
        variant === 'danger' ? colors.danger :
            variant === 'warning' ? colors.warning :
                colors.info;

    return (
        <Modal visible={visible} transparent animationType="fade" statusBarTranslucent>
            <Pressable style={styles.overlay} onPress={onCancel}>
                <Pressable style={styles.content} onPress={(e) => e.stopPropagation()}>
                    {/* Icon */}
                    {icon && (
                        <View style={[styles.iconCircle, { backgroundColor: variantColor + '20' }]}>
                            <Icon name={icon} size={32} color={variantColor} />
                        </View>
                    )}

                    {/* Text */}
                    <Text style={styles.title}>{title}</Text>
                    <Text style={styles.message}>{message}</Text>

                    {/* Actions */}
                    <View style={styles.actions}>
                        <View style={{ flex: 1 }}>
                            <Button
                                title={cancelText}
                                onPress={onCancel}
                                variant="ghost"
                                size="md"
                                fullWidth
                                disabled={loading}
                            />
                        </View>
                        <View style={{ flex: 1 }}>
                            <Button
                                title={confirmText}
                                onPress={onConfirm}
                                variant={variant === 'danger' ? 'danger' : 'primary'}
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
        maxWidth: 420,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: colors.border,
        ...shadows.lg,
    },
    iconCircle: {
        width: 64,
        height: 64,
        borderRadius: 32,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: spacing.lg,
    },
    title: {
        fontSize: fontSize.xl,
        fontWeight: fontWeight.bold,
        color: colors.text,
        textAlign: 'center',
        marginBottom: spacing.sm,
    },
    message: {
        fontSize: fontSize.md,
        color: colors.textSecondary,
        textAlign: 'center',
        lineHeight: 22,
        marginBottom: spacing.lg,
    },
    actions: {
        flexDirection: 'row',
        gap: spacing.md,
        width: '100%',
        marginTop: spacing.lg,
    },
});
