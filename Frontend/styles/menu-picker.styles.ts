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
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: colors.bgLight,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 6,
  },
  tabActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  tabText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  tabTextActive: {
    color: '#fff',
  },
  tabCount: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textMuted,
    backgroundColor: colors.card,
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 10,
    overflow: 'hidden',
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
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  productHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
  },
  productInfo: {
    flex: 1,
  },
  productName: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.text,
  },
  productDesc: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 2,
  },
  expandIcon: {
    fontSize: 16,
    color: colors.textMuted,
    marginLeft: 8,
  },
  variantesContainer: {
    borderTopWidth: 1,
    borderTopColor: colors.divider,
  },
  varianteRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  varianteName: {
    fontSize: 14,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  varianteRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  variantePrice: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.primary,
  },
  addBtnSmall: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addBtnSmallText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
    lineHeight: 20,
  },
});
