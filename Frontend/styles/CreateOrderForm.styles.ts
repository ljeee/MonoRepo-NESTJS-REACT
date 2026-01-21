import { StyleSheet, Platform } from 'react-native';
import { colors } from '../components/theme';

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
  col4: { // Third width
    width: '33.33%',
    paddingHorizontal: 8,
    minWidth: 250,
  },
  col3: { // Quarter width
    width: '25%',
    paddingHorizontal: 8,
    minWidth: 200,
  },
  // ... existing styles adapted
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: colors.text,
    textAlign: 'left', // Aligned left for dashboard look
    marginBottom: 8,
    letterSpacing: -0.5,
  },
  titleMobile: {
    fontSize: 24,
    marginTop: 10,
    textAlign: 'center',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.primary,
    marginTop: 20,
    marginBottom: 16,
    textTransform: 'uppercase',
    letterSpacing: 1,
    borderLeftWidth: 4,
    borderLeftColor: colors.primary,
    paddingLeft: 12,
    width: '100%',
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textSecondary,
    marginBottom: 6,
    marginLeft: 4,
  },
  input: {
    backgroundColor: colors.bgLight,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 15,
    color: colors.text,
    marginBottom: 20,
    height: 50, // Fixed height for alignment
  },
  pickerContainer: {
    backgroundColor: colors.bgLight,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 20,
    overflow: 'hidden',
    justifyContent: 'center',
    height: 50, // Fixed height for alignment
  },
  picker: {
    height: 50,
    width: '100%',
    color: colors.text,
    backgroundColor: 'transparent',
    ...Platform.select({
      web: {
        outlineStyle: 'none',
        border: 'none',
        paddingLeft: '12px',
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
    paddingVertical: 18,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 20,
    width: '100%',
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 6,
  },
  createOrderBtnText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 16,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  success: {
    marginTop: 24,
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.success,
    color: colors.success,
    textAlign: 'center',
    fontWeight: 'bold',
  },
  error: {
    marginTop: 24,
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.danger,
    color: colors.danger,
    textAlign: 'center',
    fontWeight: 'bold',
  },
  fullWidth: {
    width: '100%',
  },
});
