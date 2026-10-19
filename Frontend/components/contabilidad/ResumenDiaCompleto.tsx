import React, { useState } from 'react';
import { StyleSheet } from 'react-native';
import { View, Text, Pressable } from '../../tw';
import { Card, Icon } from '../ui';
import type { IconName } from '../ui/Icon';
import { formatCOP, nombreCategoria, TIPO_GASTO_META } from '@/src/shared';
import type { ResumenGeneral } from '@/src/shared';

/**
 * Resumen COMPLETO del día/rango (todo sale de GET /estadisticas/resumen, con las definiciones únicas del
 * servidor). Mismas 7 secciones y mismo orden que el correo de cierre (Backend/src/common/services/cierre-email.ts):
 *  1) Ventas · 2) Efectivo · 3) QR/transferencias por cuenta · 4) Productos vendidos (completo)
 *  5) Ajustes manuales de precio · 6) Gastos (costos vs gastos) · 7) Balance de caja
 */
export function ResumenDiaCompleto({ resumen }: { resumen: ResumenGeneral }) {
  const { ventas, gastos, balance, productos, ajustesPrecio: aj, resultado } = resumen;
  const [verProductos, setVerProductos] = useState(false);
  const facturasDe = (clave: string) => ventas.porMetodo.find((m) => m.clave === clave)?.facturas ?? 0;
  const totalUnidades = productos.reduce((t, p) => t + p.unidades, 0);
  const totalValor = productos.reduce((t, p) => t + p.valor, 0);
  const conAjuste = productos.filter((p) => p.lineasManuales > 0);
  const tipo = (t: string) => gastos.porTipo.find((x) => x.tipo === t);

  return (
    <View style={{ gap: 14 }}>
      <Seccion n={1} titulo="Ventas del día" icon="receipt">
        <Fila label="Facturado" valor={formatCOP(ventas.facturado)} negrita />
        <Fila label="Cobrado" valor={formatCOP(ventas.cobrado)} color="#34D399" />
        <Fila label="Por cobrar" valor={formatCOP(ventas.porCobrar)} color="#F59E0B" />
        <Fila sub label={`${ventas.facturas} facturas válidas · ${ventas.ordenes} órdenes (sin canceladas) · ${ventas.canceladas} canceladas`} valor={`ticket ${formatCOP(ventas.ticket)}`} />
      </Seccion>

      <Seccion n={2} titulo="Efectivo" icon="cash">
        <Fila label="Vendido en efectivo" valor={formatCOP(ventas.cobradoPorMetodo.efectivo)} negrita color="#34D399" />
        <Fila sub label={`Incluye la parte efectivo de pagos mixtos y los abonos · ${facturasDe('efectivo') + facturasDe('mixto')} facturas`} />
      </Seccion>

      <Seccion n={3} titulo="QR / Transferencias" icon="qrcode-scan">
        <Fila label="Total por QR / transferencia" valor={formatCOP(ventas.cobradoPorMetodo.transferencia)} negrita color="#60A5FA" />
        {ventas.porCuenta.length === 0 && <Fila sub label="Sin transferencias" />}
        {ventas.porCuenta.map((c) => (
          <Fila
            key={`${c.cuentaId ?? c.cuenta}`}
            sub
            label={`↳ ${c.cuenta}${c.sinAsignar ? ' (sin cuenta asignada)' : ''} · ${c.facturas} ${c.facturas === 1 ? 'factura' : 'facturas'}`}
            valor={formatCOP(c.monto)}
            color={c.sinAsignar ? '#F87171' : '#A78BFA'}
          />
        ))}
        {(resumen.cuentas ?? []).some((c) => c.salidas > 0) && (
          <>
            <Fila label="Pagado por QR (egresos)" valor={formatCOP((resumen.cuentas ?? []).reduce((t, c) => t + c.salidas, 0))} negrita color="#F87171" />
            {(resumen.cuentas ?? []).map((c) => (
              <Fila
                key={`saldo-${c.cuentaId ?? c.cuenta}`}
                sub
                label={`↳ ${c.cuenta}${c.sinAsignar ? ' (sin cuenta asignada)' : ''}: entró ${formatCOP(c.entradas)} · salió ${formatCOP(c.salidas)}`}
                valor={`Saldo ${formatCOP(c.saldo)}`}
                color={c.saldo < 0 ? '#F87171' : '#34D399'}
              />
            ))}
          </>
        )}
      </Seccion>

      <Seccion n={4} titulo="Productos vendidos" icon="pizza">
        <Fila label={`${totalUnidades} unidades · ${productos.length} productos`} valor={formatCOP(totalValor)} negrita />
        {productos.length > 0 && (
          <Pressable onPress={() => setVerProductos((v) => !v)} style={styles.toggle}>
            <Text style={styles.toggleTexto}>{verProductos ? 'Ocultar detalle' : `Ver los ${productos.length} productos`}</Text>
            <Icon name={verProductos ? 'chevron-up' : 'chevron-down'} size={16} color="#94A3B8" />
          </Pressable>
        )}
        {verProductos &&
          productos.map((p) => (
            <Fila key={p.clave} sub label={`${p.nombre} × ${p.unidades}`} valor={formatCOP(p.valor)} />
          ))}
      </Seccion>

      <Seccion n={5} titulo="Ajustes manuales de precio" icon="tag-edit-outline">
        <Fila label="Aumentos sobre el precio de lista" valor={formatCOP(aj.aumentos)} color="#34D399" />
        <Fila label="Bajas / descuentos" valor={formatCOP(aj.bajas)} color="#F87171" />
        <Fila label="Ajuste neto" valor={formatCOP(aj.neto)} negrita />
        <Fila sub label={`${aj.lineasManuales} líneas con precio manual${aj.sinPrecioLista > 0 ? ` · ${aj.sinPrecioLista} sin precio de lista (histórico, no calculable)` : ''}`} />
        {conAjuste.map((p) => (
          <Fila key={p.clave} sub label={`↳ ${p.nombre} (${p.lineasManuales})`} valor={formatCOP(p.ajuste)} color={p.ajuste < 0 ? '#F87171' : '#34D399'} />
        ))}
      </Seccion>

      <Seccion n={6} titulo="Gastos" icon="cash-minus">
        <Fila label="Pagados" valor={`−${formatCOP(gastos.pagados)}`} negrita color="#F87171" />
        <Fila sub label={`Pendientes de pago`} valor={formatCOP(gastos.pendientes)} />
        {(['costo', 'gasto', 'sin_clasificar'] as const)
          .filter((t) => (tipo(t)?.total ?? 0) > 0)
          .map((t) => (
            <View key={t} style={{ gap: 4 }}>
              <Fila sub label={`${TIPO_GASTO_META[t].label} (pagados)`} valor={formatCOP(tipo(t)?.pagados ?? 0)} color={TIPO_GASTO_META[t].color} />
              {gastos.porCategoria
                .filter((c) => c.tipo === t)
                .map((c) => (
                  <Fila key={`${t}-${c.categoria}`} sub label={`    · ${nombreCategoria(c.categoria)} (${c.cantidad})`} valor={formatCOP(c.total)} />
                ))}
            </View>
          ))}
      </Seccion>

      <Seccion n={7} titulo="Balance de caja" icon="scale-balance">
        <Fila label="Cobrado" valor={formatCOP(ventas.cobrado)} />
        <Fila label="− Gastos pagados" valor={formatCOP(gastos.pagados)} />
        <Fila label="Balance de caja (cobrado − gastos pagados)" valor={formatCOP(balance.cobrado)} negrita color={balance.cobrado >= 0 ? '#F5A524' : '#EF4444'} />
        <Fila sub label="Utilidad bruta (cobrado − costos pagados)" valor={formatCOP(resultado.utilidadBruta)} />
        <Fila sub label="Resultado devengado (facturado − todos los gastos)" valor={formatCOP(balance.devengado)} />
      </Seccion>
    </View>
  );
}

function Seccion({ n, titulo, icon, children }: { n: number; titulo: string; icon: IconName; children: React.ReactNode }) {
  return (
    <Card style={styles.card}>
      <View style={styles.cabecera}>
        <Icon name={icon} size={16} color="#F5A524" />
        <Text style={styles.titulo}>{n}. {titulo}</Text>
      </View>
      <View style={{ gap: 8 }}>{children}</View>
    </Card>
  );
}

function Fila({ label, valor, negrita, sub, color }: { label: string; valor?: string; negrita?: boolean; sub?: boolean; color?: string }) {
  return (
    <View style={styles.fila}>
      <Text style={[sub ? styles.labelSub : styles.label, negrita && styles.negrita]} numberOfLines={3}>
        {label}
      </Text>
      {valor != null && <Text style={[sub ? styles.valorSub : styles.valor, negrita && styles.negrita, color ? { color } : null]}>{valor}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { padding: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)', backgroundColor: 'rgba(255,255,255,0.03)' },
  cabecera: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  titulo: { fontFamily: 'SpaceGrotesk-Bold', color: '#F5A524', fontSize: 12, textTransform: 'uppercase', letterSpacing: 1 },
  fila: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 },
  label: { flex: 1, fontFamily: 'Outfit', color: '#CBD5E1', fontSize: 13 },
  labelSub: { flex: 1, fontFamily: 'Outfit', color: '#64748B', fontSize: 11 },
  valor: { fontFamily: 'SpaceGrotesk-Bold', color: '#F8FAFC', fontSize: 14 },
  valorSub: { fontFamily: 'SpaceGrotesk-Bold', color: '#94A3B8', fontSize: 12 },
  negrita: { fontFamily: 'SpaceGrotesk-Bold', fontWeight: '800', color: '#F8FAFC' },
  toggle: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 8, paddingHorizontal: 10, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.05)' },
  toggleTexto: { color: '#94A3B8', fontSize: 11, fontWeight: '800', textTransform: 'uppercase' },
});
