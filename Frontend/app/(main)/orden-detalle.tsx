import * as Clipboard from 'expo-clipboard';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, TextInput } from '../../tw';
import { api } from '../../services/api';
import { formatCurrency, formatDate } from '@monorepo/shared';
import { getEstadoColor } from '../../constants/estados';
import { useToast } from '@monorepo/shared';
import type { IconName } from '../../components/ui';
import {
  PageContainer,
  PageHeader,
  Button,
  Card,
  Badge,
  Icon,
  ListSkeleton,
  ConfirmModal,
} from '../../components/ui';

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
  const ordenId = params.ordenId || params.id; // Support both naming conventions
  const { showToast } = useToast();

  const [viewState, setViewState] = useState<{ orden: OrdenDetalle | null; loading: boolean; error: string | null }>({
    orden: null,
    loading: true,
    error: null,
  });
  const { orden, loading, error } = viewState;
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [canceling, setCanceling] = useState(false);

  useEffect(() => {
    if (!ordenId) {
      return;
    }

    const fetchOrden = async () => {
      try {
        const ordenData = await api.ordenes.getById(Number(ordenId));
        setViewState({ orden: normalizeOrdenDetalle(ordenData), loading: false, error: null });
      } catch (error: unknown) {
        setViewState({ orden: null, loading: false, error: getErrorMessage(error, 'Error cargando orden') });
      }
    };

    void fetchOrden();
  }, [ordenId]);

  if (!ordenId) {
    return (
      <PageContainer className="justify-center items-center">
        <View className="items-center p-10 bg-(--color-pos-surface) rounded-3xl border border-white/5">
          <Icon name="alert-circle-outline" size={64} color="#F43F5E" />
          <Text className="text-white text-xl font-black mt-6 mb-8 uppercase tracking-tight" style={{ fontFamily: 'Space Grotesk' }}>ID de orden no proporcionado</Text>
          <Button title="Regresar al inicio" icon="arrow-left" variant="ghost" onPress={() => router.replace('/')} />
        </View>
      </PageContainer>
    );
  }

  const getProductName = (p: OrdenProducto) => {
    if (p.producto) return p.producto;
    const baseName = p.productoObj?.productoNombre;
    const varianteName = p.variante?.nombre;
    if (baseName && varianteName) return `${baseName} — ${varianteName}`;
    if (baseName) return baseName;
    const parts = [];
    if (p.tipo) parts.push(p.tipo);
    if (p.tamano) parts.push(p.tamano);
    return parts.length > 0 ? parts.join(' ') : 'Producto';
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
      if (details) line += ` (${details})`;
      if (price != null) line += ` — $${formatCurrency(price * qty)}`;
      return line;
    });

    const textoACopiar = [
      `🍕 Dfiru POS — Orden #${orden.ordenId}`,
      `━━━━━━━━━━━━━━━━━━━━`,
      `Cliente: ${orden.factura?.clienteNombre || 'Sin nombre'}`,
      orden.domicilios?.[0]?.telefono ? `Teléfono: ${orden.domicilios[0].telefono}` : '',
      orden.domicilios?.[0]?.direccionEntrega ? `📍 ${orden.domicilios[0].direccionEntrega}` : '',
      `━━━━━━━━━━━━━━━━━━━━`,
      productLines.length > 0 ? productLines.join('\n') : '',
      `━━━━━━━━━━━━━━━━━━━━`,
      `Método: ${orden.factura?.metodo || 'N/A'}`,
      orden.factura?.total != null ? `TOTAL: $${formatCurrency(Number(orden.factura.total))}` : '',
    ]
      .filter(Boolean)
      .join('\n');

    try {
      await Clipboard.setStringAsync(textoACopiar);
      showToast('Resumen copiado', 'success', 2000);
    } catch {
      showToast('Error al copiar', 'error');
    }
  };

  const handleCancelOrder = async () => {
    if (!orden) return;

    setCanceling(true);
    try {
      await api.ordenes.cancel(orden.ordenId, cancelReason);
      showToast('Orden cancelada', 'success', 2000);
      setShowCancelModal(false);
      setCancelReason('');

      const ordenData = await api.ordenes.getById(Number(ordenId));
      setViewState((prev) => ({ ...prev, orden: normalizeOrdenDetalle(ordenData) }));
    } catch (error: unknown) {
      showToast(getErrorMessage(error, 'Error al cancelar'), 'error', 5000);
      setCanceling(false);
      return;
    }

    setCanceling(false);
  };

  const canCancelOrder = () => {
    if (!orden) return false;
    const estado = String(orden.estadoOrden || '').toLowerCase();
    return estado === 'pendiente' || estado === 'preparacion' || estado === 'en preparación';
  };

  if (loading) {
    return (
      <PageContainer>
        <ListSkeleton count={4} />
      </PageContainer>
    );
  }

  if (error || !orden) {
    return (
      <PageContainer className="justify-center items-center">
        <View className="items-center p-10 bg-(--color-pos-surface) rounded-3xl border border-red-500/10 w-full max-w-sm">
          <Icon name="alert-octagon-outline" size={64} color="#EF4444" />
          <Text className="text-white text-xl font-black mt-6 mb-3 text-center uppercase tracking-tight" style={{ fontFamily: 'Space Grotesk' }}>{error || 'Orden extraviada'}</Text>
          <Text className="text-slate-500 text-sm text-center mb-8 italic">No pudimos localizar la información de esta orden en el sistema.</Text>
          <Button title="Volver al Historial" icon="arrow-left" variant="ghost" className="w-full" onPress={() => router.back()} />
        </View>
      </PageContainer>
    );
  }

  const ec = getEstadoColor(orden.estadoOrden);

  return (
    <PageContainer>
      <PageHeader
        title={`Detalle #${orden.ordenId}`}
        icon="receipt-text-outline"
        rightContent={
          <View className="flex-row items-center gap-2">
            {canCancelOrder() && (
              <Button
                title="Cancelar"
                icon="close-circle-outline"
                variant="danger"
                size="sm"
                onPress={() => setShowCancelModal(true)}
              />
            )}
            <Button
              title="Editar"
              icon="pencil-outline"
              variant="primary"
              size="sm"
              onPress={() => router.push(`/editar-orden?ordenId=${orden.ordenId}` as any)}
            />
            <Button
              title="Copia rápida"
              icon="content-copy"
              variant="secondary"
              size="sm"
              onPress={handleCopy}
            />
          </View>
        }
      />

      <ScrollView showsVerticalScrollIndicator={false} contentContainerClassName="pb-10">
          {/* ── Status Banner ── */}
          <View className="mb-6 p-1 rounded-3xl bg-white/5 border border-white/5 overflow-hidden">
                <View className={`flex-row items-center justify-between p-5 rounded-[22px] bg-white/5`}>
                    <View className="flex-row items-center gap-4">
                        <View className={`w-12 h-12 rounded-2xl items-center justify-center bg-white/5`}>
                            <Icon name={ec.icon} size={24} color={ec.text} />
                        </View>
                        <View>
                            <Text className="text-slate-400 text-[10px] font-black uppercase tracking-widest mb-1">Estado de la Orden</Text>
                            <Text className={`font-black uppercase text-base tracking-tight`} style={{ color: ec.text, fontFamily: 'Space Grotesk' }}>
                                {orden.estadoOrden}
                            </Text>
                        </View>
                    </View>
                    <Icon name="chevron-right" size={24} color="#475569" />
                </View>
          </View>

          {/* ── Info Cards Split ── */}
          <View className="flex-row gap-4 mb-4 flex-wrap">
              {/* Client Info */}
              <Card className="flex-1 min-w-[300px] p-6 border border-white/5 bg-white/5">
                  <View className="flex-row items-center gap-3 mb-6">
                      <View className="w-10 h-10 rounded-xl bg-(--color-pos-primary-light) items-center justify-center border border-(--color-pos-primary)/20">
                          <Icon name="account-outline" size={22} color="#F5A524" />
                      </View>
                      <Text className="text-white font-black text-sm uppercase tracking-wider" style={{ fontFamily: 'Space Grotesk' }}>Cliente & Entrega</Text>
                  </View>
                  
                  <View className="gap-y-5">
                      <DetailItem icon="account" label="Nombre" value={orden.factura?.clienteNombre || 'Consumidor Final'} />
                      <DetailItem icon="tag-outline" label="Tipo" value={orden.tipoPedido || 'N/A'} />
                      {orden.domicilios?.[0]?.telefono && (
                          <DetailItem icon="phone-outline" label="Teléfono" value={String(orden.domicilios[0].telefono)} />
                      )}
                      {orden.domicilios?.[0]?.direccionEntrega && (
                          <DetailItem icon="map-marker-radius-outline" label="Dirección" value={orden.domicilios[0].direccionEntrega} />
                      )}
                  </View>
              </Card>

              {/* Order Info */}
              <Card className="flex-1 min-w-[300px] p-6 border border-white/5 bg-white/5">
                  <View className="flex-row items-center gap-3 mb-6">
                      <View className="w-10 h-10 rounded-xl bg-(--color-pos-secondary-light) items-center justify-center border border-(--color-pos-secondary)/20">
                          <Icon name="clock-outline" size={22} color="#8B5CF6" />
                      </View>
                      <Text className="text-white font-black text-sm uppercase tracking-wider" style={{ fontFamily: 'Space Grotesk' }}>Tiempos & Otros</Text>
                  </View>

                  <View className="gap-y-5">
                      <DetailItem icon="calendar" label="Fecha" value={formatDate(orden.fechaOrden!)} />
                      <DetailItem icon="credit-card-outline" label="Método" value={orden.factura?.metodo || 'Sin pagar'} />
                      {orden.domicilios?.[0]?.costoDomicilio != null && (
                          <DetailItem 
                              icon="truck-delivery" 
                              label="Domicilio" 
                              value={`$${formatCurrency(Number(orden.domicilios[0].costoDomicilio))}`}
                              valueColor="#34D399"
                          />
                      )}
                      {orden.observaciones && (
                          <DetailItem icon="note-text-outline" label="Notas" value={orden.observaciones} italic />
                      )}
                  </View>
              </Card>
          </View>

          {/* ── Products List ── */}
          <View className="mb-6">
              <View className="flex-row items-center gap-3 mb-4 px-2">
                  <Icon name="food-variant" size={20} color="#F5A524" />
                  <Text className="text-white font-black text-sm uppercase tracking-widest" style={{ fontFamily: 'Space Grotesk' }}>Items de la Orden</Text>
                  <View className="h-[1px] flex-1 bg-white/5 ml-2" />
              </View>

              {orden.productos && orden.productos.length > 0 ? (
                  orden.productos.map((p, index) => {
                      const price = getUnitPrice(p);
                      const details = getProductDetails(p);
                      return (
                          <View key={index} style={{
                              flexDirection: 'row', alignItems: 'center',
                              marginBottom: 10, backgroundColor: 'rgba(255,255,255,0.04)',
                              padding: 12, borderRadius: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)',
                          }}>
                              <View style={{ width: 38, height: 38, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.04)', alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
                                  <Text style={{ fontSize: 18 }}>🍕</Text>
                              </View>
                              
                              <View className="flex-1">
                                  <View className="flex-row justify-between items-start">
                                      <Text style={{ fontFamily: 'SpaceGrotesk-Bold', color: '#F8FAFC', fontSize: 13, textTransform: 'uppercase', flex: 1 }}>{getProductName(p)}</Text>
                                      <View style={{ backgroundColor: 'rgba(245,165,36,0.1)', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, borderWidth: 1, borderColor: 'rgba(245,165,36,0.2)', marginLeft: 8 }}>
                                          <Text style={{ fontFamily: 'SpaceGrotesk-Bold', color: '#F5A524', fontSize: 11 }}>x{p.cantidad || 1}</Text>
                                      </View>
                                  </View>
                                  
                                  {details && (
                                      <Text style={{ fontFamily: 'Outfit', color: '#64748B', fontSize: 10, marginTop: 2, fontStyle: 'italic', textTransform: 'uppercase' }}>{details}</Text>
                                  )}
                                  
                                  {price != null && (
                                      <View className="flex-row justify-between items-end mt-1.5">
                                          <Text style={{ fontFamily: 'Outfit', color: '#475569', fontSize: 10 }}>${formatCurrency(price)} c/u</Text>
                                          <Text style={{ fontFamily: 'SpaceGrotesk-Bold', color: '#F8FAFC', fontSize: 13 }}>${formatCurrency(price * (p.cantidad || 1))}</Text>
                                      </View>
                                  )}
                              </View>
                          </View>
                      );
                  })
              ) : (
                  <View className="bg-white/5 rounded-3xl border border-dashed border-white/10 p-12 items-center">
                       <Icon name="food-off-outline" size={48} color="#475569" />
                       <Text className="text-slate-500 font-bold mt-4 uppercase tracking-widest text-xs">Sin productos registrados</Text>
                  </View>
              )}
          </View>

          {/* ── Summary Card ── */}
          {orden.factura?.total != null && (
              <Card style={{ borderColor: 'rgba(245,165,36,0.2)', backgroundColor: 'rgba(245,165,36,0.04)', position: 'relative', overflow: 'hidden', marginBottom: 8 }}>
                  <View style={{ position: 'absolute', right: -20, bottom: -20, opacity: 0.05 }}>
                      <Icon name="pizza" size={160} color="#F5A524" />
                  </View>

                  <View style={{ gap: 10, position: 'relative', zIndex: 1 }}>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', opacity: 0.7 }}>
                          <Text style={{ fontFamily: 'Outfit', color: '#94A3B8', fontSize: 12, textTransform: 'uppercase', letterSpacing: 1 }}>Subtotal</Text>
                          <Text style={{ fontFamily: 'SpaceGrotesk-Bold', color: '#F8FAFC', fontSize: 14 }}>${formatCurrency(Number(orden.factura.total) - (Number(orden.domicilios?.[0]?.costoDomicilio) || 0))}</Text>
                      </View>
                      
                      {orden.domicilios && orden.domicilios.length > 0 && Number(orden.domicilios[0].costoDomicilio) > 0 && (
                          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', opacity: 0.7 }}>
                              <Text style={{ fontFamily: 'Outfit', color: '#94A3B8', fontSize: 12, textTransform: 'uppercase', letterSpacing: 1 }}>Costo de Domicilio</Text>
                              <Text style={{ fontFamily: 'SpaceGrotesk-Bold', color: '#34D399', fontSize: 14 }}>+ ${formatCurrency(Number(orden.domicilios[0].costoDomicilio))}</Text>
                          </View>
                      )}
                      
                      <View style={{ height: 1, backgroundColor: 'rgba(245,165,36,0.15)' }} />
                      
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                          <View>
                              <Text style={{ fontFamily: 'SpaceGrotesk-Bold', color: '#F8FAFC', fontSize: 14, textTransform: 'uppercase', letterSpacing: 0.5 }}>Total Orden</Text>
                              <Text style={{ fontFamily: 'Outfit', color: '#64748B', fontSize: 10, textTransform: 'uppercase', letterSpacing: 1, marginTop: 2 }}>IVA Incluido (Exento)</Text>
                          </View>
                          <Text style={{ fontFamily: 'SpaceGrotesk-Bold', color: '#F5A524', fontSize: 30 }}>
                              ${formatCurrency(Number(orden.factura.total))}
                          </Text>
                      </View>
                  </View>
              </Card>
          )}
      </ScrollView>

      {/* ── Cancel Confirmation Modal ── */}
      <ConfirmModal
        visible={showCancelModal}
        title="Anular Pedido"
        message={`¿Confirmas que deseas cancelar la orden #${orden.ordenId}? Por favor indica el motivo:`}
        icon="close-octagon-outline"
        variant="danger"
        confirmText="Confirmar Anulación"
        loading={canceling}
        onConfirm={handleCancelOrder}
        onCancel={() => {
            setShowCancelModal(false);
            setCancelReason('');
        }}
      >
        <TextInput
            placeholder="Escribe el motivo aquí..."
            placeholderTextColor="#64748B"
            value={cancelReason}
            onChangeText={setCancelReason}
            className="bg-black/20 rounded-xl p-4 text-white font-bold border border-white/5 text-sm"
            autoFocus
        />
      </ConfirmModal>
    </PageContainer>
  );
}

// ── Internal Helper ──
function DetailItem({ 
    icon, 
    label, 
    value, 
    valueColor = '#F1F5F9',
    italic = false
}: { 
    icon: string; 
    label: string; 
    value: string;
    valueColor?: string;
    italic?: boolean;
}) {
    return (
        <View className="flex-row items-start gap-4">
            <View className="w-5 h-5 items-center justify-center mt-0.5">
                <Icon name={icon as any} size={16} color="#64748B" />
            </View>
            <View className="flex-1">
                <Text className="text-slate-500 text-[9px] font-black uppercase tracking-widest mb-1">{label}</Text>
                <Text className={`text-sm font-bold ${italic ? 'italic text-slate-400' : ''}`} style={{ color: valueColor }}>{value}</Text>
            </View>
        </View>
    );
}


