import React from 'react';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View, type ViewStyle } from 'react-native';

import { colors, radius, shadow, text } from '../lib/theme';

type IconName = React.ComponentProps<typeof MaterialCommunityIcons>['name'];

/** Tarjeta base: borde tenue + canto superior más claro (simula luz de arriba). */
export function Card({ children, style }: { children: React.ReactNode; style?: ViewStyle }) {
  return (
    <View style={[styles.card, style]}>
      <View style={styles.cardTopEdge} pointerEvents="none" />
      {children}
    </View>
  );
}

export type Tone = 'brand' | 'success' | 'danger' | 'info' | 'warn' | 'neutral';

const TONES: Record<Tone, { fg: string; bg: string }> = {
  brand: { fg: colors.brand, bg: 'rgba(245,165,36,0.13)' },
  success: { fg: colors.success, bg: colors.successSoft },
  danger: { fg: colors.danger, bg: colors.dangerSoft },
  info: { fg: colors.info, bg: colors.infoSoft },
  warn: { fg: colors.warn, bg: colors.warnSoft },
  neutral: { fg: colors.muted, bg: 'rgba(148,163,184,0.12)' },
};

/** Píldora de estado. El color codifica la severidad, no solo decora. */
export function Pill({ label, tone = 'neutral', icon }: { label: string; tone?: Tone; icon?: IconName }) {
  const t = TONES[tone];
  return (
    <View style={[styles.pill, { backgroundColor: t.bg }]}>
      {icon ? <MaterialCommunityIcons name={icon} size={11} color={t.fg} /> : null}
      <Text style={[styles.pillText, { color: t.fg }]} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

/** Botón compacto con ícono + texto, usado para copiar/llamar. */
export function ChipButton({
  label,
  icon,
  tone = 'neutral',
  onPress,
}: {
  label: string;
  icon: IconName;
  tone?: Tone;
  onPress: () => void;
}) {
  const t = TONES[tone];
  return (
    <Pressable
      onPress={onPress}
      hitSlop={6}
      style={({ pressed }) => [styles.chip, { backgroundColor: t.bg }, pressed && styles.pressed]}
    >
      <MaterialCommunityIcons name={icon} size={13} color={t.fg} />
      <Text style={[styles.chipText, { color: t.fg }]}>{label}</Text>
    </Pressable>
  );
}

/** Botón principal a ancho completo. */
export function ActionButton({
  label,
  icon,
  tone = 'brand',
  onPress,
  disabled,
  style,
}: {
  label: string;
  icon?: IconName;
  tone?: Tone;
  onPress: () => void;
  disabled?: boolean;
  style?: ViewStyle;
}) {
  const solid = tone === 'brand' || tone === 'success';
  const t = TONES[tone];
  const bg = solid ? (tone === 'brand' ? colors.brand : colors.success) : t.bg;
  const fg = solid ? (tone === 'brand' ? colors.onBrand : '#04120C') : t.fg;

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.action,
        { backgroundColor: bg },
        disabled && { opacity: 0.45 },
        pressed && !disabled && styles.pressed,
        style,
      ]}
    >
      {icon ? <MaterialCommunityIcons name={icon} size={18} color={fg} /> : null}
      <Text style={[styles.actionText, { color: fg }]}>{label}</Text>
    </Pressable>
  );
}

/** Etiqueta de sección en versalita. */
export function SectionLabel({ children }: { children: React.ReactNode }) {
  return <Text style={styles.sectionLabel}>{children}</Text>;
}

export function Divider({ style }: { style?: ViewStyle }) {
  return <View style={[styles.divider, style]} />;
}

/** Fila etiqueta → valor, con acciones opcionales a la derecha. */
export function InfoRow({
  icon,
  label,
  value,
  children,
}: {
  icon: IconName;
  label: string;
  value: string;
  children?: React.ReactNode;
}) {
  return (
    <View style={styles.infoRow}>
      <View style={styles.infoIcon}>
        <MaterialCommunityIcons name={icon} size={15} color={colors.muted} />
      </View>
      <View style={styles.infoBody}>
        <Text style={styles.infoLabel}>{label}</Text>
        <Text style={styles.infoValue}>{value}</Text>
        {children ? <View style={styles.infoActions}>{children}</View> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.hairline,
    overflow: 'hidden',
    ...shadow.card,
  },
  cardTopEdge: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: colors.hairlineTop,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: radius.pill,
  },
  pillText: { fontSize: 9.5, fontWeight: '800', letterSpacing: 0.7, textTransform: 'uppercase' },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radius.sm,
  },
  chipText: { fontSize: 11.5, fontWeight: '700' },
  action: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 15,
    borderRadius: radius.md,
  },
  actionText: { fontSize: 14, fontWeight: '800', letterSpacing: 0.6 },
  pressed: { opacity: 0.65, transform: [{ scale: 0.985 }] },
  sectionLabel: { ...text.label, color: colors.faint },
  divider: { height: 1, backgroundColor: colors.line },
  infoRow: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  infoIcon: { width: 26, height: 26, borderRadius: 8, backgroundColor: colors.surfaceAlt, alignItems: 'center', justifyContent: 'center' },
  infoBody: { flex: 1, minWidth: 0 },
  infoLabel: { ...text.label, color: colors.faint, fontSize: 9 },
  infoValue: { color: colors.ink, fontSize: 14, fontWeight: '600', marginTop: 2, lineHeight: 19 },
  infoActions: { flexDirection: 'row', gap: 6, marginTop: 8 },
});
