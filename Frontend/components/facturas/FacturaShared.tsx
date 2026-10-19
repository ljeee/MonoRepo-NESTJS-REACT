import React from 'react';
import { ActivityIndicator, StyleSheet, TouchableOpacity, View as RNView, Text as RNText } from 'react-native';
import { formatCurrency, formatCOP, formatDate, montoEfectivo, montoTransferencia, transferenciasPorCuenta, useToast } from '@/src/shared';
import type { DenominacionesMap, DesgloseTransferencia, FacturaOrden, FacturaDomicilio, FacturaStats } from '@/src/shared';
import { View, Text } from '../../tw';

import { printReceipt } from '../../utils/printReceipt';
import PaymentSelectionModal from '../orders/PaymentSelectionModal';
import { PromptModal, OptionPickerModal, StatCard } from '../ui';
import { useCuentasTransferencia } from '../../hooks/use-cuentas-transferencia';
import Badge from '../ui/Badge';
import Card from '../ui/Card';
import Icon from '../ui/Icon';

// ─── Types ────────────────────────────────────────────────────────────────────

// Tipos de dominio: una sola definición en src/shared (antes había copias aquí).
export type { FacturaStats, FacturaOrden, FacturaDomicilio } from '@/src/shared';

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
  desgloseTransferencia?: DesgloseTransferencia[] | null;
}

// ─── StatsHeader ──────────────────────────────────────────────────────────────

/** Total, pagado y pendiente del período: tres `StatCard`, igual que el resto de KPIs de la app. */
export const StatsHeader = React.memo(function StatsHeader({
  stats,
  periodLabel = 'Total del Día',
}: {
  stats: FacturaStats;
  periodLabel?: string;
}) {
  return (
    <RNView style={sh.fila}>
      <StatCard icon="receipt" label={periodLabel} value={`$${formatCurrency(stats.totalDia)}`} sub={`${stats.count} facturas generadas`} color="#F5A524" />
      <StatCard icon="check-circle-outline" label="Pagado" value={`$${formatCurrency(stats.totalPagado)}`} color="#10B981" />
      <StatCard icon="clock-outline" label="Pendiente" value={`$${formatCurrency(stats.totalPendiente)}`} color="#FB923C" />
    </RNView>
  );
});

const sh = StyleSheet.create({
  fila: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 16 },
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
  const isPagado = estado === 'pagado' || estado === 'pagada';
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
  activeFilter,
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
  activeFilter?: string;
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
  const [showAssignCuenta, setShowAssignCuenta] = React.useState(false);
  const [updateLoading, setUpdateLoading] = React.useState(false);
  const { showToast } = useToast();
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

  const isPagado = item.estado === 'pagado' || item.estado === 'pagada';
  const isCancelado = item.estado === 'cancelado';
  const isParcial = item.estado === 'parcial';
  const saldoPendiente = isParcial ? (item.total ?? 0) - (item.montoPagado ?? 0) : (item.total ?? 0);
  const progresoPct = item.total && item.montoPagado ? Math.min(100, (item.montoPagado / item.total) * 100) : 0;

  // aperturaHecha === false blocks cash-based methods inside the modal; the button itself stays open
  const cobrarDisabled = isUpdating;
  const metodosBloqueados: string[] = aperturaHecha === false ? ['efectivo', 'efectivo_transferencia'] : [];

  // Mixtas y parciales (abonos) reparten lo cobrado entre efectivo y QR: con el filtro de método
  // activo se muestra SU parte, no el total de la factura.
  const repartida = item.metodo === 'efectivo_transferencia' || isParcial;
  const totalMostrado =
    repartida && activeFilter === 'efectivo'
      ? montoEfectivo(item)
      : repartida && (activeFilter === 'transferencia' || activeFilter === 'qr')
      ? montoTransferencia(item)
      : (item.total ?? 0);
  // Cuentas a las que entró lo cobrado por QR (una factura puede abonarse a cuentas distintas).
  const cuentasQr = transferenciasPorCuenta(item);
  const esConTransferencia =
    item.metodo === 'transferencia' || item.metodo === 'qr' || item.metodo === 'efectivo_transferencia' || cuentasQr.length > 0;

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

  const bgTint = isCancelado
    ? 'rgba(244,63,94,0.04)'
    : isPagado
    ? 'rgba(16,185,129,0.04)'
    : 'rgba(245,165,36,0.04)';

  const statusColor = isCancelado
    ? '#F43F5E'
    : isPagado
    ? '#10B981'
    : '#F5A524';


  const direccionDomicilio = item.domicilios?.[0]?.direccionEntrega;
  const referenciaDomicilio = item.domicilios?.[0]?.referencia;
  const domiciliarioNombre = item.domicilios?.[0]?.domiciliario?.domiciliarioNombre;

  const textoUbicacion = [
    direccionDomicilio,
    referenciaDomicilio ? `Ref: ${referenciaDomicilio}` : null,
  ]
    .filter(Boolean)
    .join('  •  ');

  return (
    <Card style={[fc.card, { borderLeftWidth: 4, borderLeftColor: statusColor }]}>
      {/* Fondo tintado según estado */}
      <RNView style={[fc.tintOverlay, { backgroundColor: bgTint }]} pointerEvents="none" />

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
              ${formatCurrency(totalMostrado)}
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
            
            {esConTransferencia && (
              <TouchableOpacity
                onPress={() => onUpdate && item.facturaId && setShowAssignCuenta(true)}
                disabled={!onUpdate || !item.facturaId || isUpdating}
                accessibilityLabel="Asignar cuenta de transferencia"
                style={{ alignItems: 'flex-end', gap: 3 }}
              >
                {cuentasQr.length > 1 ? (
                  cuentasQr.map((c, i) => (
                    <RNView key={`${c.cuentaId ?? c.cuenta ?? 'sin'}-${i}`} style={c.cuenta || c.cuentaId != null ? fc.cuentaBadge : fc.cuentaBadgeSin}>
                      <Icon name={c.cuenta || c.cuentaId != null ? 'qrcode-scan' : 'alert-circle-outline'} size={10} color={c.cuenta || c.cuentaId != null ? '#A78BFA' : '#F43F5E'} />
                      <RNText style={c.cuenta || c.cuentaId != null ? fc.cuentaBadgeText : fc.cuentaBadgeTextSin}>
                        {`${c.cuenta ?? 'Sin Asignar'} · $${formatCurrency(c.monto)}`}
                      </RNText>
                    </RNView>
                  ))
                ) : item.cuentaTransferenciaNombre || cuentasQr[0]?.cuenta ? (
                  <RNView style={fc.cuentaBadge}>
                    <Icon name="qrcode-scan" size={10} color="#A78BFA" />
                    <RNText style={fc.cuentaBadgeText}>
                      {cuentasQr[0]?.cuenta ?? item.cuentaTransferenciaNombre}
                    </RNText>
                  </RNView>
                ) : (
                  <RNView style={fc.cuentaBadgeSin}>
                    <Icon name="alert-circle-outline" size={10} color="#F43F5E" />
                    <RNText style={fc.cuentaBadgeTextSin}>
                      Sin Asignar
                    </RNText>
                  </RNView>
                )}
              </TouchableOpacity>
            )}
            {/* Desglose pago mixto con prioridad según filtro activo */}
            {item.metodo === 'efectivo_transferencia' && (() => {
              const isQrFilter = activeFilter === 'transferencia' || activeFilter === 'qr';

              const rowEfectivo = (item.pagoEfectivo ?? 0) > 0 && (
                <RNView style={isQrFilter ? fc.mixtoRowSec : fc.mixtoRowPri}>
                  <RNText style={isQrFilter ? fc.mixtoTextSec : fc.mixtoEfectivoPri}>
                    💵 ${formatCurrency(item.pagoEfectivo!)}
                  </RNText>
                  <RNText style={fc.mixtoTag}> (Efectivo)</RNText>
                </RNView>
              );

              const rowTransfer = (item.pagoTransferencia ?? 0) > 0 && (
                <RNView style={isQrFilter ? fc.mixtoRowPri : fc.mixtoRowSec}>
                  <RNText style={isQrFilter ? fc.mixtoTransferPri : fc.mixtoTextSec}>
                    🔁 ${formatCurrency(item.pagoTransferencia!)}
                  </RNText>
                  <RNText style={fc.mixtoTag}> (QR)</RNText>
                </RNView>
              );

              return (
                <RNView style={fc.mixtoBox}>
                  {isQrFilter ? (
                    <>
                      {rowTransfer}
                      {rowEfectivo}
                    </>
                  ) : (
                    <>
                      {rowEfectivo}
                      {rowTransfer}
                    </>
                  )}
                </RNView>
              );
            })()}
          </RNView>
        </RNView>

        {/* ── Tags: domicilio + dirección / referencia ── */}
        {(esDomicilio || textoUbicacion.length > 0) && (
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
            {textoUbicacion.length > 0 && (
              <RNView style={fc.direccionRow}>
                <Icon name="map-marker-outline" size={13} color="#94A3B8" style={{ marginTop: 1 }} />
                <RNText style={fc.direccionText} numberOfLines={2}>
                  {textoUbicacion}
                </RNText>
              </RNView>
            )}
          </RNView>
        )}

        {/* ── Notas (eliminado: ya visible en el resumen de orden) ── */}

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
                      {op.cantidad} u. · ${formatCurrency(op.precioUnitario ?? 0)}
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
              <TouchableOpacity onPress={handlePrint} style={fc.printBtn} accessibilityLabel="Imprimir factura">
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
                  accessibilityLabel="Confirmar eliminar factura"
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
                <TouchableOpacity onPress={() => setConfirmDelete(true)} style={fc.deleteBtn} accessibilityLabel="Eliminar factura">
                  <Icon name="trash-can-outline" size={15} color="#F43F5E" />
                </TouchableOpacity>
              )
            )}
          </RNView>

          {/* Derecha: editar + abonar + cobrar/revertir */}
          <RNView style={fc.footerGroup}>
            {!isCancelado && (
              <TouchableOpacity onPress={() => setEditing(true)} style={fc.editBtn} accessibilityLabel="Editar total">
                <Icon name="pencil-outline" size={15} color="#94A3B8" />
              </TouchableOpacity>
            )}
            {(isParcial || item.estado === 'pendiente') && onAbono && aperturaHecha !== false && (
              <TouchableOpacity
                onPress={() => setShowAbonoModal(true)}
                disabled={isUpdating}
                style={[fc.abonarBtn, { opacity: isUpdating ? 0.5 : 1 }]}
                accessibilityLabel="Registrar abono"
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
                  } else if (isParcial && onAbono) {
                    // Saldar una factura con abonos va por el flujo de abono: cobra solo el
                    // saldo y el backend acumula el desglose. Cobrarla "completa" registraba
                    // de nuevo lo ya abonado y sobrescribía pagoEfectivo/pagoTransferencia.
                    setShowAbonoModal(true);
                  } else {
                    setShowPaymentModal(true);
                  }
                }}
                disabled={cobrarDisabled}
                accessibilityLabel={isPagado ? 'Revertir cobro' : 'Cobrar factura'}
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

      <PromptModal
        visible={editing}
        title="Editar Total"
        label="Nuevo valor de factura"
        kind="moneda"
        initialValue={String(Math.round(item.total ?? 0))}
        hint={`Anterior: ${formatCOP(item.total ?? 0)}`}
        validate={(v) => (v.trim() === '' ? 'Escribe el nuevo total' : null)}
        loading={updateLoading}
        onConfirm={(v) => handleUpdateTotal(Number(v))}
        onCancel={() => setEditing(false)}
      />

      <SelectorCuenta
        visible={showAssignCuenta}
        loading={updateLoading}
        onCancel={() => setShowAssignCuenta(false)}
        onConfirm={async (id, nombre) => {
            if (item.facturaId && onUpdate) {
                setUpdateLoading(true);
                try {
                    await onUpdate(item.facturaId, { cuentaTransferenciaId: id, cuentaTransferenciaNombre: nombre });
                    setShowAssignCuenta(false);
                } catch (err: any) {
                    // Antes el error solo iba a consola y el modal se cerraba: el cajero creía que quedó asignada.
                    showToast(err?.response?.data?.message || 'No se pudo asignar la cuenta', 'error');
                } finally {
                    setUpdateLoading(false);
                }
            }
        }}
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
  // Fondo, borde y radio vienen de las clases de <Card> (misma receta que todas las tarjetas); sin sombra.
  card: {
    flex: 1,
    height: '100%',
    overflow: 'hidden',
    padding: 0,
    marginBottom: 0,
  },
  tintOverlay: { position: 'absolute', inset: 0, opacity: 0.8 },
  body: { flex: 1, justifyContent: 'space-between', padding: 16 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 },
  headerLeft: { flex: 1, paddingRight: 12 },
  cliente: { fontFamily: 'SpaceGrotesk-Bold', color: '#F8FAFC', fontSize: 18, textTransform: 'uppercase', lineHeight: 22, letterSpacing: 0.3 },
  fecha: { fontFamily: 'Outfit', color: '#94A3B8', fontSize: 11, marginTop: 3 },
  headerRight: { alignItems: 'flex-end', gap: 4 },
  total: { fontFamily: 'SpaceGrotesk-Bold', color: '#F8FAFC', fontSize: 19, letterSpacing: -0.5 },
  mixtoBox: { alignItems: 'flex-end', gap: 2, marginTop: 4, maxWidth: '100%' },
  mixtoRowPri: { flexDirection: 'row', alignItems: 'center', gap: 2, maxWidth: '100%' },
  mixtoRowSec: { flexDirection: 'row', alignItems: 'center', gap: 2, maxWidth: '100%' },
  mixtoEfectivoPri: { fontFamily: 'SpaceGrotesk-Bold', color: '#10B981', fontSize: 13, fontWeight: '800' },
  mixtoTransferPri: { fontFamily: 'SpaceGrotesk-Bold', color: '#60A5FA', fontSize: 13, fontWeight: '800' },
  mixtoTextSec: { fontFamily: 'Outfit', color: '#94A3B8', fontSize: 10, fontWeight: '600' },
  mixtoTag: { fontFamily: 'Outfit', color: '#7C8BA1', fontSize: 10 },
  tagsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 12 },
  domicilioTag: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(249,115,22,0.1)', borderWidth: 1, borderColor: 'rgba(249,115,22,0.2)', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  domicilioTagText: { fontFamily: 'Outfit', color: '#FB923C', fontSize: 10, fontWeight: '900', textTransform: 'uppercase' },
  domicilioDot: { width: 4, height: 4, borderRadius: 2, backgroundColor: 'rgba(249,115,22,0.5)', marginHorizontal: 2 },
  domiciliarioNombre: { fontFamily: 'Outfit', color: '#FB923C', fontSize: 10, fontWeight: 'bold' },
  direccionRow: { 
    flexDirection: 'row', 
    alignItems: 'flex-start', 
    gap: 5, 
    backgroundColor: 'rgba(255,255,255,0.03)', 
    paddingHorizontal: 10, 
    paddingVertical: 6, 
    borderRadius: 10, 
    borderWidth: 1, 
    borderColor: 'rgba(255,255,255,0.06)',
    marginTop: 4,
  },
  direccionText: { fontFamily: 'Outfit', color: '#CBD5E1', fontSize: 11.5, fontWeight: '500', flex: 1, lineHeight: 16 },
  notasBox: { 
    backgroundColor: 'rgba(245,158,11,0.06)', 
    paddingHorizontal: 12, 
    paddingVertical: 9, 
    borderRadius: 10, 
    borderLeftWidth: 3, 
    borderLeftColor: '#F5A524', 
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  notasText: { fontFamily: 'Outfit', color: '#F5A524', fontSize: 12, fontWeight: '500' },
  productosBox: { borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.08)', paddingTop: 12, marginBottom: 16 },
  productosLabel: { fontFamily: 'Outfit', color: '#7C8BA1', fontSize: 10, textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 10, fontWeight: '700' },
  productoRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 },
  productoInfo: { flex: 1, paddingRight: 12 },
  productoNombre: { fontFamily: 'Outfit', color: '#F1F5F9', fontSize: 14, fontWeight: '600', marginBottom: 2 },
  productoCantidad: { fontFamily: 'Outfit', color: '#94A3B8', fontSize: 12 },
  productoSubtotal: { fontFamily: 'SpaceGrotesk-Bold', color: '#F8FAFC', fontSize: 14 },
  abonoBox: { marginBottom: 12 },
  abonoHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  abonoLabel: { fontFamily: 'Outfit', color: '#F5A524', fontSize: 10, textTransform: 'uppercase', letterSpacing: 1, fontWeight: '900' },
  abonoSaldo: { fontFamily: 'Outfit', color: '#7C8BA1', fontSize: 10, textTransform: 'uppercase', letterSpacing: 1 },
  progressTrack: { height: 5, backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 3, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: '#F5A524', borderRadius: 3 },
  footer: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8, paddingTop: 12, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.08)' },
  footerGroup: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  printBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(59,130,246,0.12)', borderRadius: 12, borderWidth: 1, borderColor: 'rgba(59,130,246,0.25)' },
  confirmDeleteBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 7, borderRadius: 12, backgroundColor: 'rgba(244,63,94,0.15)', borderWidth: 1, borderColor: 'rgba(244,63,94,0.3)' },
  confirmDeleteText: { fontFamily: 'Outfit', color: '#F87171', fontSize: 11, fontWeight: '900', textTransform: 'uppercase' },
  deleteBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(244,63,94,0.08)', borderRadius: 12, borderWidth: 1, borderColor: 'rgba(244,63,94,0.2)' },
  editBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' },
  cuentaBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(167,139,250,0.15)', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 8, borderWidth: 1, borderColor: 'rgba(167,139,250,0.3)', gap: 4 },
  cuentaBadgeText: { fontFamily: 'Outfit', color: '#A78BFA', fontSize: 10, fontWeight: '800', textTransform: 'uppercase' },
  cuentaBadgeSin: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(244,63,94,0.15)', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 8, borderWidth: 1, borderColor: 'rgba(244,63,94,0.3)', gap: 4 },
  cuentaBadgeTextSin: { fontFamily: 'Outfit', color: '#F43F5E', fontSize: 10, fontWeight: '800', textTransform: 'uppercase' },
  abonarBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12, backgroundColor: 'rgba(245,158,11,0.08)', borderWidth: 1, borderColor: 'rgba(245,158,11,0.25)' },
  abonarText: { fontFamily: 'Outfit', fontSize: 11, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 0.5, color: '#F5A524' },
  cobrarBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 12, borderWidth: 1 },
  cobrarText: { fontFamily: 'Outfit', fontSize: 11, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 0.5 },
});

function SelectorCuenta({
  visible,
  loading,
  onConfirm,
  onCancel,
}: {
  visible: boolean;
  loading: boolean;
  onConfirm: (cuentaId: number, cuentaNombre: string) => void;
  onCancel: () => void;
}) {
  const { cuentas, cargando, recargar } = useCuentasTransferencia();
  React.useEffect(() => {
    if (visible) void recargar();
  }, [visible, recargar]);
  return (
    <OptionPickerModal
      visible={visible}
      title="Asignar Cuenta"
      subtitle="Selecciona la cuenta destino para esta transferencia."
      icon="bank-outline"
      options={cuentas.map((c) => ({ value: c.id, label: c.nombre, icon: 'bank' as const }))}
      fetching={cargando && cuentas.length === 0}
      emptyText="No hay cuentas activas."
      loading={loading}
      onSelect={(o) => onConfirm(o.value, o.label)}
      onCancel={onCancel}
    />
  );
}
