import { MaterialCommunityIcons } from '@expo/vector-icons';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors } from '../../styles/theme';

interface EmptyStateProps {
    message?: string;
    subMessage?: string;
    icon?: keyof typeof MaterialCommunityIcons.glyphMap;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
    message = 'No se encontraron datos',
    subMessage = 'No hay información para mostrar en este momento.',
    icon = 'package-variant-closed'
}) => {
    return (
        <View style={styles.container}>
            <View style={styles.iconContainer}>
                <MaterialCommunityIcons name={icon} size={64} color={colors.textMuted} />
            </View>
            <Text style={styles.title}>{message}</Text>
            <Text style={styles.text}>{subMessage}</Text>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 32,
        minHeight: 300,
    },
    iconContainer: {
        marginBottom: 16,
        opacity: 0.8,
    },
    title: {
        fontSize: 20,
        fontWeight: 'bold',
        color: colors.text,
        marginBottom: 8,
        textAlign: 'center',
    },
    text: {
        color: colors.textSecondary,
        fontSize: 16,
        textAlign: 'center',
        lineHeight: 22,
        maxWidth: 300,
    },
});
