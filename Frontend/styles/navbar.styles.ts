import { StyleSheet } from 'react-native';
import { colors } from './theme';

export const styles = StyleSheet.create({
  // ── Mobile menu button ──
  menuBtnContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    zIndex: 200,
    backgroundColor: 'transparent',
    padding: 12,
  },
  menuBtn: {
    backgroundColor: colors.card,
    borderRadius: 10,
    padding: 12,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
    borderWidth: 1,
    borderColor: colors.border,
  },
  menuBtnText: {
    color: colors.text,
    fontSize: 24,
    fontWeight: 'bold',
  },
  drawerOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    zIndex: 99,
  },

  // ── Mobile sidebar ──
  sidebarMobile: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 280,
    backgroundColor: colors.card,
    zIndex: 100,
    height: '100%',
    paddingBottom: 20,
    justifyContent: 'flex-start',
    alignItems: 'stretch',
    borderRightWidth: 2,
    borderRightColor: colors.border,
    shadowColor: '#000',
    shadowOffset: { width: 4, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  sidebarHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 14,
    borderBottomWidth: 2,
    borderBottomColor: colors.border,
    marginBottom: 4,
  },
  sidebarHeaderText: {
    color: colors.text,
    fontSize: 20,
    fontWeight: 'bold',
    letterSpacing: 0.5,
  },
  sidebarCloseText: {
    color: colors.textSecondary,
    fontSize: 22,
    fontWeight: 'bold',
    padding: 4,
  },

  // ── Desktop navbar ──
  navbar: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 0,
    paddingHorizontal: 8,
    backgroundColor: colors.card,
    borderBottomWidth: 2,
    borderBottomColor: colors.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
    gap: 4,
  },

  // ── Section accordion ──
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  sectionHeaderActive: {
    backgroundColor: colors.primaryLight,
  },
  sectionTitle: {
    color: colors.textSecondary,
    fontSize: 13,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  sectionTitleActive: {
    color: colors.primary,
  },
  sectionArrow: {
    color: colors.textMuted,
    fontSize: 14,
    marginLeft: 8,
  },

  // ── Nav items ──
  navItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  navItemActive: {
    backgroundColor: colors.primaryLight,
  },
  activeIndicator: {
    width: 3,
    height: 20,
    backgroundColor: colors.primary,
    borderRadius: 2,
    marginRight: 10,
    position: 'absolute',
    left: 8,
  },
  link: {
    fontSize: 15,
    color: colors.text,
    fontWeight: '500',
    letterSpacing: 0.3,
    paddingLeft: 8,
  },
  linkActive: {
    color: colors.primary,
    fontWeight: 'bold',
  },
});
