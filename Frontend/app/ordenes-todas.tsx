import React, { useCallback, useEffect, useState } from 'react';
import { ScrollView, Text, TouchableOpacity, View, TextInput } from 'react-native';
import { useRouter } from 'expo-router';
import { api } from '../services/api';
import { Orden, PaginatedResponse } from '../types/models';
import { formatCurrency, formatDate } from '../utils/formatNumber';
import { styles } from '../styles/ordenes-todas.styles';
import { colors } from '../styles/theme';

const LIMIT = 20;
const ESTADOS = ['', 'pendiente', 'en preparación', 'enviado', 'entregado', 'cancelado'];
const ESTADO_LABELS: Record<string, string> = {
  '': 'Todos',
  pendiente: 'Pendiente',
  'en preparación': 'En preparación',
  enviado: 'Enviado',
  entregado: 'Entregado',
  cancelado: 'Cancelado',
};

function estadoColor(e?: string) {
  switch (e) {
    case 'pendiente': return { bg: colors.warningLight, text: colors.warning };
    case 'en preparación': return { bg: colors.infoLight, text: colors.info };
    case 'enviado': return { bg: colors.primaryLight, text: colors.primary };
    case 'entregado': return { bg: colors.successLight, text: colors.success };
    case 'cancelado': return { bg: colors.dangerLight, text: colors.danger };
    default: return { bg: colors.card, text: colors.textMuted };
  }
}

export default function OrdenesTodasScreen() {
  const router = useRouter();
  const [page, setPage] = useState(1);
  const [estado, setEstado] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [result, setResult] = useState<PaginatedResponse<Orden> | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const fetchData = useCallback(async (p: number) => {
    setLoading(true);
    setError('');
    try {
      const params: Record<string, any> = { page: p, limit: LIMIT };
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
  }, [estado, from, to]);

  useEffect(() => {
    fetchData(1);
  }, [fetchData]);

  const ordenes = result?.data ?? [];

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent}>
      <View style={styles.header}>
        <Text style={styles.title}>Todas las Órdenes</Text>

        {/* Estado chips */}
        <View style={styles.filtersRow}>
          {ESTADOS.map(e => (
            <TouchableOpacity
              key={e}
              style={[styles.estadoChip, estado === e && styles.estadoChipActive]}
              onPress={() => setEstado(e)}
            >
              <Text style={[styles.estadoChipText, estado === e && styles.estadoChipTextActive]}>
                {ESTADO_LABELS[e]}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Date filters */}
        <View style={styles.filtersRow}>
          <TextInput
            style={styles.dateInput}
            placeholder="Desde (YYYY-MM-DD)"
            placeholderTextColor={colors.placeholder}
            value={from}
            onChangeText={setFrom}
          />
          <TextInput
            style={styles.dateInput}
            placeholder="Hasta (YYYY-MM-DD)"
            placeholderTextColor={colors.placeholder}
            value={to}
            onChangeText={setTo}
          />
          <TouchableOpacity style={styles.filterBtn} onPress={() => fetchData(1)}>
            <Text style={styles.filterBtnText}>Buscar</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Pagination info */}
      {result && (
        <>
          <Text style={styles.totalInfo}>
            {result.total} órdenes encontradas — Página {result.page} de {result.totalPages}
          </Text>
          <View style={styles.paginationRow}>
            <TouchableOpacity
              style={[styles.pageBtn, page <= 1 && styles.pageBtnDisabled]}
              onPress={() => page > 1 && fetchData(page - 1)}
              disabled={page <= 1}
            >
              <Text style={styles.pageBtnText}>← Anterior</Text>
            </TouchableOpacity>
            <Text style={styles.pageInfo}>Pág {page}</Text>
            <TouchableOpacity
              style={[styles.pageBtn, page >= (result?.totalPages ?? 1) && styles.pageBtnDisabled]}
              onPress={() => page < (result?.totalPages ?? 1) && fetchData(page + 1)}
              disabled={page >= (result?.totalPages ?? 1)}
            >
              <Text style={styles.pageBtnText}>Siguiente →</Text>
            </TouchableOpacity>
          </View>
        </>
      )}

      {/* States */}
      {loading && <Text style={styles.loadingText}>Cargando...</Text>}
      {error ? <Text style={styles.errorText}>{error}</Text> : null}
      {!loading && !error && ordenes.length === 0 && (
        <Text style={styles.emptyText}>No se encontraron órdenes</Text>
      )}

      {/* Order cards */}
      {ordenes.map(orden => {
        const ec = estadoColor(orden.estadoOrden);
        const total = orden.factura?.totalFactura ?? orden.productos?.reduce(
          (s, p) => s + (p.precioUnitario ?? 0) * (p.cantidad ?? 1), 0,
        ) ?? 0;

        return (
          <TouchableOpacity
            key={orden.ordenId}
            style={styles.card}
            activeOpacity={0.7}
            onPress={() => router.push(`/orden-detalle?id=${orden.ordenId}` as any)}
          >
            <View style={styles.cardHeader}>
              <Text style={styles.orderId}>Orden #{orden.ordenId}</Text>
              <View style={[styles.estadoBadge, { backgroundColor: ec.bg }]}>
                <Text style={[styles.estadoText, { color: ec.text }]}>
                  {orden.estadoOrden || 'N/A'}
                </Text>
              </View>
            </View>
            <View style={styles.cardRow}>
              <Text style={styles.label}>Tipo</Text>
              <Text style={styles.value}>{orden.tipoPedido}</Text>
            </View>
            <View style={styles.cardRow}>
              <Text style={styles.label}>Fecha</Text>
              <Text style={styles.value}>{formatDate(orden.fechaOrden)}</Text>
            </View>
            <View style={styles.cardRow}>
              <Text style={styles.label}>Total</Text>
              <Text style={styles.value}>${formatCurrency(total)}</Text>
            </View>
            {orden.productos && orden.productos.length > 0 && (
              <View style={styles.productList}>
                {orden.productos.map((p, i) => (
                  <Text key={i} style={styles.productItem}>
                    • {p.productoNombre || 'Producto'} x{p.cantidad} — ${formatCurrency(p.precioUnitario ?? 0)}
                  </Text>
                ))}
              </View>
            )}
          </TouchableOpacity>
        );
      })}

      {/* Bottom pagination */}
      {result && result.totalPages > 1 && (
        <View style={styles.paginationRow}>
          <TouchableOpacity
            style={[styles.pageBtn, page <= 1 && styles.pageBtnDisabled]}
            onPress={() => page > 1 && fetchData(page - 1)}
            disabled={page <= 1}
          >
            <Text style={styles.pageBtnText}>← Anterior</Text>
          </TouchableOpacity>
          <Text style={styles.pageInfo}>Pág {page} de {result.totalPages}</Text>
          <TouchableOpacity
            style={[styles.pageBtn, page >= result.totalPages && styles.pageBtnDisabled]}
            onPress={() => page < result.totalPages && fetchData(page + 1)}
            disabled={page >= result.totalPages}
          >
            <Text style={styles.pageBtnText}>Siguiente →</Text>
          </TouchableOpacity>
        </View>
      )}
    </ScrollView>
  );
}
