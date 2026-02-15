import React, { useCallback, useEffect, useState } from 'react';
import { FlatList, Text, TouchableOpacity, View, StyleSheet, RefreshControl } from 'react-native';
import { useRouter } from 'expo-router';
import { api } from '../../services/api';
import { useBreakpoint } from '../../styles/responsive';
import { EmptyState } from '../states/EmptyState';
import { ErrorState } from '../states/ErrorState';
import { ListSkeleton } from '../ui/SkeletonLoader';
import { PageContainer, PageHeader, Button, Card, Badge, Icon } from '../ui';
import { colors } from '../../styles/theme';
import { fontSize, fontWeight, spacing, radius, shadows } from '../../styles/tokens';
import { getEstadoColor } from '../../constants/estados';
import { formatDate } from '../../utils/formatNumber';

type OrderProduct = {
  id: number;
  producto: string;
  cantidad: number;
};
type Factura = {
  clienteNombre?: string;
};
type Domicilio = {
  direccionEntrega?: string;
};
type Order = {
  ordenId: number;
  tipoPedido: string;
  estadoOrden: string;
  fechaOrden: string;
  nombreCliente?: string;
  observaciones?: string;
  productos?: OrderProduct[];
  factura?: Factura;
  domicilios?: Domicilio[];
};

export default function OrdersOfDayPending() {
  const router = useRouter();
  const { isMobile, isTablet } = useBreakpoint();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [patchLoading, setPatchLoading] = useState<number | null>(null);
  const [filter, setFilter] = useState<'dia' | 'pendientes'>('dia');

  const fetchOrders = useCallback(async (isRefresh = false) => {
    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    setError('');
    try {
      const url_estado = filter === 'pendientes' ? 'pendiente' : undefined;
      const data = await api.ordenes.getDay(url_estado);
      setOrders(data as any);
    } catch (err: any) {
      if (err.response && err.response.status === 404) {
        setOrders([]);
      } else {
        setError('No pudimos cargar las órdenes. Por favor, intenta de nuevo.');
      }
    } finally {
      if (isRefresh) {
        setRefreshing(false);
      } else {
        setLoading(false);
      }
    }
  }, [filter]);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  const markAsCompleted = async (ordenId: number) => {
    setPatchLoading(ordenId);
    try {
      await api.ordenes.update(ordenId, { estadoOrden: 'completada' } as any);
      await fetchOrders();
    } catch {
      setError('No se pudo actualizar la orden');
    } finally {
      setPatchLoading(null);
    }
  };



  const getClientName = (item: Order) => {
    const nombre = item.factura?.clienteNombre || item.nombreCliente;
    if (!nombre) return 'Sin nombre';
    if (item.tipoPedido === 'mesa') {
      return /^\d+$/.test(nombre)
        ? `Mesa ${nombre}`
        : nombre.startsWith('Mesa')
          ? nombre
          : `Mesa ${nombre}`;
    }
    return nombre;
  };

  const numColumns = isMobile ? 1 : isTablet ? 2 : 3;

  return (
    <PageContainer scrollable={false}>
      <PageHeader
        title={filter === 'pendientes' ? 'Órdenes Pendientes' : 'Órdenes del Día'}
        icon="clipboard-text-outline"
      />

      {/* Actions & Filters */}
      <View style={styles.filterRow}>
        <View style={{ flexDirection: 'row', gap: spacing.sm }}>
          {([
            { key: 'dia' as const, label: 'Todas', icon: 'calendar-today' as const },
            { key: 'pendientes' as const, label: 'Pendientes', icon: 'clock-outline' as const },
          ]).map((f) => (
            <TouchableOpacity
              key={f.key}
              onPress={() => setFilter(f.key)}
              style={[styles.filterTab, filter === f.key && styles.filterTabActive]}
            >
              <Icon
                name={f.icon}
                size={16}
                color={filter === f.key ? colors.primary : colors.textMuted}
              />
              <Text
                style={[
                  styles.filterText,
                  filter === f.key && styles.filterTextActive,
                ]}
              >
                {f.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <Button
          title="Refrescar"
          icon="refresh"
          variant="ghost"
          size="sm"
          onPress={() => fetchOrders()}
        />
      </View>

      {/* Content */}
      {loading ? (
        <ListSkeleton count={6} />
      ) : error ? (
        <ErrorState message={error} onRetry={fetchOrders} />
      ) : (
        <FlatList
          data={orders}
          keyExtractor={(item) =>
            item.ordenId?.toString() || Math.random().toString()
          }
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => fetchOrders(true)}
              tintColor={colors.primary}
              colors={[colors.primary]}
            />
          }
          numColumns={numColumns}
          key={numColumns}
          contentContainerStyle={{ paddingBottom: spacing.lg }}
          columnWrapperStyle={
            numColumns > 1 ? { gap: spacing.md } : undefined
          }
          renderItem={({ item }) => {
            const ec = getEstadoColor(item.estadoOrden);
            return (
              <View style={[styles.gridItem, isMobile && styles.gridItemMobile]}>
                <Card
                  onPress={() =>
                    router.push(
                      `/orden-detalle?ordenId=${item.ordenId}` as any,
                    )
                  }
                  padding="md"
                >
                  {/* Header */}
                  <View style={styles.cardHeader}>
                    <View style={styles.cardHeaderLeft}>
                      <Icon
                        name={
                          item.tipoPedido === 'domicilio'
                            ? 'truck-delivery-outline'
                            : item.tipoPedido === 'llevar'
                              ? 'shopping-outline'
                              : 'table-furniture'
                        }
                        size={18}
                        color={colors.primary}
                        style={{ marginRight: spacing.sm }}
                      />
                      <Text style={styles.clientName}>
                        {getClientName(item)}
                      </Text>
                    </View>
                    <Badge
                      label={item.estadoOrden}
                      variant={
                        item.estadoOrden === 'pendiente'
                          ? 'warning'
                          : item.estadoOrden === 'completada' || item.estadoOrden === 'entregado'
                            ? 'success'
                            : item.estadoOrden === 'cancelado'
                              ? 'danger'
                              : 'info'
                      }
                      size="sm"
                    />
                  </View>

                  {/* Type & Date */}
                  <View style={styles.metaRow}>
                    <Text style={styles.metaText}>
                      {item.tipoPedido}
                    </Text>
                    <Text style={styles.metaText}>
                      {formatDate(item.fechaOrden)}
                    </Text>
                  </View>

                  {/* Address for delivery */}
                  {item.tipoPedido === 'domicilio' &&
                    item.domicilios?.[0]?.direccionEntrega && (
                      <View style={styles.addressRow}>
                        <Icon
                          name="map-marker-outline"
                          size={14}
                          color={colors.textMuted}
                        />
                        <Text style={styles.addressText}>
                          {item.domicilios[0].direccionEntrega}
                        </Text>
                      </View>
                    )}

                  {/* Observations */}
                  {item.observaciones && (
                    <View style={styles.observationRow}>
                      <Icon
                        name="note-text-outline"
                        size={14}
                        color={colors.warning}
                      />
                      <Text style={styles.observationText}>
                        {item.observaciones}
                      </Text>
                    </View>
                  )}

                  {/* Products */}
                  {item.productos && item.productos.length > 0 && (
                    <View style={styles.productList}>
                      {item.productos.map((prod) => (
                        <View key={prod.id} style={styles.productRow}>
                          <View style={styles.productDot} />
                          <Text style={styles.productText}>
                            {prod.producto}
                          </Text>
                          <Text style={styles.productQty}>x{prod.cantidad}</Text>
                        </View>
                      ))}
                    </View>
                  )}

                  {/* Actions */}
                  <View style={{ gap: spacing.sm, marginTop: spacing.md }}>
                    {item.estadoOrden !== 'completada' && item.estadoOrden !== 'cancelado' && (
                      <Button
                        title={
                          patchLoading === item.ordenId
                            ? 'Actualizando...'
                            : 'Completar'
                        }
                        icon="check-circle-outline"
                        variant="primary"
                        size="sm"
                        fullWidth
                        loading={patchLoading === item.ordenId}
                        onPress={() => markAsCompleted(item.ordenId)}
                      />
                    )}




                  </View>
                </Card>
              </View>
            );
          }}
          ListEmptyComponent={
            <EmptyState
              message="Sin órdenes hoy"
              subMessage={
                filter === 'pendientes'
                  ? 'No tienes órdenes pendientes.'
                  : 'Aún no se han registrado órdenes hoy.'
              }
              icon="clipboard-text-off-outline"
            />
          }
        />
      )}



    </PageContainer>
  );
}

const styles = StyleSheet.create({
  actionsBar: {
    flexDirection: 'row',
    gap: spacing.md,
    marginBottom: spacing.xl,
    flexWrap: 'wrap',
  },
  filterRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  filterTab: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.full,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  filterTabActive: {
    backgroundColor: colors.primaryLight,
    borderColor: colors.primary,
  },
  filterText: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.medium,
    color: colors.textMuted,
  },
  filterTextActive: {
    color: colors.primary,
    fontWeight: fontWeight.bold,
  },
  gridItem: {
    flex: 1,
    marginBottom: spacing.md,
    maxWidth: '33.33%',
  },
  gridItemMobile: {
    maxWidth: '100%',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  cardHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  clientName: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold,
    color: colors.text,
    flex: 1,
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  metaText: {
    fontSize: fontSize.xs,
    color: colors.textMuted,
    textTransform: 'capitalize',
  },
  addressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginBottom: spacing.sm,
    padding: spacing.sm,
    backgroundColor: colors.bgLight,
    borderRadius: radius.sm,
  },
  addressText: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    flex: 1,
  },
  observationRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.xs,
    marginBottom: spacing.sm,
    padding: spacing.sm,
    backgroundColor: colors.warningLight,
    borderRadius: radius.sm,
    borderLeftWidth: 3,
    borderLeftColor: colors.warning,
  },
  observationText: {
    fontSize: fontSize.sm,
    color: colors.warning,
    fontStyle: 'italic',
    flex: 1,
  },
  productList: {
    marginTop: spacing.sm,
    padding: spacing.sm,
    backgroundColor: colors.bgLight,
    borderRadius: radius.sm,
  },
  productRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 3,
  },
  productDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: colors.primary,
    marginRight: spacing.sm,
  },
  productText: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    flex: 1,
  },
  productQty: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.bold,
    color: colors.text,
    marginLeft: spacing.sm,
  },
});
