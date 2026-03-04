import { StyleSheet } from 'react-native';
import { colors } from '../shared/theme';
import { fontSize, fontWeight, spacing, radius, shadows } from '../shared/tokens';

export const ordenesPendingStyles = StyleSheet.create({
  actionsBar: {
    flexDirection: 'row',
    gap: spacing.md,
    marginBottom: spacing.xl,
    flexWrap: 'wrap',
  },
  filterRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.lg,
    gap: spacing.sm,
  },
  filterRowMobile: {
    flexDirection: 'column',
    alignItems: 'stretch',
  },
  filterRowInner: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    flex: 1,
  },
  filterRowInnerMobile: {
    flex: 0,
    width: '100%',
  },
  filterTab: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.full,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  filterTabActive: {
    backgroundColor: colors.primaryLight,
    borderColor: colors.primary,
  },
  filterTabSpacing: {
    marginRight: spacing.sm,
    marginBottom: spacing.sm,
  },
  filterTabMobile: {
    marginRight: spacing.xs,
  },
  filterText: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.medium,
    color: colors.textMuted,
  },
  filterTextActive: {
    color: colors.primary,
    fontWeight: fontWeight.bold,
  },
  gridItem: {
    flex: 1,
    marginBottom: spacing.lg,
    paddingHorizontal: spacing.sm,
    maxWidth: '33.33%',
  },
  gridItemTablet: {
    maxWidth: '50%',
  },
  gridItemMobile: {
    paddingHorizontal: 0,
    maxWidth: '100%',
  },
  orderCard: {
    minHeight: 220,
    borderRadius: radius.xl,
    borderColor: 'rgba(51, 65, 85, 0.9)',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.md,
    gap: spacing.sm,
  },
  cardHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  clientName: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold,
    color: colors.text,
    flex: 1,
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  metaText: {
    fontSize: fontSize.xs,
    color: colors.textMuted,
    textTransform: 'capitalize',
  },
  addressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginBottom: spacing.sm,
    padding: spacing.sm,
    backgroundColor: colors.bgLight,
    borderRadius: radius.sm,
  },
  addressText: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    flex: 1,
  },
  observationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginBottom: spacing.sm,
    padding: spacing.sm,
    backgroundColor: colors.warningLight,
    borderRadius: radius.sm,
    borderLeftWidth: 3,
    borderLeftColor: colors.warning,
  },
  observationText: {
    fontSize: fontSize.sm,
    color: colors.warning,
    fontStyle: 'italic',
    flex: 1,
  },
  productList: {
    marginTop: spacing.sm,
    padding: spacing.md,
    backgroundColor: colors.bgLight,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  productRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 3,
  },
  productDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: colors.primary,
    marginRight: spacing.sm,
  },
  productText: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    flex: 1,
  },
  productQty: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.bold,
    color: colors.text,
    marginLeft: spacing.sm,
  },
  socketIndicator: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginLeft: spacing.sm,
  },
  socketIndicatorMobile: {
    marginLeft: 0,
  },
  completeButtonCircle: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.sm,
  },
  cardActions: {
    marginTop: spacing.md,
    alignItems: 'flex-end',
  },
  columnWrapper: {
    alignItems: 'stretch',
  },
  flex1: {
    flex: 1,
  },
  iconMarginSm: {
    marginRight: 6,
  },
  iconMarginMd: {
    marginRight: spacing.sm,
  },
  refreshButtonMobile: {
    alignSelf: 'flex-end',
  },
  listContent: {
    paddingBottom: spacing['4xl'],
    paddingHorizontal: spacing.xs,
  },
});
