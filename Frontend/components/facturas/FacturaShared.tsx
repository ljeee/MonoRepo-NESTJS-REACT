import React from 'react';
import { ActivityIndicator, Text, TouchableOpacity, View } from 'react-native';
import { colors } from '../../styles/theme';
import { formatCurrency, formatDate } from '../../utils/formatNumber';
import { fStyles as s } from '../../styles/facturas/facturas.styles';
import { printReceipt } from '../../utils/printReceipt';

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
    <View style={s.statsContainer}>
      {/* Main stat */}
      <View style={s.statCardMain}>
        <Text style={s.statLabel}>{periodLabel}</Text>
        <Text style={s.statValueMain}>${formatCurrency(stats.totalDia)}</Text>
        <Text style={s.statSubtext}>{stats.count} facturas</Text>
      </View>
      {/* Pagado / Pendiente */}
      <View style={s.statRow}>
        <View style={s.statCardPagado}>
          <Text style={s.statLabel}>Pagado</Text>
          <Text style={s.statValuePagado}>${formatCurrency(stats.totalPagado)}</Text>
        </View>
        <View style={s.statCardPendiente}>
          <Text style={s.statLabel}>Pendiente</Text>
          <Text style={s.statValuePendiente}>${formatCurrency(stats.totalPendiente)}</Text>
        </View>
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
  const indicadorColor = isPagado ? colors.success : colors.warning;

  return (
    <View style={s.estadoRow}>
      <View style={s.estadoIndicatorRow}>
        <View style={[s.estadoDot, { backgroundColor: indicadorColor }]} />
        <Text style={[s.estadoLabel, { color: indicadorColor }]}>
          {estado || 'pendiente'}
        </Text>
      </View>
      <TouchableOpacity
        onPress={onToggle}
        disabled={isUpdating}
        style={[
          s.estadoBtn,
          { backgroundColor: isPagado ? colors.warning : colors.success },
          isUpdating && s.estadoBtnDisabled,
        ]}
      >
        {isUpdating ? (
          <ActivityIndicator size="small" color="#fff" />
        ) : (
          <Text style={s.estadoBtnText}>
            {isPagado ? '↶ Pendiente' : '✓ Pagado'}
          </Text>
        )}
      </TouchableOpacity>
    </View>
  );
}

// ─── FacturaCard ──────────────────────────────────────────────────────────────

export function FacturaCard({
  item,
  isUpdating,
  onToggleEstado,
  showPrint = false,
}: {
  item: FacturaItem;
  isUpdating: boolean;
  onToggleEstado: (facturaId: number, currentEstado?: string) => void;
  showPrint?: boolean;
}) {
  const isPagado = item.estado === 'pagado';
  const indicadorColor = isPagado ? colors.success : colors.warning;
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
    <View style={[s.card, { borderLeftColor: indicadorColor }]}>
      {/* Header: client + total */}
      <View style={s.cardHeader}>
        <View style={{ flex: 1 }}>
          <Text style={s.cardClientName}>{item.clienteNombre || 'Cliente sin nombre'}</Text>
          <Text style={s.cardDate}>{formatDate(item.fechaFactura)}</Text>
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={s.cardTotal}>${formatCurrency(item.total ?? 0)}</Text>
          <Text style={s.cardMetodo}>{item.metodo || 'Sin método'}</Text>
        </View>
      </View>

      {/* Badge domicilio */}
      {esDomicilio && (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4, marginBottom: 2 }}>
          <View style={{ backgroundColor: '#3b82f6', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 }}>
            <Text style={{ color: '#fff', fontSize: 12, fontWeight: '600' }}>🛵 Domicilio</Text>
          </View>
          {costoDomicilio > 0 && (
            <Text style={{ color: colors.subText, fontSize: 12 }}>
              Envío: ${formatCurrency(costoDomicilio)}
            </Text>
          )}
        </View>
      )}

      {/* Notas */}
      {item.descripcion ? (
        <View style={s.notesBox}>
          <Text style={s.notesLabel}>Notas</Text>
          <Text style={s.notesText}>{item.descripcion}</Text>
        </View>
      ) : null}

      {/* Productos */}
      {item.ordenes && item.ordenes.length > 0 && (
        <View style={s.productsSection}>
          <Text style={s.productsSectionLabel}>
            📦 Productos ({item.ordenes.length} orden{item.ordenes.length > 1 ? 'es' : ''})
          </Text>
          {item.ordenes.map((orden, oIdx) =>
            orden.productos?.map((op, pIdx) => (
              <View key={`${oIdx}-${pIdx}`} style={s.productRow}>
                <View style={{ flex: 1 }}>
                  <Text style={s.productName}>{op.productoNombre || 'Producto'}</Text>
                </View>
                <View style={{ alignItems: 'flex-end', marginLeft: 8 }}>
                  <Text style={s.productQtyPrice}>
                    {op.cantidad}x ${formatCurrency(op.precioUnitario ?? 0)}
                  </Text>
                  <Text style={s.productSubtotal}>${formatCurrency(op.subtotal ?? 0)}</Text>
                </View>
              </View>
            )),
          )}
        </View>
      )}

      {/* Estado toggle + Print */}
      <View style={s.estadoRow}>
        <View style={s.estadoIndicatorRow}>
          <View style={[s.estadoDot, { backgroundColor: indicadorColor }]} />
          <Text style={[s.estadoLabel, { color: indicadorColor }]}>
            {item.estado || 'pendiente'}
          </Text>
        </View>
        <View style={{ flexDirection: 'row', gap: 6 }}>
          {showPrint && (
            <TouchableOpacity
              onPress={handlePrint}
              style={[s.estadoBtn, { backgroundColor: '#3b82f6' }]}
            >
              <Text style={s.estadoBtnText}>🖨️ Recibo</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity
            onPress={() => item.facturaId && onToggleEstado(item.facturaId, item.estado)}
            disabled={isUpdating}
            style={[
              s.estadoBtn,
              { backgroundColor: isPagado ? colors.warning : colors.success },
              isUpdating && s.estadoBtnDisabled,
            ]}
          >
            {isUpdating ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={s.estadoBtnText}>
                {isPagado ? '↶ Pendiente' : '✓ Pagado'}
              </Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}
