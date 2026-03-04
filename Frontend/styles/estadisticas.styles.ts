import { StyleSheet } from 'react-native';
import { colors } from './shared/theme';
import { fontSize, fontWeight, spacing, radius, shadows } from './shared/tokens';

export const estadisticasStyles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.bg },
  pageContent: { padding: spacing.lg },
  header: { marginBottom: spacing.lg, paddingTop: spacing.md },
  pageTitle: { fontSize: fontSize['2xl'], fontWeight: fontWeight.bold, color: colors.text },
  pageSubtitle: { fontSize: fontSize.sm, color: colors.textMuted, marginTop: 2 },

  // Date pickers
  dateRow: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing.md, marginBottom: spacing.lg },
  dateRowMobile: { flexWrap: 'wrap' },
  dateField: { gap: 4 },
  dateLabel: { fontSize: fontSize.xs, fontWeight: fontWeight.bold, color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.5 },
  dateInput: { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, color: colors.text, fontSize: fontSize.sm },
  refreshBtn: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: colors.primary, borderRadius: radius.md, paddingHorizontal: spacing.lg, paddingVertical: spacing.md, ...shadows.sm },
  refreshBtnText: { color: colors.white, fontWeight: fontWeight.bold, fontSize: fontSize.sm },

  loadingBox: { alignItems: 'center', padding: spacing['2xl'] },
  loadingText: { color: colors.textMuted, marginTop: spacing.md },

  // KPI
  kpiGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md, marginBottom: spacing.lg },
  kpiGridMobile: { flexDirection: 'row', flexWrap: 'wrap' },
  kpiCard: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, backgroundColor: colors.card, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, padding: spacing.lg, flex: 1, minWidth: 140 },
  kpiIcon: { width: 44, height: 44, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  kpiContent: { flex: 1 },
  kpiLabel: { fontSize: fontSize.xs, fontWeight: fontWeight.bold, color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.5 },
  kpiValue: { fontSize: 20, fontWeight: fontWeight.extrabold, color: colors.text, marginTop: 2 },

  // Charts grid
  chartsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.lg },
  chartsGridMobile: { flexDirection: 'column' },

  // Card
  card: { backgroundColor: colors.card, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, padding: spacing.lg, flex: 1, minWidth: 300 },
  hourlyCard: { minHeight: 320 },
  cardWide: { minWidth: '100%' as any },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.lg, paddingBottom: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border },
  cardTitle: { fontSize: fontSize.md, fontWeight: fontWeight.bold, color: colors.text },

  // Horizontal bars
  barRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.sm },
  barLabelWrap: { flexDirection: 'row', alignItems: 'center', width: 130, gap: 4 },
  barRank: { fontWeight: fontWeight.extrabold, fontSize: fontSize.xs },
  barLabel: { fontSize: fontSize.xs, color: colors.text, flex: 1 },
  barTrack: { flex: 1, height: 20, backgroundColor: colors.bg, borderRadius: 6, overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: 6, minWidth: 4 },
  barValue: { width: 40, textAlign: 'right', fontSize: fontSize.xs, fontWeight: fontWeight.bold, color: colors.text },

  // Vertical bars (hours / days)
  vBarChart: { flexDirection: 'row', alignItems: 'flex-end', flex: 1, minHeight: 220, gap: 2, paddingTop: 0 },
  vBarCol: { flex: 1, alignItems: 'center', height: '100%' },
  vBarValue: { fontSize: 8, fontWeight: fontWeight.bold, color: colors.textMuted, marginBottom: 2 },
  vBarTrack: { flex: 1, width: '100%', maxWidth: 28, backgroundColor: colors.bg, borderTopLeftRadius: 4, borderTopRightRadius: 4, justifyContent: 'flex-end', overflow: 'hidden' },
  vBarFill: { width: '100%', backgroundColor: '#3b82f6', borderTopLeftRadius: 4, borderTopRightRadius: 4, minHeight: 0 },
  vBarFillGreen: { width: '100%', backgroundColor: '#22c55e', borderTopLeftRadius: 4, borderTopRightRadius: 4, minHeight: 0 },
  vBarLabel: { fontSize: 9, color: colors.textMuted, marginTop: 2 },

  // Métodos
  metodoRow: { marginBottom: spacing.md },
  metodoInfo: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  metodoName: { fontSize: fontSize.sm, fontWeight: fontWeight.bold, color: colors.text, textTransform: 'capitalize' },
  metodoCount: { fontSize: fontSize.xs, color: colors.textMuted },
  metodoBarTrack: { height: 8, backgroundColor: colors.bg, borderRadius: 4, overflow: 'hidden' },
  metodoBarFill: { height: '100%', backgroundColor: colors.primary, borderRadius: 4, minWidth: 2 },
  metodoStatsRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 },
  metodoTotal: { fontSize: fontSize.sm, fontWeight: fontWeight.bold, color: colors.text },
  metodoPct: { fontSize: fontSize.xs, fontWeight: fontWeight.bold, color: colors.primary },

  // Clientes
  clienteRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, backgroundColor: colors.bg, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.sm },
  rankBadge: { width: 28, height: 28, borderRadius: 14, backgroundColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  rank1: { backgroundColor: '#f59e0b' },
  rank2: { backgroundColor: '#6b7280' },
  rank3: { backgroundColor: '#b45309' },
  rankBadgeText: { color: colors.white, fontSize: fontSize.xs, fontWeight: fontWeight.extrabold },
  clienteInfo: { flex: 1 },
  clienteName: { fontSize: fontSize.sm, fontWeight: fontWeight.bold, color: colors.text },
  clienteDetail: { fontSize: fontSize.xs, color: colors.textMuted },

  emptyText: { color: colors.textMuted, fontSize: fontSize.sm, paddingVertical: spacing.lg, textAlign: 'center' },
});
