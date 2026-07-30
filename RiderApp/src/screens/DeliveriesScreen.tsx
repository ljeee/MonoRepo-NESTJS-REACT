import React, { useCallback, useEffect, useState } from 'react';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import {
  ActivityIndicator,
  Linking,
  Platform,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { FlashList } from '@shopify/flash-list';
import * as Clipboard from 'expo-clipboard';
import Toast from 'react-native-toast-message';
import {
  api,
  useAuth,
  useOrdenesSocket,
  formatPhoneDisplay,
  normalizePhone,
  toDialablePhone,
  type Domicilio,
} from '@/src/shared';

import { ActionButton, Card, ChipButton, Divider, InfoRow, Pill } from '../components/ui';
import { colors, radius, shadow, text } from '../lib/theme';

const COP = new Intl.NumberFormat('es-CO');

const ESTADOS_ENTREGADO = ['entregado', 'completado', 'completada'];
const isEntregado = (estado?: string) => ESTADOS_ENTREGADO.includes((estado || '').toLowerCase());

async function copy(label: string, value: string) {
  await Clipboard.setStringAsync(value);
  Toast.show({ type: 'success', text1: `${label} copiada`, text2: value });
}

function callPhone(telefono: string) {
  const dialable = toDialablePhone(telefono);
  if (!dialable) return;
  Linking.openURL(`tel:${dialable}`).catch(() =>
    Toast.show({ type: 'error', text1: 'No se pudo abrir el marcador' }),
  );
}

function openMaps(lat: number, lng: number, addr: string) {
  const scheme = Platform.select({
    ios: `maps:0,0?q=${lat},${lng}(${addr})`,
    android: `geo:0,0?q=${lat},${lng}(${addr})`,
  });
  const web = `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
  if (!scheme) {
    Linking.openURL(web).catch(() => {});
    return;
  }
  Linking.canOpenURL(scheme)
    .then((ok) => Linking.openURL(ok ? scheme : web))
    .catch(() => Linking.openURL(web).catch(() => {}));
}

function productLabel(p: { producto?: string; productoNombre?: string; cantidad: number; sabores?: string[] }) {
  const nombre = p.productoNombre?.trim() || p.producto?.trim() || 'Producto';
  const sabores = p.sabores?.length ? ` (${p.sabores.join(', ')})` : '';
  return `${p.cantidad}× ${nombre}${sabores}`;
}

// ─── Tarjeta de domicilio ─────────────────────────────────────────────────────

const DomicilioCard = React.memo(function DomicilioCard({
  item,
  confirming,
  loading,
  onAskComplete,
  onConfirm,
  onCancel,
}: {
  item: Domicilio;
  confirming: boolean;
  loading: boolean;
  onAskComplete: () => void;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const pagado = item.factura?.estado === 'pagado' || item.factura?.estado === 'pagada';
  const entregado = isEntregado(item.estadoDomicilio);
  const productos = item.orden?.productos ?? [];
  const telefono = normalizePhone(item.telefono);
  const direccion = item.direccionEntrega || 'Sin dirección';

  return (
    <Card style={styles.card}>
      {/* Cabecera */}
      <View style={styles.head}>
        <View style={styles.orderChip}>
          <Text style={styles.orderChipText}>#{item.orden?.ordenId || item.domicilioId}</Text>
        </View>
        <Text style={styles.client} numberOfLines={1}>
          {item.cliente?.clienteNombre || item.factura?.clienteNombre || 'Sin nombre'}
        </Text>
        <Pill
          label={pagado ? 'Pagado' : 'Por cobrar'}
          tone={pagado ? 'success' : 'warn'}
          icon={pagado ? 'check-decagram' : 'cash-clock'}
        />
      </View>

      <Divider />

      {/* Datos de entrega */}
      <View style={styles.body}>
        <InfoRow icon="map-marker-outline" label="Dirección" value={direccion}>
          <ChipButton label="Copiar" icon="content-copy" onPress={() => copy('Dirección', direccion)} />
          {item.latitud && item.longitud ? (
            <ChipButton
              label="Ver mapa"
              icon="navigation-variant-outline"
              tone="info"
              onPress={() => openMaps(item.latitud!, item.longitud!, direccion)}
            />
          ) : null}
        </InfoRow>

        {item.referenciaDomicilio ? (
          <InfoRow icon="information-outline" label="Referencia" value={item.referenciaDomicilio} />
        ) : null}

        {telefono ? (
          <InfoRow icon="phone-outline" label="Teléfono" value={formatPhoneDisplay(telefono)}>
            <ChipButton label="Llamar" icon="phone" tone="success" onPress={() => callPhone(telefono)} />
            <ChipButton label="Copiar" icon="content-copy" onPress={() => copy('Teléfono', telefono)} />
          </InfoRow>
        ) : null}

        {productos.length > 0 ? (
          <View style={styles.products}>
            <Text style={styles.productsTitle}>Pedido</Text>
            {productos.map((p, i) => (
              <Text key={p.id ?? i} style={styles.productLine} numberOfLines={2}>
                · {productLabel(p)}
              </Text>
            ))}
          </View>
        ) : null}
      </View>

      {/* Total + acción */}
      <View style={styles.foot}>
        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>Total a cobrar</Text>
          <Text style={[styles.total, pagado && { color: colors.success }]}>
            ${COP.format(item.factura?.total || 0)}
          </Text>
        </View>

        {entregado ? (
          <View style={styles.doneBox}>
            <MaterialCommunityIcons name="check-circle" size={16} color={colors.success} />
            <Text style={styles.doneText}>Entregado</Text>
          </View>
        ) : confirming ? (
          <View style={styles.confirmRow}>
            <ActionButton
              label="Cancelar"
              tone="neutral"
              onPress={onCancel}
              disabled={loading}
              style={{ flex: 1 }}
            />
            <ActionButton
              label={loading ? 'Guardando…' : 'Sí, entregado'}
              icon={loading ? undefined : 'check-bold'}
              tone="success"
              onPress={onConfirm}
              disabled={loading}
              style={{ flex: 1.6 }}
            />
          </View>
        ) : (
          <ActionButton label="Marcar entregado" icon="check-bold" tone="success" onPress={onAskComplete} />
        )}
      </View>
    </Card>
  );
});

// ─── Pantalla ─────────────────────────────────────────────────────────────────

export function DeliveriesScreen({ onCountChange }: { onCountChange?: (pendientes: number) => void }) {
  const { user, token } = useAuth();
  const [domicilios, setDomicilios] = useState<Domicilio[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [confirmingId, setConfirmingId] = useState<number | null>(null);
  const [completingId, setCompletingId] = useState<number | null>(null);
  const [tab, setTab] = useState<'pendientes' | 'completadas'>('pendientes');

  const fetchDomicilios = useCallback(async () => {
    try {
      const data = await api.domicilios.getMe();
      setDomicilios(Array.isArray(data) ? data : []);
    } catch {
      Toast.show({ type: 'error', text1: 'Sin conexión', text2: 'No se pudieron cargar tus domicilios' });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchDomicilios();
  }, [fetchDomicilios]);

  // Auto-refresca cuando el POS asigna o actualiza un domicilio.
  useOrdenesSocket(api.http.defaults.baseURL || '', 'domiciliario', fetchDomicilios, token);

  const pendientes = domicilios.filter((d) => !isEntregado(d.estadoDomicilio));
  const completadas = domicilios.filter((d) => isEntregado(d.estadoDomicilio));
  const data = tab === 'pendientes' ? pendientes : completadas;

  useEffect(() => {
    onCountChange?.(pendientes.length);
  }, [pendientes.length, onCountChange]);

  const handleComplete = useCallback(
    async (domicilioId: number) => {
      setCompletingId(domicilioId);
      try {
        await api.domicilios.update(domicilioId, { estadoDomicilio: 'entregado' });
        Toast.show({ type: 'success', text1: '¡Entregado!', text2: 'Buen trabajo 🎉' });
        setConfirmingId(null);
        await fetchDomicilios();
      } catch {
        Toast.show({ type: 'error', text1: 'Error', text2: 'No se pudo marcar como entregado' });
      } finally {
        setCompletingId(null);
      }
    },
    [fetchDomicilios],
  );

  const renderItem = useCallback(
    ({ item }: { item: Domicilio }) => (
      <DomicilioCard
        item={item}
        confirming={confirmingId === item.domicilioId}
        loading={completingId === item.domicilioId}
        onAskComplete={() => setConfirmingId(item.domicilioId)}
        onConfirm={() => handleComplete(item.domicilioId)}
        onCancel={() => setConfirmingId(null)}
      />
    ),
    [confirmingId, completingId, handleComplete],
  );

  return (
    <View style={styles.flex}>
      {/* Cabecera */}
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.hello}>Hola,</Text>
          <Text style={styles.name} numberOfLines={1}>
            {user?.name || user?.username || 'Domiciliario'}
          </Text>
        </View>
        <View style={styles.counter}>
          <Text style={styles.counterNum}>{pendientes.length}</Text>
          <Text style={styles.counterLabel}>pendientes</Text>
        </View>
      </View>

      {/* Segmentado */}
      <View style={styles.segment}>
        {(['pendientes', 'completadas'] as const).map((k) => {
          const on = tab === k;
          const n = k === 'pendientes' ? pendientes.length : completadas.length;
          return (
            <Pressable
              key={k}
              onPress={() => setTab(k)}
              style={[styles.segmentBtn, on && styles.segmentBtnOn]}
            >
              <Text style={[styles.segmentText, on && styles.segmentTextOn]}>
                {k === 'pendientes' ? 'Pendientes' : 'Completadas'} ({n})
              </Text>
            </Pressable>
          );
        })}
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.brand} />
        </View>
      ) : (
        <FlashList
          data={data}
          keyExtractor={(item) => String(item.domicilioId)}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                fetchDomicilios();
              }}
              tintColor={colors.brand}
              colors={[colors.brand]}
            />
          }
          ListEmptyComponent={
            <View style={styles.empty}>
              <View style={styles.emptyIcon}>
                <MaterialCommunityIcons
                  name={tab === 'pendientes' ? 'check-all' : 'clock-outline'}
                  size={34}
                  color={colors.ghost}
                />
              </View>
              <Text style={styles.emptyText}>
                {tab === 'pendientes'
                  ? 'No tienes entregas pendientes'
                  : 'Aún no has completado entregas hoy'}
              </Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 16,
  },
  hello: { color: colors.muted, fontSize: 13, fontWeight: '600' },
  name: { ...text.h1, color: colors.ink, marginTop: 1 },
  counter: {
    alignItems: 'center',
    backgroundColor: 'rgba(245,165,36,0.11)',
    borderWidth: 1,
    borderColor: 'rgba(245,165,36,0.26)',
    borderRadius: radius.md,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  counterNum: { color: colors.brand, fontSize: 22, fontWeight: '900', lineHeight: 24 },
  counterLabel: { ...text.label, color: colors.brand, fontSize: 8.5, opacity: 0.85 },

  segment: {
    flexDirection: 'row',
    gap: 6,
    marginHorizontal: 20,
    marginBottom: 14,
    backgroundColor: colors.bgElevated,
    borderRadius: radius.md,
    padding: 4,
    borderWidth: 1,
    borderColor: colors.hairline,
  },
  segmentBtn: { flex: 1, alignItems: 'center', paddingVertical: 9, borderRadius: radius.sm },
  segmentBtnOn: { backgroundColor: colors.brand, ...shadow.glow },
  segmentText: { color: colors.muted, fontWeight: '800', fontSize: 12 },
  segmentTextOn: { color: colors.onBrand },

  list: { paddingHorizontal: 16, paddingBottom: 26 },

  card: { marginBottom: 14 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 9, padding: 14 },
  orderChip: {
    backgroundColor: 'rgba(245,165,36,0.13)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.sm,
  },
  orderChipText: { color: colors.brand, fontSize: 11.5, fontWeight: '900' },
  client: { flex: 1, color: colors.ink, fontSize: 15.5, fontWeight: '800' },

  body: { padding: 14, gap: 13 },
  products: {
    backgroundColor: colors.bg,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.hairline,
    padding: 11,
  },
  productsTitle: { ...text.label, color: colors.faint, marginBottom: 5 },
  productLine: { color: colors.ink, fontSize: 13, lineHeight: 20 },

  foot: { padding: 14, paddingTop: 0 },
  totalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 13,
  },
  totalLabel: { ...text.label, color: colors.faint },
  total: { color: colors.ink, fontSize: 24, fontWeight: '900', letterSpacing: -0.5 },
  confirmRow: { flexDirection: 'row', gap: 9 },
  doneBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    backgroundColor: colors.successSoft,
    borderWidth: 1,
    borderColor: 'rgba(16,185,129,0.28)',
    borderRadius: radius.md,
    paddingVertical: 13,
  },
  doneText: { color: colors.success, fontWeight: '800', fontSize: 13, letterSpacing: 0.5 },

  empty: { alignItems: 'center', paddingVertical: 70, gap: 16 },
  emptyIcon: {
    width: 74,
    height: 74,
    borderRadius: 26,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.hairline,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: { color: colors.faint, fontSize: 14, fontWeight: '600', textAlign: 'center' },
});
