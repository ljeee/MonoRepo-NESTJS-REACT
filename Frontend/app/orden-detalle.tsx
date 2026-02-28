import * as Clipboard from 'expo-clipboard';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { api } from '../services/api';
import { colors } from '../styles/theme';
import { spacing } from '../styles/tokens';
import { formatCurrency, formatDate } from '../utils/formatNumber';
import { getEstadoColor } from '../constants/estados';
import { useToast } from '../contexts/ToastContext';
import type { IconName } from '../components/ui';
import {
  PageContainer,
  PageHeader,
  Button,
  Card,
  Badge,
  Icon,
  ListSkeleton,
  ConfirmModal,
} from '../components/ui';
import { ordenDetalleStyles as styles } from '../styles/ordenes/orden-detalle.styles';




interface ProductoObj {
  productoId?: number;
  productoNombre?: string;
  precio?: number;
}

interface VarianteObj {
  varianteId?: number;
  nombre?: string;
  precio?: number;
}

interface OrdenProducto {
  ordenProductoId?: number;
  cantidad: number;
  producto?: string;
  productoObj?: ProductoObj;
  precioUnitario?: number;
  varianteId?: number;
  variante?: VarianteObj;
  tipo?: string;
  tamano?: string;
  sabor1?: string;
  sabor2?: string;
  sabor3?: string;
  sabor4?: string;
}

interface Factura {
  facturaId?: number;
  clienteNombre?: string;
  descripcion?: string;
  total?: number;
  metodo?: string;
  estado?: string;
  fechaFactura?: string;
}

interface Domicilio {
  domicilioId?: number;
  direccionEntrega?: string;
  telefono?: number;
  telefonoDomiciliarioAsignado?: number;
  costoDomicilio?: number;
}

interface OrdenDetalle {
  ordenId: number;
  tipoPedido?: string;
  estadoOrden?: string;
  fechaOrden?: string;
  observaciones?: string;
  factura?: Factura;
  productos?: OrdenProducto[];
  domicilios?: Domicilio[];
}

function normalizeOrdenDetalle(ordenData: unknown): OrdenDetalle {
  const normalized = ordenData as OrdenDetalle;
  if (!Array.isArray(normalized.productos)) {
    normalized.productos = [];
  }
  return normalized;
}

function getErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return fallback;
}

export default function OrdenDetalleScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const ordenId = params.ordenId as string;
  const { showToast } = useToast();

  const [orden, setOrden] = useState<OrdenDetalle | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [canceling, setCanceling] = useState(false);

  useEffect(() => {
    if (!ordenId) {
      setError('ID de orden no proporcionado');
      setLoading(false);
      return;
    }

    const fetchOrden = async () => {
      try {
        const ordenData = await api.ordenes.getById(Number(ordenId));
        setOrden(normalizeOrdenDetalle(ordenData));
      } catch (error: unknown) {
        setError(getErrorMessage(error, 'Error cargando orden'));
      } finally {
        setLoading(false);
      }
    };

    fetchOrden();
  }, [ordenId]);

  const getProductName = (p: OrdenProducto) => {
    if (p.producto) return p.producto;
    const baseName = p.productoObj?.productoNombre;
    const varianteName = p.variante?.nombre;
    if (baseName && varianteName) return `${baseName} — ${varianteName}`;
    if (baseName) return baseName;
    const parts = [];
    if (p.tipo) parts.push(p.tipo);
    if (p.tamano) parts.push(p.tamano);
    return parts.length > 0 ? parts.join(' ') : 'Producto sin nombre';
  };

  const getUnitPrice = (p: OrdenProducto): number | null => {
    if (p.precioUnitario != null) return Number(p.precioUnitario);
    if (p.variante?.precio != null) return Number(p.variante.precio);
    if (p.productoObj?.precio != null) return Number(p.productoObj.precio);
    return null;
  };

  const getProductDetails = (p: OrdenProducto) => {
    const flavors = [p.sabor1, p.sabor2, p.sabor3, p.sabor4].filter(Boolean);
    return flavors.length > 0 ? flavors.join(' / ') : null;
  };

  const handleCopy = async () => {
    if (!orden) return;
    const productLines = (orden.productos || []).map((p) => {
      const name = getProductName(p);
      const qty = p.cantidad || 1;
      const details = getProductDetails(p);
      const price = getUnitPrice(p);
      let line = `${qty} ${name}`;
      if (details) line += `  ${details}`;
      if (price != null) line += `  $${formatCurrency(price * qty)}`;
      return line;
    });

    const textoACopiar = [
      `Cliente: ${orden.factura?.clienteNombre || 'Sin nombre'}`,
      orden.domicilios?.[0]?.telefono ? `Teléfono: ${orden.domicilios[0].telefono}` : '',
      orden.domicilios?.[0]?.direccionEntrega ? `Dirección: ${orden.domicilios[0].direccionEntrega}` : '',
      productLines.length > 0 ? `Productos:\n${productLines.join('\n')}` : '',
      `Método de pago: ${orden.factura?.metodo || 'No especificado'}`,
      orden.factura?.total != null ? `Total: $${formatCurrency(Number(orden.factura.total))}` : '',
    ]
      .filter(Boolean)
      .join('\n');

    try {
      await Clipboard.setStringAsync(textoACopiar);
      showToast('Datos copiados al portapapeles', 'success', 2000);
    } catch {
      showToast('No se pudo copiar', 'error');
    }
  };

  const handleCancelOrder = async () => {
    if (!orden) return;

    setCanceling(true);
    try {
      await api.ordenes.cancel(orden.ordenId);
      showToast('Orden cancelada exitosamente', 'success', 2000);
      setShowCancelModal(false);

      // Refresh order data
      const ordenData = await api.ordenes.getById(Number(ordenId));
      setOrden(normalizeOrdenDetalle(ordenData));
    } catch (error: unknown) {
      showToast(getErrorMessage(error, 'Error al cancelar la orden'), 'error', 5000);
    } finally {
      setCanceling(false);
    }
  };

  const canCancelOrder = () => {
    if (!orden) return false;
    const estado = orden.estadoOrden?.toLowerCase();
    return estado === 'pendiente' || estado === 'en preparación' || estado === 'preparacion';
  };

  if (loading) {
    return (
      <PageContainer>
        <ListSkeleton count={3} />
      </PageContainer>
    );
  }

  if (error || !orden) {
    return (
      <PageContainer>
        <View style={styles.errorBox}>
          <Icon name="alert-circle-outline" size={48} color={colors.danger} />
          <Text style={styles.errorText}>{error || 'Orden no encontrada'}</Text>
          <Button title="Volver" icon="arrow-left" variant="ghost" onPress={() => router.back()} />
        </View>
      </PageContainer>
    );
  }

  const ec = getEstadoColor(orden.estadoOrden);

  return (
    <PageContainer>
      <PageHeader
        title={`Orden #${orden.ordenId}`}
        icon="clipboard-text-outline"
        rightContent={
          <View style={{ flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' }}>
            {canCancelOrder() && (
              <Button
                title="Cancelar"
                icon="close-circle-outline"
                variant="danger"
                size="sm"
                onPress={() => setShowCancelModal(true)}
                style={{ paddingHorizontal: 8, height: 32 }}
              />
            )}
            <Button
              title="Copiar Datos"
              icon="content-copy"
              variant="primary"
              size="sm"
              onPress={handleCopy}
            />
            <Button
              title=""
              icon="calendar-today"
              variant="ghost"
              size="sm"
              onPress={() => router.push('/ordenes')}
              style={{ paddingHorizontal: spacing.sm, minWidth: 0 }}
            />
          </View>
        }
      />

      {/* ── General Info ── */}
      <Card padding="lg" style={{ marginBottom: spacing.lg }}>
        <View style={styles.sectionHeader}>
          <Icon name="information-outline" size={20} color={colors.primary} />
          <Text style={styles.sectionTitle}>Información General</Text>
        </View>

        <View style={styles.infoGrid}>
          <InfoRow icon="tag-outline" label="Tipo de Pedido" value={orden.tipoPedido || 'No especificado'} />
          {orden.factura?.clienteNombre && (
            <InfoRow icon="account-outline" label="Cliente" value={orden.factura.clienteNombre} />
          )}
          {orden.domicilios?.[0]?.telefono && (
            <InfoRow icon="phone-outline" label="Teléfono" value={String(orden.domicilios[0].telefono)} />
          )}
          {orden.domicilios?.[0]?.direccionEntrega && (
            <InfoRow icon="map-marker-outline" label="Dirección" value={orden.domicilios[0].direccionEntrega} />
          )}
          {orden.factura?.metodo && (
            <InfoRow icon="credit-card-outline" label="Método de Pago" value={orden.factura.metodo} />
          )}
          {orden.estadoOrden && (
            <View style={styles.infoRow}>
              <Icon name="flag-outline" size={16} color={colors.textMuted} />
              <Text style={styles.infoLabel}>Estado</Text>
              <Badge
                label={orden.estadoOrden}
                variant={
                  orden.estadoOrden === 'pendiente' ? 'warning'
                    : orden.estadoOrden === 'completada' || orden.estadoOrden === 'entregado' ? 'success'
                      : orden.estadoOrden === 'cancelado' ? 'danger'
                        : 'info'
                }
                icon={ec.icon}
                size="md"
              />
            </View>
          )}
          {orden.fechaOrden && (
            <InfoRow icon="calendar-outline" label="Fecha" value={formatDate(orden.fechaOrden)} />
          )}
          {orden.domicilios?.[0]?.costoDomicilio != null && (
            <InfoRow
              icon="truck-delivery-outline"
              label="Costo Domicilio"
              value={`$${formatCurrency(Number(orden.domicilios[0].costoDomicilio))}`}
            />
          )}
          {orden.observaciones && (
            <InfoRow icon="note-text-outline" label="Observaciones" value={orden.observaciones} />
          )}
          {orden.factura?.descripcion && (
            <InfoRow icon="text-box-outline" label="Descripción" value={orden.factura.descripcion} />
          )}
        </View>
      </Card>

      {/* ── Products ── */}
      <Card padding="lg" style={{ marginBottom: spacing.lg }}>
        <View style={styles.sectionHeader}>
          <Icon name="food-variant" size={20} color={colors.primary} />
          <Text style={styles.sectionTitle}>Productos</Text>
        </View>

        {orden.productos && orden.productos.length > 0 ? (
          orden.productos.map((p, index) => {
            const price = getUnitPrice(p);
            const details = getProductDetails(p);
            return (
              <View key={index} style={styles.productCard}>
                <View style={styles.productHeader}>
                  <View style={styles.productNameRow}>
                    <View style={styles.productIndex}>
                      <Text style={styles.productIndexText}>{index + 1}</Text>
                    </View>
                    <Text style={styles.productName}>{getProductName(p)}</Text>
                  </View>
                  <View style={styles.qtyBadge}>
                    <Text style={styles.qtyText}>x{p.cantidad || 1}</Text>
                  </View>
                </View>

                {details && (
                  <View style={styles.flavorsRow}>
                    <Icon name="palette-outline" size={14} color={colors.secondary} />
                    <Text style={styles.flavorsText}>{details}</Text>
                  </View>
                )}

                {price != null && (
                  <View style={styles.priceRow}>
                    <Text style={styles.priceLabel}>
                      ${formatCurrency(price)} c/u
                    </Text>
                    {p.cantidad && (
                      <Text style={styles.priceTotal}>
                        ${formatCurrency(price * Number(p.cantidad))}
                      </Text>
                    )}
                  </View>
                )}
              </View>
            );
          })
        ) : (
          <View style={styles.emptyProducts}>
            <Icon name="food-off" size={32} color={colors.textMuted} />
            <Text style={styles.emptyProductsText}>No hay productos en esta orden</Text>
          </View>
        )}
      </Card>

      {/* ── Total ── */}
      {orden.factura?.total != null && (
        <Card variant="elevated" padding="lg" style={styles.totalCard}>
          {/* Show breakdown if there's delivery cost */}
          {orden.domicilios?.[0]?.costoDomicilio != null && orden.domicilios[0].costoDomicilio > 0 ? (
            <>
              <View style={styles.subtotalRow}>
                <Text style={styles.subtotalLabel}>Subtotal Productos</Text>
                <Text style={styles.subtotalValue}>
                  ${formatCurrency(Number(orden.factura.total) - Number(orden.domicilios[0].costoDomicilio))}
                </Text>
              </View>
              <View style={styles.subtotalRow}>
                <Text style={styles.subtotalLabel}>Costo Domicilio</Text>
                <Text style={styles.subtotalValue}>
                  ${formatCurrency(Number(orden.domicilios[0].costoDomicilio))}
                </Text>
              </View>
              <View style={styles.divider} />
            </>
          ) : null}

          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Total</Text>
            <Text style={styles.totalValue}>
              ${formatCurrency(Number(orden.factura.total))}
            </Text>
          </View>
        </Card>
      )}



      {/* ── Cancel Confirmation Modal ── */}
      <ConfirmModal
        visible={showCancelModal}
        title="Cancelar Orden"
        message={`¿Estás seguro de cancelar la orden #${orden.ordenId}? Esta acción no se puede deshacer.`}
        icon="close-circle-outline"
        variant="danger"
        confirmText="Cancelar Orden"
        loading={canceling}
        onConfirm={handleCancelOrder}
        onCancel={() => setShowCancelModal(false)}
      />
    </PageContainer >
  );
}

// ── Helper component ──
function InfoRow({
  icon,
  label,
  value,
}: {
  icon: IconName;
  label: string;
  value: string;
}) {
  return (
    <View style={styles.infoRow}>
      <Icon name={icon} size={16} color={colors.textMuted} />
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}


