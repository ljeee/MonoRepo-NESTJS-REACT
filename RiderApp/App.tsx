import React, { useCallback, useState } from 'react';
import { ActivityIndicator, StatusBar, StyleSheet, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import Toast from 'react-native-toast-message';
import { AuthProvider, ToastProvider, useAuth } from '@/src/shared';

import { ErrorBoundary } from './src/components/ErrorBoundary';
import { TabBar, type TabKey } from './src/components/TabBar';
import { useLocationTracking } from './src/lib/location';
import { colors } from './src/lib/theme';
import { DeliveriesScreen } from './src/screens/DeliveriesScreen';
import { LoginScreen } from './src/screens/LoginScreen';
import { SettingsScreen } from './src/screens/SettingsScreen';

/**
 * Contenedor con pestañas. Ambas pantallas quedan MONTADAS y solo se oculta la
 * inactiva: cambiar de pestaña no vuelve a pedir los domicilios ni pierde el
 * scroll. (Además, con el tracking ya colgado de la sesión, montar y desmontar
 * pantallas dejó de tener efecto alguno sobre el GPS.)
 */
function AuthedApp({ onRetryTracking }: { onRetryTracking: () => Promise<unknown> }) {
  const [tab, setTab] = useState<TabKey>('entregas');
  const [pendientes, setPendientes] = useState(0);

  const handleCount = useCallback((n: number) => setPendientes(n), []);

  return (
    <View style={styles.flex}>
      <View style={[styles.flex, tab !== 'entregas' && styles.hidden]}>
        <DeliveriesScreen onCountChange={handleCount} />
      </View>
      <View style={[styles.flex, tab !== 'ajustes' && styles.hidden]}>
        <SettingsScreen onRetryTracking={onRetryTracking} />
      </View>

      <TabBar active={tab} onChange={setTab} badge={{ entregas: pendientes }} />
    </View>
  );
}

function Main() {
  const { user, isLoading } = useAuth();

  // El rastreo depende de la SESIÓN, no de una pantalla: este hook vive en un
  // componente que permanece montado en todo el ciclo de vida de la app, así
  // que navegar entre pestañas nunca lo apaga. Solo se detiene al cerrar sesión.
  const { refresh } = useLocationTracking(!isLoading && !!user);

  const retryTracking = useCallback(() => refresh(true), [refresh]);

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <StatusBar barStyle="light-content" backgroundColor={colors.bg} />
      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.brand} />
        </View>
      ) : user ? (
        <AuthedApp onRetryTracking={retryTracking} />
      ) : (
        <LoginScreen />
      )}
      <Toast />
    </SafeAreaView>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <SafeAreaProvider>
        <ToastProvider>
          <AuthProvider>
            <Main />
          </AuthProvider>
        </ToastProvider>
      </SafeAreaProvider>
    </ErrorBoundary>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  // `display:'none'` conserva el estado del árbol oculto (a diferencia de
  // desmontarlo con un ternario).
  hidden: { display: 'none' },
  safe: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
//Angie1001469819
//Yayi3122976766