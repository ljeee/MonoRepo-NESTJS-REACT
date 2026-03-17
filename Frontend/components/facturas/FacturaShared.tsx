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
    <View className="gap-y-4 mb-6">
      {/* Main stat */}
      <Card className="bg-slate-900 border-0 overflow-hidden relative p-6">
         <View className="absolute inset-0 bg-(--color-pos-primary)/5" />
         <Text className="text-white/60 font-black text-xs uppercase tracking-widest mb-1">{periodLabel}</Text>
         <Text className="text-white font-black text-4xl" style={{ fontFamily: 'Space Grotesk' }}>
            ${formatCurrency(stats.totalDia)}
         </Text>
         <Text className="text-slate-500 font-bold text-xs mt-2 uppercase">{stats.count} facturas generadas</Text>
      </Card>
      
      {/* Pagado / Pendiente */}
      <View className="flex-row gap-4">
        <Card className="flex-1 p-4 bg-emerald-500/10 border-emerald-500/20">
          <Text className="text-emerald-500/60 font-black text-[10px] uppercase tracking-tighter mb-1">Pagado</Text>
          <Text className="text-emerald-400 font-black text-xl" style={{ fontFamily: 'Space Grotesk' }}>
            ${formatCurrency(stats.totalPagado)}
          </Text>
        </Card>
        <Card className="flex-1 p-4 bg-orange-500/10 border-orange-500/20">
          <Text className="text-orange-500/60 font-black text-[10px] uppercase tracking-tighter mb-1">Pendiente</Text>
          <Text className="text-orange-400 font-black text-xl" style={{ fontFamily: 'Space Grotesk' }}>
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
    <Card className={`overflow-hidden border-0 bg-slate-900/40 p-0 mb-4`}>
       {/* Left accent border equivalent */}
       <View className={`absolute left-0 top-0 bottom-0 w-1.5 ${isCancelado ? 'bg-red-500' : isPagado ? 'bg-emerald-500' : 'bg-orange-500'}`} />
       
       <View className="pl-5 p-5">
          {/* Header */}
          <View className="flex-row justify-between items-start mb-4">
             <View className="flex-1">
                <Text className="text-white font-black text-lg uppercase leading-tight" style={{ fontFamily: 'Space Grotesk' }}>
                    {item.clienteNombre || 'Cliente S/N'}
                </Text>
                <Text className="text-slate-500 text-[10px] font-bold uppercase mt-1">
                    {formatDate(item.fechaFactura)}
                </Text>
             </View>
             <View className="items-end">
                <Text className="text-white font-black text-xl" style={{ fontFamily: 'Space Grotesk' }}>
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
          <View className="flex-row flex-wrap gap-2 mb-4">
             {esDomicilio && (
                 <View className="bg-orange-500/10 border border-orange-500/20 px-2 py-1 rounded-md flex-row items-center gap-1">
                    <Text className="text-orange-400 text-[10px] font-black uppercase tracking-tighter">🛵 Domicilio</Text>
                    {costoDomicilio > 0 && <Text className="text-orange-400/60 text-[10px] font-bold">+${formatCurrency(costoDomicilio)}</Text>}
                 </View>
             )}
          </View>

          {/* Notas */}
          {item.descripcion && (
            <View className="bg-white/5 p-3 rounded-xl border border-white/5 mb-4">
                <Text className="text-white/40 text-[9px] font-black uppercase mb-1">Notas del pedido</Text>
                <Text className="text-slate-300 text-xs italic">"{item.descripcion}"</Text>
            </View>
          )}

          {/* Products summary */}
          {item.ordenes && item.ordenes.length > 0 && (
             <View className="border-t border-white/5 pt-4 mb-4">
                <Text className="text-slate-500 text-[9px] font-black uppercase mb-3">Resumen de productos</Text>
                {item.ordenes.map((orden, oIdx) =>
                    orden.productos?.map((op, pIdx) => (
                      <View key={`${oIdx}-${pIdx}`} className="flex-row justify-between items-center mb-2">
                         <View className="flex-1 pr-4">
                             <Text className="text-white/80 text-xs font-bold">{op.productoNombre}</Text>
                             <Text className="text-slate-500 text-[10px] uppercase font-bold">{op.cantidad} x ${formatCurrency(op.precioUnitario ?? 0)}</Text>
                         </View>
                         <Text className="text-white font-black text-xs">${formatCurrency(op.subtotal ?? 0)}</Text>
                      </View>
                    ))
                )}
             </View>
          )}

          {/* Actions Footer */}
          <View className="flex-row justify-between items-center mt-2 pt-4 border-t border-white/5">
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
