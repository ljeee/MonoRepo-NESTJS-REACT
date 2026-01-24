import { StyleSheet } from 'react-native';
import { colors } from './theme';

export const indexStyles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.card },
  title: { marginBottom: 16, color: '#fff', paddingTop: 24 },
});
