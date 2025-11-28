import axios from 'axios';
import * as Clipboard from 'expo-clipboard';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, Text, TouchableOpacity, View, Alert } from 'react-native';
import { API_BASE_URL } from '../constants/api';
import { styles } from '../styles/orden-detalle.styles';

interface ProductoObj {
  productoId?: number;
  productoNombre?: string;
  precio?: number;
}

interface OrdenProducto {
  ordenProductoId?: number;
  cantidad: number;
  productoObj?: ProductoObj;
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
        const response = await axios.get(`${API_BASE_URL}/ordenes/${ordenId}`);
        console.log('Orden response completa:', response.data);
        console.log('Productos:', response.data?.productos);
        console.log('Domicilios:', response.data?.domicilios);
        
        // Asegurar que productos sea un array
        const ordenData = response.data;
        if (ordenData && !Array.isArray(ordenData.productos)) {
          ordenData.productos = [];
        }
        
        // Log cada producto
        if (ordenData.productos) {
          ordenData.productos.forEach((p: any, i: number) => {
            console.log(`Producto ${i}:`, p);
            console.log(`  - productoObj:`, p.productoObj);
          });
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
            style={[styles.backButton, { backgroundColor: '#4caf50' }]} 
            onPress={async () => {
              const textoACopiar = [
                `Cliente: ${orden.factura?.clienteNombre || 'Sin nombre'}`,
                orden.domicilios?.[0]?.telefono ? `Teléfono: ${orden.domicilios[0].telefono}` : '',
                orden.domicilios?.[0]?.direccionEntrega ? `Dirección: ${orden.domicilios[0].direccionEntrega}` : '',
                orden.factura?.descripcion ? `Productos: ${orden.factura.descripcion}` : '',
                `Método de pago: ${orden.factura?.metodo || 'No especificado'}`
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
            <Text style={styles.value}>{new Date(orden.fechaOrden).toLocaleString('es-CO')}</Text>
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
                  {ordenProducto.productoObj?.productoNombre || 'Producto sin nombre'}
                </Text>
                <Text style={styles.productCantidad}>x{ordenProducto.cantidad || 1}</Text>
              </View>
              {ordenProducto.productoObj?.precio != null && (
                <Text style={styles.productPrecio}>
                  Precio unitario: ${Number(ordenProducto.productoObj.precio).toLocaleString('es-CO')}
                </Text>
              )}
              {ordenProducto.productoObj?.precio != null && ordenProducto.cantidad && (
                <Text style={styles.productPrecio}>
                  Subtotal: ${(Number(ordenProducto.productoObj.precio) * Number(ordenProducto.cantidad)).toLocaleString('es-CO')}
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
          <Text style={styles.totalValue}>${Number(orden.factura.total).toLocaleString('es-CO')}</Text>
        </View>
      )}
    </ScrollView>
  );
}
