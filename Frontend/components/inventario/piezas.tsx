import React, { useState } from 'react';
import { StyleSheet, TouchableOpacity } from 'react-native';
import { View, Text, TextInput } from '../../tw';
import { Icon } from '../ui';
import type { EstadoStock } from '@/src/shared';
import { ESTADO_META, estadoLabel, gauge } from './meta';

export const StatePill = React.memo(function StatePill({ estado, cantidad }: { estado: EstadoStock; cantidad: number }) {
  const m = ESTADO_META[estado];
  return (
    <View style={[styles.pill, { backgroundColor: m.bg }]}>
      <Text style={[styles.pillTexto, { color: m.color }]}>{estadoLabel(estado, cantidad)}</Text>
    </View>
  );
});

export const Gauge = React.memo(function Gauge({
  cantidad,
  alerta,
  objetivo,
  color,
}: {
  cantidad: number;
  alerta: number | null;
  objetivo: number | null;
  color: string;
}) {
  const g = gauge(cantidad, alerta, objetivo);
  return (
    <View style={styles.gauge}>
      <View style={styles.pista}>
        <View style={[styles.lleno, { width: `${g.llenoPct}%`, backgroundColor: color }]} />
      </View>
      {g.marcaPct != null && <View style={[styles.marca, { left: `${g.marcaPct}%` }]} />}
      <View style={styles.leyenda}>
        <Text style={styles.leyendaTexto}>{alerta != null ? `Alerta ${alerta}` : 'Sin alerta'}</Text>
        <Text style={styles.leyendaTexto}>{g.estimado ? `Objetivo ~${g.meta}` : `Objetivo ${g.meta}`}</Text>
      </View>
    </View>
  );
});

export const Stepper = React.memo(function Stepper({
  value,
  onMinus,
  onPlus,
  disabled,
}: {
  value: number | string;
  onMinus: () => void;
  onPlus: () => void;
  disabled?: boolean;
}) {
  return (
    <View style={styles.stepper}>
      <TouchableOpacity onPress={onMinus} disabled={disabled} style={[styles.paso, styles.pasoMenos, disabled && styles.deshabilitado]} accessibilityLabel="Restar 1">
        <Text style={[styles.pasoTexto, { color: '#F43F5E' }]}>−</Text>
      </TouchableOpacity>
      <Text style={styles.stepperValor}>{value}</Text>
      <TouchableOpacity onPress={onPlus} disabled={disabled} style={[styles.paso, styles.pasoMas, disabled && styles.deshabilitado]} accessibilityLabel="Sumar 1">
        <Text style={[styles.pasoTexto, { color: '#34D399' }]}>+</Text>
      </TouchableOpacity>
    </View>
  );
});

/** "¿Cuántas llegaron?" — registra una entrada. Mismo control para cajas y bebidas. */
export const ArrivalField = React.memo(function ArrivalField({ onRegister, width }: { onRegister: (n: number) => void; width?: number }) {
  const [val, setVal] = useState('');
  const n = Number(val);
  const listo = val.trim().length > 0 && n > 0;
  const confirmar = () => {
    if (!listo) return;
    onRegister(n);
    setVal('');
  };
  return (
    <View style={[styles.llegada, width != null && { width }]}>
      <TextInput
        value={val}
        onChangeText={(v: string) => setVal(v.replace(/\D/g, ''))}
        placeholder="¿Cuántas llegaron?"
        placeholderTextColor="#7C8BA1"
        keyboardType="numeric"
        onSubmitEditing={confirmar}
        style={[styles.llegadaInput, listo && styles.llegadaInputListo]}
      />
      <TouchableOpacity onPress={confirmar} disabled={!listo} style={[styles.llegadaBoton, listo ? styles.llegadaBotonListo : styles.deshabilitado]} accessibilityLabel="Registrar entrada">
        <Icon name="check" size={16} color={listo ? '#34D399' : '#7C8BA1'} />
      </TouchableOpacity>
    </View>
  );
});

export const SummaryStrip = React.memo(function SummaryStrip({ items }: { items: { label: string; value: string; warn?: boolean }[] }) {
  return (
    <View style={styles.resumen}>
      {items.map((it) => (
        <View key={it.label} style={styles.resumenItem}>
          <Text style={styles.resumenLabel}>{it.label}</Text>
          <Text style={[styles.resumenValor, it.warn && { color: '#F5A524' }]}>{it.value}</Text>
        </View>
      ))}
    </View>
  );
});

const styles = StyleSheet.create({
  pill: { paddingHorizontal: 9, paddingVertical: 4, borderRadius: 999 },
  pillTexto: { fontSize: 10, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 0.6 },
  gauge: { marginTop: 12 },
  pista: { height: 6, backgroundColor: 'rgba(255,255,255,0.07)', borderRadius: 6, overflow: 'hidden' },
  lleno: { position: 'absolute', left: 0, top: 0, height: 6, borderRadius: 6 },
  marca: { position: 'absolute', top: -3, width: 2, height: 12, backgroundColor: '#E2E8F0', borderRadius: 2 },
  leyenda: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 },
  leyendaTexto: { color: '#7C8BA1', fontSize: 10, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.4 },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: 'rgba(0,0,0,0.28)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    borderRadius: 11,
    padding: 5,
    paddingHorizontal: 8,
    alignSelf: 'flex-start',
  },
  paso: { width: 36, height: 36, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  pasoMenos: { backgroundColor: 'rgba(244,63,94,0.14)' },
  pasoMas: { backgroundColor: 'rgba(16,185,129,0.14)' },
  pasoTexto: { fontSize: 18, fontWeight: '900', lineHeight: 20 },
  stepperValor: { color: '#fff', fontSize: 15, fontWeight: '900', minWidth: 34, textAlign: 'center', fontFamily: 'SpaceGrotesk-Bold' },
  deshabilitado: { opacity: 0.4 },
  llegada: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  llegadaInput: {
    flex: 1,
    minWidth: 0,
    height: 34,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    borderRadius: 10,
    paddingHorizontal: 10,
    color: '#F8FAFC',
    fontSize: 12,
    fontWeight: '700',
  },
  llegadaInputListo: { borderColor: 'rgba(16,185,129,0.4)' },
  llegadaBoton: { width: 36, height: 36, borderRadius: 8, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.04)' },
  llegadaBotonListo: { backgroundColor: 'rgba(16,185,129,0.16)' },
  resumen: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 18 },
  resumenItem: {
    flex: 1,
    minWidth: 150,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
    borderRadius: 16,
    padding: 16,
  },
  resumenLabel: { color: '#94A3B8', fontSize: 10, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.6 },
  resumenValor: { color: '#F8FAFC', fontSize: 24, fontWeight: '900', marginTop: 4, fontFamily: 'SpaceGrotesk-Bold' },
});
