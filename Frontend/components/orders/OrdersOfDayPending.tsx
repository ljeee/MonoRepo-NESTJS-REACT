import React, { useEffect, useState } from 'react';
import { FlatList, Text, TouchableOpacity, View } from 'react-native';
import { api } from '../../services/api';
import { useBreakpoint } from '../../styles/responsive';
import { EmptyState } from '../states/EmptyState';
import { ErrorState } from '../states/ErrorState';
import { LoadingState } from '../states/LoadingState';
import { orderStyles as styles } from '../../styles/order.styles';

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
      const url_estado = filter === 'pendientes' ? 'pendiente' : undefined;
      const data = await api.ordenes.getDay(url_estado);
      setOrders(data as any);
    } catch (err: any) {
      // If 404, it just means no orders found for today
      if (err.response && err.response.status === 404) {
        setOrders([]);
      } else {
        console.error('Error fetching orders:', err);
        setError('No pudimos cargar las órdenes. Por favor, intenta de nuevo.');
      }
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
      await api.ordenes.update(ordenId, { estadoOrden: 'completada' } as any);
      await fetchOrders();
    } catch {
      setError('No se pudo actualizar la orden');
    } finally {
      setPatchLoading(null);
    }
  };

  if (loading) return <LoadingState message="Cargando órdenes..." />;
  if (error) return <ErrorState message={error} onRetry={fetchOrders} />;

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
          <View style={[styles.gridItem, isMobile && { minWidth: '100%', maxWidth: '100%', marginHorizontal: 0 }]}>
            <View style={[styles.orderBox, isMobile && { padding: 14 }]}>
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
              {item.tipoPedido === 'domicilio' && item.domicilios && item.domicilios.length > 0 && item.domicilios[0].direccionEntrega && (
                <Text style={[styles.orderInfo, { marginTop: 4 }]}>📍 {item.domicilios[0].direccionEntrega}</Text>
              )}
              {item.observaciones && (
                <View style={{ marginTop: 6, padding: 8, backgroundColor: 'rgba(255, 193, 7, 0.1)', borderRadius: 6, borderLeftWidth: 3, borderLeftColor: '#ffc107' }}>
                  <Text style={[styles.text, { fontStyle: 'italic', color: '#ffc107' }]}>📝 {item.observaciones}</Text>
                </View>
              )}
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
        ListEmptyComponent={
          <EmptyState
            message="Sin órdenes hoy"
            subMessage={filter === 'pendientes' ? "No tienes órdenes pendientes." : "Aún no se han registrado órdenes para el día de hoy."}
            icon="clipboard-text-off-outline"
          />
        }
      />
    </View>
  );
}
