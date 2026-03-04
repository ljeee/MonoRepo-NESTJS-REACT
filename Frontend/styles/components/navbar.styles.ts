import { StyleSheet } from 'react-native';
import { colors } from '../shared/theme';
import { fontSize, fontWeight, spacing, radius, shadows, zIndex, layout } from '../shared/tokens';

export const navbarStyles = StyleSheet.create({
  // ── Mobile menu button ──
  menuBtnContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    zIndex: zIndex.drawer,
    padding: spacing.md,
  },
  menuBtn: {
    backgroundColor: colors.card,
    borderRadius: radius.md,
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  drawerOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    zIndex: zIndex.overlay,
  },

  // ── Mobile sidebar ──
  sidebarMobile: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    backgroundColor: colors.card,
    zIndex: zIndex.drawer,
    height: '100%',
    borderRightWidth: 1,
    borderRightColor: colors.border,
    ...shadows.lg,
  },
  sidebarHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xl,
    paddingBottom: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  sidebarBrand: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  sidebarHeaderText: {
    color: colors.text,
    fontSize: fontSize.xl,
    fontWeight: fontWeight.bold,
    letterSpacing: 0.5,
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: radius.sm,
    backgroundColor: colors.bgLight,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // ── Desktop sidebar ──
  sidebar: {
    width: layout.sidebarWidth,
    height: '100%',
    backgroundColor: colors.card,
    borderRightWidth: 1,
    borderRightColor: colors.border,
    ...shadows.sm,
  },
  sidebarDesktopHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  sidebarDesktopTitle: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold,
    color: colors.text,
    letterSpacing: 0.5,
  },
  sidebarFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.divider,
  },
  sidebarFooterText: {
    fontSize: fontSize.xs,
    color: colors.textMuted,
  },

  // ── Section accordion ──
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    marginTop: spacing.xs,
  },
  sectionHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  sectionHeaderActive: {
    backgroundColor: colors.primaryLight,
    borderRadius: radius.sm,
    marginHorizontal: spacing.sm,
    paddingHorizontal: spacing.lg,
  },
  sectionTitle: {
    color: colors.textMuted,
    fontSize: fontSize.xs,
    fontWeight: fontWeight.extrabold,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  sectionTitleActive: {
    color: colors.primary,
  },

  // ── Nav items ──
  navItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing['2xl'],
    marginHorizontal: spacing.sm,
    borderRadius: radius.sm,
  },
  navItemActive: {
    backgroundColor: colors.primaryLight,
  },
  activeIndicator: {
    width: 3,
    height: 18,
    backgroundColor: colors.primary,
    borderRadius: 2,
    position: 'absolute',
    left: spacing.sm,
  },
  link: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    fontWeight: fontWeight.medium,
    letterSpacing: 0.2,
  },
  linkActive: {
    color: colors.primary,
    fontWeight: fontWeight.bold,
  },
  sectionHeaderIcon: {
    marginRight: spacing.sm,
  },
  navItemIcon: {
    marginRight: spacing.md,
  },
  sidebarScroll: {
    flex: 1,
  },
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing['2xl'],
    marginHorizontal: spacing.sm,
    marginBottom: spacing.xl,
    marginTop: spacing.md,
    borderRadius: radius.sm,
    backgroundColor: colors.dangerLight,
  },
  logoutText: {
    fontSize: fontSize.sm,
    color: colors.danger,
    fontWeight: fontWeight.bold,
    letterSpacing: 0.2,
  },
});
