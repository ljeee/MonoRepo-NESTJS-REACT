import React from 'react';
import { StyleSheet } from 'react-native';
import { View, Text } from '../../tw';
import { Card, Icon } from '../ui';
import type { IconName } from '../ui/Icon';
import { formatCOP } from '@/src/shared';
import type { ResumenGeneral } from '@/src/shared';

export interface ResumenDineroProps {
  resumen: ResumenGeneral;
  titulo?: string;
  /** Muestra lo cobrado por cuenta de transferencia (Nequi, Bancolombia…). */
  mostrarCuentas?: boolean;
  /** Resta el costo de domicilios (lo que se le paga al domiciliario) del balance. */
  sinDomicilios?: boolean;
  /** false = facturación neta: cobrado − domicilios, sin restar gastos (pantalla Facturación Neta). */
  incluirGastos?: boolean;
}

/**
 * Resumen de dinero de un rango con las definiciones únicas del servidor:
 *  - Facturado = ventas válidas · Cobrado (topado al total) · Por cobrar = diferencia
 *  - Balance = cobrado − gastos pagados (lo que de verdad entró y salió)
 * Todas las pantallas de dinero muestran este mismo bloque: antes había 5 fórmulas de balance.
 */
export function ResumenDinero({ resumen, titulo = 'Resumen del período', mostrarCuentas = true, sinDomicilios = false, incluirGastos = true }: ResumenDineroProps) {
  const { ventas, gastos } = resumen;
  const domicilios = sinDomicilios ? ventas.costoDomicilios : 0;
  const gastosRestados = incluirGastos ? gastos.pagados : 0;
  const balance = ventas.cobrado - gastosRestados - domicilios;
  const etiquetaBalance = incluirGastos ? 'Balance de caja' : 'Facturación neta';
  const formula = ['Cobrado', incluirGastos && 'gastos pagados', sinDomicilios && 'domicilios'].filter(Boolean).join(' − ');

  return (
    <Card className="mb-8 p-5" style={styles.card}>
      <View style={styles.cabecera}>
        <Text style={styles.titulo}>{titulo}</Text>
        <View style={[styles.pill, balance >= 0 ? styles.pillOk : styles.pillMal]}>
          <Text style={[styles.pillTexto, { color: balance >= 0 ? '#34D399' : '#F87171' }]}>{balance >= 0 ? 'Superávit' : 'Déficit'}</Text>
        </View>
      </View>

      <View style={styles.filas}>
        <Fila icon="receipt" color="#94A3B8" label="Facturado" sub={`${ventas.facturas} facturas`} valor={formatCOP(ventas.facturado)} />
        <Fila icon="arrow-down" color="#34D399" label="Cobrado" valor={formatCOP(ventas.cobrado)} sub={`Efectivo ${formatCOP(ventas.cobradoPorMetodo.efectivo)} · QR ${formatCOP(ventas.cobradoPorMetodo.transferencia)}`} />
        {ventas.porCobrar > 0 && <Fila icon="clock-alert-outline" color="#F59E0B" label="Por cobrar" valor={formatCOP(ventas.porCobrar)} />}
        {incluirGastos && (
        <Fila
          icon="arrow-up"
          color="#F87171"
          label="Gastos pagados"
          valor={`−${formatCOP(gastos.pagados)}`}
          sub={gastos.pendientes > 0 ? `+ ${formatCOP(gastos.pendientes)} pendientes` : `${gastos.cantidad} gastos`}
          valorColor="#F87171"
        />
        )}
        {sinDomicilios && (
          <Fila icon="moped" color="#FB923C" label="Domicilios (domiciliarios)" valor={`−${formatCOP(domicilios)}`} valorColor="#FB923C" />
        )}

        <View style={styles.separador} />

        <View style={styles.fila}>
          <View style={styles.izquierda}>
            <View style={[styles.icono, styles.iconoGrande]}>
              <Icon name="scale-balance" size={20} color="#F5A524" />
            </View>
            <View>
              <Text style={styles.balanceLabel}>{etiquetaBalance}</Text>
              <Text style={styles.sub}>{formula}</Text>
            </View>
          </View>
          <Text style={[styles.balance, { color: balance >= 0 ? '#F5A524' : '#EF4444' }]}>{formatCOP(balance)}</Text>
        </View>

        {mostrarCuentas && ventas.porCuenta.length > 0 && (
          <View style={styles.cuentas}>
            <Text style={styles.cuentasTitulo}>Cobrado por cuenta QR</Text>
            {ventas.porCuenta.map((c) => (
              <View key={c.cuenta} style={styles.cuentaFila}>
                <Text style={styles.cuentaNombre}>
                  • {c.cuenta} <Text style={styles.sub}>({c.facturas})</Text>
                </Text>
                <Text style={styles.cuentaMonto}>{formatCOP(c.monto)}</Text>
              </View>
            ))}
          </View>
        )}
      </View>
    </Card>
  );
}

function Fila({ icon, color, label, valor, sub, valorColor = '#F8FAFC' }: { icon: IconName; color: string; label: string; valor: string; sub?: string; valorColor?: string }) {
  return (
    <View style={styles.fila}>
      <View style={styles.izquierda}>
        <View style={[styles.icono, { backgroundColor: `${color}33` }]}>
          <Icon name={icon} size={16} color={color} />
        </View>
        <View style={styles.flex}>
          <Text style={styles.label}>{label}</Text>
          {sub ? <Text style={styles.sub}>{sub}</Text> : null}
        </View>
      </View>
      <Text style={[styles.valor, { color: valorColor }]}>{valor}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { overflow: 'hidden' },
  cabecera: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 },
  titulo: { fontFamily: 'Outfit', color: 'rgba(255,255,255,0.6)', fontSize: 11, textTransform: 'uppercase', letterSpacing: 1 },
  pill: { paddingHorizontal: 12, paddingVertical: 4, borderRadius: 999, borderWidth: 1 },
  pillOk: { backgroundColor: 'rgba(16,185,129,0.2)', borderColor: 'rgba(16,185,129,0.3)' },
  pillMal: { backgroundColor: 'rgba(239,68,68,0.2)', borderColor: 'rgba(239,68,68,0.3)' },
  pillTexto: { fontFamily: 'SpaceGrotesk-Bold', fontSize: 10, textTransform: 'uppercase' },
  filas: { gap: 14 },
  fila: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12 },
  izquierda: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1, minWidth: 0 },
  flex: { flex: 1, minWidth: 0 },
  icono: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  iconoGrande: { width: 40, height: 40, borderRadius: 12, backgroundColor: 'rgba(245,165,36,0.2)' },
  label: { fontFamily: 'Outfit', color: '#94A3B8', fontSize: 13, fontWeight: 'bold' },
  sub: { fontFamily: 'Outfit', color: '#64748B', fontSize: 10.5 },
  valor: { fontFamily: 'SpaceGrotesk-Bold', fontSize: 17 },
  separador: { height: 1, backgroundColor: 'rgba(255,255,255,0.06)' },
  balanceLabel: { fontFamily: 'SpaceGrotesk-Bold', color: '#F8FAFC', fontSize: 15, textTransform: 'uppercase' },
  balance: { fontFamily: 'SpaceGrotesk-Bold', fontSize: 26 },
  cuentas: { marginTop: 4, paddingTop: 12, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.05)', gap: 6 },
  cuentasTitulo: { fontFamily: 'Outfit', color: '#A78BFA', fontSize: 11, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.5 },
  cuentaFila: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cuentaNombre: { fontFamily: 'Outfit', color: '#CBD5E1', fontSize: 12 },
  cuentaMonto: { fontFamily: 'SpaceGrotesk-Bold', color: '#A78BFA', fontSize: 13 },
});
