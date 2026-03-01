import { StyleSheet } from 'react-native';
import { colors } from '../theme';
import { fontSize, fontWeight, spacing, radius } from '../tokens';

export const ordenDetalleStyles = StyleSheet.create({
  errorBox: {
    alignItems: 'center',
    padding: spacing['5xl'],
    gap: spacing.lg,
  },
  errorText: {
    fontSize: fontSize.lg,
    color: colors.danger,
    textAlign: 'center',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.xl,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  sectionTitle: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold,
    color: colors.text,
  },
  infoGrid: {
    gap: spacing.md,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.xs,
  },
  infoLabel: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
    color: colors.textMuted,
    minWidth: 120,
  },
  infoValue: {
    fontSize: fontSize.md,
    color: colors.text,
    fontWeight: fontWeight.medium,
    flex: 1,
  },
  // Products
  productCard: {
    backgroundColor: colors.bgLight,
    borderRadius: radius.md,
    padding: spacing.lg,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  productHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  productNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    flex: 1,
  },
  productIndex: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  productIndexText: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.bold,
    color: colors.primary,
  },
  productName: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.bold,
    color: colors.text,
    flex: 1,
  },
  qtyBadge: {
    backgroundColor: colors.primaryLight,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.full,
  },
  qtyText: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.bold,
    color: colors.primary,
  },
  flavorsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: spacing.sm,
    padding: spacing.sm,
    backgroundColor: colors.secondaryLight,
    borderRadius: radius.sm,
  },
  flavorsText: {
    fontSize: fontSize.sm,
    color: colors.secondary,
    fontWeight: fontWeight.medium,
  },
  priceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.divider,
  },
  priceLabel: {
    fontSize: fontSize.sm,
    color: colors.textMuted,
  },
  priceTotal: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.extrabold,
    color: colors.primary,
  },
  emptyProducts: {
    alignItems: 'center',
    padding: spacing['3xl'],
    gap: spacing.md,
  },
  emptyProductsText: {
    fontSize: fontSize.md,
    color: colors.textMuted,
  },
  // Total
  totalCard: {
    borderLeftWidth: 4,
    borderLeftColor: colors.primary,
    marginBottom: spacing['3xl'],
  },
  subtotalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  subtotalLabel: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.medium,
    color: colors.textMuted,
  },
  subtotalValue: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.semibold,
    color: colors.text,
  },
  divider: {
    height: 1,
    backgroundColor: colors.divider,
    marginVertical: spacing.md,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  totalLabel: {
    fontSize: fontSize.xl,
    fontWeight: fontWeight.bold,
    color: colors.text,
  },
  totalValue: {
    fontSize: fontSize['3xl'],
    fontWeight: fontWeight.black,
    color: colors.primary,
  },
  headerActions: {
    flexDirection: 'row',
    gap: spacing.sm,
    flexWrap: 'wrap',
  },
  cancelButton: {
    paddingHorizontal: 8,
    height: 32,
  },
  iconButton: {
    paddingHorizontal: spacing.sm,
    minWidth: 0,
  },
  cardMarginLg: {
    marginBottom: spacing.lg,
  },
});
