import { StyleSheet } from 'react-native';
import { colors } from '../theme';
import { fontSize, fontWeight, spacing, radius, shadows } from '../tokens';

export const modalStyles = StyleSheet.create({
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.6)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: spacing['2xl'],
    },
    modalContent: {
        backgroundColor: colors.card,
        borderRadius: radius.xl,
        padding: spacing['3xl'],
        width: '100%',
        maxWidth: 480,
        borderWidth: 1,
        borderColor: colors.border,
        ...shadows.lg,
    },
    modalHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
        marginBottom: spacing.xl,
    },
    modalTitle: {
        fontSize: fontSize.xl,
        fontWeight: fontWeight.bold,
        color: colors.text,
    },
    modalActions: {
        flexDirection: 'row',
        gap: spacing.md,
        marginTop: spacing.md,
    },
    inlineError: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.xs,
        marginBottom: spacing.md,
        padding: spacing.sm,
        backgroundColor: colors.dangerLight,
        borderRadius: radius.sm,
    },
    inlineErrorText: {
        color: colors.danger,
        fontSize: fontSize.sm,
        fontWeight: fontWeight.medium,
    },
});
