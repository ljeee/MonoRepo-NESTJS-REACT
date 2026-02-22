import { StyleSheet } from 'react-native';
import { colors } from '../theme';
import { fontSize, fontWeight, spacing, radius } from '../shared/tokens';

/**
 * Factory que devuelve estilos adaptativos según el dispositivo.
 * Úsalo siempre como: const s = makeBStyles(isMobile);
 */
export function makeBStyles(isMobile: boolean) {
  return StyleSheet.create({

    // ─── Balance Card ──────────────────────────────────────────────────────────

    balanceCard: {
      borderRadius: radius.lg,
      overflow: 'hidden',
      marginBottom: spacing.xl,
      borderWidth: 1,
      borderColor: 'rgba(255,140,0,0.25)',
    },
    balanceCardGradient: {
      paddingVertical: isMobile ? spacing.lg : spacing.xl,
      paddingHorizontal: isMobile ? spacing.lg : spacing.xl,
      gap: isMobile ? spacing.sm : spacing.md,
      backgroundColor: 'rgba(255,140,0,0.08)',
    },
    balanceTitle: {
      fontSize: fontSize.xs,
      fontWeight: fontWeight.extrabold,
      color: colors.primary,
      textTransform: 'uppercase',
      letterSpacing: 1.2,
      marginBottom: spacing.xs,
    },

    // En móvil, apila etiqueta arriba y valor abajo dentro de cada fila
    balanceRow: {
      flexDirection: isMobile ? 'column' : 'row',
      alignItems: isMobile ? 'flex-start' : 'center',
      justifyContent: 'space-between',
      paddingVertical: spacing.sm,
      gap: isMobile ? spacing.xs : 0,
    },
    balanceDivider: {
      height: 1,
      backgroundColor: 'rgba(255,140,0,0.2)',
      marginVertical: spacing.sm,
    },
    balanceLabelRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      flex: isMobile ? 0 : undefined,
    },
    balanceLabel: {
      fontSize: isMobile ? fontSize.xs : fontSize.sm,
      fontWeight: fontWeight.medium,
      color: colors.textSecondary,
    },
    balanceValue: {
      fontSize: isMobile ? fontSize.md : fontSize.lg,
      fontWeight: fontWeight.bold,
      color: colors.text,
      // En móvil el valor aparece debajo, alineado a la izquierda con indent
      marginLeft: isMobile ? 26 : 0,
    },
    balanceValuePositive: { color: colors.success },
    balanceValueNegative: { color: colors.danger },
    balanceValueNeutral:  { color: colors.warning },

    // Fila de neto (más prominente)
    balanceNetRow: {
      flexDirection: isMobile ? 'column' : 'row',
      alignItems: isMobile ? 'flex-start' : 'center',
      justifyContent: 'space-between',
      paddingTop: spacing.md,
      gap: isMobile ? spacing.xs : 0,
    },
    balanceNetLabel: {
      fontSize: fontSize.md,
      fontWeight: fontWeight.extrabold,
      color: colors.text,
    },
    balanceNetValue: {
      fontSize: isMobile ? fontSize.xl : fontSize['2xl'],
      fontWeight: fontWeight.extrabold,
      marginLeft: isMobile ? 28 : 0,
    },

    // ─── Section headers ───────────────────────────────────────────────────────

    sectionHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      marginBottom: spacing.lg,
      marginTop: spacing.xl,
      paddingBottom: spacing.sm,
      borderBottomWidth: 1,
      borderBottomColor: 'rgba(255,255,255,0.08)',
    },
    sectionTitle: {
      fontSize: isMobile ? fontSize.sm : fontSize.md,
      fontWeight: fontWeight.extrabold,
      color: colors.text,
      flex: 1,
    },
    sectionCount: {
      fontSize: fontSize.xs,
      fontWeight: fontWeight.semibold,
      color: colors.textMuted,
      backgroundColor: colors.bgLight,
      paddingHorizontal: spacing.sm,
      paddingVertical: 2,
      borderRadius: radius.full,
    },

    // ─── Gasto row (compact) ───────────────────────────────────────────────────

    gastoCard: {
      backgroundColor: colors.bgLight,
      borderRadius: radius.md,
      paddingVertical: isMobile ? spacing.sm : spacing.md,
      paddingHorizontal: isMobile ? spacing.md : spacing.lg,
      marginBottom: spacing.sm,
      flexDirection: 'row',
      alignItems: 'center',
      gap: isMobile ? spacing.sm : spacing.md,
      borderWidth: 1,
      borderColor: colors.border,
      // Área táctil mínima de 48px recomendada por Android
      minHeight: 48,
    },
    gastoIcon: {
      width: isMobile ? 32 : 36,
      height: isMobile ? 32 : 36,
      borderRadius: radius.full,
      backgroundColor: 'rgba(255,140,0,0.12)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    gastoInfo: { flex: 1 },
    gastoName: {
      fontSize: isMobile ? fontSize.xs : fontSize.sm,
      fontWeight: fontWeight.bold,
      color: colors.text,
      marginBottom: 2,
    },
    gastoMeta: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
    },
    gastoMetaText: {
      fontSize: fontSize.xs,
      color: colors.textMuted,
    },
    gastoTotal: {
      fontSize: isMobile ? fontSize.sm : fontSize.md,
      fontWeight: fontWeight.extrabold,
      color: colors.danger,
    },
    gastoActions: {
      flexDirection: 'row',
      gap: spacing.xs,
      alignItems: 'center',
    },

    // ─── Actions bar ───────────────────────────────────────────────────────────

    actionsBar: {
      flexDirection: 'row',
      gap: spacing.md,
      marginBottom: spacing.lg,
      flexWrap: 'wrap',
      // En móvil los botones se estiran para cubrir el ancho
      justifyContent: isMobile ? 'flex-start' : 'flex-start',
    },

    // ─── Date filter row (balance-fechas) ──────────────────────────────────────

    filterRow: {
      flexDirection: isMobile ? 'column' : 'row',
      gap: isMobile ? spacing.sm : spacing.md,
      marginBottom: spacing.lg,
      ...(isMobile ? {} : { flexWrap: 'wrap' as const, alignItems: 'flex-end' as const }),
    },
    filterSearchBtn: {
      // En móvil el botón Buscar va aparte, full-width
      alignSelf: isMobile ? 'stretch' : 'flex-end',
      marginBottom: isMobile ? 0 : spacing.lg,
    },

    // ─── Empty state ───────────────────────────────────────────────────────────

    emptySection: {
      alignItems: 'center',
      paddingVertical: isMobile ? spacing['2xl'] : spacing['3xl'],
      gap: spacing.sm,
    },
    emptySectionText: {
      fontSize: fontSize.sm,
      color: colors.textMuted,
      textAlign: 'center',
    },
  });
}

// Alias estático para pantallas que no necesitan adaptar (solo desktop)
export const bStyles = makeBStyles(false);
