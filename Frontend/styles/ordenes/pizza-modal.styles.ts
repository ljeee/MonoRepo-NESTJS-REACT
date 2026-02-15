import { StyleSheet } from 'react-native';
import { colors } from '../theme';
import { fontSize, fontWeight, spacing, radius } from '../tokens';

export const pizzaModalStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  container: {
    flex: 1,
    marginTop: 80,
    backgroundColor: colors.bg,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: 16,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 13,
    color: colors.textMuted,
    marginBottom: 16,
  },
  scrollArea: {
    flex: 1,
    marginBottom: 12,
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textSecondary,
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  sectionLabelEspecial: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.secondary,
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  chipGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },
  chipGridLast: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 8,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 2,
    minWidth: '45%',
    flexGrow: 1,
  },
  chipText: {
    fontWeight: '600',
    textAlign: 'center',
    fontSize: 14,
  },
  breakdownBox: {
    backgroundColor: colors.bgLight,
    borderRadius: 8,
    padding: 10,
    marginBottom: 10,
  },
  breakdownSabores: {
    fontSize: 12,
    color: colors.textMuted,
  },
  breakdownEspecial: {
    fontSize: 11,
    color: colors.secondary,
    marginTop: 2,
  },
  breakdownTresSabores: {
    fontSize: 11,
    color: colors.warning,
    marginTop: 2,
  },
  btnRow: {
    flexDirection: 'row',
    gap: 8,
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cancelBtnText: {
    color: colors.text,
    textAlign: 'center',
    fontWeight: '600',
  },
  addBtn: {
    flex: 2,
    paddingVertical: 14,
    borderRadius: 10,
  },
  addBtnText: {
    color: '#fff',
    textAlign: 'center',
    fontWeight: '700',
    fontSize: 15,
  },
});
