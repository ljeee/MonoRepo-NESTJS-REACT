import { StyleSheet } from 'react-native';
import { colors } from './shared/theme';
import { fontSize, fontWeight, spacing, radius } from './shared/tokens';

export const dashboardStyles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.lg },

  welcomeCard: { flexDirection: 'row', alignItems: 'center', padding: spacing.xl, borderRadius: radius.lg, backgroundColor: 'rgba(255, 140, 0, 0.08)', borderWidth: 1, borderColor: 'rgba(255, 140, 0, 0.2)', marginBottom: spacing.lg },
  welcomeCardMobile: { flexDirection: 'column', alignItems: 'flex-start', gap: spacing.md },
  greeting: { fontSize: fontSize.xl, fontWeight: fontWeight.extrabold, color: colors.text },
  dateText: { fontSize: fontSize.sm, color: colors.textMuted, marginTop: 2, textTransform: 'capitalize' },
  clock: { fontSize: 24, fontWeight: fontWeight.extrabold, color: colors.primary },

  quickRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.lg },
  quickBtn: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.lg, paddingVertical: spacing.md, borderRadius: radius.md, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border },
  quickBtnText: { fontSize: fontSize.sm, fontWeight: fontWeight.bold, color: colors.text },

  statusRow: { flexDirection: 'row', gap: spacing.md, marginBottom: spacing.lg },
  statusRowMobile: { flexDirection: 'row', flexWrap: 'wrap' },
  statusCard: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.lg, borderRadius: radius.lg, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, minWidth: 140 },
  statusDot: { width: 12, height: 12, borderRadius: 6 },
  dotRed: { backgroundColor: '#ef4444' },
  dotYellow: { backgroundColor: '#f59e0b' },
  dotGreen: { backgroundColor: '#22c55e' },
  statusInfo: {},
  statusCount: { fontSize: 22, fontWeight: fontWeight.extrabold, color: colors.text },
  statusLabel: { fontSize: fontSize.xs, color: colors.textMuted },

  kpiRow: { flexDirection: 'row', gap: spacing.md, marginBottom: spacing.lg },
  kpiRowMobile: { flexDirection: 'row', flexWrap: 'wrap' },
  kpiCard: { flex: 1, padding: spacing.lg, borderRadius: radius.lg, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, alignItems: 'center', minWidth: 140 },
  kpiLabel: { fontSize: fontSize.xs, fontWeight: fontWeight.bold, color: colors.textMuted, textTransform: 'uppercase', marginBottom: 4 },
  kpiValue: { fontSize: 20, fontWeight: fontWeight.extrabold },

  gridRow: { flexDirection: 'row', gap: spacing.lg, flexWrap: 'wrap' },
  gridRowMobile: { flexDirection: 'column' },
  card: { flex: 1, backgroundColor: colors.card, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, padding: spacing.lg, minWidth: 280 },
  cardTitle: { fontSize: fontSize.md, fontWeight: fontWeight.bold, color: colors.text, marginBottom: spacing.md, paddingBottom: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.border },

  hourChart: { flexDirection: 'row', alignItems: 'flex-end', height: 100, gap: 2 },
  hourCol: { flex: 1, alignItems: 'center', height: '100%' },
  hourTrack: { flex: 1, width: '100%', maxWidth: 20, backgroundColor: colors.bg, borderTopLeftRadius: 3, borderTopRightRadius: 3, justifyContent: 'flex-end', overflow: 'hidden' },
  hourFill: { width: '100%', backgroundColor: colors.primary, borderTopLeftRadius: 3, borderTopRightRadius: 3, minHeight: 2 },
  hourLabel: { fontSize: 8, color: colors.textMuted, marginTop: 2 },

  orderRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.border },
  orderId: { fontSize: fontSize.xs, fontWeight: fontWeight.extrabold, color: colors.primary, minWidth: 40 },
  orderName: { fontSize: fontSize.sm, fontWeight: fontWeight.bold, color: colors.text },
  orderTime: { fontSize: fontSize.xs, color: colors.textMuted },
  orderBadge: { fontSize: 10, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10, fontWeight: fontWeight.bold, overflow: 'hidden', textTransform: 'capitalize', backgroundColor: colors.border, color: colors.textMuted },
  badgePending: { backgroundColor: 'rgba(245,158,11,0.15)', color: '#f59e0b' },
  badgeComplete: { backgroundColor: 'rgba(34,197,94,0.15)', color: '#22c55e' },

  emptyText: { textAlign: 'center', color: colors.textMuted, paddingVertical: spacing.xl },
});
