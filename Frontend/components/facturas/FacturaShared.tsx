import React from 'react';
import { ActivityIndicator, TouchableOpacity } from 'react-native';
import { formatCurrency, formatDate } from '@monorepo/shared';
import { View, Text } from '../../tw';

import { printReceipt } from '../../utils/printReceipt';
import UpdateTotalModal from './UpdateTotalModal';
import PaymentSelectionModal from '../orders/PaymentSelectionModal';
import { Badge, Card, Icon } from '../ui';
import { useBreakpoint } from '../../styles/responsive';

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
}

// ─── StatsHeader ──────────────────────────────────────────────────────────────

export function StatsHeader({
  stats,
  periodLabel = 'Total del Día',
}: {
  stats: FacturaStats;
  periodLabel?: string;
}) {
  return (
    <View style={{ gap: 10, marginBottom: 16 }}>
      {/* Main stat */}
      <Card style={{ overflow: 'hidden', position: 'relative', borderColor: 'rgba(245,165,36,0.15)', backgroundColor: 'rgba(6,14,26,0.8)' }}>
         <View style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(245,165,36,0.04)' }} />
         <Text style={{ fontFamily: 'Outfit', color: 'rgba(255,255,255,0.5)', fontSize: 10, textTransform: 'uppercase', letterSpacing: 2, marginBottom: 4 }}>{periodLabel}</Text>
         <Text style={{ fontFamily: 'SpaceGrotesk-Bold', color: '#F8FAFC', fontSize: 32 }}>
            ${formatCurrency(stats.totalDia)}
         </Text>
         <Text style={{ fontFamily: 'Outfit', color: '#64748B', fontSize: 11, marginTop: 4, textTransform: 'uppercase', letterSpacing: 1 }}>{stats.count} facturas generadas</Text>
      </Card>
      
      {/* Pagado / Pendiente */}
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <Card style={{ flex: 1, backgroundColor: 'rgba(16,185,129,0.07)', borderColor: 'rgba(16,185,129,0.2)' }}>
          <Text style={{ fontFamily: 'Outfit', color: 'rgba(16,185,129,0.7)', fontSize: 10, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 }}>Pagado</Text>
          <Text style={{ fontFamily: 'SpaceGrotesk-Bold', color: '#34D399', fontSize: 20 }}>
            ${formatCurrency(stats.totalPagado)}
          </Text>
        </Card>
        <Card style={{ flex: 1, backgroundColor: 'rgba(245,165,36,0.07)', borderColor: 'rgba(245,165,36,0.2)' }}>
          <Text style={{ fontFamily: 'Outfit', color: 'rgba(245,165,36,0.7)', fontSize: 10, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 }}>Pendiente</Text>
          <Text style={{ fontFamily: 'SpaceGrotesk-Bold', color: '#F5A524', fontSize: 20 }}>
            ${formatCurrency(stats.totalPendiente)}
          </Text>
        </Card>
      </View>
    </View>
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
              <Text className={`font-black text-xs uppercase ${isPagado ? 'text-orange-400' : 'text-emerald-400'}`}>
                {isPagado ? '↶ Marcar Pendiente' : '✓ Marcar Pagado'}
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
  showPrint = false,
}: {
  item: FacturaItem;
  isUpdating: boolean;
  onToggleEstado: (facturaId: number, nuevoEstado: string, metodo?: string) => void;
  onUpdateTotal?: (facturaId: number, newTotal: number) => Promise<void>;
  onUpdate?: (facturaId: number, data: Partial<FacturaItem>) => Promise<void>;
  showPrint?: boolean;
}) {
  const { isMobile } = useBreakpoint();
  const [editing, setEditing] = React.useState(false);
  const [showPaymentModal, setShowPaymentModal] = React.useState(false);
  const [updateLoading, setUpdateLoading] = React.useState(false);

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

  return (
    <Card style={{ overflow: 'hidden', borderWidth: 0, backgroundColor: 'rgba(15,23,42,0.6)', padding: 0, marginBottom: 12 }}>
       {/* Left accent border equivalent */}
       <View style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 4, backgroundColor: isCancelado ? '#F43F5E' : isPagado ? '#10B981' : '#F5A524' }} />
       
       <View style={{ paddingLeft: 14, padding: 12 }}>
          {/* Header */}
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
             <View style={{ flex: 1, paddingTop: 4 }}>
                <Text style={{ fontFamily: 'SpaceGrotesk-Bold', color: '#F8FAFC', fontSize: 18, textTransform: 'uppercase', lineHeight: 22 }} numberOfLines={1}>
                    {item.clienteNombre || 'Cliente S/N'}
                </Text>
                <Text style={{ fontFamily: 'Outfit', color: '#F8FAFC', fontSize: 10, marginTop: 2, textTransform: 'uppercase', opacity: 0.9 }}>
                    {formatDate(item.fechaFactura)}
                </Text>
             </View>
             <View style={{ alignItems: 'flex-end' }}>
                <Text style={{ fontFamily: 'SpaceGrotesk-Bold', color: '#F8FAFC', fontSize: 18 }}>
                    ${formatCurrency(item.total ?? 0)}
                </Text>
                {item.metodo ? (
                   <Badge label={item.metodo} variant="info" size="sm" />
                ) : (
                   <Badge label="Sin Definir" variant="neutral" size="sm" />
                )}
             </View>
          </View>

          {/* Badges row */}
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
             {esDomicilio && (
                 <View className="bg-orange-500/10 border border-orange-500/20 px-2 py-1 rounded-md flex-row items-center gap-1">
                    <Text className="text-orange-400 text-[10px] font-black uppercase tracking-tighter">🛵 Domicilio</Text>
                    {costoDomicilio > 0 && <Text className="text-orange-400/60 text-[10px] font-bold">+${formatCurrency(costoDomicilio)}</Text>}
                 </View>
             )}
          </View>

          {/* Notas */}
          {item.descripcion && (
            <View style={{ backgroundColor: 'rgba(255,255,255,0.04)', padding: 10, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)', marginBottom: 8 }}>
                <Text style={{ fontFamily: 'Outfit', color: 'rgba(255,255,255,0.35)', fontSize: 9, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 3 }}>Notas</Text>
                <Text style={{ fontFamily: 'Outfit', color: '#CBD5E1', fontSize: 11, fontStyle: 'italic' }}>'{item.descripcion}'</Text>
            </View>
          )}

          {/* Products summary */}
          {item.ordenes && item.ordenes.length > 0 && (
             <View style={{ borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.05)', paddingTop: 8, marginBottom: 8 }}>
                <Text style={{ fontFamily: 'Outfit', color: '#475569', fontSize: 9, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 }}>Productos</Text>
                {item.ordenes.map((orden, oIdx) =>
                    orden.productos?.map((op, pIdx) => (
                      <View key={`${oIdx}-${pIdx}`} style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                         <View style={{ flex: 1, paddingRight: 12 }}>
                             <Text style={{ fontFamily: 'Outfit', color: 'rgba(255,255,255,0.75)', fontSize: 12 }} numberOfLines={1}>{op.productoNombre}</Text>
                             <Text style={{ fontFamily: 'Outfit', color: '#475569', fontSize: 10, textTransform: 'uppercase' }}>{op.cantidad} x ${formatCurrency(op.precioUnitario ?? 0)}</Text>
                         </View>
                         <Text style={{ fontFamily: 'SpaceGrotesk-Bold', color: '#F8FAFC', fontSize: 12 }}>${formatCurrency(op.subtotal ?? 0)}</Text>
                      </View>
                    ))
                )}
             </View>
          )}

          {/* Actions Footer */}
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 6, paddingTop: 10, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.05)' }}>
             <View className="flex-row items-center gap-2">
                <Badge label={item.estado || 'pendiente'} variant={variant} size="md" />
                {showPrint && !isMobile && (
                    <TouchableOpacity onPress={handlePrint} className="w-9 h-9 items-center justify-center bg-blue-500/20 rounded-xl border border-blue-500/30">
                        <Icon name="printer" size={16} color="#3B82F6" />
                    </TouchableOpacity>
                )}
             </View>

              <View className="flex-row items-center gap-2">
                {!isCancelado && (
                     <TouchableOpacity
                        onPress={() => {
                          if (isPagado) {
                            item.facturaId && onToggleEstado(item.facturaId, 'pendiente');
                          } else {
                            setShowPaymentModal(true);
                          }
                        }}
                        disabled={isUpdating}
                        className={`px-4 py-2 rounded-xl border ${isPagado ? 'bg-orange-500/10 border-orange-500/20' : 'bg-emerald-500/10 border-emerald-500/20'}`}
                    >
                        {isUpdating ? (
                            <ActivityIndicator size="small" color={isPagado ? '#F5A524' : '#10B981'} />
                        ) : (
                            <Text className={`font-black text-[11px] uppercase tracking-tighter ${isPagado ? 'text-orange-400' : 'text-emerald-400'}`}>
                                {isPagado ? 'Revertir' : 'Cobrar'}
                            </Text>
                        )}
                    </TouchableOpacity>
                )}
                
                {!isCancelado && (
                    <TouchableOpacity
                        onPress={() => setEditing(true)}
                        className="w-9 h-9 items-center justify-center bg-white/5 rounded-xl border border-white/10"
                    >
                        <Icon name="pencil" size={16} color="#94A3B8" />
                    </TouchableOpacity>
                )}
             </View>
          </View>
       </View>

      <UpdateTotalModal
        visible={editing}
        currentTotal={item.total ?? 0}
        loading={updateLoading}
        onConfirm={handleUpdateTotal}
        onCancel={() => setEditing(false)}
      />

      <PaymentSelectionModal
        visible={showPaymentModal}
        onClose={() => setShowPaymentModal(false)}
        onSelect={(method) => {
          setShowPaymentModal(false);
          if (item.facturaId) {
            onToggleEstado(item.facturaId, 'pagado', method);
          }
        }}
        loading={isUpdating}
      />
    </Card>
  );
}
