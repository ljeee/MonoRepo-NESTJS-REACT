import { StyleSheet } from 'react-native';
import { colors } from '../theme';
import { fontSize, fontWeight, spacing, radius } from '../tokens';

export const gestionProductosStyles = StyleSheet.create({
    errorBox: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
        backgroundColor: colors.dangerLight,
        padding: spacing.lg,
        borderRadius: radius.md,
        marginBottom: spacing.lg,
    },
    errorText: {
        color: colors.danger,
        fontSize: fontSize.md,
        fontWeight: fontWeight.medium,
    },
    emptyBox: {
        alignItems: 'center',
        padding: spacing['5xl'],
        gap: spacing.md,
    },
    emptyText: {
        fontSize: fontSize.lg,
        color: colors.textMuted,
    },
});
