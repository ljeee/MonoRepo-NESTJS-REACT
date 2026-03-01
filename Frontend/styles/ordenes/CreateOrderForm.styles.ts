import { StyleSheet, Platform } from 'react-native';
import { colors } from '../theme';

export const orderFormStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  contentContainer: {
    paddingVertical: 20,
    paddingHorizontal: 20,
    paddingBottom: 120,
    width: '100%',
    // maxWidth: 900, // Removed to allow full screen width usage
    alignSelf: 'stretch',
  },
  formCard: {
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 24,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  // Grid System Utilities
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -8, // Negative margin to offset column padding
  },
  col12: { // Full width
    width: '100%',
    paddingHorizontal: 8,
  },
  col6: { // Half width
    width: '50%',
    paddingHorizontal: 8,
    minWidth: 300, // Wrap on small screens
  },
  col6Mobile: {
    width: '100%',
  },
  col4: { // Third width
    width: '33.33%',
    paddingHorizontal: 8,
    minWidth: 250,
  },
  col4Mobile: {
    width: '100%',
  },
  col3: { // Quarter width
    width: '25%',
    paddingHorizontal: 8,
    minWidth: 200,
  },
  col3Mobile: {
    width: '50%',
  },
  // ... existing styles adapted
  title: {
    fontSize: 32,
    fontWeight: '900',
    color: colors.text,
    textAlign: 'left',
    marginBottom: 10,
    letterSpacing: -0.5,
  },
  titleMobile: {
    fontSize: 24,
    marginTop: 10,
    textAlign: 'center',
  },
  sectionTitle: {
    fontSize: 22,
    fontWeight: '900',
    color: colors.primary,
    marginTop: 28,
    marginBottom: 20,
    textTransform: 'uppercase',
    letterSpacing: 1.5,
    borderLeftWidth: 6,
    borderLeftColor: colors.primary,
    paddingLeft: 16,
    width: '100%',
  },
  label: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.text,
    marginBottom: 10,
    marginLeft: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  input: {
    backgroundColor: colors.bgLight,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: colors.border,
    paddingHorizontal: 20,
    paddingVertical: 16,
    fontSize: 18,
    color: colors.text,
    marginBottom: 22,
    height: 58,
  },
  pickerContainer: {
    backgroundColor: colors.bgLight,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: colors.border,
    marginBottom: 22,
    overflow: 'hidden',
    justifyContent: 'center',
    height: 58,
  },
  picker: {
    height: 58,
    width: '100%',
    color: colors.text,
    backgroundColor: 'transparent',
    fontSize: 18,
    ...Platform.select({
      web: {
        outlineStyle: 'none',
        border: 'none',
        paddingLeft: '16px',
      } as any,
    }),
  },
  addProductBtn: {
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 10,
    marginBottom: 20,
    width: '100%',
    borderWidth: 1,
    borderColor: colors.primary,
    borderStyle: 'dashed',
    flexDirection: 'row',
    justifyContent: 'center',
  },
  addProductBtnText: {
    color: colors.primary,
    fontWeight: '700',
    fontSize: 15,
    letterSpacing: 0.5,
  },
  createOrderBtn: {
    backgroundColor: colors.primary,
    paddingVertical: 20,
    borderRadius: 14,
    alignItems: 'center',
    marginTop: 28,
    width: '100%',
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.5,
    shadowRadius: 10,
    elevation: 8,
  },
  createOrderBtnText: {
    color: '#fff',
    fontWeight: '900',
    fontSize: 20,
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  success: {
    color: colors.success,
    textAlign: 'center',
    fontWeight: 'bold',
    fontSize: 16,
  },
  successContainer: {
    marginTop: 24,
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.success,
  },
  error: {
    color: colors.danger,
    textAlign: 'center',
    fontWeight: 'bold',
    fontSize: 15,
    lineHeight: 22,
  },
  errorContainer: {
    marginTop: 24,
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.danger,
  },
  fullWidth: {
    width: '100%',
  },
  // Extracted inline styles
  rootBg: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: colors.text,
    fontSize: 16,
  },
  formCardMobile: {
    padding: 20,
    borderRadius: 16,
  },
  pickerItemStyle: {
    color: colors.text,
    fontSize: 16,
  },
  flexOne: {
    flex: 1,
  },
  observationsInput: {
    height: 100,
    textAlignVertical: 'top',
    paddingTop: 12,
  },
  sectionTitleSpaced: {
    marginTop: 24,
  },
  disabledBtn: {
    opacity: 0.6,
  },
  androidBottomSpacer: {
    height: 32,
  },
});
