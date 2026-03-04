import { StyleSheet } from 'react-native';
import { colors } from '../shared/theme';
import { fontSize, fontWeight, spacing, radius } from '../shared/tokens';

export const clientesStyles = StyleSheet.create({
  // ── Form ──
  formHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.xl,
  },
  formTitle: {
    fontSize: fontSize.xl,
    fontWeight: fontWeight.bold,
    color: colors.text,
  },
  formGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  formActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: spacing.md,
    marginTop: spacing.md,
  },

  // ── Errors ──
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

  // ── Search ──
  searchRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.md,
    marginBottom: spacing.xl,
    flexWrap: 'wrap',
  },
  searchActions: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },

  // ── Search Result ──
  resultTitle: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.bold,
    color: colors.primary,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: spacing.md,
  },
  resultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.xs,
  },
  resultText: {
    fontSize: fontSize.md,
    color: colors.textSecondary,
  },

  // ── Empty State ──
  emptyBox: {
    alignItems: 'center',
    padding: spacing['5xl'],
    gap: spacing.md,
  },
  emptyText: {
    fontSize: fontSize.lg,
    color: colors.textMuted,
  },

  // ── Client Card ──
  clientHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  clientInfo: {
    flex: 1,
    minWidth: 150,
  },
  clientName: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold,
    color: colors.text,
    marginBottom: spacing.xs,
  },
  clientPhoneRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  clientPhone: {
    fontSize: fontSize.sm,
    color: colors.primary,
    fontWeight: fontWeight.semibold,
  },
  clientActions: {
    flexDirection: 'row',
    gap: spacing.xs,
  },

  // ── Stats Row ──
  statsRow: {
    flexDirection: 'row',
    backgroundColor: colors.bgLight,
    borderRadius: radius.md,
    padding: spacing.sm,
    marginTop: spacing.sm,
    marginBottom: spacing.sm,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statValuePrimary: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.extrabold,
    color: colors.primary,
  },
  statValueSuccess: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.extrabold,
    color: '#22c55e',
  },
  statValueInfo: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.extrabold,
    color: '#3b82f6',
  },
  statLabel: {
    fontSize: 10,
    fontWeight: fontWeight.semibold,
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: 2,
  },

  // ── Last Visit Badge ──
  lastVisitBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: spacing.xs,
    paddingVertical: 3,
    paddingHorizontal: spacing.sm,
    backgroundColor: 'rgba(59, 130, 246, 0.08)',
    borderRadius: 20,
    alignSelf: 'flex-start',
  },
  lastVisitText: {
    fontSize: fontSize.xs,
    color: '#3b82f6',
    fontWeight: fontWeight.semibold,
  },

  // ── Addresses ──
  addressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: spacing.xs,
  },
  addressText: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
  },

  // ── Utils ──
  cardMarginXl: {
    marginBottom: spacing.xl,
  },
  inputContainer: {
    flex: 1,
    minWidth: 200,
  },
  searchInputContainer: {
    flex: 1,
    minWidth: 200,
    marginBottom: 0,
  },
  searchResultCard: {
    marginBottom: spacing.xl,
    borderLeftWidth: 3,
    borderLeftColor: colors.primary,
  },
  cardMarginMd: {
    marginBottom: spacing.md,
  },
  opacityMuted: {
    opacity: 0.7,
  },
  headerCount: {
    fontSize: fontSize.sm,
    color: colors.textMuted,
    fontWeight: fontWeight.medium,
  },
});
