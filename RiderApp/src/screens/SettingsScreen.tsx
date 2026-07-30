import React, { useCallback, useEffect, useState } from 'react';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { AppState, Linking, ScrollView, StyleSheet, Text, View } from 'react-native';
import Toast from 'react-native-toast-message';
import { useAuth, formatPhoneDisplay } from '@/src/shared';

import { ActionButton, Card, Divider, Pill, SectionLabel } from '../components/ui';
import { readPermissions, type PermState } from '../lib/location';
import { colors, radius, text } from '../lib/theme';

export function SettingsScreen({ onRetryTracking }: { onRetryTracking: () => Promise<unknown> }) {
  const { user, logout } = useAuth();
  const [perms, setPerms] = useState<PermState | null>(null);
  const [checking, setChecking] = useState(false);

  const refresh = useCallback(async () => {
    const p = await readPermissions();
    setPerms(p);
    return p;
  }, []);

  // Al abrir la pestaña y cada vez que la app vuelve a primer plano: el usuario
  // pudo haber concedido "Permitir todo el tiempo" en Ajustes del sistema.
  useEffect(() => {
    void refresh();
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') void refresh();
    });
    return () => sub.remove();
  }, [refresh]);

  const handleActivate = async () => {
    setChecking(true);
    try {
      await onRetryTracking();
      const p = await refresh();
      if (p.running) {
        Toast.show({ type: 'success', text1: 'Ubicación activa', text2: 'El despacho ya te ve en el mapa' });
      } else if (p.background !== 'granted') {
        Toast.show({
          type: 'info',
          text1: 'Falta "Permitir todo el tiempo"',
          text2: 'Ábrelo en Ajustes del sistema y vuelve',
        });
      }
    } finally {
      setChecking(false);
    }
  };

  const fgOk = perms?.foreground === 'granted';
  const bgOk = perms?.background === 'granted';
  const running = perms?.running === true;

  return (
    <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
      <Text style={styles.title}>Ajustes</Text>

      {/* ── Estado del rastreo ── */}
      <SectionLabel>Ubicación en tiempo real</SectionLabel>
      <Card style={styles.card}>
        <View style={styles.statusHead}>
          <View
            style={[
              styles.statusIcon,
              { backgroundColor: running ? colors.successSoft : colors.dangerSoft },
            ]}
          >
            <MaterialCommunityIcons
              name={running ? 'crosshairs-gps' : 'crosshairs-off'}
              size={26}
              color={running ? colors.success : colors.danger}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.statusTitle}>
              {running ? 'Compartiendo ubicación' : 'Ubicación inactiva'}
            </Text>
            <Text style={styles.statusSub}>
              {running
                ? 'El despacho ve dónde estás, incluso con la pantalla apagada.'
                : 'El despacho no puede verte en el mapa ahora mismo.'}
            </Text>
          </View>
        </View>

        <Divider style={{ marginVertical: 14 }} />

        <View style={styles.permRow}>
          <Text style={styles.permLabel}>Mientras uso la app</Text>
          <Pill
            label={fgOk ? 'Concedido' : 'Falta'}
            tone={fgOk ? 'success' : 'danger'}
            icon={fgOk ? 'check' : 'close'}
          />
        </View>
        <View style={styles.permRow}>
          <Text style={styles.permLabel}>Permitir todo el tiempo</Text>
          <Pill
            label={bgOk ? 'Concedido' : 'Falta'}
            tone={bgOk ? 'success' : 'danger'}
            icon={bgOk ? 'check' : 'close'}
          />
        </View>

        {!bgOk && (
          <View style={styles.hint}>
            <MaterialCommunityIcons name="information-outline" size={15} color={colors.info} />
            <Text style={styles.hintText}>
              Android solo permite activar “Todo el tiempo” desde los ajustes del sistema. Ábrelos,
              elige Ubicación → Permitir todo el tiempo, y regresa: la app lo detecta sola.
            </Text>
          </View>
        )}

        <View style={styles.actions}>
          <ActionButton
            label={checking ? 'Verificando…' : running ? 'Volver a verificar' : 'Activar ubicación'}
            icon={running ? 'refresh' : 'crosshairs-gps'}
            tone={running ? 'neutral' : 'brand'}
            onPress={handleActivate}
            disabled={checking}
          />
          {!bgOk && (
            <ActionButton
              label="Abrir ajustes del sistema"
              icon="cog-outline"
              tone="info"
              onPress={() => Linking.openSettings().catch(() => {})}
            />
          )}
        </View>
      </Card>

      {/* ── Cuenta ── */}
      <SectionLabel>Cuenta</SectionLabel>
      <Card style={styles.card}>
        <View style={styles.accountRow}>
          <View style={styles.avatar}>
            <MaterialCommunityIcons name="account" size={22} color={colors.brand} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.accountName} numberOfLines={1}>
              {user?.name || user?.username || 'Domiciliario'}
            </Text>
            {user?.username ? (
              <Text style={styles.accountSub}>{formatPhoneDisplay(user.username)}</Text>
            ) : null}
          </View>
        </View>

        <Divider style={{ marginVertical: 14 }} />

        <ActionButton label="Cerrar sesión" icon="logout-variant" tone="danger" onPress={logout} />
        <Text style={styles.note}>
          Al cerrar sesión se detiene el envío de tu ubicación.
        </Text>
      </Card>

      <Text style={styles.version}>Dfiru Riders · v1.0.0</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: 20, paddingBottom: 30, gap: 10 },
  title: { ...text.h1, color: colors.ink, marginBottom: 12 },
  card: { padding: 16, marginTop: 8, marginBottom: 14 },

  statusHead: { flexDirection: 'row', alignItems: 'center', gap: 13 },
  statusIcon: { width: 52, height: 52, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  statusTitle: { color: colors.ink, fontSize: 16, fontWeight: '800' },
  statusSub: { color: colors.muted, fontSize: 12.5, lineHeight: 18, marginTop: 3 },

  permRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 7,
  },
  permLabel: { color: colors.ink, fontSize: 13.5, fontWeight: '600' },

  hint: {
    flexDirection: 'row',
    gap: 9,
    backgroundColor: colors.infoSoft,
    borderRadius: radius.md,
    padding: 12,
    marginTop: 10,
  },
  hintText: { flex: 1, color: colors.muted, fontSize: 12, lineHeight: 18 },

  actions: { gap: 9, marginTop: 14 },

  accountRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatar: {
    width: 46,
    height: 46,
    borderRadius: 16,
    backgroundColor: 'rgba(245,165,36,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(245,165,36,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  accountName: { color: colors.ink, fontSize: 15.5, fontWeight: '800' },
  accountSub: { color: colors.muted, fontSize: 12.5, marginTop: 2 },

  note: { color: colors.faint, fontSize: 11, textAlign: 'center', marginTop: 10, lineHeight: 16 },
  version: { color: colors.ghost, fontSize: 11, textAlign: 'center', marginTop: 6 },
});
