import React from 'react';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { colors, radius, text } from '../lib/theme';

type IconName = React.ComponentProps<typeof MaterialCommunityIcons>['name'];

/** Tarjeta base: superficie plana con borde tenue. */
export function Card({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export type Tone = 'brand' | 'success' | 'danger' | 'info' | 'warn' | 'neutral' | 'whatsapp' | 'waze' | 'maps';

const TONES: Record<Tone, { fg: string; bg: string }> = {
  brand: { fg: colors.brand, bg: colors.brandSoft },
  success: { fg: colors.success, bg: colors.successSoft },
  danger: { fg: colors.danger, bg: colors.dangerSoft },
  info: { fg: colors.info, bg: colors.infoSoft },
  warn: { fg: colors.warn, bg: colors.warnSoft },
  neutral: { fg: colors.muted, bg: 'rgba(148,163,184,0.12)' },
  whatsapp: { fg: colors.whatsapp, bg: colors.whatsappSoft },
  waze: { fg: colors.waze, bg: colors.wazeSoft },
  maps: { fg: colors.maps, bg: colors.mapsSoft },
};

/** Píldora de estado. El color codifica la severidad, no solo decora. */
export function Pill({ label, tone = 'neutral', icon }: { label: string; tone?: Tone; icon?: IconName }) {
  const t = TONES[tone];
  return (
    <View style={[styles.pill, { backgroundColor: t.bg }]}>
      {icon ? <MaterialCommunityIcons name={icon} size={12} color={t.fg} /> : null}
      <Text style={[styles.pillText, { color: t.fg }]} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

/** Botón de icono (con etiqueta corta debajo): acciones rápidas de una tarjeta. Todos del mismo ancho. */
export function QuickAction({
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
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [styles.quick, pressed && styles.pressed]}
    >
      <View style={[styles.quickIcon, { backgroundColor: t.bg }]}>
        <MaterialCommunityIcons name={icon} size={20} color={t.fg} />
      </View>
      <Text style={styles.quickLabel} numberOfLines={1}>
        {label}
      </Text>
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
  style?: StyleProp<ViewStyle>;
}) {
  const solid = tone === 'brand' || tone === 'success';
  const t = TONES[tone];
  const bg = solid ? (tone === 'brand' ? colors.brand : colors.success) : t.bg;
  const fg = solid ? (tone === 'brand' ? colors.onBrand : '#04120C') : t.fg;

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityState={{ disabled: !!disabled }}
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

/** Etiqueta de sección. */
export function SectionLabel({ children }: { children: React.ReactNode }) {
  return <Text style={styles.sectionLabel}>{children}</Text>;
}

export function Divider({ style }: { style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.divider, style]} />;
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.hairline,
    overflow: 'hidden',
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: radius.pill,
  },
  pillText: { fontSize: 11, fontWeight: '700' },
  quick: { flex: 1, alignItems: 'center', gap: 5, minHeight: 56 },
  quickIcon: { width: 44, height: 44, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  quickLabel: { color: colors.muted, fontSize: 11, fontWeight: '600' },
  action: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    minHeight: 50,
    paddingVertical: 13,
    borderRadius: radius.md,
  },
  actionText: { fontSize: 14, fontWeight: '700' },
  pressed: { opacity: 0.65 },
  sectionLabel: { ...text.label, color: colors.faint },
  divider: { height: 1, backgroundColor: colors.line },
});
