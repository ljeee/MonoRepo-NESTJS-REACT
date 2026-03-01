import React, { useCallback, useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useRouter } from 'expo-router';
import { api } from '../services/api';
import { Orden, PaginatedResponse } from '../types/models';
import { formatCurrency, formatDate } from '../utils/formatNumber';
import { colors } from '../styles/theme';
import { fontSize, fontWeight, spacing, radius } from '../styles/tokens';
import { ESTADO_LABELS, getEstadoColor } from '../constants/estados';
import {
  PageContainer,
  PageHeader,
  Button,
  Card,
  Badge,
  Icon,
  Input,
  ListSkeleton,
} from '../components/ui';
import { useBreakpoint } from '../styles/responsive';

const LIMIT = 20;

// Simplified filter states - only show most commonly used
const FILTER_ESTADOS = ['', 'pendiente', 'completada', 'cancelado'] as const;

type OrdenesQueryParams = {
  page: number;
  limit: number;
  estado?: string;
  from?: string;
  to?: string;
};

function getOrdenTotal(orden: Orden): number {
  if (typeof orden.factura?.totalFactura === 'number') {
    return orden.factura.totalFactura;
  }

  if (typeof orden.factura?.total === 'number') {
    return orden.factura.total;
  }

  return (
    orden.productos?.reduce(
      (sum, producto) => sum + (producto.precioUnitario ?? 0) * (producto.cantidad ?? 1),
      0,
    ) ?? 0
  );
}

function getProductoPreviewName(producto: NonNullable<Orden['productos']>[number]): string {
  if (typeof producto.productoNombre === 'string' && producto.productoNombre.trim()) {
    return producto.productoNombre;
  }
  if (typeof producto.producto === 'string' && producto.producto.trim()) {
    return producto.producto;
  }
  return 'Producto';
}

export default function OrdenesTodasScreen() {
  const router = useRouter();
  const { isMobile } = useBreakpoint();
  const [page, setPage] = useState(1);
  const [estado, setEstado] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [result, setResult] = useState<PaginatedResponse<Orden> | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const fetchData = useCallback(
    async (p: number) => {
      setLoading(true);
      setError('');
      try {
        const params: OrdenesQueryParams = { page: p, limit: LIMIT };
        if (estado) params.estado = estado;
        if (from) params.from = from;
        if (to) params.to = to;
        const data = await api.ordenes.getAll(params);
        setResult(data);
        setPage(p);
      } catch {
        setError('Error al cargar órdenes');
      } finally {
        setLoading(false);
      }
    },
    [estado, from, to],
  );

  useEffect(() => {
    fetchData(1);
  }, [fetchData]);

  const ordenes = result?.data ?? [];

  return (
    <PageContainer>
      <PageHeader
        title="Todas las Órdenes"
      />

      {/* Actions Bar */}
      <View style={styles.actionsBar}>
        <Button
          title="Refrescar"
          icon="refresh"
          variant="ghost"
          size="sm"
          onPress={() => fetchData(1)}
        />
        <View style={styles.iconBox}>
          <Icon name="format-list-bulleted" size={24} color={colors.primary} />
        </View>
      </View>

      {/* Estado chips */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.chipsScroll}
        contentContainerStyle={styles.chipsContent}
      >
        {FILTER_ESTADOS.map((e) => {
          const ec = getEstadoColor(e || undefined);
          const active = estado === e;
          return (
            <TouchableOpacity
              key={e}
              style={[
                styles.chip,
                active && { backgroundColor: ec.bg, borderColor: ec.text },
              ]}
              onPress={() => setEstado(e)}
            >
              {e !== '' && (
                <Icon name={ec.icon} size={14} color={active ? ec.text : colors.textMuted} />
              )}
              <Text
                style={[
                  styles.chipText,
                  active && { color: ec.text, fontWeight: fontWeight.bold },
                ]}
              >
                {ESTADO_LABELS[e]}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* Date filters */}
      <View style={[styles.dateRow, isMobile && styles.dateRowMobile]}>
        <Input
          label="Desde"
          value={from}
          onChangeText={setFrom}
          placeholder="YYYY-MM-DD"
          containerStyle={styles.dateInputContainer}
          size="sm"
          leftIcon={<Icon name="calendar" size={16} color={colors.textMuted} />}
        />
        <Input
          label="Hasta"
          value={to}
          onChangeText={setTo}
          placeholder="YYYY-MM-DD"
          containerStyle={styles.dateInputContainer}
          size="sm"
          leftIcon={<Icon name="calendar" size={16} color={colors.textMuted} />}
        />
      </View>

      {/* Pagination info */}
      {result && (
        <View style={styles.paginationInfo}>
          <Text style={styles.totalText}>
            {result.total} órdenes encontradas
          </Text>
          <View style={styles.paginationRow}>
            <TouchableOpacity
              style={[styles.pageBtn, page <= 1 && styles.pageBtnDisabled]}
              onPress={() => page > 1 && fetchData(page - 1)}
              disabled={page <= 1}
            >
              <Icon name="chevron-left" size={18} color={page <= 1 ? colors.textMuted : colors.text} />
            </TouchableOpacity>
            <Text style={styles.pageText}>
              {result.page} / {result.totalPages}
            </Text>
            <TouchableOpacity
              style={[
                styles.pageBtn,
                page >= (result?.totalPages ?? 1) && styles.pageBtnDisabled,
              ]}
              onPress={() =>
                page < (result?.totalPages ?? 1) && fetchData(page + 1)
              }
              disabled={page >= (result?.totalPages ?? 1)}
            >
              <Icon name="chevron-right" size={18} color={page >= (result?.totalPages ?? 1) ? colors.textMuted : colors.text} />
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Loading / Error / Empty */}
      {loading && <ListSkeleton count={5} />}
      {error ? (
        <View style={styles.errorBox}>
          <Icon name="alert-circle-outline" size={18} color={colors.danger} />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}
      {!loading && !error && ordenes.length === 0 && (
        <View style={styles.emptyBox}>
          <Icon name="clipboard-text-off-outline" size={48} color={colors.textMuted} />
          <Text style={styles.emptyText}>No se encontraron órdenes</Text>
        </View>
      )}

      {/* Order cards */}
      {!loading &&
        ordenes.map((orden) => {
          const ec = getEstadoColor(orden.estadoOrden);
          const total = getOrdenTotal(orden);

          return (
            <Card
              key={orden.ordenId}
              onPress={() =>
                router.push(`/orden-detalle?ordenId=${orden.ordenId}`)
              }
              style={styles.cardMarginMd}
              padding="md"
            >
              {/* Header */}
              <View style={styles.cardHeader}>
                <View style={styles.cardHeaderLeft}>
                  <Text style={styles.orderId}>#{orden.ordenId}</Text>
                  <Badge
                    label={orden.estadoOrden || 'N/A'}
                    variant={
                      orden.estadoOrden === 'pendiente'
                        ? 'warning'
                        : orden.estadoOrden === 'completada' || orden.estadoOrden === 'entregado'
                          ? 'success'
                          : orden.estadoOrden === 'cancelado'
                            ? 'danger'
                            : 'info'
                    }
                    icon={ec.icon}
                    size="sm"
                  />
                </View>
                <Text style={styles.totalPrice}>${formatCurrency(total)}</Text>
              </View>

              {/* Meta */}
              <View style={styles.cardMeta}>
                <View style={styles.metaItem}>
                  <Icon name="tag-outline" size={14} color={colors.textMuted} />
                  <Text style={styles.metaText}>{orden.tipoPedido}</Text>
                </View>
                <View style={styles.metaItem}>
                  <Icon name="calendar-outline" size={14} color={colors.textMuted} />
                  <Text style={styles.metaText}>
                    {formatDate(orden.fechaOrden)}
                  </Text>
                </View>
              </View>

              {/* Products preview */}
              {orden.productos && orden.productos.length > 0 && (
                <View style={styles.productsPreview}>
                  {orden.productos.slice(0, 3).map((p, i) => (
                    <Text key={i} style={styles.productPreviewText}>
                      • {getProductoPreviewName(p)} x{p.cantidad}
                    </Text>
                  ))}
                  {orden.productos.length > 3 && (
                    <Text style={styles.moreProducts}>
                      +{orden.productos.length - 3} más...
                    </Text>
                  )}
                </View>
              )}
            </Card>
          );
        })}

      {/* Bottom pagination */}
      {result && result.totalPages > 1 && (
        <View style={[styles.paginationRow, { justifyContent: 'center', paddingVertical: spacing.lg }]}>
          <TouchableOpacity
            style={[styles.pageBtn, page <= 1 && styles.pageBtnDisabled]}
            onPress={() => page > 1 && fetchData(page - 1)}
            disabled={page <= 1}
          >
            <Icon name="chevron-left" size={18} color={page <= 1 ? colors.textMuted : colors.text} />
            <Text style={[styles.pageBtnText, page <= 1 && { color: colors.textMuted }]}>Anterior</Text>
          </TouchableOpacity>
          <Text style={styles.pageText}>
            Pág {page} de {result.totalPages}
          </Text>
          <TouchableOpacity
            style={[
              styles.pageBtn,
              page >= result.totalPages && styles.pageBtnDisabled,
            ]}
            onPress={() => page < result.totalPages && fetchData(page + 1)}
            disabled={page >= result.totalPages}
          >
            <Text style={[styles.pageBtnText, page >= result.totalPages && { color: colors.textMuted }]}>Siguiente</Text>
            <Icon name="chevron-right" size={18} color={page >= result.totalPages ? colors.textMuted : colors.text} />
          </TouchableOpacity>
        </View>
      )}
    </PageContainer>
  );
}

const styles = StyleSheet.create({
  actionsBar: {
    flexDirection: 'row',
    justifyContent: 'space-between', // Push items to edges
    alignItems: 'center',
    marginBottom: spacing.xl,
    gap: spacing.md,
  },
  chipsScroll: {
    marginBottom: spacing.lg,
    flexGrow: 0,
  },
  chipsContent: {
    gap: spacing.sm,
    paddingVertical: spacing.xs,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.full,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipText: {
    fontSize: fontSize.sm,
    color: colors.textMuted,
    fontWeight: fontWeight.medium,
  },
  dateRow: {
    flexDirection: 'row',
    gap: spacing.md,
    marginBottom: spacing.sm,
  },
  dateRowMobile: {
    flexDirection: 'column',
  },
  paginationInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.lg,
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  totalText: {
    fontSize: fontSize.sm,
    color: colors.textMuted,
  },
  paginationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  pageBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  pageBtnDisabled: {
    opacity: 0.4,
  },
  pageBtnText: {
    fontSize: fontSize.sm,
    color: colors.text,
    fontWeight: fontWeight.medium,
  },
  pageText: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    fontWeight: fontWeight.semibold,
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.dangerLight,
    padding: spacing.lg,
    borderRadius: radius.md,
    marginBottom: spacing.lg,
  },
  errorText: {
    color: colors.danger,
    fontSize: fontSize.md,
    fontWeight: fontWeight.medium,
  },
  emptyBox: {
    alignItems: 'center',
    padding: spacing['5xl'],
    gap: spacing.md,
  },
  emptyText: {
    fontSize: fontSize.lg,
    color: colors.textMuted,
    fontWeight: fontWeight.medium,
  },
  // Card internals
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  cardHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  orderId: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold,
    color: colors.text,
  },
  totalPrice: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.extrabold,
    color: colors.primary,
  },
  cardMeta: {
    flexDirection: 'row',
    gap: spacing.xl,
    marginBottom: spacing.sm,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  metaText: {
    fontSize: fontSize.sm,
    color: colors.textMuted,
    textTransform: 'capitalize',
  },
  productsPreview: {
    padding: spacing.sm,
    backgroundColor: colors.bgLight,
    borderRadius: radius.sm,
    marginTop: spacing.xs,
  },
  productPreviewText: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    paddingVertical: 2,
  },
  moreProducts: {
    fontSize: fontSize.xs,
    color: colors.textMuted,
    fontStyle: 'italic',
    marginTop: spacing.xs,
  },
  iconBox: {
    backgroundColor: colors.card,
    padding: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    justifyContent: 'center',
    alignItems: 'center',
    height: 40,
    width: 40,
  },
  dateInputContainer: {
    flex: 1,
    minWidth: 140,
  },
  cardMarginMd: {
    marginBottom: spacing.md,
  },
});
