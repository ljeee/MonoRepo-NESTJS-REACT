import React from 'react';
import { StyleSheet, TouchableOpacity } from 'react-native';
import { View, Text } from '../../tw';
import { Card, Icon } from '../ui';
import type { InventarioItem } from '@/src/shared';
import { ESTADO_META } from './meta';
import { ArrivalField, Gauge, StatePill, Stepper } from './piezas';

export interface PropsItemStock {
  item: InventarioItem;
  /** Entrada (+n) o salida (−n) manual. */
  onMover: (item: InventarioItem, delta: number) => void;
  onEditar: (item: InventarioItem) => void;
  ocupado: boolean;
}

/** Tarjeta grande (cajas). */
export const ItemCard = React.memo(function ItemCard({ item, onMover, onEditar, ocupado }: PropsItemStock) {
  const meta = ESTADO_META[item.estado];
  return (
    <Card style={[styles.tarjeta, !item.activo && styles.inactivo]}>
      <View style={[styles.franja, { backgroundColor: meta.color }]} />
      <View style={styles.cabecera}>
        <Text style={styles.nombre} numberOfLines={1}>
          {item.nombre}
        </Text>
        {item.activo ? <StatePill estado={item.estado} cantidad={item.cantidad} /> : <Text style={styles.etiquetaInactivo}>Inactivo</Text>}
      </View>

      <View style={styles.cifra}>
        <Text style={[styles.numero, { color: meta.color }]}>{ocupado ? '…' : item.cantidad}</Text>
        <Text style={styles.unidad}>{item.tipo === 'caja' ? 'cajas' : 'uds'}</Text>
      </View>

      <Gauge cantidad={item.cantidad} alerta={item.alertaMinimo} objetivo={item.nivelObjetivo} color={meta.color} />

      <View style={styles.controles}>
        <Stepper value={item.cantidad} onMinus={() => onMover(item, -1)} onPlus={() => onMover(item, 1)} disabled={ocupado} />
        <ArrivalField onRegister={(n) => onMover(item, n)} />
      </View>

      <TouchableOpacity onPress={() => onEditar(item)} style={styles.pie}>
        <Text style={styles.pieTexto}>
          {item.reglas === 0 ? 'Sin reglas: no se descuenta al vender' : `${item.reglas} ${item.reglas === 1 ? 'producto la gasta' : 'productos la gastan'}`}
        </Text>
        <View style={styles.editar}>
          <Icon name="pencil-outline" size={13} color="#F5A524" />
          <Text style={styles.editarTexto}>Editar · contar</Text>
        </View>
      </TouchableOpacity>
    </Card>
  );
});

/** Fila compacta (bebidas). */
export const ItemRow = React.memo(function ItemRow({ item, onMover, onEditar, ocupado, isMobile }: PropsItemStock & { isMobile: boolean }) {
  const meta = ESTADO_META[item.estado];
  return (
    <Card style={[styles.fila, !item.activo && styles.inactivo]}>
      <View style={[styles.franja, { backgroundColor: meta.color }]} />
      <View style={[styles.filaInterior, isMobile && styles.filaInteriorMovil]}>
        <View style={[styles.filaNombre, !isMobile && styles.flex]}>
          <View style={styles.flex}>
            <Text style={styles.nombreFila} numberOfLines={1}>
              {item.nombre}
            </Text>
            <Text style={styles.subFila} numberOfLines={1}>
              {item.alertaMinimo != null ? `Alerta ≤ ${item.alertaMinimo}` : 'Sin alerta'}
              {item.reglas === 0 ? ' · sin regla: no se descuenta' : ''}
            </Text>
          </View>
          {item.activo ? <StatePill estado={item.estado} cantidad={item.cantidad} /> : <Text style={styles.etiquetaInactivo}>Inactivo</Text>}
        </View>

        <View style={[styles.filaControles, isMobile && styles.filaControlesMovil]}>
          <Text style={[styles.numeroFila, item.estado === 'critico' && { color: '#F43F5E' }]}>{ocupado ? '…' : item.cantidad}</Text>
          <Stepper value={item.cantidad} onMinus={() => onMover(item, -1)} onPlus={() => onMover(item, 1)} disabled={ocupado} />
          <ArrivalField onRegister={(n) => onMover(item, n)} width={isMobile ? undefined : 190} />
          <TouchableOpacity onPress={() => onEditar(item)} style={styles.botonEditar} accessibilityLabel={`Editar ${item.nombre}`}>
            <Icon name="pencil-outline" size={15} color="#F5A524" />
          </TouchableOpacity>
        </View>
      </View>
    </Card>
  );
});

const styles = StyleSheet.create({
  tarjeta: { padding: 16, overflow: 'hidden' },
  inactivo: { opacity: 0.55 },
  franja: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 3 },
  cabecera: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  nombre: { color: '#F8FAFC', fontFamily: 'SpaceGrotesk-Bold', fontSize: 15, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.3, flex: 1, marginRight: 8 },
  etiquetaInactivo: { color: '#94A3B8', fontSize: 10, fontWeight: '900', textTransform: 'uppercase' },
  cifra: { flexDirection: 'row', alignItems: 'baseline', gap: 8 },
  numero: { fontSize: 42, fontWeight: '900', lineHeight: 44, fontFamily: 'SpaceGrotesk-Bold' },
  unidad: { color: '#94A3B8', fontSize: 11, fontWeight: '700', textTransform: 'uppercase' },
  controles: { marginTop: 14, gap: 10 },
  pie: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.06)',
    marginTop: 13,
    paddingTop: 11,
    gap: 8,
  },
  pieTexto: { color: '#94A3B8', fontSize: 10.5, fontWeight: '700', flex: 1 },
  editar: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  editarTexto: { color: '#F5A524', fontSize: 10.5, fontWeight: '800' },
  fila: { padding: 13, paddingHorizontal: 16, overflow: 'hidden' },
  filaInterior: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  filaInteriorMovil: { flexDirection: 'column', alignItems: 'stretch', gap: 12 },
  filaNombre: { minWidth: 0, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  flex: { flex: 1, minWidth: 0 },
  nombreFila: { color: '#F8FAFC', fontFamily: 'SpaceGrotesk-Bold', fontSize: 14, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.3 },
  subFila: { color: '#7C8BA1', fontSize: 10, fontWeight: '700', textTransform: 'uppercase', marginTop: 3 },
  filaControles: { flexDirection: 'row', alignItems: 'center', gap: 12, justifyContent: 'flex-end' },
  filaControlesMovil: { justifyContent: 'space-between', flexWrap: 'wrap' },
  numeroFila: { color: '#F8FAFC', fontSize: 22, fontWeight: '900', minWidth: 40, textAlign: 'center', fontFamily: 'SpaceGrotesk-Bold' },
  botonEditar: { width: 36, height: 36, borderRadius: 8, backgroundColor: 'rgba(245,165,36,0.12)', alignItems: 'center', justifyContent: 'center' },
});
