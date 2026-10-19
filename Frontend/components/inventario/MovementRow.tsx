import React from 'react';
import { StyleSheet } from 'react-native';
import { View, Text } from '../../tw';
import { Icon } from '../ui';
import type { InventarioMovimiento } from '@/src/shared';
import { MOVIMIENTO_META } from './meta';

const FECHA = new Intl.DateTimeFormat('es-CO', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'America/Bogota' });

/** Un movimiento del libro. Muestra el faltante cuando se vendió sin stock (delta ≠ aplicado). */
export const MovementRow = React.memo(function MovementRow({ mov }: { mov: InventarioMovimiento }) {
  const meta = MOVIMIENTO_META[mov.tipo] ?? { label: mov.tipo, icon: 'swap-vertical' as const };
  const sube = mov.aplicado > 0 || (mov.aplicado === 0 && mov.delta > 0);
  const color = mov.aplicado === 0 && mov.delta === 0 ? '#94A3B8' : sube ? '#10B981' : '#F43F5E';
  const faltante = mov.tipo === 'venta' && mov.delta !== mov.aplicado ? Math.abs(mov.delta - mov.aplicado) : 0;
  const detalle = [mov.nota, mov.usuarioNombre].filter(Boolean).join(' · ');

  return (
    <View style={styles.fila}>
      <View style={[styles.icono, { backgroundColor: `${color}26` }]}>
        <Icon name={meta.icon} size={14} color={color} />
      </View>
      <View style={styles.cuerpo}>
        <Text style={styles.nombre} numberOfLines={1}>
          {mov.itemNombre}
        </Text>
        <Text style={[styles.cantidad, { color }]}>
          {meta.label} {mov.aplicado > 0 ? '+' : ''}
          {mov.aplicado} → quedó en {mov.cantidadResultante}
        </Text>
        {faltante > 0 && <Text style={styles.faltante}>Se vendieron {faltante} sin stock</Text>}
        {!!detalle && (
          <Text style={styles.detalle} numberOfLines={1}>
            {detalle}
          </Text>
        )}
      </View>
      <Text style={styles.fecha}>{FECHA.format(new Date(mov.creadoEn))}</Text>
    </View>
  );
});

const styles = StyleSheet.create({
  fila: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
    paddingHorizontal: 14,
    marginBottom: 6,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
  },
  icono: { width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  cuerpo: { flex: 1, minWidth: 0 },
  nombre: { color: '#F8FAFC', fontWeight: '700', fontSize: 12 },
  cantidad: { fontWeight: '900', fontSize: 11 },
  faltante: { color: '#FBBF24', fontWeight: '800', fontSize: 10, marginTop: 1 },
  detalle: { color: '#7C8BA1', fontSize: 10, marginTop: 1 },
  fecha: { color: '#7C8BA1', fontSize: 10 },
});
