import { StyleSheet } from 'react-native';
import { colors } from './theme';

export const domiciliariosListStyles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: colors.bg 
  },
  contentContainer: {
    padding: 16,
    paddingBottom: 100,
    width: '100%',
    maxWidth: 900,
    alignSelf: 'center',
  },
  title: { 
    fontSize: 28, 
    fontWeight: 'bold', 
    marginVertical: 24, 
    color: colors.text,
    textAlign: 'center',
  },
  itemBox: { 
    backgroundColor: colors.card, 
    padding: 16, 
    borderRadius: 12, 
    marginBottom: 12, 
    borderWidth: 1, 
    borderColor: colors.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  input: { 
    borderWidth: 1, 
    borderColor: colors.border, 
    backgroundColor: colors.bg, 
    color: colors.text, 
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8, 
    marginTop: 4, 
    marginBottom: 4,
    fontSize: 16,
  },
  label: { 
    fontWeight: 'bold', 
    fontSize: 16, 
    color: colors.text 
  },
  rowField: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    marginBottom: 8 
  },
  editBtnSmall: { 
    backgroundColor: colors.accent, 
    padding: 8, 
    borderRadius: 6, 
    marginLeft: 8 
  },
  rowMain: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    gap: 8 
  },
  rowBtns: { 
    flexDirection: 'row', 
    gap: 8, 
    marginTop: 8 
  },
  editBtn: { 
    backgroundColor: colors.accent, 
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  deleteBtn: { 
    backgroundColor: colors.danger, 
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  buttonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 14,
  },
  toggleFormButton: {
    backgroundColor: colors.success,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    marginBottom: 24,
    alignSelf: 'center',
  },
  closeFormButton: {
    backgroundColor: colors.danger,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    marginBottom: 24,
    alignSelf: 'center',
  },
  success: { 
    color: colors.success, 
    marginTop: 16,
    textAlign: 'center',
    fontSize: 16,
    fontWeight: 'bold',
    backgroundColor: 'rgba(76, 175, 80, 0.1)',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(76, 175, 80, 0.3)',
  },
  error: { 
    color: colors.danger, 
    marginTop: 16,
    textAlign: 'center',
    fontSize: 16,
    fontWeight: 'bold',
    backgroundColor: 'rgba(239, 83, 80, 0.1)',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(239, 83, 80, 0.3)',
  },
  emptyText: {
    textAlign: 'center',
    color: colors.subText,
    marginTop: 32,
    fontSize: 16,
  },
});
