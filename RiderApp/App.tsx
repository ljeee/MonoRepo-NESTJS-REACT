import React, { useEffect, useState, useCallback } from 'react';
import { 
  StyleSheet, Text, View, TextInput, Pressable, 
  ActivityIndicator, RefreshControl,
  StatusBar, Platform, Linking
} from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import Toast from 'react-native-toast-message';
import * as Clipboard from 'expo-clipboard';
import * as Location from 'expo-location';
import { AuthProvider, useAuth, api, Domicilio } from '@/src/shared';

// ─── Tracking de ubicación ────────────────────────────────────────────────────
// Mientras la app esté abierta y con sesión, reporta la posición del
// domiciliario cada 20s vía REST (misma cadencia de polling que ya usa el
// resto del proyecto) para que el despachador vea "hace cuánto" fue vista.

const LOCATION_UPDATE_INTERVAL_MS = 20000;

function useLocationTracking() {
  useEffect(() => {
    let cancelled = false;
    let intervalId: ReturnType<typeof setInterval> | undefined;

    const sendLocation = async () => {
      try {
        const { coords } = await Location.getCurrentPositionAsync({});
        await api.domiciliarios.actualizarUbicacion(coords.latitude, coords.longitude);
      } catch {
        // Sin señal GPS o sin red en este momento — se reintenta en el siguiente tick
      }
    };

    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (cancelled) return;
      if (status !== 'granted') {
        Toast.show({
          type: 'info',
          text1: 'Ubicación desactivada',
          text2: 'El despachador no podrá ver dónde estás',
        });
        return;
      }
      void sendLocation();
      intervalId = setInterval(sendLocation, LOCATION_UPDATE_INTERVAL_MS);
    })();

    return () => {
      cancelled = true;
      if (intervalId) clearInterval(intervalId);
    };
  }, []);
}

// ─── LOGIN SCREEN ─────────────────────────────────────────────────────────────

function LoginScreen() {
  const { login } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!username || !password) {
      Toast.show({ type: 'error', text1: 'Error', text2: 'Ingresa usuario y contraseña' });
      return;
    }
    setLoading(true);
    try {
      await login(username, password);
      // Wait a bit to let context update
    } catch (err) {
      Toast.show({ type: 'error', text1: 'Error', text2: 'Credenciales inválidas' });
      setLoading(false);
    }
  };

  return (
    <View style={styles.loginContainer}>
      <Text style={styles.title}>RiderApp</Text>
      <Text style={styles.subtitle}>Inicia sesión para ver tus domicilios</Text>

      <TextInput
        style={styles.input}
        placeholder="Usuario"
        placeholderTextColor="#94A3B8"
        value={username}
        onChangeText={setUsername}
        autoCapitalize="none"
      />
      <TextInput
        style={styles.input}
        placeholder="Contraseña"
        placeholderTextColor="#94A3B8"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
      />

      <Pressable style={({pressed}) => [styles.button, pressed && {opacity: 0.5}]} onPress={handleLogin}
        disabled={loading}
      >
        {loading ? (
          <ActivityIndicator color="#000" />
        ) : (
          <Text style={styles.buttonText}>INGRESAR</Text>
        )}
      </Pressable>
    </View>
  );
}

// ─── DASHBOARD SCREEN ─────────────────────────────────────────────────────────

// Hoisted: no capturan nada del componente, así no se recrean por render
const COP_FORMATTER = new Intl.NumberFormat('es-CO');

const copyToClipboard = async (text: string) => {
  await Clipboard.setStringAsync(text);
  Toast.show({ type: 'success', text1: 'Copiado', text2: text });
};

const DomicilioCard = React.memo(function DomicilioCard({ item }: { item: Domicilio }) {
  const isPagado = item.factura?.estado === 'pagado' || item.factura?.estado === 'pagada';

  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <Text style={styles.orderId}>#{item.orden?.ordenId || item.domicilioId}</Text>
        <Text style={styles.clientName}>{item.cliente?.clienteNombre || item.factura?.clienteNombre || 'Sin nombre'}</Text>
      </View>

      <View style={styles.infoRow}>
        <Text style={styles.label}>Dirección:</Text>
        <View style={styles.infoRowValueContainer}>
          <Text style={styles.value} numberOfLines={2}>{item.direccionEntrega || 'N/A'}</Text>
        </View>
        <Pressable onPress={() => copyToClipboard(item.direccionEntrega || '')} style={({pressed}) => [styles.copyBtn, pressed && {opacity: 0.5}]}>
          <Text style={styles.copyText}>Copiar</Text>
        </Pressable>
      </View>

      {item.referenciaDomicilio ? (
        <View style={styles.infoRow}>
          <Text style={styles.label}>Ref:</Text>
          <View style={styles.infoRowValueContainer}>
            <Text style={styles.value} numberOfLines={2}>{item.referenciaDomicilio}</Text>
          </View>
          <Pressable onPress={() => copyToClipboard(item.referenciaDomicilio)} style={({pressed}) => [styles.copyBtn, pressed && {opacity: 0.5}]}>
            <Text style={styles.copyText}>Copiar</Text>
          </Pressable>
        </View>
      ) : null}

      <View style={styles.infoRow}>
        <Text style={styles.label}>Teléfono:</Text>
        <Text style={styles.value}>{item.telefono || 'N/A'}</Text>
        {item.telefono ? (
          <Pressable onPress={() => copyToClipboard(item.telefono)} style={({pressed}) => [styles.copyBtn, pressed && {opacity: 0.5}]}>
            <Text style={styles.copyText}>Copiar</Text>
          </Pressable>
        ) : null}
      </View>

      {item.latitud && item.longitud ? (
        <Pressable style={({pressed}) => [styles.mapButton, pressed && {opacity: 0.5}]} onPress={() => {
            const lat = item.latitud;
            const lng = item.longitud;
            const addr = item.direccionEntrega || 'Entrega';
            const scheme = Platform.select({
              ios: `maps:0,0?q=${lat},${lng}(${addr})`,
              android: `geo:0,0?q=${lat},${lng}(${addr})`
            });
            const webUrl = `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
            
            if (scheme) {
              Linking.canOpenURL(scheme)
                .then((supported) => Linking.openURL(supported ? scheme : webUrl))
                .catch(() => Linking.openURL(webUrl).catch(() => {}));
            } else {
              Linking.openURL(webUrl).catch(() => {});
            }
          }}
        >
          <Text style={styles.buttonText}>📍 IR A GOOGLE MAPS</Text>
        </Pressable>
      ) : null}

      <View style={styles.divider} />

      <View style={styles.priceRow}>
        <View>
          <Text style={styles.label}>Total a cobrar:</Text>
          {isPagado ? (
            <Text style={styles.paidText}>PAGADO</Text>
          ) : (
            <Text style={styles.pendingText}>PENDIENTE</Text>
          )}
        </View>
        <Text style={styles.totalPrice}>
          ${COP_FORMATTER.format(item.factura?.total || 0)}
        </Text>
      </View>
    </View>
  );
});

function DashboardScreen() {
  const { user, logout } = useAuth();
  useLocationTracking();
  const [domicilios, setDomicilios] = useState<Domicilio[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchDomicilios = useCallback(async () => {
    try {
      // getMe() fetches assigned to me
      const data = await api.domicilios.getMe();
      setDomicilios(data);
    } catch (error) {
      Toast.show({ type: 'error', text1: 'Error', text2: 'No se pudieron cargar los domicilios' });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchDomicilios();
  }, [fetchDomicilios]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchDomicilios();
  };

  const renderItem = useCallback(({ item }: { item: Domicilio }) => {
    return <DomicilioCard item={item} />;
  }, []);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Mis Entregas</Text>
          <Text style={styles.headerUser}>{user?.name || user?.username}</Text>
        </View>
        <Pressable onPress={logout} style={({pressed}) => [styles.logoutBtn, pressed && {opacity: 0.5}]}>
          <Text style={styles.logoutText}>Salir</Text>
        </Pressable>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#F5A524" />
        </View>
      ) : (
        <FlashList
          data={domicilios}
          keyExtractor={item => String(item.domicilioId)}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#F5A524" />
          }
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyText}>No tienes entregas asignadas</Text>
            </View>
          }
        />
      )}
    </View>
  );
}

// ─── MAIN APP WRAPPER ─────────────────────────────────────────────────────────

function Main() {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <View style={[styles.container, styles.center]}>
        <ActivityIndicator size="large" color="#F5A524" />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor="#0F172A" />
      {user ? <DashboardScreen /> : <LoginScreen />}
      <Toast />
    </SafeAreaView>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <Main />
      </AuthProvider>
    </SafeAreaProvider>
  );
}

// ─── STYLES ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#0F172A',
  },
  infoRowValueContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  mapButton: {
    backgroundColor: '#F5A524',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 12,
    marginBottom: 8,
    flexDirection: 'row',
    justifyContent: 'center',
  },
  container: {
    flex: 1,
    backgroundColor: '#0F172A',
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loginContainer: {
    flex: 1,
    justifyContent: 'center',
    padding: 24,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#F8FAFC',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    color: '#94A3B8',
    marginBottom: 32,
    textAlign: 'center',
  },
  input: {
    backgroundColor: '#1E293B',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    color: '#F8FAFC',
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#334155',
  },
  button: {
    backgroundColor: '#F5A524',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 8,
  },
  buttonText: {
    color: '#000',
    fontWeight: 'bold',
    fontSize: 16,
    letterSpacing: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#1E293B',
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#F8FAFC',
  },
  headerUser: {
    fontSize: 12,
    color: '#94A3B8',
    marginTop: 2,
  },
  logoutBtn: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    backgroundColor: '#334155',
    borderRadius: 8,
  },
  logoutText: {
    color: '#F8FAFC',
    fontSize: 12,
    fontWeight: 'bold',
  },
  list: {
    padding: 16,
    gap: 16,
  },
  card: {
    backgroundColor: '#1E293B',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#334155',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    gap: 8,
  },
  orderId: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#F5A524',
  },
  clientName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#F8FAFC',
    flex: 1,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  label: {
    width: 70,
    color: '#94A3B8',
    fontSize: 13,
    marginTop: 2,
  },
  value: {
    flex: 1,
    color: '#E2E8F0',
    fontSize: 14,
    lineHeight: 20,
  },
  copyBtn: {
    marginLeft: 8,
    paddingVertical: 4,
    paddingHorizontal: 10,
    backgroundColor: '#334155',
    borderRadius: 6,
  },
  copyText: {
    color: '#38BDF8',
    fontSize: 12,
    fontWeight: 'bold',
  },
  divider: {
    height: 1,
    backgroundColor: '#334155',
    marginVertical: 12,
  },
  priceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  paidText: {
    color: '#10B981',
    fontSize: 11,
    fontWeight: 'bold',
    marginTop: 2,
  },
  pendingText: {
    color: '#F43F5E',
    fontSize: 11,
    fontWeight: 'bold',
    marginTop: 2,
  },
  totalPrice: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#F8FAFC',
  },
  empty: {
    padding: 40,
    alignItems: 'center',
  },
  emptyText: {
    color: '#64748B',
    fontSize: 16,
  },
});
