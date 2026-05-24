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
      <Card style={{ overflow: 'hidden', position: 'relative', borderColor: 'rgba(245,165,36,0.15)', backgroundColor: 'rgba(6,14,26,0.8)' }}>
         <RNView style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(245,165,36,0.04)' }} />
         <RNText style={{ fontFamily: 'Outfit', color: 'rgba(255,255,255,0.5)', fontSize: 10, textTransform: 'uppercase', letterSpacing: 2, marginBottom: 4 }}>{periodLabel}</RNText>
         <RNText style={{ fontFamily: 'SpaceGrotesk-Bold', color: '#F8FAFC', fontSize: isMobile ? 22 : 32 }}>
            ${formatCurrency(stats.totalDia)}
         </RNText>
         <RNText style={{ fontFamily: 'Outfit', color: '#64748B', fontSize: 11, marginTop: 4, textTransform: 'uppercase', letterSpacing: 1 }}>{stats.count} facturas generadas</RNText>
      </Card>

      {/* Pagado / Pendiente */}
      <RNView style={{ flexDirection: 'row', gap: 10 }}>
        <Card style={{ flex: 1, backgroundColor: 'rgba(16,185,129,0.07)', borderColor: 'rgba(16,185,129,0.2)' }}>
          <RNText style={{ fontFamily: 'Outfit', color: 'rgba(16,185,129,0.7)', fontSize: 10, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 }}>Pagado</RNText>
          <RNText style={{ fontFamily: 'SpaceGrotesk-Bold', color: '#34D399', fontSize: 20 }}>
            ${formatCurrency(stats.totalPagado)}
          </RNText>
        </Card>
        <Card style={{ flex: 1, backgroundColor: 'rgba(245,165,36,0.07)', borderColor: 'rgba(245,165,36,0.2)' }}>
          <RNText style={{ fontFamily: 'Outfit', color: 'rgba(245,165,36,0.7)', fontSize: 10, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 }}>Pendiente</RNText>
          <RNText style={{ fontFamily: 'SpaceGrotesk-Bold', color: '#F5A524', fontSize: 20 }}>
            ${formatCurrency(stats.totalPendiente)}
          </RNText>
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
  showPrint = false,
  aperturaHecha,
}: {
  item: FacturaItem;
  isUpdating: boolean;
  onToggleEstado: (facturaId: number, nuevoEstado: string, metodo?: string, pagoEfectivo?: number, pagoTransferencia?: number, denominaciones?: DenominacionesMap, cambioDenominaciones?: DenominacionesMap) => void;
  onUpdateTotal?: (facturaId: number, newTotal: number) => Promise<void>;
  onUpdate?: (facturaId: number, data: Partial<FacturaItem>) => Promise<void>;
  onDelete?: (facturaId: number) => Promise<boolean>;
  showPrint?: boolean;
  /** When explicitly false, the Cobrar button is disabled until apertura is done */
  aperturaHecha?: boolean;
}) {
  const [editing, setEditing] = React.useState(false);
  const [showPaymentModal, setShowPaymentModal] = React.useState(false);
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
  const variant = isCancelado ? 'danger' : isPagado ? 'success' : 'warning';

  // aperturaHecha === false (explicit) blocks Cobrar; undefined keeps backward-compat (open)
  const cobrarBloqueado = !isCancelado && aperturaHecha === false && !isPagado;
  const cobrarDisabled = isUpdating || cobrarBloqueado;
  
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

      <RNView style={{ padding: 14 }}>
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

          {/* Derecha: editar + cobrar/revertir */}
          <RNView style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            {!isCancelado && (
              <TouchableOpacity
                onPress={() => setEditing(true)}
                style={{ width: 34, height: 34, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 10, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' }}
              >
                <Icon name="pencil-outline" size={15} color="#64748B" />
              </TouchableOpacity>
            )}
            {!isCancelado && (
              <TouchableOpacity
                onPress={() => {
                  if (cobrarBloqueado) return;
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
                  backgroundColor: cobrarBloqueado
                    ? 'rgba(100,116,139,0.08)'
                    : isPagado ? 'rgba(245,165,36,0.1)' : 'rgba(16,185,129,0.12)',
                  borderWidth: 1,
                  borderColor: cobrarBloqueado
                    ? 'rgba(100,116,139,0.15)'
                    : isPagado ? 'rgba(245,165,36,0.2)' : 'rgba(16,185,129,0.25)',
                  opacity: cobrarDisabled && !cobrarBloqueado ? 0.5 : 1,
                }}
              >
                {isUpdating ? (
                  <ActivityIndicator size="small" color={isPagado ? '#F5A524' : '#10B981'} />
                ) : (
                  <>
                    <Icon
                      name={cobrarBloqueado ? 'lock-outline' : isPagado ? 'undo-variant' : 'check-circle-outline'}
                      size={14}
                      color={cobrarBloqueado ? '#475569' : isPagado ? '#F5A524' : '#10B981'}
                    />
                    <RNText style={{ fontFamily: 'Outfit', fontSize: 11, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 0.5, color: cobrarBloqueado ? '#475569' : isPagado ? '#F5A524' : '#10B981' }} numberOfLines={1} ellipsizeMode="tail">
                      {cobrarBloqueado ? 'Sin arqueo' : isPagado ? 'Revertir' : 'Cobrar'}
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
        onClose={() => setShowPaymentModal(false)}
        onSelect={(method, pagoEfectivo, pagoTransferencia, denominaciones, cambioDenominaciones) => {
          setShowPaymentModal(false);
          if (item.facturaId) {
            onToggleEstado(item.facturaId, 'pagado', method, pagoEfectivo, pagoTransferencia, denominaciones, cambioDenominaciones);
          }
        }}
        loading={isUpdating}
      />
    </Card>
  );
}
