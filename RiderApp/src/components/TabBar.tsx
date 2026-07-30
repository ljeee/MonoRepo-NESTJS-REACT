import React from 'react';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, radius, shadow } from '../lib/theme';

export type TabKey = 'entregas' | 'ajustes';

type IconName = React.ComponentProps<typeof MaterialCommunityIcons>['name'];

const TABS: { key: TabKey; label: string; icon: IconName; iconOff: IconName }[] = [
  { key: 'entregas', label: 'Entregas', icon: 'moped', iconOff: 'moped-outline' },
  { key: 'ajustes', label: 'Ajustes', icon: 'cog', iconOff: 'cog-outline' },
];

/**
 * Barra inferior propia (sin react-navigation): RiderApp solo tiene dos
 * destinos, así que no vale la pena traer una dependencia nativa nueva —
 * cada dependencia nativa extra es una superficie más de crash en release.
 */
export function TabBar({
  active,
  onChange,
  badge,
}: {
  active: TabKey;
  onChange: (t: TabKey) => void;
  /** Contador opcional por pestaña (ej. entregas pendientes). */
  badge?: Partial<Record<TabKey, number>>;
}) {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.wrap, { paddingBottom: Math.max(insets.bottom, 10) }]}>
      {TABS.map((t) => {
        const on = active === t.key;
        const count = badge?.[t.key] ?? 0;
        return (
          <Pressable
            key={t.key}
            onPress={() => onChange(t.key)}
            style={({ pressed }) => [styles.tab, pressed && { opacity: 0.6 }]}
            accessibilityRole="button"
            accessibilityState={{ selected: on }}
            accessibilityLabel={t.label}
          >
            <View style={[styles.iconWrap, on && styles.iconWrapOn]}>
              <MaterialCommunityIcons
                name={on ? t.icon : t.iconOff}
                size={21}
                color={on ? colors.brand : colors.faint}
              />
              {count > 0 && (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{count > 9 ? '9+' : count}</Text>
                </View>
              )}
            </View>
            <Text style={[styles.label, on && styles.labelOn]}>{t.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    backgroundColor: colors.bgElevated,
    borderTopWidth: 1,
    borderTopColor: colors.line,
    paddingTop: 9,
    ...shadow.bar,
  },
  tab: { flex: 1, alignItems: 'center', gap: 3 },
  iconWrap: {
    width: 54,
    height: 30,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconWrapOn: { backgroundColor: 'rgba(245,165,36,0.13)' },
  badge: {
    position: 'absolute',
    top: -2,
    right: 8,
    minWidth: 17,
    height: 17,
    paddingHorizontal: 4,
    borderRadius: radius.pill,
    backgroundColor: colors.danger,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.bgElevated,
  },
  badgeText: { color: '#fff', fontSize: 9, fontWeight: '900' },
  label: { fontSize: 10.5, fontWeight: '700', color: colors.faint },
  labelOn: { color: colors.brand },
});
