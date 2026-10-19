import React, { useState, useEffect, useMemo, useCallback, memo } from 'react';
import { Modal, KeyboardAvoidingView, Platform, Pressable, Linking } from 'react-native';
import { useRouter } from 'expo-router';
import * as Clipboard from 'expo-clipboard';
import { View, Text, ScrollView, TouchableOpacity } from '../../tw';
import { api } from '../../services/api';
import type {
  Cliente,
  ClienteHistorial,
  ClienteHistorialOrden,
  ClienteHistorialProducto,
  ClienteProductoFavorito,
} from '@/src/shared';
import {
  formatCurrency,
  formatDate,
  timeAgo,
  useToast,
  useOrder,
  getMetodoPagoMeta,
  tipoPedidoMeta,
  toDialablePhone,
  toWhatsappPhone,
  normalizePhone,
  formatPhoneDisplay,
} from '@/src/shared';
import {
  Avatar,
  Icon,
  Button,
  EstadoPill,
  SegmentedControl,
  ChipGroup,
  InlineError,
  LoadingState,
  IconButton,
  StatCard,
  CardGrid,
} from '../../components/ui';

interface ClientePerfilModalProps {
  visible: boolean;
  telefono: string;
  cliente?: Cliente | null;
  onClose: () => void;
  onEdit?: (cliente: Cliente) => void;
}

const MEDALLAS = ['🥇', '🥈', '🥉'];
/** Cuántas órdenes se dibujan de una vez; "Mostrar más" agrega otra tanda. */
const TANDA_ORDENES = 15;

type FiltroOrdenes = 'todas' | 'porCobrar' | 'canceladas';

// Hoisted: crear un Intl por render es caro y el mes debe calcularse en hora de Bogotá, no UTC (un pedido del 31 a
// las 8 pm caía en el mes siguiente).
const FORMATO_MES_CLAVE = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Bogota', year: 'numeric', month: '2-digit' });
const FORMATO_MES_ETIQUETA = new Intl.DateTimeFormat('es-CO', { timeZone: 'America/Bogota', month: 'long', year: 'numeric' });

function mesDe(fechaIso: string): { clave: string; etiqueta: string } | null {
  const d = new Date(fechaIso);
  if (isNaN(d.getTime())) return null;
  const etiqueta = FORMATO_MES_ETIQUETA.format(d);
  return { clave: FORMATO_MES_CLAVE.format(d), etiqueta: etiqueta.charAt(0).toUpperCase() + etiqueta.slice(1) };
}

const CANAL_LABEL: Record<string, string> = { pos: 'Mostrador', web: 'Web', whatsapp: 'WhatsApp' };
const TAMANO_LABEL: Record<string, string> = { pequena: 'Pequeña', mediana: 'Mediana', grande: 'Grande' };

/** Dato corto del cliente (ícono + texto) para la fila de hábitos. */
const Dato = memo(function Dato({ icon, text, color = '#94A3B8' }: { icon: string; text: string; color?: string }) {
  return (
    <View className="flex-row items-center gap-1.5 bg-white/5 border border-white/5 rounded-lg px-2.5 py-1.5">
      <Icon name={icon} size={12} color={color} />
      <Text className="text-[11px] font-bold" style={{ color }}>
        {text}
      </Text>
    </View>
  );
});

const OrdenItem = memo(function OrdenItem({
  ord,
  expandida,
  onToggle,
}: {
  ord: ClienteHistorialOrden;
  expandida: boolean;
  onToggle: (facturaId: number) => void;
}) {
  const cancelada = (ord.estadoOrden ?? ord.estadoFactura) === 'cancelado';
  const metodo = getMetodoPagoMeta(ord.metodo);
  const tipo = ord.tipoPedido ? tipoPedidoMeta(ord.tipoPedido) : null;
  const debe = !cancelada && (ord.porCobrar ?? 0) > 0;

  return (
    <View className="bg-white/[0.03] border border-white/5 rounded-2xl overflow-hidden">
      <TouchableOpacity onPress={() => onToggle(ord.facturaId)} className="p-3.5 flex-row items-center justify-between gap-3">
        <View className="flex-1 min-w-0">
          <View className="flex-row items-center gap-2 flex-wrap">
            <Text className="text-slate-50 text-sm font-black">{ord.ordenId ? `Orden #${ord.ordenId}` : `Factura #${ord.facturaId}`}</Text>
            {ord.estadoOrden ? <EstadoPill estado={ord.estadoOrden} size="xs" /> : null}
            {tipo ? (
              <View className="flex-row items-center gap-1 bg-white/5 rounded px-1.5 py-0.5">
                <Icon name={tipo.icon} size={10} color={tipo.color} />
                <Text className="text-[10px] font-bold uppercase text-slate-400">{tipo.label}</Text>
              </View>
            ) : null}
            {ord.canal && CANAL_LABEL[ord.canal] ? <Text className="text-[10px] font-bold uppercase text-slate-500">{CANAL_LABEL[ord.canal]}</Text> : null}
          </View>
          <Text className="text-slate-500 text-[11px] mt-1">{formatDate(ord.fechaOrden)}</Text>
        </View>

        <View className="items-end gap-1">
          <Text className="text-[15px] font-black" style={{ color: cancelada ? '#EF4444' : '#34D399' }}>
            ${formatCurrency(ord.total)}
          </Text>
          <View className="flex-row items-center gap-1.5">
            {debe ? (
              <View className="bg-amber-500/15 border border-amber-500/30 rounded px-1.5 py-0.5">
                <Text className="text-[10px] font-black text-amber-400 uppercase">Debe ${formatCurrency(ord.porCobrar ?? 0)}</Text>
              </View>
            ) : metodo && !cancelada ? (
              <View className="flex-row items-center gap-1 bg-white/5 rounded px-1.5 py-0.5">
                <Icon name={metodo.icon} size={10} color={metodo.color} />
                <Text className="text-[10px] font-bold uppercase text-slate-400">{metodo.shortLabel}</Text>
              </View>
            ) : null}
            <Icon name={expandida ? 'chevron-up' : 'chevron-down'} size={16} color="#64748B" />
          </View>
        </View>
      </TouchableOpacity>

      {expandida ? (
        <View className="border-t border-white/5 bg-black/20 p-3 gap-2">
          <Text className="text-[10px] font-black uppercase tracking-wider text-slate-500">Productos del ticket ({ord.productos.length})</Text>
          {ord.productos.length > 0 ? (
            ord.productos.map((prod: ClienteHistorialProducto, idx) => (
              <View key={prod.id ?? idx} className="flex-row items-center justify-between py-1 gap-2">
                <View className="flex-row items-center gap-2 flex-1">
                  <View className="bg-amber-500/10 w-[26px] h-[22px] rounded-md items-center justify-center">
                    <Text className="text-[11px] font-black text-amber-400">{prod.cantidad}x</Text>
                  </View>
                  <Text className="text-slate-200 text-xs font-semibold flex-1">{prod.nombre}</Text>
                </View>
                <View className="items-end">
                  <Text className="text-slate-50 text-xs font-black">${formatCurrency(prod.subtotal)}</Text>
                  {prod.precioUnitario > 0 && prod.cantidad > 1 ? (
                    <Text className="text-slate-500 text-[10px]">(${formatCurrency(prod.precioUnitario)} c/u)</Text>
                  ) : null}
                </View>
              </View>
            ))
          ) : (
            <Text className="text-slate-500 text-[11px] italic">Detalle de productos no disponible para esta orden</Text>
          )}

          {(ord.cobrado ?? 0) > 0 && (ord.porCobrar ?? 0) > 0 ? (
            <Text className="text-slate-400 text-[11px]">
              Abonado ${formatCurrency(ord.cobrado ?? 0)} · Falta ${formatCurrency(ord.porCobrar ?? 0)}
            </Text>
          ) : null}

          {ord.observaciones ? (
            <View className="flex-row gap-1.5 pt-2 border-t border-white/5">
              <Icon name="comment-text-outline" size={12} color="#64748B" />
              <Text className="text-slate-400 text-[10px] italic flex-1">{ord.observaciones}</Text>
            </View>
          ) : null}
        </View>
      ) : null}
    </View>
  );
});

export const ClientePerfilModal = memo(function ClientePerfilModal({
  visible,
  telefono,
  cliente,
  onClose,
  onEdit,
}: ClientePerfilModalProps) {
  const { showToast } = useToast();
  const router = useRouter();
  const { updateForm } = useOrder();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [historial, setHistorial] = useState<ClienteHistorial | null>(null);

  const [tab, setTab] = useState<'ordenes' | 'favoritos'>('ordenes');
  const [mes, setMes] = useState<string>('todos');
  const [filtro, setFiltro] = useState<FiltroOrdenes>('todas');
  const [expandida, setExpandida] = useState<number | null>(null);
  const [visibles, setVisibles] = useState(TANDA_ORDENES);
  const [intento, setIntento] = useState(0);

  // Cada vez que se abre un cliente se parte de cero: antes se arrastraban el mes, la pestaña y la orden abierta
  // del cliente anterior ("No hay órdenes en el período" sin motivo).
  useEffect(() => {
    setTab('ordenes');
    setMes('todos');
    setFiltro('todas');
    setExpandida(null);
    setVisibles(TANDA_ORDENES);
  }, [telefono, visible]);

  useEffect(() => {
    if (!visible || !telefono) {
      setHistorial(null);
      setError(null);
      return;
    }
    let cancelado = false;
    setLoading(true);
    setError(null);
    api.estadisticas
      .clienteHistorial(telefono)
      .then((data) => {
        if (cancelado) return;
        setHistorial(data);
        if (data.ordenes?.length === 1) setExpandida(data.ordenes[0].facturaId);
      })
      .catch((err) => {
        if (!cancelado) setError(err?.response?.data?.message || 'No se pudo cargar el historial del cliente');
      })
      .finally(() => {
        if (!cancelado) setLoading(false);
      });
    return () => {
      cancelado = true;
    };
  }, [visible, telefono, intento]);

  const copiarTelefono = useCallback(async () => {
    if (!telefono) return;
    try {
      await Clipboard.setStringAsync(telefono);
      showToast('Teléfono copiado al portapapeles', 'success');
    } catch {
      showToast('No se pudo copiar el teléfono', 'error');
    }
  }, [telefono, showToast]);

  const abrir = useCallback(
    (url: string, falla: string) => {
      Linking.openURL(url).catch(() => showToast(falla, 'error'));
    },
    [showToast],
  );
  const llamar = useCallback(() => abrir(`tel:${toDialablePhone(telefono)}`, 'No se pudo abrir el marcador'), [abrir, telefono]);
  const whatsapp = useCallback(() => abrir(`https://wa.me/${toWhatsappPhone(telefono)}`, 'No se pudo abrir WhatsApp'), [abrir, telefono]);

  /** Deja el formulario de orden listo para este cliente (domicilio a su teléfono, nombre y primera dirección). */
  const nuevaOrden = useCallback(() => {
    const dir = cliente?.direcciones?.[0];
    updateForm({
      tipoPedido: 'domicilio',
      telefonoCliente: normalizePhone(telefono),
      nombreCliente: cliente?.clienteNombre ?? '',
      ...(dir
        ? {
            selectedAddress: dir.direccion,
            selectedAddressId: dir.id,
            referenciaDomicilio: dir.referencia ?? '',
            costoDomicilio: dir.costoDomicilio != null ? String(dir.costoDomicilio) : '',
          }
        : {}),
    });
    onClose();
    router.push('/crear-orden');
  }, [cliente, telefono, updateForm, onClose, router]);

  const toggleOrden = useCallback((id: number) => setExpandida((prev) => (prev === id ? null : id)), []);

  const mesesDisponibles = useMemo(() => {
    const meses = new Map<string, { label: string; count: number }>();
    for (const o of historial?.ordenes ?? []) {
      const m = mesDe(o.fechaOrden);
      if (!m) continue;
      const previo = meses.get(m.clave);
      if (previo) previo.count += 1;
      else meses.set(m.clave, { label: m.etiqueta, count: 1 });
    }
    return Array.from(meses.entries())
      .sort(([a], [b]) => b.localeCompare(a))
      .map(([clave, v]) => ({ value: clave, label: v.label, count: v.count }));
  }, [historial?.ordenes]);

  const ordenesFiltradas = useMemo(
    () =>
      (historial?.ordenes ?? []).filter((o) => {
        if (mes !== 'todos' && mesDe(o.fechaOrden)?.clave !== mes) return false;
        const cancelada = (o.estadoOrden ?? o.estadoFactura) === 'cancelado';
        if (filtro === 'canceladas') return cancelada;
        if (filtro === 'porCobrar') return !cancelada && (o.porCobrar ?? 0) > 0;
        return true;
      }),
    [historial?.ordenes, mes, filtro],
  );

  const conSaldo = useMemo(
    () => (historial?.ordenes ?? []).filter((o) => (o.estadoOrden ?? o.estadoFactura) !== 'cancelado' && (o.porCobrar ?? 0) > 0).length,
    [historial?.ordenes],
  );

  const nombre = cliente?.clienteNombre || formatPhoneDisplay(telefono) || telefono;
  const porCobrar = historial?.porCobrar ?? 0;

  const kpis = historial
    ? [
        { key: 'gasto', label: 'Gasto total', value: `$${formatCurrency(historial.gastoTotal)}`, icon: 'cash-multiple' as const, color: '#34D399' },
        { key: 'ticket', label: 'Ticket promedio', value: `$${formatCurrency(historial.ticketPromedio)}`, icon: 'trending-up' as const, color: '#60A5FA' },
        {
          key: 'ordenes',
          label: 'Pedidos',
          value: String(historial.completadas),
          sub: historial.canceladas > 0 ? `${historial.canceladas} cancelados` : undefined,
          icon: 'shopping-outline' as const,
          color: '#F8FAFC',
        },
        {
          key: 'ultimo',
          label: 'Último pedido',
          value: historial.ultimaVisita ? timeAgo(historial.ultimaVisita, 'corto') : '—',
          icon: 'clock-outline' as const,
          color: '#F5A524',
        },
      ]
    : [];

  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <Pressable
          style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'center', alignItems: 'center', padding: 16 }}
          onPress={onClose}
        >
          <Pressable
            style={{
              backgroundColor: '#0B1120',
              borderRadius: 24,
              borderWidth: 1,
              borderColor: 'rgba(255,255,255,0.08)',
              width: '100%',
              maxWidth: 760,
              maxHeight: '92%',
              overflow: 'hidden',
              flexDirection: 'column',
            }}
            onPress={(e) => e.stopPropagation()}
          >
            {/* ─── Cabecera ─────────────────────────────────────────── */}
            <View className="px-5 py-4 border-b border-white/5 bg-white/[0.02]">
              <View className="flex-row items-center gap-3.5">
                <Avatar nombre={nombre} size="lg" />
                <View className="flex-1 min-w-0">
                  <Text numberOfLines={1} className="text-slate-50 text-lg font-black uppercase tracking-wide">
                    {nombre}
                  </Text>
                  <View className="flex-row items-center gap-2 mt-1 flex-wrap">
                    <TouchableOpacity
                      onPress={copiarTelefono}
                      className="flex-row items-center gap-1.5 bg-amber-500/10 border border-amber-500/25 rounded-lg px-2 py-0.5"
                    >
                      <Icon name="phone-outline" size={13} color="#F5A524" />
                      <Text className="text-xs font-black text-amber-400">{formatPhoneDisplay(telefono) || telefono}</Text>
                      <Icon name="content-copy" size={11} color="rgba(245,165,36,0.7)" />
                    </TouchableOpacity>
                    {cliente?.correo ? (
                      <View className="flex-row items-center gap-1">
                        <Icon name="email-outline" size={12} color="#64748B" />
                        <Text className="text-slate-400 text-[11px]">{cliente.correo}</Text>
                      </View>
                    ) : null}
                    {cliente?.documento ? (
                      <View className="flex-row items-center gap-1">
                        <Icon name="card-account-details-outline" size={12} color="#64748B" />
                        <Text className="text-slate-400 text-[11px]">
                          {cliente.tipoDocumento ? `${cliente.tipoDocumento}: ` : ''}
                          {cliente.documento}
                        </Text>
                      </View>
                    ) : null}
                  </View>
                </View>

                <View className="flex-row items-center gap-2">
                  <IconButton icon="whatsapp" onPress={whatsapp} accessibilityLabel="Escribir por WhatsApp" size="sm" />
                  <IconButton icon="phone" onPress={llamar} accessibilityLabel="Llamar" size="sm" />
                  {cliente && onEdit ? (
                    <IconButton
                      icon="pencil-outline"
                      onPress={() => {
                        onClose();
                        onEdit(cliente);
                      }}
                      accessibilityLabel="Editar cliente"
                      size="sm"
                    />
                  ) : null}
                  <IconButton icon="close" onPress={onClose} accessibilityLabel="Cerrar" size="sm" />
                </View>
              </View>

              {cliente?.direcciones && cliente.direcciones.length > 0 ? (
                <View className="flex-row flex-wrap gap-1.5 mt-3">
                  {cliente.direcciones.map((d) => (
                    <View key={d.id} className="flex-row items-center gap-1 bg-white/[0.03] border border-white/5 rounded-lg px-2 py-1">
                      <Icon name="map-marker-outline" size={12} color="#F5A524" />
                      <Text className="text-slate-300 text-[11px]">{d.direccion}</Text>
                      {d.costoDomicilio != null ? <Text className="text-emerald-400 text-[10px] font-bold">(${formatCurrency(d.costoDomicilio)})</Text> : null}
                    </View>
                  ))}
                </View>
              ) : null}
            </View>

            {/* ─── Cuerpo ───────────────────────────────────────────── */}
            <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 20, gap: 16 }} showsVerticalScrollIndicator={false}>
              {loading && !historial ? <LoadingState message="Cargando historial del cliente…" /> : null}

              {error && !loading ? (
                <View className="gap-3 items-center">
                  <InlineError message={error} className="self-stretch" />
                  <Button title="Reintentar" size="sm" variant="secondary" onPress={() => setIntento((n) => n + 1)} />
                </View>
              ) : null}

              {historial ? (
                <>
                  {/* Lo que debe: lo primero que quiere saber quien atiende la caja. */}
                  {porCobrar > 0 ? (
                    <TouchableOpacity
                      onPress={() => {
                        setTab('ordenes');
                        setFiltro('porCobrar');
                      }}
                      className="flex-row items-center gap-3 bg-amber-500/10 border border-amber-500/30 rounded-2xl p-3.5"
                    >
                      <Icon name="cash-clock" size={22} color="#F59E0B" />
                      <View className="flex-1">
                        <Text className="text-amber-400 text-sm font-black">Debe ${formatCurrency(porCobrar)}</Text>
                        <Text className="text-amber-300/70 text-[11px]">
                          {conSaldo} {conSaldo === 1 ? 'factura con saldo' : 'facturas con saldo'} · toca para verlas
                        </Text>
                      </View>
                      <Icon name="chevron-right" size={18} color="#F59E0B" />
                    </TouchableOpacity>
                  ) : null}

                  <CardGrid
                    kind="kpi"
                    data={kpis}
                    keyExtractor={(k) => k.key}
                    renderItem={(k) => <StatCard label={k.label} value={k.value} icon={k.icon} color={k.color} sub={'sub' in k ? k.sub : undefined} />}
                  />

                  {/* Hábitos: cómo y cada cuánto pide */}
                  <View className="flex-row flex-wrap gap-2">
                    {historial.diasEntrePedidos ? <Dato icon="calendar-refresh" text={`Pide cada ~${historial.diasEntrePedidos} ${historial.diasEntrePedidos === 1 ? 'día' : 'días'}`} /> : null}
                    {historial.tipoPedidoFavorito ? (
                      <Dato
                        icon={tipoPedidoMeta(historial.tipoPedidoFavorito).icon}
                        text={tipoPedidoMeta(historial.tipoPedidoFavorito).label}
                        color={tipoPedidoMeta(historial.tipoPedidoFavorito).color}
                      />
                    ) : null}
                    {historial.canalFavorito && CANAL_LABEL[historial.canalFavorito] ? <Dato icon="devices" text={CANAL_LABEL[historial.canalFavorito]} /> : null}
                    {historial.tamanoHabitual && TAMANO_LABEL[historial.tamanoHabitual] ? <Dato icon="pizza" text={`Pizza ${TAMANO_LABEL[historial.tamanoHabitual].toLowerCase()}`} /> : null}
                    {historial.primeraVisita ? <Dato icon="account-clock-outline" text={`Cliente desde ${mesDe(historial.primeraVisita)?.etiqueta ?? ''}`} /> : null}
                    {(historial.pedidoMaximo ?? 0) > 0 ? <Dato icon="crown-outline" text={`Pedido máx. $${formatCurrency(historial.pedidoMaximo ?? 0)}`} color="#F5A524" /> : null}
                  </View>

                  <SegmentedControl
                    value={tab}
                    onChange={setTab}
                    options={[
                      { value: 'ordenes', label: `Órdenes (${historial.totalOrdenes})`, icon: 'receipt-text-outline' },
                      { value: 'favoritos', label: `Favoritos (${historial.productosTop.length})`, icon: 'heart-outline' },
                    ]}
                    color="#F5A524"
                  />

                  {/* ─── Órdenes ─── */}
                  {tab === 'ordenes' ? (
                    <View className="gap-3">
                      {mesesDisponibles.length > 1 ? (
                        <ChipGroup
                          scroll
                          size="sm"
                          value={mes}
                          onChange={(v) => {
                            setMes(v ?? 'todos');
                            setVisibles(TANDA_ORDENES);
                          }}
                          options={[{ value: 'todos', label: 'Todos', count: historial.ordenes.length }, ...mesesDisponibles]}
                          color="#F5A524"
                        />
                      ) : null}
                      <ChipGroup
                        size="sm"
                        value={filtro}
                        onChange={(v) => {
                          setFiltro(v ?? 'todas');
                          setVisibles(TANDA_ORDENES);
                        }}
                        options={[
                          { value: 'todas', label: 'Todas' },
                          { value: 'porCobrar', label: 'Con saldo', count: conSaldo },
                          { value: 'canceladas', label: 'Canceladas', count: historial.canceladas },
                        ]}
                        color="#F5A524"
                      />

                      {ordenesFiltradas.length === 0 ? (
                        <View className="py-8 items-center opacity-60">
                          <Icon name="receipt-text-outline" size={40} color="#64748B" />
                          <Text className="text-slate-400 text-[13px] mt-2">No hay órdenes con estos filtros</Text>
                        </View>
                      ) : (
                        <View className="gap-2.5">
                          {ordenesFiltradas.slice(0, visibles).map((ord) => (
                            <OrdenItem key={ord.facturaId} ord={ord} expandida={expandida === ord.facturaId} onToggle={toggleOrden} />
                          ))}
                          {ordenesFiltradas.length > visibles ? (
                            <Button
                              title={`Mostrar más (${ordenesFiltradas.length - visibles})`}
                              variant="secondary"
                              size="sm"
                              onPress={() => setVisibles((n) => n + TANDA_ORDENES)}
                            />
                          ) : null}
                        </View>
                      )}

                      {historial.hayMasOrdenes ? (
                        <Text className="text-slate-500 text-[11px] text-center">
                          Se muestran las {historial.ordenes.length} órdenes más recientes; las cifras de arriba incluyen todo el historial.
                        </Text>
                      ) : null}
                    </View>
                  ) : (
                    /* ─── Favoritos ─── */
                    <View className="gap-4">
                      {historial.saboresTop && historial.saboresTop.length > 0 ? (
                        <View className="gap-2">
                          <Text className="text-slate-50 text-[13px] font-black uppercase tracking-wide">Sabores favoritos</Text>
                          <View className="flex-row flex-wrap gap-2">
                            {historial.saboresTop.map((s, idx) => (
                              <View
                                key={s.nombre}
                                className={`flex-row items-center gap-1.5 rounded-lg px-2.5 py-1.5 border ${idx === 0 ? 'bg-amber-500/10 border-amber-500/30' : 'bg-white/5 border-white/5'}`}
                              >
                                {idx === 0 ? <Icon name="star" size={12} color="#F5A524" /> : null}
                                <Text className={`text-xs font-bold ${idx === 0 ? 'text-amber-400' : 'text-slate-300'}`}>{s.nombre}</Text>
                                <Text className="text-[10px] text-slate-500">×{s.pizzas}</Text>
                              </View>
                            ))}
                          </View>
                        </View>
                      ) : null}

                      <View className="gap-2">
                        <View className="flex-row items-center justify-between">
                          <Text className="text-slate-50 text-[13px] font-black uppercase tracking-wide">Productos más pedidos</Text>
                          <Text className="text-slate-500 text-[11px]">{historial.productosTop.length} variedades</Text>
                        </View>
                        {historial.productosTop.length === 0 ? (
                          <View className="py-10 items-center opacity-50">
                            <Icon name="heart-broken-outline" size={40} color="#64748B" />
                            <Text className="text-slate-400 text-[13px] mt-2">Sin productos registrados aún</Text>
                          </View>
                        ) : (
                          historial.productosTop.map((prod: ClienteProductoFavorito, idx: number) => {
                            const top3 = idx < 3;
                            const pct = Math.round((prod.cantidad / (historial.productosTop[0]?.cantidad || 1)) * 100);
                            return (
                              <View
                                key={prod.nombre}
                                className={`rounded-2xl border p-3 gap-1.5 ${top3 ? 'bg-amber-500/[0.06] border-amber-500/20' : 'bg-white/[0.02] border-white/5'}`}
                              >
                                <View className="flex-row items-center justify-between gap-2">
                                  <View className="flex-row items-center gap-2 flex-1">
                                    <Text style={{ fontSize: top3 ? 18 : 13, minWidth: 24 }}>{MEDALLAS[idx] ?? `${idx + 1}º`}</Text>
                                    <Text numberOfLines={1} className={`text-[13px] font-black flex-1 ${top3 ? 'text-slate-50' : 'text-slate-300'}`}>
                                      {prod.nombre}
                                    </Text>
                                  </View>
                                  <View className="items-end">
                                    <Text className="text-amber-400 text-[13px] font-black">
                                      {prod.cantidad} {prod.cantidad === 1 ? 'unidad' : 'unidades'}
                                    </Text>
                                    {prod.gastoTotal > 0 ? <Text className="text-emerald-400 text-[10px] font-bold">${formatCurrency(prod.gastoTotal)}</Text> : null}
                                  </View>
                                </View>
                                <View className="h-1 bg-white/5 rounded-sm overflow-hidden">
                                  <View style={{ width: `${pct}%`, height: '100%', backgroundColor: top3 ? '#F5A524' : '#64748B', borderRadius: 2 }} />
                                </View>
                              </View>
                            );
                          })
                        )}
                      </View>
                    </View>
                  )}
                </>
              ) : null}
            </ScrollView>

            {/* ─── Pie ──────────────────────────────────────────────── */}
            <View className="flex-row justify-between items-center px-5 py-3.5 border-t border-white/5 bg-white/[0.02]">
              <Button title="Nueva orden" icon="plus" variant="primary" size="sm" onPress={nuevaOrden} />
              <Button title="Cerrar" variant="secondary" size="sm" onPress={onClose} />
            </View>
          </Pressable>
        </Pressable>
      </KeyboardAvoidingView>
    </Modal>
  );
});

export default ClientePerfilModal;
