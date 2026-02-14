import { StyleSheet } from 'react-native';
import { colors } from './theme';

export const menuPickerStyles = StyleSheet.create({
  container: {
    marginTop: 4,
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    gap: 8,
  },
  loadingText: {
    color: colors.textMuted,
    fontSize: 14,
  },
  errorContainer: {
    padding: 16,
    alignItems: 'center',
  },
  errorText: {
    color: colors.danger,
    fontSize: 14,
    marginBottom: 8,
  },
  retryBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: colors.primaryLight,
    borderRadius: 8,
  },
  retryBtnText: {
    color: colors.primary,
    fontWeight: '600',
  },
  tabsScroll: {
    marginBottom: 12,
  },
  tabs: {
    flexDirection: 'row',
    gap: 6,
    paddingHorizontal: 2,
  },
  tab: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderRadius: 28,
    backgroundColor: colors.bgLight,
    borderWidth: 2,
    borderColor: colors.border,
    gap: 10,
  },
  tabActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  tabText: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.textSecondary,
  },
  tabTextActive: {
    color: '#fff',
  },
  tabCount: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.textMuted,
    backgroundColor: colors.card,
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 14,
    overflow: 'hidden',
    minWidth: 28,
    textAlign: 'center',
  },
  tabCountActive: {
    color: colors.primary,
    backgroundColor: 'rgba(255,255,255,0.9)',
  },
  productsContainer: {
    gap: 6,
  },
  productCard: {
    backgroundColor: colors.bgLight,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: colors.border,
    overflow: 'hidden',
    marginBottom: 8,
  },
  productHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
  },
  productInfo: {
    flex: 1,
  },
  productName: {
    fontSize: 20,
    fontWeight: '800',
    color: colors.text,
    letterSpacing: 0.4,
  },
  productDesc: {
    fontSize: 15,
    color: colors.textMuted,
    marginTop: 6,
  },
  expandIcon: {
    fontSize: 20,
    color: colors.textMuted,
    marginLeft: 12,
  },
  variantesContainer: {
    borderTopWidth: 1,
    borderTopColor: colors.divider,
  },
  varianteRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 18,
    paddingHorizontal: 24,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
    minHeight: 70,
  },
  varianteName: {
    fontSize: 18,
    color: colors.textSecondary,
    fontWeight: '700',
  },
  varianteRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  variantePrice: {
    fontSize: 19,
    fontWeight: '900',
    color: colors.primary,
  },
  addBtnSmall: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.4,
    shadowRadius: 6,
    elevation: 5,
  },
  addBtnSmallText: {
    color: '#fff',
    fontSize: 24,
    fontWeight: '800',
    lineHeight: 26,
  },
});
