import React from 'react';
import { ActivityIndicator, TouchableOpacity, View as RNView, Text as RNText } from 'react-native';
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
}

// ─── StatsHeader ──────────────────────────────────────────────────────────────

export function StatsHeader({
  stats,
  periodLabel = 'Total del Día',
}: {
  stats: FacturaStats;
  periodLabel?: string;
}) {
  const { isMobile } = useBreakpoint();
  return (
    <RNView style={{ gap: 10, marginBottom: 16 }}>
      {/* Main stat */}
      <Card style={{ overflow: 'hidden', position: 'relative', borderColor: 'rgba(245,165,36,0.15)', backgroundColor: 'rgba(6,14,26,0.8)', flexDirection: 'row', alignItems: 'center', gap: 14 }}>
         <RNView style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(245,165,36,0.04)' }} />
         <RNView style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: 'rgba(245,165,36,0.12)', borderWidth: 1, borderColor: 'rgba(245,165,36,0.2)', alignItems: 'center', justifyContent: 'center' }}>
           <Icon name="receipt" size={20} color="#F5A524" />
         </RNView>
         <RNView style={{ flex: 1 }}>
           <RNText style={{ fontFamily: 'Outfit', color: 'rgba(255,255,255,0.5)', fontSize: 10, textTransform: 'uppercase', letterSpacing: 2, marginBottom: 2 }}>{periodLabel}</RNText>
           <RNText style={{ fontFamily: 'SpaceGrotesk-Bold', color: '#F8FAFC', fontSize: isMobile ? 22 : 32 }}>
              ${formatCurrency(stats.totalDia)}
           </RNText>
           <RNText style={{ fontFamily: 'Outfit', color: '#64748B', fontSize: 11, marginTop: 2, textTransform: 'uppercase', letterSpacing: 1 }}>{stats.count} facturas generadas</RNText>
         </RNView>
      </Card>

      {/* Pagado / Pendiente */}
      <RNView style={{ flexDirection: 'row', gap: 10 }}>
        <Card style={{ flex: 1, backgroundColor: 'rgba(16,185,129,0.07)', borderColor: 'rgba(16,185,129,0.2)', flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <RNView style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: 'rgba(16,185,129,0.12)', alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="check-circle-outline" size={16} color="#10B981" />
          </RNView>
          <RNView>
            <RNText style={{ fontFamily: 'Outfit', color: 'rgba(16,185,129,0.7)', fontSize: 10, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 2 }}>Pagado</RNText>
            <RNText style={{ fontFamily: 'SpaceGrotesk-Bold', color: '#34D399', fontSize: 20 }}>
              ${formatCurrency(stats.totalPagado)}
            </RNText>
          </RNView>
        </Card>
        <Card style={{ flex: 1, backgroundColor: 'rgba(245,165,36,0.07)', borderColor: 'rgba(245,165,36,0.2)', flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <RNView style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: 'rgba(245,165,36,0.12)', alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="clock-outline" size={16} color="#F5A524" />
          </RNView>
          <RNView>
            <RNText style={{ fontFamily: 'Outfit', color: 'rgba(245,165,36,0.7)', fontSize: 10, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 2 }}>Pendiente</RNText>
            <RNText style={{ fontFamily: 'SpaceGrotesk-Bold', color: '#F5A524', fontSize: 20 }}>
              ${formatCurrency(stats.totalPendiente)}
            </RNText>
          </RNView>
        </Card>
      </RNView>
    </RNView>
  );
}

// ─── EstadoToggle ─────────────────────────────────────────────────────────────

export function EstadoToggle({
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
}

// ─── FacturaCard ──────────────────────────────────────────────────────────────

export function FacturaCard({
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
  onToggleEstado: (facturaId: number, nuevoEstado: string, metodo?: string, pagoEfectivo?: number, pagoTransferencia?: number, denominaciones?: DenominacionesMap, cambioDenominaciones?: DenominacionesMap) => void;
  onUpdateTotal?: (facturaId: number, newTotal: number) => Promise<void>;
  onUpdate?: (facturaId: number, data: Partial<FacturaItem>) => Promise<void>;
  onDelete?: (facturaId: number) => Promise<boolean>;
  onAbono?: (facturaId: number, monto: number, denominaciones?: DenominacionesMap, cambioDenominaciones?: DenominacionesMap) => void;
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

  return (
    <Card style={{ overflow: 'hidden', borderWidth: 0, padding: 0, marginBottom: 12, backgroundColor: `rgba(15,23,42,0.7)` }}>
      {/* Fondo tintado según estado */}
      <RNView style={{ position: 'absolute', inset: 0, backgroundColor: bgTint }} pointerEvents="none" />
      {/* Stripe izquierdo semántico */}
      <RNView style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 3, backgroundColor: accentColor, opacity: 0.7 }} pointerEvents="none" />

      <RNView style={{ padding: 14, paddingLeft: 17 }}>
        {/* ── Header ── */}
        <RNView style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
          <RNView style={{ flex: 1, paddingRight: 12 }}>
            <RNText
              style={{ fontFamily: 'SpaceGrotesk-Bold', color: '#F8FAFC', fontSize: 17, textTransform: 'uppercase', lineHeight: 21 }}
              numberOfLines={1}
            >
              {item.clienteNombre || 'Cliente S/N'}
            </RNText>
            <RNText style={{ fontFamily: 'Outfit', color: '#64748B', fontSize: 10, marginTop: 2 }}>
              {formatDate(item.fechaFactura)}
            </RNText>
          </RNView>
          <RNView style={{ alignItems: 'flex-end', gap: 4 }}>
            <RNText style={{ fontFamily: 'SpaceGrotesk-Bold', color: '#F8FAFC', fontSize: 18 }}>
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
            {/* Desglose pago mixto */}
            {item.metodo === 'efectivo_transferencia' && (
              <RNView style={{ alignItems: 'flex-end', gap: 2, marginTop: 2, maxWidth: '100%' }}>
                {(item.pagoEfectivo ?? 0) > 0 && (
                  <RNView style={{ flexDirection: 'row', alignItems: 'center', gap: 4, maxWidth: '100%' }}>
                    <RNText style={{ fontFamily: 'Outfit', color: '#10B981', fontSize: 10 }}>💵</RNText>
                    <RNText numberOfLines={1} style={{ fontFamily: 'Outfit', color: '#10B981', fontSize: 10, flexShrink: 1 }}>
                      ${formatCurrency(item.pagoEfectivo!)}
                    </RNText>
                  </RNView>
                )}
                {(item.pagoTransferencia ?? 0) > 0 && (
                  <RNView style={{ flexDirection: 'row', alignItems: 'center', gap: 4, maxWidth: '100%' }}>
                    <RNText style={{ fontFamily: 'Outfit', color: '#60A5FA', fontSize: 10 }}>🔁</RNText>
                    <RNText numberOfLines={1} style={{ fontFamily: 'Outfit', color: '#60A5FA', fontSize: 10, flexShrink: 1 }}>
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
          <RNView style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
            {esDomicilio && (
              <RNView style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(249,115,22,0.1)', borderWidth: 1, borderColor: 'rgba(249,115,22,0.2)', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 }}>
                <Icon name="moped-outline" size={12} color="#FB923C" />
                <RNText style={{ fontFamily: 'Outfit', color: '#FB923C', fontSize: 10, fontWeight: '900', textTransform: 'uppercase' }}>
                  Domicilio{costoDomicilio > 0 ? `  +$${formatCurrency(costoDomicilio)}` : ''}
                </RNText>
              </RNView>
            )}
            {direccionDomicilio && (
              <RNView style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <Icon name="map-marker-outline" size={11} color="#475569" />
                <RNText style={{ fontFamily: 'Outfit', color: '#475569', fontSize: 10 }} numberOfLines={1}>
                  {direccionDomicilio}
                </RNText>
              </RNView>
            )}
          </RNView>
        )}

        {/* ── Notas ── */}
        {item.descripcion && (
          <RNView style={{ backgroundColor: 'rgba(255,255,255,0.03)', padding: 10, borderRadius: 10, borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)', marginBottom: 8 }}>
            <RNText style={{ fontFamily: 'Outfit', color: '#475569', fontSize: 9, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 3 }}>Notas</RNText>
            <RNText style={{ fontFamily: 'Outfit', color: '#94A3B8', fontSize: 11, fontStyle: 'italic' }}>'{item.descripcion}'</RNText>
          </RNView>
        )}

        {/* ── Productos ── */}
        {item.ordenes && item.ordenes.length > 0 && (
          <RNView style={{ borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.05)', paddingTop: 8, marginBottom: 10 }}>
            <RNText style={{ fontFamily: 'Outfit', color: '#334155', fontSize: 9, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 }}>Productos</RNText>
            {item.ordenes.map((orden, oIdx) =>
              orden.productos?.map((op, pIdx) => (
                <RNView key={`${oIdx}-${pIdx}`} style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
                  <RNView style={{ flex: 1, paddingRight: 12 }}>
                    <RNText style={{ fontFamily: 'Outfit', color: 'rgba(255,255,255,0.8)', fontSize: 12 }} numberOfLines={1}>
                      {op.productoNombre}
                    </RNText>
                    <RNText style={{ fontFamily: 'Outfit', color: '#475569', fontSize: 10 }}>
                      {op.cantidad}× ${formatCurrency(op.precioUnitario ?? 0)}
                    </RNText>
                  </RNView>
                  <RNText style={{ fontFamily: 'SpaceGrotesk-Bold', color: '#CBD5E1', fontSize: 12 }}>
                    ${formatCurrency(op.subtotal ?? 0)}
                  </RNText>
                </RNView>
              ))
            )}
          </RNView>
        )}

        {/* ── Barra de progreso de abono ── */}
        {isParcial && (item.montoPagado ?? 0) > 0 && (
          <RNView style={{ marginBottom: 10 }}>
            <RNView style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
              <RNText style={{ fontFamily: 'Outfit', color: '#F5A524', fontSize: 9, textTransform: 'uppercase', letterSpacing: 1, fontWeight: '900' }}>
                Abonado ${formatCurrency(item.montoPagado ?? 0)}
              </RNText>
              <RNText style={{ fontFamily: 'Outfit', color: '#64748B', fontSize: 9, textTransform: 'uppercase', letterSpacing: 1 }}>
                Saldo ${formatCurrency(saldoPendiente)}
              </RNText>
            </RNView>
            <RNView style={{ height: 5, backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 3, overflow: 'hidden' }}>
              <RNView style={{ height: '100%', width: `${progresoPct}%`, backgroundColor: '#F5A524', borderRadius: 3 }} />
            </RNView>
          </RNView>
        )}

        {/* ── Footer de acciones ── */}
        <RNView style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8, paddingTop: 10, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.05)' }}>
          {/* Izquierda: print */}
          <RNView style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            {showPrint && (
              <TouchableOpacity
                onPress={handlePrint}
                style={{ width: 34, height: 34, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(59,130,246,0.12)', borderRadius: 10, borderWidth: 1, borderColor: 'rgba(59,130,246,0.2)' }}
              >
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
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 7, borderRadius: 10, backgroundColor: 'rgba(244,63,94,0.15)', borderWidth: 1, borderColor: 'rgba(244,63,94,0.3)' }}
                >
                  {deleting
                    ? <ActivityIndicator size="small" color="#F43F5E" />
                    : <>
                        <Icon name="alert-outline" size={13} color="#F87171" />
                        <RNText style={{ fontFamily: 'Outfit', color: '#F87171', fontSize: 11, fontWeight: '900', textTransform: 'uppercase' }} numberOfLines={1} ellipsizeMode="tail">Confirmar</RNText>
                      </>
                  }
                </TouchableOpacity>
              ) : (
                <TouchableOpacity
                  onPress={() => setConfirmDelete(true)}
                  style={{ width: 34, height: 34, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(244,63,94,0.08)', borderRadius: 10, borderWidth: 1, borderColor: 'rgba(244,63,94,0.15)' }}
                >
                  <Icon name="trash-can-outline" size={15} color="#F43F5E" />
                </TouchableOpacity>
              )
            )}
          </RNView>

          {/* Derecha: editar + abonar + cobrar/revertir */}
          <RNView style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            {!isCancelado && (
              <TouchableOpacity
                onPress={() => setEditing(true)}
                style={{ width: 34, height: 34, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 10, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' }}
              >
                <Icon name="pencil-outline" size={15} color="#64748B" />
              </TouchableOpacity>
            )}
            {(isParcial || item.estado === 'pendiente') && onAbono && aperturaHecha !== false && (
              <TouchableOpacity
                onPress={() => setShowAbonoModal(true)}
                disabled={isUpdating}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, backgroundColor: 'rgba(245,165,36,0.1)', borderWidth: 1, borderColor: 'rgba(245,165,36,0.25)', opacity: isUpdating ? 0.5 : 1 }}
              >
                <Icon name="cash-plus" size={14} color="#F5A524" />
                <RNText style={{ fontFamily: 'Outfit', fontSize: 11, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 0.5, color: '#F5A524' }}>Abonar</RNText>
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
                style={{
                  flexDirection: 'row', alignItems: 'center', gap: 6,
                  paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10,
                  backgroundColor: isPagado ? 'rgba(245,165,36,0.1)' : 'rgba(16,185,129,0.12)',
                  borderWidth: 1,
                  borderColor: isPagado ? 'rgba(245,165,36,0.2)' : 'rgba(16,185,129,0.25)',
                  opacity: cobrarDisabled ? 0.5 : 1,
                }}
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
                    <RNText style={{ fontFamily: 'Outfit', fontSize: 11, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 0.5, color: isPagado ? '#F5A524' : '#10B981' }} numberOfLines={1} ellipsizeMode="tail">
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
      <RNView style={{ height: 4, backgroundColor: accentColor, opacity: isCancelado ? 0.6 : 0.85 }} />

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
        onSelect={(method, pagoEfectivo, pagoTransferencia, denominaciones, cambioDenominaciones) => {
          setShowPaymentModal(false);
          if (item.facturaId) {
            onToggleEstado(item.facturaId, 'pagado', method, pagoEfectivo, pagoTransferencia, denominaciones, cambioDenominaciones);
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
        onSelect={(_, monto, __, denominaciones, cambioDenominaciones) => {
          setShowAbonoModal(false);
          if (item.facturaId && onAbono) {
            onAbono(item.facturaId, monto ?? 0, denominaciones, cambioDenominaciones);
          }
        }}
        loading={isUpdating}
      />
    </Card>
  );
}
