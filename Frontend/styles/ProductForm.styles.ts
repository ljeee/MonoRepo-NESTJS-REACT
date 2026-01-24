import { StyleSheet, Platform } from 'react-native';
import { colors } from './theme';

export const productFormStyles = StyleSheet.create({
  productContainer: {
    marginBottom: 20,
    backgroundColor: colors.bgLight, 
    padding: 20,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingBottom: 10,
  },
  productTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: colors.text,
    textTransform: 'uppercase',
  },
  // Grid
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -6,
  },
  col4: {
    width: '33.33%',
    paddingHorizontal: 6,
    minWidth: 150,
  },
  col4Mobile: {
    width: '100%',
  },
  col6: {
    width: '50%',
    paddingHorizontal: 6,
    minWidth: 180,
  },
  col6Mobile: {
    width: '100%',
  },
  col12: {
    width: '100%',
    paddingHorizontal: 6,
  },
  
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textSecondary,
    marginBottom: 6,
    marginTop: 2,
  },
  input: {
    backgroundColor: colors.bg,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: colors.text,
    marginBottom: 16,
    height: 46,
  },
  pickerContainer: {
    backgroundColor: colors.bg,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 16,
    overflow: 'hidden',
    justifyContent: 'center',
    height: Platform.OS === 'android' ? 50 : 46, // Taller on Android
  },
  picker: {
    height: Platform.OS === 'android' ? 50 : 46,
    width: '100%',
    color: colors.text,
    backgroundColor: 'transparent',
    ...Platform.select({
      web: {
        outlineStyle: 'none',
        border: 'none',
        paddingLeft: '8px',
        appearance: 'none',
        backgroundColor: colors.bg, // Ensure contrast
      } as any,
      android: {
         color: colors.text,
         backgroundColor: colors.bg,
      }
    }),
  },
  removeBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
  },
  removeBtnText: {
    color: colors.danger,
    fontWeight: '600',
    fontSize: 12,
  },
  addFlavorBtn: {
    marginTop: 8,
    marginBottom: 16,
    alignSelf: 'flex-start',
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: colors.card,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.secondary,
    flexDirection: 'row',
    alignItems: 'center',
  },
  addFlavorBtnText: {
    color: colors.secondary,
    fontWeight: '600',
    fontSize: 14,
  },
});
