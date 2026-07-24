import React, { useEffect, useState, useCallback } from 'react';
import {
  StyleSheet, Text, View, TextInput, Pressable,
  ActivityIndicator, RefreshControl,
  StatusBar, Platform, Linking, PermissionsAndroid
} from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import Toast from 'react-native-toast-message';
import * as Clipboard from 'expo-clipboard';
import * as Location from 'expo-location';
import * as SecureStore from 'expo-secure-store';
import { AuthProvider, ToastProvider, useAuth, useOrdenesSocket, api, Domicilio, normalizePhone, toDialablePhone, formatPhoneDisplay } from '@/src/shared';
import { ErrorBoundary } from './src/components/ErrorBoundary';

// ─── Tracking de ubicación ────────────────────────────────────────────────────
// Reporta la posición del domiciliario cada 3 minutos usando la API de
// ubicación en segundo plano de expo-location — sigue funcionando con la
// pantalla bloqueada o la app minimizada (a diferencia de un setInterval de JS,
// que Android/iOS pausan en cuanto la app deja de estar en primer plano).
// En Android esto requiere un foreground service con notificación persistente
// (obligatoria por el sistema, no se puede ocultar) y que el domiciliario
// active "Permitir todo el tiempo" en Ajustes (Android 11+ ya no lo pregunta
// dentro de la app, solo en Ajustes del sistema).

import { LOCATION_TASK_NAME, LOCATION_UPDATE_INTERVAL_MS } from './src/tasks/locationTask';

// Android 13+ (API 33+) exige el permiso POST_NOTIFICATIONS para poder
// mostrar CUALQUIER notificación — incluida la del foreground service de
// ubicación. Sin este permiso, arrancar el servicio puede fallar o crashear
// en algunos fabricantes/versiones en vez de solo omitir la notificación.
async function ensureNotificationPermission(): Promise<void> {
  if (Platform.OS !== 'android' || Platform.Version < 33) return;
  try {
    await PermissionsAndroid.request(
      // @ts-ignore — constante presente en runtime aunque el tipo de esta
      // versión de react-native aún no la incluya
      PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS,
    );
  } catch {
    // Si falla la solicitud, seguimos igual — el location tracking en sí
    // no depende de que el usuario acepte ver la notificación.
  }
}

// El tracking en segundo plano es "nice to have": si algo native-side falla
// (versión de Android, fabricante, permisos denegados) NUNCA debe tumbar el
// resto de la app — todo el flujo queda blindado con try/catch de punta a punta.
function useLocationTracking() {
  useEffect(() => {
    let cancelled = false;
    let timeoutId: ReturnType<typeof setTimeout> | undefined;

    const start = async () => {
      try {
        const fg = await Location.requestForegroundPermissionsAsync();
        if (cancelled) return;
        if (fg.status !== 'granted') {
          Toast.show({
            type: 'info',
            text1: 'Ubicación desactivada',
            text2: 'El despachador no podrá ver dónde estás',
          });
          return;
        }

        await ensureNotificationPermission();
        if (cancelled) return;

        const bg = await Location.requestBackgroundPermissionsAsync();
        if (cancelled) return;
        if (bg.status !== 'granted') {
          Toast.show({
            type: 'info',
            text1: 'Ubicación solo en primer plano',
            text2: 'Activa "Permitir todo el tiempo" en Ajustes para que funcione con la pantalla bloqueada',
          });
          // Importante: No iniciar startLocationUpdatesAsync si no tenemos los permisos de background, 
          // ya que en Android 14 esto causa un SecurityException fatal que tumba la app instantáneamente.
          return;
        }

        const yaIniciado = await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK_NAME).catch(() => false);
        if (cancelled || yaIniciado) return;

        await Location.startLocationUpdatesAsync(LOCATION_TASK_NAME, {
          accuracy: Location.Accuracy.High,
          timeInterval: LOCATION_UPDATE_INTERVAL_MS,
          // Si el rider recorre 50m antes de que venzan los 20s, reportar de
          // inmediato — en moto/bici esto se dispara bastante seguido.
          distanceInterval: 50,
          showsBackgroundLocationIndicator: true,
          // ── iOS ────────────────────────────────────────────────────────
          // Evita que iOS pause los updates cuando detecta que el usuario
          // "no se está moviendo" — en entregas hay paradas constantes
          // (esperando el pedido, en el ascensor, etc.) y queremos que
          // el tracking siga reportando aún en esos momentos.
          pausesUpdatesAutomatically: false,
          activityType: Location.ActivityType.AutomotiveNavigation,
          // ── Android ────────────────────────────────────────────────────
          foregroundService: {
            notificationTitle: 'Dfiru Riders',
            notificationBody: 'Compartiendo tu ubicación en tiempo real',
            notificationColor: '#F5A524',
            // Android mantiene el foreground service vivo incluso si el
            // usuario mata la app desde recientes — así el tracking no
            // para hasta que el domiciliario cierre sesión.
            killServiceOnDestroy: false,
          },
        });
      } catch (err: any) {
        // Cualquier fallo aquí (permiso, servicio nativo, fabricante) se
        // registra pero jamás debe propagarse — la app sigue funcionando
        // sin rastreo de ubicación en vez de crashear.
        console.warn('[LocationTask] no se pudo iniciar el tracking:', err?.message ?? err);
      }
    };

    // Pequeño retraso: evita competir con el resto de llamadas nativas que
    // se disparan justo al montar DashboardScreen (fetch inicial, socket).
    timeoutId = setTimeout(() => { void start(); }, 1500);

    return () => {
      cancelled = true;
      if (timeoutId) clearTimeout(timeoutId);
      // Se detiene al cerrar sesión (DashboardScreen solo se desmonta en logout;
      // bloquear la pantalla NO desmonta el componente, así que el tracking
      // sigue corriendo en background hasta que el domiciliario cierre sesión).
      Location.stopLocationUpdatesAsync(LOCATION_TASK_NAME).catch(() => {});
    };
  }, []);
}

// ─── Credenciales recordadas ───────────────────────────────────────────────────
// Guardadas en Keychain/Keystore (no AsyncStorage) para no dejar la contraseña
// en texto plano. Persisten entre sesiones — cerrar sesión no las borra, solo
// un login exitoso distinto las sobreescribe.

const CRED_USERNAME_KEY = 'dfiru_rider_username';
const CRED_PASSWORD_KEY = 'dfiru_rider_password';

// ─── LOGIN SCREEN ─────────────────────────────────────────────────────────────

function LoginScreen() {
  const { login } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  // Prellena con las credenciales recordadas de la última sesión, si existen
  useEffect(() => {
    (async () => {
      try {
        const [savedUsername, savedPassword] = await Promise.all([
          SecureStore.getItemAsync(CRED_USERNAME_KEY),
          SecureStore.getItemAsync(CRED_PASSWORD_KEY),
        ]);
        if (savedUsername) setUsername(savedUsername);
        if (savedPassword) setPassword(savedPassword);
      } catch {
        // Sin acceso al almacenamiento seguro (raro) — el domiciliario solo
        // tendrá que escribir sus credenciales de nuevo
      }
    })();
  }, []);

  const handleLogin = async () => {
    if (!username || !password) {
      Toast.show({ type: 'error', text1: 'Error', text2: 'Ingresa usuario y contraseña' });
      return;
    }
    setLoading(true);
    try {
      await login(username, password);
      SecureStore.setItemAsync(CRED_USERNAME_KEY, username).catch(() => {});
      SecureStore.setItemAsync(CRED_PASSWORD_KEY, password).catch(() => {});
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

// Marca con indicativo (+57) aunque el número esté guardado en local.
const callPhone = (telefono: string) => {
  const dialable = toDialablePhone(telefono);
  if (!dialable) return;
  Linking.openURL(`tel:${dialable}`).catch(() => {
    Toast.show({ type: 'error', text1: 'No se pudo abrir el marcador' });
  });
};

const ESTADOS_ENTREGADO = ['entregado', 'completado', 'completada'];
const isEntregado = (estado?: string) => ESTADOS_ENTREGADO.includes((estado || '').toLowerCase());

function getProductLabel(p: { producto?: string; productoNombre?: string; cantidad: number; sabores?: string[] }): string {
  const nombre = p.productoNombre?.trim() || p.producto?.trim() || 'Producto';
  const sabores = p.sabores?.length ? ` (${p.sabores.join(', ')})` : '';
  return `${p.cantidad}× ${nombre}${sabores}`;
}

const DomicilioCard = React.memo(function DomicilioCard({
  item,
  onComplete,
  confirming,
  onConfirm,
  onCancel,
  loading,
}: {
  item: Domicilio;
  onComplete: () => void;
  confirming: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  loading: boolean;
}) {
  const isPagado = item.factura?.estado === 'pagado' || item.factura?.estado === 'pagada';
  const entregado = isEntregado(item.estadoDomicilio);
  const productos = item.orden?.productos ?? [];
  // El número puede venir guardado con indicativo desde pedidos viejos — se
  // muestra y se copia siempre en local (10 dígitos); el +57 solo se añade al
  // marcar.
  const telefonoLocal = normalizePhone(item.telefono);

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
        <Text style={styles.value}>{telefonoLocal ? formatPhoneDisplay(telefonoLocal) : 'N/A'}</Text>
        {telefonoLocal ? (
          <>
            <Pressable onPress={() => callPhone(telefonoLocal)} style={({pressed}) => [styles.callBtn, pressed && {opacity: 0.5}]}>
              <Text style={styles.callText}>Llamar</Text>
            </Pressable>
            <Pressable onPress={() => copyToClipboard(telefonoLocal)} style={({pressed}) => [styles.copyBtn, pressed && {opacity: 0.5}]}>
              <Text style={styles.copyText}>Copiar</Text>
            </Pressable>
          </>
        ) : null}
      </View>

      {productos.length > 0 ? (
        <View style={styles.productsBox}>
          <Text style={styles.productsTitle}>Productos</Text>
          {productos.map((p, idx) => (
            <Text key={p.id ?? idx} style={styles.productLine} numberOfLines={1}>
              · {getProductLabel(p)}
            </Text>
          ))}
        </View>
      ) : null}

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

      {entregado ? (
        <View style={styles.entregadoBox}>
          <Text style={styles.entregadoText}>✓ DOMICILIO ENTREGADO</Text>
        </View>
      ) : confirming ? (
        <View style={styles.confirmRow}>
          <Pressable
            style={({ pressed }) => [styles.confirmNoBtn, pressed && { opacity: 0.5 }]}
            onPress={onCancel}
            disabled={loading}
          >
            <Text style={styles.confirmNoText}>No</Text>
          </Pressable>
          <Pressable
            style={({ pressed }) => [styles.confirmYesBtn, pressed && { opacity: 0.5 }]}
            onPress={onConfirm}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#000" size="small" />
            ) : (
              <Text style={styles.confirmYesText}>Sí, Entregado</Text>
            )}
          </Pressable>
        </View>
      ) : (
        <Pressable
          style={({ pressed }) => [styles.completeBtn, pressed && { opacity: 0.5 }]}
          onPress={onComplete}
        >
          <Text style={styles.buttonText}>✅ DOMICILIO ENTREGADO</Text>
        </Pressable>
      )}
    </View>
  );
});

function DashboardScreen({ onOpenSettings }: { onOpenSettings: () => void }) {
  const { user, token, logout } = useAuth();
  useLocationTracking();
  const [domicilios, setDomicilios] = useState<Domicilio[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [confirmingId, setConfirmingId] = useState<number | null>(null);
  const [completingId, setCompletingId] = useState<number | null>(null);
  const [tab, setTab] = useState<'pendientes' | 'completadas'>('pendientes');

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

  // Auto-refresca cuando el POS asigna/actualiza un domicilio o cambia una
  // orden — el domiciliario ya no depende de pull-to-refresh manual.
  useOrdenesSocket(api.http.defaults.baseURL || '', 'domiciliario', fetchDomicilios, token);

  const onRefresh = () => {
    setRefreshing(true);
    fetchDomicilios();
  };

  const handleComplete = useCallback(async (domicilioId: number) => {
    setCompletingId(domicilioId);
    try {
      await api.domicilios.update(domicilioId, { estadoDomicilio: 'entregado' });
      Toast.show({ type: 'success', text1: '¡Domicilio entregado!', text2: 'Buen trabajo 🎉' });
      setConfirmingId(null);
      await fetchDomicilios();
    } catch {
      Toast.show({ type: 'error', text1: 'Error', text2: 'No se pudo actualizar el domicilio' });
    } finally {
      setCompletingId(null);
    }
  }, [fetchDomicilios]);

  const renderItem = useCallback(({ item }: { item: Domicilio }) => {
    return (
      <DomicilioCard
        item={item}
        onComplete={() => setConfirmingId(item.domicilioId)}
        confirming={confirmingId === item.domicilioId}
        onConfirm={() => handleComplete(item.domicilioId)}
        onCancel={() => setConfirmingId(null)}
        loading={completingId === item.domicilioId}
      />
    );
  }, [confirmingId, completingId, handleComplete]);

  const pendientes = domicilios.filter(d => !isEntregado(d.estadoDomicilio));
  const completadas = domicilios.filter(d => isEntregado(d.estadoDomicilio));
  const listData = tab === 'pendientes' ? pendientes : completadas;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Mis Entregas</Text>
          <Text style={styles.headerUser}>{user?.name || user?.username}</Text>
        </View>
        <View style={styles.headerActions}>
          <Pressable onPress={onOpenSettings} style={({pressed}) => [styles.settingsBtn, pressed && {opacity: 0.5}]}>
            <Text style={styles.settingsText}>⚙️</Text>
          </Pressable>
          <Pressable onPress={logout} style={({pressed}) => [styles.logoutBtn, pressed && {opacity: 0.5}]}>
            <Text style={styles.logoutText}>Salir</Text>
          </Pressable>
        </View>
      </View>

      <View style={styles.tabBar}>
        <Pressable
          style={[styles.tabBtn, tab === 'pendientes' && styles.tabBtnActive]}
          onPress={() => setTab('pendientes')}
        >
          <Text style={[styles.tabText, tab === 'pendientes' && styles.tabTextActive]}>
            Pendientes ({pendientes.length})
          </Text>
        </Pressable>
        <Pressable
          style={[styles.tabBtn, tab === 'completadas' && styles.tabBtnActive]}
          onPress={() => setTab('completadas')}
        >
          <Text style={[styles.tabText, tab === 'completadas' && styles.tabTextActive]}>
            Completadas ({completadas.length})
          </Text>
        </Pressable>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#F5A524" />
        </View>
      ) : (
        <FlashList
          data={listData}
          keyExtractor={item => String(item.domicilioId)}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#F5A524" />
          }
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyText}>
                {tab === 'pendientes' ? 'No tienes entregas pendientes' : 'Aún no has completado entregas hoy'}
              </Text>
            </View>
          }
        />
      )}
    </View>
  );
}

// ─── SETTINGS SCREEN ────────────────────────────────────────────────────────────

function SettingsScreen({ onClose }: { onClose: () => void }) {
  const [fgStatus, setFgStatus] = useState<Location.PermissionStatus | null>(null);
  const [bgStatus, setBgStatus] = useState<Location.PermissionStatus | null>(null);

  useEffect(() => {
    Location.getForegroundPermissionsAsync().then(res => setFgStatus(res.status));
    Location.getBackgroundPermissionsAsync().then(res => setBgStatus(res.status));
  }, []);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Pressable onPress={onClose} style={({pressed}) => [styles.backBtn, pressed && {opacity: 0.5}]}>
          <Text style={styles.backBtnText}>← Volver</Text>
        </Pressable>
        <Text style={styles.headerTitle}>Ajustes</Text>
        <View style={{ width: 60 }} />
      </View>
      
      <View style={styles.list}>
        <Text style={styles.settingsSectionTitle}>Permisos de Ubicación</Text>
        <View style={styles.card}>
          <View style={styles.infoRow}>
            <Text style={styles.label}>Primer plano:</Text>
            <Text style={[styles.value, fgStatus === 'granted' ? styles.paidText : styles.pendingText]}>
              {fgStatus === 'granted' ? 'Concedido' : fgStatus === 'denied' ? 'Denegado' : 'No solicitado'}
            </Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.label}>Segundo plano:</Text>
            <Text style={[styles.value, bgStatus === 'granted' ? styles.paidText : styles.pendingText]}>
              {bgStatus === 'granted' ? 'Concedido (Permitir todo el tiempo)' : bgStatus === 'denied' ? 'Denegado / Solo en uso' : 'No solicitado'}
            </Text>
          </View>
          
          <Text style={styles.settingsHelpText}>
            Para que el despacho sepa dónde estás con la pantalla apagada, necesitas seleccionar "Permitir todo el tiempo" en los ajustes del sistema.
          </Text>

          <Pressable 
            style={({pressed}) => [styles.completeBtn, { marginTop: 20 }, pressed && {opacity: 0.5}]} 
            onPress={() => Linking.openSettings()}
          >
            <Text style={styles.buttonText}>ABRIR AJUSTES DEL SISTEMA</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

// ─── MAIN APP WRAPPER ─────────────────────────────────────────────────────────

function Main() {
  const { user, isLoading } = useAuth();
  const [showSettings, setShowSettings] = useState(false);

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
      {user ? (
        showSettings ? <SettingsScreen onClose={() => setShowSettings(false)} /> : <DashboardScreen onOpenSettings={() => setShowSettings(true)} />
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
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  settingsBtn: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    backgroundColor: '#334155',
    borderRadius: 8,
  },
  settingsText: {
    fontSize: 14,
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
  backBtn: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    backgroundColor: '#334155',
    borderRadius: 8,
    minWidth: 60,
  },
  backBtnText: {
    color: '#F8FAFC',
    fontSize: 12,
    fontWeight: 'bold',
  },
  settingsSectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#F8FAFC',
    marginBottom: 12,
    marginLeft: 4,
  },
  settingsHelpText: {
    color: '#94A3B8',
    fontSize: 13,
    lineHeight: 20,
    marginTop: 16,
    fontStyle: 'italic',
  },
  tabBar: {
    flexDirection: 'row',
    gap: 8,
    padding: 12,
    backgroundColor: '#1E293B',
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
  },
  tabBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
    backgroundColor: '#0F172A',
  },
  tabBtnActive: {
    backgroundColor: '#F5A524',
  },
  tabText: {
    color: '#94A3B8',
    fontWeight: 'bold',
    fontSize: 12,
  },
  tabTextActive: {
    color: '#000',
  },
  list: {
    padding: 16,
  },
  card: {
    backgroundColor: '#1E293B',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#334155',
    marginBottom: 16,
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
  callBtn: {
    marginLeft: 8,
    paddingVertical: 4,
    paddingHorizontal: 10,
    backgroundColor: 'rgba(16,185,129,0.15)',
    borderRadius: 6,
  },
  callText: {
    color: '#10B981',
    fontSize: 12,
    fontWeight: 'bold',
  },
  productsBox: {
    backgroundColor: '#0F172A',
    borderRadius: 10,
    padding: 10,
    marginBottom: 12,
  },
  productsTitle: {
    color: '#64748B',
    fontSize: 10,
    fontWeight: 'bold',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  productLine: {
    color: '#E2E8F0',
    fontSize: 13,
    lineHeight: 19,
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
  completeBtn: {
    backgroundColor: '#10B981',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 14,
  },
  entregadoBox: {
    backgroundColor: 'rgba(16,185,129,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(16,185,129,0.3)',
    borderRadius: 12,
    padding: 14,
    alignItems: 'center',
    marginTop: 14,
  },
  entregadoText: {
    color: '#10B981',
    fontWeight: 'bold',
    fontSize: 13,
    letterSpacing: 1,
  },
  confirmRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 14,
  },
  confirmNoBtn: {
    flex: 1,
    backgroundColor: '#334155',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  confirmNoText: {
    color: '#94A3B8',
    fontWeight: 'bold',
    fontSize: 14,
  },
  confirmYesBtn: {
    flex: 2,
    backgroundColor: '#10B981',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  confirmYesText: {
    color: '#000',
    fontWeight: 'bold',
    fontSize: 14,
  },
});
