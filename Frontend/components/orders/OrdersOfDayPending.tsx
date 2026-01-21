import axios from 'axios';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Text, TouchableOpacity, View } from 'react-native';
import { API_BASE_URL } from '../../constants/api';
import { useBreakpoint } from '../../styles/responsive';
import { orderStyles as styles } from './orderStyles';

type OrderProduct = {
  id: number;
  producto: string;
  cantidad: number;
};
type Factura = {
  clienteNombre?: string;
};
type Order = {
  ordenId: number;
  tipoPedido: string;
  estadoOrden: string;
  fechaOrden: string;
  nombreCliente?: string;
  productos?: OrderProduct[];
  factura?: Factura;
};

function formatDate(dateStr?: string) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  return d.toLocaleString('es-CO', { dateStyle: 'short', timeStyle: 'short' });
}

export default function OrdersOfDayPending() {
  const { isMobile, isTablet } = useBreakpoint();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [patchLoading, setPatchLoading] = useState<number | null>(null);
  const [filter, setFilter] = useState<'dia' | 'pendientes'>('dia');

  const fetchOrders = async () => {
    setLoading(true);
    setError('');
    try {
      const url =
        filter === 'pendientes'
          ? `${API_BASE_URL}/ordenes/dia/pendientes`
          : `${API_BASE_URL}/ordenes/dia`;
      const res = await axios.get(url);
      setOrders(res.data);
    } catch {
      setError('Error al cargar las órdenes');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter]);

  const markAsCompleted = async (ordenId: number) => {
    setPatchLoading(ordenId);
    try {
      await axios.patch(`${API_BASE_URL}/ordenes/${ordenId}`, { estadoOrden: 'completada' });
      await fetchOrders();
    } catch {
      setError('No se pudo actualizar la orden');
    } finally {
      setPatchLoading(null);
    }
  };

  if (loading) return <ActivityIndicator style={{ marginTop: 40 }} />;
  if (error) return <Text style={styles.error}>{error}</Text>;

  return (
    <View style={styles.container}>
      <Text style={[styles.title, isMobile && styles.titleMobile]}>
        {filter === 'pendientes' ? 'Órdenes pendientes de hoy' : 'Órdenes del día'}
      </Text>
      <View style={styles.filterRow}>
        <TouchableOpacity
          onPress={() => setFilter('dia')}
          style={[styles.filterBtn, filter === 'dia' && styles.filterBtnActive]}
        >
          <Text style={[styles.filterText, filter === 'dia' && styles.filterTextActive]}>Todas</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => setFilter('pendientes')}
          style={[styles.filterBtn, filter === 'pendientes' && styles.filterBtnActive]}
        >
          <Text style={[styles.filterText, filter === 'pendientes' && styles.filterTextActive]}>Pendientes</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={fetchOrders} style={styles.refreshBtn}>
          <Text style={styles.filterTextActive}>Refrescar</Text>
        </TouchableOpacity>
      </View>
      <FlatList
        data={orders}
        keyExtractor={item => item.ordenId?.toString() || Math.random().toString()}
        numColumns={isMobile ? 1 : isTablet ? 2 : 3}
        contentContainerStyle={{ paddingBottom: 16, paddingHorizontal: isMobile ? 12 : 0 }}
        columnWrapperStyle={isMobile ? undefined : { gap: 12 }}
        renderItem={({ item }) => (
          <View style={[styles.gridItem, isMobile && { minWidth: '100%', maxWidth: '100%', marginHorizontal: 0 }] }>
            <View style={[styles.orderBox, isMobile && { padding: 14 }] }>
            <View style={styles.orderHeader}>
              <Text style={styles.orderClient}>
                {(() => {
                  const nombre = item.factura?.clienteNombre || item.nombreCliente;
                  if (!nombre) return 'Sin nombre';
                  if (item.tipoPedido === 'mesa') {
                    return /^\d+$/.test(nombre) ? `Mesa ${nombre}` : nombre.startsWith('Mesa') ? nombre : `Mesa ${nombre}`;
                  }
                  return nombre;
                })()}
              </Text>
              <Text style={styles.orderInfo}>{formatDate(item.fechaOrden)}</Text>
            </View>
            <Text style={[styles.orderInfo, item.estadoOrden === 'completada' && { color: '#4caf50', fontWeight: 'bold' }]}>Tipo: {item.tipoPedido} • Estado: {item.estadoOrden}</Text>
            {item.productos && item.productos.length > 0 && (
              <View style={styles.productList}>
                <Text style={[styles.text, { fontWeight: 'bold' }]}>Productos:</Text>
                {item.productos.map(prod => (
                  <Text key={prod.id} style={styles.productItem}>
                    - {prod.producto} x{prod.cantidad}
                  </Text>
                ))}
              </View>
            )}
            {item.estadoOrden !== 'completada' && (
              <TouchableOpacity
                style={styles.completeBtn}
                onPress={() => markAsCompleted(item.ordenId)}
                disabled={patchLoading === item.ordenId}
              >
                <Text style={styles.completeBtnText}>{patchLoading === item.ordenId ? 'Actualizando...' : 'Marcar completada'}</Text>
              </TouchableOpacity>
            )}
            </View>
          </View>
        )}
        ListEmptyComponent={<Text>No hay órdenes pendientes hoy.</Text>}
      />
    </View>
  );
}
