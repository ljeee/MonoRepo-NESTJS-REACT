import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import {
  ActivityIndicator,
  AppState,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { FlashList } from '@shopify/flash-list';
import Toast from 'react-native-toast-message';
import {
  api,
  useAuth,
  useOrdenesSocket,
  formatPhoneDisplay,
  normalizePhone,
  formatCOP,
  timeAgo,
  type Domicilio,
} from '@/src/shared';

import { ActionButton, Card, Divider, Pill, QuickAction } from '../components/ui';
import { isTrackingRunning } from '../lib/location';
import {
  buildDeliverySummary,
  callPhone,
  copyToClipboard,
  openGoogleMaps,
  openWaze,
  openWhatsApp,
} from '../lib/navigation';
import { colors, radius, text, TWO_COLUMNS_FROM, maxContentWidth } from '../lib/theme';

const ESTADOS_ENTREGADO = ['entregado', 'completado', 'completada'];
const isEntregado = (estado?: string) => ESTADOS_ENTREGADO.includes((estado || '').toLowerCase());

function productLabel(p: { producto?: string; productoNombre?: string; cantidad: number; sabores?: string[] }) {
  const nombre = p.productoNombre?.trim() || p.producto?.trim() || 'Producto';
  const sabores = p.sabores?.length ? ` (${p.sabores.join(', ')})` : '';
  return `${p.cantidad}× ${nombre}${sabores}`;
}

// ─── Tarjeta de domicilio ─────────────────────────────────────────────────────

interface DomicilioCardProps {
  item: Domicilio;
  confirming: boolean;
  loading: boolean;
  onAskComplete: () => void;
  onConfirm: () => void;
  onCancel: () => void;
}

const DomicilioCard = React.memo(function DomicilioCard({
  item,
  confirming,
  loading,
  onAskComplete,
  onConfirm,
  onCancel,
}: DomicilioCardProps) {
  const [expandProducts, setExpandProducts] = useState(false);

  const pagado = item.factura?.estado === 'pagado' || item.factura?.estado === 'pagada';
  const entregado = isEntregado(item.estadoDomicilio);
  const productos = item.orden?.productos ?? [];

  const rawPhone = item.telefono || item.orden?.telefonoCliente || item.factura?.telefonoCliente;
  const telefono = normalizePhone(rawPhone);
  const direccion = (item.direccionEntrega || '').trim() || 'Sin dirección registrada';
  const referencia = (item.referenciaDomicilio || '').trim();
  const observaciones = (item.orden?.observaciones || '').trim();

  const clienteNombre =
    item.cliente?.clienteNombre ||
    item.orden?.nombreCliente ||
    item.factura?.clienteNombre ||
    'Cliente';

  // Coordenadas con validación numérica estricta
  const lat = typeof item.latitud === 'number' ? item.latitud : item.latitud ? parseFloat(String(item.latitud)) : undefined;
  const lng = typeof item.longitud === 'number' ? item.longitud : item.longitud ? parseFloat(String(item.longitud)) : undefined;
  const hasCoords = typeof lat === 'number' && !isNaN(lat) && typeof lng === 'number' && !isNaN(lng) && lat !== 0 && lng !== 0;

  // Tiempo transcurrido de la orden
  const fechaOrden = item.fechaCreado || item.orden?.fechaOrden;
  const tiempoRelativo = fechaOrden ? timeAgo(fechaOrden, 'largo') : null;

  const handleCopySummary = useCallback(() => {
    const summary = buildDeliverySummary(item);
    void copyToClipboard('Ficha completa', summary);
  }, [item]);

  // Mensaje predeterminado de WhatsApp para el cliente
  const greetingWhatsApp = useMemo(() => {
    const saludo = clienteNombre && clienteNombre !== 'Cliente' ? `Hola ${clienteNombre}` : 'Hola';
    const id = item.orden?.ordenId || item.domicilioId;
    return `${saludo}, te escribo de Dfiru. Ya voy en camino con tu pedido #${id} 🛵`;
  }, [clienteNombre, item.domicilioId, item.orden?.ordenId]);

  const visibleProducts = expandProducts ? productos : productos.slice(0, 2);
  const totalFactura = item.factura?.total || 0;
  const metodoPago = item.factura?.metodo;
  const cuentaNombre = item.factura?.cuentaTransferenciaNombre;

  return (
    <Card style={styles.card}>
      {/* ── 1. Cabecera del pedido ── */}
      <View style={styles.cardHeader}>
        <View style={styles.headerLeft}>
          <View style={styles.orderBadge}>
            <MaterialCommunityIcons name="moped" size={14} color={colors.brand} />
            <Text style={styles.orderBadgeText}>
              #{item.orden?.ordenId || item.domicilioId}
            </Text>
          </View>

          {tiempoRelativo && (
            <View style={styles.timePill}>
              <MaterialCommunityIcons name="clock-outline" size={11} color={colors.muted} />
              <Text style={styles.timePillText}>{tiempoRelativo}</Text>
            </View>
          )}
        </View>

        <Pill
          label={pagado ? 'Pagado' : 'Por cobrar'}
          tone={pagado ? 'success' : 'warn'}
          icon={pagado ? 'check-decagram' : 'cash-clock'}
        />
      </View>

      {/* ── Nombre del cliente ── */}
      <View style={styles.clientRow}>
        <View style={styles.clientAvatar}>
          <MaterialCommunityIcons name="account" size={16} color={colors.brand} />
        </View>
        <Text style={styles.clientName} numberOfLines={1}>
          {clienteNombre}
        </Text>
      </View>

      <Divider style={styles.divider} />

      <View style={styles.cardBody}>
        {/* ── 2. Hero: Dirección de entrega y Acciones de Ruta ── */}
        <View style={styles.heroAddressBox}>
          <View style={styles.heroAddressHead}>
            <View style={styles.heroLabelRow}>
              <MaterialCommunityIcons name="map-marker-radius" size={16} color={colors.brand} />
              <Text style={styles.heroAddressLabel}>DIRECCIÓN DE ENTREGA</Text>
            </View>
            {hasCoords ? (
              <View style={styles.coordsBadge}>
                <MaterialCommunityIcons name="crosshairs-gps" size={11} color={colors.info} />
                <Text style={styles.coordsBadgeText}>GPS Exacto</Text>
              </View>
            ) : null}
          </View>

          {/* Dirección en texto grande */}
          <Pressable
            onPress={() => copyToClipboard('Dirección', direccion)}
            style={({ pressed }) => [styles.addressPressable, pressed && styles.pressed]}
            accessibilityRole="button"
            accessibilityLabel={`Copiar dirección: ${direccion}`}
          >
            <Text style={styles.addressText}>{direccion}</Text>
            <MaterialCommunityIcons name="content-copy" size={15} color={colors.faint} style={styles.addressCopyIcon} />
          </Pressable>

          {/* Referencia o punto de entrega */}
          {referencia ? (
            <Pressable
              onPress={() => copyToClipboard('Referencia', referencia)}
              style={({ pressed }) => [styles.referenceBox, pressed && styles.pressed]}
              accessibilityRole="button"
              accessibilityLabel={`Copiar referencia: ${referencia}`}
            >
              <MaterialCommunityIcons name="information-outline" size={15} color={colors.brand} />
              <View style={{ flex: 1 }}>
                <Text style={styles.referenceLabel}>REFERENCIA</Text>
                <Text style={styles.referenceText}>{referencia}</Text>
              </View>
              <MaterialCommunityIcons name="content-copy" size={13} color={colors.faint} />
            </Pressable>
          ) : null}

          {/* Observaciones de cocina / pedido */}
          {observaciones ? (
            <View style={styles.observationBox}>
              <MaterialCommunityIcons name="comment-text-outline" size={14} color={colors.info} />
              <View style={{ flex: 1 }}>
                <Text style={styles.observationLabel}>NOTAS DEL PEDIDO</Text>
                <Text style={styles.observationText}>{observaciones}</Text>
              </View>
            </View>
          ) : null}

          {/* Acciones rápidas de navegación y ficha */}
          <View style={styles.quickRow}>
            <QuickAction
              label="Maps"
              icon="google-maps"
              tone="maps"
              onPress={() => openGoogleMaps(direccion, lat, lng)}
            />
            <QuickAction
              label="Waze"
              icon="waze"
              tone="waze"
              onPress={() => openWaze(direccion, lat, lng)}
            />
            <QuickAction
              label="Copiar dir"
              icon="content-copy"
              tone="neutral"
              onPress={() => copyToClipboard('Dirección', direccion)}
            />
            <QuickAction
              label="Ficha"
              icon="clipboard-text-outline"
              tone="brand"
              onPress={handleCopySummary}
            />
          </View>
        </View>

        {/* ── 3. Contacto del cliente ── */}
        {telefono ? (
          <View style={styles.contactBox}>
            <View style={styles.contactHead}>
              <MaterialCommunityIcons name="phone-outline" size={16} color={colors.muted} />
              <Text style={styles.contactNumber}>
                {formatPhoneDisplay(telefono)}
              </Text>
            </View>

            <View style={styles.quickRow}>
              <QuickAction
                label="Llamar"
                icon="phone"
                tone="success"
                onPress={() => callPhone(telefono)}
              />
              <QuickAction
                label="WhatsApp"
                icon="whatsapp"
                tone="whatsapp"
                onPress={() => openWhatsApp(telefono, greetingWhatsApp)}
              />
              <QuickAction
                label="Copiar tel"
                icon="content-copy"
                tone="neutral"
                onPress={() => copyToClipboard('Teléfono', telefono)}
              />
            </View>
          </View>
        ) : (
          <View style={styles.noPhoneBox}>
            <MaterialCommunityIcons name="phone-off" size={15} color={colors.ghost} />
            <Text style={styles.noPhoneText}>Sin teléfono de contacto registrado</Text>
          </View>
        )}

        {/* ── 4. Contenido del pedido (Revisión de paquetes) ── */}
        {productos.length > 0 ? (
          <View style={styles.productsBox}>
            <View style={styles.productsHead}>
              <View style={styles.productsHeadLeft}>
                <MaterialCommunityIcons name="package-variant" size={14} color={colors.muted} />
                <Text style={styles.productsTitle}>
                  PRODUCTOS ({productos.length})
                </Text>
              </View>
              {productos.length > 2 && (
                <Pressable
                  onPress={() => setExpandProducts((v) => !v)}
                  hitSlop={8}
                  style={styles.expandBtn}
                >
                  <Text style={styles.expandBtnText}>
                    {expandProducts ? 'Ver menos' : `Ver todos (${productos.length})`}
                  </Text>
                  <MaterialCommunityIcons
                    name={expandProducts ? 'chevron-up' : 'chevron-down'}
                    size={16}
                    color={colors.brand}
                  />
                </Pressable>
              )}
            </View>

            {visibleProducts.map((p, i) => (
              <View key={p.id ?? i} style={styles.productItem}>
                <Text style={styles.productBullet}>•</Text>
                <Text style={styles.productLine} numberOfLines={2}>
                  {productLabel(p)}
                </Text>
              </View>
            ))}
          </View>
        ) : null}

        {/* ── 5. Desglose de cobro / dinero ── */}
        <View style={[styles.financeBox, pagado ? styles.financeBoxPaid : styles.financeBoxPending]}>
          <View style={styles.financeMain}>
            <View style={{ flex: 1 }}>
              <Text style={styles.financeLabel}>
                {pagado ? 'TOTAL PAGADO' : 'TOTAL A COBRAR'}
              </Text>
              <View style={styles.financeDetails}>
                {metodoPago ? (
                  <Text style={styles.financeMethod}>
                    Método: <Text style={styles.financeMethodBold}>{metodoPago.toUpperCase()}</Text>
                    {cuentaNombre ? ` (${cuentaNombre})` : ''}
                  </Text>
                ) : null}
                {item.costoDomicilio && item.costoDomicilio > 0 ? (
                  <Text style={styles.financeDomiFee}>
                    Incluye Domicilio: {formatCOP(item.costoDomicilio)}
                  </Text>
                ) : null}
              </View>
            </View>

            <Text style={[styles.financeAmount, pagado && { color: colors.success }]}>
              {formatCOP(totalFactura)}
            </Text>
          </View>

          {/* Banner de instrucción para el cobro */}
          <View style={[styles.cobroNotice, pagado ? styles.cobroNoticePaid : styles.cobroNoticePending]}>
            <MaterialCommunityIcons
              name={pagado ? 'check-circle-outline' : 'alert-circle-outline'}
              size={15}
              color={pagado ? colors.success : colors.warn}
            />
            <Text style={[styles.cobroNoticeText, pagado ? styles.cobroNoticeTextPaid : styles.cobroNoticeTextPending]}>
              {pagado
                ? '¡NO cobrar dinero! Este pedido ya fue pagado en el POS.'
                : `Recuerda cobrar ${formatCOP(totalFactura)} al entregar.`}
            </Text>
          </View>
        </View>
      </View>

      {/* ── 6. Botón de acción (Entregar) ── */}
      <View style={styles.cardFoot}>
        {entregado ? (
          <View style={styles.doneBox}>
            <MaterialCommunityIcons name="check-circle" size={18} color={colors.success} />
            <Text style={styles.doneText}>Entregado con éxito</Text>
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
          <ActionButton
            label="Marcar como entregado"
            icon="check-bold"
            tone="success"
            onPress={onAskComplete}
          />
        )}
      </View>
    </Card>
  );
});

// ─── Pantalla Principal ───────────────────────────────────────────────────────

export function DeliveriesScreen({ onCountChange }: { onCountChange?: (pendientes: number) => void }) {
  const { width } = useWindowDimensions();
  const numColumns = width >= TWO_COLUMNS_FROM ? 2 : 1;

  const { user, token } = useAuth();
  const [domicilios, setDomicilios] = useState<Domicilio[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [confirmingId, setConfirmingId] = useState<number | null>(null);
  const [completingId, setCompletingId] = useState<number | null>(null);
  const [tab, setTab] = useState<'pendientes' | 'completadas'>('pendientes');
  const [gpsActive, setGpsActive] = useState<boolean | null>(null);

  // Monitor del estado del GPS en tiempo real
  const checkGps = useCallback(async () => {
    const running = await isTrackingRunning();
    setGpsActive(running);
  }, []);

  useEffect(() => {
    void checkGps();
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') void checkGps();
    });
    return () => sub.remove();
  }, [checkGps]);

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
    void fetchDomicilios();
  }, [fetchDomicilios]);

  // Auto-refresca cuando el POS asigna o actualiza un domicilio en tiempo real
  useOrdenesSocket(api.http.defaults.baseURL || '', 'domiciliario', fetchDomicilios, token);

  const pendientes = useMemo(() => domicilios.filter((d) => !isEntregado(d.estadoDomicilio)), [domicilios]);
  const completadas = useMemo(() => domicilios.filter((d) => isEntregado(d.estadoDomicilio)), [domicilios]);
  const data = tab === 'pendientes' ? pendientes : completadas;

  useEffect(() => {
    onCountChange?.(pendientes.length);
  }, [pendientes.length, onCountChange]);

  const handleComplete = useCallback(
    async (domicilioId: number) => {
      setCompletingId(domicilioId);
      try {
        // Al actualizar a entregado, el backend automáticamente marca la orden
        // como 'completada' sin alterar el estado de pago de la factura.
        await api.domicilios.update(domicilioId, { estadoDomicilio: 'entregado' });
        Toast.show({ type: 'success', text1: '¡Entregado!', text2: 'Excelente trabajo 🎉' });
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
      <View style={numColumns > 1 ? styles.gridCol : undefined}>
        <DomicilioCard
          item={item}
          confirming={confirmingId === item.domicilioId}
          loading={completingId === item.domicilioId}
          onAskComplete={() => setConfirmingId(item.domicilioId)}
          onConfirm={() => handleComplete(item.domicilioId)}
          onCancel={() => setConfirmingId(null)}
        />
      </View>
    ),
    [confirmingId, completingId, handleComplete, numColumns],
  );

  return (
    <View style={styles.flex}>
      <View style={styles.container}>
        {/* ── Cabecera de la pantalla ── */}
        <View style={styles.header}>
          <View style={styles.headerInfo}>
            <Text style={styles.hello}>Hola,</Text>
            <Text style={styles.name} numberOfLines={1}>
              {user?.name || user?.username || 'Domiciliario'}
            </Text>

            {/* Estado de GPS en tiempo real */}
            <View style={styles.gpsIndicatorRow}>
              <View style={[styles.gpsDot, { backgroundColor: gpsActive ? colors.success : colors.danger }]} />
              <Text style={styles.gpsIndicatorText}>
                {gpsActive ? 'GPS activo (reportando al despacho)' : 'GPS inactivo (revisar ajustes)'}
              </Text>
            </View>
          </View>

          {/* Contador de pendientes con botón rápido de refresco */}
          <Pressable
            onPress={() => {
              setRefreshing(true);
              void fetchDomicilios();
              void checkGps();
            }}
            style={({ pressed }) => [styles.counterBadge, pressed && styles.pressed]}
            accessibilityLabel="Refrescar entregas"
          >
            <View style={styles.counterBadgeContent}>
              <Text style={styles.counterNum}>{pendientes.length}</Text>
              <Text style={styles.counterLabel}>pendientes</Text>
            </View>
            <MaterialCommunityIcons name="refresh" size={15} color={colors.brand} style={styles.refreshIcon} />
          </Pressable>
        </View>

        {/* ── Segmento de pestañas ── */}
        <View style={styles.segment}>
          {(['pendientes', 'completadas'] as const).map((k) => {
            const on = tab === k;
            const count = k === 'pendientes' ? pendientes.length : completadas.length;
            return (
              <Pressable
                key={k}
                onPress={() => setTab(k)}
                style={({ pressed }) => [styles.segmentBtn, on && styles.segmentBtnOn, pressed && !on && styles.pressed]}
              >
                <Text style={[styles.segmentText, on && styles.segmentTextOn]}>
                  {k === 'pendientes' ? 'Pendientes' : 'Completadas'} ({count})
                </Text>
              </Pressable>
            );
          })}
        </View>

        {/* ── Lista de domicilios ── */}
        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color={colors.brand} />
            <Text style={styles.loadingText}>Cargando domicilios…</Text>
          </View>
        ) : (
          <FlashList
            data={data}
            keyExtractor={(item) => String(item.domicilioId)}
            renderItem={renderItem}
            numColumns={numColumns}
            contentContainerStyle={styles.listContainer}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={() => {
                  setRefreshing(true);
                  void fetchDomicilios();
                  void checkGps();
                }}
                tintColor={colors.brand}
                colors={[colors.brand]}
              />
            }
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <View style={styles.emptyIconWrap}>
                  <MaterialCommunityIcons
                    name={tab === 'pendientes' ? 'check-all' : 'history'}
                    size={38}
                    color={colors.ghost}
                  />
                </View>
                <Text style={styles.emptyTitle}>
                  {tab === 'pendientes' ? '¡Todo al día!' : 'Sin historial aún'}
                </Text>
                <Text style={styles.emptySubtitle}>
                  {tab === 'pendientes'
                    ? 'No tienes entregas pendientes en este momento. Las nuevas órdenes asignadas aparecerán aquí automáticamente.'
                    : 'Aún no has completado entregas durante tu turno actual.'}
                </Text>
              </View>
            }
          />
        )}
      </View>
    </View>
  );
}

// ─── Estilos ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  flex: { flex: 1 },
  container: {
    flex: 1,
    width: '100%',
    maxWidth: maxContentWidth,
    alignSelf: 'center',
  },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  loadingText: { color: colors.muted, fontSize: 13, fontWeight: '600' },
  pressed: { opacity: 0.7 },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 12,
    gap: 12,
  },
  headerInfo: { flex: 1, minWidth: 0 },
  hello: { color: colors.muted, fontSize: 13, fontWeight: '600' },
  name: { ...text.h1, color: colors.ink, marginTop: 1 },
  gpsIndicatorRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
  gpsDot: { width: 7, height: 7, borderRadius: 4 },
  gpsIndicatorText: { color: colors.muted, fontSize: 11, fontWeight: '600' },

  counterBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(245,165,36,0.11)',
    borderWidth: 1,
    borderColor: 'rgba(245,165,36,0.28)',
    borderRadius: radius.md,
    paddingHorizontal: 12,
    paddingVertical: 7,
    gap: 8,
  },
  counterBadgeContent: { alignItems: 'center' },
  counterNum: { color: colors.brand, fontSize: 21, fontWeight: '900', lineHeight: 23 },
  counterLabel: { ...text.label, color: colors.brand, fontSize: 8.5, opacity: 0.9 },
  refreshIcon: { opacity: 0.8 },

  segment: {
    flexDirection: 'row',
    gap: 6,
    marginHorizontal: 16,
    marginBottom: 12,
    backgroundColor: colors.bgElevated,
    borderRadius: radius.md,
    padding: 4,
    borderWidth: 1,
    borderColor: colors.hairline,
  },
  segmentBtn: { flex: 1, alignItems: 'center', paddingVertical: 10, borderRadius: radius.sm },
  segmentBtnOn: { backgroundColor: colors.brand },
  segmentText: { color: colors.muted, fontWeight: '800', fontSize: 12.5 },
  segmentTextOn: { color: colors.onBrand },

  listContainer: { paddingHorizontal: 14, paddingBottom: 30 },
  gridCol: { flex: 1, paddingHorizontal: 5 },

  card: { marginBottom: 14 },

  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 8,
    gap: 8,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 7, flexShrink: 1 },

  orderBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: colors.brandSoft,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: 'rgba(245,165,36,0.22)',
  },
  orderBadgeText: { color: colors.brand, fontSize: 12, fontWeight: '900' },

  timePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(148,163,184,0.08)',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: radius.pill,
  },
  timePillText: { color: colors.muted, fontSize: 10.5, fontWeight: '600' },

  clientRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingBottom: 10,
  },
  clientAvatar: {
    width: 26,
    height: 26,
    borderRadius: 8,
    backgroundColor: colors.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  clientName: { flex: 1, color: colors.ink, fontSize: 16, fontWeight: '800' },

  divider: { marginHorizontal: 14 },

  cardBody: { padding: 14, gap: 12 },

  // Hero: Bloque de dirección de entrega
  heroAddressBox: {
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: 'rgba(245,165,36,0.18)',
    padding: 12,
    gap: 8,
  },
  heroAddressHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  heroLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  heroAddressLabel: { ...text.label, color: colors.brand, fontSize: 9.5 },
  coordsBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: colors.infoSoft,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: radius.pill,
  },
  coordsBadgeText: { color: colors.info, fontSize: 9, fontWeight: '800' },

  addressPressable: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 8,
    paddingVertical: 2,
  },
  addressText: {
    flex: 1,
    color: colors.ink,
    fontSize: 16,
    fontWeight: '700',
    lineHeight: 22,
  },
  addressCopyIcon: { marginTop: 3 },

  referenceBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 7,
    backgroundColor: 'rgba(245,165,36,0.08)',
    paddingHorizontal: 9,
    paddingVertical: 7,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: 'rgba(245,165,36,0.15)',
  },
  referenceLabel: { ...text.label, color: colors.brand, fontSize: 8.5, marginBottom: 2 },
  referenceText: { color: colors.ink, fontSize: 13, fontWeight: '600', lineHeight: 18 },

  observationBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 7,
    backgroundColor: colors.infoSoft,
    paddingHorizontal: 9,
    paddingVertical: 7,
    borderRadius: radius.sm,
  },
  observationLabel: { ...text.label, color: colors.info, fontSize: 8.5, marginBottom: 2 },
  observationText: { color: colors.ink, fontSize: 12.5, fontWeight: '500', lineHeight: 17 },

  quickRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    marginTop: 6,
  },

  // Contacto
  contactBox: {
    backgroundColor: colors.bg,
    borderRadius: radius.md,
    padding: 12,
    borderWidth: 1,
    borderColor: colors.hairline,
    gap: 8,
  },
  contactHead: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  contactNumber: { color: colors.ink, fontSize: 14.5, fontWeight: '700', letterSpacing: 0.5 },

  noPhoneBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 6,
    paddingHorizontal: 8,
  },
  noPhoneText: { color: colors.ghost, fontSize: 12, fontWeight: '500' },

  // Productos del pedido
  productsBox: {
    backgroundColor: colors.bg,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.hairline,
    padding: 11,
    gap: 6,
  },
  productsHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 3,
  },
  productsHeadLeft: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  productsTitle: { ...text.label, color: colors.muted, fontSize: 9.5 },
  expandBtn: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  expandBtnText: { color: colors.brand, fontSize: 11, fontWeight: '700' },

  productItem: { flexDirection: 'row', alignItems: 'flex-start', gap: 6 },
  productBullet: { color: colors.brand, fontSize: 13, lineHeight: 19 },
  productLine: { flex: 1, color: colors.ink, fontSize: 13, lineHeight: 19, fontWeight: '500' },

  // Finanzas
  financeBox: {
    borderRadius: radius.md,
    padding: 12,
    borderWidth: 1,
    gap: 8,
  },
  financeBoxPaid: {
    backgroundColor: 'rgba(16,185,129,0.06)',
    borderColor: 'rgba(16,185,129,0.22)',
  },
  financeBoxPending: {
    backgroundColor: 'rgba(245,158,11,0.06)',
    borderColor: 'rgba(245,158,11,0.22)',
  },
  financeMain: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  financeLabel: { ...text.label, color: colors.muted, fontSize: 9 },
  financeDetails: { marginTop: 2, gap: 1 },
  financeMethod: { color: colors.muted, fontSize: 11.5, fontWeight: '600' },
  financeMethodBold: { color: colors.ink, fontWeight: '800' },
  financeDomiFee: { color: colors.brand, fontSize: 11, fontWeight: '700' },
  financeAmount: { color: colors.ink, fontSize: 24, fontWeight: '900', letterSpacing: -0.5 },

  cobroNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: radius.sm,
  },
  cobroNoticePaid: { backgroundColor: colors.successSoft },
  cobroNoticePending: { backgroundColor: colors.warnSoft },
  cobroNoticeText: { fontSize: 11.5, fontWeight: '700', flex: 1 },
  cobroNoticeTextPaid: { color: colors.success },
  cobroNoticeTextPending: { color: colors.warn },

  // Pie de tarjeta
  cardFoot: { padding: 14, paddingTop: 2 },
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

  // Estados vacíos
  emptyContainer: { alignItems: 'center', paddingVertical: 60, paddingHorizontal: 26, gap: 14 },
  emptyIconWrap: {
    width: 76,
    height: 76,
    borderRadius: 26,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.hairline,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTitle: { ...text.h2, color: colors.ink, textAlign: 'center' },
  emptySubtitle: { color: colors.muted, fontSize: 13, lineHeight: 19, textAlign: 'center' },
});
