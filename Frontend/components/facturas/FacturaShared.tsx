import React from 'react';
import { ActivityIndicator, StyleSheet, TouchableOpacity, View as RNView, Text as RNText } from 'react-native';
import { formatCurrency, formatDate } from '@/src/shared';
import type { DenominacionesMap } from '@/src/shared';
import { View, Text } from '../../tw';
import { useBreakpoint } from '../../styles/responsive';

import { printReceipt } from '../../utils/printReceipt';
import UpdateTotalModal from './UpdateTotalModal';
import PaymentSelectionModal from '../orders/PaymentSelectionModal';
import Badge from '../ui/Badge';
import Card from '../ui/Card';
import Icon from '../ui/Icon';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface FacturaStats {
  totalDia: number;
  totalPagado: number;
  totalPendiente: number;
  count: number;
}

export interface FacturaProducto {
  productoNombre?: string;
  cantidad?: number;
  precioUnitario?: number;
  subtotal?: number;
}

export interface FacturaOrden {
  ordenId?: number;
  tipoPedido?: string;
  productos?: FacturaProducto[];
}

export interface FacturaDomicilio {
  costoDomicilio?: number;
  direccionEntrega?: string;
  domiciliario?: {
    domiciliarioNombre?: string;
    telefono?: string;
  };
}

export interface FacturaItem {
  facturaId?: number;
  clienteNombre?: string;
  fechaFactura?: string;
  total?: number;
  montoPagado?: number;
  metodo?: string;
  estado?: string;
  descripcion?: string;
  ordenes?: FacturaOrden[];
  domicilios?: FacturaDomicilio[];
  pagoEfectivo?: number;
  pagoTransferencia?: number;
  cuentaTransferenciaId?: number | null;
  cuentaTransferenciaNombre?: string | null;
}

// ─── StatsHeader ──────────────────────────────────────────────────────────────

export const StatsHeader = React.memo(function StatsHeader({
  stats,
  periodLabel = 'Total del Día',
}: {
  stats: FacturaStats;
  periodLabel?: string;
}) {
  const { isMobile } = useBreakpoint();
  return (
    <RNView style={sh.root}>
      {/* Main stat */}
      <Card style={sh.mainCard}>
         <RNView style={sh.mainOverlay} />
         <RNView style={sh.mainIconBox}>
           <Icon name="receipt" size={20} color="#F5A524" />
         </RNView>
         <RNView style={sh.flex1}>
           <RNText style={sh.mainLabel}>{periodLabel}</RNText>
           <RNText style={[sh.mainTotal, { fontSize: isMobile ? 22 : 32 }]}>
              ${formatCurrency(stats.totalDia)}
           </RNText>
           <RNText style={sh.mainCount}>{stats.count} facturas generadas</RNText>
         </RNView>
      </Card>

      {/* Pagado / Pendiente */}
      <RNView style={sh.row}>
        <Card style={sh.pagadoCard}>
          <RNView style={sh.pagadoIconBox}>
            <Icon name="check-circle-outline" size={16} color="#10B981" />
          </RNView>
          <RNView>
            <RNText style={sh.pagadoLabel}>Pagado</RNText>
            <RNText style={sh.pagadoValue}>
              ${formatCurrency(stats.totalPagado)}
            </RNText>
          </RNView>
        </Card>
        <Card style={sh.pendienteCard}>
          <RNView style={sh.pendienteIconBox}>
            <Icon name="clock-outline" size={16} color="#F5A524" />
          </RNView>
          <RNView>
            <RNText style={sh.pendienteLabel}>Pendiente</RNText>
            <RNText style={sh.pendienteValue}>
              ${formatCurrency(stats.totalPendiente)}
            </RNText>
          </RNView>
        </Card>
      </RNView>
    </RNView>
  );
});

const sh = StyleSheet.create({
  root: { gap: 10, marginBottom: 16 },
  mainCard: { overflow: 'hidden', position: 'relative', borderColor: 'rgba(245,165,36,0.15)', backgroundColor: 'rgba(6,14,26,0.8)', flexDirection: 'row', alignItems: 'center', gap: 14 },
  mainOverlay: { position: 'absolute', inset: 0, backgroundColor: 'rgba(245,165,36,0.04)' },
  mainIconBox: { width: 44, height: 44, borderRadius: 14, backgroundColor: 'rgba(245,165,36,0.12)', borderWidth: 1, borderColor: 'rgba(245,165,36,0.2)', alignItems: 'center', justifyContent: 'center' },
  flex1: { flex: 1 },
  mainLabel: { fontFamily: 'Outfit', color: 'rgba(255,255,255,0.5)', fontSize: 10, textTransform: 'uppercase', letterSpacing: 2, marginBottom: 2 },
  mainTotal: { fontFamily: 'SpaceGrotesk-Bold', color: '#F8FAFC' },
  mainCount: { fontFamily: 'Outfit', color: '#64748B', fontSize: 11, marginTop: 2, textTransform: 'uppercase', letterSpacing: 1 },
  row: { flexDirection: 'row', gap: 10 },
  pagadoCard: { flex: 1, backgroundColor: 'rgba(16,185,129,0.07)', borderColor: 'rgba(16,185,129,0.2)', flexDirection: 'row', alignItems: 'center', gap: 10 },
  pagadoIconBox: { width: 36, height: 36, borderRadius: 10, backgroundColor: 'rgba(16,185,129,0.12)', alignItems: 'center', justifyContent: 'center' },
  pagadoLabel: { fontFamily: 'Outfit', color: 'rgba(16,185,129,0.7)', fontSize: 10, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 2 },
  pagadoValue: { fontFamily: 'SpaceGrotesk-Bold', color: '#34D399', fontSize: 20 },
  pendienteCard: { flex: 1, backgroundColor: 'rgba(245,165,36,0.07)', borderColor: 'rgba(245,165,36,0.2)', flexDirection: 'row', alignItems: 'center', gap: 10 },
  pendienteIconBox: { width: 36, height: 36, borderRadius: 10, backgroundColor: 'rgba(245,165,36,0.12)', alignItems: 'center', justifyContent: 'center' },
  pendienteLabel: { fontFamily: 'Outfit', color: 'rgba(245,165,36,0.7)', fontSize: 10, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 2 },
  pendienteValue: { fontFamily: 'SpaceGrotesk-Bold', color: '#F5A524', fontSize: 20 },
});

// ─── EstadoToggle ─────────────────────────────────────────────────────────────

export const EstadoToggle = React.memo(function EstadoToggle({
  estado,
  isUpdating,
  onToggle,
}: {
  estado?: string;
  isUpdating: boolean;
  onToggle: () => void;
}) {
  const isPagado = estado === 'pagado';
  const isCancelado = estado === 'cancelado';

  const variant = isCancelado ? 'danger' : isPagado ? 'success' : 'warning';

  return (
    <View className="flex-row items-center justify-between">
      <Badge label={estado || 'pendiente'} variant={variant} size="md" />

      {!isCancelado && (
          <TouchableOpacity
            onPress={onToggle}
            disabled={isUpdating}
            className={`px-4 py-2 rounded-xl flex-row items-center gap-2 ${isPagado ? 'bg-orange-500/20' : 'bg-emerald-500/20'}`}
          >
            {isUpdating ? (
              <ActivityIndicator size="small" color={isPagado ? '#F5A524' : '#10B981'} />
            ) : (
              <Text className={`font-black text-xs uppercase ${isPagado ? 'text-orange-400' : 'text-emerald-400'}`} numberOfLines={1} ellipsizeMode="tail">
                {isPagado ? 'Marcar Pendiente' : 'Marcar Pagado'}
              </Text>
            )}
          </TouchableOpacity>
      )}
    </View>
  );
});

// ─── FacturaCard ──────────────────────────────────────────────────────────────

export const FacturaCard = React.memo(function FacturaCard({
  item,
  isUpdating,
  onToggleEstado,
  onUpdateTotal,
  onUpdate,
  onDelete,
  onAbono,
  showPrint = false,
  aperturaHecha,
}: {
  item: FacturaItem;
  isUpdating: boolean;
  onToggleEstado: (facturaId: number, nuevoEstado: string, metodo?: string, pagoEfectivo?: number, pagoTransferencia?: number, denominaciones?: DenominacionesMap, cambioDenominaciones?: DenominacionesMap, cuentaTransferenciaId?: number, cuentaTransferenciaNombre?: string) => void;
  onUpdateTotal?: (facturaId: number, newTotal: number) => Promise<void>;
  onUpdate?: (facturaId: number, data: Partial<FacturaItem>) => Promise<void>;
  onDelete?: (facturaId: number) => Promise<boolean>;
  onAbono?: (facturaId: number, monto: number, metodo: 'efectivo' | 'transferencia', denominaciones?: DenominacionesMap, cambioDenominaciones?: DenominacionesMap, cuentaTransferenciaId?: number, cuentaTransferenciaNombre?: string) => void;
  showPrint?: boolean;
  /** When explicitly false, the Cobrar button is disabled until apertura is done */
  aperturaHecha?: boolean;
}) {
  const [editing, setEditing] = React.useState(false);
  const [showPaymentModal, setShowPaymentModal] = React.useState(false);
  const [showAbonoModal, setShowAbonoModal] = React.useState(false);
  const [updateLoading, setUpdateLoading] = React.useState(false);
  const [confirmDelete, setConfirmDelete] = React.useState(false);
  const [deleting, setDeleting] = React.useState(false);

  const handleUpdateTotal = async (newTotal: number) => {
    if (item.facturaId && onUpdateTotal) {
      setUpdateLoading(true);
      try {
        await onUpdateTotal(item.facturaId, newTotal);
        setEditing(false);
        setUpdateLoading(false);
      } catch (err) {
        console.error('Error in onUpdateTotal:', err);
        setUpdateLoading(false);
      }
    }
  };

  const isPagado = item.estado === 'pagado';
  const isCancelado = item.estado === 'cancelado';
  const isParcial = item.estado === 'parcial';
  const saldoPendiente = isParcial ? (item.total ?? 0) - (item.montoPagado ?? 0) : (item.total ?? 0);
  const progresoPct = item.total && item.montoPagado ? Math.min(100, (item.montoPagado / item.total) * 100) : 0;

  // aperturaHecha === false blocks cash-based methods inside the modal; the button itself stays open
  const cobrarDisabled = isUpdating;
  const metodosBloqueados: string[] = aperturaHecha === false ? ['efectivo', 'efectivo_transferencia'] : [];

  const esDomicilio = item.ordenes?.some(o => o.tipoPedido === 'domicilio');
  const costoDomicilio = item.domicilios?.[0]?.costoDomicilio
    ? Number(item.domicilios[0].costoDomicilio)
    : 0;

  const handlePrint = () => {
    const productos = (item.ordenes ?? []).flatMap(o =>
      (o.productos ?? []).map(p => ({
        nombre: p.productoNombre || 'Producto',
        cantidad: p.cantidad ?? 1,
        precioUnitario: p.precioUnitario ?? 0,
      })),
    );
    printReceipt({
      ordenId: item.facturaId,
      clienteNombre: item.clienteNombre || 'N/A',
      metodo: item.metodo || 'N/A',
      productos,
      total: item.total ?? 0,
      fecha: item.fechaFactura,
    });
  };

  const accentColor = isCancelado ? '#F43F5E' : isPagado ? '#10B981' : '#F5A524';
  const bgTint = isCancelado
    ? 'rgba(244,63,94,0.04)'
    : isPagado
    ? 'rgba(16,185,129,0.04)'
    : 'rgba(245,165,36,0.04)';

  const direccionDomicilio = item.domicilios?.[0]?.direccionEntrega;
  const domiciliarioNombre = item.domicilios?.[0]?.domiciliario?.domiciliarioNombre;

  return (
    <Card style={fc.card}>
      {/* Fondo tintado según estado */}
      <RNView style={[fc.tintOverlay, { backgroundColor: bgTint }]} pointerEvents="none" />
      {/* Stripe izquierdo semántico */}
      <RNView style={[fc.stripe, { backgroundColor: accentColor }]} pointerEvents="none" />

      <RNView style={fc.body}>
        {/* ── Header ── */}
        <RNView style={fc.header}>
          <RNView style={fc.headerLeft}>
            <RNText style={fc.cliente} numberOfLines={1}>
              {item.clienteNombre || 'Cliente S/N'}
            </RNText>
            <RNText style={fc.fecha}>
              {formatDate(item.fechaFactura)}
            </RNText>
          </RNView>
          <RNView style={fc.headerRight}>
            <RNText style={fc.total}>
              ${formatCurrency(item.total ?? 0)}
            </RNText>
            {item.metodo ? (
              <Badge
                label={item.metodo === 'efectivo_transferencia' ? 'Mixto' : item.metodo}
                variant="info"
                size="sm"
              />
            ) : (
              <Badge label="Sin método" variant="neutral" size="sm" />
            )}
            {item.cuentaTransferenciaNombre && (
              <RNText style={{ fontFamily: 'Outfit', color: '#A78BFA', fontSize: 10, fontWeight: '700' }}>
                QR: {item.cuentaTransferenciaNombre}
              </RNText>
            )}
            {/* Desglose pago mixto */}
            {item.metodo === 'efectivo_transferencia' && (
              <RNView style={fc.mixtoBox}>
                {(item.pagoEfectivo ?? 0) > 0 && (
                  <RNView style={fc.mixtoRow}>
                    <RNText style={fc.mixtoEfectivo}>💵</RNText>
                    <RNText numberOfLines={1} style={fc.mixtoEfectivoValor}>
                      ${formatCurrency(item.pagoEfectivo!)}
                    </RNText>
                  </RNView>
                )}
                {(item.pagoTransferencia ?? 0) > 0 && (
                  <RNView style={fc.mixtoRow}>
                    <RNText style={fc.mixtoTransfer}>🔁</RNText>
                    <RNText numberOfLines={1} style={fc.mixtoTransferValor}>
                      ${formatCurrency(item.pagoTransferencia!)}
                    </RNText>
                  </RNView>
                )}
              </RNView>
            )}
          </RNView>
        </RNView>

        {/* ── Tags: domicilio + dirección ── */}
        {(esDomicilio || direccionDomicilio) && (
          <RNView style={fc.tagsRow}>
            {esDomicilio && (
              <RNView style={fc.domicilioTag}>
                <Icon name="moped-outline" size={12} color="#FB923C" />
                <RNText style={fc.domicilioTagText}>
                  Domicilio{costoDomicilio > 0 ? `  +$${formatCurrency(costoDomicilio)}` : ''}
                </RNText>
                {domiciliarioNombre && (
                  <>
                    <RNView style={fc.domicilioDot} />
                    <RNText style={fc.domiciliarioNombre}>
                      {domiciliarioNombre}
                    </RNText>
                  </>
                )}
              </RNView>
            )}
            {direccionDomicilio && (
              <RNView style={fc.direccionRow}>
                <Icon name="map-marker-outline" size={11} color="#475569" />
                <RNText style={fc.direccionText} numberOfLines={1}>
                  {direccionDomicilio}
                </RNText>
              </RNView>
            )}
          </RNView>
        )}

        {/* ── Notas ── */}
        {item.descripcion ? (
          <RNView style={fc.notasBox}>
            <RNText style={fc.notasLabel}>Notas</RNText>
            <RNText style={fc.notasText}>'{item.descripcion}'</RNText>
          </RNView>
        ) : null}

        {/* ── Productos ── */}
        {item.ordenes && item.ordenes.length > 0 && (
          <RNView style={fc.productosBox}>
            <RNText style={fc.productosLabel}>Productos</RNText>
            {item.ordenes.map((orden, oIdx) =>
              orden.productos?.map((op, pIdx) => (
                <RNView key={`${oIdx}-${pIdx}`} style={fc.productoRow}>
                  <RNView style={fc.productoInfo}>
                    <RNText style={fc.productoNombre} numberOfLines={1}>
                      {op.productoNombre}
                    </RNText>
                    <RNText style={fc.productoCantidad}>
                      {op.cantidad}× ${formatCurrency(op.precioUnitario ?? 0)}
                    </RNText>
                  </RNView>
                  <RNText style={fc.productoSubtotal}>
                    ${formatCurrency(op.subtotal ?? 0)}
                  </RNText>
                </RNView>
              ))
            )}
          </RNView>
        )}

        {/* ── Barra de progreso de abono ── */}
        {isParcial && (item.montoPagado ?? 0) > 0 && (
          <RNView style={fc.abonoBox}>
            <RNView style={fc.abonoHeader}>
              <RNText style={fc.abonoLabel}>
                Abonado ${formatCurrency(item.montoPagado ?? 0)}
              </RNText>
              <RNText style={fc.abonoSaldo}>
                Saldo ${formatCurrency(saldoPendiente)}
              </RNText>
            </RNView>
            <RNView style={fc.progressTrack}>
              <RNView style={[fc.progressFill, { width: `${progresoPct}%` }]} />
            </RNView>
          </RNView>
        )}

        {/* ── Footer de acciones ── */}
        <RNView style={fc.footer}>
          {/* Izquierda: print */}
          <RNView style={fc.footerGroup}>
            {showPrint && (
              <TouchableOpacity onPress={handlePrint} style={fc.printBtn}>
                <Icon name="printer-outline" size={15} color="#60A5FA" />
              </TouchableOpacity>
            )}
            {onDelete && item.facturaId && (
              confirmDelete ? (
                <TouchableOpacity
                  onPress={async () => {
                    setDeleting(true);
                    await onDelete(item.facturaId!);
                    setDeleting(false);
                    setConfirmDelete(false);
                  }}
                  disabled={deleting}
                  style={fc.confirmDeleteBtn}
                >
                  {deleting
                    ? <ActivityIndicator size="small" color="#F43F5E" />
                    : <>
                        <Icon name="alert-outline" size={13} color="#F87171" />
                        <RNText style={fc.confirmDeleteText} numberOfLines={1} ellipsizeMode="tail">Confirmar</RNText>
                      </>
                  }
                </TouchableOpacity>
              ) : (
                <TouchableOpacity onPress={() => setConfirmDelete(true)} style={fc.deleteBtn}>
                  <Icon name="trash-can-outline" size={15} color="#F43F5E" />
                </TouchableOpacity>
              )
            )}
          </RNView>

          {/* Derecha: editar + abonar + cobrar/revertir */}
          <RNView style={fc.footerGroup}>
            {!isCancelado && (
              <TouchableOpacity onPress={() => setEditing(true)} style={fc.editBtn}>
                <Icon name="pencil-outline" size={15} color="#64748B" />
              </TouchableOpacity>
            )}
            {(isParcial || item.estado === 'pendiente') && onAbono && aperturaHecha !== false && (
              <TouchableOpacity
                onPress={() => setShowAbonoModal(true)}
                disabled={isUpdating}
                style={[fc.abonarBtn, { opacity: isUpdating ? 0.5 : 1 }]}
              >
                <Icon name="cash-plus" size={14} color="#F5A524" />
                <RNText style={fc.abonarText}>Abonar</RNText>
              </TouchableOpacity>
            )}
            {!isCancelado && (
              <TouchableOpacity
                onPress={() => {
                  if (isPagado) {
                    item.facturaId && onToggleEstado(item.facturaId, 'pendiente');
                  } else {
                    setShowPaymentModal(true);
                  }
                }}
                disabled={cobrarDisabled}
                style={[
                  fc.cobrarBtn,
                  {
                    backgroundColor: isPagado ? 'rgba(245,165,36,0.1)' : 'rgba(16,185,129,0.12)',
                    borderColor: isPagado ? 'rgba(245,165,36,0.2)' : 'rgba(16,185,129,0.25)',
                    opacity: cobrarDisabled ? 0.5 : 1,
                  },
                ]}
              >
                {isUpdating ? (
                  <ActivityIndicator size="small" color={isPagado ? '#F5A524' : '#10B981'} />
                ) : (
                  <>
                    <Icon
                      name={isPagado ? 'undo-variant' : 'check-circle-outline'}
                      size={14}
                      color={isPagado ? '#F5A524' : '#10B981'}
                    />
                    <RNText style={[fc.cobrarText, { color: isPagado ? '#F5A524' : '#10B981' }]} numberOfLines={1} ellipsizeMode="tail">
                      {isPagado ? 'Revertir' : 'Cobrar'}
                    </RNText>
                  </>
                )}
              </TouchableOpacity>
            )}
          </RNView>
        </RNView>
      </RNView>

      {/* ── Barra de estado en la base ── */}
      <RNView style={[fc.bottomBar, { backgroundColor: accentColor, opacity: isCancelado ? 0.6 : 0.85 }]} />

      <UpdateTotalModal
        visible={editing}
        currentTotal={item.total ?? 0}
        loading={updateLoading}
        onConfirm={handleUpdateTotal}
        onCancel={() => setEditing(false)}
      />

      <PaymentSelectionModal
        visible={showPaymentModal}
        total={item.total ?? 0}
        disabledMethods={metodosBloqueados}
        onClose={() => setShowPaymentModal(false)}
        onSelect={(method, pagoEfectivo, pagoTransferencia, denominaciones, cambioDenominaciones, cuentaId, cuentaNombre) => {
          setShowPaymentModal(false);
          if (item.facturaId) {
            onToggleEstado(item.facturaId, 'pagado', method, pagoEfectivo, pagoTransferencia, denominaciones, cambioDenominaciones, cuentaId, cuentaNombre);
          }
        }}
        loading={isUpdating}
      />

      <PaymentSelectionModal
        visible={showAbonoModal}
        total={item.total ?? 0}
        mode="partial"
        totalPendiente={saldoPendiente}
        disabledMethods={metodosBloqueados}
        onClose={() => setShowAbonoModal(false)}
        onSelect={(method, pagoEfectivo, pagoTransferencia, denominaciones, cambioDenominaciones, cuentaId, cuentaNombre) => {
          setShowAbonoModal(false);
          if (item.facturaId && onAbono) {
            const esQr = method === 'transferencia';
            onAbono(
              item.facturaId,
              (esQr ? pagoTransferencia : pagoEfectivo) ?? 0,
              esQr ? 'transferencia' : 'efectivo',
              denominaciones,
              cambioDenominaciones,
              cuentaId,
              cuentaNombre,
            );
          }
        }}
        loading={isUpdating}
      />
    </Card>
  );
});

const fc = StyleSheet.create({
  card: { overflow: 'hidden', borderWidth: 0, padding: 0, marginBottom: 12, backgroundColor: 'rgba(15,23,42,0.7)' },
  tintOverlay: { position: 'absolute', inset: 0 },
  stripe: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 3, opacity: 0.7 },
  body: { padding: 14, paddingLeft: 17 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 },
  headerLeft: { flex: 1, paddingRight: 12 },
  cliente: { fontFamily: 'SpaceGrotesk-Bold', color: '#F8FAFC', fontSize: 17, textTransform: 'uppercase', lineHeight: 21 },
  fecha: { fontFamily: 'Outfit', color: '#64748B', fontSize: 10, marginTop: 2 },
  headerRight: { alignItems: 'flex-end', gap: 4 },
  total: { fontFamily: 'SpaceGrotesk-Bold', color: '#F8FAFC', fontSize: 18 },
  mixtoBox: { alignItems: 'flex-end', gap: 2, marginTop: 2, maxWidth: '100%' },
  mixtoRow: { flexDirection: 'row', alignItems: 'center', gap: 4, maxWidth: '100%' },
  mixtoEfectivo: { fontFamily: 'Outfit', color: '#10B981', fontSize: 10 },
  mixtoEfectivoValor: { fontFamily: 'Outfit', color: '#10B981', fontSize: 10, flexShrink: 1 },
  mixtoTransfer: { fontFamily: 'Outfit', color: '#60A5FA', fontSize: 10 },
  mixtoTransferValor: { fontFamily: 'Outfit', color: '#60A5FA', fontSize: 10, flexShrink: 1 },
  tagsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 10 },
  domicilioTag: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(249,115,22,0.1)', borderWidth: 1, borderColor: 'rgba(249,115,22,0.2)', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  domicilioTagText: { fontFamily: 'Outfit', color: '#FB923C', fontSize: 10, fontWeight: '900', textTransform: 'uppercase' },
  domicilioDot: { width: 4, height: 4, borderRadius: 2, backgroundColor: 'rgba(249,115,22,0.5)', marginHorizontal: 2 },
  domiciliarioNombre: { fontFamily: 'Outfit', color: '#FB923C', fontSize: 10, fontWeight: 'bold' },
  direccionRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  direccionText: { fontFamily: 'Outfit', color: '#475569', fontSize: 10 },
  notasBox: { backgroundColor: 'rgba(255,255,255,0.03)', padding: 10, borderRadius: 10, borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)', marginBottom: 8 },
  notasLabel: { fontFamily: 'Outfit', color: '#475569', fontSize: 9, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 3 },
  notasText: { fontFamily: 'Outfit', color: '#94A3B8', fontSize: 11, fontStyle: 'italic' },
  productosBox: { borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.05)', paddingTop: 8, marginBottom: 10 },
  productosLabel: { fontFamily: 'Outfit', color: '#334155', fontSize: 9, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 },
  productoRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 },
  productoInfo: { flex: 1, paddingRight: 12 },
  productoNombre: { fontFamily: 'Outfit', color: 'rgba(255,255,255,0.8)', fontSize: 12 },
  productoCantidad: { fontFamily: 'Outfit', color: '#475569', fontSize: 10 },
  productoSubtotal: { fontFamily: 'SpaceGrotesk-Bold', color: '#CBD5E1', fontSize: 12 },
  abonoBox: { marginBottom: 10 },
  abonoHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  abonoLabel: { fontFamily: 'Outfit', color: '#F5A524', fontSize: 9, textTransform: 'uppercase', letterSpacing: 1, fontWeight: '900' },
  abonoSaldo: { fontFamily: 'Outfit', color: '#64748B', fontSize: 9, textTransform: 'uppercase', letterSpacing: 1 },
  progressTrack: { height: 5, backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 3, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: '#F5A524', borderRadius: 3 },
  footer: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8, paddingTop: 10, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.05)' },
  footerGroup: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  printBtn: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(59,130,246,0.12)', borderRadius: 10, borderWidth: 1, borderColor: 'rgba(59,130,246,0.2)' },
  confirmDeleteBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 7, borderRadius: 10, backgroundColor: 'rgba(244,63,94,0.15)', borderWidth: 1, borderColor: 'rgba(244,63,94,0.3)' },
  confirmDeleteText: { fontFamily: 'Outfit', color: '#F87171', fontSize: 11, fontWeight: '900', textTransform: 'uppercase' },
  deleteBtn: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(244,63,94,0.08)', borderRadius: 10, borderWidth: 1, borderColor: 'rgba(244,63,94,0.15)' },
  editBtn: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 10, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' },
  abonarBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, backgroundColor: 'rgba(245,165,36,0.1)', borderWidth: 1, borderColor: 'rgba(245,165,36,0.25)' },
  abonarText: { fontFamily: 'Outfit', fontSize: 11, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 0.5, color: '#F5A524' },
  cobrarBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10, borderWidth: 1 },
  cobrarText: { fontFamily: 'Outfit', fontSize: 11, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 0.5 },
  bottomBar: { height: 4 },
});
