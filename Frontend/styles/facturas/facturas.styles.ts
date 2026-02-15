import { StyleSheet } from 'react-native';
import { colors } from '../theme';

// ─── Page-level styles ────────────────────────────────────────────────────────

export const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  pageHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  pageTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.text,
  },
  refreshBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: colors.primary,
    borderRadius: 6,
  },
  refreshBtnText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 12,
  },
  filterSection: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  filterRow: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'flex-end',
  },
  filterInputGroup: {
    flex: 1,
    minWidth: 130,
  },
  filterLabel: {
    fontSize: 11,
    color: colors.textMuted,
    fontWeight: '600',
    marginBottom: 4,
    textTransform: 'uppercase',
  },
  filterInput: {
    backgroundColor: colors.card,
    color: colors.text,
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    fontSize: 13,
  },
  filterBtn: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
  },
  filterBtnDisabled: {
    backgroundColor: colors.card,
  },
  filterBtnEnabled: {
    backgroundColor: colors.primary,
  },
  filterBtnText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 13,
  },
  csvBtn: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: colors.info,
  },
  csvBtnDisabled: {
    backgroundColor: colors.card,
  },
  errorBox: {
    margin: 16,
    padding: 12,
    backgroundColor: colors.dangerLight,
    borderRadius: 8,
    borderLeftColor: colors.danger,
    borderLeftWidth: 4,
  },
  errorBoxText: {
    color: colors.danger,
    fontWeight: '600',
  },
  loadingContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: colors.textMuted,
    marginTop: 8,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 16,
    gap: 10,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  emptyTitle: {
    fontSize: 14,
    color: colors.textMuted,
    fontWeight: '600',
  },
  emptySubtitle: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 4,
  },
});

// ─── Shared factura component styles ──────────────────────────────────────────

export const fStyles = StyleSheet.create({
  // ── Stats ──
  statsContainer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 10,
  },
  statCardMain: {
    backgroundColor: colors.primaryLight,
    borderRadius: 10,
    padding: 14,
    borderLeftWidth: 4,
    borderLeftColor: colors.primary,
  },
  statLabel: {
    fontSize: 12,
    color: colors.textMuted,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  statValueMain: {
    fontSize: 28,
    fontWeight: '700',
    color: colors.primary,
    marginTop: 4,
  },
  statSubtext: {
    fontSize: 11,
    color: colors.textMuted,
    marginTop: 2,
  },
  statRow: {
    flexDirection: 'row',
    gap: 10,
  },
  statCardPagado: {
    flex: 1,
    backgroundColor: colors.successLight,
    borderRadius: 10,
    padding: 12,
    borderLeftWidth: 4,
    borderLeftColor: colors.success,
  },
  statValuePagado: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.success,
    marginTop: 4,
  },
  statCardPendiente: {
    flex: 1,
    backgroundColor: colors.warningLight,
    borderRadius: 10,
    padding: 12,
    borderLeftWidth: 4,
    borderLeftColor: colors.warning,
  },
  statValuePendiente: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.warning,
    marginTop: 4,
  },

  // ── Card ──
  card: {
    backgroundColor: colors.bgLight,
    borderRadius: 10,
    padding: 14,
    borderLeftWidth: 4,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  cardClientName: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 2,
  },
  cardDate: {
    fontSize: 11,
    color: colors.textMuted,
  },
  cardTotal: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
  },
  cardMetodo: {
    fontSize: 10,
    color: colors.textMuted,
    marginTop: 2,
  },
  notesBox: {
    backgroundColor: colors.card,
    borderRadius: 8,
    padding: 10,
    marginBottom: 10,
  },
  notesLabel: {
    fontSize: 10,
    color: colors.textMuted,
    fontWeight: '600',
    marginBottom: 4,
    textTransform: 'uppercase',
  },
  notesText: {
    fontSize: 11,
    color: colors.text,
    fontStyle: 'italic',
    lineHeight: 16,
  },

  // ── Products ──
  productsSection: {
    marginBottom: 10,
  },
  productsSectionLabel: {
    fontSize: 10,
    color: colors.textMuted,
    fontWeight: '600',
    marginBottom: 6,
    textTransform: 'uppercase',
  },
  productRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 8,
    backgroundColor: colors.card,
    borderRadius: 6,
    marginBottom: 4,
  },
  productName: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.text,
  },
  productQtyPrice: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.text,
  },
  productSubtotal: {
    fontSize: 10,
    color: colors.textMuted,
    marginTop: 2,
  },

  // ── Estado ──
  estadoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  estadoIndicatorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  estadoDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  estadoLabel: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  estadoBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  estadoBtnDisabled: {
    opacity: 0.6,
  },
  estadoBtnText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 12,
  },
});
