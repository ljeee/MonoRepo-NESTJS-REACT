import React, { useState } from 'react';
import { Linking, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import Toast from 'react-native-toast-message';
import { useAuth, formatPhoneDisplay } from '@/src/shared';

import { ActionButton, Card, Divider, Pill, SectionLabel } from '../components/ui';
import { useGpsEstado, type NivelGps } from '../lib/useGpsEstado';
import { colors, maxContentWidth, text } from '../lib/theme';

const COLOR_NIVEL: Record<NivelGps, string> = { ok: colors.success, atrasado: colors.warn, inactivo: colors.danger };

/** En Android abre la lista de apps sin restricción de batería (el ahorro de energía retrasa el envío con la pantalla apagada). */
async function abrirAhorroDeBateria() {
  try {
    if (Platform.OS === 'android') {
      await Linking.sendIntent('android.settings.IGNORE_BATTERY_OPTIMIZATION_SETTINGS');
      return;
    }
  } catch {
    // sin esa pantalla en este teléfono: caemos a los ajustes generales
  }
  Linking.openSettings().catch(() => {});
}

export function SettingsScreen({ onRetryTracking }: { onRetryTracking: () => Promise<unknown> }) {
  const { user, logout } = useAuth();
  const { estado, refrescar } = useGpsEstado();
  const [checking, setChecking] = useState(false);
  const { perms } = estado;

  const handleActivate = async () => {
    setChecking(true);
    try {
      await onRetryTracking();
      const p = await refrescar();
      if (p.running) Toast.show({ type: 'success', text1: 'Ubicación activa', text2: 'El despacho ya te ve' });
    } finally {
      setChecking(false);
    }
  };

  const fgOk = perms?.foreground === 'granted';
  const bgOk = perms?.background === 'granted';
  const running = perms?.running === true;

  return (
    <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
      <View style={styles.column}>
        <Text style={styles.title}>Ajustes</Text>

        <SectionLabel>Ubicación</SectionLabel>
        <Card style={styles.card}>
          <View style={styles.statusRow}>
            <View style={[styles.dot, { backgroundColor: COLOR_NIVEL[estado.nivel] }]} />
            <View style={styles.flex}>
              <Text style={styles.statusTitle}>{estado.texto}</Text>
              {estado.ayuda ? <Text style={styles.statusSub}>{estado.ayuda}</Text> : null}
            </View>
          </View>

          <Divider style={styles.divider} />

          <View style={styles.permRow}>
            <Text style={styles.permLabel}>Mientras uso la app</Text>
            <Pill label={fgOk ? 'Concedido' : 'Falta'} tone={fgOk ? 'success' : 'danger'} />
          </View>
          <View style={styles.permRow}>
            <Text style={styles.permLabel}>Permitir todo el tiempo</Text>
            <Pill label={bgOk ? 'Concedido' : 'Falta'} tone={bgOk ? 'success' : 'danger'} />
          </View>
          <View style={styles.permRow}>
            <Text style={styles.permLabel}>GPS del teléfono</Text>
            <Pill label={perms?.servicesEnabled === false ? 'Apagado' : 'Encendido'} tone={perms?.servicesEnabled === false ? 'danger' : 'success'} />
          </View>

          <View style={styles.actions}>
            <ActionButton
              label={checking ? 'Verificando…' : running ? 'Volver a verificar' : 'Activar ubicación'}
              tone={running ? 'neutral' : 'brand'}
              onPress={handleActivate}
              disabled={checking}
            />
            {!bgOk && <ActionButton label="Abrir ajustes del sistema" tone="neutral" onPress={() => Linking.openSettings().catch(() => {})} />}
            {Platform.OS === 'android' && (
              <ActionButton label="Quitar ahorro de batería" tone="neutral" onPress={() => void abrirAhorroDeBateria()} />
            )}
          </View>
          <Text style={styles.note}>
            Para que el despacho te vea con la pantalla apagada: ubicación en “Todo el tiempo” y la app sin ahorro de batería.
          </Text>
        </Card>

        <SectionLabel>Cuenta</SectionLabel>
        <Card style={styles.card}>
          <Text style={styles.accountName} numberOfLines={1}>
            {user?.name || user?.username || 'Domiciliario'}
          </Text>
          {user?.username ? <Text style={styles.accountSub}>{formatPhoneDisplay(user.username)}</Text> : null}

          <Divider style={styles.divider} />

          <ActionButton label="Cerrar sesión" tone="danger" onPress={logout} />
          <Text style={styles.note}>Al cerrar sesión se detiene el envío de tu ubicación.</Text>
        </Card>

        <Text style={styles.version}>Dfiru Riders · v1.0.0</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  scroll: { padding: 20, paddingBottom: 30, alignItems: 'center' },
  column: { width: '100%', maxWidth: Math.min(maxContentWidth, 560), gap: 10 },
  title: { ...text.h1, color: colors.ink, marginBottom: 8 },
  card: { padding: 16, marginBottom: 12 },
  divider: { marginVertical: 14 },

  statusRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  dot: { width: 10, height: 10, borderRadius: 5, marginTop: 6 },
  statusTitle: { color: colors.ink, fontSize: 16, fontWeight: '700' },
  statusSub: { color: colors.muted, fontSize: 13, lineHeight: 19, marginTop: 3 },

  permRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 7 },
  permLabel: { color: colors.ink, fontSize: 14, fontWeight: '500' },

  actions: { gap: 9, marginTop: 14 },
  note: { color: colors.faint, fontSize: 12, lineHeight: 17, marginTop: 12 },

  accountName: { color: colors.ink, fontSize: 16, fontWeight: '700' },
  accountSub: { color: colors.muted, fontSize: 13, marginTop: 2 },
  version: { color: colors.ghost, fontSize: 11, textAlign: 'center', marginTop: 6 },
});
