import { StyleSheet } from 'react-native';
import { colors } from '../theme';
import { fontSize, fontWeight, spacing, radius } from '../tokens';

export const productCardStyles = StyleSheet.create({
    productHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: spacing.lg,
    },
    productTitleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.md,
        flexWrap: 'wrap',
        marginBottom: spacing.xs,
    },
    productName: {
        fontSize: fontSize.xl,
        fontWeight: fontWeight.bold,
        color: colors.text,
    },
    productDesc: {
        fontSize: fontSize.sm,
        color: colors.textMuted,
        marginTop: spacing.xs,
    },
    variantsSection: {
        paddingTop: spacing.lg,
        borderTopWidth: 1,
        borderTopColor: colors.divider,
    },
    variantsHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
        marginBottom: spacing.md,
    },
    variantsTitle: {
        fontSize: fontSize.sm,
        fontWeight: fontWeight.bold,
        color: colors.textMuted,
        textTransform: 'uppercase',
        letterSpacing: 0.8,
    },
    variantRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: spacing.md,
        paddingHorizontal: spacing.md,
        backgroundColor: colors.bgLight,
        borderRadius: radius.md,
        marginBottom: spacing.sm,
        borderWidth: 1,
        borderColor: colors.border,
    },
    variantInfo: {
        flex: 1,
    },
    variantName: {
        fontSize: fontSize.md,
        fontWeight: fontWeight.semibold,
        color: colors.text,
    },
    variantDesc: {
        fontSize: fontSize.xs,
        color: colors.textSecondary,
        marginTop: 2,
    },
    variantPrice: {
        fontSize: fontSize.lg,
        fontWeight: fontWeight.extrabold,
        color: colors.primary,
        marginHorizontal: spacing.md,
    },
    variantActions: {
        flexDirection: 'row',
        gap: spacing.xs,
    },
    // Pizza Flavors
    flavorsSection: {
        paddingTop: spacing.lg,
        marginTop: spacing.lg,
        borderTopWidth: 1,
        borderTopColor: colors.divider,
    },
    flavorsHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
        marginBottom: spacing.md,
    },
    flavorsTitle: {
        fontSize: fontSize.sm,
        fontWeight: fontWeight.bold,
        color: colors.secondary,
        textTransform: 'uppercase',
        letterSpacing: 0.8,
    },
    flavorCategoryLabel: {
        fontSize: fontSize.xs,
        fontWeight: fontWeight.bold,
        color: colors.textMuted,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
        marginBottom: spacing.sm,
    },
    flavorsGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: spacing.sm,
        marginBottom: spacing.sm,
    },
    flavorChip: {
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.sm,
        backgroundColor: colors.primaryLight,
        borderRadius: radius.full,
        borderWidth: 1,
        borderColor: colors.primary,
    },
    flavorChipSpecial: {
        backgroundColor: colors.secondaryLight,
        borderColor: colors.secondary,
    },
    flavorChipText: {
        fontSize: fontSize.xs,
        fontWeight: fontWeight.medium,
        color: colors.primary,
    },
    flavorPricingInfo: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: spacing.xs,
        marginTop: spacing.md,
        padding: spacing.sm,
        backgroundColor: colors.bgLight,
        borderRadius: radius.sm,
        borderLeftWidth: 3,
        borderLeftColor: colors.secondary,
    },
    flavorPricingText: {
        flex: 1,
        fontSize: fontSize.xs,
        color: colors.textMuted,
        lineHeight: 16,
    },
});
