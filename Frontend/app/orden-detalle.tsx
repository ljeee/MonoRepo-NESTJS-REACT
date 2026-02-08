import * as Clipboard from 'expo-clipboard';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, Text, TouchableOpacity, View, Alert } from 'react-native';
import { api } from '../services/api';
import { styles } from '../styles/orden-detalle.styles';
import { formatCurrency, formatDate } from '../utils/formatNumber';

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
  // Campos dinámicos para productos personalizados
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
}

interface OrdenDetalle {
  ordenId: number;
  tipoPedido?: string;
  estadoOrden?: string;
  fechaOrden?: string;
  factura?: Factura;
  productos?: OrdenProducto[];
  domicilios?: Domicilio[];
}

export default function OrdenDetalleScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const ordenId = params.ordenId as string;

  const [orden, setOrden] = useState<OrdenDetalle | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!ordenId) {
      setError('ID de orden no proporcionado');
      setLoading(false);
      return;
    }

    const fetchOrden = async () => {
      try {
        const ordenData = await api.ordenes.getById(Number(ordenId));
        if (ordenData && !Array.isArray(ordenData.productos)) {
          ordenData.productos = [];
        }

        setOrden(ordenData);
      } catch (e: any) {
        console.error('Error fetching orden:', e);
        setError(e.message || 'Error cargando orden');
      } finally {
        setLoading(false);
      }
    };

    fetchOrden();
  }, [ordenId]);

  const getProductName = (p: OrdenProducto) => {
    // Si viene el nombre compuesto directo de la DB (campo 'producto')
    if (p.producto) return p.producto;

    // Nombre del producto + variante
    const baseName = p.productoObj?.productoNombre;
    const varianteName = p.variante?.nombre;
    if (baseName && varianteName) return `${baseName} — ${varianteName}`;
    if (baseName) return baseName;

    // Construir nombre dinámico si es necesario (legacy)
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

  if (loading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" style={styles.loader} />
      </View>
    );
  }

  if (error || !orden) {
    return (
      <View style={styles.container}>
        <Text style={styles.errorText}>{error || 'Orden no encontrada'}</Text>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Text style={styles.backButtonText}>Volver</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Detalle de Orden #{orden.ordenId}</Text>
        <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
          <TouchableOpacity
            style={[styles.backButton, { backgroundColor: '#10b981' }]}
            onPress={async () => {
              // Build detailed product lines from productos array
              const productLines = (orden.productos || []).map(p => {
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
              ].filter(Boolean).join('\n');

              try {
                await Clipboard.setStringAsync(textoACopiar);
                Alert.alert('Éxito', 'Datos copiados al portapapeles');
              } catch (error) {
                Alert.alert('Error', 'No se pudo copiar: ' + textoACopiar);
              }
            }}
          >
            <Text style={styles.backButtonText}>📋 Copiar Datos</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.backButton} onPress={() => router.push('/ordenes')}>
            <Text style={styles.backButtonText}>Ver Órdenes del Día</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Información General</Text>
        <View style={styles.infoRow}>
          <Text style={styles.label}>Tipo de Pedido:</Text>
          <Text style={styles.value}>{orden.tipoPedido || 'No especificado'}</Text>
        </View>
        {orden.factura?.clienteNombre && (
          <View style={styles.infoRow}>
            <Text style={styles.label}>Cliente:</Text>
            <Text style={styles.value}>{orden.factura.clienteNombre}</Text>
          </View>
        )}
        {orden.domicilios?.[0]?.telefono && (
          <View style={styles.infoRow}>
            <Text style={styles.label}>Teléfono:</Text>
            <Text style={styles.value}>{orden.domicilios[0].telefono}</Text>
          </View>
        )}
        {orden.domicilios?.[0]?.direccionEntrega && (
          <View style={styles.infoRow}>
            <Text style={styles.label}>Dirección:</Text>
            <Text style={styles.value}>{orden.domicilios[0].direccionEntrega}</Text>
          </View>
        )}
        {orden.factura?.metodo && (
          <View style={styles.infoRow}>
            <Text style={styles.label}>Método de Pago:</Text>
            <Text style={styles.value}>{orden.factura.metodo}</Text>
          </View>
        )}
        {orden.estadoOrden && (
          <View style={styles.infoRow}>
            <Text style={styles.label}>Estado:</Text>
            <Text style={[styles.value, styles.estadoValue]}>{orden.estadoOrden}</Text>
          </View>
        )}
        {orden.fechaOrden && (
          <View style={styles.infoRow}>
            <Text style={styles.label}>Fecha:</Text>
            <Text style={styles.value}>{formatDate(orden.fechaOrden)}</Text>
          </View>
        )}
        {orden.factura?.descripcion && (
          <View style={styles.infoRow}>
            <Text style={styles.label}>Descripción:</Text>
            <Text style={styles.value}>{orden.factura.descripcion}</Text>
          </View>
        )}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Productos</Text>
        {orden.productos && orden.productos.length > 0 ? (
          orden.productos.map((ordenProducto, index) => (
            <View key={index} style={styles.productCard}>
              <View style={styles.productHeader}>
                <Text style={styles.productTipo}>
                  {getProductName(ordenProducto)}
                </Text>
                <Text style={styles.productCantidad}>x{ordenProducto.cantidad || 1}</Text>
              </View>

              {getProductDetails(ordenProducto) && (
                <Text style={styles.productDetail}>
                  {getProductDetails(ordenProducto)}
                </Text>
              )}

              {getUnitPrice(ordenProducto) != null && (
                <Text style={styles.productPrecio}>
                  Precio unitario: ${formatCurrency(getUnitPrice(ordenProducto))}
                </Text>
              )}
              {getUnitPrice(ordenProducto) != null && ordenProducto.cantidad && (
                <Text style={styles.productPrecio}>
                  Subtotal: ${formatCurrency(getUnitPrice(ordenProducto)! * Number(ordenProducto.cantidad))}
                </Text>
              )}
            </View>
          ))
        ) : (
          <Text style={styles.productDetail}>No hay productos en esta orden</Text>
        )}
      </View>

      {orden.factura?.total != null && (
        <View style={styles.totalSection}>
          <Text style={styles.totalLabel}>Total:</Text>
          <Text style={styles.totalValue}>${formatCurrency(Number(orden.factura.total))}</Text>
        </View>
      )}
    </ScrollView>
  );
}
