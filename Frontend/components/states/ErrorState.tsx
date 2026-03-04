import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { colors } from '../../styles/theme';
import { radius, spacing, shadows } from '../../styles/tokens';
import Icon from '../ui/Icon';

interface ErrorStateProps {
    message?: string;
    onRetry?: () => void;
    title?: string;
}

export const ErrorState: React.FC<ErrorStateProps> = ({
    message = 'Ha ocurrido un error inesperado.',
    onRetry,
    title = '¡Ups! Algo salió mal'
}) => {
    return (
        <View style={styles.container}>
            <View style={styles.iconContainer}>
                <Icon name="alert-circle-outline" size={48} color={colors.danger} />
            </View>
            <Text style={styles.title}>{title}</Text>
            <Text style={styles.text}>{message}</Text>

            {onRetry && (
                <TouchableOpacity style={styles.button} onPress={onRetry}>
                    <Text style={styles.buttonText}>Intentar de nuevo</Text>
                </TouchableOpacity>
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: spacing['2xl'],
        minHeight: 300,
    },
    iconContainer: {
        marginBottom: spacing.lg,
        padding: spacing.lg,
        backgroundColor: colors.dangerLight,
        borderRadius: radius.full,
    },
    title: {
        fontSize: 18,
        fontWeight: 'bold',
        color: colors.text,
        marginBottom: 8,
        textAlign: 'center',
    },
    text: {
        color: colors.textSecondary,
        fontSize: 16,
        textAlign: 'center',
        marginBottom: 24,
        lineHeight: 24,
    },
    button: {
        backgroundColor: colors.primary,
        paddingVertical: spacing.md,
        paddingHorizontal: spacing['2xl'],
        borderRadius: radius.md,
        ...shadows.sm,
    },
    buttonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '600',
    },
});
