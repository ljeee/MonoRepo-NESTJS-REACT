import React, { useCallback, useEffect, useState } from 'react';
import { FlatList, Text, TouchableOpacity, View, StyleSheet, RefreshControl, ActivityIndicator } from 'react-native';
import { Href, useRouter } from 'expo-router';
import { api } from '../../services/api';
import { useBreakpoint } from '../../styles/responsive';
import { EmptyState } from '../states/EmptyState';
import { ErrorState } from '../states/ErrorState';
import { ListSkeleton } from '../ui/SkeletonLoader';
import { PageContainer, PageHeader, Button, Card, Badge, Icon } from '../ui';
import { colors } from '../../styles/theme';
import { fontSize, fontWeight, spacing, radius, shadows } from '../../styles/tokens';
import { formatDate } from '../../utils/formatNumber';
import { useOrdenesSocket } from '../../hooks/use-ordenes-socket';
import type { Orden } from '../../types/models';

function getErrorStatusCode(error: unknown): number | undefined {
  if (
    error &&
    typeof error === 'object' &&
    'response' in error &&
    (error as { response?: unknown }).response &&
    typeof (error as { response?: unknown }).response === 'object' &&
    'status' in ((error as { response?: { status?: unknown } }).response as { status?: unknown })
  ) {
    const status = ((error as { response?: { status?: unknown } }).response as { status?: unknown }).status;
    return typeof status === 'number' ? status : undefined;
  }
  return undefined;
}

export default function OrdersOfDayPending() {
  const router = useRouter();
  const { isMobile, isTablet } = useBreakpoint();
  const [orders, setOrders] = useState<Orden[]>([]);
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
      setOrders(data);
    } catch (error: unknown) {
      if (getErrorStatusCode(error) === 404) {
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

  const { isConnected } = useOrdenesSocket('cajero', () => fetchOrders(true));

  const markAsCompleted = async (ordenId: number) => {
    setPatchLoading(ordenId);
    try {
      await api.ordenes.update(ordenId, { estadoOrden: 'completada' });
      await fetchOrders();
    } catch {
      setError('No se pudo actualizar la orden');
    } finally {
      setPatchLoading(null);
    }
  };

  const getClientName = (item: Orden) => {
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
    <PageContainer scrollable={false} contentContainerStyle={styles.flex1}>
      <PageHeader
        title={filter === 'pendientes' ? 'Órdenes Pendientes' : 'Órdenes del Día'}
        icon="clipboard-text-outline"
      />

      {/* Actions & Filters */}
      <View style={[styles.filterRow, isMobile && styles.filterRowMobile]}>
        <View style={[styles.filterRowInner, isMobile && styles.filterRowInnerMobile]}>
          {([
            { key: 'dia' as const, label: 'Todas', icon: 'calendar-today' as const },
            { key: 'pendientes' as const, label: 'Pendientes', icon: 'clock-outline' as const },
          ]).map((f) => (
            <TouchableOpacity
              key={f.key}
              onPress={() => setFilter(f.key)}
              style={[
                styles.filterTab,
                filter === f.key && styles.filterTabActive,
                styles.filterTabSpacing,
                isMobile && styles.filterTabMobile,
              ]}
            >
              <Icon
                name={f.icon}
                size={16}
                color={filter === f.key ? colors.primary : colors.textMuted}
                style={styles.iconMarginSm}
              />
              <Text
                style={[
                  styles.filterText,
                  filter === f.key && styles.filterTextActive,
                ]}
                numberOfLines={1}
              >
                {f.label}
              </Text>
            </TouchableOpacity>
          ))}
          <View
            style={[
              styles.socketIndicator,
              isMobile && styles.socketIndicatorMobile,
              {
                backgroundColor: isConnected ? colors.success : colors.danger,
                marginBottom: spacing.sm,
              },
            ]}
          />
        </View>

        <Button
          title="Refrescar"
          icon="refresh"
          variant="ghost"
          size="sm"
          onPress={() => fetchOrders()}
          style={isMobile ? styles.refreshButtonMobile : undefined}
        />
      </View>

      {/* Content */}
      {loading ? (
        <ListSkeleton count={6} />
      ) : error ? (
        <ErrorState message={error} onRetry={fetchOrders} />
      ) : (
        <FlatList
          style={styles.flex1}
          data={orders}
          keyExtractor={(item, index) =>
            item.ordenId?.toString() || `${item.fechaOrden || 'orden'}-${index}`
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
          contentContainerStyle={styles.listContent}
          columnWrapperStyle={
            numColumns > 1 ? { gap: spacing.md } : undefined
          }
          renderItem={({ item }) => {
            return (
              <View style={[styles.gridItem, isMobile && styles.gridItemMobile]}>
                <Card
                  onPress={() =>
                    router.push(
                      `/orden-detalle?ordenId=${item.ordenId}` as Href,
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
                        style={styles.iconMarginMd}
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
                  <View style={styles.cardActions}>
                    {item.estadoOrden !== 'completada' && item.estadoOrden !== 'cancelado' && (
                      <TouchableOpacity
                        style={[
                          styles.completeButtonCircle,
                          patchLoading === item.ordenId && { opacity: 0.7 }
                        ]}
                        onPress={() => markAsCompleted(item.ordenId)}
                        disabled={patchLoading === item.ordenId}
                        activeOpacity={0.8}
                      >
                        {patchLoading === item.ordenId ? (
                          <ActivityIndicator size="small" color={colors.card} />
                        ) : (
                          <Icon name="check-bold" size={24} color={colors.card} />
                        )}
                      </TouchableOpacity>
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
    gap: spacing.sm,
  },
  filterRowMobile: {
    flexDirection: 'column',
    alignItems: 'stretch',
  },
  filterTab: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
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
    alignItems: 'center',
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
  socketIndicator: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginLeft: spacing.sm,
  },
  completeButtonCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.sm,
  },
  flex1: {
    flex: 1,
  },
  filterRowInner: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    flex: 1,
  },
  filterRowInnerMobile: {
    flex: 0,
    width: '100%',
  },
  iconMarginSm: {
    marginRight: 6,
  },
  filterTabSpacing: {
    marginRight: spacing.sm,
    marginBottom: spacing.sm,
  },
  filterTabMobile: {
    marginRight: spacing.xs,
  },
  socketIndicatorMobile: {
    marginLeft: 0,
  },
  refreshButtonMobile: {
    alignSelf: 'flex-end',
  },
  listContent: {
    paddingBottom: spacing.lg,
  },
  iconMarginMd: {
    marginRight: spacing.sm,
  },
  cardActions: {
    marginTop: spacing.md,
    alignItems: 'flex-end',
  },
});
