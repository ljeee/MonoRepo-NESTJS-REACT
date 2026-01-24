import { MaterialCommunityIcons } from '@expo/vector-icons';
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { colors } from '../../styles/theme';

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
                <MaterialCommunityIcons name="alert-circle-outline" size={48} color={colors.danger} />
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
        padding: 24,
        minHeight: 300,
    },
    iconContainer: {
        marginBottom: 16,
        padding: 16,
        backgroundColor: colors.dangerLight,
        borderRadius: 50,
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
        paddingVertical: 12,
        paddingHorizontal: 24,
        borderRadius: 8,
        elevation: 2,
    },
    buttonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '600',
    },
});
